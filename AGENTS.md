<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:claude-design-system -->
# Design System — "Claude Design"

This project's UI follows the **Claude Design** system (a shadcn/ui-based
library, "radix-nova" style). When generating or editing any UI, obey these
rules. Source of truth: `../claude-design/claude-design` (and its Open Design
import).

## Tokens (use CSS variables, never hardcode colors)
- Colors are OKLCH, exposed as CSS custom properties. Reference via Tailwind
  utilities (`bg-background`, `text-foreground`, `bg-primary`, `text-muted-foreground`,
  `border-border`, etc.) or `var(--token)`. Never inline hex/rgb.
- **Primary**: vivid indigo-violet — `--primary: oklch(0.457 0.24 277.023)`.
  This is the only accent hue. Do not introduce other accent colors.
- **Neutrals are achromatic** (chroma 0): `--background`, `--muted`, `--accent`,
  `--border`, `--input`, `--card`. Keep grays gray — never tint them.
- **Destructive** (errors/delete): red `oklch(0.577 0.245 27.325)`.
- **Charts**: violet ramp `--chart-1..5` (hue 274–277). Use these for data viz.
- Full **light + dark** themes — every surface must work in both. Dark mode via
  `.dark` class.

## Shape & spacing
- Base radius `--radius: 0.45rem`; scale tiers `--radius-sm`(0.6×) →
  `--radius-4xl`(2.6×). Always use `var(--radius-*)` / `rounded-*` — never inline
  `border-radius`.

## Typography
- **Geist Variable** for everything; headings and body share one typeface
  (`--font-heading = --font-sans`). Geometric, clean. No serif, no second family.

## Icons
- **HugeIcons** only: `<HugeiconsIcon icon={SomeIcon} strokeWidth={2} />` from
  `@hugeicons/react` + `@hugeicons/core-free-icons`. 2px stroke weight.

## Component conventions (52 components / 278 exports)
- Compose from existing primitives; don't reinvent. Key patterns:
  - **Button** variants: default | outline | secondary | ghost | destructive | link.
    Sizes: default | xs | sm | lg | icon(+icon-xs/sm/lg). `asChild` for links.
  - **Card**: Header/Title/Description/Content/Footer/Action. `CardFooter` is a
    `bg-muted/50` action row.
  - **Forms**: `Field` + `FieldLabel` + `FieldDescription` + `FieldError` in a
    `FieldGroup`. Mark invalid with `data-invalid` + `aria-invalid`.
  - **Overlays** (Dialog/Sheet/Popover/Tooltip/DropdownMenu): Radix portals;
    control with `open`/`onOpenChange`. Wrap app in `TooltipProvider`.
  - **Empty** state: `Empty > EmptyHeader > EmptyMedia + EmptyTitle + EmptyDescription`.

## Aesthetic guardrails (anti-patterns — do NOT do these)
- No heavy/dark borders, no decorative gradients, no multiple accent hues, no
  playful/oversized rounding. Keep it crisp, neutral, utilitarian, developer-facing.
<!-- END:claude-design-system -->
