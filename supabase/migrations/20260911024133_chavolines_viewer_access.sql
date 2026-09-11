begin;

alter table public.collaborator_members
  add column if not exists last_login_at timestamptz;

-- Exact normalized Google address authorized by the campaign owner.
insert into public.collaborator_members (
  collaborator_id,
  email,
  display_name,
  role,
  status
)
select
  c.id,
  'elmundoenpareja2021@gmail.com',
  'El Mundo en Pareja',
  'viewer',
  'active'
from public.collaborators c
where c.slug = 'chavolines'
on conflict (collaborator_id, email) do update
set display_name = excluded.display_name,
    role = 'viewer',
    status = 'active',
    updated_at = now();

do $$
begin
  if (
    select count(*)
    from public.collaborator_members m
    join public.collaborators c on c.id = m.collaborator_id
    where c.slug = 'chavolines'
      and m.email = 'elmundoenpareja2021@gmail.com'
      and m.role = 'viewer'
      and m.status = 'active'
  ) <> 1 then
    raise exception 'Expected one active Chavolines viewer';
  end if;

  if exists (
    select 1
    from public.admin_users a
    join auth.users u on u.id = a.user_id
    where lower(u.email) = 'elmundoenpareja2021@gmail.com'
      and a.active
  ) then
    raise exception 'Chavolines viewer must not have Shop Admin access';
  end if;
end $$;

create or replace function public.accept_collab_membership() returns integer
language plpgsql security definer set search_path='' as $$
declare n integer;
begin
  update public.collaborator_members m
  set user_id = auth.uid(),
      accepted_at = coalesce(accepted_at, now()),
      last_login_at = now(),
      updated_at = now()
  where public.collab_has_access(m.collaborator_id)
    and (m.user_id is null or m.user_id = auth.uid())
    and m.email = (select lower(email) from auth.users where id = auth.uid())
    and m.status = 'active';
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.accept_collab_membership() from public, anon;
grant execute on function public.accept_collab_membership() to authenticated, service_role;

commit;
