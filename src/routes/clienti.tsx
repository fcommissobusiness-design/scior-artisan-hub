import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import { TopBar, formatDate, Sheet, Field, Fab, formatEuro } from "@/components/AppShell";
import { SEGMENT_META, type Client, type Segment } from "@/lib/data";
import {
  clientLTV, clientOrderCount, clientAvgTicket, clientFrequencyPerMonth,
  daysInactive, suggestSegment, clientTopProducts, clientBadges,
  recoverableClients,
} from "@/lib/metrics";
import { loadCrmSettings } from "@/lib/crm-settings";
import { WhatsAppDialog } from "@/components/WhatsAppDialog";

interface Search { f?: string }

export const Route = createFileRoute("/clienti")({
  component: ClientiPage,
  validateSearch: (s: Record<string, unknown>): Search => ({ f: typeof s.f === "string" ? s.f : undefined }),
});

const SEGMENTS: (Segment | "all")[] = ["all", "top", "abituali", "occasionali", "nuovi", "inattivi"];

function ClientiPage() {
  const search = useSearch({ from: "/clienti" }) as Search;
  const { clients, orders, products, casualSales, addClient, updateClient, deleteClient } = useStore();
  const [tab, setTab] = useState<Segment | "all">("all");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"" | "premi" | "vicini" | "inattivi" | "caldi" | "alto" | "recuperabili" | "nuovi">("");
  const crmSettings = useMemo(() => loadCrmSettings(), []);
  const recuperabiliSet = useMemo(
    () => new Set(recoverableClients(orders, casualSales, clients, crmSettings).map((c) => c.id)),
    [orders, casualSales, clients, crmSettings],
  );
  const [openId, setOpenId] = useState<string | null>(null);
  const [openNew, setOpenNew] = useState(false);

  useEffect(() => {
    if (search.f === "premi") setFilter("premi");
    if (search.f === "inattivi") setFilter("inattivi");
    if (search.f === "recuperabili") setFilter("recuperabili");
    if (search.f === "vicini") setFilter("vicini");
    if (search.f === "alto") setFilter("alto");
    if (search.f === "nuovi") setFilter("nuovi");
  }, [search.f]);

  const counts = useMemo(() => {
    const m: Record<Segment, number> = { top: 0, abituali: 0, occasionali: 0, nuovi: 0, inattivi: 0 };
    for (const c of clients) m[c.segment]++;
    return m;
  }, [clients]);

  const filtered = useMemo(() => clients.filter((c) => {
    if (tab !== "all" && c.segment !== tab) return false;
    if (q) {
      const t = q.toLowerCase();
      if (!(c.name.toLowerCase().includes(t) || c.phone.includes(q) || (c.tags ?? []).some(x => x.toLowerCase().includes(t)))) return false;
    }
    if (filter === "premi" && (c.stamps ?? 0) < 5) return false;
    if (filter === "vicini" && (c.stamps ?? 0) !== 4) return false;
    if (filter === "inattivi") {
      const d = daysInactive(orders, casualSales, c);
      if (d === null || d <= crmSettings.inactiveOccDays) return false;
    }
    if (filter === "caldi") {
      const d = daysInactive(orders, casualSales, c);
      if (d === null || d > 7) return false;
    }
    if (filter === "alto" && clientLTV(orders, casualSales, c.id) < 500) return false;
    if (filter === "recuperabili" && !recuperabiliSet.has(c.id)) return false;
    if (filter === "nuovi") {
      if (!c.firstOrder) return false;
      const days = (Date.now() - +new Date(c.firstOrder)) / 86400000;
      if (days > crmSettings.newDays) return false;
    }
    return true;
  }), [clients, tab, q, filter, orders, casualSales, crmSettings, recuperabiliSet]);

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

      <div className="px-4 md:px-6 pt-3 space-y-2">
        <input placeholder="Cerca per nome, telefono o tag..." value={q} onChange={(e) => setQ(e.target.value)}
          className="w-full bg-card border border-border rounded-lg p-2.5 text-sm" />
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {SEGMENTS.map((s) => (
            <button key={s} onClick={() => setTab(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${tab === s ? "bg-brand-green text-brand-cream" : "bg-card text-foreground/70"}`}>
              {s === "all" ? "Tutti" : SEGMENT_META[s].label}
            </button>
          ))}
          <span className="w-2" />
          {[
            { id: "premi" as const, label: "Premi pronti" },
            { id: "vicini" as const, label: "Vicini al premio" },
            { id: "recuperabili" as const, label: "Da recuperare" },
            { id: "inattivi" as const, label: `Inattivi ${crmSettings.inactiveOccDays}+gg` },
            { id: "caldi" as const, label: "Caldi 7gg" },
            { id: "nuovi" as const, label: "Nuovi" },
            { id: "alto" as const, label: "Alto spendenti" },
          ].map(b => (
            <button key={b.id} onClick={() => setFilter(filter === b.id ? "" : b.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${filter === b.id ? "bg-brand-gold text-white" : "bg-card text-foreground/70"}`}>
              {b.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.length === 0 && <p className="md:col-span-3 text-center text-sm text-muted-foreground py-8">Nessun cliente.</p>}
        {filtered.map((c) => {
          const meta = SEGMENT_META[c.segment];
          const stamps = c.stamps ?? 0;
          const ltv = clientLTV(orders, casualSales, c.id);
          const inactive = daysInactive(orders, casualSales, c);
          const badges = clientBadges(orders, casualSales, c);
          return (
            <button key={c.id} onClick={() => setOpenId(c.id)} className="text-left bg-card rounded-xl p-4 shadow-sm hover:shadow-md">
              <div className="flex justify-between items-start mb-1">
                <div>
                  <p className="font-display text-lg text-brand-green leading-tight">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.phone || "—"}</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${meta.color}`}>{meta.label}</span>
              </div>
              <div className="flex flex-wrap gap-1 mt-1">
                {badges.map((b) => (
                  <span key={b} className={`text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase ${
                    b === "caldo" ? "bg-success/15 text-success" :
                    b === "inattivo" ? "bg-neutral-700/15 text-neutral-700" :
                    b === "alto spendente" ? "bg-brand-gold/20 text-brand-gold" :
                    b === "vicino premio" ? "bg-warning/15 text-warning" :
                    "bg-brand-green/15 text-brand-green"
                  }`}>{b}</span>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                <div><p className="text-[10px] text-muted-foreground">LTV</p><p className="text-sm font-bold text-brand-green">{formatEuro(ltv)}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Inattiv.</p><p className="text-sm font-bold">{inactive === null ? "—" : inactive + "gg"}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Ultimo</p><p className="text-sm font-bold">{c.lastOrder ? formatDate(c.lastOrder) : "—"}</p></div>
              </div>
              <div className="mt-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[11px] text-muted-foreground">Fedeltà</span>
                  <span className="text-[11px] text-brand-green font-semibold">{stamps}/5</span>
                </div>
                <div className="flex gap-1">
                  {[0,1,2,3,4].map(i => (
                    <div key={i} className={`flex-1 h-3 rounded-full transition-colors ${i < stamps ? "bg-brand-gold" : "bg-muted"}`} />
                  ))}
                </div>
                {stamps >= 5 && <p className="text-[11px] text-brand-gold mt-1 font-semibold">Premio pronto: 1kg mozzarella</p>}
                {stamps === 4 && <p className="text-[11px] text-warning mt-1 font-semibold">Quasi completato</p>}
              </div>
            </button>
          );
        })}
      </div>

      <Fab onClick={() => setOpenNew(true)} />

      {openNew && (
        <ClientSheet mode="new" onClose={() => setOpenNew(false)} onSave={(c) => { addClient(c as Omit<Client, "id">); setOpenNew(false); }} />
      )}

      {openId && (() => {
        const c = clients.find(c => c.id === openId);
        if (!c) return null;
        return (
          <ClientDetail
            client={c}
            onClose={() => setOpenId(null)}
            onSave={(patch) => { updateClient(c.id, patch); setOpenId(null); }}
            onDelete={() => { if (confirm(`Eliminare ${c.name}?`)) { deleteClient(c.id); setOpenId(null); } }}
          />
        );
      })()}
    </div>
  );
}

function ClientDetail({ client, onClose, onSave, onDelete }: {
  client: Client;
  onClose: () => void;
  onSave: (patch: Partial<Client>) => void;
  onDelete: () => void;
}) {
  const { orders, casualSales, products, addLoyaltyEvent, setLoyaltyStamps, logClientEvent } = useStore();
  const [openWa, setOpenWa] = useState(false);

  const [name, setName] = useState(client.name);
  const [phone, setPhone] = useState(client.phone);
  const [segment, setSegment] = useState<Segment>(client.segment);
  const [segmentManual, setSegmentManual] = useState(client.segmentManual ?? false);
  const [stamps, setStamps] = useState(client.stamps ?? 0);
  const [firstOrder, setFirstOrder] = useState(client.firstOrder ?? new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState(client.notes ?? "");
  const [tags, setTags] = useState<string>((client.tags ?? []).join(", "));
  const [zone, setZone] = useState(client.deliveryZone ?? "");
  const [slot, setSlot] = useState(client.preferredTimeSlot ?? "");

  const ltv = clientLTV(orders, casualSales, client.id);
  const ord = clientOrderCount(orders, casualSales, client.id);
  const avg = clientAvgTicket(orders, casualSales, client.id);
  const freq = clientFrequencyPerMonth(orders, casualSales, client);
  const inactive = daysInactive(orders, casualSales, client);
  const auto = suggestSegment(orders, casualSales, client);
  const top = clientTopProducts(orders, casualSales, products, client.id, 5);

  const orderHist = orders.filter(o => o.clientId === client.id).sort((a, b) => +new Date(b.pickupDate) - +new Date(a.pickupDate));
  const saleHist = casualSales.filter(s => s.clientId === client.id).sort((a, b) => +new Date(b.date) - +new Date(a.date));

  const save = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(), phone: phone.trim(), segment, segmentManual,
      stamps: Math.max(0, Math.min(5, stamps)), firstOrder,
      notes: notes.trim() || undefined,
      tags: tags.split(",").map(t => t.trim()).filter(Boolean),
      deliveryZone: zone.trim() || undefined,
      preferredTimeSlot: slot.trim() || undefined,
    });
  };

  return (
    <Sheet open={true} onClose={onClose} title={client.name}
      footer={
        <div className="flex gap-2">
          <button onClick={onDelete} className="text-danger border border-danger/40 rounded-xl px-3 py-3 text-sm font-semibold">Elimina</button>
          {client.phone && (
            <button onClick={() => { setOpenWa(true); logClientEvent(client.id, "whatsapp", "Aperto WhatsApp"); }} className="bg-success text-white rounded-xl px-4 py-3 text-sm font-semibold">WhatsApp</button>
          )}
          <button onClick={save} disabled={!name.trim()}
            className="flex-1 bg-brand-gold text-white rounded-xl px-6 py-3 font-semibold disabled:opacity-40">
            Salva
          </button>
        </div>
      }
    >
      {/* HEADER METRICHE */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Stat label="LTV" value={formatEuro(ltv)} />
        <Stat label="Ordini" value={ord.toString()} />
        <Stat label="Scontr. medio" value={formatEuro(avg)} />
        <Stat label="Freq./mese" value={freq.toFixed(1)} />
        <Stat label="Inattivit." value={inactive === null ? "—" : inactive + "gg"} />
        <Stat label="Ultimo ordine" value={client.lastOrder ? formatDate(client.lastOrder) : "—"} />
        <Stat label="Segmento auto" value={SEGMENT_META[auto].label} />
        <Stat label="Stamps" value={`${stamps}/5`} />
      </div>

      {/* FEDELTÀ */}
      <div className="bg-brand-cream rounded-xl p-4">
        <div className="flex justify-between items-center mb-2">
          <p className="font-display text-base text-brand-green">Cartolina fedeltà</p>
          <span className="text-xs font-semibold text-brand-gold">{stamps}/5</span>
        </div>
        <div className="flex gap-2 mb-3">
          {[0,1,2,3,4].map(i => (
            <button key={i} onClick={() => setStamps(i + 1 === stamps ? i : i + 1)}
              className={`flex-1 h-12 rounded-lg flex items-center justify-center text-lg font-display border-2 transition-colors ${
                i < stamps ? "bg-brand-gold text-white border-brand-gold" : "bg-card border-border text-muted-foreground"
              }`}>{i + 1}</button>
          ))}
        </div>
        <div className="flex gap-2 text-xs">
          <button onClick={() => { setLoyaltyStamps(client.id, Math.min(5, stamps + 1)); setStamps(Math.min(5, stamps + 1)); }}
            className="flex-1 bg-brand-green text-brand-cream rounded-lg py-2 font-semibold">+ Timbro</button>
          <button onClick={() => { addLoyaltyEvent(client.id, { type: "reward", note: "Premio riscattato" }); setStamps(0); }}
            className="flex-1 bg-brand-gold text-white rounded-lg py-2 font-semibold">Riscatta premio</button>
          <button onClick={() => { addLoyaltyEvent(client.id, { type: "reset", note: "Reset manuale" }); setStamps(0); }}
            className="px-3 bg-card border border-border rounded-lg py-2 font-semibold">Azzera</button>
        </div>
        {stamps === 4 && <p className="text-xs text-warning mt-2 font-semibold">Quasi completato — proporre prossimo acquisto</p>}
        {stamps >= 5 && <p className="text-xs text-brand-gold mt-2 font-semibold">Premio pronto: 1kg mozzarella in omaggio</p>}
      </div>

      {/* DATI */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Nome">
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Telefono">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+39 333 ..." className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label={`Segmento ${segmentManual ? "(manuale)" : "(auto: " + SEGMENT_META[auto].label + ")"}`}>
          <div className="flex gap-2">
            <select value={segment} onChange={(e) => setSegment(e.target.value as Segment)} className="flex-1 bg-card border border-border rounded-lg p-3">
              {(Object.keys(SEGMENT_META) as Segment[]).map((s) => <option key={s} value={s}>{SEGMENT_META[s].label}</option>)}
            </select>
            <label className="flex items-center gap-1 text-xs">
              <input type="checkbox" checked={segmentManual} onChange={(e) => setSegmentManual(e.target.checked)} />
              Manuale
            </label>
          </div>
          {!segmentManual && segment !== auto && (
            <button onClick={() => setSegment(auto)} className="text-xs text-brand-gold mt-1 font-semibold">Allinea ad auto</button>
          )}
        </Field>
        <Field label="Data primo ordine">
          <input type="date" value={firstOrder} onChange={(e) => setFirstOrder(e.target.value)} className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Fascia oraria preferita">
          <input value={slot} onChange={(e) => setSlot(e.target.value)} placeholder="es. 08:30-10:00" className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Zona consegna">
          <input value={zone} onChange={(e) => setZone(e.target.value)} placeholder="es. Centro" className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
      </div>

      <Field label="Tag (separati da virgola)">
        <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="vip, intolleranza-lattosio, ristorante"
          className="w-full bg-card border border-border rounded-lg p-3" />
      </Field>

      <Field label="Note">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
          className="w-full bg-card border border-border rounded-lg p-3 text-sm" />
      </Field>

      {top.length > 0 && (
        <Field label="Prodotti preferiti">
          <ul className="bg-card rounded-lg p-3 text-sm space-y-1">
            {top.map(t => (
              <li key={t.product!.id} className="flex justify-between">
                <span>{t.product!.name}</span>
                <span className="text-muted-foreground">x{t.qty.toFixed(t.product!.unit === "kg" ? 1 : 0)}</span>
              </li>
            ))}
          </ul>
        </Field>
      )}

      {/* TIMELINE UNIFICATA */}
      <div className="space-y-3">
        <h3 className="font-display text-lg text-brand-green">Storico</h3>
        {orderHist.length === 0 && saleHist.length === 0 && (client.loyaltyHistory ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">Nessuna attività registrata.</p>
        )}
        {orderHist.map(o => (
          <div key={o.id} className="bg-card rounded-lg p-3 text-sm border border-border">
            <div className="flex justify-between">
              <span><span className="text-[10px] uppercase text-brand-gold font-bold">Ordine</span> · {formatDate(o.pickupDate)}</span>
              <span className="font-semibold">{formatEuro(o.total)}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {o.status} · {o.items.map(i => products.find(p => p.id === i.productId)?.name ?? i.productId).join(", ")}
            </p>
          </div>
        ))}
        {saleHist.map(s => (
          <div key={s.id} className="bg-card rounded-lg p-3 text-sm border border-border">
            <div className="flex justify-between">
              <span><span className="text-[10px] uppercase text-brand-green font-bold">Scontrino</span> · {formatDate(s.date)}</span>
              <span className="font-semibold">{formatEuro(s.total)}</span>
            </div>
          </div>
        ))}
        {(client.loyaltyHistory ?? []).slice().reverse().slice(0, 10).map((ev, idx) => (
          <div key={idx} className="bg-card rounded-lg p-2 text-xs border border-border">
            <span className="text-[10px] uppercase text-brand-gold font-bold">Fedeltà</span> · {formatDate(ev.date)} · {ev.type} {ev.note && `— ${ev.note}`}
          </div>
        ))}
      </div>

      {openWa && (
        <WhatsAppDialog
          open={true} onClose={() => setOpenWa(false)}
          phone={client.phone}
          context={{ client }}
          defaultTemplate={(client.stamps ?? 0) >= 5 ? "premio_disponibile" : (inactive ?? 0) > 60 ? "cliente_inattivo" : "libero"}
        />
      )}
    </Sheet>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card rounded-lg p-2 text-center">
      <p className="text-[9px] uppercase text-muted-foreground">{label}</p>
      <p className="text-sm font-bold text-brand-green leading-tight">{value}</p>
    </div>
  );
}

function ClientSheet({ mode, onClose, onSave }: {
  mode: "new"; onClose: () => void; onSave: (c: Omit<Client, "id">) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [segment, setSegment] = useState<Segment>("nuovi");

  const save = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(), phone: phone.trim(), segment, stamps: 0,
      firstOrder: new Date().toISOString().slice(0, 10),
    });
  };
  void mode;

  return (
    <Sheet open={true} onClose={onClose} title="Nuovo cliente"
      footer={
        <button onClick={save} disabled={!name.trim()}
          className="w-full bg-brand-gold text-white rounded-xl px-6 py-3 font-semibold disabled:opacity-40">
          Crea cliente
        </button>
      }
    >
      <Field label="Nome e cognome">
        <input value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-card border border-border rounded-lg p-3" autoFocus />
      </Field>
      <Field label="Telefono">
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+39 333 ..." className="w-full bg-card border border-border rounded-lg p-3" />
      </Field>
      <Field label="Segmento iniziale">
        <select value={segment} onChange={(e) => setSegment(e.target.value as Segment)} className="w-full bg-card border border-border rounded-lg p-3">
          {(Object.keys(SEGMENT_META) as Segment[]).map((s) => <option key={s} value={s}>{SEGMENT_META[s].label}</option>)}
        </select>
      </Field>
    </Sheet>
  );
}
