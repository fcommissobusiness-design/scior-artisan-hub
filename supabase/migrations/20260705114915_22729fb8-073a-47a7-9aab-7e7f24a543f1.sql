
-- 1. Create a private schema for internal SECURITY DEFINER helpers
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, anon, service_role;

-- 2. Recreate helpers in private schema
CREATE OR REPLACE FUNCTION private.get_account_owner(_user_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT owner_id FROM public.account_members
  WHERE user_id = _user_id
  ORDER BY created_at ASC
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION private.is_account_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.account_members
    WHERE user_id = _user_id AND role = 'admin'
  )
$$;

CREATE OR REPLACE FUNCTION private.is_member_of(_user_id uuid, _owner uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.account_members
    WHERE user_id = _user_id AND owner_id = _owner
  )
$$;

GRANT EXECUTE ON FUNCTION private.get_account_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_account_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_member_of(uuid, uuid) TO authenticated;

-- 3. Drop and recreate policies to reference private.* helpers
-- account_invitations
DROP POLICY IF EXISTS "inv: anon/auth can read by token" ON public.account_invitations;
DROP POLICY IF EXISTS "inv: admins delete own" ON public.account_invitations;
DROP POLICY IF EXISTS "inv: admins insert in own account" ON public.account_invitations;
DROP POLICY IF EXISTS "inv: admins see own account invitations" ON public.account_invitations;
DROP POLICY IF EXISTS "inv: admins update own account invitations" ON public.account_invitations;

CREATE POLICY "inv: admins delete own" ON public.account_invitations
FOR DELETE TO authenticated
USING (owner_id = private.get_account_owner(auth.uid()) AND private.is_account_admin(auth.uid()));

CREATE POLICY "inv: admins insert in own account" ON public.account_invitations
FOR INSERT TO authenticated
WITH CHECK (owner_id = private.get_account_owner(auth.uid()) AND private.is_account_admin(auth.uid()) AND invited_by = auth.uid());

CREATE POLICY "inv: admins see own account invitations" ON public.account_invitations
FOR SELECT TO authenticated
USING (owner_id = private.get_account_owner(auth.uid()) AND private.is_account_admin(auth.uid()));

CREATE POLICY "inv: admins update own account invitations" ON public.account_invitations
FOR UPDATE TO authenticated
USING (owner_id = private.get_account_owner(auth.uid()) AND private.is_account_admin(auth.uid()))
WITH CHECK (owner_id = private.get_account_owner(auth.uid()));

-- account_members
DROP POLICY IF EXISTS "members: admins can insert in own account" ON public.account_members;
DROP POLICY IF EXISTS "members: delete by admin" ON public.account_members;
DROP POLICY IF EXISTS "members: see own account members" ON public.account_members;
DROP POLICY IF EXISTS "members: update by admin" ON public.account_members;
DROP POLICY IF EXISTS "members: update self last_seen" ON public.account_members;

CREATE POLICY "members: admins can insert in own account" ON public.account_members
FOR INSERT TO authenticated
WITH CHECK (owner_id = private.get_account_owner(auth.uid()) AND private.is_account_admin(auth.uid()));

CREATE POLICY "members: delete by admin" ON public.account_members
FOR DELETE TO authenticated
USING (owner_id = private.get_account_owner(auth.uid()) AND private.is_account_admin(auth.uid()) AND user_id <> owner_id);

CREATE POLICY "members: see own account members" ON public.account_members
FOR SELECT TO authenticated
USING (owner_id = private.get_account_owner(auth.uid()));

CREATE POLICY "members: update by admin" ON public.account_members
FOR UPDATE TO authenticated
USING (owner_id = private.get_account_owner(auth.uid()) AND private.is_account_admin(auth.uid()))
WITH CHECK (owner_id = private.get_account_owner(auth.uid()));

-- Fix self-role escalation: user can only update last_seen_at on their own row;
-- role and owner_id must remain unchanged.
CREATE POLICY "members: update self last_seen" ON public.account_members
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND role = (SELECT m.role FROM public.account_members m WHERE m.user_id = auth.uid())
  AND owner_id = (SELECT m.owner_id FROM public.account_members m WHERE m.user_id = auth.uid())
);

-- user_state
DROP POLICY IF EXISTS "user_state: members select" ON public.user_state;
DROP POLICY IF EXISTS "user_state: members update" ON public.user_state;

CREATE POLICY "user_state: members select" ON public.user_state
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR private.is_member_of(auth.uid(), user_id));

CREATE POLICY "user_state: members update" ON public.user_state
FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR private.is_member_of(auth.uid(), user_id))
WITH CHECK (user_id = auth.uid() OR private.is_member_of(auth.uid(), user_id));

-- 4. Drop the old public helpers so they are no longer part of the Data API
DROP FUNCTION IF EXISTS public.get_account_owner(uuid);
DROP FUNCTION IF EXISTS public.is_account_admin(uuid);
DROP FUNCTION IF EXISTS public.is_member_of(uuid, uuid);

-- 5. Safe RPC to look up an invitation by token (used by /invito/$token)
CREATE OR REPLACE FUNCTION public.get_invitation_by_token(_token uuid)
RETURNS TABLE(email text, role text, status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT email, role, status
  FROM public.account_invitations
  WHERE token = _token AND status = 'invited'
  LIMIT 1
$$;
REVOKE EXECUTE ON FUNCTION public.get_invitation_by_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(uuid) TO anon, authenticated;
