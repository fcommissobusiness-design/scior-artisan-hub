import { useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TopBar, Sheet, Field } from "@/components/AppShell";
import { sendInvitationEmail, EMAIL_PROVIDER_ENABLED } from "@/lib/email/invitations";
import type { AccountRole } from "@/lib/account";

interface Member {
  user_id: string;
  owner_id: string;
  role: AccountRole;
  created_at: string;
  last_seen_at: string | null;
  email?: string | null;
}

interface Invitation {
  id: string;
  owner_id: string;
  email: string;
  role: AccountRole;
  token: string;
  status: "invited" | "accepted" | "revoked";
  invited_at: string;
  accepted_at: string | null;
  accepted_user_id: string | null;
}

function roleLabel(r: AccountRole) {
  return r === "admin" ? "Amministratore" : "Collaboratore";
}

function statusLabel(s: Invitation["status"]) {
  return s === "invited" ? "Invitato" : s === "accepted" ? "Registrato" : "Revocato";
}

export function TeamManagement({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate();
  const [me, setMe] = useState<string | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [myRole, setMyRole] = useState<AccountRole | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [openInvite, setOpenInvite] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const flash = (t: string) => { setMsg(t); setTimeout(() => setMsg(null), 2200); };
  const refresh = () => setTick((t) => t + 1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const { data: sess } = await supabase.auth.getSession();
        const uid = sess.session?.user?.id ?? null;
        if (cancelled) return;
        setMe(uid);
        if (!uid) {
          setLoadError("Sessione non trovata. Effettua di nuovo l'accesso.");
          return;
        }

        const { data: memSelf, error: memErr } = await supabase
          .from("account_members")
          .select("owner_id, role")
          .eq("user_id", uid)
          .maybeSingle();
        if (memErr) throw memErr;

        const owner = (memSelf?.owner_id as string) ?? uid;
        const role = (memSelf?.role as AccountRole) ?? "admin";
        if (cancelled) return;
        setOwnerId(owner);
        setMyRole(role);

        if (role !== "admin") {
          if (!embedded) navigate({ to: "/" });
          return;
        }

        const [{ data: mems, error: memsErr }, { data: invs, error: invsErr }] = await Promise.all([
          supabase
            .from("account_members")
            .select("user_id, owner_id, role, created_at, last_seen_at")
            .eq("owner_id", owner),
          supabase
            .from("account_invitations")
            .select("*")
            .eq("owner_id", owner)
            .order("invited_at", { ascending: false }),
        ]);
        if (memsErr) throw memsErr;
        if (invsErr) throw invsErr;
        if (cancelled) return;
        setMembers((mems ?? []) as Member[]);
        setInvites((invs ?? []) as Invitation[]);
      } catch (e: any) {
        if (!cancelled) setLoadError(e?.message ?? "Errore caricamento gestione team");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tick, navigate, embedded]);

  const adminCount = useMemo(() => members.filter((m) => m.role === "admin").length, [members]);
  const acceptUrl = (token: string) => `${window.location.origin}/invito/${token}`;

  const copyLink = async (token: string) => {
    try {
      await navigator.clipboard.writeText(acceptUrl(token));
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 1500);
    } catch {
      flash("Impossibile copiare il link");
    }
  };

  const createInvite = async (email: string, role: AccountRole) => {
    if (!ownerId || !me) return;
    const clean = email.trim().toLowerCase();
    if (!clean || !clean.includes("@")) { flash("Email non valida"); return; }
    const already = invites.find((i) => i.email.toLowerCase() === clean && i.status === "invited");
    if (already) { flash("Esiste già un invito attivo per questa email"); return; }

    const { data, error } = await supabase
      .from("account_invitations")
      .insert({ owner_id: ownerId, email: clean, role, invited_by: me })
      .select("*")
      .single();
    if (error) { flash(error.message); return; }

    await sendInvitationEmail({
      to: clean,
      acceptUrl: acceptUrl((data as Invitation).token),
      role,
    });
    setOpenInvite(false);
    flash(EMAIL_PROVIDER_ENABLED ? "Invito inviato" : "Invito creato (invio email non attivo, copia il link)");
    refresh();
  };

  const resendInvite = async (inv: Invitation) => {
    const { data, error } = await supabase
      .from("account_invitations")
      .update({ token: crypto.randomUUID(), status: "invited", invited_at: new Date().toISOString() })
      .eq("id", inv.id)
      .select("*")
      .single();
    if (error) { flash(error.message); return; }
    await sendInvitationEmail({ to: inv.email, acceptUrl: acceptUrl((data as Invitation).token), role: inv.role });
    flash(EMAIL_PROVIDER_ENABLED ? "Invito reinviato" : "Invito rigenerato (copia il link)");
    refresh();
  };

  const revokeInvite = async (inv: Invitation) => {
    if (!confirm(`Revocare l'invito per ${inv.email}?`)) return;
    const { error } = await supabase
      .from("account_invitations")
      .update({ status: "revoked" })
      .eq("id", inv.id);
    if (error) { flash(error.message); return; }
    flash("Invito revocato");
    refresh();
  };

  const changeRole = async (m: Member, next: AccountRole) => {
    if (m.user_id === m.owner_id) { flash("Non puoi modificare il ruolo dell'amministratore iniziale"); return; }
    if (m.role === "admin" && next === "collaborator" && adminCount <= 1) {
      flash("Deve esistere almeno un amministratore");
      return;
    }
    const { error } = await supabase.from("account_members").update({ role: next }).eq("user_id", m.user_id);
    if (error) { flash(error.message); return; }
    flash("Ruolo aggiornato");
    refresh();
  };

  const removeMember = async (m: Member) => {
    if (m.user_id === m.owner_id) { flash("L'amministratore iniziale non può essere rimosso"); return; }
    if (m.role === "admin" && adminCount <= 1) { flash("Deve esistere almeno un amministratore"); return; }
    if (!confirm("Rimuovere l'accesso a questo utente? L'utente non potrà più accedere all'account.")) return;
    const { error } = await supabase.from("account_members").delete().eq("user_id", m.user_id);
    if (error) { flash(error.message); return; }
    flash("Utente rimosso");
    refresh();
  };

  const header = embedded ? (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="font-display text-xl text-brand-green">Invita Persone</h2>
        <p className="text-xs text-muted-foreground mt-1">Gestione team dell'attività.</p>
      </div>
      <button
        onClick={() => setOpenInvite(true)}
        className="bg-brand-gold text-brand-green text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90"
      >
        Invita persona
      </button>
    </div>
  ) : (
    <TopBar
      title="Invita Persone"
      subtitle="Gestione team dell'attività"
      right={
        <div className="flex items-center gap-2">
          <Link to="/admin" className="hidden sm:inline-flex bg-card border border-border text-sm px-3 py-2 rounded-lg">
            Amministrazione
          </Link>
          <button
            onClick={() => setOpenInvite(true)}
            className="bg-brand-gold text-brand-green text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90"
          >
            Invita persona
          </button>
        </div>
      }
    />
  );

  if (loading) {
    return (
      <div>
        {embedded ? header : <TopBar title="Invita Persone" subtitle="Gestione team" />}
        <div className={embedded ? "py-4 text-sm opacity-70" : "p-6 text-sm opacity-70"}>Caricamento…</div>
      </div>
    );
  }

  if (myRole !== "admin") return null;

  return (
    <div className={embedded ? "space-y-4" : ""}>
      {header}

      {msg && (
        <div className={embedded ? "px-3 py-2 rounded bg-brand-green text-brand-cream text-sm" : "mx-4 md:mx-8 mt-4 px-3 py-2 rounded bg-brand-green text-brand-cream text-sm"}>{msg}</div>
      )}

      {loadError && (
        <div className={embedded ? "px-3 py-2 rounded bg-danger/15 text-danger text-sm" : "mx-4 md:mx-8 mt-4 px-3 py-2 rounded bg-danger/15 text-danger text-sm"}>{loadError}</div>
      )}

      {!EMAIL_PROVIDER_ENABLED && (
        <div className={embedded ? "px-3 py-2 rounded bg-warning/15 text-warning text-xs" : "mx-4 md:mx-8 mt-4 px-3 py-2 rounded bg-warning/15 text-warning text-xs"}>
          Invio email non ancora attivo su questo progetto — copia manualmente il link di invito per ogni invitato.
        </div>
      )}

      <section className={embedded ? "" : "p-4 md:p-8"}>
        <h2 className="font-display text-xl text-brand-green mb-3">Membri dell'account</h2>
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left p-3">Utente</th>
                <th className="text-left p-3">Ruolo</th>
                <th className="text-left p-3">Iscritto il</th>
                <th className="text-left p-3">Ultimo accesso</th>
                <th className="text-right p-3">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const isOwner = m.user_id === m.owner_id;
                return (
                  <tr key={m.user_id} className="border-t border-border/70">
                    <td className="p-3 font-mono text-xs">
                      {m.user_id.slice(0, 8)}…
                      {isOwner && <span className="ml-2 text-[10px] uppercase text-brand-gold">Owner</span>}
                    </td>
                    <td className="p-3">{roleLabel(m.role)}</td>
                    <td className="p-3 text-xs opacity-70">{new Date(m.created_at).toLocaleDateString("it-IT")}</td>
                    <td className="p-3 text-xs opacity-70">
                      {m.last_seen_at ? new Date(m.last_seen_at).toLocaleString("it-IT") : "—"}
                    </td>
                    <td className="p-3 text-right">
                      {isOwner ? (
                        <span className="text-xs opacity-50">Protetto</span>
                      ) : (
                        <div className="flex gap-2 justify-end flex-wrap">
                          {m.role === "collaborator" ? (
                            <button onClick={() => changeRole(m, "admin")}
                              className="text-xs px-2 py-1 rounded bg-brand-green text-brand-cream">
                              Promuovi admin
                            </button>
                          ) : (
                            <button onClick={() => changeRole(m, "collaborator")}
                              className="text-xs px-2 py-1 rounded bg-muted text-foreground">
                              Declassa
                            </button>
                          )}
                          <button onClick={() => removeMember(m)}
                            className="text-xs px-2 py-1 rounded bg-danger/15 text-danger">
                            Rimuovi
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {members.length === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-muted-foreground text-xs">Nessun membro.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className={embedded ? "" : "px-4 md:px-8 pb-8"}>
        <h2 className="font-display text-xl text-brand-green mb-3">Inviti</h2>
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left p-3">Email</th>
                <th className="text-left p-3">Ruolo</th>
                <th className="text-left p-3">Data invito</th>
                <th className="text-left p-3">Status</th>
                <th className="text-right p-3">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((i) => (
                <tr key={i.id} className="border-t border-border/70">
                  <td className="p-3">{i.email}</td>
                  <td className="p-3">{roleLabel(i.role)}</td>
                  <td className="p-3 text-xs opacity-70">{new Date(i.invited_at).toLocaleString("it-IT")}</td>
                  <td className="p-3">
                    <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full ${
                      i.status === "invited" ? "bg-warning/15 text-warning" :
                      i.status === "accepted" ? "bg-success/15 text-success" :
                      "bg-muted text-muted-foreground"
                    }`}>{statusLabel(i.status)}</span>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex gap-2 justify-end flex-wrap">
                      {i.status === "invited" && (
                        <>
                          <button onClick={() => copyLink(i.token)}
                            className="text-xs px-2 py-1 rounded bg-brand-green text-brand-cream">
                            {copiedToken === i.token ? "Copiato ✓" : "Copia link"}
                          </button>
                          <button onClick={() => resendInvite(i)}
                            className="text-xs px-2 py-1 rounded bg-muted text-foreground">
                            Reinvia
                          </button>
                          <button onClick={() => revokeInvite(i)}
                            className="text-xs px-2 py-1 rounded bg-danger/15 text-danger">
                            Revoca
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {invites.length === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-muted-foreground text-xs">Nessun invito.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <InviteSheet open={openInvite} onClose={() => setOpenInvite(false)} onSubmit={createInvite} />
    </div>
  );
}

function InviteSheet({
  open, onClose, onSubmit,
}: { open: boolean; onClose: () => void; onSubmit: (email: string, role: AccountRole) => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AccountRole>("collaborator");
  useEffect(() => { if (open) { setEmail(""); setRole("collaborator"); } }, [open]);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Invita persona"
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-muted text-foreground text-sm">Annulla</button>
          <button onClick={() => onSubmit(email, role)}
            className="px-4 py-2 rounded-lg bg-brand-gold text-brand-green text-sm font-semibold">
            Invia invito
          </button>
        </div>
      }
    >
      <Field label="Email">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-border bg-background" placeholder="persona@dominio.it" />
      </Field>
      <Field label="Ruolo">
        <select value={role} onChange={(e) => setRole(e.target.value as AccountRole)}
          className="w-full px-3 py-2 rounded-lg border border-border bg-background">
          <option value="collaborator">Collaboratore</option>
          <option value="admin">Amministratore</option>
        </select>
      </Field>
      <p className="text-xs text-muted-foreground">
        L'invitato riceverà un link di registrazione. Al completamento entrerà direttamente in questa attività con i dati sincronizzati.
      </p>
    </Sheet>
  );
}