import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Accetta un invito e crea l'utente.
 *
 * Usa il service role (admin.createUser) perché il nuovo utente non è
 * ancora autenticato e non può bypassare le RLS di account_members
 * per registrarsi in un account altrui.
 */
export const acceptInvitationFn = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        token: z.string().uuid(),
        password: z.string().min(6).max(200),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1) Recupera invito
    const { data: inv, error: invErr } = await supabaseAdmin
      .from("account_invitations")
      .select("id, owner_id, email, role, status")
      .eq("token", data.token)
      .maybeSingle();
    if (invErr) throw new Error(invErr.message);
    if (!inv) throw new Error("Invito non trovato");
    if (inv.status !== "invited") throw new Error("Invito non più valido");

    const email = String(inv.email).trim().toLowerCase();

    // 2) Crea utente (o riusa se esiste già con la stessa email)
    let userId: string | null = null;
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
    });
    if (createErr) {
      // Se un utente con questa email esiste già, NON permettiamo di resettargli
      // la password tramite invito: sarebbe un vettore di account takeover.
      const { data: list } = await supabaseAdmin.auth.admin.listUsers();
      const existing = list?.users?.find((u) => u.email?.toLowerCase() === email);
      if (existing) {
        throw new Error(
          "Questo indirizzo email è già registrato. Chiedi all'utente di effettuare il login con la propria password esistente, oppure contatta un amministratore.",
        );
      }
      throw new Error(createErr.message);
    }
    userId = created.user?.id ?? null;
    if (!userId) throw new Error("Impossibile creare l'utente");

    // 3) Rimuove eventuale membership self-admin creata dal trigger,
    //    poi inserisce membership come membro dell'account invitante.
    await supabaseAdmin.from("account_members").delete().eq("user_id", userId);
    const { error: memErr } = await supabaseAdmin.from("account_members").insert({
      user_id: userId,
      owner_id: inv.owner_id,
      role: inv.role,
    });
    if (memErr) throw new Error(memErr.message);

    // 4) Rimuove eventuale user_state creato dal precedente self-admin,
    //    così l'utente al login vede subito i dati dell'account invitante.
    await supabaseAdmin.from("user_state").delete().eq("user_id", userId);

    // 5) Marca invito accettato
    await supabaseAdmin
      .from("account_invitations")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
        accepted_user_id: userId,
      })
      .eq("id", inv.id);

    return { ok: true, email };
  });
