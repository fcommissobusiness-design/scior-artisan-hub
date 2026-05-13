import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { TopBar, formatDate, Sheet, Field, Fab, formatEuro } from "@/components/AppShell";
import { SEGMENT_META, type Client, type Segment } from "@/lib/data";

export const Route = createFileRoute("/clienti")({ component: ClientiPage });

const SEGMENTS: (Segment | "all")[] = ["all", "top", "abituali", "occasionali", "nuovi", "inattivi"];

function ClientiPage() {
  const { clients, orders, products, casualSales, addClient, updateClient, deleteClient } = useStore();
  const [tab, setTab] = useState<Segment | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [openNew, setOpenNew] = useState(false);

  const counts = useMemo(() => {
    const m: Record<Segment, number> = { top: 0, abituali: 0, occasionali: 0, nuovi: 0, inattivi: 0 };
    for (const c of clients) m[c.segment]++;
    return m;
  }, [clients]);

  const filtered = tab === "all" ? clients : clients.filter((c) => c.segment === tab);

  return (
    <div>
      <TopBar title="Clienti" subtitle={`${clients.length} schede totali`} />

      <div className="px-4 md:px-6 pt-3 grid grid-cols-5 gap-2">
        {(Object.keys(SEGMENT_META) as Segment[]).map((s) => (
          <button key={s} onClick={() => setTab(s)} className={`bg-card rounded-lg p-2 text-center ${tab === s ? "ring-2 ring-brand-gold" : ""}`}>
            <p className="font-display text-lg text-brand-green leading-none">{counts[s]}</p>
            <p className="text-[9px] text-muted-foreground mt-1 leading-tight">{SEGMENT_META[s].label}</p>
          </button>
        ))}
      </div>

      <div className="px-4 md:px-6 pt-3 pb-2 flex gap-2 overflow-x-auto">
        {SEGMENTS.map((s) => (
          <button key={s} onClick={() => setTab(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${tab === s ? "bg-brand-green text-brand-cream" : "bg-card text-foreground/70"}`}>
            {s === "all" ? "Tutti" : SEGMENT_META[s].label}
          </button>
        ))}
      </div>

      <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((c) => {
          const meta = SEGMENT_META[c.segment];
          const stamps = c.stamps;
          return (
            <button key={c.id} onClick={() => setOpenId(c.id)} className="text-left bg-card rounded-xl p-4 shadow-sm hover:shadow-md">
              <div className="flex justify-between items-start mb-1">
                <div>
                  <p className="font-display text-lg text-brand-green leading-tight">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.phone || "—"}</p>
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
            </button>
          );
        })}
      </div>

      <Fab onClick={() => setOpenNew(true)} />

      {openNew && (
        <ClientSheet mode="new" onClose={() => setOpenNew(false)} onSave={(c) => { addClient(c); setOpenNew(false); }} />
      )}

      {openId && (() => {
        const c = clients.find(c => c.id === openId);
        if (!c) return null;
        const orderHist = orders.filter(o => o.clientId === c.id).sort((a,b) => +new Date(b.pickupDate) - +new Date(a.pickupDate));
        const saleHist = casualSales.filter(s => s.clientId === c.id).sort((a,b) => +new Date(b.date) - +new Date(a.date));
        return (
          <ClientSheet
            mode="edit" client={c}
            historyContent={
              <div className="space-y-4">
                <div>
                  <h3 className="font-display text-lg text-brand-green mb-2">Ordini ({orderHist.length})</h3>
                  {orderHist.length === 0 && <p className="text-sm text-muted-foreground">Nessun ordine.</p>}
                  <div className="space-y-2">
                    {orderHist.map(o => (
                      <div key={o.id} className="bg-card rounded-lg p-3 text-sm border border-border">
                        <div className="flex justify-between">
                          <span>{formatDate(o.pickupDate)} · <span className="text-xs uppercase text-muted-foreground">{o.status}</span></span>
                          <span className="font-semibold">{formatEuro(o.total)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {o.items.map(i => products.find(p => p.id === i.productId)?.name ?? i.productId).join(", ")}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="font-display text-lg text-brand-green mb-2">Scontrini ({saleHist.length})</h3>
                  {saleHist.length === 0 && <p className="text-sm text-muted-foreground">Nessuno scontrino.</p>}
                  <div className="space-y-2">
                    {saleHist.map(s => (
                      <div key={s.id} className="bg-card rounded-lg p-3 text-sm border border-border">
                        <div className="flex justify-between">
                          <span>{formatDate(s.date)}</span>
                          <span className="font-semibold">{formatEuro(s.total)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {s.items.map(i => products.find(p => p.id === i.productId)?.name ?? i.productId).join(", ")}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            }
            onClose={() => setOpenId(null)}
            onSave={(patch) => { updateClient(c.id, patch); setOpenId(null); }}
            onDelete={() => {
              if (confirm(`Eliminare ${c.name}?`)) { deleteClient(c.id); setOpenId(null); }
            }}
          />
        );
      })()}
    </div>
  );
}

function ClientSheet({ mode, client, historyContent, onClose, onSave, onDelete }: {
  mode: "new" | "edit";
  client?: Client;
  historyContent?: React.ReactNode;
  onClose: () => void;
  onSave: (c: Omit<Client, "id"> | Partial<Client>) => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(client?.name ?? "");
  const [phone, setPhone] = useState(client?.phone ?? "");
  const [segment, setSegment] = useState<Segment>(client?.segment ?? "nuovi");
  const [stamps, setStamps] = useState<number>(client?.stamps ?? 0);
  const [firstOrder, setFirstOrder] = useState<string>(client?.firstOrder ?? new Date().toISOString().slice(0,10));
  const [notes, setNotes] = useState(client?.notes ?? "");

  const save = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(), phone: phone.trim(), segment,
      stamps: Math.max(0, Math.min(5, stamps)),
      firstOrder, notes: notes.trim() || undefined,
    } as any);
  };

  return (
    <Sheet
      open={true} onClose={onClose}
      title={mode === "new" ? "Nuovo Cliente" : (client?.name ?? "Cliente")}
      footer={
        <div className="flex gap-3">
          {mode === "edit" && onDelete && (
            <button onClick={onDelete} className="text-danger border border-danger/40 rounded-xl px-3 py-3 text-sm font-semibold">Elimina</button>
          )}
          <button onClick={save} disabled={!name.trim()}
            className="flex-1 bg-brand-gold text-white rounded-xl px-6 py-3 font-semibold disabled:opacity-40">
            {mode === "new" ? "Crea cliente" : "Salva modifiche"}
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Nome e cognome">
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Telefono">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+39 333 ..." className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Status / Segmento">
          <select value={segment} onChange={(e) => setSegment(e.target.value as Segment)} className="w-full bg-card border border-border rounded-lg p-3">
            {(Object.keys(SEGMENT_META) as Segment[]).map((s) => <option key={s} value={s}>{SEGMENT_META[s].label}</option>)}
          </select>
        </Field>
        <Field label="Data primo ordine">
          <input type="date" value={firstOrder} onChange={(e) => setFirstOrder(e.target.value)} className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Bollini fedeltà (0-5)">
          <input type="number" min={0} max={5} value={stamps} onChange={(e) => setStamps(+e.target.value)} className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
      </div>
      <Field label="Note">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full bg-card border border-border rounded-lg p-3 text-sm" />
      </Field>
      {historyContent}
    </Sheet>
  );
}
