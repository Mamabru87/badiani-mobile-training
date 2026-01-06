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
    this.recentHistory = [];
    this.genAI = null;
    this.model = null;

    // Recommendation state (to avoid always suggesting the same card)
    this.RECO_STORAGE_KEY = 'badianiBerny.lastRecommendation.v1';
    
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
  // Legacy KB quick answers
  // - When the question is clearly covered by BERNY_KNOWLEDGE.products, return that
  //   response directly instead of calling the LLM. This avoids occasional provider
  //   truncation and keeps “official” answers consistent.
  // ------------------------------
  matchLegacyKbProduct(userMessage) {
    const msgNorm = this.normalizeText(userMessage);
    if (!msgNorm) return null;

    const kb = window.BERNY_KNOWLEDGE || {};
    const products = kb && typeof kb === 'object' ? kb.products : null;
    if (!products || typeof products !== 'object') return null;

    let best = null;
    let bestScore = 0;

    const norm = (s) => this.normalizeText(s);

    for (const [key, val] of Object.entries(products)) {
      if (!val || typeof val !== 'object') continue;
      const response = String(val.response || '').trim();
      if (!response) continue;

      const keywords = Array.isArray(val.keywords) ? val.keywords : [];
      if (!keywords.length) continue;

      let score = 0;
      for (const kw of keywords) {
        const kwn = norm(kw);
        if (!kwn) continue;
        if (msgNorm.includes(kwn)) {
          // Longer, more specific keywords get a slightly higher weight.
          score += (kwn.length >= 12 ? 3 : (kwn.length >= 6 ? 2 : 1));
        }
      }

      if (score > bestScore) {
        bestScore = score;
        best = { key, response };
      }
    }

    // Conservative: require at least one solid signal.
    if (best && bestScore >= 2) return best;
    return null;
  }

  // Best-effort continuation for SDK mode too (Gemini SDK sometimes returns cut text).
  async continueIfTruncatedSdk({ systemPrompt, userMessage, assistantText, model }) {
    const out = String(assistantText || '').trim();
    if (!out) return out;
    this.recordConversationTurn(userMessage, out);
    if (!this.looksTruncatedAnswer(out)) return out;
    if (!model || typeof model.generateContent !== 'function') return out;

    const continuationPrompt = `${systemPrompt}\n\nUtente: ${String(userMessage ?? '')}\n\nAssistente: ${out}\n\nUtente: Continua e completa la risposta precedente. Finisci sempre le frasi e chiudi con punteggiatura. Non ripetere dall'inizio: continua da dove eri rimasto.`;

    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout - Continuation troppo lenta')), 8000)
      );

      const result2 = await Promise.race([
        model.generateContent(continuationPrompt),
        timeoutPromise,
      ]);

      const response2 = await result2.response;
      const add = String(response2?.text?.() || '').trim();
      if (add) return `${out} ${add}`.trim();
    } catch {
      // ignore
    }
    return out;
  }

  looksTruncatedAnswer(text) {
    // Remove control tags that might be appended after generation.
    const s = String(text || '')
      .replace(/\[\[LINK:.*?\]\]/g, '')
      .replace(/\[\[CMD:.*?\]\]/g, '')
      .replace(/\[\[NOLINK\]\]/g, '')
      .trim();
    if (!s) return false;

    // Ignore obvious error/status strings.
    if (/^(error|❌|⚠️|⛔|🔒|⏳)/i.test(s)) return false;

    // If it's very short, don't try to be clever.
    if (s.length < 60) return false;

    // If it ends with an ellipsis, it's often an incomplete thought in our UX.
    // Prefer completing the sentence.
    if (/(\.\.\.|…)$/.test(s)) return true;

    // Clean terminal punctuation => not truncated.
    if (/[.!?]$/.test(s)) return false;

    // If it ends with a closing quote/bracket AND there's punctuation before it, accept.
    if (/[)\]}'"”»]$/.test(s) && /[.!?…][)\]}'"”»]$/.test(s)) return false;

    // Trailing separators are a strong signal of truncation.
    if (/[,:;\-]$/.test(s)) return true;

    // Ending on a conjunction/connector is very likely cut.
    if (/\b(e|o|ma|che|quindi|perche|perché|cosi|così|oppure)$/i.test(s)) return true;

    // If the last token is very short (e.g. "cre"), it's very likely cut.
    const lastToken = s.split(/\s+/).pop() || '';
    if (lastToken.length <= 3) return true;

    // Otherwise: missing terminal punctuation is suspicious.
    return true;
  }

  // ------------------------------
  // Catalog-based deep-link resolver
  // - Uses badianiSearchCatalog.v2 (seeded on index.html) to map arbitrary queries
  //   to a real cardKey on the recommended page.
  // - This prevents "pagina giusta ma niente scroll" when q doesn't match any card id/title.
  // ------------------------------
  loadSearchCatalog() {
    const KEY = 'badianiSearchCatalog.v2';
    try {
      const raw = localStorage.getItem(KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === 'object' && parsed.pages && typeof parsed.pages === 'object') {
        return parsed;
      }
    } catch {}

    // Fallback: seed may expose itself globally.
    try {
      const seed = window.__BADIANI_SEARCH_CATALOG_SEED__;
      if (seed && typeof seed === 'object' && seed.pages && typeof seed.pages === 'object') return seed;
    } catch {}

    return null;
  }

  slugifyKey(value = '') {
    return (String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '')) || '';
  }

  tokenizeLoose(value = '') {
    const s = this.normalizeText(value)
      .replace(/[^a-z0-9\s]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!s) return [];
    const stop = new Set([
      'il','lo','la','i','gli','le','un','una','uno','di','del','della','dei','delle','da','in','su','per','con','senza',
      'e','o','ma','che','chi','cosa','come','quanto','quale','quali','quando','dove','mi','ti','si','no','ok','poi',
      'nel','nella','nei','nelle','al','allo','alla','agli','alle','a'
    ]);
    return s.split(' ').filter((t) => t.length >= 3 && !stop.has(t));
  }

  coerceHrefToCatalogCard(href, userMessage, assistantMessage) {
    const rawHref = String(href || '').trim();
    if (!rawHref) return rawHref;

    let url;
    try {
      url = new URL(rawHref, window.location.href);
    } catch {
      return rawHref;
    }

    const pageKey = (url.pathname || '').split('/').pop() || '';
    const qRaw = String(url.searchParams.get('q') || '').trim();
    if (!pageKey || !qRaw) return rawHref;

    const catalog = this.loadSearchCatalog();
    const page = catalog?.pages?.[pageKey];
    const cards = Array.isArray(page?.cards) ? page.cards : [];
    if (!cards.length) return rawHref;

    const qSlug = this.slugifyKey(qRaw);
    const qNorm = this.normalizeText(qRaw);

    // IMPORTANT:
    // Do not let a generic or wrongly-chosen q (e.g. 'panettone') bias the rewrite.
    // Only use qRaw as extra context when the user/assistant actually mentions it.
    const userNorm = this.normalizeText(userMessage);
    const assistantNorm = this.normalizeText(assistantMessage);
    const qMention = (qNorm || '').replace(/[-_]+/g, ' ').trim();
    const qMentioned = !!(qMention && (userNorm.includes(qMention) || assistantNorm.includes(qMention)));

    // Build a query context that strongly reflects user intent.
    const ctx = qMentioned
      ? `${String(userMessage || '')} ${String(assistantMessage || '')} ${qRaw}`
      : `${String(userMessage || '')} ${String(assistantMessage || '')}`;
    const qTokens = new Set(this.tokenizeLoose(ctx));

    let best = null;
    let bestScore = 0;

    for (const c of cards) {
      const cardKey = String(c?.cardKey || '').trim();
      const title = String(c?.title || '').trim();
      if (!cardKey) continue;

      const keySlug = this.slugifyKey(cardKey);
      const titleNorm = this.normalizeText(title);
      const titleSlug = this.slugifyKey(title);

      let score = 0;

      // Exact q -> cardKey match wins immediately.
      if (qSlug && (keySlug === qSlug || titleSlug === qSlug || titleNorm === qNorm)) {
        score += 100;
      }

      // Token overlap (handles synonyms like "coppa badiani" -> "Coppa Gelato").
      const titleTokens = this.tokenizeLoose(title);
      let overlap = 0;
      for (const t of titleTokens) {
        if (qTokens.has(t)) overlap += 1;
      }
      score += overlap * 5;

      // Light boost if the normalized title contains the normalized q (only if q is actually mentioned).
      if (qMentioned && qNorm && titleNorm && titleNorm.includes(qNorm)) score += 6;

      if (score > bestScore) {
        bestScore = score;
        best = { cardKey };
      }
    }

    // Conservative threshold: only rewrite if we're confident.
    if (best && best.cardKey && bestScore >= 8) {
      try {
        url.searchParams.set('q', String(best.cardKey));
        return url.pathname.endsWith(pageKey)
          ? `${pageKey}?${url.searchParams.toString()}`
          : `${url.pathname}?${url.searchParams.toString()}`;
      } catch {
        return rawHref;
      }
    }

    return rawHref;
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

  // Meta-requests like "upselling" or "setup" are cross-cutting.
  // If the user does NOT specify a product/category, we should ask a clarifying question
  // instead of guessing a page (which often produces "testo giusto, link sbagliato").
  isMetaGuidanceRequest(msgNorm) {
    const m = String(msgNorm || '');
    if (!m) return false;
    return /\b(upsell|upselling|setup|set\s*-\s*up|set\s+up|apertura|opening|chiusura|closing|service|servizio)\b/i.test(m);
  }

  // Lightweight topic detection for meta-requests.
  // Keep conservative: only true when we see explicit product/category signals.
  hasExplicitTopicSignal(msgNorm) {
    const m = String(msgNorm || '');
    if (!m) return false;
    return /\b(story\s*orbit|storia|firenze|origine|gelato|buontalenti|cono|coni|coppett|coppa|gusti|vetrina|caffe|caff[eè]|espresso|americano|cappuccino|chai|affogato|matcha|waffle|crepe|cr[eè]p|pancake|cakes|cake|torta|torte|fetta|slice|croissant|brownie|slitti|yo\s*-\s*yo|yoyo|churro|churros|panettone|pandoro|mulled|vin\s*brul|festive)\b/i.test(m);
  }

  buildClarificationForMetaGuidance(userMessage) {
    const lang = this.getUiLang();
    const base = String(userMessage || '').trim();

    // Keep it short and actionable; no link until clarified.
    const it =
      `Posso aiutarti volentieri, ma mi serve un dettaglio: su quale linea/prodotto vuoi fare "${base}"?\n` +
      `Esempi rapidi (scrivine uno): Gelato Lab (coni/coppette), Cakes (Pastry Lab), Crepe/Waffle (Sweet Treats), Bar & Drinks (caffè/matcha), Festive (churros/panettone), Slitti & Yo-Yo, oppure Operations (apertura/chiusura). [[NOLINK]]`;

    const en =
      `Happy to help—quick clarification: which product/category is your "${base}" about?\n` +
      `Examples: Gelato Lab (cones/cups), Cakes (Pastry Lab), Crepe/Waffle (Sweet Treats), Bar & Drinks, Festive, Slitti & Yo-Yo, or Operations (opening/closing). [[NOLINK]]`;

    const es =
      `¡Claro! Solo una aclaración: ¿sobre qué producto/categoría es tu "${base}"?\n` +
      `Ejemplos: Gelato Lab, Cakes (Pastry Lab), Crepe/Waffle (Sweet Treats), Bar & Drinks, Festive, Slitti & Yo-Yo, u Operations (apertura/cierre). [[NOLINK]]`;

    const fr =
      `Avec plaisir—petite précision: ton "${base}" concerne quel produit/catégorie ?\n` +
      `Exemples : Gelato Lab, Cakes (Pastry Lab), Crêpe/Waffle (Sweet Treats), Bar & Drinks, Festive, Slitti & Yo-Yo, ou Operations (ouverture/fermeture). [[NOLINK]]`;

    return ({ it, en, es, fr }[lang] || it);
  }

  inferRecommendationFromMessage(userMessage) {
    const uiLang = this.getUiLang();
    const msgNorm = this.normalizeText(userMessage);
    const words = msgNorm.split(' ').filter(Boolean);

    const has = (...needles) => needles.some(n => msgNorm.includes(this.normalizeText(n)));

    // High-signal direct mappings (topic -> page?q)
    const topicCandidates = [
      // Cakes / torta: route to Pastry Lab (avoid generic "upsell" sending users to Operations).
      { href: 'pastries.html?q=cakes', keys: ['cakes', 'cake', 'torta', 'torte', 'fetta', 'slice'] },
      { href: 'gelato-lab.html?q=buontalenti', keys: ['buontalenti'] },
      { href: 'gelato-lab.html?q=coppa-gelato', keys: ['coppa badiani', 'coppa gelato', 'coppa'] },
      { href: 'gelato-lab.html?q=cups', keys: ['coppette', 'cups', 'cup', 'copas gelato', 'coupes gelato'] },
      { href: 'gelato-lab.html?q=cones', keys: ['coni', 'cone', 'cones', 'cornets', 'conos'] },
      { href: 'gelato-lab.html?q=boxes', keys: ['box gelato', 'take home box', 'gelato boxes', 'boîtes glace', 'cajas helado'] },
      { href: 'gelato-lab.html?q=gusti', keys: ['gusti', 'flavour', 'flavors', 'parfums', 'sabores', 'sabor'] },
      { href: 'gelato-lab.html?q=vetrina', keys: ['vetrina', 'display', 'vitrine', 'vitrina'] },
      { href: 'gelato-lab.html?q=gelato-setup', keys: ['setup gelato', 'set up gelato'] },
      { href: 'gelato-lab.html?q=temperatura-porte-standard', keys: ['temperatura porte', 'porta gelato'] },
      { href: 'gelato-lab.html?q=shelf-life-treats-dopo-esposizione', keys: ['shelf life gelato', 'durata esposizione gelato'] },
      { href: 'gelato-lab.html?q=gestione-treat-freezer', keys: ['freezer treat', 'gestione freezer treat'] },
      { href: 'gelato-lab.html?q=regola-scampolo-1-4-pan', keys: ['regola scampolo', '1/4 pan', 'un quarto pan'] },
      { href: 'gelato-lab.html?q=chiusura-deep-clean-vetrina', keys: ['chiusura vetrina', 'deep clean vetrina'] },

      { href: 'caffe.html?q=espresso', keys: ['espresso', 'shot', 'estrazione', 'portafiltro', 'grinder', 'tamper', 'expreso', 'café espresso'] },
      { href: 'caffe.html?q=americano', keys: ['americano', 'caffe americano', 'caffè americano', 'american coffee', 'café americano'] },
      { href: 'caffe.html?q=smoothies-parametri-di-produzione', keys: ['smoothie', 'smoothies', 'frullato', 'frullati', 'frappe', 'frappè', 'frappé'] },
      // Be careful with generic keywords like "latte"/"milk": they would incorrectly match Chai Latte, Matcha Latte, Iced Latte, etc.
      { href: 'caffe.html?q=chai-latte', keys: ['chai', 'chai latte', 'chai-latte'] },
      { href: 'caffe.html?q=cappuccino', keys: ['cappuccino', 'microfoam', 'schiuma', 'schiuma fine', 'montare latte', 'latte art', 'steam', 'steam wand', 'lancia vapore', 'wand'] },
      { href: 'caffe.html?q=affogato', keys: ['affogato', 'dirty matcha'] },

      { href: 'sweet-treats.html?q=crepe', keys: ['crepe', 'crepes', 'crepe', 'crêpe', 'crêpes', 'crêpe', 'crêpes'] },
      { href: 'sweet-treats.html?q=waffle', keys: ['waffle'] },
      { href: 'sweet-treats.html?q=pancake', keys: ['pancake'] },

      { href: 'festive.html?q=churro', keys: ['churro', 'churros'] },
      { href: 'festive.html?q=panettone', keys: ['panettone', 'pandoro'] },
      { href: 'festive.html?q=mulled', keys: ['vin brule', 'vinbrule', 'mulled'] },

      { href: 'operations.html?q=apertura', keys: ['apertura', 'opening', 'open store'] },
      // NOTE: do NOT map generic "upsell/upselling" here; it must be anchored to a product.
      { href: 'operations.html?q=servizio', keys: ['servizio', 'service', 'obiezione'] },
      { href: 'operations.html?q=chiusura', keys: ['chiusura', 'closing', 'close store'] },
      { href: 'operations.html?q=pulizia', keys: ['pulizia', 'cleaning', 'sanificazione', 'sanitize'] },

      { href: 'slitti-yoyo.html?q=slitti', keys: ['slitti', 'yoyo', 'yo-yo', 'yo yo'] },
      { href: 'pastries.html?q=croissant', keys: ['croissant'] },
      { href: 'pastries.html?q=brownie', keys: ['brownie'] },
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
      return { href: pick?.href || 'operations.html?q=apertura', reason: isShort ? 'short' : 'smalltalk', label };
    }

    return null;
  }

  // Self-check: analyze what Berny actually discussed in the response.
  // Extract the main product discussed so the link matches what BERNY says, not just user keywords.
  extractMainProductFromResponse(assistantMessage) {
    const msgB = this.normalizeText(assistantMessage);
    if (!msgB) return null;

    const products = [
      // Pastries
      { href: 'pastries.html?q=cakes', keywords: ['cakes', 'cake', 'torta', 'torte', 'fetta', 'chocolate carrot walnut'] },
      { href: 'pastries.html?q=brownie', keywords: ['brownie', 'brownies', 'tray'] },
      { href: 'pastries.html?q=loaf', keywords: ['loaf', 'banana loaf'] },
      { href: 'pastries.html?q=croissant', keywords: ['croissant', 'croissants', 'farcit'] },
      { href: 'pastries.html?q=scone', keywords: ['scone', 'scones'] },
      // Gelato
      { href: 'gelato-lab.html?q=buontalenti', keywords: ['buontalenti'] },
      { href: 'gelato-lab.html?q=coppa', keywords: ['coppa badiani', 'coppa gelato', 'coppa'] },
      { href: 'gelato-lab.html?q=gusti', keywords: ['gusti', 'flavors', 'parfums'] },
      // Coffee
      { href: 'caffe.html?q=espresso', keywords: ['espresso', 'estrazione', 'portafiltro', 'expreso', 'espresso corto', 'café serré'] },
      { href: 'caffe.html?q=cappuccino', keywords: ['cappuccino', 'microfoam', 'schiuma fine', 'capuchino', 'mousse de lait'] },
      { href: 'caffe.html?q=hot-chocolate', keywords: ['hot chocolate', 'cioccolata calda', 'hot-choc', 'chocolate drink', 'chocolat chaud', 'chocolate caliente'] },
      { href: 'caffe.html?q=americano', keywords: ['americano', 'caffe americano', 'american coffee', 'café americano', 'café allongé'] },
      { href: 'caffe.html?q=smoothies-parametri-di-produzione', keywords: ['smoothie', 'smoothies', 'frullato', 'frullati', 'frappe', 'frappè', 'frappé', 'blender smoothie', 'fruit smoothie'] },
      { href: 'caffe.html?q=chai-latte', keywords: ['chai', 'chai latte', 'té chai', 'chaï latte'] },
      { href: 'caffe.html?q=macchiato', keywords: ['macchiato', 'espresso macchiato', 'macchiato corto', 'macchiato lungo', 'café manchado', 'café noisette'] },
      { href: 'caffe.html?q=flat-white', keywords: ['flat white', 'flat-white', 'flat blanco', 'flat blanc'] },
      { href: 'caffe.html?q=mocha', keywords: ['mocha', 'mocaccino', 'caffe mocha', 'caffè mocha', 'moka', 'moka latte'] },
      { href: 'caffe.html?q=tea', keywords: ['tea', 'tè', 'tisana', 'té', 'thé'] },
      { href: 'caffe.html?q=afternoon-tea', keywords: ['afternoon tea', 'high tea', 'tè pomeridiano', 'té de la tarde', 'thé de l après-midi'] },
      { href: 'caffe.html?q=whipped-coffee', keywords: ['whipped coffee', 'dalgona', 'caffe montato', 'caffè montato', 'café fouetté'] },
      { href: 'caffe.html?q=matcha-latte', keywords: ['matcha latte', 'matcha', 'matcha milk', 'matcha latte frío', 'matcha au lait'] },
      { href: 'caffe.html?q=iced-matcha', keywords: ['iced matcha', 'matcha freddo', 'matcha frio', 'matcha glacé'] },
      { href: 'caffe.html?q=matcha-affogato', keywords: ['matcha affogato', 'affogato matcha', 'affogato de matcha'] },
      { href: 'caffe.html?q=dirty-matcha', keywords: ['dirty matcha', 'matcha sporco', 'matcha sucio'] },
      { href: 'caffe.html?q=iced-americano', keywords: ['iced americano', 'americano freddo', 'americano frío', 'americano glacé'] },
      { href: 'caffe.html?q=iced-latte', keywords: ['iced latte', 'latte freddo', 'latte frío', 'latte glacé'] },
      { href: 'caffe.html?q=pistachio-iced-latte', keywords: ['pistachio iced latte', 'latte freddo pistacchio', 'latte pistacchio', 'latte frío pistacho', 'latte pistache'] },
      // Sweet treats
      { href: 'sweet-treats.html?q=crepe', keywords: ['crepe', 'crêpe', 'crepes', 'crepa', 'crepé', 'crêpes'] },
      { href: 'sweet-treats.html?q=waffle', keywords: ['waffle', 'waffles', 'gaufre'] },
      { href: 'sweet-treats.html?q=pancake', keywords: ['pancake', 'pancakes', 'tortita', 'crêpe épaisse'] },
      { href: 'sweet-treats.html?q=crepe-sauce', keywords: ['crepe sauce', 'crepe con salsa', 'crêpe sauce'] },
      { href: 'sweet-treats.html?q=buontalenti-crepe', keywords: ['buontalenti crepe', 'crepe buontalenti'] },
      { href: 'sweet-treats.html?q=italiana-plain', keywords: ['italiana', 'italiana plain', 'focaccia italiana'] },
      { href: 'sweet-treats.html?q=italiana-beetroot', keywords: ['italiana beetroot', 'italiana barbabietola', 'barbabietola'] },
      { href: 'sweet-treats.html?q=prosciutto-plain', keywords: ['prosciutto plain', 'prosciutto focaccia'] },
      { href: 'sweet-treats.html?q=prosciutto-beetroot', keywords: ['prosciutto beetroot', 'prosciutto barbabietola'] },
      { href: 'sweet-treats.html?q=gelato-burger', keywords: ['gelato burger', 'burger di gelato'] },
      { href: 'sweet-treats.html?q=checklist-apertura-stazioni', keywords: ['apertura stazioni', 'checklist apertura'] },
      { href: 'sweet-treats.html?q=settaggi-macchine-standard', keywords: ['settaggi macchine', 'macchine standard'] },
      { href: 'sweet-treats.html?q=shelf-life-storage-rapidi', keywords: ['shelf life sweet', 'conservazione dolci', 'storage rapidi'] },
      { href: 'sweet-treats.html?q=porzionatura-dosi-quick-ref', keywords: ['porzionatura dolci', 'dosi dolci', 'quick ref dolci'] },
      { href: 'sweet-treats.html?q=chiusura-pulizia-rapida', keywords: ['chiusura dolci', 'pulizia dolci'] },
      // Festive
      { href: 'festive.html?q=churro', keywords: ['churro', 'churros', 'churro caliente'] },
      { href: 'festive.html?q=panettone', keywords: ['panettone', 'pandoro', 'panetón', 'panettone classic', 'panettone classique'] },
      { href: 'festive.html?q=mulled', keywords: ['vin brule', 'mulled', 'vin chaud', 'vino caliente'] },
      { href: 'festive.html?q=panettone-classico', keywords: ['panettone classico', 'classic panettone'] },
      { href: 'festive.html?q=panettone-dark-chocolate', keywords: ['panettone dark', 'panettone cioccolato'] },
      { href: 'festive.html?q=pandoro-classico', keywords: ['pandoro', 'pandoro classico'] },
      { href: 'festive.html?q=servizio-caldo-pandoro', keywords: ['servizio caldo pandoro', 'warm pandoro'] },
      { href: 'festive.html?q=setup-macchina-vin-brul', keywords: ['setup vin brul', 'macchina vin brule'] },
      { href: 'festive.html?q=warm-up-mantenimento-vin-brul', keywords: ['warm up vin brul', 'mantenimento vin brule'] },
      { href: 'festive.html?q=come-conservarlo-di-notte', keywords: ['conservare vin brul', 'overnight vin brule'] },
      { href: 'festive.html?q=shelf-life-vin-brul-quick', keywords: ['shelf life vin brul', 'scadenza vin brule'] },
      { href: 'festive.html?q=pulizia-macchina-fine-giornata', keywords: ['pulizia macchina vin brul', 'cleaning vin brule'] },
      { href: 'festive.html?q=packaging-mini-panettone-delivery', keywords: ['packaging mini panettone', 'delivery panettone'] },
      // Other
      { href: 'slitti-yoyo.html?q=slitti', keywords: ['slitti', 'yoyo', 'yo-yo'] },
      // Gelato Lab products & procedures
      { href: 'gelato-lab.html?q=cups', keywords: ['cups', 'coppette', 'cup'] },
      { href: 'gelato-lab.html?q=cones', keywords: ['cones', 'coni', 'cono'] },
      { href: 'gelato-lab.html?q=boxes', keywords: ['boxes', 'box gelato', 'take home gelato'] },
      { href: 'gelato-lab.html?q=coppa-gelato', keywords: ['coppa gelato', 'gelato cup vetro', 'coppa'] },
      { href: 'gelato-lab.html?q=gelato-setup', keywords: ['setup gelato', 'set up gelato'] },
      { href: 'gelato-lab.html?q=temperatura-porte-standard', keywords: ['temperatura porte', 'porta gelato'] },
      { href: 'gelato-lab.html?q=shelf-life-treats-dopo-esposizione', keywords: ['shelf life gelato', 'durata esposizione gelato'] },
      { href: 'gelato-lab.html?q=gestione-treat-freezer', keywords: ['freezer treat', 'gestione freezer treat'] },
      { href: 'gelato-lab.html?q=regola-scampolo-1-4-pan', keywords: ['regola scampolo', '1/4 pan', 'un quarto pan'] },
      { href: 'gelato-lab.html?q=chiusura-deep-clean-vetrina', keywords: ['chiusura vetrina', 'deep clean vetrina'] },
      // Pastries procedures
      { href: 'pastries.html?q=set-up-vetrina-look-ordine', keywords: ['setup vetrina pastry', 'look ordine pastry'] },
      { href: 'pastries.html?q=tagli-standard-porzionatura', keywords: ['tagli standard pastry', 'porzionatura pastry'] },
      { href: 'pastries.html?q=shelf-life-quick-list', keywords: ['shelf life pastry', 'scadenze pastry'] },
      { href: 'pastries.html?q=come-mantenerla-sempre-piena', keywords: ['mantieni vetrina piena', 'vetrina sempre piena'] },
      { href: 'pastries.html?q=chiusura-vetrina-routine', keywords: ['chiusura vetrina pastry', 'routine chiusura pastry'] },
      // Operations additional
      { href: 'operations.html?q=ops-opening', keywords: ['ops opening', 'apertura negozio', 'apertura operativa'] },
      { href: 'operations.html?q=ops-daily-setup', keywords: ['daily setup', 'setup giornaliero', 'set up giornaliero'] },
      { href: 'operations.html?q=ops-warm-service', keywords: ['warm service', 'servizio caldo'] },
      { href: 'operations.html?q=packaging-take-away', keywords: ['packaging take away', 'packaging asporto'] },
      { href: 'operations.html?q=allestimento-macchina', keywords: ['allestimento macchina', 'setup macchina'] },
      { href: 'operations.html?q=service-chiusura', keywords: ['service chiusura', 'chiusura servizio'] },
      { href: 'operations.html?q=temperature-chiave-quick-map', keywords: ['temperature chiave', 'mappa temperature'] },
      { href: 'operations.html?q=fifo-etichette-regola-d-oro', keywords: ['fifo etichette', 'regola d oro'] },
      { href: 'operations.html?q=shelf-life-rapidi-mix-premade', keywords: ['shelf life premade', 'mix premade'] },
      { href: 'operations.html?q=take-away-autonomia-termica', keywords: ['autonomia termica', 'take away termico'] },
      { href: 'operations.html?q=schedule-pulizie-giorno-settimana', keywords: ['schedule pulizie', 'pulizie settimana'] },
    ];

    // STRATEGIA MIGLIORATA:
    // 1. Trova il PRIMO prodotto menzionato nel testo
    // 2. Se più prodotti, usa il posizionamento: prima menzione = priorità
    // 3. Scarta menzioni casuali alla fine (es: "vai in take away" dopo risposta su gelato)

    let bestMatch = null;
    let bestFirstPos = msgB.length; // Posizione della prima menzione nel testo
    let bestScore = 0;

    products.forEach((prod) => {
      let minPos = msgB.length; // Posizione della prima menzione di questo prodotto
      let score = 0;
      let foundCount = 0;

      (prod.keywords || []).forEach((kw) => {
        const kwn = this.normalizeText(kw);
        if (kwn && msgB.includes(kwn)) {
          foundCount++;
          const kwPos = msgB.indexOf(kwn); // Posizione della prima menzione di questo keyword
          minPos = Math.min(minPos, kwPos);
          // Score basato su lunghezza del keyword (più specifico = più importante)
          score += (kwn.length >= 15 ? 4 : (kwn.length >= 10 ? 3 : (kwn.length >= 6 ? 2 : 1)));
        }
      });

      if (score > 0) {
        // Bonus per il primo prodotto menzionato (early mention = core topic)
        const positionBonus = Math.max(0, (msgB.length - minPos) / msgB.length * 2);
        const finalScore = score + positionBonus;

        // Priorità: 
        // 1. Primo prodotto menzionato (minPos piccolo)
        // 2. Score più alto (più keyword match)
        if (minPos < bestFirstPos || (minPos === bestFirstPos && finalScore > bestScore)) {
          bestFirstPos = minPos;
          bestScore = finalScore;
          bestMatch = prod;
        }
      }
    });

    // Se trovato un match robusto (score >= 2 O primo prodotto menzionato nel primo 50% del testo)
    if (bestMatch && (bestScore >= 2 || bestFirstPos < msgB.length * 0.5)) {
      return bestMatch;
    }

    return null;
  }

  // Nuova funzione: cerca TUTTI i link rilevanti per il messaggio dell'utente
  // Ritorna un array di link con label
  inferMultipleRecommendations(userMessage, assistantMessage = '') {
    const results = [];
    const seenHrefs = new Set();
    
    const msgA = this.normalizeText(userMessage);
    const msgB = this.normalizeText(assistantMessage);
    
    const hasIn = (hay, needle) => {
      const n = this.normalizeText(needle);
      return !!(n && hay && hay.includes(n));
    };

    // Tutti i candidati (da inferRecommendationFromContext)
    const topicCandidates = [
      { href: 'pastries.html?q=cakes', keys: ['cakes', 'cake', 'torta', 'torte', 'fetta', 'slice'], label: '📖 Apri scheda Cakes' },
      { href: 'gelato-lab.html?q=buontalenti', keys: ['buontalenti'], label: '🍦 Apri scheda Buontalenti' },
      // Per smoothies: suggerisci sia i parametri che la scheda generica del Bar
      { href: 'caffe.html?q=smoothies-parametri-di-produzione', keys: ['smoothie', 'smoothies', 'frullato', 'frullati', 'frappe', 'frappè', 'frappé'], label: '🍹 Apri parametri Smoothies', relatedLink: { href: 'caffe.html', label: '☕ Apri scheda Bar & Drinks' } },
      { href: 'caffe.html', keys: ['caffe', 'caffè', 'espresso', 'cappuccino', 'bar', 'bevanda'], label: '☕ Apri scheda Bar & Drinks' },
      { href: 'sweet-treats.html?q=waffle', keys: ['waffle', 'waffel', 'crepe', 'crêpe', 'pancake'], label: '🧇 Apri scheda Sweet Treats' },
      { href: 'festive.html?q=churro', keys: ['churro', 'churros', 'panettone', 'natale', 'capodanno'], label: '🎄 Apri scheda Festive' },
      { href: 'story-orbit.html?q=story', keys: ['story', 'storia', 'badiani', 'firenze', 'origine', 'tradizione'], label: '🌟 Apri Story Orbit' },
      { href: 'slitti-yoyo.html', keys: ['slitti', 'yoyo', 'yo-yo', 'cioccolato'], label: '🍫 Apri scheda Slitti & Yo-Yo' },
      { href: 'gelato-lab.html', keys: ['gelato', 'gusto', 'flavour', 'flavor', 'ricetta'], label: '🍦 Apri scheda Gelato Lab' },
    ];

    // Verifica quali link sono rilevanti
    topicCandidates.forEach((cand) => {
      if (seenHrefs.has(cand.href)) return; // Evita duplicati
      
      for (const key of cand.keys) {
        if (hasIn(msgA, key) || hasIn(msgB, key)) {
          results.push({
            url: cand.href,
            label: cand.label
          });
          seenHrefs.add(cand.href);
          
          // Se c'è un link correlato (e.g., smoothies con bar), aggiungilo
          if (cand.relatedLink && !seenHrefs.has(cand.relatedLink.href)) {
            results.push({
              url: cand.relatedLink.href,
              label: cand.relatedLink.label
            });
            seenHrefs.add(cand.relatedLink.href);
          }
          break;
        }
      }
    });

    return results.length > 0 ? results : null;
  }

  // Prefer coherence between what the user asked and what Berny actually answered.
  // This reduces "testo giusto, link sbagliato" when the LLM drifts or the question is multi-topic.
  // NOW: check what BERNY discussed first, THEN fallback to user keywords.
  inferRecommendationFromContext(userMessage, assistantMessage, options = {}) {
    const allowWeak = !!options.allowWeak;
    // Step 1: What product did BERNY actually discuss in the response?
    const assistantProduct = this.extractMainProductFromResponse(assistantMessage);
    if (assistantProduct && assistantProduct.href) {
      return { href: assistantProduct.href, reason: 'response_content' };
    }

    // Step 2: Fallback to user intent keywords if no clear product in response.
    const msgA = this.normalizeText(userMessage);
    const msgB = this.normalizeText(assistantMessage);

    const hasIn = (hay, needle) => {
      const n = this.normalizeText(needle);
      return !!(n && hay && hay.includes(n));
    };

    const topicCandidates = [
      // Cakes / torta: route to Pastry Lab (avoid generic "servizio" matches hijacking the link).
      { href: 'pastries.html?q=cakes', keys: ['cakes', 'cake', 'torta', 'torte', 'fetta', 'slice'] },
      { href: 'gelato-lab.html?q=buontalenti', keys: ['buontalenti'] },
      { href: 'gelato-lab.html?q=coppa-gelato', keys: ['coppa badiani', 'coppa gelato', 'coppa'] },
      { href: 'gelato-lab.html?q=coni', keys: ['cono', 'coni', 'cone'] },
      { href: 'gelato-lab.html?q=gusti', keys: ['gusti', 'flavour', 'flavors', 'parfums', 'sabores'] },
      { href: 'gelato-lab.html?q=vetrina', keys: ['vetrina', 'display', 'vitrine'] },

      { href: 'caffe.html?q=espresso', keys: ['espresso', 'shot', 'estrazione', 'portafiltro', 'grinder', 'tamper'] },
      { href: 'caffe.html?q=americano', keys: ['americano', 'caffe americano', 'caffè americano', 'american coffee'] },
      { href: 'caffe.html?q=smoothies-parametri-di-produzione', keys: ['smoothie', 'smoothies', 'frullato', 'frullati', 'frappe', 'frappè', 'frappé'] },
      { href: 'caffe.html?q=hot-chocolate', keys: ['hot chocolate', 'hot-choc', 'cioccolata calda', 'chocolate drink', 'chocolat chaud', 'chocolate caliente'] },
      { href: 'caffe.html?q=macchiato', keys: ['macchiato', 'espresso macchiato', 'macchiato corto', 'macchiato lungo'] },
      { href: 'caffe.html?q=flat-white', keys: ['flat white', 'flat-white'] },
      { href: 'caffe.html?q=mocha', keys: ['mocha', 'mocaccino', 'caffe mocha', 'caffè mocha'] },
      { href: 'caffe.html?q=tea', keys: ['tea', 'tè', 'tisana'] },
      { href: 'caffe.html?q=afternoon-tea', keys: ['afternoon tea', 'high tea', 'tè pomeridiano'] },
      { href: 'caffe.html?q=whipped-coffee', keys: ['whipped coffee', 'dalgona', 'caffe montato', 'caffè montato'] },
      { href: 'caffe.html?q=matcha-latte', keys: ['matcha latte', 'matcha', 'matcha milk'] },
      { href: 'caffe.html?q=iced-matcha', keys: ['iced matcha', 'matcha freddo'] },
      { href: 'caffe.html?q=matcha-affogato', keys: ['matcha affogato', 'affogato matcha'] },
      { href: 'caffe.html?q=dirty-matcha', keys: ['dirty matcha', 'matcha sporco'] },
      { href: 'caffe.html?q=iced-americano', keys: ['iced americano', 'americano freddo'] },
      { href: 'caffe.html?q=iced-latte', keys: ['iced latte', 'latte freddo'] },
      { href: 'caffe.html?q=pistachio-iced-latte', keys: ['pistachio iced latte', 'latte freddo pistacchio', 'latte pistacchio'] },
      // Avoid generic "latte"/"milk" triggers, otherwise any *Latte* drink could be routed to cappuccino.
      { href: 'caffe.html?q=chai-latte', keys: ['chai', 'chai latte', 'chai-latte', 'té chai', 'chaï latte'] },
      { href: 'caffe.html?q=cappuccino', keys: ['cappuccino', 'microfoam', 'schiuma', 'schiuma fine', 'montare latte', 'latte art', 'steam', 'steam wand', 'lancia vapore', 'wand', 'capuchino'] },
      { href: 'caffe.html?q=affogato', keys: ['affogato', 'dirty matcha'] },

      { href: 'sweet-treats.html?q=crepe', keys: ['crepe', 'crepes', 'crêpe', 'crêpes', 'crêpe', 'crêpes'] },
      { href: 'sweet-treats.html?q=waffle', keys: ['waffle', 'gaufre'] },
      { href: 'sweet-treats.html?q=pancake', keys: ['pancake', 'tortita'] },
      { href: 'sweet-treats.html?q=crepe-sauce', keys: ['crepe sauce', 'crepe con salsa', 'crêpe sauce'] },
      { href: 'sweet-treats.html?q=buontalenti-crepe', keys: ['buontalenti crepe', 'crepe buontalenti'] },
      { href: 'sweet-treats.html?q=italiana-plain', keys: ['italiana', 'italiana plain', 'focaccia italiana'] },
      { href: 'sweet-treats.html?q=italiana-beetroot', keys: ['italiana beetroot', 'italiana barbabietola', 'barbabietola'] },
      { href: 'sweet-treats.html?q=prosciutto-plain', keys: ['prosciutto plain', 'prosciutto focaccia'] },
      { href: 'sweet-treats.html?q=prosciutto-beetroot', keys: ['prosciutto beetroot', 'prosciutto barbabietola'] },
      { href: 'sweet-treats.html?q=gelato-burger', keys: ['gelato burger', 'burger di gelato'] },
      { href: 'sweet-treats.html?q=checklist-apertura-stazioni', keys: ['apertura stazioni', 'checklist apertura'] },
      { href: 'sweet-treats.html?q=settaggi-macchine-standard', keys: ['settaggi macchine', 'macchine standard'] },
      { href: 'sweet-treats.html?q=shelf-life-storage-rapidi', keys: ['shelf life sweet', 'conservazione dolci', 'storage rapidi'] },
      { href: 'sweet-treats.html?q=porzionatura-dosi-quick-ref', keys: ['porzionatura dolci', 'dosi dolci', 'quick ref dolci'] },
      { href: 'sweet-treats.html?q=chiusura-pulizia-rapida', keys: ['chiusura dolci', 'pulizia dolci'] },

      { href: 'festive.html?q=churro', keys: ['churro', 'churros'] },
      { href: 'festive.html?q=panettone', keys: ['panettone', 'pandoro'] },
      { href: 'festive.html?q=mulled', keys: ['vin brule', 'vinbrule', 'mulled', 'vin chaud', 'vino caliente'] },
      { href: 'festive.html?q=panettone-classico', keys: ['panettone classico', 'classic panettone'] },
      { href: 'festive.html?q=panettone-dark-chocolate', keys: ['panettone dark', 'panettone cioccolato'] },
      { href: 'festive.html?q=pandoro-classico', keys: ['pandoro', 'pandoro classico'] },
      { href: 'festive.html?q=servizio-caldo-pandoro', keys: ['servizio caldo pandoro', 'warm pandoro'] },
      { href: 'festive.html?q=setup-macchina-vin-brul', keys: ['setup vin brul', 'macchina vin brule'] },
      { href: 'festive.html?q=warm-up-mantenimento-vin-brul', keys: ['warm up vin brul', 'mantenimento vin brule'] },
      { href: 'festive.html?q=come-conservarlo-di-notte', keys: ['conservare vin brul', 'overnight vin brule'] },
      { href: 'festive.html?q=shelf-life-vin-brul-quick', keys: ['shelf life vin brul', 'scadenza vin brule'] },
      { href: 'festive.html?q=pulizia-macchina-fine-giornata', keys: ['pulizia macchina vin brul', 'cleaning vin brule'] },
      { href: 'festive.html?q=packaging-mini-panettone-delivery', keys: ['packaging mini panettone', 'delivery panettone'] },

      { href: 'operations.html?q=apertura', keys: ['apertura', 'opening', 'open store'] },
      // NOTE: do NOT map generic "upsell/upselling" here; it must be anchored to a product.
      { href: 'operations.html?q=servizio', keys: ['servizio', 'service', 'obiezione'] },
      { href: 'operations.html?q=chiusura', keys: ['chiusura', 'closing', 'close store'] },
      { href: 'operations.html?q=pulizia', keys: ['pulizia', 'cleaning', 'sanificazione', 'sanitize'] },

      { href: 'operations.html?q=ops-opening', keys: ['ops opening', 'apertura negozio', 'apertura operativa'] },
      { href: 'operations.html?q=ops-daily-setup', keys: ['daily setup', 'setup giornaliero', 'set up giornaliero'] },
      { href: 'operations.html?q=ops-warm-service', keys: ['warm service', 'servizio caldo'] },
      { href: 'operations.html?q=packaging-take-away', keys: ['packaging take away', 'packaging asporto'] },
      { href: 'operations.html?q=allestimento-macchina', keys: ['allestimento macchina', 'setup macchina'] },
      { href: 'operations.html?q=service-chiusura', keys: ['service chiusura', 'chiusura servizio'] },
      { href: 'operations.html?q=temperature-chiave-quick-map', keys: ['temperature chiave', 'mappa temperature'] },
      { href: 'operations.html?q=fifo-etichette-regola-d-oro', keys: ['fifo etichette', 'regola d oro'] },
      { href: 'operations.html?q=shelf-life-rapidi-mix-premade', keys: ['shelf life premade', 'mix premade'] },
      { href: 'operations.html?q=take-away-autonomia-termica', keys: ['autonomia termica', 'take away termico'] },
      { href: 'operations.html?q=schedule-pulizie-giorno-settimana', keys: ['schedule pulizie', 'pulizie settimana'] },

      { href: 'slitti-yoyo.html?q=slitti', keys: ['slitti', 'yoyo', 'yo-yo', 'yo yo'] },
      { href: 'pastries.html?q=croissant', keys: ['croissant'] },
      { href: 'pastries.html?q=brownie', keys: ['brownie'] },
      { href: 'pastries.html?q=loaf', keys: ['loaf', 'banana loaf'] },
      { href: 'pastries.html?q=scones', keys: ['scones', 'scone'] },
      { href: 'pastries.html?q=set-up-vetrina-look-ordine', keys: ['setup vetrina pastry', 'look ordine pastry'] },
      { href: 'pastries.html?q=tagli-standard-porzionatura', keys: ['tagli standard pastry', 'porzionatura pastry'] },
      { href: 'pastries.html?q=shelf-life-quick-list', keys: ['shelf life pastry', 'scadenze pastry'] },
      { href: 'pastries.html?q=come-mantenerla-sempre-piena', keys: ['mantieni vetrina piena', 'vetrina sempre piena'] },
      { href: 'pastries.html?q=chiusura-vetrina-routine', keys: ['chiusura vetrina pastry', 'routine chiusura pastry'] },
      { href: 'story-orbit.html?q=story', keys: ['story orbit', 'firenze', 'origine', 'storia'] },
    ];

    // Scoring:
    // - User intent must dominate. Many drinks (e.g. Americano) *contain* the word "espresso" in the explanation,
    //   so we must not allow assistant-only matches (espresso/shot) to override an explicit user query.
    // - We first maximize userScore; only then use assistantScore as a tie-breaker.
    let best = null;
    let bestUserScore = 0;
    let bestAssistantScore = 0;
    let bestTotalScore = 0;
    topicCandidates.forEach((cand) => {
      const keys = Array.isArray(cand.keys) ? cand.keys : [];
      let userScore = 0;
      let assistantScore = 0;
      keys.forEach((k) => {
        if (hasIn(msgA, k)) userScore += 3;
        if (hasIn(msgB, k)) assistantScore += 2;
      });
      const totalScore = userScore + assistantScore;

      // Prefer higher userScore; then higher totalScore.
      if (
        userScore > bestUserScore ||
        (userScore === bestUserScore && totalScore > bestTotalScore)
      ) {
        bestUserScore = userScore;
        bestAssistantScore = assistantScore;
        bestTotalScore = totalScore;
        best = cand;
      }
    });

    // Se non c'è un match forte lato utente, non forzare un link.
    if (best && best.href && (bestUserScore >= 3 || allowWeak)) {
      return { href: best.href, reason: 'keyword' };
    }

    // Special case: onboarding / generic questions where the user did not name a topic,
    // but the assistant explicitly recommended Story Orbit.
    // In that case, we WANT the link to follow the recommendation (and not be hijacked by
    // generic words like "gelato" present in the explanation).
    if (
      bestUserScore === 0 &&
      bestAssistantScore >= 2 &&
      (hasIn(msgB, 'story orbit') || hasIn(msgB, 'story-orbit') || hasIn(msgB, 'storia'))
    ) {
      return { href: 'story-orbit.html?q=story', reason: 'assistant_explicit' };
    }

    // Fallback: se non c'è sufficiente contesto, niente link.
    if (!allowWeak) return null;

    return this.inferRecommendationFromMessage(userMessage);
  }

  // Helper: prova a ottenere link multipli, altrimenti ritorna un singolo link
  getRecommendationOrMultiple(userMessage, assistantMessage = '', allowWeak = false) {
    const multipleRecos = this.inferMultipleRecommendations(userMessage, assistantMessage);
    if (multipleRecos && multipleRecos.length > 1) {
      console.log('🎯 Found multiple recommendations:', multipleRecos);
      return multipleRecos;
    }
    // Altrimenti ritorna il link singolo
    const singleReco = this.inferRecommendationFromContext(userMessage, assistantMessage, { allowWeak });
    console.log('📌 Found single recommendation:', singleReco);
    return singleReco;
  }

  buildSmallTalkResponse(reco) {
    const lang = this.getUiLang();
    const topicLabel = String(reco?.label || '').trim();
    const topic = topicLabel || (lang === 'en' ? 'a quick refresher' : 'un ripasso veloce');

    const templates = {
      it: `Sto benissimo: fresco come una vaschetta a -14°C 🧊🍦. Se vuoi, ti apro una scheda per ripassare ${topic}.`,
      en: `I'm doing great—cool as gelato at -14°C 🧊🍦. If you want, I'll open a card so you can refresh ${topic}.`,
      es: `¡Estoy genial—fresco como un helado a -14°C 🧊🍦! Si quieres, te abro una ficha para repasar ${topic}.`,
      fr: `Je vais super bien—frais comme une glace à -14°C 🧊🍦. Si tu veux, j'ouvre une fiche pour réviser ${topic}.`,
    };

    const base = templates[lang] || templates.it;
    const href = reco?.href;
    if (!href) return base;
    return `${base} [[LINK:${href}]]`;
  }

  applyRecommendationToResponse(text, reco) {
    let out = String(text ?? '').trim();
    if (!out) return out;

    // Respect explicit suppression (quiz + other special flows)
    if (out.includes('[[NOLINK]]')) {
      return out;
    }

    // Remove any model-provided link tags; we will attach a coherent one when we have a recommendation.
    out = out.replace(/\[\[LINK:.*?\]\]/g, '').trim();
    out = out.replace(/\[\[LINKS:\[.*?\]\]\]/g, '').trim();

    if (reco) {
      // Se reco è un array di link multipli
      if (Array.isArray(reco) && reco.length > 0) {
        console.log('🔗 applyRecommendationToResponse - Multiple links detected:', reco);
        const linksJson = JSON.stringify(reco);
        const linksStr = linksJson.slice(1, -1);
        out = `${out} [[LINKS:[${linksStr}]]]`;
        console.log('📎 Applied LINKS tag:', out.substring(Math.max(0, out.length - 100)));
        // Salva il primo come recommendation principale
        if (reco[0] && reco[0].href) {
          this.saveLastRecommendation({ href: reco[0].href });
        }
      } else if (reco && reco.href) {
        // Link singolo
        out = `${out} [[LINK:${reco.href}]]`;
        this.saveLastRecommendation(reco);
      }
    }

    return out;
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

  // Memoria breve: conserva le ultime 2-3 coppie (user/assistant) per follow-up
  recordConversationTurn(userText, assistantText) {
    if (userText) this.recentHistory.push({ role: 'user', content: String(userText || '').trim() });
    if (assistantText) this.recentHistory.push({ role: 'assistant', content: String(assistantText || '').trim() });
    // Tieni solo le ultime 6 entry (3 turni completi)
    if (this.recentHistory.length > 6) {
      this.recentHistory = this.recentHistory.slice(this.recentHistory.length - 6);
    }
  }

  getRecentHistoryMessages(maxPairs = 3) {
    // Restituisce array di messaggi {role, content} per il prompt
    const entries = [...this.recentHistory];
    // Limita a maxPairs*2 dalla fine
    const keep = Math.max(0, Math.min(entries.length, maxPairs * 2));
    return entries.slice(entries.length - keep).map((e) => ({ role: e.role, content: e.content }));
  }

  renderRecentHistoryForPrompt(maxPairs = 3) {
    const msgs = this.getRecentHistoryMessages(maxPairs);
    if (!msgs.length) return '';
    const lines = msgs.map((m) => `${m.role === 'assistant' ? 'Assistente' : 'Utente'}: ${m.content}`);
    return `CONTESTO PRECEDENTE (breve):\n${lines.join('\n')}`;
  }

  async processMessage(userMessage) {
    // 1. QUIZ INTERCEPTION
    if (this.quizState.active) {
        return this.handleQuizAnswer(userMessage);
    }

    const detectedLang = this.detectLanguage(userMessage);
    if (detectedLang) {
        return this.startQuiz(detectedLang);
    }

    // 1b. Handle very short / small-talk inputs locally so the suggestion card is coherent and varies.
    const reco = this.inferRecommendationFromMessage(userMessage);
    const msgNorm = this.normalizeText(userMessage);
    if (this.isSmallTalk(msgNorm)) {
      const resp = this.buildSmallTalkResponse(reco);
      this.recordConversationTurn(userMessage, resp);
      return resp;
    }

    // 1b2. Meta-guidance (upselling/setup/open/close/service): require an explicit topic.
    // If missing, ask a clarifying question instead of guessing a page.
    // (Keeps the generated link coherent and avoids "Pandoro" hijacks.)
    if (this.isMetaGuidanceRequest(msgNorm) && !this.hasExplicitTopicSignal(msgNorm)) {
      const resp = this.buildClarificationForMetaGuidance(userMessage);
      this.recordConversationTurn(userMessage, resp);
      return resp;
    }

    // 1c. If the question clearly matches a legacy KB entry, answer locally.
    // This prevents occasional mid-sentence truncation from providers.
    const kbHit = this.matchLegacyKbProduct(userMessage);
    if (kbHit && kbHit.response) {
      const localOut = String(kbHit.response).trim();
      
      // Prova prima a cercare link multipli (per prodotti come smoothies)
      const multipleRecos = this.inferMultipleRecommendations(userMessage, localOut);
      let finalResp;
      
      if (multipleRecos && multipleRecos.length > 1) {
        // Se ci sono link multipli, usali
        finalResp = this.applyRecommendationToResponse(localOut, multipleRecos);
      } else {
        // Altrimenti usa il sistema singolo
        const recoLocal = this.inferRecommendationFromContext(userMessage, localOut, { allowWeak: false });
        if (recoLocal?.href) {
          recoLocal.href = this.coerceHrefToCatalogCard(recoLocal.href, userMessage, localOut);
        }
        finalResp = this.applyRecommendationToResponse(localOut, recoLocal);
      }
      
      this.recordConversationTurn(userMessage, finalResp);
      return finalResp;
    }

    // 2. STANDARD LLM LOGIC (proxy preferred)
    if (this.mode === 'proxy') {
      const endpoint = String(this.proxyEndpoint || '').trim();
      if (!endpoint) return "⚠️ Config proxy mancante. Imposta badianiBerny.config.v1.";

      // Notifica UI
      window.dispatchEvent(new CustomEvent('berny-typing-start'));

      try {
        const systemPrompt = this.buildSystemPrompt();
        const historyMsgs = this.getRecentHistoryMessages(3); // ultime 3 coppie
        const messages = [
          { role: 'system', content: systemPrompt },
          ...historyMsgs,
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
        let out = text || 'Mi sa che il proxy non mi ha risposto bene. Riprova tra poco.';

        // If the model output is occasionally cut mid-sentence, do one continuation round-trip.
        // This is best-effort and only triggers when the output looks truncated.
        if (out && this.looksTruncatedAnswer(out)) {
          try {
            const continuationMessages = [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: String(userMessage ?? '') },
              { role: 'assistant', content: String(out) },
              {
                role: 'user',
                content:
                  "Continua e completa la risposta precedente. Finisci sempre le frasi e chiudi con punteggiatura. Non ripetere dall'inizio: continua da dove eri rimasto.",
              },
            ];

            const ctrl2 = (typeof AbortController !== 'undefined') ? new AbortController() : null;
            const timer2 = setTimeout(() => { try { ctrl2?.abort(); } catch {} }, 20000);

            const r2 = await fetch(endpoint, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                intent: 'chat',
                userContext: {
                  nickname: window.BadianiProfile?.getActive?.()?.nickname || '',
                  language: (window.BadianiI18n?.getLang?.() || 'it'),
                },
                messages: continuationMessages,
              }),
              signal: ctrl2 ? ctrl2.signal : undefined,
            });
            clearTimeout(timer2);

            if (r2 && r2.ok) {
              const data2 = await r2.json().catch(() => null);
              const add = String(data2?.text || '').trim();
              if (add) out = `${String(out).trim()} ${add}`.trim();
            }
          } catch {
            // ignore and keep original
          }
        }

        const recoFinal = this.getRecommendationOrMultiple(userMessage, out, false);
        
        // Se è un array (link multipli), non c'è bisogno di coerceHref
        if (Array.isArray(recoFinal)) {
          // Link multipli
          const finalResponse = this.applyRecommendationToResponse(out, recoFinal);
          this.recordConversationTurn(userMessage, finalResponse);
          return finalResponse;
        } else if (recoFinal?.href) {
          // Link singolo
          recoFinal.href = this.coerceHrefToCatalogCard(recoFinal.href, userMessage, out);
          const finalResponse = this.applyRecommendationToResponse(out, recoFinal);
          this.recordConversationTurn(userMessage, finalResponse);
          return finalResponse;
        } else {
          // Nessun link
          const finalResponse = this.applyRecommendationToResponse(out, null);
          this.recordConversationTurn(userMessage, finalResponse);
          return finalResponse;
        }
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
      const historyText = this.renderRecentHistoryForPrompt(3);
      const contextBlock = historyText ? `\n${historyText}\n` : '';
      const fullPrompt = `${systemPrompt}${contextBlock}\nUtente: ${userMessage}`;
      
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
      let out = response.text();

      // SDK continuation retry (same idea as proxy) if the output looks cut.
      out = await this.continueIfTruncatedSdk({
        systemPrompt,
        userMessage,
        assistantText: out,
        model: this.model,
      });

      const recoFinal = this.getRecommendationOrMultiple(userMessage, out, false);
      
      // Se è un array (link multipli), non c'è bisogno di coerceHref
      if (Array.isArray(recoFinal)) {
        // Link multipli
        const finalResponse = this.applyRecommendationToResponse(out, recoFinal);
        this.recordConversationTurn(userMessage, finalResponse);
        return finalResponse;
      } else if (recoFinal?.href) {
        // Link singolo
        recoFinal.href = this.coerceHrefToCatalogCard(recoFinal.href, userMessage, out);
        const finalResponse = this.applyRecommendationToResponse(out, recoFinal);
        this.recordConversationTurn(userMessage, finalResponse);
        return finalResponse;
      } else {
        // Nessun link
        const finalResponse = this.applyRecommendationToResponse(out, null);
        this.recordConversationTurn(userMessage, finalResponse);
        return finalResponse;
      }

    } catch (error) {
      console.warn(`⚠️ Errore o Timeout (${error.message}). Passo al BACKUP...`);

      // Se fallisce per limiti (429), errore tecnico o TIMEOUT
      if (true) { // Entra sempre nel backup se il primo fallisce
        
        try {
          // TENTATIVO 2: Modello Backup (Gemini 1.5 Flash - Più stabile)
          const backupModel = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
          
          const systemPrompt = this.buildSystemPrompt();
          const historyText = this.renderRecentHistoryForPrompt(3);
          const contextBlock = historyText ? `\n${historyText}\n` : '';
          const result = await backupModel.generateContent(`${systemPrompt}${contextBlock}\nUtente: ${userMessage}`);
          const response = await result.response;
          let out = response.text();

          out = await this.continueIfTruncatedSdk({
            systemPrompt,
            userMessage,
            assistantText: out,
            model: backupModel,
          });

          const recoFinal = this.getRecommendationOrMultiple(userMessage, out, false);
          
          // Se è un array (link multipli), non c'è bisogno di coerceHref
          if (Array.isArray(recoFinal)) {
            // Link multipli
            const finalResponse = this.applyRecommendationToResponse(out, recoFinal);
            this.recordConversationTurn(userMessage, finalResponse);
            return finalResponse;
          } else if (recoFinal?.href) {
            // Link singolo
            recoFinal.href = this.coerceHrefToCatalogCard(recoFinal.href, userMessage, out);
            const finalResponse = this.applyRecommendationToResponse(out, recoFinal);
            this.recordConversationTurn(userMessage, finalResponse);
            return finalResponse;
          } else {
            // Nessun link
            const finalResponse = this.applyRecommendationToResponse(out, null);
            this.recordConversationTurn(userMessage, finalResponse);
            return finalResponse;
          }
          
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

      ⚠️ SINTETICITÀ OBBLIGATORIA:
      Risposte BREVI e DIRETTE: massimo 2-3 frasi. NO a paragrafi lunghi.
      Se serve spiegare di più: invita l'utente ad aprire la scheda per i dettagli completi.

      IL TUO OBIETTIVO PRINCIPALE (se non è un quiz):
      Rispondere in 1-3 frasi brevi e invitare l'utente ad aprire la scheda tecnica per i dettagli completi.
      
      REGOLE DI RISPOSTA (Standard):
      1. Rispondi in modo BREVE E DIRETTO alla domanda (massimo 2-3 frasi).
      2. Se servono dettagli, usa un mini elenco (max 2-3 bullet).
      3. NON troncare mai una frase a metà: chiudi sempre con punteggiatura (., !, ?).
      4. Se non hai certezza, dichiaralo brevemente.
      5. Chiudi invitando ad aprire la scheda per i dettagli (usa la lingua dell'utente).
      6. Usa emoji ma non esagerare.

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
          // Slightly slower streaming per richiesta: scrittura più lenta e naturale
          const chunkSize = 2;
          let i = 0;
          const tick = () => {
            const c = text.slice(i, i + chunkSize);
            if (c) {
              try { onChunk(c); } catch {}
              i += chunkSize;
              window.setTimeout(tick, 35);
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
