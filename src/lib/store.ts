import { useEffect, useState } from "react";
import {
  SEED_PRODUCTS, SEED_CLIENTS, SEED_ORDERS, SEED_BUNDLES, SEED_CASUAL_SALES, SEED_DELIVERIES,
  SEED_PRODUCTIONS, SEED_SUPPLIERS, SEED_CASH_ENTRIES, SEED_B2B_CLIENTS, SEED_SUPPLIER_PAYMENTS,
  type Product, type Client, type Order, type Bundle, type CasualSale, type Delivery,
  type OrderEvent, type LoyaltyEvent,
  type Production, type Supplier, type CashEntry, type B2BClient, type SupplierPayment,
} from "./data";

const KEY = "sciorio-hq-v4";
const LEGACY_V3 = "sciorio-hq-v3";
const LEGACY_KEY = "sciorio-hq-v2";
const PIN_KEY = "sciorio-hq-auth";
const PIN_VALUE_KEY = "sciorio-hq-pin";
const DEFAULT_PIN = "0000";

interface Store {
  products: Product[];
  clients: Client[];
  orders: Order[];
  bundles: Bundle[];
  casualSales: CasualSale[];
  deliveries: Delivery[];
  productions: Production[];
  suppliers: Supplier[];
  cashEntries: CashEntry[];
  b2bClients: B2BClient[];
  supplierPayments: SupplierPayment[];
}

const SEED: Store = {
  products: SEED_PRODUCTS,
  clients: SEED_CLIENTS,
  orders: SEED_ORDERS,
  bundles: SEED_BUNDLES,
  casualSales: SEED_CASUAL_SALES,
  deliveries: SEED_DELIVERIES,
  productions: SEED_PRODUCTIONS,
  suppliers: SEED_SUPPLIERS,
  cashEntries: SEED_CASH_ENTRIES,
  b2bClients: SEED_B2B_CLIENTS,
  supplierPayments: SEED_SUPPLIER_PAYMENTS,
};

function migrate(parsed: any): Store {
  const out: Store = {
    products: (parsed.products ?? SEED.products).map((p: Product) => ({
      available: true, seasonal: false, magnet: false, ...p,
    })),
    clients: (parsed.clients ?? SEED.clients).map((c: Client) => ({
      ...c,
      loyaltyHistory: c.loyaltyHistory ?? [],
      tags: c.tags ?? [],
      preferredProducts: c.preferredProducts ?? [],
    })),
    orders: (parsed.orders ?? SEED.orders).map((o: Order) => ({
      ...o,
      source: o.source ?? "negozio",
      timeline: o.timeline ?? [{ date: o.createdAt, type: "creato" }],
    })),
    bundles: parsed.bundles ?? SEED.bundles,
    casualSales: parsed.casualSales ?? SEED.casualSales,
    deliveries: parsed.deliveries ?? SEED.deliveries,
    productions: parsed.productions ?? SEED.productions,
    suppliers: parsed.suppliers ?? SEED.suppliers,
    cashEntries: parsed.cashEntries ?? SEED.cashEntries,
    b2bClients: parsed.b2bClients ?? SEED.b2bClients,
    supplierPayments: parsed.supplierPayments ?? SEED.supplierPayments,
  };
  return out;
}

function load(): Store {
  if (typeof window === "undefined") return SEED;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrate(JSON.parse(raw));
    const v3 = localStorage.getItem(LEGACY_V3);
    if (v3) {
      const m = migrate(JSON.parse(v3));
      localStorage.setItem(KEY, JSON.stringify(m));
      return m;
    }
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const m = migrate(JSON.parse(legacy));
      localStorage.setItem(KEY, JSON.stringify(m));
      return m;
    }
  } catch {}
  localStorage.setItem(KEY, JSON.stringify(SEED));
  return SEED;
}

const listeners = new Set<() => void>();
let cache: Store | null = null;

function getStore(): Store {
  if (!cache) cache = load();
  return cache;
}

function setStore(next: Store) {
  cache = next;
  if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(next));
  listeners.forEach((l) => l());
}

const uid = (prefix: string) => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const nowIso = () => new Date().toISOString();

let crmAutoRan = false;

function applyOrderRitirato(store: Store, order: Order): Store {
  // aggiorna stamps cliente, lastOrder, loyaltyHistory
  const clients = store.clients.map((c) => {
    if (c.id !== order.clientId) return c;
    const newStamps = Math.min(5, (c.stamps ?? 0) + 1);
    const hist: LoyaltyEvent[] = [...(c.loyaltyHistory ?? []), {
      date: nowIso(), type: "stamp", delta: 1, note: `Ordine ${order.id}`,
    }];
    return {
      ...c,
      stamps: newStamps,
      lastOrder: order.pickupDate,
      loyaltyHistory: hist,
    };
  });
  return { ...store, clients };
}

export function useStore() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((t) => t + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  const store = getStore();
  return {
    ...store,

    // PRODUCTS
    addProduct: (p: Omit<Product, "id">) => {
      const id = uid("p_");
      setStore({ ...store, products: [{ ...p, id }, ...store.products] });
    },
    updateProduct: (id: string, patch: Partial<Product>) => {
      setStore({
        ...store,
        products: store.products.map((p) => {
          if (p.id !== id) return p;
          // priceHistory automatico
          let history = p.priceHistory ?? [];
          if ((patch.price !== undefined && patch.price !== p.price) ||
              (patch.cost !== undefined && patch.cost !== p.cost)) {
            history = [...history, { date: nowIso(), cost: p.cost, price: p.price }];
          }
          return { ...p, ...patch, priceHistory: history };
        }),
      });
    },
    deleteProduct: (id: string) =>
      setStore({ ...store, products: store.products.filter((p) => p.id !== id) }),

    // ORDERS
    addOrder: (o: Omit<Order, "id" | "createdAt">) => {
      const order: Order = {
        ...o, id: uid("o_"), createdAt: nowIso(),
        timeline: [{ date: nowIso(), type: "creato" }],
        source: o.source ?? "negozio",
      };
      let next: Store = { ...store, orders: [order, ...store.orders] };
      if (order.status === "ritirato") next = applyOrderRitirato(next, order);
      setStore(next);
      return order;
    },
    updateOrder: (id: string, patch: Partial<Order>) => {
      const prev = store.orders.find((o) => o.id === id);
      if (!prev) return;
      const willBecomeRitirato = patch.status === "ritirato" && prev.status !== "ritirato";
      const tl = [...(prev.timeline ?? [])];
      if (patch.status && patch.status !== prev.status) {
        tl.push({ date: nowIso(), type: patch.status as OrderEvent["type"] });
      } else {
        tl.push({ date: nowIso(), type: "modificato" });
      }
      const merged: Order = { ...prev, ...patch, timeline: tl };
      let next: Store = { ...store, orders: store.orders.map((o) => o.id === id ? merged : o) };
      if (willBecomeRitirato) next = applyOrderRitirato(next, merged);
      setStore(next);
    },
    duplicateOrder: (id: string) => {
      const o = store.orders.find((x) => x.id === id);
      if (!o) return null;
      const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(10, 0, 0, 0);
      const dup: Order = {
        ...o, id: uid("o_"), createdAt: nowIso(),
        pickupDate: d.toISOString(), status: "in_attesa",
        timeline: [{ date: nowIso(), type: "creato", note: `Duplicato da ${o.id}` }],
      };
      setStore({ ...store, orders: [dup, ...store.orders] });
      return dup;
    },
    deleteOrder: (id: string) =>
      setStore({ ...store, orders: store.orders.filter((o) => o.id !== id) }),

    // BUNDLES
    addBundle: (b: Omit<Bundle, "id">) => {
      setStore({ ...store, bundles: [{ ...b, id: uid("b_") }, ...store.bundles] });
    },
    updateBundle: (id: string, patch: Partial<Bundle>) =>
      setStore({ ...store, bundles: store.bundles.map((b) => b.id === id ? { ...b, ...patch } : b) }),
    deleteBundle: (id: string) =>
      setStore({ ...store, bundles: store.bundles.filter((b) => b.id !== id) }),

    // CLIENTS
    addClient: (c: Omit<Client, "id">) => {
      const client: Client = { ...c, id: uid("c_"), loyaltyHistory: [] };
      setStore({ ...store, clients: [client, ...store.clients] });
      return client;
    },
    updateClient: (id: string, patch: Partial<Client>) =>
      setStore({ ...store, clients: store.clients.map((c) => c.id === id ? { ...c, ...patch } : c) }),
    deleteClient: (id: string) =>
      setStore({ ...store, clients: store.clients.filter((c) => c.id !== id) }),

    // LOYALTY
    addLoyaltyEvent: (clientId: string, ev: Omit<LoyaltyEvent, "date"> & { date?: string }) => {
      setStore({
        ...store,
        clients: store.clients.map((c) => {
          if (c.id !== clientId) return c;
          const event: LoyaltyEvent = { date: ev.date ?? nowIso(), type: ev.type, delta: ev.delta, note: ev.note };
          let stamps = c.stamps ?? 0;
          if (ev.type === "stamp") stamps = Math.min(5, stamps + (ev.delta ?? 1));
          if (ev.type === "reset") stamps = 0;
          if (ev.type === "reward") stamps = 0;
          if (ev.type === "manual" && typeof ev.delta === "number") stamps = Math.max(0, Math.min(5, stamps + ev.delta));
          return { ...c, stamps, loyaltyHistory: [...(c.loyaltyHistory ?? []), event] };
        }),
      });
    },
    setLoyaltyStamps: (clientId: string, value: number) => {
      setStore({
        ...store,
        clients: store.clients.map((c) => c.id === clientId
          ? { ...c, stamps: Math.max(0, Math.min(5, value)),
              loyaltyHistory: [...(c.loyaltyHistory ?? []), { date: nowIso(), type: "manual" as const, note: `Impostato a ${value}` }] }
          : c),
      });
    },

    // CASUAL SALES
    addCasualSale: (s: Omit<CasualSale, "id">) => {
      const sale: CasualSale = { ...s, id: uid("s_") };
      setStore({ ...store, casualSales: [sale, ...store.casualSales] });
      return sale;
    },
    deleteCasualSale: (id: string) =>
      setStore({ ...store, casualSales: store.casualSales.filter((s) => s.id !== id) }),

    // DELIVERIES
    addDelivery: (d: Omit<Delivery, "id" | "createdAt">) => {
      const del: Delivery = { ...d, id: uid("d_"), createdAt: nowIso() };
      setStore({ ...store, deliveries: [del, ...store.deliveries] });
      return del;
    },
    updateDelivery: (id: string, patch: Partial<Delivery>) =>
      setStore({ ...store, deliveries: store.deliveries.map((d) => d.id === id ? { ...d, ...patch } : d) }),
    deleteDelivery: (id: string) =>
      setStore({ ...store, deliveries: store.deliveries.filter((d) => d.id !== id) }),

    // PRODUCTIONS
    addProduction: (p: Omit<Production, "id">) => {
      const prod: Production = { ...p, id: uid("pr_") };
      setStore({ ...store, productions: [prod, ...store.productions] });
      return prod;
    },
    updateProduction: (id: string, patch: Partial<Production>) =>
      setStore({ ...store, productions: store.productions.map((p) => p.id === id ? { ...p, ...patch } : p) }),
    deleteProduction: (id: string) =>
      setStore({ ...store, productions: store.productions.filter((p) => p.id !== id) }),

    // SUPPLIERS
    addSupplier: (s: Omit<Supplier, "id">) => {
      const sup: Supplier = { ...s, id: uid("sup_") };
      setStore({ ...store, suppliers: [sup, ...store.suppliers] });
      return sup;
    },
    updateSupplier: (id: string, patch: Partial<Supplier>) =>
      setStore({ ...store, suppliers: store.suppliers.map((s) => s.id === id ? { ...s, ...patch } : s) }),
    deleteSupplier: (id: string) =>
      setStore({ ...store, suppliers: store.suppliers.filter((s) => s.id !== id) }),

    // CASH ENTRIES
    addCashEntry: (e: Omit<CashEntry, "id">) => {
      const entry: CashEntry = { ...e, id: uid("ce_") };
      setStore({ ...store, cashEntries: [entry, ...store.cashEntries] });
      return entry;
    },
    updateCashEntry: (id: string, patch: Partial<CashEntry>) =>
      setStore({ ...store, cashEntries: store.cashEntries.map((e) => e.id === id ? { ...e, ...patch } : e) }),
    deleteCashEntry: (id: string) =>
      setStore({ ...store, cashEntries: store.cashEntries.filter((e) => e.id !== id) }),

    // B2B
    addB2BClient: (c: Omit<B2BClient, "id">) => {
      const cli: B2BClient = { ...c, id: uid("b2b_") };
      setStore({ ...store, b2bClients: [cli, ...store.b2bClients] });
      return cli;
    },
    updateB2BClient: (id: string, patch: Partial<B2BClient>) =>
      setStore({ ...store, b2bClients: store.b2bClients.map((c) => c.id === id ? { ...c, ...patch } : c) }),
    deleteB2BClient: (id: string) =>
      setStore({ ...store, b2bClients: store.b2bClients.filter((c) => c.id !== id) }),

    // SUPPLIER PAYMENTS
    addSupplierPayment: (p: Omit<SupplierPayment, "id">) => {
      const pay: SupplierPayment = { ...p, id: uid("sp_") };
      setStore({ ...store, supplierPayments: [pay, ...store.supplierPayments] });
      return pay;
    },
    updateSupplierPayment: (id: string, patch: Partial<SupplierPayment>) =>
      setStore({ ...store, supplierPayments: store.supplierPayments.map((p) => p.id === id ? { ...p, ...patch } : p) }),
    deleteSupplierPayment: (id: string) =>
      setStore({ ...store, supplierPayments: store.supplierPayments.filter((p) => p.id !== id) }),

    // BACKUP
    exportJson: () => JSON.stringify(store, null, 2),
    importJson: (text: string) => {
      const parsed = JSON.parse(text);
      const next = migrate(parsed);
      setStore(next);
    },
    storageInfo: () => {
      let bytes = 0;
      if (typeof window !== "undefined") {
        bytes = new Blob([localStorage.getItem(KEY) ?? ""]).size;
      }
      return {
        bytes,
        kb: +(bytes / 1024).toFixed(1),
        counts: {
          products: store.products.length,
          clients: store.clients.length,
          orders: store.orders.length,
          bundles: store.bundles.length,
          casualSales: store.casualSales.length,
          deliveries: store.deliveries.length,
          productions: store.productions.length,
          suppliers: store.suppliers.length,
          cashEntries: store.cashEntries.length,
          b2bClients: store.b2bClients.length,
          supplierPayments: store.supplierPayments.length,
        },
      };
    },

    reset: () => {
      if (typeof window !== "undefined") {
        localStorage.removeItem(KEY);
        localStorage.removeItem(LEGACY_V3);
        localStorage.removeItem(LEGACY_KEY);
      }
      cache = null;
      setStore(load());
    },
  };
}

export function getPin(): string {
  if (typeof window === "undefined") return DEFAULT_PIN;
  return localStorage.getItem(PIN_VALUE_KEY) ?? DEFAULT_PIN;
}

export function setPin(newPin: string) {
  if (typeof window === "undefined") return;
  if (!/^\d{4}$/.test(newPin)) throw new Error("Il PIN deve essere di 4 cifre");
  localStorage.setItem(PIN_VALUE_KEY, newPin);
}

export function useAuth() {
  const [authed, setAuthed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(PIN_KEY) === "1";
  });
  return {
    authed,
    login: (pin: string) => {
      if (pin === getPin()) {
        localStorage.setItem(PIN_KEY, "1");
        setAuthed(true);
        return true;
      }
      return false;
    },
    logout: () => { localStorage.removeItem(PIN_KEY); setAuthed(false); },
  };
}
