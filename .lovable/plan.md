# Sciorio HQ — Rifinitura operativa

Obiettivo: trasformare il gestionale esistente in uno strumento veloce per uso quotidiano. Mantengo architettura, store localStorage, routing, design system, branding. Nessun backend, nessuna AI.

## Approccio

Lavoro in 3 ondate per non rompere nulla:
1. **Fondamenta condivise** (store + utility) — base per tutto il resto
2. **Rifinitura sezioni esistenti** — Dashboard, Ordini, Clienti, Prodotti, Offerte
3. **Nuove sezioni leggere** — Consegne, Report, Admin completato + WhatsApp center

## 1. Fondamenta (store + utility)

Estendo `src/lib/data.ts` e `src/lib/store.ts` senza rompere i tipi attuali:
- `Client`: aggiungo `notes`, `preferredProducts[]`, `preferredTimeSlot`, `deliveryZone`, `tags[]`, `loyaltyStamps`, `loyaltyHistory[]`
- `Order`: aggiungo `source` (negozio/whatsapp/telefono), `timeline[]` (eventi datati), `deliveryId?`
- `Product`: aggiungo `available`, `seasonal`, `magnet`, `priceHistory[]`, `certification` (DOP/IGP/DOC/BIO)
- `Bundle`: aggiungo `active`, `startDate`, `endDate`, `channel`, `targetSegment`
- nuovo `Delivery`: cliente, indirizzo, fascia, stato, pagamento, ordine collegato
- nuovo `LoyaltyEvent` per la timeline

Nuovi file utility:
- `src/lib/whatsapp.ts` — `normalizePhone()`, `buildMessage(template, ctx)`, `openChat(phone, msg)`, template (conferma ordine, promemoria ritiro, consegna, promo bundle, cliente inattivo, premio disponibile)
- `src/lib/metrics.ts` — selettori derivati: `clientLTV`, `clientFrequency`, `clientSegment`, `daysSinceLastOrder`, `productMargin`, `topProducts`, `bundleStats`, `pendingDeliveries`, `dailyMargin`
- `src/lib/loyalty.ts` — gestione timbri, reset post-premio, badge "quasi completato"

Migrazione automatica al load: se manca un campo, default sensato. Bump chiave a `sciorio-hq-v3` con migrazione da v2.

## 2. Rifinitura sezioni esistenti

### Dashboard (`src/routes/index.tsx`)
- Riordino KPI in 2 gruppi visivi: **Economici** (fatturato gen/stim, margine giornaliero, scontrino medio) e **Operativi** (ritiri oggi, consegne aperte, clienti inattivi, premi disponibili)
- Tutte le card KPI diventano `<Link>` a liste pre-filtrate (es. `/ordini?filter=oggi`)
- Quick actions in bottom sheet rapido: nuovo ordine, prenotazione mozzarella, WhatsApp rapido, segna ritiro
- Sezione **Attenzione** in cima con: ordini vecchi non ritirati, clienti a 5 timbri, prodotti sotto costo, consegne aperte in ritardo

### Ordini (`src/routes/ordini.tsx`)
- Filtri rapidi a chip: oggi · domani · ritardi · consegne · mozzarella · alto valore
- Ricerca con autocomplete cliente (`Command`) e prodotti
- Card ordine arricchita: cliente · tel · origine · data creazione · ritiro · totale · margine · stato · indicatore consegna
- Azioni rapide inline: duplica · pronto · ritirato · WhatsApp
- Sheet ordine: timeline eventi + edit prodotti veloce
- Su "ritirato": aggiorna automaticamente cliente (totale speso, n° ordini, ultimo ordine, timbro fedeltà)

### Clienti (`src/routes/clienti.tsx`)
- Header scheda con LTV, media spesa, frequenza, giorni inattività, ultimo ordine
- Badge automatici: caldo · inattivo · alto spendente · vicino premio
- Segmento auto-calcolato (Top/Abituali/Occasionali/Nuovi/Inattivi) con override manuale
- Timeline unificata: ordini + premi + consegne + note
- Note rapide editabili, prodotti preferiti, fascia oraria, zona consegna
- Ricerca istantanea per nome/telefono/tag/segmento
- Pannello fedeltà: 5 timbri grafici, "quasi completato", storico premi, modifica manuale road timbri

### Prodotti (`src/routes/prodotti.tsx`)
- Colonna margine € e % con colore (rosso sotto costo, ambra basso, verde ottimo)
- Badge certificazioni visivi (DOP/IGP/DOC/BIO)
- Toggle disponibile · stagionale · magnete
- Sezioni: più venduti · meno venduti · più profittevoli
- Storico prezzi nel sheet di edit

### Offerte (`src/routes/offerte.tsx`)
- Toggle attivo, date inizio/fine, canale, segmento target
- Stats: bundle più venduti / più profittevoli / stagionali
- Pulsante "Genera messaggio promo" → apre WhatsApp center con testo precompilato

## 3. Nuove sezioni

### Consegne (`src/routes/consegne.tsx`)
- Lista per stato (da preparare · in consegna · consegnata · annullata)
- Card: cliente · tel · indirizzo · fascia · ordine · pagamento
- Azioni: WhatsApp · Chiama (`tel:`) · Segna consegnata
- Header con KPI: aperte · completate · valore totale · ritardi
- Aggiunta in bottom nav

### Report (`src/routes/report.tsx`)
- KPI semplici: top clienti · top margini · top bundle · inattivi · scontrino medio · margine totale · trend mozzarella · top profitti
- Filtri timeframe esistente

### Admin (`src/routes/admin.tsx`) — completamento
- Cambio PIN (salvato in localStorage)
- Export JSON (download `sciorio-backup-YYYYMMDD.json`)
- Import JSON con conferma
- Reset dati con doppia conferma
- Info storage (size kb, n° record per entità)
- Versione app

### WhatsApp center
Non una pagina dedicata — un componente `WhatsAppDialog` riutilizzato ovunque (ordine, cliente, consegna, bundle). Mostra preview messaggio, pulsante copia, pulsante apri chat. Template selezionabile.

## Bottom nav / sidebar
Aggiunta voce **Consegne** e **Report**. Riordino: Dashboard · Ordini · Consegne · Clienti · Prodotti · Offerte · Report. Admin resta accessibile da menu.

## Note tecniche
- Tutto frontend, nessun backend
- shadcn esistente (Sheet, Command, Popover, Dialog)
- Migrazione store con fallback safe
- Niente animazioni pesanti (solo micro-feedback timbri)
- Tutto in italiano, design tokens Sciorio invariati

## Fuori scope (esplicitamente)
Backend, Supabase, auth multiutente, push, AI, ecommerce, analytics enterprise, nuove dipendenze pesanti.
