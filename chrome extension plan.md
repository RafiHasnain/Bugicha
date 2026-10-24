# Bugicha Chrome Extension — Build Plan

**For:** implementation agent (Codex)
**Depends on:** core Supabase MVP (auth, tickets, storage bucket, projects)
**Browser scope:** Chrome / Chromium only (Arc, Brave, Edge come free). Firefox and Safari deferred.
**Manifest:** V3

> **Scope note (revised after Codex repo review):** v1 is deliberately minimal. **Deferred to a later pass:** rrweb session replay, screen recording (§4.2), offline queue, monorepo restructure, shared UI package, and annotation beyond blur. Everything else in this document — including §9 web app changes, §10 distribution, and §11 tech stack — is v1 work.
>
> The authoritative v1 scope is **§12, steps 1–9.** Where a section contains both v1 and deferred material, it is split into explicit **V1** and **Future** subsections.
>
> All Chrome API references target MV3. Some MV2 documentation URLs describe these APIs differently — in particular `chrome.tabCapture` requires an offscreen document under MV3. Not relevant to v1 since recording is deferred, but do not build against MV2 semantics later.

---

## 1. Why this exists

The web app can already collect a screenshot, a recording, and basic environment data. The extension adds the three things the web app fundamentally cannot:

1. **The 30 seconds *before* the reporter noticed.** Web-app recording requires reproducing the bug on camera. The extension already has it buffered.
2. **Console errors and failed network requests** with real payloads.
3. **One-click screenshot with no browser picker dialog.**

Everything else in the extension is packaging around those three.

---

## 2. Architecture

```
┌─ MAIN world script (injected) ──────────────────┐
│  Patches fetch / XHR / console / window.onerror │
│  Rolling buffers in memory — never transmitted  │
│  unless the user reports                        │
│  [Future: rrweb recorder]                       │
└──────────────┬──────────────────────────────────┘
               │ window.postMessage
┌──────────────▼──────────────────────────────────┐
│  Content script (ISOLATED world)                │
│  Owns the in-page widget (Shadow DOM)           │
│  Relays buffer to service worker on demand      │
└──────────────┬──────────────────────────────────┘
               │ chrome.runtime
┌──────────────▼──────────────────────────────────┐
│  Service worker                                 │
│  Auth token, domain list, screenshot capture,   │
│  redaction, upload to Supabase                  │
└─────────────────────────────────────────────────┘
```

### 2.1 Why MAIN world, not the DevTools API

`chrome.devtools.network` only functions while a DevTools panel is open. It cannot back a rolling buffer. The working approach is patching in the page's own JS context, injected via `chrome.scripting` with `world: 'MAIN'`.

Patch: `window.fetch`, `XMLHttpRequest.prototype.open/send`, `console.error`, `console.warn`, `window.onerror`, `unhandledrejection`.

**This is the highest-risk code in the product** — it runs inside production apps, and a mistake here breaks the app you are trying to debug. See §2.3 for the required implementation. Do not write this patch from first principles.

### 2.2 Rolling buffers (approved: console + network)

| Buffer | Window | Cap | Notes |
|---|---|---|---|
| Console | 30s | 200 entries | errors + warnings only, never `console.log` |
| Network | 30s | 50 entries | **failed requests only** (4xx/5xx/timeout) |
| ~~rrweb replay~~ | — | — | **Deferred.** Future: 30s, ~5 MB, `checkoutEveryNms: 10000` |

- Ring buffers in memory. **Never written to disk, never transmitted, discarded on tab close.**
- Response bodies truncated at 32 KB each.
- Buffers exist per-tab and only on granted domains.
- Memory guard: if total exceeds ~20 MB, evict in the order *replay → network → console* (§12.1). Replay is always empty in v1; write the policy anyway.

This is *not* the passive telemetry that was deferred. Nothing leaves the browser unless the user clicks report.

### 2.3 Patching safety — mandatory requirements

The failure mode here is uniquely bad: the bug appears in the **app**, not the extension. An engineer sees checkout failing in production and debugs their own code for two hours before anyone thinks to disable the extension. A bug-reporting tool that manufactures phantom bugs is worse than no tool at all.

#### Rule 1 — capture code never touches the return path

The patch's only job is to return exactly what the original returned. All recording happens off the critical path.

```js
const origFetch = window.fetch;

window.fetch = function (...args) {
  const promise = origFetch.apply(this, args);

  // Fire-and-forget. Nothing in here can affect the caller.
  queueMicrotask(() => {
    try {
      promise.then(
        (res) => { if (!res.ok) safeRecord(args, res.clone()); },
        () => {}                          // swallow — the app owns this rejection
      );
    } catch (_) { /* never propagate */ }
  });

  return promise;                          // original object, original timing
};
```

Required properties, all of them:

- **Return the original promise object**, never a wrapper — some callers compare identity or attach their own properties
- **No `await` before returning** — any added latency hits every API call in the app
- **`res.clone()` before reading** — reading the original consumes the stream and the app receives an empty body
- **Swallow rejections in the recorder** — attaching a `.then` rejection handler must not mark the promise as handled in a way that changes app behaviour, and must never surface a new unhandled rejection
- **`apply(this, args)`** — preserve the calling context
- Same discipline for `XMLHttpRequest`: wrap `open`/`send` and listen via `addEventListener('loadend')` rather than overwriting `onreadystatechange`, which would clobber the app's own handler

#### Rule 2 — circuit breaker

Misbehaving capture code disables itself rather than failing repeatedly.

```js
let errorCount = 0;

function safeRecord(...args) {
  if (errorCount > 5) return;              // permanently off for this page load
  try {
    record(...args);
  } catch (e) {
    errorCount++;
  }
}
```

Five failures and capture goes quiet for that page. The app keeps working; you lose capture on one tab. Report the trip count with the next submitted ticket so the failure is visible to you.

#### Rule 3 — remote kill switch, built before it is needed

The service worker polls a config endpoint on the Bugicha backend (~15 min interval, cached in `chrome.storage.local`):

```json
{
  "capture_enabled": true,
  "disabled_projects": [],
  "disabled_features": []
}
```

If `capture_enabled` is false, the content script never injects. When something breaks in production at 2am, you flip a flag and every browser stops within 15 minutes.

**Without this, your only remedy is a Chrome Web Store update — which takes days of review.** Make it per-project so one bad app does not require killing capture everywhere. Add a per-user local override in the popup ("pause capture on this site") for the same reason.

#### Rule 4 — test against real apps, not fixtures

Run each Fringecore app's full E2E suite twice, with and without the extension loaded, and diff the results. **Any behavioural difference is a release blocker.**

Explicitly probe:

- Streaming responses and Server-Sent Events
- `AbortController` / cancelled requests
- Request retry logic
- `FormData` uploads and large request bodies
- Service worker request interception
- Direct `XMLHttpRequest` usage
- Third-party scripts that also patch `fetch` (analytics SDKs commonly do — verify patch order does not matter)

#### Rule 5 — staged rollout

| Stage | Audience | Duration |
|---|---|---|
| 1 | localhost only | ~1 week |
| 2 | staging domains | ~1 week |
| 3 | 2 volunteer engineers on production | ~1 week |
| 4 | all engineers | ~1 week |
| 5 | full reporter rollout | — |

Each stage catches what the previous stage's tests missed. Do not compress this.

---

## 3. UI surfaces

**Copy the Tailwind config and the minimum tokens/classes you need into the extension.** Do **not** extract a shared `packages/ui` first — that is a monorepo refactor justified by duplication that has not happened yet. Extract later if maintaining two copies actually hurts.

The report form should look visually consistent with the web app, but visual consistency does not require shared code at this stage.

### 3.1 In-page widget — the primary surface

A floating button, bottom-right, rendered inside **Shadow DOM with adopted stylesheets** so the host page's CSS cannot leak in and vice versa.

Why not the popup: **a Chrome popup closes the instant the user clicks the page.** Annotation, area selection, and recording all require page interaction. This is the single most common mistake in bug-reporter extensions.

States: idle button → expanded form → annotating → reviewing → submitting → success. (A `recording` state joins this list when recording lands.)

### 3.2 Popup (toolbar icon)

Auth state, project selector, domain access status ("This site isn't in your project list"), link to the web app, settings. Lightweight — it is not where reporting happens.

### 3.3 Pre-submit review screen — mandatory

Reporter sees every captured item before anything uploads:

- Screenshot thumbnail (removable)
- Recording preview (removable)
- **Console entries — expandable list, individually removable**
- **Network requests — URL, status, headers, body preview, individually removable**
- Environment block

**No silent transmission of console or network data.** This is the redaction step and it is not optional (§7).

---

## 4. Capture flows

### 4.1 Screenshot

`chrome.tabs.captureVisibleTab()` — instant, no picker dialog. Significantly better UX than the web app's `getDisplayMedia`.

**Permission requirement:** `captureVisibleTab()` needs either the `activeTab` permission or host permission for the tab's origin, **and must be triggered by a user gesture.** Two consequences for the UX:

- The screenshot button lives in the in-page widget and calls through to the service worker on click. It cannot be fired on a timer, on page load, or automatically when the report form opens.
- Since v1 already holds host permission for granted domains (§5.2), `activeTab` is not strictly required — but declare it anyway as a fallback for the moment between install and the domain grant.

Then: **rectangle-blur only for v1.** Blur must flatten into the exported PNG, never remain a separate layer.

Arrows, freehand, and text annotation are deferred — they are polish. Blur is not: screenshots capture whatever is on screen, including customer records, open email, and internal dashboards. Without it the screenshot path has no redaction at all while the network path has four layers.

### 4.2 Screen recording — DEFERRED, not v1

Retained for the later pass. Do not build in v1.

Two options — implement A, fall back to B:

**A. `chrome.tabCapture.getMediaStreamId()` + offscreen document.** No picker dialog, captures the current tab only. Better UX, more moving parts (offscreen document lifecycle in MV3 is fiddly).

**B. `getDisplayMedia()`** as in the web app. Picker dialog required.

Either way: **60-second hard cap, ~25 MB ceiling, auto-stop.** Visible countdown timer.

### 4.3 Environment

Without the app-side snippet (deferred to Phase 2), infer: URL, route, user agent, browser + version, OS, viewport, DPR, and `document.referrer`. Set `app_version: null` and `user_id: null` explicitly rather than guessing — a wrong build SHA is worse than an absent one.

Write into the existing `capture` JSONB column with `capture_schema_version = 2`.

---

## 5. Domain management (PM-controlled)

### 5.1 Schema

```sql
create table project_domains (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  project_id uuid not null references projects(id) on delete cascade,
  pattern text not null,        -- 'https://app.fringecore.com/*'
  environment text not null,    -- 'production' | 'staging' | 'local'
  created_at timestamptz not null default now()
);
```

New PM/Admin page: **Settings → Projects → Domains.** Add, edit, remove patterns per project, tagged by environment. `environment` flows into `capture` automatically, so engineers immediately know whether a report came from prod or staging.

Validate patterns against Chrome's match-pattern grammar on save and reject invalid ones with a clear message — a malformed pattern silently disables capture otherwise.

### 5.2 Dynamic host permissions

Do **not** hardcode domains in the manifest. Request them at runtime:

```json
"host_permissions": [],
"optional_host_permissions": ["https://*/*", "http://localhost/*"]
```

Flow:
1. User logs into the extension
2. Extension fetches `project_domains` for their org
3. Popup shows "Bugicha needs access to these sites" with the list
4. **User gesture** → `chrome.permissions.request({ origins: [...] })`
5. `chrome.scripting.registerContentScripts()` registers against granted origins
6. Re-check on every extension startup; prompt again if the PM added new domains

`chrome.permissions.request()` requires a user gesture — it cannot be called from the service worker on a timer.

**Reject `<all_urls>` as a static permission.** It reads every site the user visits, it is a hard internal sell, and it invites Chrome Web Store review scrutiny.

---

## 6. Authentication

**Use `externally_connectable`**, not cookie reading. Cleaner, more secure, no `cookies` permission.

```json
"externally_connectable": {
  "matches": ["https://bugicha.fringecore.com/*"]
}
```

Flow:
1. User clicks "Chrome Extension" in the sidebar (§9) → install → lands on `/extension/connect`
2. That page detects the extension via `chrome.runtime.sendMessage(EXTENSION_ID, {...})`
3. Web app sends the Supabase session (access + refresh token) to the extension
4. Extension stores the tokens (see below) and refreshes via Supabase like any client
5. Sign-out in the web app broadcasts a revoke message

Only the Bugicha origin can message the extension, enforced by the manifest. Validate the sender origin in the message handler regardless.

### 6.1 Token storage — sessions must survive browser restart

`chrome.storage.session` is cleared on browser restart. Storing the refresh token there would force every reporter to reconnect each morning, which for 30–100 self-installing non-technical users is an adoption killer.

**Decision — split by token lifetime:**

| Token | Storage | Rationale |
|---|---|---|
| Access token (short-lived) | `chrome.storage.session` | Cleared on restart; cheap to re-derive |
| Refresh token | `chrome.storage.local` | Persists across restarts; the connection is one-time |

**The tradeoff, stated plainly:** a refresh token in `chrome.storage.local` persists on disk. Extension storage is isolated from web pages and from other extensions, so the realistic exposure is local disk access or a compromise of this extension itself — comparable to how the web app already persists its own session. Given that, the UX gain clearly outweighs it.

Mitigations: rely on Supabase refresh-token rotation, clear both stores on sign-out or revoke, and expose a "disconnect" action in the popup.

**On sign-out in the web app:** broadcast a revoke message and clear `storage.local` as well as `storage.session`.

**Fallback:** if the handshake fails, the popup offers direct email/password login against Supabase. Do not leave the user stuck.

---

## 7. Redaction — ships with the extension, not after

Console and network capture means auth tokens, session cookies, emails, phone numbers, and potentially payment data. This is the highest-severity risk in the product.

**Layer 1 — never captured**
Strip `Authorization`, `Cookie`, `Set-Cookie`, `X-API-Key`, `X-Auth-Token` from both request and response headers before the buffer.

**Layer 2 — pattern scrubbing** on bodies and console output: JWTs (`eyJ[A-Za-z0-9_-]{10,}`), common API key prefixes (`sk_`, `pk_`, `ghp_`), emails, phone numbers, card-number patterns. Replace with `[REDACTED:jwt]` so it is visible that something was removed.

**Layer 3 — per-project denylist.** PM-configurable field names and URL patterns never captured. Extend `project_domains` settings page with a denylist textarea.

**Layer 4 — the pre-submit review screen (§3.3).** The reporter sees everything and can delete individual items.

All four layers ship together. Layer 4 is the one teams skip; it is also the one that makes this defensible to a customer later.

---

## 8. Upload

### 8.1 V1

1. Assemble the payload in the service worker
2. **Screenshot → Supabase Storage via authenticated `.upload()`**, matching the existing pattern in `src/lib/data-store.tsx`. Direct from the extension, never through the Next.js server.
3. Console, network, and environment → the `capture` JSONB column
4. Create the ticket, return the ref, show `WEB-BUG-00042` with a link

**Do not build signed upload URLs.** The app already uses authenticated `.upload()` against Storage; the extension carries the same Supabase session (§6), so it can use the identical call. Signed upload URLs are extra machinery for no v1 benefit.

**Correction to an earlier draft:** there is no existing `getAttachmentUrl()` abstraction. Signed-URL *read* logic is inline in `src/lib/data-store.tsx`. Extracting it is worth doing eventually for the R2 migration, but it is a separate task and **not a prerequisite for this extension.**

**On submit failure:** keep the form state and captured data in memory, show the error, offer a retry button. A `try/catch` and a state variable — not a queue. A reporter who loses their first report will not file a second.

### 8.2 Future

- Recording → Storage, with size caps and upload progress UI
- rrweb replay → Storage as a compressed JSON blob, referenced from `capture`
- Offline queue in `chrome.storage.local` with retry on reconnect. Deferred because it mainly protected 60-second recordings; a v1 failure is a small JSON payload plus one PNG.
- Extract `getAttachmentUrl()` ahead of any R2 migration

---

## 9. Web app changes

**Sidebar button — "Chrome Extension", above the profile card**, matching existing nav item styling. Three states:

- Not installed → "Install extension" → Chrome Web Store link
- Installed, not connected → "Connect extension" → `/extension/connect`
- Connected → subtle checkmark, links to extension settings

Detect via a `chrome.runtime.sendMessage` ping with a short timeout.

**New page `/extension/connect`** — handshake, permission-grant explainer, and a short "what gets captured" summary. This page carries the trust burden for the whole product; write it plainly and honestly.

**New page Settings → Projects → Domains** (§5.1), PM/Admin only.

---

## 10. Distribution

**Chrome Web Store, unlisted.** Not searchable; installs normally from a direct link.

Requirements before submission:
- Privacy policy URL — mandatory, and this extension will be scrutinised
- Written justification for each permission, especially `optional_host_permissions`
- Store listing assets: 128px icon, screenshots, description
- Single-purpose statement: bug reporting

Expect a **several-day review**, longer for permission-heavy extensions. Budget for one rejection round.

**Dogfooding before submission:** unpacked / developer mode for the engineering team. Fine for a few weeks, not a distribution strategy — Chrome nags about developer-mode extensions on every startup.

**Onboarding for 30–100 self-installing reporters:** since there is no force-install, adoption is entirely on the install flow. Announcement with the direct link, the sidebar button as the permanent entry point, and a one-screen walkthrough on first launch. Track install rate as a launch metric — if it stalls below ~60%, the reporting culture never forms.

---

## 11. Tech stack

- **WXT** or **CRXJS + Vite** for MV3 build tooling — both handle HMR for content scripts, which is otherwise painful
- React + Tailwind, with tokens/classes copied from the web app (§3)
- `@supabase/supabase-js` in the service worker
- **No monorepo restructure.** The repo is a single Next app; add the smallest possible `extension/` folder alongside it. Do not create `apps/web`, `apps/extension`, `packages/ui`, or `packages/types` for v1.
- Duplicate the `capture` TypeScript types in both places for now. Two copies of a small type file is cheaper than a workspace refactor; extract when it starts causing drift.
- `rrweb` — deferred with replay

---

## 12. Build order

1. Scaffold, manifest, service worker, popup shell — **including the remote kill switch gate (§2.3, Rule 3)**
2. Auth handshake (§6) + sidebar button and `/extension/connect` (§9)
3. `project_domains` schema, PM settings page, dynamic permission flow (§5)
4. Content script + MAIN world injection; console buffer only
5. Network buffer with Layers 1–2 redaction (§7)
6. In-page widget, Shadow DOM, report form
7. One-click screenshot + **rectangle-blur only** (§4.1)
8. Pre-submit review screen (§3.3)
9. Submit into the existing Supabase schema, with in-memory retry on failure (§8)
10. Store submission

**Steps 1–9 are the whole of v1 and a shippable product.**

**Deferred to a later pass:** rrweb replay, screen recording, offline queue, monorepo restructure, shared UI package, annotation beyond blur, Firefox and Safari.

Two items are *not* deferrable despite the trimmed scope, because both are worthless if added later: **the kill switch in step 1**, and **screenshot blur in step 7**.

### 12.1 Shipping 1–8 without painting yourself into a corner

Replay, screen recording, and large-file upload are roughly **40% of total build time and the least essential capability**. An engineer with a stack trace, a failed request, and a screenshot usually already knows what is wrong; replay tends to confirm rather than reveal.

So ship v1 early — it starts the adoption clock months sooner. Leave two small slots open so adding replay later is not a restructure.

#### Use a plain ring buffer, not an abstraction

A small ring-buffer utility is sufficient. **Do not build a generic `CaptureBuffer<T>` interface** — two concrete buffers do not justify an abstraction layer.

```ts
function ringBuffer<T>(maxEntries: number) {
  const items: T[] = [];
  return {
    push(e: T) { items.push(e); if (items.length > maxEntries) items.shift(); },
    drain() { return items.slice(); },
    clear() { items.length = 0; },
  };
}
```

#### Keep the payload shape open

This part *is* worth doing in step 4, because the fields cost nothing and the web app needs to handle their absence anyway — web-form reports will never have them.

```ts
interface CapturePayload {
  environment: EnvironmentInfo;
  console: ConsoleEntry[];
  network: NetworkEntry[];
  screenshot?: AttachmentRef;
  replay?: ReplayChunk[];        // present in the type, never populated in v1
  recording?: AttachmentRef;     // present in the type, never populated in v1
}
```

#### Three slots that must be open from the start

**Memory eviction policy.** Write it in step 4 as *drop replay first, then network, then console* — even though replay is permanently empty. Otherwise memory management gets rewritten when replay lands and doubles the footprint.

**Review screen sections.** Render from a list of section descriptors, not a fixed layout. Adding a replay section then becomes a config entry.

**Ticket detail page.** Handle absent `replay` and `recording` gracefully from v1.

#### Validate before building the expensive half

Dogfood replay and recording with engineers only, behind a feature flag, before releasing broadly.

**The number that decides it:** how often an engineer marks a ticket *cannot reproduce* **while full console and network data is attached.**

| Rate | Read |
|---|---|
| Under 10% | Replay is a nice-to-have. Consider descoping. |
| Around 30% | Replay is the missing piece. Build it properly. |

Instrument this from the first day v1 is live. It is a cheap measurement that decides weeks of work.

---

## 13. Testing

- [ ] Patched `fetch`/XHR return identical values to unpatched; no behavioural change in the host app
- [ ] A thrown error inside a patch does not break the host page
- [ ] Full E2E suite of each target app passes identically with and without the extension loaded
- [ ] Circuit breaker trips after 5 recorder failures and the app continues normally
- [ ] Remote kill switch disables capture within one poll interval
- [ ] Patch coexists with a third-party script that also patches `fetch`, in either load order
- [ ] Streaming responses, `AbortController`, and `FormData` uploads are unaffected
- [ ] The app's own `onreadystatechange` handler still fires on patched XHR
- [ ] Buffers hold exactly 30s and evict correctly under load
- [ ] Memory stays bounded on a page left open for hours
- [ ] Nothing transmits unless the user submits — verify with a network monitor across a long session
- [ ] `Authorization` and `Cookie` headers never appear in a submitted payload
- [ ] JWT and email patterns are scrubbed in both bodies and console output
- [ ] Deleting an item in the review screen removes it from the upload
- [ ] Blur annotations are flattened into the exported PNG
- [ ] Widget renders correctly on a page with aggressive global CSS
- [ ] Screenshot requires a user gesture and succeeds on a granted domain
- [ ] Extension is inert on a domain not in `project_domains`
- [ ] PM adds a domain → extension re-prompts for permission on next start
- [ ] Sign-out in the web app revokes the extension session and clears `storage.local`
- [ ] Session survives a full browser restart without reconnecting
- [ ] A failed submit preserves form state and captured data, and the retry button works

### 13.1 Future (with replay and recording)

- [ ] Recording auto-stops at 60s
- [ ] Replay buffer evicts first under memory pressure
- [ ] Offline submission queues and retries on reconnect

---

## 14. Next phase

**App-side SDK snippet — confirmed for the phase after this.** A ~20-line snippet in each Fringecore app exposing:

```js
window.__BUGICHA__ = {
  version: '1.0',
  buildSha: process.env.BUILD_SHA,
  environment: 'production',
  user: { id, email },
  featureFlags: {...},
  onError: (cb) => {...}
};
```

The extension reads it when present and falls back to inference when absent. This roughly doubles capture quality: exact build SHA (currently null), true user identity, active feature flags, and framework-level error context. It is the highest-value item in the backlog after this extension ships.

**Also deferred:** Firefox and Safari builds, GitHub status automation, duplicate detection, passive telemetry and ghost tickets, agent-drafted fixes, mobile shake-to-report SDK.