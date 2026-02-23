-- overlap-time MVP RLS policies
-- Assumption:
-- - Client requests include `x-event-id` header for event-scoped reads.
-- - Participant write requests include `x-edit-token` header when direct DB writes are used.
-- - Server routes using service role key bypass RLS and remain available.

create extension if not exists pgcrypto;

create or replace function public.request_header(header_name text)
returns text
language plpgsql
stable
as $$
declare
  headers jsonb;
begin
  headers := coalesce(current_setting('request.headers', true)::jsonb, '{}'::jsonb);
  return headers ->> lower(header_name);
exception
  when others then
    return null;
end;
$$;

alter table public.events enable row level security;
alter table public.participants enable row level security;
alter table public.availabilities enable row level security;

drop policy if exists events_select_by_event_header on public.events;
create policy events_select_by_event_header
on public.events
for select
to anon, authenticated
using (id = public.request_header('x-event-id'));

drop policy if exists participants_select_by_event_header on public.participants;
create policy participants_select_by_event_header
on public.participants
for select
to anon, authenticated
using (event_id = public.request_header('x-event-id'));

drop policy if exists participants_insert_by_event_header on public.participants;
create policy participants_insert_by_event_header
on public.participants
for insert
to anon, authenticated
with check (
  event_id = public.request_header('x-event-id')
  and exists (
    select 1
    from public.events e
    where e.id = participants.event_id
  )
);

drop policy if exists availabilities_select_by_event_header on public.availabilities;
create policy availabilities_select_by_event_header
on public.availabilities
for select
to anon, authenticated
using (event_id = public.request_header('x-event-id'));

drop policy if exists availabilities_insert_with_edit_token on public.availabilities;
create policy availabilities_insert_with_edit_token
on public.availabilities
for insert
to anon, authenticated
with check (
  event_id = public.request_header('x-event-id')
  and exists (
    select 1
    from public.participants p
    where p.id = availabilities.participant_id
      and p.event_id = availabilities.event_id
      and p.edit_token_hash = encode(digest(coalesce(public.request_header('x-edit-token'), ''), 'sha256'), 'hex')
  )
);

drop policy if exists availabilities_update_with_edit_token on public.availabilities;
create policy availabilities_update_with_edit_token
on public.availabilities
for update
to anon, authenticated
using (
  event_id = public.request_header('x-event-id')
  and exists (
    select 1
    from public.participants p
    where p.id = availabilities.participant_id
      and p.event_id = availabilities.event_id
      and p.edit_token_hash = encode(digest(coalesce(public.request_header('x-edit-token'), ''), 'sha256'), 'hex')
  )
)
with check (
  event_id = public.request_header('x-event-id')
  and exists (
    select 1
    from public.participants p
    where p.id = availabilities.participant_id
      and p.event_id = availabilities.event_id
      and p.edit_token_hash = encode(digest(coalesce(public.request_header('x-edit-token'), ''), 'sha256'), 'hex')
  )
);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'availabilities'
  ) then
    alter publication supabase_realtime add table public.availabilities;
  end if;
end;
$$;
