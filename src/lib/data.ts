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
}

export interface LoyaltyEvent {
  date: string; // ISO
  type: "stamp" | "reward" | "reset" | "manual";
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
export type OrderSource = "negozio" | "whatsapp" | "telefono" | "consegna" | "altro";

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

export const SEED_PRODUCTS: Product[] = [
  p("Mozzarella di Bufala Campana DOP", "Freschi di Bufala", 10.5, 15.0, "kg", true, "DOP"),
  p("Mozzarella Senza Lattosio DOP", "Freschi di Bufala", 11.5, 17.0, "kg", true, "DOP"),
  p("Ricotta di Bufala", "Freschi di Bufala", 1.0, 1.6, "pz", true),
  p("Burro di Bufala Gentile", "Freschi di Bufala", 3.0, 4.2, "pz", false),
  p("Yogurt di Bufala Gentile", "Freschi di Bufala", 1.3, 2.3, "pz", false),
  p("Ricotta di Pecora", "Freschi di Pecora", 0.8, 1.3, "pz", true),
  p("Marzolina di Pecora Bianca", "Freschi di Pecora", 1.2, 1.9, "pz", true),
  p("Marzolina di Pecora Condita", "Freschi di Pecora", 1.2, 2.0, "pz", true),
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
