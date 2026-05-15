// Helpers per produzione, freschi, invenduto, suggerimento quantità.
import {
  type Product, type FreshLog, type UnsoldEntry, type Order,
  type SpecialDay, type BusinessHours, weekdayKey, WEEKDAY_LABEL,
} from "./data";

const DAY_MS = 86_400_000;
const dayKey = (iso: string | Date) => new Date(iso).toISOString().slice(0, 10);

export function freshProducts(products: Product[]): Product[] {
  return products.filter((p) => p.fresh && p.active);
}

// ============= CALENDARIO =============

export function isClosedDay(date: Date | string, hours: BusinessHours, specials: SpecialDay[]): {
  closed: boolean; reason?: string;
} {
  const k = dayKey(date);
  const sp = specials.find((s) => s.date.slice(0, 10) === k);
  if (sp && sp.multiplier === 0) return { closed: true, reason: sp.name };
  const wk = weekdayKey(date);
  const h = hours[wk];
  if (h.closed) return { closed: true, reason: `${WEEKDAY_LABEL[wk]} chiuso` };
  return { closed: false };
}

export function specialDayFor(date: Date | string, specials: SpecialDay[]): SpecialDay | undefined {
  const k = dayKey(date);
  return specials.find((s) => s.date.slice(0, 10) === k);
}

// ============= INVENDUTO KPI =============

export function unsoldForDate(entries: UnsoldEntry[], date: Date | string): UnsoldEntry[] {
  const k = dayKey(date);
  return entries.filter((e) => dayKey(e.date) === k);
}

export function unsoldStatsForDate(entries: UnsoldEntry[], date: Date | string) {
  const list = unsoldForDate(entries, date);
  const valueLost = list.reduce((s, e) => s + (e.valueLost ?? 0), 0);
  const valueRecovered = list.reduce((s, e) => s + (e.valueRecovered ?? 0), 0);
  const tgtgBoxes = list.reduce((s, e) => s + (e.tgtgBoxes ?? 0), 0);
  const qty = list.reduce((s, e) => s + e.qty, 0);
  return { count: list.length, qty, valueLost, valueRecovered, tgtgBoxes };
}

export function topUnsoldProducts(entries: UnsoldEntry[], products: Product[], limit = 5) {
  const m = new Map<string, number>();
  for (const e of entries) m.set(e.productId, (m.get(e.productId) ?? 0) + e.qty);
  return [...m.entries()]
    .map(([id, qty]) => ({ product: products.find((p) => p.id === id), qty }))
    .filter((x) => x.product)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, limit) as { product: Product; qty: number }[];
}

// ============= REGISTRO GIORNALIERO =============

export function freshLogsForDate(logs: FreshLog[], date: Date | string): FreshLog[] {
  const k = dayKey(date);
  return logs.filter((l) => dayKey(l.date) === k);
}

export function freshLogFor(logs: FreshLog[], productId: string, date: Date | string): FreshLog | undefined {
  const k = dayKey(date);
  return logs.find((l) => l.productId === productId && dayKey(l.date) === k);
}

/** Giorni passati (rispetto a oggi) senza nessun log per prodotti freschi. */
export function missingLogDays(
  logs: FreshLog[], products: Product[], hours: BusinessHours, specials: SpecialDay[],
  lookbackDays = 7,
): string[] {
  const out: string[] = [];
  const fresh = freshProducts(products);
  if (fresh.length === 0) return out;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  for (let i = 1; i <= lookbackDays; i++) {
    const d = new Date(today.getTime() - i * DAY_MS);
    if (isClosedDay(d, hours, specials).closed) continue;
    const k = dayKey(d);
    const has = logs.some((l) => dayKey(l.date) === k);
    if (!has) out.push(k);
  }
  return out;
}

// ============= SUGGERIMENTO QUANTITÀ =============

export interface SuggestionInput {
  productId: string;
  date: Date | string;        // giorno target
  logs: FreshLog[];
  orders: Order[];
  unsold: UnsoldEntry[];
  specials: SpecialDay[];
}

export interface Suggestion {
  qty: number;
  reason: string;
  samples: { label: string; value: number }[];
  risk: "basso" | "medio" | "alto";
  bookedQty: number;
  multiplier: number;
}

/** Suggerisce la quantità da preparare per `date` per `productId`. */
export function suggestQuantity(input: SuggestionInput): Suggestion {
  const { productId, date, logs, orders, unsold, specials } = input;
  const target = new Date(date);
  const targetKey = dayKey(target);

  // 1) Storico stesso giorno settimana scorsa
  const lastWeek = new Date(target.getTime() - 7 * DAY_MS);
  const lastWeekLog = freshLogFor(logs, productId, lastWeek);
  const lastWeekSold = lastWeekLog ? lastWeekLog.qtySold + lastWeekLog.qtyRecovered : null;

  // 2) Media ultimi 7 giorni con vendite
  const weekLogs: FreshLog[] = [];
  for (let i = 1; i <= 14 && weekLogs.length < 7; i++) {
    const d = new Date(target.getTime() - i * DAY_MS);
    const fl = freshLogFor(logs, productId, d);
    if (fl) weekLogs.push(fl);
  }
  const avg7 = weekLogs.length
    ? weekLogs.reduce((s, l) => s + l.qtySold + l.qtyRecovered, 0) / weekLogs.length
    : null;

  // 3) Prenotazioni già presenti (ordini non annullati con pickupDate = target)
  const bookedQty = orders
    .filter((o) => o.status !== "annullato" && dayKey(o.pickupDate) === targetKey)
    .reduce((s, o) => s + o.items.filter((i) => i.productId === productId)
      .reduce((ss, i) => ss + i.qty, 0), 0);

  // 4) Invenduto medio
  const recentUnsold = unsold.filter((e) => {
    if (e.productId !== productId) return false;
    const diff = (target.getTime() - new Date(e.date).getTime()) / DAY_MS;
    return diff > 0 && diff <= 14;
  });
  const avgUnsold = recentUnsold.length
    ? recentUnsold.reduce((s, e) => s + e.qty, 0) / Math.min(7, recentUnsold.length)
    : 0;

  // 5) Moltiplicatore giorno speciale
  const sp = specialDayFor(target, specials);
  const multiplier = sp ? sp.multiplier : 1;

  const samples: { label: string; value: number }[] = [];
  if (lastWeekSold !== null) samples.push({ label: "Stessa settimana scorsa", value: +lastWeekSold.toFixed(1) });
  if (avg7 !== null) samples.push({ label: `Media ultimi ${weekLogs.length} giorni`, value: +avg7.toFixed(1) });
  if (bookedQty > 0) samples.push({ label: "Già prenotato", value: +bookedQty.toFixed(1) });
  if (avgUnsold > 0) samples.push({ label: "Invenduto medio", value: +avgUnsold.toFixed(1) });
  if (sp) samples.push({ label: `${sp.name} (×${multiplier})`, value: multiplier });

  // Base = max tra stesso giorno settimana scorsa e media 7g
  const base = Math.max(lastWeekSold ?? 0, avg7 ?? 0);
  // Riduci per invenduto medio (max 30% sconto), aggiungi prenotazioni, applica moltiplicatore
  const adjusted = (base - Math.min(avgUnsold, base * 0.3) + bookedQty) * multiplier;
  const qty = Math.max(bookedQty, +adjusted.toFixed(1));

  // Risk: basso se ho dati stessa settimana scorsa + media 7g; alto se nulla
  let risk: Suggestion["risk"] = "alto";
  if (lastWeekSold !== null && avg7 !== null) risk = "basso";
  else if (lastWeekSold !== null || avg7 !== null) risk = "medio";

  let reason = "Nessuno storico disponibile";
  if (lastWeekSold !== null && avg7 !== null) {
    reason = `Stessa settimana scorsa ${lastWeekSold.toFixed(1)}, media 7g ${avg7!.toFixed(1)}`;
  } else if (avg7 !== null) {
    reason = `Media ultimi ${weekLogs.length} giorni ${avg7!.toFixed(1)}`;
  } else if (lastWeekSold !== null) {
    reason = `Settimana scorsa ${lastWeekSold.toFixed(1)}`;
  }
  if (bookedQty > 0) reason += `, +${bookedQty.toFixed(1)} prenotati`;
  if (sp) reason += `, ${sp.name} ×${multiplier}`;

  return { qty, reason, samples, risk, bookedQty, multiplier };
}
