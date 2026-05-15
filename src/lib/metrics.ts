// Metriche derivate. Nessuno stato — sempre calcolato dai dati store.
import type {
  Client, Order, CasualSale, Product, Delivery, Bundle, Segment,
  Production, CashEntry, SupplierPayment, B2BClient,
} from "./data";

export const DAY = 86_400_000;
export const now = () => Date.now();

export function clientOrders(orders: Order[], clientId: string) {
  return orders.filter((o) => o.clientId === clientId && o.status === "ritirato");
}
export function clientSales(sales: CasualSale[], clientId: string) {
  return sales.filter((s) => s.clientId === clientId);
}

export function clientLTV(orders: Order[], sales: CasualSale[], clientId: string): number {
  return clientOrders(orders, clientId).reduce((s, o) => s + o.total, 0)
       + clientSales(sales, clientId).reduce((s, x) => s + x.total, 0);
}

export function clientOrderCount(orders: Order[], sales: CasualSale[], clientId: string): number {
  return clientOrders(orders, clientId).length + clientSales(sales, clientId).length;
}

export function clientAvgTicket(orders: Order[], sales: CasualSale[], clientId: string): number {
  const n = clientOrderCount(orders, sales, clientId);
  return n === 0 ? 0 : clientLTV(orders, sales, clientId) / n;
}

export function lastActivityIso(orders: Order[], sales: CasualSale[], client: Client): string | undefined {
  const dates: number[] = [];
  if (client.lastOrder) dates.push(+new Date(client.lastOrder));
  for (const o of clientOrders(orders, client.id)) dates.push(+new Date(o.pickupDate));
  for (const s of clientSales(sales, client.id)) dates.push(+new Date(s.date));
  if (!dates.length) return undefined;
  return new Date(Math.max(...dates)).toISOString();
}

export function daysInactive(orders: Order[], sales: CasualSale[], client: Client): number | null {
  const last = lastActivityIso(orders, sales, client);
  if (!last) return null;
  return Math.floor((now() - +new Date(last)) / DAY);
}

export function clientFrequencyPerMonth(orders: Order[], sales: CasualSale[], client: Client): number {
  const n = clientOrderCount(orders, sales, client.id);
  if (n === 0) return 0;
  const first = client.firstOrder ? +new Date(client.firstOrder) : now() - 30 * DAY;
  const months = Math.max(1, (now() - first) / (30 * DAY));
  return n / months;
}

export type AutoSegment = Segment;
export function suggestSegment(orders: Order[], sales: CasualSale[], client: Client): AutoSegment {
  const ltv = clientLTV(orders, sales, client.id);
  const inactive = daysInactive(orders, sales, client) ?? 9999;
  const freq = clientFrequencyPerMonth(orders, sales, client);
  const isNew = client.firstOrder ? (now() - +new Date(client.firstOrder)) < 60 * DAY : true;
  if (inactive > 60) return "inattivi";
  if (isNew) return "nuovi";
  if (ltv >= 300 || freq >= 4) return "top";
  if (freq >= 1.5) return "abituali";
  return "occasionali";
}

export function clientTopProducts(orders: Order[], sales: CasualSale[], products: Product[], clientId: string, limit = 5) {
  const map = new Map<string, number>();
  const add = (id: string, q: number) => map.set(id, (map.get(id) ?? 0) + q);
  for (const o of clientOrders(orders, clientId)) for (const i of o.items) add(i.productId, i.qty);
  for (const s of clientSales(sales, clientId)) for (const i of s.items) add(i.productId, i.qty);
  return [...map.entries()]
    .map(([id, qty]) => ({ product: products.find((p) => p.id === id), qty }))
    .filter((x) => x.product)
    .sort((a, b) => b.qty - a.qty).slice(0, limit);
}

export function productMargin(p: Product): { eur: number | null; pct: number | null } {
  if (p.cost == null || p.price === 0) return { eur: null, pct: null };
  const eur = p.price - p.cost;
  return { eur, pct: (eur / p.price) * 100 };
}

export function marginColor(pct: number | null): string {
  if (pct === null) return "text-muted-foreground";
  if (pct < 0) return "text-danger";
  if (pct < 15) return "text-danger";
  if (pct < 30) return "text-warning";
  return "text-success";
}

export function productSalesStats(orders: Order[], sales: CasualSale[], products: Product[]) {
  const map = new Map<string, { qty: number; revenue: number; profit: number }>();
  const add = (id: string, qty: number) => {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    const cur = map.get(id) ?? { qty: 0, revenue: 0, profit: 0 };
    cur.qty += qty;
    cur.revenue += p.price * qty;
    cur.profit += (p.cost == null ? 0 : (p.price - p.cost) * qty);
    map.set(id, cur);
  };
  for (const o of orders) if (o.status === "ritirato") for (const i of o.items) add(i.productId, i.qty);
  for (const s of sales) for (const i of s.items) add(i.productId, i.qty);
  return [...map.entries()].map(([id, v]) => ({ product: products.find((p) => p.id === id)!, ...v }))
    .filter((x) => x.product);
}

export function orderMargin(order: Order, products: Product[]): number {
  return order.items.reduce((s, i) => {
    const p = products.find((x) => x.id === i.productId);
    if (!p || p.cost == null) return s;
    return s + (p.price - p.cost) * i.qty;
  }, 0);
}

export function dailyMargin(orders: Order[], sales: CasualSale[], products: Product[]): number {
  const today = new Date().toDateString();
  const inDay = (iso: string) => new Date(iso).toDateString() === today;
  let m = 0;
  for (const o of orders) if (o.status === "ritirato" && inDay(o.pickupDate)) m += orderMargin(o, products);
  for (const s of sales) if (inDay(s.date)) m += orderMargin({ items: s.items } as Order, products);
  return m;
}

export function pendingPickupsToday(orders: Order[]): Order[] {
  const t = new Date().toDateString();
  return orders.filter((o) =>
    (o.status === "in_attesa" || o.status === "pronto") &&
    new Date(o.pickupDate).toDateString() === t,
  );
}

export function lateOrders(orders: Order[]): Order[] {
  const cut = now() - DAY; // più di 24h dopo la data ritiro
  return orders.filter((o) => o.status === "in_attesa" && +new Date(o.pickupDate) < cut);
}

export function inactiveClients(orders: Order[], sales: CasualSale[], clients: Client[], days = 60): Client[] {
  return clients.filter((c) => {
    const d = daysInactive(orders, sales, c);
    return d !== null && d > days;
  });
}

export function loyaltyReadyClients(clients: Client[]): Client[] {
  return clients.filter((c) => (c.stamps ?? 0) >= 5);
}

export function nearLoyaltyClients(clients: Client[]): Client[] {
  return clients.filter((c) => (c.stamps ?? 0) === 4);
}

export function openDeliveries(deliveries: Delivery[]): Delivery[] {
  return deliveries.filter((d) => d.status === "da_preparare" || d.status === "in_consegna");
}

export function clientBadges(orders: Order[], sales: CasualSale[], client: Client): string[] {
  const badges: string[] = [];
  const inactive = daysInactive(orders, sales, client);
  const ltv = clientLTV(orders, sales, client.id);
  if (inactive !== null && inactive <= 7) badges.push("caldo");
  if (inactive !== null && inactive > 60) badges.push("inattivo");
  if (ltv >= 500) badges.push("alto spendente");
  if ((client.stamps ?? 0) === 4) badges.push("vicino premio");
  if ((client.stamps ?? 0) >= 5) badges.push("premio pronto");
  return badges;
}

export function bundleStatsFromOrders(orders: Order[], _bundles: Bundle[]): Map<string, number> {
  // Placeholder: i bundle non sono tracciati nelle order items oggi. Si potrà estendere.
  void orders;
  return new Map();
}
