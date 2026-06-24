import { createFileRoute, Link } from "@tanstack/react-router";
import { TopBar } from "@/components/AppShell";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title: "Privacy Policy — Sciorio HQ" },
      { name: "description", content: "Informativa privacy del gestionale interno Sciorio HQ." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function PrivacyPage() {
  return (
    <>
      <TopBar title="Privacy Policy" subtitle="Ultimo aggiornamento: 24 giugno 2026" />
      <article className="px-5 md:px-8 py-6 max-w-3xl space-y-5 text-sm leading-relaxed text-foreground/90">
        <section>
          <h2 className="font-display text-xl text-brand-green mb-2">1. Titolare del trattamento</h2>
          <p>
            Caseificio Sciorio — gastronomia artigianale dal 1947. Per richieste relative ai dati personali è
            possibile contattare il titolare presso il punto vendita o tramite i recapiti aziendali ufficiali.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-brand-green mb-2">2. Natura del servizio</h2>
          <p>
            Sciorio HQ è un <strong>gestionale interno ad uso esclusivo del personale</strong> del Caseificio Sciorio.
            Non è un servizio rivolto al pubblico: le registrazioni sono chiuse e l'accesso è consentito unicamente
            ai collaboratori autorizzati tramite credenziali nominative.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-brand-green mb-2">3. Dati trattati</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Dati degli operatori</strong>: email e password di accesso (gestite tramite il provider di autenticazione).</li>
            <li><strong>Dati di clientela</strong> inseriti dagli operatori: nominativo, recapito telefonico, indirizzo di consegna, eventuali note operative, partita IVA / codice fiscale per fatturazione.</li>
            <li><strong>Dati operativi</strong>: ordini, scontrini, consegne, incassi, uscite, magazzino, produzione, fornitori.</li>
          </ul>
          <p className="mt-2">
            Non vengono trattati dati appartenenti a categorie particolari (art. 9 GDPR) né dati di minori.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-brand-green mb-2">4. Finalità e base giuridica</h2>
          <p>
            I dati sono trattati per finalità di <strong>gestione interna dell'attività</strong> (presa ordini, organizzazione
            consegne, fatturazione, contabilità di cassa, gestione magazzino e fornitori) sulla base
            dell'esecuzione del rapporto contrattuale con il cliente, di obblighi di legge fiscali e
            dell'interesse legittimo del titolare alla corretta gestione aziendale.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-brand-green mb-2">5. Modalità e luogo del trattamento</h2>
          <p>
            I dati vengono salvati sul dispositivo dell'operatore (memoria locale del browser) e sincronizzati su
            <strong> infrastruttura cloud Lovable Cloud</strong> (basata su Supabase, server nell'Unione Europea). L'accesso
            ai dati cloud è protetto da autenticazione e regole di sicurezza a livello di riga (Row Level Security).
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-brand-green mb-2">6. Conservazione</h2>
          <p>
            I dati sono conservati per il tempo necessario alle finalità sopra indicate e, ove richiesto, per il
            periodo previsto dalla normativa fiscale e civilistica (di norma 10 anni per documenti contabili).
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-brand-green mb-2">7. Comunicazione a terzi</h2>
          <p>
            I dati non vengono ceduti a terzi. Possono essere comunicati esclusivamente a:
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-1">
            <li>fornitore dell'infrastruttura tecnologica (Lovable Cloud / Supabase) in qualità di responsabile esterno;</li>
            <li>consulenti contabili e fiscali del titolare, ove necessario;</li>
            <li>autorità competenti, su richiesta motivata.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl text-brand-green mb-2">8. Diritti dell'interessato</h2>
          <p>
            Ogni cliente può esercitare i diritti previsti dagli artt. 15-22 GDPR (accesso, rettifica, cancellazione,
            limitazione, opposizione, portabilità) contattando direttamente il titolare presso il punto vendita.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-brand-green mb-2">9. Cookie</h2>
          <p>
            L'applicazione utilizza esclusivamente cookie e archiviazione locale di natura <strong>tecnica</strong>,
            necessari al funzionamento. Per i dettagli vedi la <Link to="/cookie" className="text-brand-green underline">Cookie Policy</Link>.
          </p>
        </section>

        <p className="pt-4 border-t border-border text-xs text-muted-foreground">
          La presente informativa può essere aggiornata. Verrà data evidenza delle modifiche all'interno del
          gestionale.
        </p>
      </article>
    </>
  );
}
