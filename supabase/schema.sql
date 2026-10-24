create extension if not exists pgcrypto;

do $$ begin
  create type public.app_role as enum ('general', 'engineer', 'pm', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ticket_type as enum ('bug', 'feature_request', 'task');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ticket_severity as enum ('critical', 'high', 'medium', 'low');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ticket_status as enum (
    'submitted',
    'in_review',
    'approved',
    'rejected',
    'assigned',
    'in_progress',
    'resolved',
    'closed'
  );
exception when duplicate_object then null; end $$;

create sequence if not exists public.ticket_reference_seq;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role public.app_role not null default 'general',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default ('BUG-' || lpad(nextval('public.ticket_reference_seq')::text, 5, '0')),
  title text not null,
  description text not null,
  type public.ticket_type not null default 'bug',
  severity public.ticket_severity not null default 'medium',
  status public.ticket_status not null default 'submitted',
  reporter_id uuid not null references public.profiles(id),
  assignee_id uuid references public.profiles(id),
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ticket_comments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  body text not null,
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.ticket_audit_log (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  changed_by uuid references public.profiles(id),
  old_status public.ticket_status,
  new_status public.ticket_status not null,
  old_assignee_id uuid references public.profiles(id),
  new_assignee_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  ticket_id uuid references public.tickets(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists tickets_reference_idx on public.tickets(reference);
create index if not exists tickets_reporter_id_idx on public.tickets(reporter_id);
create index if not exists tickets_assignee_id_idx on public.tickets(assignee_id);
create index if not exists tickets_status_idx on public.tickets(status);
create index if not exists tickets_severity_idx on public.tickets(severity);
create index if not exists ticket_comments_ticket_id_created_at_idx on public.ticket_comments(ticket_id, created_at);
create index if not exists ticket_audit_log_ticket_id_created_at_idx on public.ticket_audit_log(ticket_id, created_at);
create index if not exists notifications_user_id_read_created_at_idx on public.notifications(user_id, read, created_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_tickets_updated_at on public.tickets;
create trigger set_tickets_updated_at
before update on public.tickets
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

drop policy if exists "profiles_update_self" on public.profiles;
drop policy if exists "tickets_select_visible" on public.tickets;
drop policy if exists "tickets_update_pm_or_assignee" on public.tickets;
drop policy if exists "comments_select_visible" on public.ticket_comments;
drop policy if exists "comments_insert_visible" on public.ticket_comments;
drop policy if exists "audit_select_visible" on public.ticket_audit_log;

create or replace function public.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from public.profiles where id = (select auth.uid())), 'general'::public.app_role);
$$;

create or replace function public.can_read_ticket(ticket public.tickets)
returns boolean
language sql
stable
security invoker
as $$
  select
    public.current_user_role() in ('pm', 'admin')
    or ticket.reporter_id = (select auth.uid())
    or ticket.assignee_id = (select auth.uid());
$$;

create or replace function public.audit_ticket_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.ticket_audit_log (ticket_id, changed_by, old_status, new_status, old_assignee_id, new_assignee_id)
    values (new.id, new.reporter_id, null, new.status, null, new.assignee_id);
  elsif old.status is distinct from new.status or old.assignee_id is distinct from new.assignee_id then
    insert into public.ticket_audit_log (ticket_id, changed_by, old_status, new_status, old_assignee_id, new_assignee_id)
    values (new.id, (select auth.uid()), old.status, new.status, old.assignee_id, new.assignee_id);
  end if;
  return new;
end;
$$;

drop trigger if exists audit_ticket_insert on public.tickets;
create trigger audit_ticket_insert
after insert on public.tickets
for each row execute function public.audit_ticket_changes();

drop trigger if exists audit_ticket_update on public.tickets;
create trigger audit_ticket_update
after update on public.tickets
for each row execute function public.audit_ticket_changes();

create or replace function public.notify_ticket_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.assignee_id is not null and old.assignee_id is distinct from new.assignee_id then
    insert into public.notifications (user_id, ticket_id, type, title, body)
    values (new.assignee_id, new.id, 'assigned', 'Ticket assigned', new.reference || ' was assigned to you.');
  end if;
  return new;
end;
$$;

drop trigger if exists notify_ticket_assignment_update on public.tickets;
create trigger notify_ticket_assignment_update
after update on public.tickets
for each row execute function public.notify_ticket_assignment();

alter table public.profiles enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_comments enable row level security;
alter table public.ticket_audit_log enable row level security;
alter table public.notifications enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.tickets to authenticated;
grant select, insert on public.ticket_comments to authenticated;
grant select on public.ticket_audit_log to authenticated;
grant select, update on public.notifications to authenticated;
grant usage, select on sequence public.ticket_reference_seq to authenticated;

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
on public.profiles for select
to authenticated
using (true);

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id or public.current_user_role() in ('pm', 'admin'))
with check ((select auth.uid()) = id or public.current_user_role() in ('pm', 'admin'));

drop policy if exists "tickets_select_visible" on public.tickets;
create policy "tickets_select_visible"
on public.tickets for select
to authenticated
using (public.can_read_ticket(tickets));

drop policy if exists "tickets_insert_own" on public.tickets;
create policy "tickets_insert_own"
on public.tickets for insert
to authenticated
with check (reporter_id = (select auth.uid()));

drop policy if exists "tickets_update_pm_or_assignee" on public.tickets;
create policy "tickets_update_pm_or_assignee"
on public.tickets for update
to authenticated
using (
  public.current_user_role() in ('pm', 'admin')
  or assignee_id = (select auth.uid())
)
with check (
  public.current_user_role() in ('pm', 'admin')
  or assignee_id = (select auth.uid())
);

drop policy if exists "comments_select_visible" on public.ticket_comments;
create policy "comments_select_visible"
on public.ticket_comments for select
to authenticated
using (
  exists (
    select 1 from public.tickets
    where tickets.id = ticket_comments.ticket_id
    and public.can_read_ticket(tickets)
  )
  and (not is_internal or public.current_user_role() in ('engineer', 'pm', 'admin'))
);

drop policy if exists "comments_insert_visible" on public.ticket_comments;
create policy "comments_insert_visible"
on public.ticket_comments for insert
to authenticated
with check (
  author_id = (select auth.uid())
  and exists (
    select 1 from public.tickets
    where tickets.id = ticket_comments.ticket_id
    and public.can_read_ticket(tickets)
  )
);

drop policy if exists "audit_select_visible" on public.ticket_audit_log;
create policy "audit_select_visible"
on public.ticket_audit_log for select
to authenticated
using (
  exists (
    select 1 from public.tickets
    where tickets.id = ticket_audit_log.ticket_id
    and public.can_read_ticket(tickets)
  )
);

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
on public.notifications for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
on public.notifications for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- plan v2: org/project workflow shape, attachments, stricter statuses.
do $$ begin
  alter type public.ticket_status add value if not exists 'triage';
  alter type public.ticket_status add value if not exists 'needs_info';
  alter type public.ticket_status add value if not exists 'backlog';
  alter type public.ticket_status add value if not exists 'todo';
  alter type public.ticket_status add value if not exists 'merged';
  alter type public.ticket_status add value if not exists 'released';
  alter type public.ticket_status add value if not exists 'verified';
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ticket_priority as enum ('p0', 'p1', 'p2', 'p3');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.rejection_reason as enum (
    'duplicate',
    'works_as_designed',
    'cannot_reproduce',
    'out_of_scope',
    'wont_fix_now'
  );
exception when duplicate_object then null; end $$;

-- apply-schema:break

create table if not exists public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

insert into public.orgs (name)
select 'Fringecore'
where not exists (select 1 from public.orgs);

create or replace function public.default_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.orgs order by created_at, id limit 1;
$$;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id),
  key text not null,
  name text not null,
  repo_url text,
  created_at timestamptz not null default now(),
  unique (org_id, key)
);

insert into public.projects (org_id, key, name, repo_url)
select public.default_org_id(), 'WEB', 'Bugicha Web', null
where not exists (select 1 from public.projects);

create or replace function public.default_project_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.projects order by created_at, id limit 1;
$$;

alter table public.profiles add column if not exists org_id uuid references public.orgs(id);
update public.profiles set org_id = public.default_org_id() where org_id is null;
alter table public.profiles alter column org_id set default public.default_org_id();
alter table public.profiles alter column org_id set not null;

alter table public.tickets add column if not exists org_id uuid references public.orgs(id);
alter table public.tickets add column if not exists project_id uuid references public.projects(id);
alter table public.tickets add column if not exists priority public.ticket_priority;
alter table public.tickets add column if not exists capture jsonb;
alter table public.tickets add column if not exists capture_schema_version int not null default 1;
alter table public.tickets add column if not exists duplicate_of uuid references public.tickets(id);
alter table public.tickets add column if not exists sentry_issue_url text;
alter table public.tickets add column if not exists branch_name text;
alter table public.tickets add column if not exists pr_url text;
alter table public.tickets add column if not exists released_in_version text;
alter table public.tickets add column if not exists rejection_reason public.rejection_reason;
alter table public.tickets add column if not exists rejection_note text;
alter table public.tickets add column if not exists verified_at timestamptz;
alter table public.tickets add column if not exists verified_by uuid references public.profiles(id);
update public.tickets
set
  org_id = coalesce(org_id, public.default_org_id()),
  project_id = coalesce(project_id, public.default_project_id());
alter table public.tickets alter column org_id set default public.default_org_id();
alter table public.tickets alter column org_id set not null;
alter table public.tickets alter column project_id set default public.default_project_id();
alter table public.tickets alter column project_id set not null;
alter table public.tickets alter column status set default 'submitted'::public.ticket_status;
alter table public.tickets alter column reference drop default;
update public.tickets set status = 'triage'::public.ticket_status where status = 'in_review'::public.ticket_status;
update public.tickets set status = 'backlog'::public.ticket_status where status = 'approved'::public.ticket_status;
update public.tickets set status = 'merged'::public.ticket_status where status = 'resolved'::public.ticket_status;
update public.tickets set reference = 'WEB-' || reference where reference !~ '^[A-Z0-9]+-[A-Z]+-[0-9]+$';

alter table public.ticket_comments add column if not exists org_id uuid references public.orgs(id);
update public.ticket_comments
set org_id = coalesce(org_id, (select tickets.org_id from public.tickets where tickets.id = ticket_comments.ticket_id), public.default_org_id());
alter table public.ticket_comments alter column org_id set default public.default_org_id();
alter table public.ticket_comments alter column org_id set not null;

alter table public.ticket_audit_log add column if not exists org_id uuid references public.orgs(id);
update public.ticket_audit_log
set org_id = coalesce(org_id, (select tickets.org_id from public.tickets where tickets.id = ticket_audit_log.ticket_id), public.default_org_id());
alter table public.ticket_audit_log alter column org_id set default public.default_org_id();
alter table public.ticket_audit_log alter column org_id set not null;

alter table public.notifications add column if not exists org_id uuid references public.orgs(id);
update public.notifications
set org_id = coalesce(org_id, (select profiles.org_id from public.profiles where profiles.id = notifications.user_id), public.default_org_id());
alter table public.notifications alter column org_id set default public.default_org_id();
alter table public.notifications alter column org_id set not null;

create table if not exists public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (project_id, user_id)
);

create table if not exists public.ticket_reporters (
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  primary key (ticket_id, user_id)
);

insert into public.ticket_reporters (ticket_id, user_id)
select id, reporter_id from public.tickets
on conflict do nothing;

create table if not exists public.ticket_attachments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  kind text not null check (kind in ('screenshot', 'recording', 'file')),
  storage_path text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 26214400),
  duration_ms int,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists profiles_org_id_idx on public.profiles(org_id);
create index if not exists projects_org_id_key_idx on public.projects(org_id, key);
create index if not exists project_members_user_id_idx on public.project_members(user_id);
create index if not exists tickets_org_id_project_id_status_idx on public.tickets(org_id, project_id, status);
create index if not exists tickets_project_id_status_idx on public.tickets(project_id, status);
create index if not exists tickets_priority_idx on public.tickets(priority);
create index if not exists tickets_duplicate_of_idx on public.tickets(duplicate_of);
create index if not exists ticket_reporters_user_id_idx on public.ticket_reporters(user_id);
create index if not exists ticket_attachments_ticket_id_idx on public.ticket_attachments(ticket_id);
create index if not exists ticket_attachments_storage_path_idx on public.ticket_attachments(storage_path);

create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from public.profiles where id = (select auth.uid());
$$;

create or replace function public.ticket_type_prefix(ticket_type public.ticket_type)
returns text
language sql
immutable
as $$
  select case ticket_type
    when 'bug' then 'BUG'
    when 'feature_request' then 'FEAT'
    when 'task' then 'TASK'
  end;
$$;

create or replace function public.set_ticket_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  project_key text;
begin
  new.org_id = coalesce(new.org_id, public.current_org_id(), public.default_org_id());
  new.project_id = coalesce(new.project_id, public.default_project_id());

  select key into project_key from public.projects where id = new.project_id;
  if new.reference is null then
    new.reference = coalesce(project_key, 'WEB') || '-' || public.ticket_type_prefix(new.type) || '-' || lpad(nextval('public.ticket_reference_seq')::text, 5, '0');
  end if;

  return new;
end;
$$;

drop trigger if exists set_ticket_defaults_before_insert on public.tickets;
create trigger set_ticket_defaults_before_insert
before insert on public.tickets
for each row execute function public.set_ticket_defaults();

create or replace function public.add_original_reporter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.ticket_reporters (ticket_id, user_id)
  values (new.id, new.reporter_id)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists add_original_reporter_after_insert on public.tickets;
create trigger add_original_reporter_after_insert
after insert on public.tickets
for each row execute function public.add_original_reporter();

create or replace function public.can_read_ticket(ticket public.tickets)
returns boolean
language sql
stable
security invoker
as $$
  select
    ticket.org_id = public.current_org_id()
    and (
      public.current_user_role() in ('pm', 'admin')
      or ticket.reporter_id = (select auth.uid())
      or ticket.assignee_id = (select auth.uid())
      or exists (
        select 1
        from public.ticket_reporters
        where ticket_reporters.ticket_id = ticket.id
        and ticket_reporters.user_id = (select auth.uid())
      )
      or (
        public.current_user_role() = 'engineer'
        and exists (
          select 1
          from public.project_members
          where project_members.project_id = ticket.project_id
          and project_members.user_id = (select auth.uid())
        )
      )
    );
$$;

create or replace function public.valid_ticket_transition(old_status public.ticket_status, new_status public.ticket_status)
returns boolean
language sql
immutable
as $$
  select old_status = new_status or (
    old_status = 'submitted' and new_status in ('triage', 'needs_info', 'rejected')
    or old_status = 'triage' and new_status in ('needs_info', 'backlog', 'rejected')
    or old_status = 'needs_info' and new_status in ('triage', 'rejected', 'closed')
    or old_status = 'backlog' and new_status in ('todo', 'rejected')
    or old_status = 'todo' and new_status in ('assigned', 'backlog', 'rejected')
    or old_status = 'assigned' and new_status in ('in_progress', 'todo', 'rejected')
    or old_status = 'in_progress' and new_status in ('merged', 'assigned')
    or old_status = 'merged' and new_status in ('released', 'in_progress')
    or old_status = 'released' and new_status in ('verified', 'triage', 'closed')
    or old_status = 'verified' and new_status = 'closed'
  );
$$;

create or replace function public.validate_ticket_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  role public.app_role := public.current_user_role();
begin
  if (select auth.uid()) is null then
    return new;
  end if;

  if old.status is distinct from new.status
    and not (
      role in ('pm', 'admin')
      and new.duplicate_of is not null
      and new.status = 'closed'::public.ticket_status
    )
    and not public.valid_ticket_transition(old.status, new.status)
  then
    raise exception 'Invalid status transition from % to %', old.status, new.status;
  end if;

  if role not in ('pm', 'admin') then
    if old.duplicate_of is distinct from new.duplicate_of then
      raise exception 'Only PM/admin can merge duplicates';
    end if;
    if old.priority is distinct from new.priority then
      raise exception 'Only PM/admin can change priority';
    end if;
    if old.rejection_reason is distinct from new.rejection_reason or old.rejection_note is distinct from new.rejection_note then
      raise exception 'Only PM/admin can reject tickets';
    end if;
  end if;

  if new.status = 'rejected' and (new.rejection_reason is null or length(trim(coalesce(new.rejection_note, ''))) = 0) then
    raise exception 'Rejection reason and note are required';
  end if;

  if new.status = 'verified' then
    new.verified_at = coalesce(new.verified_at, now());
    new.verified_by = coalesce(new.verified_by, (select auth.uid()));
  end if;

  return new;
end;
$$;

drop trigger if exists validate_ticket_update_before_update on public.tickets;
create trigger validate_ticket_update_before_update
before update on public.tickets
for each row execute function public.validate_ticket_update();

create or replace function public.audit_ticket_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.ticket_audit_log (org_id, ticket_id, changed_by, old_status, new_status, old_assignee_id, new_assignee_id)
    values (new.org_id, new.id, new.reporter_id, null, new.status, null, new.assignee_id);
  elsif old.status is distinct from new.status or old.assignee_id is distinct from new.assignee_id then
    insert into public.ticket_audit_log (org_id, ticket_id, changed_by, old_status, new_status, old_assignee_id, new_assignee_id)
    values (new.org_id, new.id, (select auth.uid()), old.status, new.status, old.assignee_id, new.assignee_id);
  end if;
  return new;
end;
$$;

create or replace function public.notify_ticket_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.assignee_id is not null and old.assignee_id is distinct from new.assignee_id then
    insert into public.notifications (org_id, user_id, ticket_id, type, title, body)
    values (new.org_id, new.assignee_id, new.id, 'assigned', 'Ticket assigned', new.reference || ' was assigned to you.');
  end if;
  return new;
end;
$$;

create or replace function public.notify_ticket_reporters()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status and new.status in ('rejected', 'needs_info', 'released') then
    insert into public.notifications (org_id, user_id, ticket_id, type, title, body)
    select
      new.org_id,
      ticket_reporters.user_id,
      new.id,
      'status',
      case new.status
        when 'rejected' then 'Ticket rejected'
        when 'needs_info' then 'More information needed'
        when 'released' then 'Fix released'
        else 'Ticket updated'
      end,
      case new.status
        when 'rejected' then coalesce(new.rejection_note, 'Ticket rejected.')
        when 'needs_info' then 'The team needs more information. See the ticket thread.'
        when 'released' then 'Fixed in ' || coalesce(new.released_in_version, 'the latest release') || '.'
        else 'Ticket updated.'
      end
    from public.ticket_reporters
    where ticket_reporters.ticket_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists notify_ticket_reporters_update on public.tickets;
create trigger notify_ticket_reporters_update
after update on public.tickets
for each row execute function public.notify_ticket_reporters();

alter table public.orgs enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.ticket_reporters enable row level security;
alter table public.ticket_attachments enable row level security;

grant select on public.orgs to authenticated;
grant select, insert, update on public.projects to authenticated;
grant select, insert, delete on public.project_members to authenticated;
grant select, insert on public.ticket_reporters to authenticated;
grant select, insert, delete on public.ticket_attachments to authenticated;
grant usage on type public.ticket_priority to authenticated;
grant usage on type public.rejection_reason to authenticated;

drop policy if exists "orgs_select_own" on public.orgs;
create policy "orgs_select_own"
on public.orgs for select
to authenticated
using (id = public.current_org_id());

drop policy if exists "projects_select_own_org" on public.projects;
create policy "projects_select_own_org"
on public.projects for select
to authenticated
using (org_id = public.current_org_id());

drop policy if exists "projects_insert_pm" on public.projects;
create policy "projects_insert_pm"
on public.projects for insert
to authenticated
with check (org_id = public.current_org_id() and public.current_user_role() in ('pm', 'admin'));

drop policy if exists "projects_update_pm" on public.projects;
create policy "projects_update_pm"
on public.projects for update
to authenticated
using (org_id = public.current_org_id() and public.current_user_role() in ('pm', 'admin'))
with check (org_id = public.current_org_id() and public.current_user_role() in ('pm', 'admin'));

drop policy if exists "project_members_select_own_org" on public.project_members;
create policy "project_members_select_own_org"
on public.project_members for select
to authenticated
using (
  exists (
    select 1 from public.projects
    where projects.id = project_members.project_id
    and projects.org_id = public.current_org_id()
  )
);

drop policy if exists "project_members_write_pm" on public.project_members;
create policy "project_members_write_pm"
on public.project_members for all
to authenticated
using (public.current_user_role() in ('pm', 'admin'))
with check (public.current_user_role() in ('pm', 'admin'));

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
on public.profiles for select
to authenticated
using (org_id = public.current_org_id());

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id or public.current_user_role() in ('pm', 'admin'))
with check (org_id = public.current_org_id() and ((select auth.uid()) = id or public.current_user_role() in ('pm', 'admin')));

drop policy if exists "tickets_select_visible" on public.tickets;
create policy "tickets_select_visible"
on public.tickets for select
to authenticated
using (public.can_read_ticket(tickets));

drop policy if exists "tickets_insert_own" on public.tickets;
create policy "tickets_insert_own"
on public.tickets for insert
to authenticated
with check (
  reporter_id = (select auth.uid())
  and org_id = public.current_org_id()
  and exists (
    select 1 from public.projects
    where projects.id = project_id
    and projects.org_id = org_id
  )
  and (type <> 'task'::public.ticket_type or public.current_user_role() in ('pm', 'admin', 'engineer'))
);

drop policy if exists "tickets_update_pm_or_assignee" on public.tickets;
create policy "tickets_update_pm_or_assignee"
on public.tickets for update
to authenticated
using (
  public.can_read_ticket(tickets)
  and (
    public.current_user_role() in ('pm', 'admin')
    or assignee_id = (select auth.uid())
    or (
      reporter_id = (select auth.uid())
      and status = 'released'::public.ticket_status
    )
  )
)
with check (
  org_id = public.current_org_id()
  and public.can_read_ticket(tickets)
  and (
    public.current_user_role() in ('pm', 'admin')
    or assignee_id = (select auth.uid())
    or (
      reporter_id = (select auth.uid())
      and status in ('verified'::public.ticket_status, 'triage'::public.ticket_status)
    )
  )
);

drop policy if exists "comments_select_visible" on public.ticket_comments;
create policy "comments_select_visible"
on public.ticket_comments for select
to authenticated
using (
  org_id = public.current_org_id()
  and exists (
    select 1 from public.tickets
    where tickets.id = ticket_comments.ticket_id
    and public.can_read_ticket(tickets)
  )
  and (not is_internal or public.current_user_role() in ('engineer', 'pm', 'admin'))
);

drop policy if exists "comments_insert_visible" on public.ticket_comments;
create policy "comments_insert_visible"
on public.ticket_comments for insert
to authenticated
with check (
  org_id = public.current_org_id()
  and author_id = (select auth.uid())
  and exists (
    select 1 from public.tickets
    where tickets.id = ticket_comments.ticket_id
    and public.can_read_ticket(tickets)
  )
);

drop policy if exists "audit_select_visible" on public.ticket_audit_log;
create policy "audit_select_visible"
on public.ticket_audit_log for select
to authenticated
using (
  org_id = public.current_org_id()
  and exists (
    select 1 from public.tickets
    where tickets.id = ticket_audit_log.ticket_id
    and public.can_read_ticket(tickets)
  )
);

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
on public.notifications for select
to authenticated
using (org_id = public.current_org_id() and user_id = (select auth.uid()));

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
on public.notifications for update
to authenticated
using (org_id = public.current_org_id() and user_id = (select auth.uid()))
with check (org_id = public.current_org_id() and user_id = (select auth.uid()));

drop policy if exists "ticket_reporters_select_visible" on public.ticket_reporters;
create policy "ticket_reporters_select_visible"
on public.ticket_reporters for select
to authenticated
using (
  exists (
    select 1 from public.tickets
    where tickets.id = ticket_reporters.ticket_id
    and public.can_read_ticket(tickets)
  )
);

drop policy if exists "ticket_reporters_insert_self" on public.ticket_reporters;
create policy "ticket_reporters_insert_self"
on public.ticket_reporters for insert
to authenticated
with check (
  (
    user_id = (select auth.uid())
    or public.current_user_role() in ('pm', 'admin')
  )
  and exists (
    select 1 from public.tickets
    where tickets.id = ticket_reporters.ticket_id
    and public.can_read_ticket(tickets)
  )
);

drop policy if exists "ticket_attachments_select_visible" on public.ticket_attachments;
create policy "ticket_attachments_select_visible"
on public.ticket_attachments for select
to authenticated
using (
  org_id = public.current_org_id()
  and exists (
    select 1 from public.tickets
    where tickets.id = ticket_attachments.ticket_id
    and public.can_read_ticket(tickets)
  )
);

drop policy if exists "ticket_attachments_insert_visible" on public.ticket_attachments;
create policy "ticket_attachments_insert_visible"
on public.ticket_attachments for insert
to authenticated
with check (
  org_id = public.current_org_id()
  and created_by = (select auth.uid())
  and exists (
    select 1 from public.tickets
    where tickets.id = ticket_attachments.ticket_id
    and public.can_read_ticket(tickets)
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ticket-attachments',
  'ticket-attachments',
  false,
  26214400,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/webm', 'video/mp4', 'video/quicktime']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "ticket_attachments_storage_select" on storage.objects;
create policy "ticket_attachments_storage_select"
on storage.objects for select
to authenticated
using (
  bucket_id = 'ticket-attachments'
  and exists (
    select 1
    from public.ticket_attachments
    join public.tickets on tickets.id = ticket_attachments.ticket_id
    where ticket_attachments.storage_path = storage.objects.name
    and public.can_read_ticket(tickets)
  )
);

drop policy if exists "ticket_attachments_storage_insert" on storage.objects;
create policy "ticket_attachments_storage_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'ticket-attachments'
  and (storage.foldername(name))[1] = public.current_org_id()::text
);
