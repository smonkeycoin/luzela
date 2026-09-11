-- Project default privileges explicitly grant EXECUTE to authenticated.
-- Trigger helpers are internal; only the four intentionally authorized RPCs remain callable.
revoke all on function public.collab_audit_change(),public.validate_collab_order() from authenticated,service_role;
