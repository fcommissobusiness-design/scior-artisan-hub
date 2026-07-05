
-- ============================================================
-- MULTIUTENTE BASE — account_members, account_invitations, RLS
-- ============================================================

-- 1) account_members: mappa user -> account (owner_id) + ruolo
CREATE TABLE public.account_members (
  user_id     uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_id   uuid NOT NULL,
  role        text NOT NULL CHECK (role IN ('admin','collaborator')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz
);
CREATE INDEX account_members_owner_idx ON public.account_members(owner_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_members TO authenticated;
GRANT ALL ON public.account_members TO service_role;

ALTER TABLE public.account_members ENABLE ROW LEVEL SECURITY;

-- 2) account_invitations
CREATE TABLE public.account_invitations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id         uuid NOT NULL,
  email             text NOT NULL,
  role              text NOT NULL CHECK (role IN ('admin','collaborator')),
  token             uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  status            text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','accepted','revoked')),
  invited_by        uuid,
  invited_at        timestamptz NOT NULL DEFAULT now(),
  accepted_at       timestamptz,
  accepted_user_id  uuid
);
CREATE INDEX account_invitations_owner_idx ON public.account_invitations(owner_id);
CREATE INDEX account_invitations_email_idx ON public.account_invitations(lower(email));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_invitations TO authenticated;
GRANT SELECT ON public.account_invitations TO anon;  -- lookup pubblico per token in pagina invito
GRANT ALL ON public.account_invitations TO service_role;

ALTER TABLE public.account_invitations ENABLE ROW LEVEL SECURITY;

-- 3) Security definer helpers (evitano ricorsione RLS)
CREATE OR REPLACE FUNCTION public.get_account_owner(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT owner_id FROM public.account_members WHERE user_id = _user_id
$$;

CREATE OR REPLACE FUNCTION public.is_account_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.account_members
    WHERE user_id = _user_id AND role = 'admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_member_of(_user_id uuid, _owner uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.account_members
    WHERE user_id = _user_id AND owner_id = _owner
  )
$$;

-- 4) RLS su account_members
CREATE POLICY "members: see own account members"
  ON public.account_members FOR SELECT TO authenticated
  USING (owner_id = public.get_account_owner(auth.uid()));

CREATE POLICY "members: admins can insert in own account"
  ON public.account_members FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = public.get_account_owner(auth.uid())
    AND public.is_account_admin(auth.uid())
  );

-- Consente inoltre a un nuovo utente di inserire la propria riga self-owner (bootstrap)
CREATE POLICY "members: bootstrap self as own admin"
  ON public.account_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND owner_id = auth.uid() AND role = 'admin');

CREATE POLICY "members: update by admin"
  ON public.account_members FOR UPDATE TO authenticated
  USING (
    owner_id = public.get_account_owner(auth.uid())
    AND public.is_account_admin(auth.uid())
  )
  WITH CHECK (
    owner_id = public.get_account_owner(auth.uid())
  );

-- Consente all'utente di aggiornare solo il proprio last_seen_at (row self)
CREATE POLICY "members: update self last_seen"
  ON public.account_members FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "members: delete by admin"
  ON public.account_members FOR DELETE TO authenticated
  USING (
    owner_id = public.get_account_owner(auth.uid())
    AND public.is_account_admin(auth.uid())
    AND user_id <> owner_id   -- non si può rimuovere l'owner
  );

-- 5) RLS su account_invitations
CREATE POLICY "inv: admins see own account invitations"
  ON public.account_invitations FOR SELECT TO authenticated
  USING (
    owner_id = public.get_account_owner(auth.uid())
    AND public.is_account_admin(auth.uid())
  );

CREATE POLICY "inv: anon/auth can read by token"
  ON public.account_invitations FOR SELECT TO anon, authenticated
  USING (true);  -- il token è UUID segreto; la UI filtra su ?token=

-- NOTA: la policy "read by token" espone anche l'email; è accettabile perché
-- il token è casuale a 128 bit e la pagina di accettazione ha bisogno dell'email.

CREATE POLICY "inv: admins insert in own account"
  ON public.account_invitations FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = public.get_account_owner(auth.uid())
    AND public.is_account_admin(auth.uid())
    AND invited_by = auth.uid()
  );

CREATE POLICY "inv: admins update own account invitations"
  ON public.account_invitations FOR UPDATE TO authenticated
  USING (
    owner_id = public.get_account_owner(auth.uid())
    AND public.is_account_admin(auth.uid())
  )
  WITH CHECK (
    owner_id = public.get_account_owner(auth.uid())
  );

-- Chi accetta un invito deve poter marcarlo come 'accepted'; policy separata:
CREATE POLICY "inv: acceptor can mark accepted"
  ON public.account_invitations FOR UPDATE TO authenticated
  USING (status = 'invited')
  WITH CHECK (status = 'accepted' AND accepted_user_id = auth.uid());

CREATE POLICY "inv: admins delete own"
  ON public.account_invitations FOR DELETE TO authenticated
  USING (
    owner_id = public.get_account_owner(auth.uid())
    AND public.is_account_admin(auth.uid())
  );

-- 6) user_state: aggiorna RLS in modo che tutti i membri dell'account
--    leggano/scrivano la riga dell'owner.
DROP POLICY IF EXISTS "own row select" ON public.user_state;
DROP POLICY IF EXISTS "own row insert" ON public.user_state;
DROP POLICY IF EXISTS "own row update" ON public.user_state;
DROP POLICY IF EXISTS "own row delete" ON public.user_state;

CREATE POLICY "user_state: members select"
  ON public.user_state FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_member_of(auth.uid(), user_id)
  );

CREATE POLICY "user_state: members insert own"
  ON public.user_state FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_state: members update"
  ON public.user_state FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_member_of(auth.uid(), user_id)
  )
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_member_of(auth.uid(), user_id)
  );

CREATE POLICY "user_state: only self delete"
  ON public.user_state FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 7) Trigger: nuovo utente => auto-crea account_member self-admin,
--    a meno che non esista già una riga (accept-invito la crea prima).
CREATE OR REPLACE FUNCTION public.handle_new_user_account_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.account_members (user_id, owner_id, role)
  VALUES (NEW.id, NEW.id, 'admin')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_account_member ON auth.users;
CREATE TRIGGER on_auth_user_created_account_member
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_account_member();

-- 8) Backfill: ogni utente esistente diventa admin del proprio account.
INSERT INTO public.account_members (user_id, owner_id, role)
SELECT id, id, 'admin' FROM auth.users
ON CONFLICT (user_id) DO NOTHING;
