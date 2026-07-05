
REVOKE ALL ON FUNCTION public.get_account_owner(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_account_admin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_member_of(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.handle_new_user_account_member() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_account_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_account_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_member_of(uuid, uuid) TO authenticated;
