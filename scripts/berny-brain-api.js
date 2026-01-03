// FILE: scripts/berny-brain-api.js
// Integrazione Google Gemini via SDK Ufficiale + Quiz System (Embedded Data)

class BernyBrainAPI {
  constructor() {
    const readGlobalProxyEndpoint = () => {
      // Preferred: configured by the page (so new users don't rely on localStorage state).
      // You can set this in index.html or a small config script.
      try {
        const w = (typeof window !== 'undefined') ? window : null;
        const raw = w ? (w.BERNY_PROXY_ENDPOINT || w.__BERNY_PROXY_ENDPOINT__ || '') : '';
        const s = String(raw || '').trim();
        return s;
      } catch {
        return '';
      }
    };

    // SECURITY: do not ship API keys in the frontend.
    // Configure proxy mode via:
    // localStorage.setItem('badianiBerny.config.v1', JSON.stringify({ provider:'proxy', proxyEndpoint:'https://<worker>/berny' }))
    let cfg = null;
    try {
      cfg = JSON.parse(localStorage.getItem('badianiBerny.config.v1') || 'null');
    } catch {
      cfg = null;
    }

    this.config = (cfg && typeof cfg === 'object') ? cfg : {};

    // Determine proxy endpoint:
    // 1) explicit localStorage config
    // 2) global configured endpoint (recommended for production)
    const configuredProxyEndpoint = String(this.config.proxyEndpoint || '').trim();
    const globalProxyEndpoint = readGlobalProxyEndpoint();
    this.proxyEndpoint = configuredProxyEndpoint || globalProxyEndpoint;

    this.mode = ((String(this.config.provider || '')).toLowerCase() === 'proxy' && this.proxyEndpoint)
      ? 'proxy'
      : (this.proxyEndpoint ? 'proxy' : 'sdk');

    // SDK mode requires the user to provide their own key (via /apikey) and the SDK script to be present.
    this.apiKey = '';
    if (this.mode === 'sdk') {
      try { this.apiKey = String(localStorage.getItem('berny_api_key') || '').trim(); } catch { this.apiKey = ''; }
    }

    // Optional: proxy access gate code (checked server-side by the Worker)
    this.accessCode = '';
    if (this.mode === 'proxy') {
      try { this.accessCode = String(localStorage.getItem('badianiBerny.accessCode.v1') || '').trim(); } catch { this.accessCode = ''; }
    }

    // Default model (only used for SDK mode)
    this.modelName = "gemini-2.0-flash-exp";
    this.history = [];
    this.genAI = null;
    this.model = null;

    // Recommendation state (to avoid always suggesting the same card)
    this.RECO_STORAGE_KEY = 'badianiBerny.lastRecommendation.v1';

    // Conversation memory (to keep multi-turn coherence + delayed suggestions)
    this.CONV_STORAGE_KEY = 'badianiBerny.conversationState.v1';
    this.MAX_HISTORY_TURNS = 8; // bounded to keep proxy payload small
    
    // QUIZ STATE
    this.quizState = { active: false, lang: 'it', questions: [], index: 0, correct: 0 };
    
    // EMBEDDED QUESTIONS DB (Bypasses CORS issues on file://)
    this.QUESTIONS_DB = {
      it: [
        { text: "Stai preparando il mix crepes \"BIG BATCH\": quale ingrediente deve essere esattamente 1500 ml?\nA) Acqua\nB) Latte intero\nC) Albume d'uovo\nD) Sciroppo d'acero", answer: "B" },
        { text: "Per il mix \"BIG BATCH\", quante uova sono necessarie nella ricetta standard?\nA) 6\nB) 8\nC) 9\nD) 12", answer: "C" },
        { text: "Per il mix \"SMALL BATCH\", quanta acqua è richiesta?\nA) 100 ml\nB) 200 ml\nC) 300 ml\nD) 500 ml", answer: "B" },
        { text: "Qual è la shelf life operativa del mix crepes una volta preparato?\nA) 1 giorno\nB) 2 giorni\nC) 3 giorni\nD) 7 giorni", answer: "C" },
        { text: "Signature Buontalenti Crepe: quanto pesa esattamente la pallina di gelato da aggiungere?\nA) 40 g\nB) 70 g\nC) 100 g\nD) 140 g", answer: "B" },
        { text: "Crepe salata \"Italiana\": quanti pomodorini interi (da tagliare poi) vanno inclusi?\nA) 1\nB) 2\nC) 3\nD) 6", answer: "C" },
        { text: "Waffle: qual è la dose esatta di pastella in ml per un waffle?\nA) 120 ml\nB) 150 ml\nC) 177 ml\nD) 250 ml", answer: "C" },
        { text: "Coppetta \"Piccola\": qual è il range di peso (grammatura) corretto?\nA) 80-100g\nB) 100-120g\nC) 120-140g\nD) 140-160g", answer: "B" },
        { text: "Coppetta \"Media\": qual è il range di peso corretto?\nA) 100-120g\nB) 120-140g\nC) 140-160g\nD) 160-180g", answer: "C" },
        { text: "Vaschetta d'asporto \"Grande\": qual è la sua capacità volumetrica?\nA) 500 ml\nB) 750 ml\nC) 1000 ml\nD) 1500 ml", answer: "C" },
        { text: "Churros: qual è la temperatura esatta della friggitrice?\nA) 170 °C\nB) 180 °C\nC) 190 °C\nD) 200 °C", answer: "C" },
        { text: "Slitti: in che anno è stata fondata l'azienda come torrefazione di caffè?\nA) 1932\nB) 1969\nC) 1990\nD) 1993", answer: "B" },
        { text: "Pralina Slitti Irish Coffee: qual è la percentuale di alcol contenuta?\nA) 0.5%\nB) 0.9%\nC) 1.5%\nD) 2.1%", answer: "B" },
        { text: "Spalmabile Gianera: qual è la percentuale di nocciole dichiarata?\nA) 37%\nB) 51%\nC) 57%\nD) 65%", answer: "C" },
        { text: "Mulled wine (Vin Brulé): quanto tempo deve riscaldare al livello 10 prima del servizio?\nA) 10-15 min\nB) 15-20 min\nC) 25-30 min\nD) 45-60 min", answer: "C" }
      ],
      en: [
        { text: "You are preparing the \"BIG BATCH\" crepe mix: which ingredient is 1500 ml?\nA) Water\nB) Whole milk\nC) Egg white\nD) Maple syrup", answer: "B" },
        { text: "\"BIG BATCH\": how many eggs go into the recipe?\nA) 6\nB) 8\nC) 9\nD) 12", answer: "C" },
        { text: "\"SMALL BATCH\": how much water is needed?\nA) 100 ml\nB) 200 ml\nC) 300 ml\nD) 500 ml", answer: "B" },
        { text: "After preparing the crepe mix, what is the minimum resting time in the fridge?\nA) 30 min\nB) 1 hour\nC) 2 hours\nD) 1 night", answer: "C" },
        { text: "Shelf life of the crepe mix:\nA) 1 day\nB) 2 days\nC) 3 days\nD) 7 days", answer: "C" },
        { text: "Signature Buontalenti Crepe: when is the right moment to flip it for the first time?\nA) When it is black\nB) When it is green\nC) When it becomes light brown\nD) When it smokes", answer: "C" },
        { text: "Signature Buontalenti Crepe: how many grams of Buontalenti must be added?\nA) 40 g\nB) 70 g\nC) 100 g\nD) 140 g", answer: "B" },
        { text: "Signature Buontalenti Crepe: how much sauce goes on top?\nA) 10 g\nB) 20 g\nC) 30 g\nD) 60 g", answer: "C" },
        { text: "Signature Sauce Crepe: what is never missing in the finish?\nA) Icing sugar\nB) Coarse salt\nC) Basil\nD) Pepper", answer: "A" },
        { text: "Savoury crepe \"Italiana\" (plain base): which ingredient is included?\nA) Rocket (rucola)\nB) Tuna\nC) Potatoes\nD) Mushrooms", answer: "A" },
        { text: "Savoury crepe \"Italiana\": how many whole cherry tomatoes are included (then cut into quarters)?\nA) 1\nB) 2\nC) 3\nD) 6", answer: "C" },
        { text: "Savoury crepe \"Prosciutto\" (plain base): how many slices of ham?\nA) 1\nB) 2\nC) 3\nD) 4", answer: "B" },
        { text: "Base beetroot: how much beetroot powder do you add to 250 g of mix?\nA) 1 g\nB) 3 g\nC) 6 g\nD) 10 g", answer: "B" },
        { text: "Waffle: which \"power\" setting is correct?\nA) 1\nB) 2\nC) 3\nD) 5", answer: "C" },
        { text: "Waffle: how much batter corresponds to \"one entire scoopful\"?\nA) 120 ml\nB) 150 ml\nC) 177 ml\nD) 250 ml", answer: "C" }
      ],
      es: [
        { text: "Estás preparando el mix de crepes \"BIG BATCH\": ¿qué ingrediente es de 1500 ml?\nA) Agua\nB) Leche entera\nC) Clara de huevo\nD) Sirope de arce", answer: "B" },
        { text: "\"BIG BATCH\": ¿cuántos huevos lleva la receta?\nA) 6\nB) 8\nC) 9\nD) 12", answer: "C" },
        { text: "\"SMALL BATCH\": ¿cuánta agua se necesita?\nA) 100 ml\nB) 200 ml\nC) 300 ml\nD) 500 ml", answer: "B" },
        { text: "Después de preparar el mix de crepes, ¿cuál es el tiempo mínimo de reposo en la nevera?\nA) 30 min\nB) 1 hora\nC) 2 horas\nD) 1 noche", answer: "C" },
        { text: "Shelf life del mix de crepes:\nA) 1 día\nB) 2 días\nC) 3 días\nD) 7 días", answer: "C" },
        { text: "Signature Buontalenti Crepe: ¿cuándo es el momento correcto para girarla por primera vez?\nA) Cuando está negra\nB) Cuando está verde\nC) Cuando se vuelve light brown\nD) Cuando echa humo", answer: "C" },
        { text: "Signature Buontalenti Crepe: ¿cuántos gramos de Buontalenti hay que añadir?\nA) 40 g\nB) 70 g\nC) 100 g\nD) 140 g", answer: "B" },
        { text: "Signature Buontalenti Crepe: ¿cuánta salsa va por encima (top)?\nA) 10 g\nB) 20 g\nC) 30 g\nD) 60 g", answer: "C" },
        { text: "Signature Sauce Crepe: ¿qué nunca falta en el acabado?\nA) Icing sugar (azúcar glas)\nB) Sal gruesa\nC) Albahaca\nD) Pimienta", answer: "A" },
        { text: "Crepe salada \"Italiana\" (plain base): ¿qué ingrediente está previsto?\nA) Rocket (rúcula)\nB) Atún\nC) Patatas\nD) Champiñones", answer: "A" },
        { text: "Crepe salada \"Italiana\": ¿cuántos tomatitos cherry enteros se prevén (luego en cuartos)?\nA) 1\nB) 2\nC) 3\nD) 6", answer: "C" },
        { text: "Crepe salada \"Prosciutto\" (plain base): ¿cuántas lonchas de jamón (ham)?\nA) 1\nB) 2\nC) 3\nD) 4", answer: "B" },
        { text: "Base beetroot: ¿cuánta beetroot powder añades a 250 g de mix?\nA) 1 g\nB) 3 g\nC) 6 g\nD) 10 g", answer: "B" },
        { text: "Waffle: ¿qué ajuste de \"power\" es correcto?\nA) 1\nB) 2\nC) 3\nD) 5", answer: "C" },
        { text: "Waffle: ¿cuánta masa corresponde a \"one entire scoopful\"?\nA) 120 ml\nB) 150 ml\nC) 177 ml\nD) 250 ml", answer: "C" }
      ],
      fr: [
        { text: "Tu prépares le mix crêpes \"BIG BATCH\" : quel ingrédient correspond à 1500 ml ?\nA) Eau\nB) Lait entier\nC) Blanc d’œuf\nD) Sirop d’érable", answer: "B" },
        { text: "\"BIG BATCH\" : combien d’œufs entrent dans la recette ?\nA) 6\nB) 8\nC) 9\nD) 12", answer: "C" },
        { text: "\"SMALL BATCH\" : quelle quantité d’eau faut-il ?\nA) 100 ml\nB) 200 ml\nC) 300 ml\nD) 500 ml", answer: "B" },
        { text: "Après avoir préparé le mix crêpes, quel est le temps minimum de repos au frigo ?\nA) 30 min\nB) 1 heure\nC) 2 heures\nD) 1 nuit", answer: "C" },
        { text: "Shelf life du mix crêpes :\nA) 1 jour\nB) 2 jours\nC) 3 jours\nD) 7 jours", answer: "C" },
        { text: "Signature Buontalenti Crepe : à quel moment faut-il la retourner pour la première fois ?\nA) Quand elle est noire\nB) Quand elle est verte\nC) Quand elle devient light brown\nD) Quand elle fume", answer: "C" },
        { text: "Signature Buontalenti Crepe : combien de grammes de Buontalenti faut-il ajouter ?\nA) 40 g\nB) 70 g\nC) 100 g\nD) 140 g", answer: "B" },
        { text: "Signature Buontalenti Crepe : quelle quantité de sauce va sur le dessus (top) ?\nA) 10 g\nB) 20 g\nC) 30 g\nD) 60 g", answer: "C" },
        { text: "Signature Sauce Crepe : quel élément ne manque jamais en finition ?\nA) Icing sugar (sucre glace)\nB) Gros sel\nC) Basilic\nD) Poivre", answer: "A" },
        { text: "Crêpe salée \"Italiana\" (plain base) : quel ingrédient est prévu ?\nA) Rocket (roquette)\nB) Thon\nC) Pommes de terre\nD) Champignons", answer: "A" },
        { text: "Crêpe salée \"Italiana\" : combien de tomates cerises entières sont prévues (puis coupées en quartiers) ?\nA) 1\nB) 2\nC) 3\nD) 6", answer: "C" },
        { text: "Crêpe salée \"Prosciutto\" (plain base) : combien de tranches de ham ?\nA) 1\nB) 2\nC) 3\nD) 4", answer: "B" },
        { text: "Base beetroot : combien de beetroot powder ajoutes-tu à 250 g de mix ?\nA) 1 g\nB) 3 g\nC) 6 g\nD) 10 g", answer: "B" },
        { text: "Waffle : quel réglage de \"power\" est correct ?\nA) 1\nB) 2\nC) 3\nD) 5", answer: "C" },
        { text: "Waffle : quel volume de pâte correspond à \"one entire scoopful\" ?\nA) 120 ml\nB) 150 ml\nC) 177 ml\nD) 250 ml", answer: "C" }
      ]
    };

    this.init();
  }

  // ------------------------------
  // Search catalog integration (auto-indexed by scripts/site.js)
  // - site.js extracts all .guide-card titles on each content page and stores them in:
  //   localStorage key: badianiSearchCatalog.v2
  // - We can use that catalog here to deep-link to ANY card via:
  //   <page>.html?card=<slug>&center=1
  // ------------------------------
  slugify(value = '') {
    return (value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '') || '';
  }

  loadSearchCatalogPages() {
    try {
      const rawV2 = localStorage.getItem('badianiSearchCatalog.v2');
      const rawV1 = localStorage.getItem('badianiSearchCatalog.v1');
      const raw = rawV2 || rawV1;
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return {};
      return (parsed.pages && typeof parsed.pages === 'object') ? parsed.pages : {};
    } catch {
      return {};
    }
  }

  // ------------------------------
  // i18n title integration
  // If a user types the card title in EN/ES/FR (or IT), map it deterministically
  // to the canonical deep-link slug (based on the Italian title).
  // This makes "find the right card" work across languages without hardcoding.
  // ------------------------------
  buildI18nTitleIndex() {
    if (this._i18nTitleIndex) return this._i18nTitleIndex;
    const dict = window.BadianiI18n?.dict;
    if (!dict || typeof dict !== 'object') return null;

    const pagesByPrefix = {
      operations: 'operations.html',
      gelatoLab: 'gelato-lab.html',
      caffe: 'caffe.html',
      sweetTreats: 'sweet-treats.html',
      pastries: 'pastries.html',
      festive: 'festive.html',
      slittiYoyo: 'slitti-yoyo.html',
      storyOrbit: 'story-orbit.html',
    };

    const keys = Object.keys(dict?.it || {});
    const rx = /^(operations|gelatoLab|caffe|sweetTreats|pastries|festive|slittiYoyo|storyOrbit)\.(cards|ops)\.[^.]+\.title$/;
    const langs = ['it', 'en', 'es', 'fr'];
    const index = [];

    for (const k of keys) {
      if (!rx.test(k)) continue;
      const prefix = k.split('.')[0];
      const pageHref = pagesByPrefix[prefix];
      if (!pageHref) continue;

      const itTitle = dict?.it?.[k];
      if (!itTitle) continue;
      const cardSlug = this.slugify(String(itTitle));
      if (!cardSlug) continue;

      for (const lang of langs) {
        const title = dict?.[lang]?.[k];
        if (!title) continue;
        const titleNorm = this.normalizeText(String(title));
        if (!titleNorm) continue;
        index.push({ key: k, pageHref, cardSlug, titleNorm, titleRaw: String(title) });
      }
    }

    // Cache on the instance.
    this._i18nTitleIndex = index;
    return index;
  }

  inferRecommendationFromI18nTitles(userMessage) {
    const msgNorm = this.normalizeText(userMessage);
    if (!msgNorm) return null;

    const index = this.buildI18nTitleIndex();
    if (!Array.isArray(index) || !index.length) return null;

    const stop = new Set(['della','delle','degli','dello','dell','d','del','dei','di','da','a','al','allo','alla','alle','ai','il','lo','la','i','gli','le','un','uno','una','and','or','the','of','to','in','on','for']);
    const hasWord = (needle) => {
      const n = String(needle || '').trim();
      if (!n) return false;
      const esc = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      try { return new RegExp(`\\b${esc}\\b`, 'i').test(msgNorm); } catch { return false; }
    };

    let best = null;
    let bestScore = 0;

    for (const entry of index) {
      const t = entry?.titleNorm || '';
      if (!t || t.length < 3) continue;

      let score = 0;
      // 1) Exact match or full substring (high confidence)
      if (msgNorm === t) {
        score += 15;
      } else if (msgNorm.includes(t)) {
        score += 12;
      } else if (t.includes(msgNorm) && msgNorm.length >= 4) {
        score += 10;
      }

      // 2) Token matching (word boundaries)
      const tokens = t.split(' ').filter(tok => tok.length >= 3 && !stop.has(tok));
      let hits = 0;
      for (const tok of tokens) {
        if (hasWord(tok) || (msgNorm.length >= 4 && tok.includes(msgNorm)) || (tok.length >= 4 && msgNorm.includes(tok))) {
          hits++;
          score += 4;
        }
      }

      // 3) Bonus for matching more tokens
      if (hits > 0 && hits === tokens.length) {
        score += 5;
      }

      // 4) If user message is exactly one of the tokens (e.g. "Panettone")
      if (tokens.length > 1 && tokens.some(tok => tok === msgNorm)) {
        score += 8;
      }

      if (score > bestScore) {
        bestScore = score;
        best = entry;
      }
    }

    if (!best || bestScore < 8) return null;
    const href = `${best.pageHref}?card=${encodeURIComponent(best.cardSlug)}&center=1`;
    return { href, reason: 'i18n-title', label: best.titleRaw };
  }

  inferRecommendationFromCatalog(userMessage) {
    const msgNorm = this.normalizeText(userMessage);
    if (!msgNorm) return null;

    // Avoid matching ultra-short chatter.
    const words = msgNorm.split(' ').filter(Boolean);
    const hasSignalWord = words.some(w => String(w).length >= 4);
    if (!hasSignalWord) return null;

    const pages = this.loadSearchCatalogPages();
    const pageKeys = Object.keys(pages || {});
    if (!pageKeys.length) return null;

    const stop = new Set(['della','delle','degli','dello','dell','d','del','dei','di','da','a','al','allo','alla','alle','ai','il','lo','la','i','gli','le','un','uno','una','and','or','the','of','to','in','on','for']);
    const hasWord = (needle) => {
      const n = String(needle || '').trim();
      if (!n) return false;
      // word-boundary match, but escape hyphens etc.
      const esc = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      try { return new RegExp(`\\b${esc}\\b`, 'i').test(msgNorm); } catch { return false; }
    };

    // Support short queries like "pandoro" / "panettone" / "chiusura":
    // allow a single meaningful word to match a multi-word title (e.g. "Pandoro Classico").
    const meaningfulWords = words.filter((w) => String(w || '').length >= 4 && !stop.has(String(w)));
    const singleQueryWord = (meaningfulWords.length === 1) ? meaningfulWords[0] : '';

    let best = null;
    let bestScore = 0;

    for (const pageKey of pageKeys) {
      const page = pages[pageKey];
      const cards = Array.isArray(page?.cards) ? page.cards : [];
      for (const card of cards) {
        const title = String(card?.title || '').trim();
        const cardKey = String(card?.cardKey || this.slugify(title) || '').trim();
        if (!title || !cardKey) continue;

        const titleNorm = this.normalizeText(title);
        if (!titleNorm) continue;

        // Highest confidence: full title substring.
        let score = 0;
        if (msgNorm.includes(titleNorm)) {
          score += 12;
        }

        // Token confidence: word-boundary matches for meaningful tokens.
        const tokens = titleNorm.split(' ').map(t => t.trim()).filter(t => t.length >= 4 && !stop.has(t));
        let tokenHits = 0;
        for (const t of tokens) {
          if (hasWord(t)) {
            tokenHits += 1;
            score += 3;
          }
        }

        // Single-word titles like "Cakes" need to be easy to hit.
        if (!score && tokens.length === 1 && hasWord(tokens[0])) {
          score = 8;
        }

        // Single-word queries should be able to match multi-word titles when the title starts
        // with that word (e.g. "pandoro" -> "Pandoro Classico").
        if (!score && singleQueryWord && hasWord(singleQueryWord)) {
          if (titleNorm === singleQueryWord) {
            score = 10;
          } else if (titleNorm.startsWith(`${singleQueryWord} `)) {
            score = 10;
          } else if (titleNorm.includes(` ${singleQueryWord} `) || titleNorm.endsWith(` ${singleQueryWord}`) || titleNorm.startsWith(`${singleQueryWord} `)) {
            score = Math.max(score, 8);
          }
        }

        // If the user mentions the slug itself, accept it.
        if (!score && cardKey && msgNorm.includes(cardKey.replace(/-/g, ' '))) {
          score = 7;
        }

        // Guard: avoid accidental matches on generic shared words (e.g. "standard")
        if (tokenHits === 1 && tokens.length >= 3 && score < 9) {
          score = Math.max(0, score - 2);
        }

        if (score > bestScore) {
          bestScore = score;
          best = { pageKey, title, cardKey };
        }
      }
    }

    // Threshold: avoid wrong links.
    if (!best || bestScore < 8) return null;
    const href = `${best.pageKey}?card=${encodeURIComponent(best.cardKey)}&center=1`;
    return { href, reason: 'catalog', label: best.title };
  }

  // ------------------------------
  // Recommendation helpers
  // ------------------------------
  getUiLang() {
    try {
      const uiLang = (window.BadianiI18n?.getLang?.() || window.BadianiI18n?.currentLang || 'it');
      const l = String(uiLang || 'it').toLowerCase();
      if (['it', 'en', 'es', 'fr'].includes(l)) return l;
    } catch {}
    return 'it';
  }

  normalizeText(value) {
    const s = String(value ?? '').trim().toLowerCase();
    if (!s) return '';
    try {
      // Remove diacritics (crêpe -> crepe)
      return s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[’']/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
    } catch {
      return s.replace(/\s+/g, ' ').trim();
    }
  }

  loadLastRecommendation() {
    try {
      const raw = localStorage.getItem(this.RECO_STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : null;
      if (data && typeof data === 'object') return data;
    } catch {}
    return null;
  }

  saveLastRecommendation(reco) {
    try {
      if (!reco || !reco.href) return;
      localStorage.setItem(this.RECO_STORAGE_KEY, JSON.stringify({ href: String(reco.href), ts: Date.now() }));
    } catch {}
  }

  // ------------------------------
  // Conversation state (multi-turn)
  // ------------------------------
  loadConversationState() {
    try {
      const raw = localStorage.getItem(this.CONV_STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : null;
      if (data && typeof data === 'object') return data;
    } catch {}
    return {
      turn: 0,
      genericTurns: 0,
      activeTopicHref: '',
      activeTopicLabel: '',
      lastSuggestedTurn: 0,
      topicScores: {},
    };
  }

  saveConversationState(state) {
    try {
      localStorage.setItem(this.CONV_STORAGE_KEY, JSON.stringify(state || {}));
    } catch {}
  }

  bumpTopicScore(state, topicKey, inc = 1) {
    if (!state || !topicKey) return;
    const key = String(topicKey);
    const next = (state.topicScores && typeof state.topicScores === 'object') ? state.topicScores : {};
    next[key] = (Number(next[key]) || 0) + (Number(inc) || 0);
    state.topicScores = next;
  }

  updateTopicScoresFromText(state, text) {
    if (!state) return;
    const msgNorm = this.normalizeText(text);
    if (!msgNorm) return;
    const has = (...needles) => needles.some(n => msgNorm.includes(this.normalizeText(n)));
    const hasWord = (re) => {
      try { return re.test(msgNorm); } catch { return false; }
    };

    // Operations
    if (has('apertura', 'opening', 'open store')) this.bumpTopicScore(state, 'operations.apertura', 2);
    if (has('chiusura', 'closing', 'close store')) this.bumpTopicScore(state, 'operations.chiusura', 2);
    if (has('pulizia', 'cleaning', 'sanificazione', 'sanitize')) this.bumpTopicScore(state, 'operations.pulizia', 2);
    if (has('servizio', 'service', 'upsell', 'obiezione', 'cliente')) this.bumpTopicScore(state, 'operations.servizio', 2);

    // Coffee
    if (has('espresso', 'grinder', 'tamper', 'portafiltro', 'estrazione')) this.bumpTopicScore(state, 'caffe.espresso', 2);
    if (has('cappuccino', 'latte', 'steam', 'wand', 'microfoam', 'flat white')) this.bumpTopicScore(state, 'caffe.milk', 2);
    if (has('affogato', 'dirty matcha')) this.bumpTopicScore(state, 'caffe.affogato', 2);
    if (has('smoothie', 'smoothies', 'frullato', 'frullati', 'blender')) this.bumpTopicScore(state, 'caffe.smoothies', 2);

    // Treats
    if (has('waffle')) this.bumpTopicScore(state, 'treats.waffle', 2);
    if (has('crepe', 'crêpe', 'crepes')) this.bumpTopicScore(state, 'treats.crepe', 2);
    if (has('pancake')) this.bumpTopicScore(state, 'treats.pancake', 2);

    // Pastry Lab (IMPORTANT: use word boundaries to avoid matching "pancake" -> "cake")
    if (hasWord(/\b(cake|cakes|torta|torte)\b/)) this.bumpTopicScore(state, 'pastries.cakes', 2);

    // Festive
    if (has('churro', 'churros')) this.bumpTopicScore(state, 'festive.churro', 2);
    // IMPORTANT: keep panettone and pandoro separated to avoid mis-linking.
    if (has('panettone')) this.bumpTopicScore(state, 'festive.panettone', 2);
    if (has('pandoro')) this.bumpTopicScore(state, 'festive.pandoro', 2);
    if (has('vin brule', 'mulled')) this.bumpTopicScore(state, 'festive.mulled', 2);

    // Gelato
    if (has('buontalenti')) this.bumpTopicScore(state, 'gelato.buontalenti', 2);
    if (has('cono', 'coni', 'cone')) this.bumpTopicScore(state, 'gelato.coni', 2);
    if (has('gusti', 'flavour', 'flavors', 'parfums', 'sabores')) this.bumpTopicScore(state, 'gelato.gusti', 2);
    if (has('vetrina', 'display', 'vitrine', '-14', '-15')) this.bumpTopicScore(state, 'gelato.vetrina', 2);

    // Other
    if (has('slitti', 'yoyo', 'yo-yo')) this.bumpTopicScore(state, 'slitti', 2);
    if (has('storia', 'story orbit', 'firenze', 'origine')) this.bumpTopicScore(state, 'story', 2);

    // IMPORTANT: avoid scoring generic word "box" unless explicitly about take-away.
    if (has('gelato box', 'gelato boxes', 'take me home', 'take away', 'asporto')) {
      this.bumpTopicScore(state, 'gelato.boxes', 2);
    }
  }

  topicKeyToReco(topicKey) {
    const key = String(topicKey || '');
    const hrefMap = {
      'operations.apertura': 'operations.html?q=apertura',
      'operations.chiusura': 'operations.html?q=chiusura',
      'operations.pulizia': 'operations.html?q=pulizia',
      'operations.servizio': 'operations.html?q=servizio',
      'caffe.espresso': 'caffe.html?q=espresso',
      'caffe.milk': 'caffe.html?q=cappuccino',
      'caffe.affogato': 'caffe.html?q=affogato',
      'caffe.smoothies': 'caffe.html?q=smoothie',
      'treats.waffle': 'sweet-treats.html?q=waffle',
      'treats.crepe': 'sweet-treats.html?q=crepe',
      'treats.pancake': 'sweet-treats.html?q=pancake',
      'festive.churro': 'festive.html?q=churro',
      'festive.panettone': 'festive.html?card=panettone-classico&center=1',
      'festive.pandoro': 'festive.html?card=pandoro-classico&center=1',
      'festive.mulled': 'festive.html?q=mulled',
      'gelato.buontalenti': 'gelato-lab.html?q=buontalenti',
      'gelato.coni': 'gelato-lab.html?q=coni',
      'gelato.gusti': 'gelato-lab.html?q=gusti',
      'gelato.vetrina': 'gelato-lab.html?q=vetrina',
      'gelato.boxes': 'gelato-lab.html?card=gelato-boxes&center=1',
      'pastries.cakes': 'pastries.html?q=cakes',
      'slitti': 'slitti-yoyo.html?q=slitti',
      'story': 'story-orbit.html?q=story',
    };
    const href = hrefMap[key] || '';
    if (!href) return null;
    return { href, reason: 'conversation' };
  }

  pickTopTopicReco(state) {
    const scores = (state && state.topicScores && typeof state.topicScores === 'object') ? state.topicScores : {};
    const entries = Object.entries(scores)
      .filter(([, v]) => Number(v) > 0)
      .sort((a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0));
    if (!entries.length) return null;
    return this.topicKeyToReco(entries[0][0]);
  }

  isFollowUp(msgNorm) {
    const m = String(msgNorm || '');
    if (!m) return false;
    return /\b(ok|capito|chiaro|perfetto|quindi|allora|ancora|e\s+poi)\b/.test(m) || m.length <= 14;
  }

  shouldSuggestNow(state, explicitReco) {
    if (!state) return false;
    const turn = Number(state.turn) || 0;
    const last = Number(state.lastSuggestedTurn) || 0;

    // Explicit request: suggest immediately (but avoid double-CTA in the same turn)
    if (explicitReco && explicitReco.href) {
      return (turn - last) >= 1;
    }

    // Active topic: re-suggest occasionally, not every message
    if (state.activeTopicHref) {
      return (turn - last) >= 3;
    }

    // Generic chat: suggest after 3 turns
    if ((Number(state.genericTurns) || 0) >= 3) return true;
    return false;
  }

  pickDifferent(options, lastHref) {
    const list = Array.isArray(options) ? options.filter(Boolean) : [];
    if (!list.length) return null;
    if (list.length === 1) return list[0];
    const filtered = lastHref ? list.filter(o => o.href !== lastHref) : list;
    const pool = filtered.length ? filtered : list;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  isSmallTalk(msgNorm) {
    const m = String(msgNorm || '');
    if (!m) return false;
    // Italian + common EN/ES/FR variants
    return (
      /\bcome\s+stai\b|\bcome\s+va\b|\btutto\s+bene\b|\bche\s+mi\s+dici\b|\bcome\s+butta\b/.test(m) ||
      /\bhow\s+are\s+you\b|\bhows\s+it\s+going\b|\bhow\s+you\s+doing\b/.test(m) ||
      /\bque\s+tal\b|\bcomo\s+estas\b|\bcomo\s+va\b/.test(m) ||
      /\bca\s+va\b|\bcomment\s+ca\s+va\b/.test(m)
    );
  }

  inferRecommendationFromMessage(userMessage) {
    const uiLang = this.getUiLang();
    const msgNorm = this.normalizeText(userMessage);
    const words = msgNorm.split(' ').filter(Boolean);

    const has = (...needles) => needles.some(n => msgNorm.includes(this.normalizeText(n)));

    // 0) If the user typed a card title in their language, link deterministically.
    const i18nReco = this.inferRecommendationFromI18nTitles(userMessage);
    if (i18nReco && i18nReco.href) {
      return i18nReco;
    }

    // 1) Try the auto-indexed search catalog first (covers ALL cards across pages once indexed)
    const catalogReco = this.inferRecommendationFromCatalog(userMessage);
    if (catalogReco && catalogReco.href) {
      return catalogReco;
    }

    // Pastry Lab: cakes/torte (avoid false positive on "pancake")
    if (/\b(cake|cakes|torta|torte)\b/.test(msgNorm)) {
      return { href: 'pastries.html?q=cakes', reason: 'keyword' };
    }

    // Festive: keep pandoro and panettone separated (avoid pandoro -> panettone).
    if (/\bpandoro\b/.test(msgNorm)) {
      return { href: 'festive.html?card=pandoro-classico&center=1', reason: 'keyword' };
    }
    if (/\bpanettone\b/.test(msgNorm)) {
      return { href: 'festive.html?card=panettone-classico&center=1', reason: 'keyword' };
    }

    // High-signal direct mappings (topic -> page?q)
    const topicCandidates = [
      { href: 'caffe.html?q=smoothie', keys: ['smoothie', 'smoothies', 'frullato', 'frullati'] },
      { href: 'caffe.html?q=smoothies', keys: ['parametri smoothies', 'smoothies: parametri', 'smoothie standard'] },
      { href: 'caffe.html?q=smoothie%20giallo', keys: ['smoothie giallo', 'giallo passion'] },
      { href: 'caffe.html?q=smoothie%20rosso', keys: ['smoothie rosso', 'rosso berry'] },
      { href: 'caffe.html?q=smoothie%20verde', keys: ['smoothie verde', 'verde boost'] },

      { href: 'gelato-lab.html?q=buontalenti', keys: ['buontalenti'] },
      { href: 'gelato-lab.html?q=coni', keys: ['cono', 'coni', 'cone'] },
      { href: 'gelato-lab.html?q=gusti', keys: ['gusti', 'flavour', 'flavors', 'parfums', 'sabores'] },
      { href: 'gelato-lab.html?q=vetrina', keys: ['vetrina', 'display', 'vitrine'] },

      { href: 'caffe.html?q=espresso', keys: ['espresso', 'shot', 'estrazione', 'portafiltro', 'grinder', 'tamper'] },
      { href: 'caffe.html?q=cappuccino', keys: ['cappuccino', 'milk', 'latte', 'steam', 'wand', 'microfoam'] },
      { href: 'caffe.html?q=affogato', keys: ['affogato', 'dirty matcha'] },

      { href: 'sweet-treats.html?q=crepe', keys: ['crepe', 'crepes', 'crepe', 'crêpe', 'crêpes', 'crêpe', 'crêpes'] },
      { href: 'sweet-treats.html?q=waffle', keys: ['waffle'] },
      { href: 'sweet-treats.html?q=pancake', keys: ['pancake'] },

      { href: 'festive.html?q=churro', keys: ['churro', 'churros'] },
      { href: 'festive.html?card=panettone-classico&center=1', keys: ['panettone'] },
      { href: 'festive.html?card=pandoro-classico&center=1', keys: ['pandoro'] },
      { href: 'festive.html?q=mulled', keys: ['vin brule', 'vinbrule', 'mulled'] },

      { href: 'operations.html?q=apertura', keys: ['apertura', 'opening', 'open store'] },
      { href: 'operations.html?q=servizio', keys: ['servizio', 'service', 'upsell', 'obiezione'] },
      { href: 'operations.html?q=chiusura', keys: ['chiusura', 'closing', 'close store'] },
      { href: 'operations.html?q=pulizia', keys: ['pulizia', 'cleaning', 'sanificazione', 'sanitize'] },

      { href: 'slitti-yoyo.html?q=slitti', keys: ['slitti', 'yoyo', 'yo-yo', 'yo yo'] },
      { href: 'pastries.html?q=croissant', keys: ['croissant'] },
      { href: 'pastries.html?q=brownie', keys: ['brownie'] },
      // NOTE: Cakes handled above with word-boundary regex to avoid matching "pancake".
      { href: 'story-orbit.html?q=story', keys: ['story orbit', 'firenze', 'origine', 'storia'] },
    ];

    const matched = topicCandidates.find(c => (c.keys || []).some(k => has(k)));
    if (matched) {
      return { href: matched.href, reason: 'keyword' };
    }

    // For very short / ambiguous input: improvise with a rotating fallback
    const isShort = msgNorm.length <= 12 || words.length <= 2;
    if (isShort || this.isSmallTalk(msgNorm)) {
      const last = this.loadLastRecommendation();
      const options = [
        { href: 'operations.html?q=apertura', label: { it: 'Apertura', en: 'Opening', es: 'Apertura', fr: 'Ouverture' } },
        { href: 'sweet-treats.html?q=waffle', label: { it: 'Waffle', en: 'Waffle', es: 'Waffle', fr: 'Waffle' } },
        { href: 'festive.html?q=churro', label: { it: 'Churros', en: 'Churros', es: 'Churros', fr: 'Churros' } },
        { href: 'caffe.html?q=espresso', label: { it: 'Espresso', en: 'Espresso', es: 'Espresso', fr: 'Espresso' } },
        { href: 'gelato-lab.html?q=buontalenti', label: { it: 'Buontalenti', en: 'Buontalenti', es: 'Buontalenti', fr: 'Buontalenti' } },
        { href: 'slitti-yoyo.html?q=slitti', label: { it: 'Slitti & Yo-Yo', en: 'Slitti & Yo-Yo', es: 'Slitti & Yo-Yo', fr: 'Slitti & Yo-Yo' } },
      ];
      const pick = this.pickDifferent(options, last?.href);
      const label = pick?.label?.[uiLang] || pick?.label?.it || 'Training';
      return { href: pick?.href || 'operations.html?q=apertura', reason: isShort ? 'short' : 'smalltalk', label, tentative: true };
    }

    return null;
  }

  buildSmallTalkResponse(reco, shouldSuggest) {
    const lang = this.getUiLang();
    const topicLabel = String(reco?.label || '').trim();
    const topic = topicLabel || (lang === 'en' ? 'a quick refresher' : 'un ripasso veloce');

    const templates = {
      it: `Sto bene 😄🍦. Tu invece? Vuoi parlare di gelato, bar o procedure?`,
      en: `I'm good 😄🍦. How about you? Want gelato, bar or procedures?`,
      es: `¡Estoy bien 😄🍦! ¿Y tú? ¿Gelato, bar o procedimientos?`,
      fr: `Je vais bien 😄🍦. Et toi ? Gelato, bar ou procédures ?`,
    };

    const base = templates[lang] || templates.it;
    const href = reco?.href;
    if (shouldSuggest && href) {
      return `${base} [[LINK:${href}]]`;
    }
    return `${base} [[NOLINK]]`;
  }

  applyRecommendationToResponse(text, reco, opts = {}) {
    let out = String(text ?? '').trim();
    if (!out) return out;

    const suppressLink = !!opts.suppressLink;

    // Respect explicit suppression (quiz + other special flows)
    if (out.includes('[[NOLINK]]')) {
      return out;
    }

    // Remove any model-provided link tags; we will attach a coherent one when we have a recommendation.
    out = out.replace(/\[\[LINK:.*?\]\]/g, '').trim();

    if (reco && reco.href) {
      out = `${out} [[LINK:${reco.href}]]`;
      this.saveLastRecommendation(reco);
      return out;
    }

    if (suppressLink) {
      // Prevent berny-ui.js keyword fallback from adding an unrelated link.
      return `${out} [[NOLINK]]`;
    }

    return out;
  }

  pushToHistory(role, content) {
    const r = String(role || '').toLowerCase();
    if (r !== 'user' && r !== 'assistant') return;
    const c = String(content ?? '').trim();
    if (!c) return;

    const clean = c
      .replace(/\[\[LINK:.*?\]\]/g, '')
      .replace(/\[\[CMD:.*?\]\]/g, '')
      .replace(/\[\[NOLINK\]\]/g, '')
      .trim();
    if (!clean) return;

    this.history = Array.isArray(this.history) ? this.history : [];
    this.history.push({ role: r, content: clean });
    const max = Math.max(2, Number(this.MAX_HISTORY_TURNS) || 8);
    if (this.history.length > max) this.history = this.history.slice(-max);
  }

  init() {
    // SDK init (only if configured)
    if (this.mode === 'sdk') {
      if (window.GoogleGenerativeAI && this.apiKey && this.apiKey.length >= 10) {
        this.genAI = new window.GoogleGenerativeAI(this.apiKey);
        this.model = this.genAI.getGenerativeModel({ model: this.modelName });
        console.log("🤖 Berny Brain (Google SDK) pronto!");
      } else {
        console.warn("⚠️ SDK Google o API Key mancante. (Consigliato: proxy) ");
      }
    }

    // Listener per inserimento chiave via chat (solo in modalità SDK).
    if (this.mode === 'sdk') {
      window.addEventListener('berny-user-message', (e) => {
        if (e.detail.message.startsWith('/apikey')) {
          const key = e.detail.message.replace('/apikey', '').trim();
          localStorage.setItem('berny_api_key', key);
          alert("Chiave salvata! Ricarico...");
          window.location.reload();
        }
      });
    }

    // Listener per inserimento access code via chat (solo in modalità proxy).
    // Usage: /access IL_TUO_CODICE
    if (this.mode === 'proxy') {
      window.addEventListener('berny-user-message', (e) => {
        const msg = String(e?.detail?.message || '');
        if (msg.startsWith('/access')) {
          const code = msg.replace('/access', '').trim();
          try { localStorage.setItem('badianiBerny.accessCode.v1', code); } catch {}
          alert('Accesso salvato! Ricarico...');
          window.location.reload();
        }
      });
    }
  }

  // --- QUIZ LOGIC START ---

  detectLanguage(text) {
    const t = text.toLowerCase();
    
    // Italian
    if (/\b(domande|interrogami|sfida)\b/i.test(t)) return 'it';
    // English
    if (/\b(questions|challenge|ask me)\b/i.test(t)) return 'en';
    // Spanish
    if (/\b(cuestionario|preguntas|desafío|desafio)\b/i.test(t)) return 'es';
    // French
    if (/\b(défi|defi|interroge-moi)\b/i.test(t)) return 'fr';

    // Common words: test, quiz. Check UI lang or default to IT.
    if (/\b(test|quiz)\b/i.test(t)) {
        // Try to respect current UI language if ambiguous
        const uiLang = (window.BadianiI18n?.getLang?.() || 'it').toLowerCase();
        if (['it','en','es','fr'].includes(uiLang)) return uiLang;
        return 'it';
    }

    return null; 
  }

  async loadQuestions(lang) {
    // Use embedded DB instead of fetch to avoid CORS on file://
    const questions = this.QUESTIONS_DB[lang] || [];
    return questions;
  }

  getTranslation(key, lang) {
    const translations = {
        intro_with_reward: {
            it: "Ohoh! Vuoi sfidarmi? 😏 Le mie domande sono un po' difficili... ma se rispondi correttamente a 3 domande di fila, sbloccherò un **Gelato Omaggio** per te! Sei pronto a rischiare? [[NOLINK]]",
            en: "Ohoh! Want to challenge me? 😏 My questions are a bit tricky... but if you answer 3 questions correctly in a row, I'll unlock a **Free Gelato** for you! Are you ready to take the risk? [[NOLINK]]",
            es: "¡Ohoh! ¿Quieres desafiarme? 😏 Mis preguntas son un poco difíciles... pero si respondes correctamente 3 preguntas seguidas, ¡desbloquearé un **Helado Gratis** para ti! ¿Estás listo para arriesgarte? [[NOLINK]]",
            fr: "Ohoh! Tu veux me défier? 😏 Mes questions sont un peu difficiles... mais si tu réponds correctement à 3 questions d'affilée, je débloquerai une **Glace Gratuite** pour toi! Es-tu prêt à prendre le risque? [[NOLINK]]"
        },
        intro_cooldown: {
            it: "Ehi, calma campione! Hai già vinto il tuo gelato settimanale. 🧊 Possiamo fare un test per la gloria, ma niente premi fino al reset. Vuoi procedere lo stesso? [[NOLINK]]",
            en: "Hey, easy champ! You've already won your weekly gelato. 🧊 We can do a test for glory, but no prizes until reset. Want to proceed anyway? [[NOLINK]]",
            es: "¡Oye, tranquilo campeón! Ya ganaste tu helado semanal. 🧊 Podemos hacer una prueba por la gloria, pero sin premios hasta el reinicio. ¿Quieres proceder igual? [[NOLINK]]",
            fr: "Hé, doucement champion! Tu as déjà gagné ta glace hebdomadaire. 🧊 On peut faire un test pour la gloire, mais pas de prix avant la réinitialisation. Tu veux continuer quand même? [[NOLINK]]"
        },
        correct: { it: "✅ Corretto!", en: "✅ Correct!", es: "✅ ¡Correcto!", fr: "✅ Correct!" },
        wrong: { it: "❌ Sbagliato! Era", en: "❌ Wrong! It was", es: "❌ ¡Incorrecto! Era", fr: "❌ Faux! C'était" },
        next_q: { it: "Prossima domanda:", en: "Next question:", es: "Siguiente pregunta:", fr: "Question suivante:" },
        victory: { 
            it: "🏆 INCREDIBILE! Hai fatto 3 su 3! Ti sei guadagnato un GELATO OMAGGIO! 🍦 Mostra questa chat alla cassa. [[NOLINK]]",
            en: "🏆 AMAZING! You got 3 out of 3! You've earned a FREE GELATO! 🍦 Show this chat at the counter. [[NOLINK]]",
            es: "🏆 ¡INCREÍBLE! ¡Acertaste 3 de 3! ¡Te has ganado un HELADO GRATIS! 🍦 Muestra este chat en la caja. [[NOLINK]]",
            fr: "🏆 INCROYABLE! Tu as eu 3 sur 3! Tu as gagné une GLACE GRATUITE! 🍦 Montre ce chat à la caisse. [[NOLINK]]"
        },
        fail: {
            it: "Peccato! Ripassa un po' le Operations e riprova tra poco. Niente gelato stavolta! [[NOLINK]]",
            en: "Too bad! Review Operations a bit and try again soon. No gelato this time! [[NOLINK]]",
            es: "¡Qué pena! Repasa un poco las Operaciones y vuelve a intentarlo pronto. ¡Esta vez no hay helado! [[NOLINK]]",
            fr: "Dommage! Révise un peu les Opérations et réessaie bientôt. Pas de glace cette fois! [[NOLINK]]"
        },
        victory_cooldown: {
            it: "🏆 Ottimo lavoro! 3 su 3! Niente gelato extra (cooldown attivo), ma sei una macchina da guerra! [[NOLINK]]",
            en: "🏆 Great job! 3 out of 3! No extra gelato (cooldown active), but you're a machine! [[NOLINK]]",
            es: "🏆 ¡Buen trabajo! ¡3 de 3! Sin helado extra (cooldown activo), ¡pero eres una máquina! [[NOLINK]]",
            fr: "🏆 Bon travail! 3 sur 3! Pas de glace supplémentaire (cooldown actif), mais tu es une machine! [[NOLINK]]"
        }
    };
    return translations[key]?.[lang] || translations[key]?.['it'] || '';
}

  checkRewardAvailability() {
    const REWARD_STORAGE_KEY = 'badiani_last_gelato_win';
    const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    const lastWin = localStorage.getItem(REWARD_STORAGE_KEY);
    
    if (!lastWin) return true; 
    
    const timeDiff = Date.now() - new Date(lastWin).getTime();
    return timeDiff > ONE_WEEK_MS; 
  }

  async startQuiz(lang) {
    const questions = await this.loadQuestions(lang);
    if (!questions || questions.length < 3) {
        return "Error: Not enough questions available for this language.";
    }

    // Shuffle and pick 3
    const shuffled = questions.sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 3);

    this.quizState = {
        active: true,
        lang: lang,
        questions: selected,
        index: 0,
        correct: 0,
        waitingForConfirmation: true // Wait for "Yes" after intro
    };

    const canWin = this.checkRewardAvailability();
    const intro = canWin 
        ? this.getTranslation('intro_with_reward', lang)
        : this.getTranslation('intro_cooldown', lang);

    return intro;
  }

  async handleQuizAnswer(userMessage) {
    const lang = this.quizState.lang;
    const msg = userMessage.trim().toLowerCase();

    // 1. Confirmation phase
    if (this.quizState.waitingForConfirmation) {
        if (['si', 'sì', 'yes', 'oui', 'ok', 'certo', 'sure', 'claro'].some(w => msg.includes(w))) {
            this.quizState.waitingForConfirmation = false;
            return this.quizState.questions[0].text + " [[NOLINK]]";
        } else {
            this.quizState.active = false;
            return lang === 'it' ? "Ok, alla prossima!" : "Ok, maybe next time!";
        }
    }

    // 2. Answer phase
    const currentQ = this.quizState.questions[this.quizState.index];
    // Extract user answer (A, B, C, D)
    // Look for single letter or "A)", "B)", etc.
    const match = msg.match(/\b([a-d])\b/i);
    const userLetter = match ? match[1].toUpperCase() : null;

    if (!userLetter) {
        return lang === 'it' ? "Per favore rispondi con A, B, C o D." : "Please answer with A, B, C, or D.";
    }

    const isCorrect = (userLetter === currentQ.answer);
    let feedback = "";

    if (isCorrect) {
        this.quizState.correct++;
        feedback = this.getTranslation('correct', lang);
    } else {
        feedback = `${this.getTranslation('wrong', lang)} ${currentQ.answer}.`;
    }

    // Move to next
    this.quizState.index++;

    if (this.quizState.index < 3) {
        // Next question
        const nextQ = this.quizState.questions[this.quizState.index];
        return `${feedback}\n\n${this.getTranslation('next_q', lang)}\n${nextQ.text} [[NOLINK]]`;
    } else {
        // End of quiz
        this.quizState.active = false;
        const score = this.quizState.correct;
        
        if (score === 3) {
            const canWin = this.checkRewardAvailability();
            if (canWin) {
                localStorage.setItem('badiani_last_gelato_win', new Date().toISOString());
                
                // SYNC WITH MAIN GAMIFICATION
                if (window.BadianiGamificationHelper) {
                    window.BadianiGamificationHelper.addGelato();
                }

                // Trigger confetti if available
                if (window.confetti) try { window.confetti(); } catch(e) {}
                return `${feedback}\n\n${this.getTranslation('victory', lang)}`;
            } else {
                return `${feedback}\n\n${this.getTranslation('victory_cooldown', lang)}`;
            }
        } else {
            return `${feedback}\n\n${this.getTranslation('fail', lang)} (${score}/3)`;
        }
    }
  }

  // --- QUIZ LOGIC END ---

  async processMessage(userMessage) {
    // 1. QUIZ INTERCEPTION
    if (this.quizState.active) {
        return this.handleQuizAnswer(userMessage);
    }

    const detectedLang = this.detectLanguage(userMessage);
    if (detectedLang) {
        return this.startQuiz(detectedLang);
    }

    // 1b. Conversation tracking + delayed recommendations (avoid always suggesting the same card).
    const msgNorm = this.normalizeText(userMessage);
    const state = this.loadConversationState();
    state.turn = (Number(state.turn) || 0) + 1;
    this.updateTopicScoresFromText(state, userMessage);

    const inferred = this.inferRecommendationFromMessage(userMessage);
    const explicitReco = (inferred && inferred.href && !inferred.tentative && !this.isSmallTalk(msgNorm)) ? inferred : null;

    if (explicitReco && explicitReco.href) {
      state.activeTopicHref = explicitReco.href;
      state.activeTopicLabel = explicitReco.label || '';
      state.genericTurns = 0;
    } else {
      const follow = this.isFollowUp(msgNorm);
      if (!follow || !state.activeTopicHref) {
        state.genericTurns = (Number(state.genericTurns) || 0) + 1;
      }
    }

    const suggestNow = this.shouldSuggestNow(state, explicitReco);
    let recoToAttach = null;
    if (suggestNow) {
      if (explicitReco) {
        recoToAttach = explicitReco;
      } else if (state.activeTopicHref) {
        recoToAttach = { href: state.activeTopicHref, reason: 'active-topic' };
      } else {
        recoToAttach = this.pickTopTopicReco(state);
        if (!recoToAttach) {
          const last = this.loadLastRecommendation();
          recoToAttach = this.pickDifferent(
            [
              { href: 'operations.html?q=servizio', reason: 'fallback' },
              { href: 'caffe.html?q=espresso', reason: 'fallback' },
              { href: 'sweet-treats.html?q=waffle', reason: 'fallback' },
              { href: 'gelato-lab.html?q=buontalenti', reason: 'fallback' },
            ],
            last?.href
          );
        }
      }

      state.lastSuggestedTurn = Number(state.turn) || state.lastSuggestedTurn || 0;
      state.genericTurns = 0;
    }

    this.saveConversationState(state);

    // Small talk gets a local conversational answer; only attach a card when suggestNow is true.
    if (this.isSmallTalk(msgNorm)) {
      const out = this.buildSmallTalkResponse(recoToAttach || inferred, !!recoToAttach);
      this.pushToHistory('user', userMessage);
      this.pushToHistory('assistant', out);
      return out;
    }

    // 2. STANDARD LLM LOGIC (proxy preferred)
    if (this.mode === 'proxy') {
      const endpoint = String(this.proxyEndpoint || '').trim();
      if (!endpoint) return "⚠️ Config proxy mancante. Imposta badianiBerny.config.v1.";

      // Notifica UI
      window.dispatchEvent(new CustomEvent('berny-typing-start'));

      try {
        const systemPrompt = this.buildSystemPrompt();
        const history = Array.isArray(this.history) ? this.history.slice(-this.MAX_HISTORY_TURNS) : [];
        const messages = [
          { role: 'system', content: systemPrompt },
          ...history,
          { role: 'user', content: String(userMessage ?? '') },
        ];

        const ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
        // Proxy calls may occasionally take longer (network + model latency).
        // A too-low timeout looks like a UI freeze.
        const timer = setTimeout(() => { try { ctrl?.abort(); } catch {} }, 25000);

        const headers = { 'content-type': 'application/json' };
        if (this.accessCode) {
          // Sent to Worker for server-side allowlist enforcement.
          headers['x-berny-access-code'] = String(this.accessCode);
        }

        // Optional: site-level verification token (phone OTP gate).
        // Stored by scripts/site.js after successful verification.
        try {
          const authToken = String(localStorage.getItem('badianiAuth.token.v1') || '').trim();
          if (authToken) headers['x-badiani-auth'] = authToken;
        } catch {}

        const r = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            intent: 'chat',
            userContext: {
              nickname: window.BadianiProfile?.getActive?.()?.nickname || '',
              language: (window.BadianiI18n?.getLang?.() || 'it'),
            },
            messages,
          }),
          signal: ctrl ? ctrl.signal : undefined,
        });
        clearTimeout(timer);

        if (r && r.status === 401) {
          return "🔒 Accesso richiesto. Scrivi '/access IL_TUO_CODICE' per attivarmi.";
        }

        if (r && r.status === 403) {
          return "⛔ Accesso negato (CORS/origine non autorizzata). Controlla ALLOWED_ORIGIN nel Worker.";
        }

        if (!r || !r.ok) {
          const t = await r.text().catch(() => '');
          return `❌ Proxy error ${r?.status || 0}: ${t}`;
        }
        const data = await r.json().catch(() => null);
        const text = String(data?.text || '').trim();
        const out = text || 'Mi sa che il proxy non mi ha risposto bene. Riprova tra poco.';
        this.pushToHistory('user', userMessage);
        this.pushToHistory('assistant', out);
        // Ensure the recommended card (when we have one) is specific and not always the same.
        return this.applyRecommendationToResponse(out, recoToAttach, { suppressLink: !recoToAttach });
      } catch (e) {
        const name = String(e?.name || '');
        if (name === 'AbortError') {
          return '⏳ Sto impiegando un po’ più del solito a rispondere (timeout). Riprova tra qualche secondo.';
        }
        return `❌ Proxy exception: ${String(e?.message || e)}`;
      } finally {
        window.dispatchEvent(new CustomEvent('berny-typing-end'));
      }
    }

    // SDK fallback
    if (!this.apiKey || this.apiKey.length < 10) return "⚠️ Scrivi '/apikey LA_TUA_CHIAVE' per attivarmi (oppure usa il proxy)!";
    if (!this.model) this.init();

    // Notifica UI
    window.dispatchEvent(new CustomEvent('berny-typing-start'));

    try {
      const systemPrompt = this.buildSystemPrompt();
      const fullPrompt = `${systemPrompt}\n\nUtente: ${userMessage}`;
      
      // TENTATIVO 1: Modello Veloce (Flash)
      console.log(`Tentativo 1 con ${this.modelName}...`);
      
      // Timeout di 8 secondi per evitare blocchi infiniti
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Timeout - Il modello ci sta mettendo troppo")), 8000)
      );

      const result = await Promise.race([
        this.model.generateContent(fullPrompt),
        timeoutPromise
      ]);

      const response = await result.response;
      const raw = response.text();
      this.pushToHistory('user', userMessage);
      this.pushToHistory('assistant', raw);
      return this.applyRecommendationToResponse(raw, recoToAttach, { suppressLink: !recoToAttach });

    } catch (error) {
      console.warn(`⚠️ Errore o Timeout (${error.message}). Passo al BACKUP...`);

      // Se fallisce per limiti (429), errore tecnico o TIMEOUT
      if (true) { // Entra sempre nel backup se il primo fallisce
        
        try {
          // TENTATIVO 2: Modello Backup (Gemini 1.5 Flash - Più stabile)
          const backupModel = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
          
          const systemPrompt = this.buildSystemPrompt();
          const result = await backupModel.generateContent(`${systemPrompt}\n\nUtente: ${userMessage}`);
          const response = await result.response;
          const raw = response.text();
          this.pushToHistory('user', userMessage);
          this.pushToHistory('assistant', raw);
          return this.applyRecommendationToResponse(raw, recoToAttach, { suppressLink: !recoToAttach }); 
          
        } catch (backupError) {
          console.error("❌ Anche il backup è fallito:", backupError);
          
          if (error.message.includes('404') || error.message.includes('403')) {
            return `❌ ERRORE CHIAVE API (${this.modelName}):\n\nGoogle dice che questa chiave non può usare il modello.\n\nVERIFICA:\n1. L'API "Generative Language API" è abilitata?\n2. Ci sono restrizioni IP/Referrer sulla chiave?\n\n(Errore: ${error.message})`;
          }

          return `❌ ERRORE TECNICO:\n${error.message}`;
        }
      }
      
      return `Errore tecnico: ${error.message}`;
    } finally {
      window.dispatchEvent(new CustomEvent('berny-typing-end'));
    }
  }

  buildSystemPrompt() {
    const kb = window.BERNY_KNOWLEDGE || {};
    const superKb = window.BERNY_SUPER_KNOWLEDGE || {};
    const appContext = window.FULL_APP_CONTEXT || "";
    
    // Rileva lingua utente (default IT)
    const userLangCode = (window.BadianiI18n?.getLang?.() || window.BadianiI18n?.currentLang || 'it').toLowerCase();
    
    const langMap = {
      'it': 'Italiano',
      'en': 'English',
      'es': 'Español',
      'fr': 'Français'
    };
    const userLang = langMap[userLangCode] || 'Italiano';
    
    let info = "";
    
    // 1. Inietta info dai prodotti (Legacy KB)
    if (kb.products) {
      info += "INFO PRODOTTI (Legacy):\n";
      Object.entries(kb.products).forEach(([key, val]) => {
        info += `- ${key.toUpperCase()}: ${val.response}\n`;
      });
    }

    // 2. Inietta Full App Context (Testo Gigante)
    if (appContext) {
      info += "\n--- FULL APP CONTEXT ---\n";
      info += appContext;
      info += "\n--- END APP CONTEXT ---\n";
    }

    // 3. Inietta Super Knowledge Base (Multilingua - se presente)
    if (superKb.manuals || superKb.pages) {
      info += "\nSUPER KNOWLEDGE BASE (Contesto Esteso):\n";
      // ... (resto della logica esistente)
    }

    return `
      SEI BERNY, ASSISTENTE DI BADIANI 1932. 🍦
      RISPONDI IN: ${userLang}

      ### 🍦 PROTOCOLLO "SECRET CHALLENGE" (Easter Egg)
      (NOTA: Il quiz è ora gestito direttamente dal codice, ma se l'utente chiede info generiche sul quiz, rispondi così:)
      Se l'utente chiede "come funziona il quiz" o simili:
      "Scrivi 'quiz' o 'sfida' per iniziare il test ufficiale e provare a vincere un gelato!"

      ### REGOLE DI TONO:
      Sii simpatico, leggermente sfacciato ma incoraggiante. Usa emoji gelato (🍦, 🍧, 🧊).

      IL TUO OBIETTIVO PRINCIPALE (se non è un quiz):
      Aiutare l'utente in modo utile e naturale:
      - Se la richiesta è operativa (procedura/prodotto/standard), dai una risposta "flash" (max 2 frasi).
      - Se la richiesta è generica o conversazionale, fai conversazione e fai UNA domanda di chiarimento.
      
      REGOLE DI RISPOSTA (Standard):
      1. Sii breve. Riassumi i punti chiave.
      2. NON fare elenchi puntati lunghi.
      3. Se manca contesto, chiedi una domanda di chiarimento (1 sola).
      4. Se è un tema operativo, puoi invitare ad aprire la scheda per i dettagli (non sempre).
      5. Usa emoji ma non esagerare.

      LINK SCHEDE (IMPORTANTE):
      I tag [[LINK:...]] vengono gestiti dal client per mantenere coerenza tra domanda e scheda consigliata.
      Quindi: NON inserire tag [[LINK:...]] nella risposta.

      CONOSCENZA ATTUALE:
      ${info}
    `;
  }
}

// Inizializza
document.addEventListener('DOMContentLoaded', () => {
  window.bernyBrain = new BernyBrainAPI();
});

// ------------------------------------------------------------
// Compatibilità con la chat esistente del sito
// - site.js / berny-ui.js chiamano: bernyBrain.sendMessage(userMessage, onChunk, onComplete)
// - Questo adapter usa processMessage() e pseudo-streama la risposta.
// ------------------------------------------------------------
(() => {
  const attach = (brain) => {
    if (!brain || typeof brain.processMessage !== 'function') return;
    if (typeof brain.sendMessage === 'function') return;

    brain.sendMessage = async (userMessage, onChunk, onComplete) => {
      try {
        const full = await brain.processMessage(String(userMessage ?? ''));
        const text = String(full ?? '');

        const sourceLabel = (String(brain?.mode || '') === 'proxy') ? 'proxy' : 'gemini-sdk';

        // pseudo-stream per UI
        if (typeof onChunk === 'function') {
          // Faster streaming so longer replies don't look like they "freeze" mid-sentence.
          const chunkSize = 4;
          let i = 0;
          const tick = () => {
            const c = text.slice(i, i + chunkSize);
            if (c) {
              try { onChunk(c); } catch {}
              i += chunkSize;
              window.setTimeout(tick, 15);
            } else {
              if (typeof onComplete === 'function') onComplete(text, sourceLabel);
            }
          };
          tick();
          return;
        }

        if (typeof onComplete === 'function') onComplete(text, sourceLabel);
      } catch (e) {
        const msg = 'Mi dispiace, ho un problema tecnico col mio cervello Google 🧠🔌.';
        if (typeof onComplete === 'function') onComplete(msg, 'error');
      }
    };
  };

  // Attach immediately if the instance exists, and also after DOMContentLoaded init.
  try { attach(window.bernyBrain); } catch {}
  document.addEventListener('DOMContentLoaded', () => {
    try { attach(window.bernyBrain); } catch {}
  });
})();
