import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { TopBar, formatDate } from "@/components/AppShell";
import { SEGMENT_META, type Segment } from "@/lib/data";

export const Route = createFileRoute("/clienti")({ component: ClientiPage });

const SEGMENTS: (Segment | "all")[] = ["all", "top", "abituali", "occasionali", "nuovi", "inattivi"];

function ClientiPage() {
  const { clients, orders, products } = useStore();
  const [tab, setTab] = useState<Segment | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = tab === "all" ? clients : clients.filter((c) => c.segment === tab);

  return (
    <div>
      <TopBar title="Clienti" subtitle="351 contatti WhatsApp totali" />

      <div className="px-4 pt-3 grid grid-cols-5 gap-2">
        {(Object.keys(SEGMENT_META) as Segment[]).map((s) => (
          <div key={s} className="bg-card rounded-lg p-2 text-center">
            <p className="font-display text-lg text-brand-green leading-none">{SEGMENT_META[s].count}</p>
            <p className="text-[9px] text-muted-foreground mt-1 leading-tight">{SEGMENT_META[s].label}</p>
          </div>
        ))}
      </div>

      <div className="px-4 pt-3 pb-2 flex gap-2 overflow-x-auto">
        {SEGMENTS.map((s) => (
          <button key={s} onClick={() => setTab(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${tab === s ? "bg-brand-green text-brand-cream" : "bg-card text-foreground/70"}`}>
            {s === "all" ? "Tutti" : SEGMENT_META[s].label}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-3">
        {filtered.map((c) => {
          const meta = SEGMENT_META[c.segment];
          const stamps = c.stamps;
          return (
            <div key={c.id} className="bg-card rounded-xl p-4 shadow-sm" onClick={() => setOpenId(c.id)}>
              <div className="flex justify-between items-start mb-1">
                <div>
                  <p className="font-display text-lg text-brand-green leading-tight">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.phone}</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${meta.color}`}>{meta.label}</span>
              </div>
              {c.lastOrder && <p className="text-xs text-muted-foreground mt-1">Ultimo ordine: {formatDate(c.lastOrder)}</p>}
              <div className="mt-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[11px] text-muted-foreground">Fedeltà</span>
                  <span className="text-[11px] text-brand-green font-semibold">{stamps}/5</span>
                </div>
                <div className="flex gap-1">
                  {[0,1,2,3,4].map(i => (
                    <div key={i} className={`flex-1 h-2 rounded-full ${i < stamps ? "bg-brand-gold" : "bg-muted"}`} />
                  ))}
                </div>
                {stamps >= 5 && <p className="text-[11px] text-brand-gold mt-1 font-semibold">1kg mozzarella in omaggio!</p>}
              </div>
            </div>
          );
        })}
      </div>

      {openId && (() => {
        const c = clients.find(c => c.id === openId)!;
        const history = orders.filter(o => o.clientId === c.id);
        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={() => setOpenId(null)}>
            <div className="bg-brand-cream w-full max-w-[480px] rounded-t-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="sticky top-0 bg-brand-green text-brand-cream px-5 py-4 flex justify-between items-center">
                <h2 className="font-display text-xl text-brand-gold">{c.name}</h2>
                <button onClick={() => setOpenId(null)} className="text-2xl leading-none">×</button>
              </div>
              <div className="p-4 space-y-4">
                <div className="bg-card rounded-xl p-4">
                  <p className="text-sm">{c.phone}</p>
                  <p className="text-xs text-muted-foreground mt-1">Segmento: {SEGMENT_META[c.segment].label}</p>
                  <p className="text-xs text-muted-foreground">Comunicazione: {SEGMENT_META[c.segment].mode}</p>
                </div>
                {c.notes && <div className="bg-card rounded-xl p-4 text-sm italic">{c.notes}</div>}
                <div>
                  <h3 className="font-display text-lg text-brand-green mb-2">Storico ordini ({history.length})</h3>
                  {history.length === 0 && <p className="text-sm text-muted-foreground">Nessun ordine registrato.</p>}
                  <div className="space-y-2">
                    {history.map(o => (
                      <div key={o.id} className="bg-card rounded-lg p-3 text-sm">
                        <div className="flex justify-between">
                          <span>{formatDate(o.pickupDate)}</span>
                          <span className="font-semibold">{o.total.toFixed(2)}€</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {o.items.map(i => products.find(p => p.id === i.productId)?.name ?? i.productId).join(", ")}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
