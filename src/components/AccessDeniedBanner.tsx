import { useState } from "react";

export function AccessDeniedBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) {
    // Dopo la chiusura mostriamo comunque un messaggio non intrusivo,
    // così l'utente sa perché la sezione è vuota.
    return (
      <div className="absolute inset-0 z-30 flex items-start justify-center pt-24 md:pt-32 px-4 pointer-events-none">
        <div className="bg-brand-cream/90 border border-border rounded-xl px-4 py-2 text-xs text-muted-foreground">
          Sezione non accessibile con il tuo profilo.
        </div>
      </div>
    );
  }
  return (
    <div className="absolute inset-0 z-30 flex items-start justify-center pt-24 md:pt-32 px-4">
      <div className="bg-brand-cream border-2 border-brand-gold/40 rounded-2xl shadow-2xl max-w-md w-full p-6 text-center">
        <div className="text-4xl mb-2">🔒</div>
        <h2 className="font-display text-2xl text-brand-green mb-2">Accesso non consentito</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Non disponi dei permessi necessari per accedere a questa sezione.
        </p>
        <button
          onClick={() => setDismissed(true)}
          className="px-4 py-2 rounded-lg bg-brand-green text-brand-cream text-sm font-semibold hover:opacity-90"
        >
          Contatta un amministratore
        </button>
      </div>
    </div>
  );
}
