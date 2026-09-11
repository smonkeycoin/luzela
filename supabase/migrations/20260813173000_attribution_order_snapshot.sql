create table if not exists public.order_attribution (
  order_id uuid primary key references public.orders(id) on delete cascade,
  first_touch_source text not null default 'direct',
  first_touch_medium text not null default 'none',
  first_touch_campaign text not null default '',
  first_touch_content text not null default '',
  first_touch_term text not null default '',
  first_touch_referrer text not null default '',
  first_touch_landing_path text not null default '/',
  first_touch_landing_url text not null default '',
  first_seen_at timestamptz not null default now(),
  last_touch_source text not null default 'direct',
  last_touch_medium text not null default 'none',
  last_touch_campaign text not null default '',
  last_touch_content text not null default '',
  last_touch_term text not null default '',
  last_touch_referrer text not null default '',
  last_touch_landing_path text not null default '/',
  last_touch_landing_url text not null default '',
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_attribution_first_touch_source_length check (char_length(first_touch_source) <= 160),
  constraint order_attribution_last_touch_source_length check (char_length(last_touch_source) <= 160),
  constraint order_attribution_first_touch_url_length check (char_length(first_touch_landing_url) <= 512),
  constraint order_attribution_last_touch_url_length check (char_length(last_touch_landing_url) <= 512)
);

create index if not exists order_attribution_last_touch_source_idx
on public.order_attribution(last_touch_source, last_touch_medium);

create index if not exists order_attribution_last_touch_campaign_idx
on public.order_attribution(last_touch_campaign)
where last_touch_campaign <> '';

create index if not exists order_attribution_first_touch_source_idx
on public.order_attribution(first_touch_source, first_touch_medium);

drop trigger if exists order_attribution_updated_at on public.order_attribution;
create trigger order_attribution_updated_at
before update on public.order_attribution
for each row execute function public.set_updated_at();

alter table public.order_attribution enable row level security;

grant select, insert, update, delete on public.order_attribution to authenticated, service_role;

do $$
declare
  admin_check text := 'exists (select 1 from public.admin_users au where au.user_id = (select auth.uid()) and au.active = true)';
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'order_attribution'
      and policyname = 'admins can select'
  ) then
    execute format('create policy "admins can select" on public.order_attribution for select to authenticated using (%s)', admin_check);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'order_attribution'
      and policyname = 'admins can insert'
  ) then
    execute format('create policy "admins can insert" on public.order_attribution for insert to authenticated with check (%s)', admin_check);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'order_attribution'
      and policyname = 'admins can update'
  ) then
    execute format('create policy "admins can update" on public.order_attribution for update to authenticated using (%s) with check (%s)', admin_check, admin_check);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'order_attribution'
      and policyname = 'admins can delete'
  ) then
    execute format('create policy "admins can delete" on public.order_attribution for delete to authenticated using (%s)', admin_check);
  end if;
end $$;
