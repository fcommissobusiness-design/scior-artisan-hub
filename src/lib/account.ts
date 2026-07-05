import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AccountRole = "admin" | "collaborator";

export interface AccountMembership {
  userId: string;
  ownerId: string;
  role: AccountRole;
}

export interface UseAccountResult {
  membership: AccountMembership | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Carica la membership dell'utente corrente.
 * Se manca (utente storico pre-migrazione: improbabile perché il backfill ne ha
 * creato una, ma teniamo il fallback), la crea al volo come self-admin.
 */
export function useAccountMembership(userId: string | null): UseAccountResult {
  const [membership, setMembership] = useState<AccountMembership | null>(null);
  const [loading, setLoading] = useState<boolean>(!!userId);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!userId) {
      setMembership(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const { data, error: fetchErr } = await supabase
          .from("account_members")
          .select("user_id, owner_id, role")
          .eq("user_id", userId)
          .maybeSingle();
        if (fetchErr) throw fetchErr;

        let row = data;
        if (!row) {
          // Bootstrap: se manca, l'utente diventa admin del proprio account.
          const { data: ins, error: insErr } = await supabase
            .from("account_members")
            .insert({ user_id: userId, owner_id: userId, role: "admin" })
            .select("user_id, owner_id, role")
            .single();
          if (insErr) throw insErr;
          row = ins;
        }

        if (cancelled) return;
        setMembership({
          userId: row!.user_id as string,
          ownerId: row!.owner_id as string,
          role: row!.role as AccountRole,
        });

        // aggiorna last_seen_at (fire-and-forget)
        supabase
          .from("account_members")
          .update({ last_seen_at: new Date().toISOString() })
          .eq("user_id", userId)
          .then(() => {}, () => {});
      } catch (e: any) {
        console.error("[account] membership load failed", e);
        if (!cancelled) setError(e?.message ?? "Errore caricamento account");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, tick]);

  return { membership, loading, error, refresh };
}

/** Route accessibili al collaboratore (le altre mostrano il banner "no permessi"). */
export const COLLABORATOR_ALLOWED_ROUTES = new Set<string>([
  "/",
  "/ordini",
  "/consegne",
  "/clienti",
  "/offerte",
  "/magazzino",
  "/prodotti",
  "/previsioni",
  "/entrate-merci",
  "/fornitori",
]);

/** Ritorna true se il collaboratore può accedere al path indicato. */
export function collaboratorCanAccess(path: string): boolean {
  if (COLLABORATOR_ALLOWED_ROUTES.has(path)) return true;
  // ammetti anche sotto-path delle route consentite (es. /prodotti/123).
  for (const r of COLLABORATOR_ALLOWED_ROUTES) {
    if (r !== "/" && path.startsWith(r + "/")) return true;
  }
  return false;
}
