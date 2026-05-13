import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { TopBar, formatEuro } from "@/components/AppShell";

export const Route = createFileRoute("/offerte")({ component: OffertePage });

function OffertePage() {
  const { bundles, updateBundle } = useStore();

  return (
    <div>
      <TopBar title="Offerte e Bundle" subtitle={`${bundles.length} bundle disponibili`} />
      <div className="p-4 space-y-3">
        {bundles.map((b) => (
          <div key={b.id} className={`bg-card rounded-xl p-4 shadow-sm ${!b.active ? "opacity-60" : ""}`}>
            <div className="flex justify-between items-start gap-3 mb-2">
              <div className="flex-1">
                <h3 className="font-display text-lg text-brand-green leading-tight">{b.name}</h3>
                <p className="text-[11px] text-brand-gold uppercase tracking-wide mt-0.5 font-semibold">{b.availability}</p>
              </div>
              <button
                onClick={() => updateBundle(b.id, { active: !b.active })}
                className={`shrink-0 w-12 h-7 rounded-full p-0.5 transition-colors ${b.active ? "bg-success" : "bg-muted-foreground/30"}`}
              >
                <div className={`w-6 h-6 rounded-full bg-white transition-transform ${b.active ? "translate-x-5" : ""}`} />
              </button>
            </div>

            <ul className="text-sm text-foreground/80 space-y-0.5 mb-3">
              {b.ingredients.map((i, idx) => <li key={idx}>· {i}</li>)}
            </ul>

            <div className="flex items-end justify-between bg-brand-cream rounded-lg p-3">
              <div>
                <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Prezzo pieno</p>
                <p className="text-sm text-muted-foreground line-through">{formatEuro(b.fullPrice)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase text-brand-gold tracking-wide">Offerta</p>
                <p className="font-display text-2xl font-bold text-brand-gold leading-none">
                  {b.offerPrice === null ? "TBD" : formatEuro(b.offerPrice)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Margine</p>
                <p className="text-sm font-bold text-success">{b.marginPct === null ? "—" : b.marginPct + "%"}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
