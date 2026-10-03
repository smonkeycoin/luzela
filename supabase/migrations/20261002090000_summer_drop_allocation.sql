create table if not exists public.summer_drop_campaigns (
  campaign_key text primary key check (campaign_key = 'summer_drop'),
  active boolean not null default true,
  allocation integer not null default 25 check (allocation > 0),
  paid_packs integer not null default 0 check (paid_packs >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.summer_drop_campaigns (campaign_key, active, allocation)
values ('summer_drop', true, 25)
on conflict (campaign_key) do nothing;

create table if not exists public.summer_drop_allocation_claims (
  order_id uuid primary key references public.orders(id) on delete cascade,
  packs integer not null check (packs > 0),
  status text not null check (status in ('reserved', 'paid', 'released')),
  expires_at timestamptz not null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists summer_drop_claims_live_idx
  on public.summer_drop_allocation_claims (status, expires_at)
  where status = 'reserved';

alter table public.summer_drop_campaigns enable row level security;
alter table public.summer_drop_allocation_claims enable row level security;
revoke all on public.summer_drop_campaigns, public.summer_drop_allocation_claims from anon, authenticated;
grant select, update on public.summer_drop_campaigns to service_role;
grant select, insert, update on public.summer_drop_allocation_claims to service_role;

create or replace function public.get_summer_drop_availability()
returns table (
  active boolean,
  allocation integer,
  paid_packs integer,
  reserved_packs integer,
  remaining_packs integer
)
language sql
security definer
set search_path = public
as $$
  select c.active, c.allocation, c.paid_packs,
    coalesce((
      select sum(cl.packs)::integer
      from public.summer_drop_allocation_claims cl
      where cl.status = 'reserved' and cl.expires_at > now()
    ), 0) as reserved_packs,
    greatest(c.allocation - c.paid_packs - coalesce((
      select sum(cl.packs)::integer
      from public.summer_drop_allocation_claims cl
      where cl.status = 'reserved' and cl.expires_at > now()
    ), 0), 0) as remaining_packs
  from public.summer_drop_campaigns c
  where c.campaign_key = 'summer_drop';
$$;

create or replace function public.claim_summer_drop_allocation(p_order_id uuid, p_packs integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  campaign public.summer_drop_campaigns%rowtype;
  held integer;
  existing public.summer_drop_allocation_claims%rowtype;
begin
  if p_packs is null or p_packs < 1 then return false; end if;

  select * into campaign
  from public.summer_drop_campaigns
  where campaign_key = 'summer_drop'
  for update;
  if not found or not campaign.active then return false; end if;

  select * into existing from public.summer_drop_allocation_claims where order_id = p_order_id;
  if found then
    return existing.status = 'paid' or
      (existing.status = 'reserved' and existing.packs = p_packs and existing.expires_at > now());
  end if;

  select coalesce(sum(packs), 0)::integer into held
  from public.summer_drop_allocation_claims
  where status = 'reserved' and expires_at > now();
  if campaign.paid_packs + held + p_packs > campaign.allocation then return false; end if;

  insert into public.summer_drop_allocation_claims (order_id, packs, status, expires_at)
  values (p_order_id, p_packs, 'reserved', now() + interval '24 hours');
  return true;
end;
$$;

create or replace function public.apply_summer_drop_allocation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  claim public.summer_drop_allocation_claims%rowtype;
begin
  if new.payment_status = 'paid' and old.payment_status is distinct from 'paid'
     and new.metadata->>'campaign' = 'summer_drop' then
    select * into claim
    from public.summer_drop_allocation_claims
    where order_id = new.id
    for update;
    if not found or claim.status <> 'reserved' or claim.expires_at <= now() then
      raise exception 'summer_drop_allocation_unavailable';
    end if;
    update public.summer_drop_allocation_claims
      set status = 'paid', paid_at = now(), updated_at = now()
      where order_id = new.id;
    update public.summer_drop_campaigns
      set paid_packs = paid_packs + claim.packs, updated_at = now()
      where campaign_key = 'summer_drop';
  elsif (new.payment_status = 'failed' or new.status in ('cancelled', 'refunded'))
        and (old.payment_status is distinct from new.payment_status or old.status is distinct from new.status) then
    update public.summer_drop_allocation_claims
      set status = 'released', updated_at = now()
      where order_id = new.id and status = 'reserved';
  end if;
  return new;
end;
$$;

drop trigger if exists summer_drop_order_allocation on public.orders;
create trigger summer_drop_order_allocation
  before update of payment_status, status on public.orders
  for each row execute function public.apply_summer_drop_allocation();

revoke all on function public.get_summer_drop_availability() from public, anon, authenticated;
revoke all on function public.claim_summer_drop_allocation(uuid, integer) from public, anon, authenticated;
revoke all on function public.apply_summer_drop_allocation() from public, anon, authenticated, service_role;
grant execute on function public.get_summer_drop_availability() to service_role;
grant execute on function public.claim_summer_drop_allocation(uuid, integer) to service_role;

-- Keep the canonical 3X price at 81900. The application applies the campaign
-- price only while the server-side allocation row remains active.
