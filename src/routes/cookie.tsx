import { createFileRoute, Link } from "@tanstack/react-router";
import { TopBar } from "@/components/AppShell";

export const Route = createFileRoute("/cookie")({
  component: CookiePage,
  head: () => ({
    meta: [
      { title: "Cookie Policy — Sciorio HQ" },
      { name: "description", content: "Cookie policy del gestionale interno Sciorio HQ." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function CookiePage() {
  return (
    <>
      <TopBar title="Cookie Policy" subtitle="Ultimo aggiornamento: 24 giugno 2026" />
      <article className="px-5 md:px-8 py-6 max-w-3xl space-y-5 text-sm leading-relaxed text-foreground/90">
        <section>
          <h2 className="font-display text-xl text-brand-green mb-2">Natura dell'applicazione</h2>
          <p>
            Sciorio HQ è un gestionale interno accessibile solo previa autenticazione. Non vengono utilizzati
            cookie pubblicitari, di profilazione, di analytics di terze parti o di tracciamento cross-site.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-brand-green mb-2">Cookie e archiviazione utilizzati</h2>
          <p>
            L'applicazione utilizza esclusivamente strumenti <strong>tecnici e strettamente necessari</strong> al
            funzionamento, per i quali — ai sensi del Provvedimento del Garante Privacy 10 giugno 2021 — <strong>non è
            richiesto il consenso preventivo</strong>:
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs border border-border">
              <thead className="bg-brand-green/10">
                <tr>
                  <th className="text-left p-2 border-b border-border">Strumento</th>
                  <th className="text-left p-2 border-b border-border">Finalità</th>
                  <th className="text-left p-2 border-b border-border">Durata</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-2 border-b border-border align-top">Token di sessione (localStorage)</td>
                  <td className="p-2 border-b border-border align-top">Mantenere l'utente autenticato tra le sessioni di lavoro.</td>
                  <td className="p-2 border-b border-border align-top">Persistente fino al logout</td>
                </tr>
                <tr>
                  <td className="p-2 border-b border-border align-top">Cache dati operativi (IndexedDB / localStorage)</td>
                  <td className="p-2 border-b border-border align-top">Permettere l'uso del gestionale anche in assenza di connessione e velocizzare la sincronizzazione.</td>
                  <td className="p-2 border-b border-border align-top">Persistente fino a cancellazione manuale</td>
                </tr>
                <tr>
                  <td className="p-2 align-top">Backup automatici locali</td>
                  <td className="p-2 align-top">Conservare copie di sicurezza dei dati sul dispositivo.</td>
                  <td className="p-2 align-top">Persistente fino a cancellazione manuale</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="font-display text-xl text-brand-green mb-2">Cookie di terze parti</h2>
          <p>
            <strong>Non sono presenti</strong> cookie di terze parti per finalità di marketing, profilazione o analisi
            statistica. L'unico servizio esterno utilizzato è il provider di autenticazione e database
            (Lovable Cloud / Supabase, con server nell'Unione Europea), strettamente necessario al funzionamento.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-brand-green mb-2">Come disattivarli</h2>
          <p>
            Essendo strumenti tecnici necessari, la loro disattivazione impedisce il funzionamento del gestionale.
            È comunque possibile cancellare l'archiviazione locale dalle impostazioni del browser; in tal caso sarà
            richiesto un nuovo login e potrebbero andare persi i backup locali non ancora sincronizzati.
          </p>
        </section>

        <p className="pt-4 border-t border-border text-xs text-muted-foreground">
          Per maggiori informazioni sul trattamento dei dati consulta la{" "}
          <Link to="/privacy" className="text-brand-green underline">Privacy Policy</Link>.
        </p>
      </article>
    </>
  );
}
