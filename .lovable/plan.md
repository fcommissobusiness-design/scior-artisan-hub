## Sciorio HQ — Espansione gestionale

Lavoro in più fasi su layout responsive, CRUD completo, AI suggerimenti, acquisti casuali e sezione amministrativa.

### 1. Layout responsive (mobile + desktop)
- `AppShell`: su desktop (≥768px) sostituire la bottom-nav con una **sidebar laterale sinistra** (240px), contenuto centrato max-w-6xl con padding generoso.
- Mobile invariato (bottom nav fissa, container 390px).
- Tutte le schermate: griglie che passano da 1 colonna (mobile) a 2-3 colonne (desktop).
- Modali: su desktop max-w-2xl centrati, su mobile full-screen sheet.

### 2. Fix modale "Nuovo Ordine"
- Sostituire il dialog con `Sheet` (bottom su mobile, side su desktop) + footer **sticky** con bottone "Conferma" sempre visibile.
- Padding-bottom area scrollabile per non coprire il CTA.

### 3. Ordini — modifica completa
- Tap su un ordine apre uno sheet di **dettaglio/modifica** con tutti i campi editabili: nome cliente, data ritiro, orario ritiro, note, righe prodotti (quantità), **status** (select: in attesa / ritirato / annullato).
- Cambio status sposta automaticamente nelle tab (già reattivo via store).
- Pulsanti rapidi: "Segna ritirato", "Annulla", "Elimina".

### 4. Offerte (bundle) — CRUD
- Tap su offerta → sheet di modifica: nome, descrizione, ingredienti (lista editabile add/remove), prezzo pieno, prezzo offerta, attiva/non attiva.
- Margine % e € **ricalcolati live** (basati su somma costi prodotti collegati o costo manuale per ingrediente).
- FAB "+" per **aggiungere nuova offerta**.

### 5. Prodotti — CRUD + AI Suggerimenti
- FAB "+" → nuovo prodotto: nome, categoria, certificazione (DOP/IGP/Bio/—), costo, prezzo, unità, note. Margine calcolato automaticamente.
- Tap su prodotto → modifica/elimina.
- Bottone **"Consiglio AI"** per ciascun prodotto e bundle: chiama edge function (Lovable AI Gateway, modello `google/gemini-3-flash-preview`) che restituisce JSON strutturato:
  - per prodotto: `quando_proporre`, `target_clienti`, `bundle_consigliati`, `offerta_suggerita`.
  - per bundle: `target_ideale`, `momento_ideale`, `modalita_proposta`, `addon_collegabili`.
- Richiede attivazione **Lovable Cloud** + **Lovable AI** (faccio io, key auto-provisioned).

### 6. Clienti — CRUD + storico leggibile
- FAB "+" nuovo cliente: nome, cognome, telefono, data primo ordine, note, status (segmento).
- Tap su cliente → sheet ampia con **storico ordini scrollabile** (no truncation desktop) + tutti i campi editabili.
- Cambio status aggiorna automaticamente i conteggi per segmento (deriva dai dati live).

### 7. Acquisti casuali (scontrini)
- Nuova sezione in **Dashboard** + FAB dedicato "Nuovo scontrino".
- Form: data, orario, righe prodotti+quantità (autocomplete da catalogo), nome cliente (autocomplete da clienti esistenti, opzionale).
- Se nome combacia con cliente esistente → aggancia ID, append a storico.
- Se nome nuovo → crea automaticamente nuova scheda cliente (status "occasionale").
- Se vuoto → registrato come anonimo.

### 8. Dashboard — fatturato + time frame
- Selettore periodo in alto a destra: Oggi / Ieri / Settimana corrente / Settimana scorsa / Mese corrente / Mese scorso / Personalizzato (calendario 2026 con shadcn DatePicker, range).
- KPI ricalcolati per il periodo selezionato:
  - **Fatturato stimato** = ordini con status "in attesa" nel periodo.
  - **Fatturato generato** = ordini "ritirati" + acquisti casuali confermati nel periodo.
  - Numero ordini, numero scontrini, kg mozzarella, ecc.

### 9. Sezione Amministrativa
- Nuova route `/admin` (accessibile da sidebar/dashboard).
- Card mese corrente: fatturato generato progressivo, numero giorni trascorsi, **proiezione fine mese** (`generato / giorni_trascorsi * giorni_totali`).
- Margine previsto (somma margini per riga venduta).
- Breakdown: ordini vs scontrini, top prodotti del mese.

### 10. Persistenza
- Estendere `store.ts` con: `addClient`, `addProduct`, `addBundle`, `deleteOrder`, `addCasualSale`, ecc.
- Nuovo tipo `CasualSale` in `data.ts`.
- Tutto salvato in `localStorage` (chiave `sciorio-hq-v2` con migrazione soft).

### Dettagli tecnici
- Stack: React + TanStack Router (esistente) + Tailwind + shadcn (Sheet, Dialog, Calendar, Popover, Command per autocomplete).
- AI: edge function `consiglio-prodotto` e `consiglio-bundle` su Lovable AI Gateway (richiede abilitazione Lovable Cloud — chiederò conferma prima di procedere col passo AI se vuoi saltarla).
- Nessun grafico, nessuna animazione (rispetto vincoli iniziali) — solo numeri, liste, badge.

### Ordine di esecuzione consigliato
1. Layout responsive + fix modale Conferma (rapido, sblocca review desktop).
2. CRUD Ordini / Clienti / Prodotti / Offerte + storico cliente leggibile.
3. Acquisti casuali + nuovo store.
4. Dashboard time frame + fatturato stimato/generato.
5. Sezione amministrativa.
6. AI suggerimenti (richiede Lovable Cloud).

Confermi di procedere con tutti e 6 i passi (incluso attivare Lovable Cloud per l'AI), oppure vuoi che mi fermi prima dell'AI?
