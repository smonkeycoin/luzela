revoke all on table public.order_attribution from anon;
revoke all on table public.order_attribution from public;

grant select, insert, update, delete on public.order_attribution to authenticated, service_role;
