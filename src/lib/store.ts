import { useEffect, useState } from "react";
import {
  SEED_PRODUCTS, SEED_CLIENTS, SEED_ORDERS, SEED_BUNDLES, SEED_CASUAL_SALES, SEED_DELIVERIES,
  SEED_PRODUCTIONS, SEED_SUPPLIERS, SEED_CASH_ENTRIES, SEED_B2B_CLIENTS, SEED_SUPPLIER_PAYMENTS,
  SEED_FRESH_LOGS, SEED_UNSOLD_ENTRIES, SEED_SPECIAL_DAYS, DEFAULT_BUSINESS_HOURS,
  SEED_GOODS_RECEIPTS, SEED_FIXED_COSTS, SEED_ONLINE_ORDERS, SEED_SHIPMENTS,
  SEED_LOTS, SEED_HACCP_READINGS, SEED_CLEANING_TASKS,
  type Product, type Client, type Order, type Bundle, type CasualSale, type Delivery,
  type OrderEvent, type LoyaltyEvent,
  type Production, type Supplier, type CashEntry, type B2BClient, type SupplierPayment,
  type FreshLog, type UnsoldEntry, type SpecialDay, type BusinessHours,
  type GoodsReceipt, type FixedCost, type OnlineOrder, type Shipment,
  type Lot, type HaccpReading, type CleaningTask,
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
  freshLogs: FreshLog[];
  unsoldEntries: UnsoldEntry[];
  specialDays: SpecialDay[];
  businessHours: BusinessHours;
  goodsReceipts: GoodsReceipt[];
  fixedCosts: FixedCost[];
  onlineOrders: OnlineOrder[];
  shipments: Shipment[];
  lots: Lot[];
  haccpReadings: HaccpReading[];
  cleaningTasks: CleaningTask[];
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
  freshLogs: SEED_FRESH_LOGS,
  unsoldEntries: SEED_UNSOLD_ENTRIES,
  specialDays: SEED_SPECIAL_DAYS,
  businessHours: DEFAULT_BUSINESS_HOURS,
  goodsReceipts: SEED_GOODS_RECEIPTS,
  fixedCosts: SEED_FIXED_COSTS,
  onlineOrders: SEED_ONLINE_ORDERS,
  shipments: SEED_SHIPMENTS,
  lots: SEED_LOTS,
  haccpReadings: SEED_HACCP_READINGS,
  cleaningTasks: SEED_CLEANING_TASKS,
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
    freshLogs: parsed.freshLogs ?? [],
    unsoldEntries: parsed.unsoldEntries ?? [],
    specialDays: parsed.specialDays ?? SEED.specialDays,
    businessHours: parsed.businessHours ?? SEED.businessHours,
    goodsReceipts: parsed.goodsReceipts ?? SEED.goodsReceipts,
    fixedCosts: parsed.fixedCosts ?? SEED.fixedCosts,
    onlineOrders: parsed.onlineOrders ?? SEED.onlineOrders,
    shipments: parsed.shipments ?? SEED.shipments,
    lots: parsed.lots ?? SEED.lots,
    haccpReadings: parsed.haccpReadings ?? SEED.haccpReadings,
    cleaningTasks: parsed.cleaningTasks ?? SEED.cleaningTasks,
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

function applyReceiptStock(store: Store, rec: GoodsReceipt, sign: 1 | -1): Store {
  const deltaBy = new Map<string, number>();
  for (const it of rec.items) {
    deltaBy.set(it.productId, (deltaBy.get(it.productId) ?? 0) + sign * it.qty);
  }
  return {
    ...store,
    products: store.products.map((p) => {
      const d = deltaBy.get(p.id);
      if (!d) return p;
      const cur = p.stock ?? 0;
      const nextStock = Math.max(0, +(cur + d).toFixed(3));
      return {
        ...p,
        stock: nextStock,
        supplierId: sign > 0 ? rec.supplierId : p.supplierId,
        lastRestock: sign > 0 ? rec.date : p.lastRestock,
      };
    }),
  };
}

function applyOnlineOrderStock(store: Store, o: OnlineOrder, sign: 1 | -1): Store {
  const deltaBy = new Map<string, number>();
  for (const it of o.items) {
    if (!it.productId) continue;
    deltaBy.set(it.productId, (deltaBy.get(it.productId) ?? 0) + sign * it.qty);
  }
  if (deltaBy.size === 0) return store;
  return {
    ...store,
    products: store.products.map((p) => {
      const d = deltaBy.get(p.id);
      if (!d || p.stock === undefined) return p;
      return { ...p, stock: Math.max(0, +(p.stock + d).toFixed(3)) };
    }),
  };
}

export function useStore() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((t) => t + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  // Auto CRM (segmentazione automatica) — gira una volta per sessione, dopo il caricamento.
  useEffect(() => {
    if (crmAutoRan) return;
    crmAutoRan = true;
    // Lazy import per evitare cicli
    Promise.resolve().then(async () => {
      const { recomputeSegments } = await import("./metrics");
      const { loadCrmSettings } = await import("./crm-settings");
      const cur = getStore();
      const changes = recomputeSegments(cur.clients, cur.orders, cur.casualSales, loadCrmSettings());
      if (changes.length === 0) return;
      const byId = new Map(changes.map((c) => [c.clientId, c] as const));
      setStore({
        ...cur,
        clients: cur.clients.map((c) => {
          const ch = byId.get(c.id);
          if (!ch) return c;
          return {
            ...c,
            segment: ch.to,
            loyaltyHistory: [...(c.loyaltyHistory ?? []), ch.event],
          };
        }),
      });
    });
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
      const orderId = uid("o_");
      let deliveryId: string | undefined = o.deliveryId;
      let nextDeliveries = store.deliveries;
      // Sync: ordine con consegna a domicilio → crea anche Delivery
      if (o.delivery === "domicilio" && !deliveryId) {
        deliveryId = uid("d_");
        const client = store.clients.find(c => c.id === o.clientId);
        const del: Delivery = {
          id: deliveryId, clientId: o.clientId,
          address: o.address || client?.deliveryZone || "",
          date: o.pickupDate,
          timeSlot: "—",
          status: o.status === "consegnato" ? "consegnata"
                : o.status === "annullato" ? "annullata"
                : o.status === "da_consegnare" ? "in_consegna"
                : "da_preparare",
          payment: o.payment ?? "da_pagare",
          orderId, notes: o.notes,
          createdAt: nowIso(),
        };
        nextDeliveries = [del, ...store.deliveries];
      }
      const order: Order = {
        ...o, id: orderId, createdAt: nowIso(), deliveryId,
        timeline: [{ date: nowIso(), type: "creato" }],
        source: o.source ?? "negozio",
      };
      let next: Store = { ...store, orders: [order, ...store.orders], deliveries: nextDeliveries };
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
      let nextDeliveries = store.deliveries;
      // Sync verso Delivery collegata
      if (merged.deliveryId) {
        nextDeliveries = nextDeliveries.map(d => {
          if (d.id !== merged.deliveryId) return d;
          const dPatch: Partial<Delivery> = {};
          if (patch.status) {
            dPatch.status = merged.status === "consegnato" ? "consegnata"
              : merged.status === "annullato" ? "annullata"
              : merged.status === "da_consegnare" ? "in_consegna"
              : "da_preparare";
          }
          if (patch.address !== undefined) dPatch.address = merged.address || d.address;
          if (patch.payment !== undefined && merged.payment) dPatch.payment = merged.payment;
          if (patch.pickupDate) dPatch.date = merged.pickupDate;
          if (patch.notes !== undefined) dPatch.notes = merged.notes;
          return { ...d, ...dPatch };
        });
      }
      let next: Store = { ...store, orders: store.orders.map((o) => o.id === id ? merged : o), deliveries: nextDeliveries };
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
        deliveryId: undefined,
        timeline: [{ date: nowIso(), type: "creato", note: `Duplicato da ${o.id}` }],
      };
      setStore({ ...store, orders: [dup, ...store.orders] });
      return dup;
    },
    deleteOrder: (id: string) => {
      const o = store.orders.find(x => x.id === id);
      const nextDeliveries = o?.deliveryId
        ? store.deliveries.filter(d => d.id !== o.deliveryId)
        : store.deliveries;
      setStore({ ...store, orders: store.orders.filter((x) => x.id !== id), deliveries: nextDeliveries });
    },


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

    // FRESH LOGS
    addFreshLog: (l: Omit<FreshLog, "id">) => {
      const log: FreshLog = { ...l, id: uid("fl_") };
      setStore({ ...store, freshLogs: [log, ...store.freshLogs] });
      return log;
    },
    updateFreshLog: (id: string, patch: Partial<FreshLog>) =>
      setStore({ ...store, freshLogs: store.freshLogs.map((l) => l.id === id ? { ...l, ...patch } : l) }),
    deleteFreshLog: (id: string) =>
      setStore({ ...store, freshLogs: store.freshLogs.filter((l) => l.id !== id) }),

    // UNSOLD ENTRIES
    addUnsoldEntry: (u: Omit<UnsoldEntry, "id">) => {
      const e: UnsoldEntry = { ...u, id: uid("un_") };
      setStore({ ...store, unsoldEntries: [e, ...store.unsoldEntries] });
      return e;
    },
    updateUnsoldEntry: (id: string, patch: Partial<UnsoldEntry>) =>
      setStore({ ...store, unsoldEntries: store.unsoldEntries.map((e) => e.id === id ? { ...e, ...patch } : e) }),
    deleteUnsoldEntry: (id: string) =>
      setStore({ ...store, unsoldEntries: store.unsoldEntries.filter((e) => e.id !== id) }),

    // SPECIAL DAYS
    addSpecialDay: (s: Omit<SpecialDay, "id">) => {
      const d: SpecialDay = { ...s, id: uid("sd_") };
      setStore({ ...store, specialDays: [d, ...store.specialDays] });
      return d;
    },
    updateSpecialDay: (id: string, patch: Partial<SpecialDay>) =>
      setStore({ ...store, specialDays: store.specialDays.map((s) => s.id === id ? { ...s, ...patch } : s) }),
    deleteSpecialDay: (id: string) =>
      setStore({ ...store, specialDays: store.specialDays.filter((s) => s.id !== id) }),

    // BUSINESS HOURS
    setBusinessHours: (h: BusinessHours) => setStore({ ...store, businessHours: h }),

    // GOODS RECEIPTS
    addGoodsReceipt: (r: Omit<GoodsReceipt, "id" | "createdAt">) => {
      const rec: GoodsReceipt = { ...r, id: uid("gr_"), createdAt: nowIso() };
      let next: Store = { ...store, goodsReceipts: [rec, ...store.goodsReceipts] };
      // Aggiorna stock prodotti se ricevuta/verificata/archiviata
      if (rec.status !== "attesa") next = applyReceiptStock(next, rec, +1);
      // Aggiorna lastOrderDate fornitore
      next = {
        ...next,
        suppliers: next.suppliers.map((s) =>
          s.id === rec.supplierId ? { ...s, lastOrderDate: rec.date } : s),
      };
      setStore(next);
      return rec;
    },
    updateGoodsReceipt: (id: string, patch: Partial<GoodsReceipt>) => {
      const prev = store.goodsReceipts.find((g) => g.id === id);
      if (!prev) return;
      const merged: GoodsReceipt = { ...prev, ...patch };
      let next: Store = { ...store, goodsReceipts: store.goodsReceipts.map((g) => g.id === id ? merged : g) };
      const wasReceived = prev.status !== "attesa";
      const isReceived = merged.status !== "attesa";
      if (!wasReceived && isReceived) next = applyReceiptStock(next, merged, +1);
      else if (wasReceived && !isReceived) next = applyReceiptStock(next, prev, -1);
      setStore(next);
    },
    deleteGoodsReceipt: (id: string) => {
      const prev = store.goodsReceipts.find((g) => g.id === id);
      if (!prev) return;
      let next: Store = { ...store, goodsReceipts: store.goodsReceipts.filter((g) => g.id !== id) };
      if (prev.status !== "attesa") next = applyReceiptStock(next, prev, -1);
      setStore(next);
    },

    // FIXED COSTS
    addFixedCost: (f: Omit<FixedCost, "id">) => {
      const fc: FixedCost = { ...f, id: uid("fc_") };
      setStore({ ...store, fixedCosts: [fc, ...store.fixedCosts] });
      return fc;
    },
    updateFixedCost: (id: string, patch: Partial<FixedCost>) =>
      setStore({ ...store, fixedCosts: store.fixedCosts.map((f) => f.id === id ? { ...f, ...patch } : f) }),
    deleteFixedCost: (id: string) =>
      setStore({ ...store, fixedCosts: store.fixedCosts.filter((f) => f.id !== id) }),

    // ONLINE ORDERS
    addOnlineOrder: (o: Omit<OnlineOrder, "id" | "createdAt">) => {
      const order: OnlineOrder = { ...o, id: uid("eo_"), createdAt: nowIso() };
      let next: Store = { ...store, onlineOrders: [order, ...store.onlineOrders] };
      if (order.status === "spedito" || order.status === "consegnato") {
        next = applyOnlineOrderStock(next, order, -1);
      }
      setStore(next);
      return order;
    },
    addOnlineOrders: (orders: Omit<OnlineOrder, "id" | "createdAt">[]) => {
      const made: OnlineOrder[] = orders.map((o) => ({ ...o, id: uid("eo_"), createdAt: nowIso() }));
      let next: Store = { ...store, onlineOrders: [...made, ...store.onlineOrders] };
      for (const o of made) {
        if (o.status === "spedito" || o.status === "consegnato") next = applyOnlineOrderStock(next, o, -1);
      }
      setStore(next);
      return made;
    },
    updateOnlineOrder: (id: string, patch: Partial<OnlineOrder>) => {
      const prev = store.onlineOrders.find((o) => o.id === id);
      if (!prev) return;
      const merged: OnlineOrder = { ...prev, ...patch };
      let next: Store = { ...store, onlineOrders: store.onlineOrders.map((o) => o.id === id ? merged : o) };
      const wasOut = prev.status === "spedito" || prev.status === "consegnato";
      const isOut = merged.status === "spedito" || merged.status === "consegnato";
      if (!wasOut && isOut) next = applyOnlineOrderStock(next, merged, -1);
      else if (wasOut && !isOut) next = applyOnlineOrderStock(next, prev, +1);
      setStore(next);
    },
    deleteOnlineOrder: (id: string) => {
      const prev = store.onlineOrders.find((o) => o.id === id);
      if (!prev) return;
      let next: Store = {
        ...store,
        onlineOrders: store.onlineOrders.filter((o) => o.id !== id),
        shipments: store.shipments.filter((sh) => sh.orderId !== id),
      };
      if (prev.status === "spedito" || prev.status === "consegnato") {
        next = applyOnlineOrderStock(next, prev, +1);
      }
      setStore(next);
    },

    // SHIPMENTS
    addShipment: (sh: Omit<Shipment, "id" | "createdAt">) => {
      const s: Shipment = { ...sh, id: uid("sh_"), createdAt: nowIso() };
      setStore({ ...store, shipments: [s, ...store.shipments] });
      return s;
    },
    updateShipment: (id: string, patch: Partial<Shipment>) =>
      setStore({ ...store, shipments: store.shipments.map((s) => s.id === id ? { ...s, ...patch } : s) }),
    deleteShipment: (id: string) =>
      setStore({ ...store, shipments: store.shipments.filter((s) => s.id !== id) }),

    // LOTS
    addLot: (l: Omit<Lot, "id" | "createdAt">) => {
      const lot: Lot = { ...l, id: uid("lt_"), createdAt: nowIso() };
      setStore({ ...store, lots: [lot, ...store.lots] });
      return lot;
    },
    updateLot: (id: string, patch: Partial<Lot>) =>
      setStore({ ...store, lots: store.lots.map((l) => l.id === id ? { ...l, ...patch } : l) }),
    deleteLot: (id: string) =>
      setStore({ ...store, lots: store.lots.filter((l) => l.id !== id) }),
    consumeLot: (id: string, qty: number) =>
      setStore({ ...store, lots: store.lots.map((l) =>
        l.id === id ? { ...l, qtyRemaining: Math.max(0, +(l.qtyRemaining - qty).toFixed(3)) } : l) }),

    // HACCP READINGS
    addHaccpReading: (r: Omit<HaccpReading, "id">) => {
      const reading: HaccpReading = { ...r, id: uid("hr_") };
      setStore({ ...store, haccpReadings: [reading, ...store.haccpReadings] });
      return reading;
    },
    updateHaccpReading: (id: string, patch: Partial<HaccpReading>) =>
      setStore({ ...store, haccpReadings: store.haccpReadings.map((r) => r.id === id ? { ...r, ...patch } : r) }),
    deleteHaccpReading: (id: string) =>
      setStore({ ...store, haccpReadings: store.haccpReadings.filter((r) => r.id !== id) }),

    // CLEANING TASKS
    addCleaningTask: (t: Omit<CleaningTask, "id">) => {
      const task: CleaningTask = { ...t, id: uid("cl_") };
      setStore({ ...store, cleaningTasks: [task, ...store.cleaningTasks] });
      return task;
    },
    updateCleaningTask: (id: string, patch: Partial<CleaningTask>) =>
      setStore({ ...store, cleaningTasks: store.cleaningTasks.map((t) => t.id === id ? { ...t, ...patch } : t) }),
    deleteCleaningTask: (id: string) =>
      setStore({ ...store, cleaningTasks: store.cleaningTasks.filter((t) => t.id !== id) }),

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
          goodsReceipts: store.goodsReceipts.length,
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

    // CRM
    runCrmAuto: async () => {
      const { recomputeSegments } = await import("./metrics");
      const { loadCrmSettings } = await import("./crm-settings");
      const cur = getStore();
      const changes = recomputeSegments(cur.clients, cur.orders, cur.casualSales, loadCrmSettings());
      if (changes.length === 0) return 0;
      const byId = new Map(changes.map((c) => [c.clientId, c] as const));
      setStore({
        ...cur,
        clients: cur.clients.map((c) => {
          const ch = byId.get(c.id);
          if (!ch) return c;
          return { ...c, segment: ch.to, loyaltyHistory: [...(c.loyaltyHistory ?? []), ch.event] };
        }),
      });
      return changes.length;
    },
    logClientEvent: (clientId: string, type: LoyaltyEvent["type"], note?: string) => {
      setStore({
        ...store,
        clients: store.clients.map((c) => c.id === clientId
          ? { ...c, loyaltyHistory: [...(c.loyaltyHistory ?? []), { date: nowIso(), type, note }] }
          : c),
      });
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
