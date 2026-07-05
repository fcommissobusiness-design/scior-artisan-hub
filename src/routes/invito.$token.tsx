import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { acceptInvitationFn } from "@/lib/invitations.functions";

export const Route = createFileRoute("/invito/$token")({ component: InvitePage });

function InvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "invalid" | "ready" | "submitting" | "done">("loading");
  const [email, setEmail] = useState<string>("");
  const [role, setRole] = useState<string>("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .rpc("get_invitation_by_token", { _token: token });
      const row = Array.isArray(data) ? data[0] : data;
      if (error || !row || row.status !== "invited") {
        setStatus("invalid");
        return;
      }
      setEmail(row.email as string);
      setRole(row.role as string);
      setStatus("ready");
    })();
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (password.length < 6) { setErr("La password deve avere almeno 6 caratteri"); return; }
    setStatus("submitting");
    try {
      const res = await acceptInvitationFn({ data: { token, password } });
      // login automatico
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: res.email,
        password,
      });
      if (signErr) throw signErr;
      setStatus("done");
      setTimeout(() => navigate({ to: "/" }), 400);
    } catch (e: any) {
      setErr(e?.message ?? "Errore durante la registrazione");
      setStatus("ready");
    }
  };

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center bg-brand-green text-brand-cream text-sm opacity-80">Caricamento invito…</div>;
  }
  if (status === "invalid") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-brand-green text-brand-cream px-6 text-center">
        <h1 className="font-display text-3xl text-brand-gold mb-2">Invito non valido</h1>
        <p className="text-sm opacity-80 max-w-sm">Il link di invito non è più attivo o è stato revocato. Contatta un amministratore per riceverne uno nuovo.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-brand-green text-brand-cream px-6">
      <h1 className="font-display text-3xl text-brand-gold mb-1">Sciorio HQ</h1>
      <p className="text-sm opacity-80 mb-8">Accetta l'invito e completa la registrazione</p>
      <form onSubmit={submit} className="w-full max-w-xs space-y-3 bg-brand-green-dark/40 p-5 rounded-2xl">
        <div>
          <label className="text-[11px] uppercase tracking-wider opacity-80">Email</label>
          <input type="email" value={email} readOnly
            className="w-full mt-1 px-3 py-2 rounded-lg bg-brand-cream/70 text-brand-green outline-none cursor-not-allowed" />
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wider opacity-80">Ruolo</label>
          <input type="text" value={role === "admin" ? "Amministratore" : "Collaboratore"} readOnly
            className="w-full mt-1 px-3 py-2 rounded-lg bg-brand-cream/70 text-brand-green outline-none cursor-not-allowed" />
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wider opacity-80">Password</label>
          <input type="password" required minLength={6} value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full mt-1 px-3 py-2 rounded-lg bg-brand-cream text-brand-green outline-none" />
        </div>
        {err && <p className="text-xs text-red-300">{err}</p>}
        <button disabled={status === "submitting"} type="submit"
          className="w-full py-2.5 rounded-lg bg-brand-gold text-brand-green font-semibold disabled:opacity-60">
          {status === "submitting" ? "…" : "Completa registrazione"}
        </button>
      </form>
    </div>
  );
}
