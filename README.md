# Badiani Training Orbit — Guida Tecnica Completa

> **Scopo di questo file:** Riferimento completo per chiunque debba modificare l'app.
> Contiene architettura, regole di gamification, inventario pagine/card, design tokens,
> sistema i18n, BERNY AI, localStorage keys e checklist per le modifiche.
> **Aggiornato:** Marzo 2026

---

## Indice

- [Architettura](#architettura)
- [File principali](#file-principali)
- [Pagine e inventario card](#pagine-e-inventario-card)
- [Carousel IDs](#carousel-ids)
- [Gamification — regole complete](#gamification--regole-complete)
- [State management — localStorage keys](#state-management--localstorage-keys)
- [Profilo utente](#profilo-utente)
- [Sistema i18n](#sistema-i18n)
- [Design tokens CSS](#design-tokens-css)
- [Animazioni e keyframes](#animazioni-e-keyframes)
- [Media queries e breakpoint](#media-queries-e-breakpoint)
- [Data attributes critici](#data-attributes-critici)
- [BERNY AI assistant](#berny-ai-assistant)
- [Deep linking](#deep-linking)
- [Sicurezza](#sicurezza)
- [Search catalog](#search-catalog)
- [Struttura HTML di una card](#struttura-html-di-una-card)
- [Checklist per aggiungere contenuti](#checklist-per-aggiungere-contenuti)
- [Checklist per modifiche sicure](#checklist-per-modifiche-sicure)
- [Debug e testing](#debug-e-testing)
- [Note e avvertenze](#note-e-avvertenze)

---

## Architettura

**App statica multi-pagina** senza bundler/build. Vanilla JS con IIFE, stato in localStorage, gamification, AI assistant (BERNY tramite Gemini), i18n runtime in 4 lingue.

```
Browser ←→ HTML/CSS/JS statici ←→ localStorage (stato)
                                 ←→ Gemini API (BERNY, opzionale)
                                     via Cloudflare Worker proxy
```

**Nessun build step.** Modificare direttamente HTML/CSS/JS. Cache-busting: `?v=YYYYMMDD`.

---

## File principali

| File | Righe | Ruolo |
|------|-------|-------|
| `scripts/site.js` | ~16K | Motore core: navigazione, profilo, gamification, carousel, overlay, ricerca |
| `scripts/i18n.js` | ~8K | i18n runtime, 4 lingue (it/en/es/fr), dizionario completo |
| `styles/site.css` | ~11K | Design tokens, componenti, responsive, animazioni |
| `scripts/berny-brain-api.js` | ~3K | AI assistant, SDK/proxy Gemini, quiz DB, raccomandazioni |
| `scripts/berny-knowledge.js` | var | Knowledge base prodotti (italiano default) |
| `scripts/berny-super-knowledge.js` | var | KB generato da `build-tools/build_knowledge.py` |
| `scripts/berny-ui.js` | var | UI chat di BERNY |
| `scripts/berny-widget-controller.js` | var | Pulsante FAB e controller widget |
| `scripts/deep-link.js` | ~200 | Deep linking: `?q=keyword` → scroll + highlight card |
| `scripts/config.js` | ~10 | Endpoint proxy Berny, auth config |
| `scripts/i18n-manager.js` | var | Gestione runtime cambio lingua |
| `scripts/gelato-effects.js` | var | Effetti particellari canvas (celebrazioni) |
| `scripts/avatar-lab.js` | var | Generatore avatar utente |
| `scripts/search-catalog-seed.js` | var | Fallback statico catalogo ricerca |
| `styles/berny-chat.css` | var | Stili chat BERNY |
| `styles/berny-widget.css` | var | Stili widget FAB BERNY |
| `styles/dashboard.css` | var | Stili cockpit/dashboard |

---

## Pagine e inventario card

### index.html — Hub / Cockpit
- **Scopo:** Dashboard centrale: stats, profilo, storia, chat BERNY
- **Stars:** Nessuna (hub page)
- **Contenuto:** 6 hub-card (daily training, performance, totali, errori, storico, profilo)

### caffe.html — Coffee & Drinks
- **Stars dichiarate:** 35/35
- **Card totali:** 35 (30 prodotto + 5 procedura)
- **Carousel:** `caffe-hot`, `caffe-matcha`, `caffe-cold`, `caffe-smoothies-juices` (prodotti) + `caffe-ops` (procedure)

| # | Card ID | Tipo |
|---|---------|------|
| 1 | `card-espresso-single` | Prodotto |
| 2 | `card-espresso-double` | Prodotto |
| 3 | `card-macchiato-single` | Prodotto |
| 4 | `card-macchiato-double` | Prodotto |
| 5 | `card-americano` | Prodotto |
| 6 | `card-cappuccino` | Prodotto |
| 7 | `card-flat-white` | Prodotto |
| 8 | `card-mocha` | Prodotto |
| 9 | `card-hot-chocolate` | Prodotto |
| 10 | `card-chai-latte` | Prodotto |
| 11 | `card-tea` | Prodotto |
| 12 | `card-afternoon-tea` | Prodotto |
| 13 | `card-affogato` | Prodotto |
| 14 | `card-whipped-coffee` | Prodotto |
| 15 | `card-british-hot-chocolate` | Prodotto |
| 16 | `card-matcha-latte` | Prodotto |
| 17 | `card-iced-matcha` | Prodotto |
| 18 | `card-matcha-affogato` | Prodotto |
| 19 | `card-dirty-matcha` | Prodotto |
| 20 | `card-iced-americano` | Prodotto |
| 21 | `card-iced-latte` | Prodotto |
| 22 | `card-pistachio-iced-latte` | Prodotto |
| 23 | `card-dolcevita-iced-latte` | Prodotto |
| 24 | `card-smoothie-giallo-passion` | Prodotto |
| 25 | `card-smoothie-rosso-berry` | Prodotto |
| 26 | `card-smoothie-verde-boost` | Prodotto |
| 27 | `card-energy-booster` | Prodotto |
| 28 | `card-sweet-beet` | Prodotto |
| 29 | `card-get-clean` | Prodotto |
| 30 | `card-orange-juice` | Prodotto |
| 31 | `card-prep-matcha-premade-una-volta-al-giorno` | Procedura |
| 32 | `card-setting-iced-matcha-latte-standard` | Procedura |
| 33 | `card-smoothies-parametri-di-produzione` | Procedura |
| 34 | `card-storage-matcha-premade-haccp` | Procedura |
| 35 | `card-chiusura-stazione-matcha-blender` | Procedura |

### gelato-lab.html — Gelato Lab
- **Stars dichiarate:** 8/8
- **Card totali:** 10
- **Carousel:** `gelato-lab` (prodotti) + `gelato-lab-ops` (procedure)

| # | Card ID | Tipo |
|---|---------|------|
| 1 | `card-cups` | Prodotto |
| 2 | `card-cones` | Prodotto |
| 3 | `card-boxes` | Prodotto |
| 4 | `card-coppa-gelato` | Prodotto |
| 5 | `card-gelato-setup` | Procedura |
| 6 | `card-temperatura-porte-standard` | Procedura |
| 7 | `card-shelf-life-treats-dopo-esposizione` | Procedura |
| 8 | `card-gestione-treat-freezer` | Procedura |
| 9 | `card-regola-scampolo-1-4-pan` | Procedura |
| 10 | `card-chiusura-deep-clean-vetrina` | Procedura |

### pastries.html — Pastry Lab
- **Stars dichiarate:** 6/6
- **Card totali:** 10
- **Carousel:** `pastries` (prodotti) + `pastries-ops` (procedure)

| # | Card ID | Tipo |
|---|---------|------|
| 1 | `card-cakes` | Prodotto |
| 2 | `card-brownie` | Prodotto |
| 3 | `card-loaf` | Prodotto |
| 4 | `card-croissants` | Prodotto |
| 5 | `card-scones` | Prodotto |
| 6 | `card-set-up-vetrina-look-ordine` | Procedura |
| 7 | `card-tagli-standard-porzionatura` | Procedura |
| 8 | `card-shelf-life-quick-list` | Procedura |
| 9 | `card-come-mantenerla-sempre-piena` | Procedura |
| 10 | `card-chiusura-vetrina-routine` | Procedura |

### sweet-treats.html — Sweet Treat Atelier
- **Stars dichiarate:** 15/15
- **Card totali:** 15
- **Carousel:** `sweet-treats` (prodotti) + `sweet-treats-ops` (procedure)

| # | Card ID | Tipo |
|---|---------|------|
| 1 | `card-crepe-sauce` | Prodotto |
| 2 | `card-buontalenti-crepe` | Prodotto |
| 3 | `card-waffles` | Prodotto |
| 4 | `card-pancake` | Prodotto |
| 5 | `card-italiana-plain` | Prodotto |
| 6 | `card-italiana-beetroot` | Prodotto |
| 7 | `card-prosciutto-plain` | Prodotto |
| 8 | `card-prosciutto-beetroot` | Prodotto |
| 9 | `card-gelato-burger` | Prodotto |
| 10 | `card-gelato-croissant` | Prodotto |
| 11 | `card-checklist-apertura-stazioni` | Procedura |
| 12 | `card-settaggi-macchine-standard` | Procedura |
| 13 | `card-shelf-life-storage-rapidi` | Procedura |
| 14 | `card-porzionatura-dosi-quick-ref` | Procedura |
| 15 | `card-chiusura-pulizia-rapida` | Procedura |

### festive.html — Seasonal (Panettoni, Cioccolata Calda, Colomba)
- **Stars dichiarate:** 7/7
- **Card totali:** 7
- **Carousel:** `festive-products` (prodotti) + `festive-ops` (procedure)

| # | Card ID | Tipo |
|---|---------|------|
| 1 | `card-panettone-classico` | Prodotto |
| 2 | `card-panettone-dark-chocolate` | Prodotto |
| 3 | `card-pandoro-classico` | Prodotto |
| 4 | `card-servizio-caldo-pandoro` | Prodotto |
| 5 | `card-hot-chocolate-seasonal` | Prodotto |
| 6 | `card-colomba` | Prodotto |
| 7 | `card-packaging-mini-panettone-delivery` | Procedura |

### operations.html — Operations & Setup
- **Stars dichiarate:** 14/14
- **Card totali:** 14
- **Carousel:** `operations-routines` (apertura/afternoon/chiusura) + `operations-bts` (Behind The Scenes) + `operations-tech` (dati tecnici)

| # | Card ID | Tipo |
|---|---------|------|
| 1 | `card-ops-opening` | Routine |
| 2 | `card-ops-afternoon` | Routine |
| 3 | `card-ops-closing` | Routine |
| 4 | `card-bts-weekly` | BTS |
| 5 | `card-bts-google-forms` | BTS |
| 6 | `card-bts-monthly` | BTS |
| 7 | `card-bts-quarterly-audit` | BTS |
| 8 | `card-temperature-chiave-quick-map` | Tecnico |
| 9 | `card-fifo` | Tecnico |
| 10 | `card-batch-mix` | Tecnico |
| 11 | `card-shelf-life-rapidi-mix-premade` | Tecnico |
| 12 | `card-filters-defrost` | Tecnico |
| 13 | `card-discounts-promos` | Tecnico |
| 14 | `card-troubleshooting` | Tecnico |

### story-orbit.html — Story Orbit Badiani 1932
- **Stars dichiarate:** 0/5 (no scoring)
- **Card totali:** 0 (usa `.story-card` con accordion, non `.guide-card`)
- **Nessun carousel standard** — esperienza immersiva timeline/accordion

### quiz-solution.html — Quiz Solution
- **Scopo:** Pagina dinamica per mostrare feedback quiz con spiegazione, tip e revisione
- **Nessuna card o carousel** — contenuto iniettato via URL params

---

## Carousel IDs

| Pagina | Carousel ID | Contenuto |
|--------|------------|-----------|
| index.html | `cockpit` | Hub cards (daily, stats, profilo) |
| caffe.html | `caffe-hot` | Hot Coffee & British Hot Chocolate (15 cards) |
| caffe.html | `caffe-matcha` | Matcha Bar (4 cards) |
| caffe.html | `caffe-cold` | Cold Coffee (4 cards) |
| caffe.html | `caffe-smoothies-juices` | Smoothies & Juices (7 cards) |
| caffe.html | `caffe-ops` | Procedure matcha/blender/storage (5 cards) |
| gelato-lab.html | `gelato-lab` | Coppette, coni, boxes, coppa |
| gelato-lab.html | `gelato-lab-ops` | Setup vetrina, temperature, shelf life |
| pastries.html | `pastries` | Cakes, brownie, loaf, croissant, scones |
| pastries.html | `pastries-ops` | Setup vetrina, tagli, shelf life, chiusura |
| sweet-treats.html | `sweet-treats` | Crepe, waffle, pancake, burger, gelato |
| sweet-treats.html | `sweet-treats-ops` | Checklist, settaggi, shelf life, chiusura |
| festive.html | `festive-products` | Panettone, pandoro, cioccolata calda, colomba |
| festive.html | `festive-ops` | Setup macchina, conservazione, pulizia, packaging |
| operations.html | `operations-routines` | Routine apertura, afternoon, chiusura |
| operations.html | `operations-bts` | Behind The Scenes (weekly, Google Forms, monthly, audit) |
| operations.html | `operations-tech` | Temperature, FIFO, batch & mix, shelf life, filters, promo, troubleshooting |

**Totale: 17 carousel** su 7 pagine prodotto + 1 cockpit.

---

## Gamification — regole complete

### Flusso cristalli → stelle → gelato

```
TAB APERTO ──→ +1 cristallo (per card, per giorno)
     │
     ▼
5 CRISTALLI ──→ +1 stella (per card, max 1 stella/card/giorno)
     │
     ▼
OGNI 3 STELLE ──→ MINI QUIZ (1 domanda)
     │
     ├─ ✅ Corretto → +1 credito "Test me"
     │
     └─ ❌ Sbagliato → -3 stelle
     │
     ▼
TEST ME (7 domande) ── richiede 1 credito "Test me"
     │
     ├─ ✅ 7/7 perfetto → +1 gelato + cooldown 24h
     │
     └─ ❌ Qualsiasi errore → RESET (stelle=0, cristalli=0, crediti=0)
     │                        → redirect a quiz-solution.html
     ▼
65 STELLE TOTALI ──→ LOOP COMPLETO
     │
     └─ Reset stelle/cristalli/crediti a 0
        +5 bonus points (convertibili in cash/prodotti)
        Reset cooldown reductions
```

### Cooldown gelato
- **Default:** 24h tra un gelato e il successivo
- **Riduzione a 12h:** sbloccata automaticamente a 12 stelle totali
- **Riduzione a 3h:** sbloccata automaticamente a 30 stelle totali
- **Tracking:** `lastGelatoTs`, `cooldownReductionMs`, `cooldownCuts`

### Reset settimanale
- **Quando:** Domenica 00:00 (tracciato con `dayStamp` formato `YYYY-MM-DD`)
- **Cosa si resetta:** stelle, cristalli, quizToken, testMeCredits, opened/context tracking
- **Cosa si salva:** snapshot nella `history.days` (ultimi 90 giorni)
- **Cosa NON si resetta:** `bonusPoints`, `gelati`, `history.totals`

### Mini-quiz (1 domanda ogni 3 stelle)
1. Tenta generazione AI con BERNY (basata sulle schede studiate)
2. Fallback: pool super-easy (sm-001..sm-100)
3. Risposta corretta → +1 `testMeCredit`
4. Risposta sbagliata → -3 stelle + review modal

### Test Me (7 domande = gelato)
1. Mix: 2 super-easy + 1 generata da BERNY (o fallback easy)
2. 7/7 perfetto → gelato + cooldown
3. Qualsiasi errore → reset totale stelle/cristalli/crediti + redirect a quiz-solution.html

### Bonus points
- **65 stelle = 1 loop completo** → +5 bonus points
- I bonus points sono cumulativi e non si resettano con la settimana
- Convertibili in cash/prodotti

---

## State management — localStorage keys

### Profilo
| Key | Tipo | Contenuto |
|-----|------|-----------|
| `badianiUser.profile.v1` | JSON | Profilo attivo: `{id, nickname, gelato, createdAt, updatedAt}` |
| `badianiUser.profiles` | JSON | Array di tutti i profili (storico) |
| `badiani_user_avatar` | string | Avatar base64 cached |

### Gamification (per profilo)
| Key | Tipo | Contenuto |
|-----|------|-----------|
| `badianiGamification.v3:<profileId>` | JSON | Stato gamification completo (vedi sotto) |
| `badiani-completion:<profileId>` | JSON | Tracking card aperte/stellate per pagina |
| `badiani-opened-today:<profileId>` | JSON | Card aperte questa settimana |
| `badiani-starred-today:<profileId>` | JSON | Card con stelle convertite questa settimana |

### Proprietà dello stato gamification
| Proprietà | Tipo | Significato |
|-----------|------|-------------|
| `stars` | number | Stelle correnti (0-65) |
| `crystals` | number | Legacy (compatibilità) |
| `quizTokens` | number | Alias per stelle (check ogni-3) |
| `testMeCredits` | number | Crediti per quiz hard |
| `gelati` | number | Gelati guadagnati totali |
| `bonusPoints` | number | Punti bonus totali (5 per loop) |
| `celebratedSets` | number | Milestone 3-stelle mostrate in UI |
| `openedToday` | object | `{cardId: true}` — card aperte oggi |
| `openedTabsToday` | object | `{cardId::tabName: {count, ts}}` — conteggio tab |
| `openedTabContextToday` | object | `{cardId::tabName: {ts, pageSlug, cardTitle, tabTitle, content}}` |
| `cardCrystalConvertedAtToday` | object | `{cardId: count}` — cristalli convertiti |
| `cardStarAwardedToday` | object | `{cardId: true}` — stella assegnata |
| `dayStamp` | string | `YYYY-MM-DD` (domenica corrente, trigger reset) |
| `lastGelatoTs` | number | Timestamp ultimo gelato (inizio cooldown) |
| `cooldownReductionMs` | number | Riduzione cooldown applicata |
| `pendingCooldownMs` | number | Riduzione per prossimo gelato |
| `cooldownCuts` | object | `{twelve: bool, thirty: bool}` — riduzioni sbloccate |
| `askedQuestions` | array | ID domande challenge chieste (shuffle bag) |
| `questionBagByMode` | object | `{modeKey: [usedIds]}` — storico domande per modalità |
| `history` | object | `{quiz: [], days: [], totals: {stars, gelati, bonusPoints}}` |

### UI e lingua
| Key | Tipo | Contenuto |
|-----|------|-----------|
| `badianiUILang.v1` | string | Lingua corrente: `it`/`en`/`es`/`fr` |
| `user-language` | string | Legacy alias lingua |

### BERNY
| Key | Tipo | Contenuto |
|-----|------|-----------|
| `badianiBerny.config.v1` | JSON | `{provider, proxyEndpoint}` |
| `badianiBerny.accessCode.v1` | string | Codice accesso opzionale per proxy |
| `berny_api_key` | string | Chiave API Gemini (solo SDK mode) |
| `badianiBerny.lastRecommendation.v1` | JSON | Ultima raccomandazione (anti-ripetizione) |

### Ricerca e cache
| Key | Tipo | Contenuto |
|-----|------|-----------|
| `badianiSearchCatalog.v1` | JSON | Catalogo dinamico dalla scansione pagina |
| `badiani-search-catalog-used:<lang>` | bool | Lingue cachate |

### Session/temporanei
| Key | Tipo | Contenuto |
|-----|------|-----------|
| `badianiMiniQuiz.pendingQuestion` | JSON (session) | Quiz mini in attesa (TTL 1h) |
| `badiani.pending-question` | JSON | Backup legacy quiz pending |

---

## Profilo utente

### Struttura dati
```javascript
{
  id: string,        // ID unico (timestamp o UUID)
  nickname: string,  // Nome visualizzato
  gelato: string,    // Conteggio gelati (display)
  createdAt: number, // Timestamp creazione
  updatedAt: number  // Timestamp ultima modifica
}
```

### API `BadianiProfile` (globale)
| Metodo | Firma | Scopo |
|--------|-------|-------|
| `getActive()` | `() → Profile\|null` | Profilo attivo corrente |
| `getProfiles()` | `() → Profile[]` | Tutti i profili salvati |
| `setActive(profile)` | `(Profile) → Profile` | Imposta attivo e salva nella lista |
| `updateActive(patch)` | `({nickname?, gelato?}) → Profile` | Aggiorna parziale profilo attivo |
| `logout()` | `() → void` | Rimuove profilo attivo |
| `dispatchUpdated(profile)` | `(Profile) → void` | Emette evento `badiani:profile-updated` |

### Validazione
- Stringhe normalizzate via `normalizeText()` (trim, to-string)
- Profili null/invalidi rifiutati
- `createdAt` preservato nelle update (non sovrascritto)

---

## Sistema i18n

### Lingue supportate
`it` (default), `en`, `es`, `fr` — ~2000+ chiavi per lingua

### Marcatori DOM
| Attributo | Effetto |
|-----------|---------|
| `data-i18n="key"` | Sostituisce `textContent` |
| `data-i18n-html="key"` | Sostituisce `innerHTML` |
| `data-i18n-attr="nomeAttr:key"` | Sostituisce valore di un attributo |

### Categorie chiavi dizionario

**UI Framework:**
- `assistant.*` — Saluti e UI di BERNY
- `lang.*` — Etichette lingua
- `common.*` — Elementi generici (chiudi, copiato...)
- `loading.*` — Messaggi caricamento

**Sezioni pagina:**
- `operations.*` — Operations & Setup
- `caffe.*` — Coffee & Drinks (caffè, matcha, smoothie)
- `sweetTreats.*` — Sweet Treat Atelier
- `pastries.*` — Pastry Lab
- `gelatoLab.*` — Gelato Lab (include Yo-Yo)
- `festive.*` — Seasonal (Panettoni, Cioccolata Calda, Colomba)
- `storyOrbit.*` — Brand history

**Game/Quiz:**
- `quiz.*` — Mini quiz, test me, challenge
- `game.*` — Regole, milestone, bonus
- `tokens.*` — Stelle, gelato, bonus
- `challenge.*` — Flusso challenge in corso

**Navigazione/Profilo:**
- `nav.*` — Menu, bottoni navigazione
- `profile.*` — Gate signup/login, errori, conferme
- `modal.tab.*` — Tab interni card (Overview, Specs, Recipe, etc.)

**Card generici:**
- `card.*` — Etichette pulsanti card (Procedura, Checklist, Tips, Step & TW, etc.)
- `carousel.*` — Header ARIA carouselli

### Pattern chiave i18n per card
```
<sezione>.cards.<cardKey>.title   → titolo card
<sezione>.cards.<cardKey>.desc    → descrizione breve
<sezione>.cards.<cardKey>.stats   → stat-list HTML
<sezione>.cards.<cardKey>.details → contenuto espanso HTML
```

### Aggiungere un testo tradotto
1. Aggiungi la chiave a **tutti e 4** i dizionari (it/en/es/fr) in `i18n.js`
2. Segna l'HTML con `data-i18n="tuaChiave"` (o `data-i18n-html` per HTML)
3. I nomi brand (Buontalenti) **non si traducono** a meno che abbiano chiave dedicata

### Cambio lingua
- Salva in localStorage → re-applica tutte le traduzioni in-place (no reload)
- Emette evento `badiani:lang-changed`

---

## Design tokens CSS

### Colori brand (`:root`)
| Variabile | Valore | Uso |
|-----------|--------|-----|
| `--brand-blue` | `#214098` | Primario |
| `--brand-rose` | `#ec418c` | Accento rosa |
| `--brand-gold` | `#f2be58` | Accento oro |
| `--brand-gray` | `#4f515e` | Testo secondario |
| `--brand-gray-soft` | `#6b7082` | Testo morbido |

### Sfondi
| Variabile | Valore |
|-----------|--------|
| `--paper` | `#fff` |
| `--paper-soft` | `#fff8f0` |
| `--card` | `rgba(255,255,255,0.98)` |

### Alias semantici
| Variabile | Valore | Uso |
|-----------|--------|-----|
| `--ink` | `var(--brand-blue)` | Testo principale |
| `--ink-soft` | `var(--brand-gray)` | Testo soft |
| `--sky` | `rgba(236,65,140,0.18)` | Background rosa trasparente |
| `--sky-mid` | `var(--brand-rose)` | Rosa medio |
| `--blush` | `rgba(242,190,88,0.18)` | Background oro trasparente |
| `--sun` | `var(--brand-gold)` | Oro pieno |

### Spazio (scala)
| Variabile | Desktop | Tablet (≤768px) |
|-----------|---------|-----------------|
| `--space-1` | 6px | 4px |
| `--space-2` | 12px | 6px |
| `--space-3` | 18px | 10px |
| `--space-4` | 24px | 14px |
| `--space-5` | 32px | 18px |

### Carousel e card
| Variabile | Valore |
|-----------|--------|
| `--carousel-card-basis` | `clamp(260px, 85vw, 320px)` |
| `--carousel-track-gap` | 24px (desktop), 16px (768px), 12px (480px) |
| `--guide-card-padding` | 18px |
| `--guide-card-title-size` | 24px |

### Animazioni
| Variabile | Valore |
|-----------|--------|
| `--anim-fast` | 180ms |
| `--anim-slow` | 420ms |

### Tipografia
| Variabile | Valore |
|-----------|--------|
| `--font-regular` | `"supergroteskc-medlf", Arial, sans-serif` |
| `--font-medium` | `"supergroteskc-medlf", Arial, sans-serif` |

### Font-face (3 font)
- `SuperGrotesk-Regular` → `fonts/SuperGroteskA-Rg.otf`
- `SuperGrotesk-Medium` → `fonts/SuperGroteskC-Medium.otf`
- `SuperGrotesk-MedLF` → `fonts/SuperGC-MedLF.otf`

**Regola:** Nuovi stili devono usare le variabili esistenti, mai valori hardcoded.

---

## Animazioni e keyframes

| Nome | Uso |
|------|-----|
| `badgePulse` | Pulsazione badge token |
| `bernyPulse` | Pulsazione avatar BERNY |
| `bernyBounce` | Rimbalzo avatar BERNY |
| `bernyDotBounce` | Puntini "sta scrivendo" |
| `bernyWiggle` | Oscillazione widget FAB |
| `bernyBubbleSlide` | Slide bolla messaggio |
| `bernyMessageSlide` | Slide messaggio chat |
| `bernyTypingWidth` | Animazione larghezza typing |
| `bernyDotPulse` | Pulsazione puntini typing |
| `bernyType` | Effetto macchina da scrivere |
| `xIconShift` | Animazione close button (X) |
| `pulse` | Pulsazione generica |
| `fadeInShort` | Fade in breve |
| `optionFadeIn` | Fade in opzioni quiz |
| `slotRoll` | Rolling contatore cifre |
| `slotPulse` | Pulsazione contatore |
| `quizSlide` | Slide domanda quiz |
| `cardFlash` | Flash card highlight |
| `starBurst` | Esplosione stella (celebrazione) |
| `berny-highlight-pulse` | Deep-link: pulse + box-shadow oro (4500ms) |

---

## Media queries e breakpoint

| Breakpoint | Uso |
|------------|-----|
| `max-width: 860px` + landscape | Blocca landscape sui telefoni (overlay "ruota") |
| `max-width: 768px` | Layout tablet (spacing ridotto) |
| `max-width: 600px` | Raffinamenti mobile |
| `max-width: 480px` | Telefoni piccoli |
| `min-width: 720px` | Desktop intermedio |
| `min-width: 1080px` | Desktop grande |

**Nota:** L'app è progettata portrait-first per dispositivi mobili.

---

## Data attributes critici

> Tutto il JS si lega ai data attributes. **Rimuoverli rompe la funzionalità.**

### Carousel
| Attributo | Scopo |
|-----------|-------|
| `data-carousel="id"` | Wrapper carousel |
| `data-carousel-track` | Contenitore scrollabile |
| `data-carousel-item` | Singola card nel carousel |
| `data-carousel-header` | Header con titolo/descrizione |

### Card e contenuto
| Attributo | Scopo |
|-----------|-------|
| `data-toggle-card` | Pulsante espansione `.details` |
| `data-reward-id` | ID stabile card per tracking gamification |
| `data-tab="nome"` | Tab button/content |
| `data-tabs-container` | Wrapper tabs |
| `data-guide-card` | Wrapper guide card |

### Navigazione e menu
| Attributo | Scopo |
|-----------|-------|
| `data-menu-toggle` | Pulsante hamburger |
| `data-menu-drawer` | Drawer full-screen (pagine) |
| `data-menu-panel` | Panel modale (hub) |
| `data-menu-close` | Pulsante chiudi |
| `data-menu-search` | Input ricerca |
| `data-menu-suggestions` | Container suggerimenti |
| `data-menu-search-btn` | Pulsante ricerca |

### BERNY nel menu
| Attributo | Scopo |
|-----------|-------|
| `data-menu-assistant` | UI assistant nel menu |
| `data-menu-assistant-avatar` | Avatar BERNY |
| `data-menu-assistant-message` | Chat display |
| `data-menu-assistant-actions` | Pulsanti azione |
| `data-menu-assistant-examples` | Prompt esempio |
| `data-menu-assistant-clear` | Cancella ricerca |

### Token e popover
| Attributo | Scopo |
|-----------|-------|
| `data-nav-tokens` | Shell container token |
| `data-star-token`, `data-star-value`, `data-star-progress` | Token stelle + progresso |
| `data-gelato-token`, `data-gelato-value` | Token gelato |
| `data-bonus-token`, `data-bonus-value` | Token bonus |
| `data-popover-toggle="id"` | Trigger popover (stars/gelato/bonus) |
| `data-popover-panel="id"` | Contenuto popover |
| `data-info-launch` | Apre modale regole gioco |
| `data-quiz-launch` | Avvia mini/test quiz |
| `data-cooldown-hint` | Messaggio timer cooldown |
| `data-countdown`, `data-countdown-value` | Display countdown HH:MM:SS |

### Overlay e modali
| Attributo | Scopo |
|-----------|-------|
| `data-overlay-content` | Wrapper contenuto modale |
| `data-overlay-close` | Pulsante chiudi modale |
| `data-overlay-focus` | Auto-focus on open |
| `data-lock-close` | Impedisce chiusura (quiz in corso) |

### Story Orbit
| Attributo | Scopo |
|-----------|-------|
| `data-story-target` | Link trigger card |
| `data-story-panel` | Contenuto modale |
| `data-story-modal` | Overlay fullscreen |
| `data-story-fullscreen` | Area media |
| `data-story-card` | Container story card |
| `data-story-chapter` | Numero capitolo |

### Dashboard / hub
| Attributo | Scopo |
|-----------|-------|
| `data-summary` | Sezione cockpit stats |
| `data-perf-stars` | Stelle oggi |
| `data-perf-gelati` | Gelati totali |
| `data-perf-points` | Bonus points |
| `data-perf-quiz-correct` | Quiz corretti |
| `data-perf-quiz-wrong` | Quiz sbagliati |
| `data-wrong-list` | Lista errori recenti |
| `data-wrong-count` | Conteggio errori |
| `data-wrong-view-all` | Vedi tutti gli errori |
| `data-history-days` | Storico giornaliero |

### Profilo
| Attributo | Scopo |
|-----------|-------|
| `data-profile-nick` | Display nickname |
| `data-profile-gelato` | Display gelati |
| `data-allow-copy` | Whitelist copia (form, input) |

### i18n
| Attributo | Scopo |
|-----------|-------|
| `data-i18n="chiave"` | Text content tradotto |
| `data-i18n-html="chiave"` | innerHTML tradotto |
| `data-i18n-attr="attr:chiave"` | Attributo tradotto (es. aria-label) |

### Effetti
| Attributo | Scopo |
|-----------|-------|
| `data-fx-layer` | Canvas effetti particellari |
| `data-page-stars` | Badge stelle nella hero section |

---

## BERNY AI assistant

### Modalità di funzionamento
| Modalità | Descrizione |
|----------|-------------|
| **Proxy** (produzione) | Cloudflare Worker a `window.BERNY_PROXY_ENDPOINT` — chiave API server-side |
| **SDK** (sviluppo) | Chiave Gemini in `berny_api_key` localStorage, modello `gemini-2.0-flash-exp` |

**Selezione:** Usa proxy se endpoint disponibile; fallback a SDK.

### Quiz DB
- `QUESTIONS_DB`: ~26 domande per lingua (it/en/es/fr) embedded nel file
- Formato: `{text: "Question with A) B) C) D) options", answer: "B"}`
- Copertura: ricette, temperature, shelf life, procedure, prodotti

### Motore raccomandazioni
1. Estrae prodotto principale dalla risposta (`extractMainProductFromResponse`)
2. Se non chiaro, inferisce dai keyword utente (`inferRecommendationFromMessage`)
3. Fallback: richiede chiarimento

### Generazione link
- Singolo: `[[LINK:href]]` appeso al messaggio
- Multiplo: `[[LINKS:[{url, label}, ...]]]` (max 3)
- Soppresso: `[[NOLINK]]` token

### Knowledge base
- `berny-knowledge.js`: KB italiano default (prodotti, procedure, FAQ)
- `berny-super-knowledge.js`: generato da `python build-tools/build_knowledge.py` (scansiona HTML/txt/quiz)

### Widget
- `berny-widget-controller.js`: gestisce pulsante FAB
- `berny-ui.js`: logica UI chat
- Stili: `berny-chat.css` + `berny-widget.css`

---

## Deep linking

### Parametri URL
- `?q=keyword` → cerca e scrolla alla card corrispondente
- `?card=cardId&tab=tabName&center=1` → apre card specifica con tab

### Strategia matching (4 livelli di priorità)
1. **ID esatto:** `getElementById('card-' + query)` o `getElementById(query)`
2. **Titolo esatto:** `<h3>` della card normalizzato === query normalizzato
3. **Titolo parziale:** titolo contiene query normalizzato
4. **Data attribute:** match su `data-type`

### Normalizzazione
```javascript
normalize(s) = s.toLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '') // rimuovi diacritici
  .replace(/[^a-z0-9]/g, '')       // solo alfanumerici
// Esempio: "Crêpe" → "crepe", "Caffè" → "caffe"
```

### Scroll (2 fasi)
1. **Verticale:** carousel → `scrollIntoView({behavior: 'smooth', block: 'center'})`
2. **Orizzontale (500ms delay):** card → `scrollIntoView({...inline: 'center'})`

### Feedback visivo
- Classe CSS `berny-highlight-pulse` (4500ms, poi rimossa)
- Fallback inline: `scale(1.02)` + glow oro (2000ms)

---

## Sicurezza

### Zoom lock
- Blocca: touch pinch, double-tap zoom, Ctrl+wheel zoom
- Scopo: UI consistente, impedire accesso a contenuto nascosto

### Copy/paste protection
- Blocca globalmente: copy, cut, paste, selectstart, dragstart, contextmenu
- **Eccezioni:** `<input>`, `<textarea>`, `<select>`, `[contenteditable]`, `[data-allow-copy]`, `.allow-copy`
- Scopo: protezione contenuto training da redistribuzione

### Production logger
- In produzione (non localhost): `console.log` e `console.warn` silenziati
- `console.error` sempre visibile
- Sblocco debug: `window.__enableBadianiLogs()`

### Storage
- Try/catch su tutti gli accessi localStorage/sessionStorage
- Fallback a sessionStorage o `window.name`
- Nessuna crittografia (browser storage non sicuro contro XSS)
- Validazione al caricamento (dati corrotti → stato fresh)

### Dati sensibili
- Nessuna password in localStorage
- Chiavi API solo server-side (Cloudflare Worker)
- Profile ID assegnati dall'utente (non segreti)

---

## Search catalog

~63+ prodotti registrati, organizzati per categoria con link alla pagina e card ID.

### Struttura oggetto prodotto
```javascript
{
  name: string,         // Chiave ricerca normalizzata (lowercase)
  label: string,        // Label display (visibile utente)
  category: string,     // Categoria (es. "Caffè Rituals")
  categoryHref: string, // URL pagina (es. "caffe.html")
  card: string,         // Card ID (opzionale)
  tab: string,          // Tab ID (opzionale)
  description: string   // Breve descrizione
}
```

### Categorie nel catalogo
- **Operations & Setup** (6): Routine apertura, Setup, Servizio Caldo, Packaging, Allestimento, Chiusura
- **Caffè Rituals** (19): Americano, Cappuccino, Flat White, Chai, Mocha, Hot Choc, Iced variants, Matcha, Smoothies
- **Sweet Treat Atelier** (11+5 ops): Crepe, Buontalenti, Waffles, Pancake, Porridge, Gelato Burger/Croissant, Afternoon Tea, Churros
- **Gelato Lab** (10+6 Yo-Yo): Coppette, Coni, Boxes, Coppa Gelato, Yo-Yo product + 5 procedure Yo-Yo
- **Pastry Lab** (5): Cakes, Brownie, Banana Loaf, Croissant, Scone
- **Seasonal** (7): Panettone, Pandoro, Cioccolata Calda, Colomba, Servizio Caldo, Packaging

**Aggiornamento:** Quando si aggiunge una nuova card, aggiungere anche il prodotto nell'array `allProducts` in `site.js` (linee ~2400+).

---

## Struttura HTML di una card

```html
<article class="guide-card guide-card--product" data-carousel-item id="card-UNIQUE-ID">

  <!-- Tag row (etichette colorate) -->
  <div class="tag-row">
    <span class="tag">Espresso</span>
    <span class="tag">Classic</span>
  </div>

  <!-- Titolo (con i18n) -->
  <h3 data-i18n="sezione.cards.cardKey.title">Titolo Card</h3>

  <!-- Media (picture con webp+jpg fallback) -->
  <figure class="guide-media">
    <picture>
      <source srcset="assets/products/nome.webp" type="image/webp" />
      <img src="assets/products/nome.jpg" alt="Descrizione" loading="lazy" />
    </picture>
  </figure>

  <!-- Descrizione breve -->
  <p data-i18n="sezione.cards.cardKey.desc">Descrizione del prodotto...</p>

  <!-- Stat list (ingredienti, temperature, etc.) -->
  <ul class="stat-list" data-i18n-html="sezione.cards.cardKey.stats">
    <li><strong>Tazza:</strong> 6 oz</li>
    <li><strong>Temp:</strong> 92 °C</li>
  </ul>

  <!-- Pulsante espansione -->
  <button class="btn-ghost" data-toggle-card
    data-i18n="card.stepsTw">Step &amp; TW</button>

  <!-- Dettagli (nascosti, rivelati da data-toggle-card) -->
  <div class="details" data-i18n-html="sezione.cards.cardKey.details">
    <div class="steps">
      <span>1 · Primo step</span>
      <span>2 · Secondo step</span>
    </div>
    <div class="pro-tip">
      <strong>Pro tip:</strong> Suggerimento utile
    </div>
    <div class="upsell-tip">
      <strong>Upsell:</strong> Proposta vendita
    </div>
  </div>

</article>
```

### Classi card
| Classe | Uso |
|--------|-----|
| `.guide-card` | Base card |
| `.guide-card--product` | Card prodotto |
| `.guide-card--procedure` | Card procedura operativa |
| `data-carousel-item` | Rende la card parte del carousel |

### Elementi interni
| Elemento | Scopo |
|----------|-------|
| `.tag-row` > `.tag` | Etichette colorate (categorie) |
| `h3[data-i18n]` | Titolo tradotto |
| `.guide-media` > `picture` | Immagine con source webp + fallback jpg |
| `p[data-i18n]` | Descrizione breve |
| `.stat-list[data-i18n-html]` | Lista statistiche (HTML tradotto) |
| `.btn-ghost[data-toggle-card]` | Pulsante che rivela `.details` |
| `.details[data-i18n-html]` | Contenuto espanso (passi, tip, upsell) |
| `.steps` > `span` | Step numerati (1 · ..., 2 · ...) |
| `.pro-tip` | Blocco tip rosa (`--brand-rose`) |
| `.upsell-tip` | Blocco upsell oro (`--brand-gold`) |

---

## Checklist per aggiungere contenuti

### Aggiungere una nuova card prodotto

- [ ] **1. HTML:** Clonare una `article.guide-card` esistente nella pagina target
  - Assegnare `id="card-nome-univoco"` unico
  - Aggiungere `data-carousel-item`
  - Inserire nel carousel corretto (`data-carousel-track`)
- [ ] **2. Stars:** Aggiornare `data-page-stars` nella hero section (n+1)
- [ ] **3. Media:** Aggiungere immagini in `assets/products/`
  - `.webp` + `.jpg` fallback (o `.png`)
  - Usare `<picture>` con `<source>` webp + `<img>` jpg
- [ ] **4. i18n:** Aggiungere chiavi in TUTTE e 4 le lingue (it/en/es/fr) in `i18n.js`
  - `sezione.cards.cardKey.title`
  - `sezione.cards.cardKey.desc`
  - `sezione.cards.cardKey.stats`
  - `sezione.cards.cardKey.details`
- [ ] **5. Search catalog:** Aggiungere il prodotto nell'array `allProducts` in `site.js` (~riga 2400+)
- [ ] **6. BERNY KB** (opzionale): Rigenerare super-knowledge
  ```bash
  python build-tools/build_knowledge.py
  ```
- [ ] **7. Cache-bust:** Aggiornare `?v=YYYYMMDD` negli `<link>` e `<script>` della pagina

### Aggiungere una nuova pagina

- [ ] Copiare struttura HTML da una pagina esistente (hero, carousel, footer, nav, scripts)
- [ ] Aggiungere la pagina nel menu drawer (tutte le pagine)
- [ ] Creare le chiavi i18n per hero, card, footer
- [ ] Registrare nel catalogo ricerca (`allProducts`)
- [ ] Aggiungere nel menu burger di index.html

---

## Checklist per modifiche sicure

### Prima di modificare

- [ ] **Leggere** la sezione del file che si vuole modificare (non supporre)
- [ ] **Non rimuovere** nessun `data-*` attribute — il JS si lega a questi
- [ ] **Non rinominare** classi CSS usate dal JS (`.guide-card`, `.details`, `.tag-row`, `.btn-ghost`, etc.)
- [ ] **Non modificare** la struttura del localStorage state senza aggiornare tutte le funzioni che lo leggono
- [ ] **Testare** sia in italiano che in almeno un'altra lingua (en)

### Modificare CSS

- [ ] Usare variabili CSS esistenti (`--brand-*`, `--space-*`, `--anim-*`)
- [ ] Non rimuovere le media query di landscape-lock
- [ ] Testare su viewport 320px, 375px, 768px, 1080px+

### Modificare gamification

- [ ] Non cambiare le costanti senza aggiornare anche i testi i18n (`game.*`, `tokens.*`)
- [ ] Verificare che `ensureDailyState()` gestisca la migrazione dei nuovi campi
- [ ] Testare il flusso completo: apertura tab → cristallo → stella → mini quiz → test me → gelato

### Modificare BERNY

- [ ] Testare sia in proxy mode che SDK mode
- [ ] Verificare che il fallback quiz funzioni se BERNY non risponde
- [ ] Controllare `QUESTIONS_DB` se si aggiungono domande (tutte e 4 le lingue)

---

## Debug e testing

### Reset profilo e stato
```javascript
// Reset completo (profilo + gamification)
localStorage.removeItem('badianiUser.profile.v1');
localStorage.removeItem('badianiUser.profiles');
// Nota: la chiave gamification include il profileId
// Per trovarla: cercare 'badianiGamification.v3:' nel localStorage
Object.keys(localStorage)
  .filter(k => k.startsWith('badianiGamification'))
  .forEach(k => localStorage.removeItem(k));
```

### Sbloccare log di debug in produzione
```javascript
window.__enableBadianiLogs();
```

### Selettori utili per UI
| Selettore | Cosa mostra |
|-----------|-------------|
| `[data-nav-tokens]` | Token display (stelle, gelati, bonus) |
| `[data-cooldown-hint]` | Messaggio cooldown gelato |
| `[data-daily-performance]` | Conteggio stelle oggi |
| `[data-summary]` | Carousel cockpit su index.html |
| `[data-star-value]` | Numero stelle corrente |
| `[data-gelato-value]` | Numero gelati corrente |
| `[data-bonus-value]` | Numero bonus corrente |

### Custom events da monitorare
| Evento | Trigger | Uso |
|--------|---------|-----|
| `badiani:profile-updated` | Cambio profilo | Sync UI profilo |
| `badiani:gamification-updated` | Cambio stato gioco | Reload stato da BERNY |
| `badiani:lang-changed` | Cambio lingua | Aggiorna badge post-switch |
| `i18nUpdated` | Traduzione applicata | Refresh testi dinamici |
| `avatar-updated` | Cambio avatar | Ricarica sprite |

### Test rapido gamification
1. Aprire una pagina con card (es. caffe.html)
2. Cliccare su 5 tab diversi di una card → dovrebbe comparire 1 stella
3. Ripetere per 3 card → è dovrebbe partire il mini quiz al 3° stella
4. Rispondere corretto → guadagnare credito "Test me"

---

## Note e avvertenze

### Discrepanze note
- **data-page-stars** non sempre allineato al numero reale di card:
  - `caffe.html` dichiara 18/18 ma ha 29 card (aggiunte matcha/smoothie dopo)
  - `operations.html` dichiara 0/6 ma ha 11 card
  - Verificare e aggiornare dopo modifiche

### Convenzioni di naming
- **Card ID:** `card-nome-descrittivo` (kebab-case, prefisso `card-`)
- **Carousel ID:** `nome-sezione` per prodotti, `nome-sezione-ops` per procedure
- **i18n key:** `sezione.cards.cardKey.campo` (dot-notation)
- **Asset:** `assets/products/nome.webp` + `.jpg`

### Tono del contenuto
- Stile training italiano: passi numerati concisi
- Tip upselling: blocco oro (`--brand-gold`)
- Pro tip: blocco rosa (`--brand-rose`)
- Separatori `<hr>` tra sezioni dentro `.details`

### Flusso inizializzazione pagina
```
DOMContentLoaded → {
  1. Logger + zoom lock + copy protection
  2. BadianiStorage + BadianiProfile inizializzati
  3. Stato gamification caricato (loadState, ensureDailyState)
  4. buildHub() → nav tokens + popover
  5. buildOverlay() → framework modale
  6. maybeAutoOpenGameInfoFromUrl() → ?open=regolamento
  7. updateUI() → render tutte le stats
  8. formatStatListLabels() → layout tweaks
  9. ensureWrongLogHandler() → modale revisione errori
  10. checkStarMilestones() → notifiche milestone
  11. Listen: badiani:gamification-updated (push da BERNY)
}
```

### Script caricati per tipo pagina

**index.html (hub):**
config.js, importmap Google AI, berny-knowledge.js, berny-super-knowledge.js, search-catalog-seed.js, berny-brain-api.js, berny-widget-controller.js, i18n.js, berny-ui.js, avatar-lab.js, lottie-player.js (ext), site.js, gelato-effects.js

**Pagine prodotto (caffe, gelato-lab, pastries, sweet-treats, festive, operations):**
config.js, i18n.js, i18n-manager.js, site.js, deep-link.js

---

*Questo documento è la fonte di verità per modificare l'app. Aggiornarlo quando si fanno modifiche strutturali.*
