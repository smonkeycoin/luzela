-- Sprint: DHL fulfillment + automatic shipping email.
-- Scope is limited to fulfillment/shipping/email operational data.

alter table public.orders
  add column if not exists shipped_at timestamptz;

alter table public.email_events
  add column if not exists idempotency_key text;

create unique index if not exists shipments_order_id_unique_idx
on public.shipments(order_id);

create unique index if not exists email_events_idempotency_key_unique_idx
on public.email_events(idempotency_key)
where idempotency_key is not null;

create index if not exists shipments_tracking_number_idx
on public.shipments(tracking_number)
where tracking_number is not null;

create or replace function public.mark_order_shipped(
  p_order_id uuid,
  p_tracking_number text,
  p_tracking_url text,
  p_actor_user_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  locked_order public.orders%rowtype;
  existing_shipment_id uuid;
  created_shipment_id uuid;
  now_value timestamptz := now();
begin
  if nullif(trim(p_tracking_number), '') is null then
    raise exception 'tracking_number_required';
  end if;

  select *
  into locked_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'order_not_found:%', p_order_id;
  end if;

  if locked_order.payment_status <> 'paid' then
    raise exception 'order_not_paid:%', p_order_id;
  end if;

  if locked_order.status in ('cancelled', 'refunded')
    or locked_order.payment_status in ('refunded')
    or locked_order.fulfillment_status in ('cancelled', 'shipped', 'delivered') then
    raise exception 'shipment_transition_not_allowed:%', p_order_id;
  end if;

  select id
  into existing_shipment_id
  from public.shipments
  where order_id = p_order_id
  limit 1;

  if existing_shipment_id is not null then
    raise exception 'shipment_already_exists:%', existing_shipment_id;
  end if;

  insert into public.shipments (
    order_id,
    status,
    carrier,
    tracking_number,
    tracking_url,
    shipped_at
  )
  values (
    p_order_id,
    'shipped',
    'DHL',
    trim(p_tracking_number),
    p_tracking_url,
    now_value
  )
  returning id into created_shipment_id;

  update public.orders
  set status = 'shipped',
      fulfillment_status = 'shipped',
      shipped_at = now_value
  where id = p_order_id;

  insert into public.audit_log (
    actor_user_id,
    action,
    table_name,
    row_id,
    after_data
  )
  values
    (
      p_actor_user_id,
      'shipment_created',
      'shipments',
      created_shipment_id,
      jsonb_build_object(
        'order_id', p_order_id,
        'carrier', 'DHL',
        'tracking_number', trim(p_tracking_number),
        'tracking_url', p_tracking_url
      )
    ),
    (
      p_actor_user_id,
      'order_marked_shipped',
      'orders',
      p_order_id,
      jsonb_build_object(
        'shipment_id', created_shipment_id,
        'fulfillment_status', 'shipped',
        'shipped_at', now_value
      )
    );

  return created_shipment_id;
end;
$$;

revoke all on function public.mark_order_shipped(uuid, text, text, uuid) from public;
revoke all on function public.mark_order_shipped(uuid, text, text, uuid) from anon;
revoke all on function public.mark_order_shipped(uuid, text, text, uuid) from authenticated;
grant execute on function public.mark_order_shipped(uuid, text, text, uuid) to service_role;
