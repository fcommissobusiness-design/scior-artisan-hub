// Seed data and types for Sciorio HQ
export type Segment = "top" | "abituali" | "occasionali" | "nuovi" | "inattivi";
export type ProductCategory =
  | "Freschi di Bufala"
  | "Freschi di Pecora"
  | "Formaggi Stagionati"
  | "Salumi"
  | "Dispensa"
  | "Pane"
  | "Latte"
  | "Bevande"
  | "Vini";

export interface PriceChange {
  date: string; // ISO
  cost: number | null;
  price: number;
}

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  cost: number | null;
  price: number;
  unit: "kg" | "pz";
  active: boolean;
  badge?: "DOP" | "IGP" | "DOC" | "DOCG" | "BIO";
  notes?: string;
  available?: boolean;     // disponibilità reale a scaffale
  seasonal?: boolean;
  magnet?: boolean;        // prodotto magnete / civetta
  priceHistory?: PriceChange[];
  // magazzino
  stock?: number;
  stockMin?: number;
  supplierId?: string;
  lastRestock?: string;
  // freschi / invenduto
  fresh?: boolean;                         // prodotto fresco/deperibile
  shelfLifeDays?: number;                  // durata stimata in giorni
  perishability?: "bassa" | "media" | "alta";
  trackUnsold?: boolean;                   // gestire invenduto sì/no
}

export interface LoyaltyEvent {
  date: string; // ISO
  type: "stamp" | "reward" | "reset" | "manual" | "segment" | "note" | "whatsapp";
  delta?: number;
  note?: string;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  segment: Segment;
  segmentManual?: boolean;     // se true, non sovrascrivere segmento auto
  lastOrder?: string;
  firstOrder?: string;
  stamps: number;
  loyaltyHistory?: LoyaltyEvent[];
  notes?: string;
  preferredProducts?: string[]; // productId
  preferredTimeSlot?: string;   // es. "Mattina presto"
  deliveryZone?: string;
  tags?: string[];
}

export interface OrderItem {
  productId: string;
  qty: number;
}

export type OrderStatus = "in_attesa" | "pronto" | "ritirato" | "annullato";
export type OrderSource = "negozio" | "whatsapp" | "telefono" | "consegna" | "sito" | "b2b" | "altro";

export interface OrderEvent {
  date: string; // ISO
  type: "creato" | "modificato" | "pronto" | "ritirato" | "annullato" | "consegna";
  note?: string;
}

export interface Order {
  id: string;
  clientId: string;
  label?: string;
  items: OrderItem[];
  pickupDate: string; // ISO datetime
  status: OrderStatus;
  notes?: string;
  total: number;
  createdAt: string;
  source?: OrderSource;
  timeline?: OrderEvent[];
  deliveryId?: string;
}

export interface Bundle {
  id: string;
  name: string;
  ingredients: string[];
  fullPrice: number;
  offerPrice: number | null;
  estimatedCost?: number;
  availability: string;
  active: boolean;
  startDate?: string;
  endDate?: string;
  channel?: string;          // es. "WhatsApp broadcast", "Vetrina"
  targetSegment?: Segment;
  goal?: string;             // es. "Riattivare inattivi"
}

export interface CasualSale {
  id: string;
  date: string; // ISO datetime
  items: OrderItem[];
  total: number;
  clientId?: string;
  clientNameInput?: string;
  notes?: string;
}

export type DeliveryStatus = "da_preparare" | "in_consegna" | "consegnata" | "annullata";
export type DeliveryPayment = "da_pagare" | "pagato_anticipo" | "pagato_consegna";

export interface Delivery {
  id: string;
  clientId: string;
  address: string;
  timeSlot: string; // es. "10:00-12:00"
  date: string;     // ISO date
  status: DeliveryStatus;
  payment: DeliveryPayment;
  orderId?: string;
  notes?: string;
  createdAt: string;
}

// ============= NUOVE ENTITÀ v4 =============

export type ProductionStatus = "da_preparare" | "preparato" | "completato";
export interface Production {
  id: string;
  date: string;        // ISO datetime (giorno preparazione)
  productId: string;
  qtyPlanned: number;
  qtyActual?: number;
  orderIds?: string[];
  notes?: string;
  status: ProductionStatus;
}

export interface Supplier {
  id: string;
  name: string;
  category: string;     // es. "Latticini", "Salumi", "Pane"
  phone?: string;
  contactName?: string;
  productIds?: string[];
  notes?: string;
  lastOrderDate?: string;
}

export type CashType = "entrata" | "uscita";
export type PaymentMethod = "contanti" | "pos" | "bonifico" | "carta" | "altro";
export type CashRefType = "order" | "delivery" | "casual" | "payment" | "manual";
export interface CashEntry {
  id: string;
  date: string;          // ISO
  type: CashType;
  category: string;
  amount: number;
  method: PaymentMethod;
  notes?: string;
  refType?: CashRefType;
  refId?: string;
}

export type B2BStatus = "prospect" | "attivo" | "sospeso";
export interface B2BHistoryEntry { date: string; total: number; note?: string; }
export interface B2BClient {
  id: string;
  name: string;            // nome attività
  contactName?: string;    // referente
  phone?: string;
  zone?: string;
  priceListId?: string;
  deliveryDays: string[];  // es. ["lun","gio"]
  status: B2BStatus;
  notes?: string;
  history: B2BHistoryEntry[];
}

export type SupplierPaymentStatus = "da_pagare" | "pagato" | "scaduto";
export type SupplierPaymentRecurrence = "una_tantum" | "settimanale" | "mensile" | "annuale";
export type SupplierPaymentBeneficiaryType = "fornitore" | "consulente" | "servizio" | "altro";
export type SupplierPaymentDocument = "fattura" | "ricevuta" | "preventivo" | "nessuno";
export interface SupplierPayment {
  id: string;
  date: string;            // ISO data registrazione
  beneficiary: string;
  beneficiaryType: SupplierPaymentBeneficiaryType;
  category: string;        // merce, affitto, utenze, commercialista, ecc
  amount: number;
  method: PaymentMethod;
  status: SupplierPaymentStatus;
  dueDate?: string;
  recurrence: SupplierPaymentRecurrence;
  notes?: string;
  document?: SupplierPaymentDocument;
  supplierId?: string;
}

export const CASH_CATEGORIES = [
  "Vendita banco", "Vendita ordine", "Vendita consegna", "B2B", "Altro",
  "Merce", "Utenze", "Affitto", "Personale", "Manutenzione", "Trasporti",
  "Software", "Marketing", "Tasse", "Consulenza", "Cancelleria",
] as const;

export const PAYMENT_CATEGORIES = [
  "Merce", "Affitto", "Utenze", "Commercialista", "Consulenza marketing",
  "Personale", "Manutenzione", "Trasporti", "Software", "Tasse", "Altro",
] as const;

export const SEGMENT_META: Record<Segment, { label: string; mode: string; color: string }> = {
  top:         { label: "Top Fidelizzati", mode: "messaggio manuale con nome", color: "bg-brand-gold text-white" },
  abituali:    { label: "Abituali",        mode: "messaggio manuale con nome", color: "bg-success text-white" },
  occasionali: { label: "Occasionali",     mode: "broadcast",                  color: "bg-blue-600 text-white" },
  nuovi:       { label: "Nuovi",           mode: "broadcast + ricotta omaggio", color: "bg-teal-600 text-white" },
  inattivi:    { label: "Inattivi",        mode: "broadcast con offerta forte", color: "bg-neutral-700 text-white" },
};

const p = (
  name: string,
  category: ProductCategory,
  cost: number | null,
  price: number,
  unit: "kg" | "pz",
  active: boolean,
  badge?: Product["badge"]
): Product => ({
  id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
  name, category, cost, price, unit, active, badge,
  available: true, seasonal: false, magnet: false,
});

const fresh = (p: Product, shelfLifeDays: number, perishability: "bassa" | "media" | "alta" = "alta"): Product =>
  ({ ...p, fresh: true, shelfLifeDays, perishability, trackUnsold: true });

export const SEED_PRODUCTS: Product[] = [
  fresh(p("Mozzarella di Bufala Campana DOP", "Freschi di Bufala", 10.5, 15.0, "kg", true, "DOP"), 2),
  fresh(p("Mozzarella Senza Lattosio DOP", "Freschi di Bufala", 11.5, 17.0, "kg", true, "DOP"), 2),
  fresh(p("Ricotta di Bufala", "Freschi di Bufala", 1.0, 1.6, "pz", true), 3),
  p("Burro di Bufala Gentile", "Freschi di Bufala", 3.0, 4.2, "pz", false),
  p("Yogurt di Bufala Gentile", "Freschi di Bufala", 1.3, 2.3, "pz", false),
  fresh(p("Ricotta di Pecora", "Freschi di Pecora", 0.8, 1.3, "pz", true), 3),
  fresh(p("Marzolina di Pecora Bianca", "Freschi di Pecora", 1.2, 1.9, "pz", true), 5, "media"),
  fresh(p("Marzolina di Pecora Condita", "Freschi di Pecora", 1.2, 2.0, "pz", true), 5, "media"),
  p("Marzolina Sottovuoto", "Freschi di Pecora", 2.6, 4.2, "pz", true),
  p("Caciocavallo Dolce", "Formaggi Stagionati", 14.5, 21.0, "kg", true),
  p("Caciocavallo Affumicato", "Formaggi Stagionati", 14.5, 21.0, "kg", true),
  p("Caciotta Bianca", "Formaggi Stagionati", 16.0, 23.0, "kg", false),
  p("Caciotta Mediterranea", "Formaggi Stagionati", 16.0, 23.0, "kg", true),
  p("Provolone del Monaco DOP", "Formaggi Stagionati", 23.29, 34.0, "kg", true, "DOP"),
  p("Auricchio Giovane 1kg", "Formaggi Stagionati", 11.79, 18.5, "kg", true),
  p("Parmigiano Reggiano DOP", "Formaggi Stagionati", 18.6, 27.5, "kg", true, "DOP"),
  p("Auricchio Semipiccante", "Formaggi Stagionati", 15.2, 22.0, "kg", true),
  p("Pecorino Sardo Dolce DOP", "Formaggi Stagionati", 14.7, 22.0, "kg", false, "DOP"),
  p("Pecorino Romano DOP", "Formaggi Stagionati", 14.9, 22.0, "kg", true, "DOP"),
  p("Cotto Gran Tenerone", "Salumi", 9.6, 25.99, "kg", true),
  p("Mortadella", "Salumi", 8.45, 14.5, "kg", true),
  p("Prosciutto Crudo di Parma DOP - Cavazzuti", "Salumi", 17.1, 25.5, "kg", true, "DOP"),
  p("Guanciale del Norcino Renzini", "Salumi", 10.96, 16.5, "kg", true),
  p("Crudo Lui Renzini", "Salumi", 14.63, 22.0, "kg", true),
  p("Lonza di Norcia Renzini", "Salumi", 11.7, 19.99, "kg", true),
  p("Salame Napoli", "Salumi", 11.35, 17.0, "kg", true),
  p("Salame Ungherese", "Salumi", 11.85, 17.5, "kg", true),
  p("Salame Milanese", "Salumi", 11.85, 17.5, "kg", true),
  p("Pancetta Tonda", "Salumi", 11.0, 17.5, "kg", true),
  p("Pancetta Tesa", "Salumi", 8.8, 14.99, "kg", true),
  p("Speck", "Salumi", 9.4, 15.99, "kg", true),
  p("Salsiccia Paesana Sottovuoto Tucciarone", "Salumi", 16.0, 19.99, "kg", true),
  p("Salame Strolghino Cavazzuti", "Salumi", 2.5, 4.5, "pz", false),
  p("Zucchine Grigliate Casa Marrazzo", "Dispensa", 7.35, 10.5, "pz", true),
  p("Carciofi Grigliati Casa Marrazzo", "Dispensa", 10.75, 15.0, "pz", true),
  p("Melanzane a Filetti Casa Marrazzo", "Dispensa", 7.35, 6.9, "pz", true),
  p("Olive di Gaeta DOP", "Dispensa", null, 6.99, "kg", false, "DOP"),
  p("Tarallini Classici all'Olio Di Costanzo", "Dispensa", 0.88, 3.2, "pz", true),
  p("Tarallini al Peperoncino Di Costanzo", "Dispensa", 0.88, 3.2, "pz", true),
  p("Tarallini Premium pistacchio strega limone", "Dispensa", 1.82, 3.9, "pz", true),
  p("Pane Casareccio D'Alise", "Pane", 2.0, 3.0, "kg", true),
  p("Panini D'Alise", "Pane", 2.5, 3.6, "kg", true),
  p("Latte Intero Latte Sano", "Latte", 1.91, 2.6, "pz", true),
  p("Latte Alta Digeribilità Latte Sano", "Latte", 1.91, 2.6, "pz", true),
  p("Acqua piccola Lete", "Bevande", 0.17, 1.0, "pz", true),
  p("Acqua piccola Sorgesana", "Bevande", 0.13, 1.0, "pz", true),
  p("Coca-Cola Lattina", "Bevande", 0.5, 2.0, "pz", true),
  p("Birra Nastro Azzurro 33cl", "Bevande", 0.61, 2.0, "pz", true),
  p("Birra Peroni 33cl", "Bevande", 0.54, 2.0, "pz", true),
  p("Prosecco Maschio", "Bevande", 1.57, 3.0, "pz", true),
  p("Aglianico Campania DOC", "Vini", null, 8.9, "pz", true, "DOC"),
  p("Chianti DOCG", "Vini", null, 6.5, "pz", true, "DOCG"),
  p("Fiano di Avellino DOCG", "Vini", null, 10.95, "pz", true, "DOCG"),
  p("Greco di Tufo DOCG", "Vini", null, 9.95, "pz", true, "DOCG"),
  p("Falanghina del Sannio DOC", "Vini", null, 9.0, "pz", true, "DOC"),
];

export const SEED_CLIENTS: Client[] = [
  { id: "c1", name: "Maria Rossi", phone: "+39 333 1112233", segment: "top", stamps: 4, lastOrder: "2026-05-12", firstOrder: "2018-04-10", notes: "Preferisce mozzarella mattina presto", preferredTimeSlot: "08:30-10:00" },
  { id: "c2", name: "Giuseppe Bianchi", phone: "+39 333 2223344", segment: "top", stamps: 3, lastOrder: "2026-05-13", firstOrder: "2019-09-21" },
  { id: "c3", name: "Anna Esposito", phone: "+39 333 3334455", segment: "top", stamps: 5, lastOrder: "2026-05-11", firstOrder: "2010-01-15", notes: "Cliente storica dal 2010" },
  { id: "c4", name: "Luca Ferrara", phone: "+39 333 4445566", segment: "abituali", stamps: 2, lastOrder: "2026-05-10", firstOrder: "2022-03-08" },
  { id: "c5", name: "Chiara Gallo", phone: "+39 333 5556677", segment: "abituali", stamps: 1, lastOrder: "2026-05-09", firstOrder: "2023-11-02" },
  { id: "c6", name: "Marco De Luca", phone: "+39 333 6667788", segment: "occasionali", stamps: 0, lastOrder: "2026-04-28", firstOrder: "2025-06-14" },
  { id: "c7", name: "Sofia Romano", phone: "+39 333 7778899", segment: "nuovi", stamps: 0, lastOrder: "2026-05-13", firstOrder: "2026-05-13" },
  { id: "c8", name: "Antonio Greco", phone: "+39 333 8889900", segment: "inattivi", stamps: 0, lastOrder: "2026-03-05", firstOrder: "2021-07-19" },
];

export const SEED_BUNDLES: Bundle[] = [
  { id: "b1",  name: "I Monti Bianchi",        ingredients: ["Mozzarella bufala 500g", "Ricotta bufala 250g", "Marzolina condita 1pz"], fullPrice: 11.10, offerPrice: 9.50, estimatedCost: 7.40, availability: "Sempre attivo", active: true, channel: "Vetrina", targetSegment: "abituali" },
  { id: "b2",  name: "Il Tagliere di Sciorio", ingredients: ["Mozzarella bufala 500g", "Provolone Monaco DOP 200g", "Salame Napoli 200g", "Taralli 1pz"], fullPrice: 20.90, offerPrice: 16.90, estimatedCost: 13.00, availability: "Sempre attivo", active: true, channel: "Banco + WhatsApp", targetSegment: "top" },
  { id: "b3",  name: "La Tavola da Pranzo",    ingredients: ["Mozzarella bufala 500g", "Mortadella 200g", "Pane casareccio 500g", "Ricotta bufala 250g"], fullPrice: 13.50, offerPrice: 10.90, estimatedCost: 8.20, availability: "Venerdì e Sabato", active: true },
  { id: "b4",  name: "Freschi Senza Lattosio", ingredients: ["Mozzarella s/lattosio 500g", "Ricotta pecora 2pz", "Marzolina pecora bianca 1pz"], fullPrice: 13.00, offerPrice: 10.90, estimatedCost: 8.50, availability: "Sempre attivo", active: true },
  { id: "b5",  name: "Il Panino dello Chef",   ingredients: ["Pane casareccio 250g", "Cotto Gran Tenerone 150g", "Marzolina condita 1pz"], fullPrice: 6.65, offerPrice: 4.90, estimatedCost: 3.10, availability: "Martedì e Giovedì", active: true, channel: "Banco pranzo", targetSegment: "occasionali" },
  { id: "b6",  name: "Il Banco dello Chef",    ingredients: ["Ricotta bufala 250g", "Pasta di Gragnano 2 formati", "Marzolina condita 1pz"], fullPrice: 12.60, offerPrice: 9.90, estimatedCost: 8.00, availability: "Venerdì e Sabato", active: true },
  { id: "b7",  name: "La Bufala Pontina",      ingredients: ["Mozzarella bufala 500g", "Caciocavallo Dolce 200g", "Ricotta bufala 250g", "Taralli 1pz"], fullPrice: 16.50, offerPrice: 11.90, estimatedCost: 10.00, availability: "Weekend", active: true },
  { id: "b8",  name: "La Merenda di Sciorio",  ingredients: ["Speck 150g", "Marzolina Sottovuoto 1pz", "Taralli 1pz", "Chianti 1 bottiglia"], fullPrice: 16.30, offerPrice: null, estimatedCost: 11.00, availability: "Martedì e Giovedì", active: true },
  { id: "b9",  name: "Box Famiglia",           ingredients: ["Mozzarella bufala 500g", "Mortadella 200g", "Pane 500g", "Ricotta 250g", "Coca-Cola 1 lattina"], fullPrice: 15.50, offerPrice: 11.90, estimatedCost: 9.40, availability: "Sabato", active: true },
  { id: "b10", name: "Il Sacco di Sciorio",    ingredients: ["4 Panini", "Salame Napoli 200g", "Marzolina Sottovuoto 3pz"], fullPrice: 13.60, offerPrice: 10.90, estimatedCost: 8.70, availability: "Martedì-Venerdì", active: true },
  { id: "b11", name: "La Grigliata di Sciorio",ingredients: ["Salsiccia Paesana 400g", "Caciotta Mediterranea 200g", "Peperoni grigliati 300g"], fullPrice: 23.10, offerPrice: 16.90, estimatedCost: 13.20, availability: "Campagna stagionale", active: true },
];

const today = new Date();
const isoToday = (h: number, m: number, dayOffset = 0) => {
  const d = new Date(today);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

export const SEED_ORDERS: Order[] = [
  { id: "o1", clientId: "c1", label: "Ordine settimanale", items: [{ productId: "mozzarella-di-bufala-campana-dop", qty: 1 }, { productId: "ricotta-di-bufala", qty: 2 }], pickupDate: isoToday(10, 30), status: "in_attesa", total: 18.20, createdAt: new Date().toISOString(), notes: "Confezione regalo", source: "whatsapp" },
  { id: "o2", clientId: "c3", items: [{ productId: "mozzarella-di-bufala-campana-dop", qty: 0.5 }, { productId: "pane-casareccio-d-alise", qty: 0.5 }], pickupDate: isoToday(11, 0), status: "in_attesa", total: 9.0, createdAt: new Date().toISOString(), source: "negozio" },
  { id: "o3", clientId: "c4", items: [{ productId: "provolone-del-monaco-dop", qty: 0.3 }, { productId: "salame-napoli", qty: 0.2 }], pickupDate: isoToday(17, 30), status: "pronto", total: 13.6, createdAt: new Date().toISOString(), source: "telefono" },
  { id: "o4", clientId: "c2", items: [{ productId: "mozzarella-di-bufala-campana-dop", qty: 1.5 }], pickupDate: isoToday(9, 0), status: "ritirato", total: 22.5, createdAt: new Date().toISOString(), source: "negozio" },
  { id: "o5", clientId: "c5", items: [{ productId: "ricotta-di-bufala", qty: 3 }, { productId: "mortadella", qty: 0.3 }], pickupDate: isoToday(12, 0, -2), status: "ritirato", total: 9.15, createdAt: new Date().toISOString(), source: "negozio" },
];

export const SEED_CASUAL_SALES: CasualSale[] = [
  { id: "s1", date: isoToday(9, 30, -1), items: [{ productId: "mozzarella-di-bufala-campana-dop", qty: 0.4 }, { productId: "pane-casareccio-d-alise", qty: 0.3 }], total: 6.9 },
  { id: "s2", date: isoToday(11, 15), items: [{ productId: "ricotta-di-bufala", qty: 1 }, { productId: "tarallini-classici-all-olio-di-costanzo", qty: 1 }], total: 4.8 },
];

export const SEED_DELIVERIES: Delivery[] = [
  { id: "d1", clientId: "c1", address: "Via Roma 12, Santi Cosma e Damiano", timeSlot: "10:00-12:00", date: isoToday(10, 0), status: "da_preparare", payment: "da_pagare", orderId: "o1", createdAt: new Date().toISOString() },
];

const isoDay = (dayOffset = 0) => {
  const d = new Date(today); d.setDate(d.getDate() + dayOffset); d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

export const SEED_PRODUCTIONS: Production[] = [
  { id: "pr1", date: isoToday(7, 0), productId: "mozzarella-di-bufala-campana-dop", qtyPlanned: 12, qtyActual: 11.5, status: "completato", orderIds: ["o1", "o2", "o4"] },
  { id: "pr2", date: isoToday(7, 0), productId: "ricotta-di-bufala", qtyPlanned: 8, status: "da_preparare", notes: "Per ordine famiglia Rossi" },
  { id: "pr3", date: isoToday(7, 0, 1), productId: "mozzarella-di-bufala-campana-dop", qtyPlanned: 15, status: "da_preparare" },
];

// ============= FRESH / UNSOLD / CALENDAR =============

export type WeekdayKey = "lun" | "mar" | "mer" | "gio" | "ven" | "sab" | "dom";
export const WEEKDAYS: WeekdayKey[] = ["lun", "mar", "mer", "gio", "ven", "sab", "dom"];
export const WEEKDAY_LABEL: Record<WeekdayKey, string> = {
  lun: "Lunedì", mar: "Martedì", mer: "Mercoledì", gio: "Giovedì",
  ven: "Venerdì", sab: "Sabato", dom: "Domenica",
};
// JS getDay(): 0=domenica
export function weekdayKey(d: Date | string): WeekdayKey {
  const n = new Date(d).getDay();
  return (["dom", "lun", "mar", "mer", "gio", "ven", "sab"] as WeekdayKey[])[n];
}

export interface DayHours { closed: boolean; open?: string; close?: string; }
export type BusinessHours = Record<WeekdayKey, DayHours>;
export const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  lun: { closed: true },
  mar: { closed: false, open: "08:00", close: "20:00" },
  mer: { closed: false, open: "08:00", close: "20:00" },
  gio: { closed: false, open: "08:00", close: "20:00" },
  ven: { closed: false, open: "08:00", close: "20:00" },
  sab: { closed: false, open: "08:00", close: "20:00" },
  dom: { closed: false, open: "08:00", close: "14:00" },
};

export interface FreshLog {
  id: string;
  date: string;        // ISO (giorno)
  productId: string;
  qtyStart: number;    // disponibile inizio giornata
  qtySold: number;     // venduto al normale
  qtyRecovered: number;// recuperato (TGTG / scontato)
  qtyDiscarded: number;// scarto
  qtyLeft?: number;    // rimasto fine giornata (calcolato se vuoto)
  notes?: string;
}

export type UnsoldDestination = "scontato" | "tgtg" | "consumo_interno" | "scarto" | "altro";
export const UNSOLD_DESTINATION_LABEL: Record<UnsoldDestination, string> = {
  scontato: "Venduto scontato",
  tgtg: "Too Good To Go",
  consumo_interno: "Consumo interno",
  scarto: "Scarto",
  altro: "Altro",
};
export interface UnsoldEntry {
  id: string;
  date: string;             // ISO
  productId: string;
  qty: number;
  destination: UnsoldDestination;
  valueLost?: number;       // valore perso (€)
  valueRecovered?: number;  // valore recuperato (€)
  tgtgBoxes?: number;       // numero box TGTG vendute
  notes?: string;
}

export type SpecialDayImpact = "basso" | "medio" | "alto";
export interface SpecialDay {
  id: string;
  date: string;     // ISO (YYYY-MM-DD)
  name: string;     // Natale, Pasqua, Ferragosto, ponte, ecc.
  impact: SpecialDayImpact;
  multiplier: number; // es. 1.0, 0.7, 1.3, 1.5, 2.0
  notes?: string;
}

export const SEED_FRESH_LOGS: FreshLog[] = [
  { id: "fl1", date: isoDay(-1), productId: "mozzarella-di-bufala-campana-dop", qtyStart: 16, qtySold: 14, qtyRecovered: 1, qtyDiscarded: 0.5, qtyLeft: 0.5, notes: "Buona giornata" },
  { id: "fl2", date: isoDay(-2), productId: "mozzarella-di-bufala-campana-dop", qtyStart: 18, qtySold: 15, qtyRecovered: 2, qtyDiscarded: 1, qtyLeft: 0 },
  { id: "fl3", date: isoDay(-1), productId: "ricotta-di-bufala", qtyStart: 10, qtySold: 8, qtyRecovered: 1, qtyDiscarded: 1, qtyLeft: 0 },
];

export const SEED_UNSOLD_ENTRIES: UnsoldEntry[] = [
  { id: "un1", date: isoDay(-1), productId: "mozzarella-di-bufala-campana-dop", qty: 1, destination: "tgtg", valueLost: 15, valueRecovered: 6, tgtgBoxes: 2 },
  { id: "un2", date: isoDay(-1), productId: "ricotta-di-bufala", qty: 1, destination: "scontato", valueLost: 1.6, valueRecovered: 1.0 },
];

export const SEED_SPECIAL_DAYS: SpecialDay[] = [
  { id: "sd1", date: "2026-08-15", name: "Ferragosto", impact: "alto", multiplier: 0.5, notes: "Negozio aperto solo mattina" },
  { id: "sd2", date: "2026-12-24", name: "Vigilia di Natale", impact: "alto", multiplier: 2.0, notes: "Picco mozzarella" },
];

export const SEED_SUPPLIERS: Supplier[] = [
  { id: "sup1", name: "Tucciarone Salumi", category: "Salumi", phone: "+39 0771 555111", contactName: "Antonio", productIds: ["salsiccia-paesana-sottovuoto-tucciarone"], lastOrderDate: isoDay(-7) },
  { id: "sup2", name: "Casa Marrazzo", category: "Conserve", phone: "+39 081 555222", productIds: ["zucchine-grigliate-casa-marrazzo", "carciofi-grigliati-casa-marrazzo", "melanzane-a-filetti-casa-marrazzo"], lastOrderDate: isoDay(-14) },
  { id: "sup3", name: "Forno D'Alise", category: "Pane", phone: "+39 0771 555333", contactName: "Mario", productIds: ["pane-casareccio-d-alise", "panini-d-alise"], lastOrderDate: isoDay(-1), notes: "Consegna giornaliera 06:30" },
  { id: "sup4", name: "Latte Sano", category: "Latte", phone: "+39 06 555444", productIds: ["latte-intero-latte-sano", "latte-alta-digeribilita-latte-sano"], lastOrderDate: isoDay(-3) },
  { id: "sup5", name: "Renzini Norcineria", category: "Salumi", phone: "+39 075 555888", productIds: ["guanciale-del-norcino-renzini", "crudo-lui-renzini", "lonza-di-norcia-renzini"], lastOrderDate: isoDay(-10) },
];

export const SEED_CASH_ENTRIES: CashEntry[] = [
  { id: "ce1", date: isoToday(11, 0), type: "entrata", category: "Vendita banco", amount: 6.9, method: "contanti", refType: "casual", refId: "s1" },
  { id: "ce2", date: isoToday(11, 15), type: "entrata", category: "Vendita banco", amount: 4.8, method: "contanti", refType: "casual", refId: "s2" },
  { id: "ce3", date: isoToday(9, 0, -1), type: "uscita", category: "Merce", amount: 145.0, method: "bonifico", notes: "Carico salumi Tucciarone" },
  { id: "ce4", date: isoToday(15, 0, -3), type: "uscita", category: "Utenze", amount: 78.0, method: "bonifico", notes: "Bolletta luce" },
];

export const SEED_B2B_CLIENTS: B2BClient[] = [
  { id: "b2b1", name: "Lido Azzurro", contactName: "Roberto", phone: "+39 333 9990001", zone: "Sperlonga", deliveryDays: ["mar", "ven"], status: "attivo", history: [{ date: isoDay(-7), total: 320 }, { date: isoDay(-14), total: 280 }], notes: "Ordine standard mozzarella + ricotta" },
  { id: "b2b2", name: "Ristorante La Pergola", contactName: "Luigi", phone: "+39 333 9990002", zone: "Formia", deliveryDays: ["lun", "gio"], status: "attivo", history: [{ date: isoDay(-3), total: 195 }] },
  { id: "b2b3", name: "Pizzeria Vesuvio", contactName: "Gino", phone: "+39 333 9990003", zone: "Gaeta", deliveryDays: ["mer", "sab"], status: "prospect", history: [], notes: "In valutazione preventivo" },
];

export const SEED_SUPPLIER_PAYMENTS: SupplierPayment[] = [
  { id: "sp1", date: isoDay(-7), beneficiary: "Tucciarone Salumi", beneficiaryType: "fornitore", category: "Merce", amount: 145.0, method: "bonifico", status: "pagato", recurrence: "una_tantum", document: "fattura", supplierId: "sup1" },
  { id: "sp2", date: isoDay(-3), beneficiary: "Enel Energia", beneficiaryType: "servizio", category: "Utenze", amount: 178.50, method: "bonifico", status: "pagato", dueDate: isoDay(-3), recurrence: "mensile", document: "fattura" },
  { id: "sp3", date: isoDay(0), beneficiary: "Studio Bianchi Commercialista", beneficiaryType: "consulente", category: "Commercialista", amount: 250.0, method: "bonifico", status: "da_pagare", dueDate: isoDay(7), recurrence: "mensile", document: "fattura" },
  { id: "sp4", date: isoDay(-15), beneficiary: "Affittuario Locale", beneficiaryType: "altro", category: "Affitto", amount: 850.0, method: "bonifico", status: "pagato", dueDate: isoDay(-15), recurrence: "mensile" },
  { id: "sp5", date: isoDay(-30), beneficiary: "Marketing Web Srl", beneficiaryType: "consulente", category: "Consulenza marketing", amount: 350.0, method: "bonifico", status: "scaduto", dueDate: isoDay(-5), recurrence: "una_tantum", document: "fattura" },
];

// ============= GOODS RECEIPTS / ENTRATE MERCI =============

export type GoodsReceiptStatus = "attesa" | "ricevuta" | "verificata" | "archiviata";
export type InvoicePaymentStatus = "da_pagare" | "pagato" | "scaduto" | "non_applicabile";
export type DocumentKind = "fattura" | "ddt" | "ricevuta" | "preventivo" | "altro";

export interface GoodsReceiptItem {
  productId: string;
  qty: number;
  unitCost?: number;
  notes?: string;
}

export interface GoodsReceiptAttachment {
  id: string;       // IndexedDB key
  name: string;
  type: string;     // mime
  size: number;
  kind?: DocumentKind;
  addedAt: string;
}

export interface GoodsReceipt {
  id: string;
  date: string;            // ISO datetime ricezione
  supplierId: string;
  status: GoodsReceiptStatus;
  items: GoodsReceiptItem[];
  totalCost?: number;      // se vuoto, calcolato da items
  carrier?: string;
  paymentMethod?: PaymentMethod;
  notes?: string;
  // Documento
  invoiceNumber?: string;
  invoiceDate?: string;
  ddtNumber?: string;
  taxableAmount?: number;  // imponibile
  vatAmount?: number;      // IVA
  documentTotal?: number;  // totale documento
  paymentDueDate?: string;
  paymentStatus?: InvoicePaymentStatus;
  attachments?: GoodsReceiptAttachment[];
  createdAt: string;
}

export const GOODS_RECEIPT_STATUS_LABEL: Record<GoodsReceiptStatus, string> = {
  attesa: "In attesa",
  ricevuta: "Ricevuta",
  verificata: "Verificata",
  archiviata: "Archiviata",
};

export const INVOICE_STATUS_LABEL: Record<InvoicePaymentStatus, string> = {
  da_pagare: "Da pagare",
  pagato: "Pagato",
  scaduto: "Scaduto",
  non_applicabile: "N/A",
};

export const SEED_GOODS_RECEIPTS: GoodsReceipt[] = [
  {
    id: "gr1", date: isoDay(-1), supplierId: "sup3", status: "verificata",
    items: [
      { productId: "pane-casareccio-d-alise", qty: 8, unitCost: 2.0 },
      { productId: "panini-d-alise", qty: 6, unitCost: 2.5 },
    ],
    totalCost: 31.0, carrier: "Consegna diretta", paymentMethod: "contanti",
    invoiceNumber: "DDT-2026-184", invoiceDate: isoDay(-1),
    taxableAmount: 28.18, vatAmount: 2.82, documentTotal: 31.0,
    paymentStatus: "pagato", createdAt: isoDay(-1),
  },
  {
    id: "gr2", date: isoDay(-7), supplierId: "sup1", status: "archiviata",
    items: [{ productId: "salsiccia-paesana-sottovuoto-tucciarone", qty: 5, unitCost: 16.0 }],
    totalCost: 145.0, paymentMethod: "bonifico",
    invoiceNumber: "F-2026-0098", invoiceDate: isoDay(-7),
    taxableAmount: 131.82, vatAmount: 13.18, documentTotal: 145.0,
    paymentDueDate: isoDay(23), paymentStatus: "pagato", createdAt: isoDay(-7),
  },
  {
    id: "gr3", date: isoDay(-3), supplierId: "sup4", status: "ricevuta",
    items: [
      { productId: "latte-intero-latte-sano", qty: 24, unitCost: 1.91 },
      { productId: "latte-alta-digeribilita-latte-sano", qty: 12, unitCost: 1.91 },
    ],
    totalCost: 68.76, paymentMethod: "bonifico",
    invoiceNumber: "F-LS-2026-412", invoiceDate: isoDay(-3),
    taxableAmount: 62.51, vatAmount: 6.25, documentTotal: 68.76,
    paymentDueDate: isoDay(27), paymentStatus: "da_pagare", createdAt: isoDay(-3),
  },
];

export function calcReceiptTotal(r: GoodsReceipt): number {
  if (typeof r.totalCost === "number") return r.totalCost;
  return r.items.reduce((s, it) => s + (it.unitCost ?? 0) * it.qty, 0);
}

export function calcMargin(p: Product): number | null {
  if (p.cost == null || p.price === 0) return null;
  return ((p.price - p.cost) / p.price) * 100;
}

export function calcMarginEur(p: Product): number | null {
  if (p.cost == null) return null;
  return p.price - p.cost;
}

export function bundleMargin(b: Bundle): { pct: number | null; eur: number | null } {
  const price = b.offerPrice ?? b.fullPrice;
  if (b.estimatedCost == null || !price) return { pct: null, eur: null };
  const eur = price - b.estimatedCost;
  return { pct: (eur / price) * 100, eur };
}
