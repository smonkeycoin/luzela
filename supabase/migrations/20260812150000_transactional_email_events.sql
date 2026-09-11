-- Sprint: Resend transactional email and admin recovery.
-- Additive-only changes for observable, idempotent transactional emails.

alter type public.message_status add value if not exists 'pending';

alter table public.email_events
  add column if not exists event_type text,
  add column if not exists recipient citext,
  add column if not exists provider text,
  add column if not exists attempt_count integer not null default 0 check (attempt_count >= 0),
  add column if not exists last_attempt_at timestamptz,
  add column if not exists error_code text,
  add column if not exists updated_at timestamptz not null default now();

update public.email_events
set event_type = template_key
where event_type is null;

update public.email_events
set status = 'pending'
where status = 'queued';

alter table public.email_events
  alter column event_type set not null,
  alter column status set default 'pending';

create index if not exists email_events_order_created_idx
on public.email_events(order_id, created_at desc);

create index if not exists email_events_last_attempt_idx
on public.email_events(last_attempt_at desc)
where last_attempt_at is not null;

drop trigger if exists email_events_updated_at on public.email_events;
create trigger email_events_updated_at
before update on public.email_events
for each row execute function public.set_updated_at();
