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
        // === GELATO TEMPERATURE ===
        { text: "Qual è la temperatura ideale per conservare il gelato in vetrina?\nA) -5°C / -8°C\nB) -8°C / -14°C\nC) -14°C / -18°C\nD) -18°C / -20°C", answer: "B" },
        { text: "Qual è la temperatura ideale per servire il gelato al cliente?\nA) -18°C\nB) -14°C\nC) -10°C / -12°C\nD) -5°C", answer: "C" },
        // === CAFFÈ ===
        { text: "Qual è la temperatura ideale dell'acqua per estrarre un espresso perfetto?\nA) 70-75°C\nB) 88-92°C\nC) 95-100°C\nD) 60-65°C", answer: "B" },
        { text: "Quanti bar di pressione sono necessari per estrarre un espresso?\nA) 5 bar\nB) 9 bar\nC) 15 bar\nD) 20 bar", answer: "B" },
        { text: "Quanto deve durare l'estrazione di un espresso?\nA) 10-15 sec\nB) 25-30 sec\nC) 45-50 sec\nD) 60 sec", answer: "B" },
        { text: "A quale temperatura va montato il latte per un cappuccino cremoso?\nA) 55°C\nB) 65°C\nC) 75°C\nD) 85°C", answer: "B" },
        // === FESTIVE ===
        { text: "Panettone: entro quanti giorni va consumato dopo l'apertura?\nA) 1 giorno\nB) 2-3 giorni\nC) 7 giorni\nD) 14 giorni", answer: "B" },
        // === BRAND ===
        { text: "In che anno è stata fondata Badiani a Firenze?\nA) 1912\nB) 1932\nC) 1952\nD) 1972", answer: "B" },
        { text: "Come si chiama il famoso gelato al gusto crema Badiani?\nA) Fiorellino\nB) Buontalenti\nC) Medici\nD) Rinascimento", answer: "B" }
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
        { text: "Waffle: how much batter corresponds to \"one entire scoopful\"?\nA) 120 ml\nB) 150 ml\nC) 177 ml\nD) 250 ml", answer: "C" },
        // === GELATO TEMPERATURE ===
        { text: "What is the ideal temperature for storing gelato in the display case?\nA) -5°C / -8°C\nB) -8°C / -14°C\nC) -14°C / -18°C\nD) -18°C / -20°C", answer: "B" },
        { text: "What is the ideal temperature for serving gelato to customers?\nA) -18°C\nB) -14°C\nC) -10°C / -12°C\nD) -5°C", answer: "C" },
        // === COFFEE ===
        { text: "What is the ideal water temperature for extracting a perfect espresso?\nA) 70-75°C\nB) 88-92°C\nC) 95-100°C\nD) 60-65°C", answer: "B" },
        { text: "How many bars of pressure are needed to extract an espresso?\nA) 5 bar\nB) 9 bar\nC) 15 bar\nD) 20 bar", answer: "B" },
        { text: "How long should espresso extraction take?\nA) 10-15 sec\nB) 25-30 sec\nC) 45-50 sec\nD) 60 sec", answer: "B" },
        { text: "At what temperature should milk be steamed for a creamy cappuccino?\nA) 55°C\nB) 65°C\nC) 75°C\nD) 85°C", answer: "B" },
        // === FESTIVE ===
        { text: "Panettone: within how many days should it be consumed after opening?\nA) 1 day\nB) 2-3 days\nC) 7 days\nD) 14 days", answer: "B" },
        { text: "Churros: what is the exact fryer temperature?\nA) 170°C\nB) 180°C\nC) 190°C\nD) 200°C", answer: "C" },
        // === BRAND ===
        { text: "In what year was Badiani founded in Florence?\nA) 1912\nB) 1932\nC) 1952\nD) 1972", answer: "B" },
        { text: "What is the name of Badiani's famous cream-flavored gelato?\nA) Fiorellino\nB) Buontalenti\nC) Medici\nD) Rinascimento", answer: "B" }
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
        { text: "Waffle: ¿cuánta masa corresponde a \"one entire scoopful\"?\nA) 120 ml\nB) 150 ml\nC) 177 ml\nD) 250 ml", answer: "C" },
        // === GELATO TEMPERATURA ===
        { text: "¿Cuál es la temperatura ideal para conservar el helado en vitrina?\nA) -5°C / -8°C\nB) -8°C / -14°C\nC) -14°C / -18°C\nD) -18°C / -20°C", answer: "B" },
        { text: "¿Cuál es la temperatura ideal para servir el helado?\nA) -18°C\nB) -14°C\nC) -10°C / -12°C\nD) -5°C", answer: "C" },
        // === CAFÉ ===
        { text: "¿Cuál es la temperatura ideal del agua para extraer un espresso perfecto?\nA) 70-75°C\nB) 88-92°C\nC) 95-100°C\nD) 60-65°C", answer: "B" },
        { text: "¿Cuántos bares de presión se necesitan para extraer un espresso?\nA) 5 bar\nB) 9 bar\nC) 15 bar\nD) 20 bar", answer: "B" },
        { text: "¿Cuánto debe durar la extracción de un espresso?\nA) 10-15 seg\nB) 25-30 seg\nC) 45-50 seg\nD) 60 seg", answer: "B" },
        { text: "¿A qué temperatura se debe calentar la leche para un cappuccino cremoso?\nA) 55°C\nB) 65°C\nC) 75°C\nD) 85°C", answer: "B" },
        // === FESTIVO ===
        { text: "Panettone: ¿en cuántos días debe consumirse después de abrir?\nA) 1 día\nB) 2-3 días\nC) 7 días\nD) 14 días", answer: "B" },
        { text: "Churros: ¿cuál es la temperatura exacta de la freidora?\nA) 170°C\nB) 180°C\nC) 190°C\nD) 200°C", answer: "C" },
        // === MARCA ===
        { text: "¿En qué año fue fundada Badiani en Florencia?\nA) 1912\nB) 1932\nC) 1952\nD) 1972", answer: "B" },
        { text: "¿Cómo se llama el famoso helado de crema Badiani?\nA) Fiorellino\nB) Buontalenti\nC) Medici\nD) Rinascimento", answer: "B" }
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
        { text: "Waffle : quel volume de pâte correspond à \"one entire scoopful\" ?\nA) 120 ml\nB) 150 ml\nC) 177 ml\nD) 250 ml", answer: "C" },
        // === TEMPÉRATURE GLACE ===
        { text: "Quelle température pour conserver la glace en vitrine ?\nA) -5°C / -8°C\nB) -8°C / -14°C\nC) -14°C / -18°C\nD) -18°C / -20°C", answer: "B" },
        { text: "Quelle température pour servir la glace ?\nA) -18°C\nB) -14°C\nC) -10°C / -12°C\nD) -5°C", answer: "C" },
        // === CAFÉ ===
        { text: "Quelle est la température idéale de l'eau pour un espresso parfait ?\nA) 70-75°C\nB) 88-92°C\nC) 95-100°C\nD) 60-65°C", answer: "B" },
        { text: "Combien de bars de pression pour extraire un espresso ?\nA) 5 bars\nB) 9 bars\nC) 15 bars\nD) 20 bars", answer: "B" },
        { text: "Combien de temps dure l'extraction d'un espresso ?\nA) 10-15 sec\nB) 25-30 sec\nC) 45-50 sec\nD) 60 sec", answer: "B" },
        { text: "À quelle température faire mousser le lait pour un cappuccino crémeux ?\nA) 55°C\nB) 65°C\nC) 75°C\nD) 85°C", answer: "B" },
        // === FESTIF ===
        { text: "Panettone : sous combien de jours le consommer après ouverture ?\nA) 1 jour\nB) 2-3 jours\nC) 7 jours\nD) 14 jours", answer: "B" },
        { text: "Churros : quelle température de la friteuse ?\nA) 170°C\nB) 180°C\nC) 190°C\nD) 200°C", answer: "C" },
        // === MARQUE ===
        { text: "En quelle année Badiani a été fondée à Florence ?\nA) 1912\nB) 1932\nC) 1952\nD) 1972", answer: "B" },
        { text: "Comment s'appelle la fameuse glace à la crème Badiani ?\nA) Fiorellino\nB) Buontalenti\nC) Medici\nD) Rinascimento", answer: "B" }
      ]
    };

    this.init();
  }

  // Keep CTAs compact: 0..3 links max.
  // Heuristic: if a "parameters/production" style link exists, prefer including it.
  limitLinks(recos, max = 3) {
    const list = Array.isArray(recos) ? recos.filter(Boolean) : [];
    const limit = Math.max(0, Number(max) || 0);
    if (!limit) return [];
    if (list.length <= limit) return list;

    const norm = (s) => this.normalizeText(String(s || ''));
    const isParams = (r) => {
      const href = norm(r?.href || r?.url || '');
      const label = norm(r?.label || '');
      return (
        href.includes('parametri') ||
        href.includes('produzione') ||
        href.includes('production') ||
        label.includes('parametri') ||
        label.includes('produzione') ||
        label.includes('production')
      );
    };

    // Start with the first N.
    const out = list.slice(0, limit);

    // If the limited set has no params link but the full set has one, swap it in.
    const outHasParams = out.some(isParams);
    if (!outHasParams) {
      const paramsCandidate = list.find(isParams);
      if (paramsCandidate) {
        // Replace the last slot to keep ordering mostly stable.
        out[limit - 1] = paramsCandidate;
      }
    }

    // De-dup by href/url just in case swapping introduced duplicates.
    const seen = new Set();
    const deduped = [];
    for (const r of out) {
      const key = String(r?.href || r?.url || '').trim();
      if (!key) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(r);
    }

    // If dedupe reduced items, refill from original list (still respecting max).
    if (deduped.length < limit) {
      for (const r of list) {
        const key = String(r?.href || r?.url || '').trim();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        deduped.push(r);
        if (deduped.length >= limit) break;
      }
    }

    return deduped.slice(0, limit);
  }

  // ------------------------------
  // User context helpers
  // ------------------------------
  getUserNickname() {
    try {
      const nick = String(window.BadianiProfile?.getActive?.()?.nickname || '').trim();
      return nick;
    } catch {
      return '';
    }
  }

  addressUser(text) {
    const raw = String(text ?? '').trim();
    if (!raw) return raw;
    const nick = this.getUserNickname();
    if (!nick) return raw;

    const nickNorm = this.normalizeText(nick);
    const head = this.normalizeText(raw.slice(0, Math.min(120, raw.length)));
    // If the message already starts with the nickname (or "Ciao <nick>") avoid double-prefix.
    if (head.startsWith(nickNorm) || head.startsWith(`ciao ${nickNorm}`) || head.startsWith(`hi ${nickNorm}`) || head.startsWith(`hola ${nickNorm}`) || head.startsWith(`salut ${nickNorm}`)) {
      return raw;
    }
    return `${nick}, ${raw}`;
  }

  // ------------------------------
  // Text helpers
  // ------------------------------
  mergeContinuation(base, add) {
    const left = String(base || '').trim();
    let right = String(add || '').trim();
    if (!left) return right;
    if (!right) return left;

    // Remove leading ellipses/punctuation often produced by “continue…” prompts.
    right = right
      .replace(/^(?:\.{3,}|…)+\s*/g, '')
      .replace(/^[,;:—\-]+\s*/g, '')
      .trim();

    if (!right) return left;

    const stripWord = (w) => String(w || '')
      .toLowerCase()
      // keep accented latin letters too (IT/FR/ES)
      .replace(/^[^a-z0-9À-ÿ]+|[^a-z0-9À-ÿ]+$/g, '');

    // Remove overlapping prefix if the continuation repeats the last words of base.
    const baseWords = left.split(/\s+/);
    const addWords = right.split(/\s+/);
    const maxK = Math.min(30, baseWords.length, addWords.length);

    for (let k = maxK; k >= 3; k--) {
      let ok = true;
      for (let i = 0; i < k; i++) {
        const bw = stripWord(baseWords[baseWords.length - k + i]);
        const aw = stripWord(addWords[i]);
        if (!bw || !aw || bw !== aw) {
          ok = false;
          break;
        }
      }
      if (ok) {
        right = addWords.slice(k).join(' ').trim();
        break;
      }
    }

    if (!right) return left;
    return `${left} ${right}`.replace(/\s{2,}/g, ' ').trim();
  }

  polishAssistantText(text) {
    let s = String(text || '').trim();
    if (!s) return s;

    // Normalize ellipses (avoid "...di" artifacts).
    s = s.replace(/\s*\.{3,}\s*/g, ' … ');
    s = s.replace(/\s*…\s*/g, ' … ');
    s = s.replace(/\s{2,}/g, ' ').trim();
    s = s.replace(/(?:\s…){2,}/g, ' …');

    // Ensure we end with punctuation for a clean UI.
    // Allow closing quotes/brackets after punctuation.
    if (!/[.!?…][)\]}'"”»]*$/.test(s)) {
      s = `${s}.`;
    }
    return s;
  }

  compactAssistantText(text) {
    let s = String(text || '').trim();
    if (!s) return s;

    // Don't compact flows that explicitly suppress links / are special.
    if (s.includes('[[NOLINK]]')) return s;

    // Keep already-short answers as-is.
    // 650 was too aggressive and caused awkward cut-offs (e.g. ending with "con.").
    if (s.length <= 1400) return s;

    const lang = this.getUiLang();
    const cta = {
      it: 'Apri la scheda per i dettagli completi.',
      en: 'Open the card for the full details.',
      es: 'Abre la ficha para ver todos los detalles.',
      fr: 'Ouvre la fiche pour tous les détails.',
    }[lang] || 'Apri la scheda per i dettagli completi.';

    // Try to cut on a sentence boundary within a target window.
    const TARGET = 1100;
    const windowText = s.slice(0, Math.min(TARGET, s.length));
    const lastPunct = Math.max(
      windowText.lastIndexOf('.'),
      windowText.lastIndexOf('!'),
      windowText.lastIndexOf('?'),
      windowText.lastIndexOf('…')
    );

    let head = '';
    if (lastPunct >= 80) {
      head = windowText.slice(0, lastPunct + 1).trim();
    } else {
      // Fallback: cut at last space.
      const lastSpace = windowText.lastIndexOf(' ');
      head = (lastSpace >= 80 ? windowText.slice(0, lastSpace) : windowText).trim();
      if (head && !/[.!?…][)\]}'"”»]*$/.test(head)) head = `${head}.`;
    }

    // Avoid ending on connectors/prepositions (common source of “frasi troncate”).
    head = head.replace(/\b(con|e|o|ma|che|quindi|perche|perché|cosi|così|oppure|senza|per|di|da|del|della|dei|degli|delle|al|allo|alla|ai|agli|alle)\.?$/i, '').trim();
    if (head && !/[.!?…][)\]}'"”»]*$/.test(head)) head = `${head}.`;

    // Ensure CTA punctuation.
    let out = `${head} ${cta}`.replace(/\s{2,}/g, ' ').trim();
    if (!/[.!?…]$/.test(out)) out = `${out}.`;
    return out;
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
      if (add) return this.mergeContinuation(out, add);
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

    // Otherwise: don't assume it's truncated (avoids slow + duplication-prone continuations).
    return false;
  }

  // Best-effort continuation usable from the UI when a response looks cut.
  async continueFromPartial(userMessage, assistantText) {
    const base = String(assistantText || '').trim();
    if (!base) return base;

    // Se non sembra troncato, restituisci subito
    if (!this.looksTruncatedAnswer(base)) return base;

    const systemPrompt = (typeof this.buildSystemPrompt === 'function') ? this.buildSystemPrompt(userMessage) : '';
    const lang = (typeof this.getUiLang === 'function') ? this.getUiLang() : 'it';

    // PROXY mode continuation (riutilizza lo stesso endpoint del proxy)
    if (this.mode === 'proxy' && this.proxyEndpoint) {
      try {
        const headers = { 'content-type': 'application/json' };
        if (this.accessCode) headers['x-berny-access-code'] = this.accessCode;
        try {
          const authToken = String(localStorage.getItem('badianiAuth.token.v1') || '').trim();
          if (authToken) headers['x-badiani-auth'] = authToken;
        } catch {}

        const r = await fetch(this.proxyEndpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            intent: 'chat',
            userContext: {
              nickname: window.BadianiProfile?.getActive?.()?.nickname || '',
              language: lang,
            },
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: String(userMessage ?? '') },
              { role: 'assistant', content: base },
              {
                role: 'user',
                content:
                  "Continua e completa la risposta precedente. Finisci sempre le frasi e chiudi con punteggiatura. Non ripetere dall'inizio: continua da dove eri rimasto.",
              },
            ],
          }),
        });

        if (r && r.ok) {
          const data = await r.json().catch(() => null);
          const add = String(data?.text || '').trim();
          if (add) return this.mergeContinuation(base, add);
        }
      } catch (e) {
        console.warn('Proxy continuation failed', e);
      }

      // In caso di fallimento, restituisci il testo originale
      return base;
    }

    // SDK mode continuation (riusa la stessa logica del brain)
    if (this.mode === 'sdk' && this.model && typeof this.continueIfTruncatedSdk === 'function') {
      try {
        const out = await this.continueIfTruncatedSdk({
          systemPrompt,
          userMessage,
          assistantText: base,
          model: this.model,
        });
        return out || base;
      } catch (e) {
        console.warn('SDK continuation failed', e);
        return base;
      }
    }

    // Default: nessun cambiamento
    return base;
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

  // Normalization for keyword matching.
  // We strip punctuation to make word-boundary checks reliable (e.g. "tè," -> "te").
  normalizeForMatch(value) {
    const s = this.normalizeText(value);
    if (!s) return '';
    return s
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Robust keyword matching:
  // - For very short needles (<=3 chars), require whole-word matches.
  //   This avoids false positives like "tè" -> "te" matching inside "presentazione".
  // - For longer needles, allow substring match on the cleaned text.
  hasKeyword(haystack, needle) {
    const h = this.normalizeForMatch(haystack);
    const n = this.normalizeForMatch(needle);
    if (!h || !n) return false;
    if (n.length <= 3) {
      return (` ${h} `).includes(` ${n} `);
    }
    return h.includes(n);
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
    return /\b(story\s*orbit|storia|firenze|origine|gelato|buontalenti|cono|coni|coppett|coppa|gusti|vetrina|caffe|caff[eè]|espresso|americano|cappuccino|chai|affogato|matcha|waffle|crepe|cr[eè]p|pancake|cakes|cake|torta|torte|fetta|slice|croissant|brownie|yo\s*-\s*yo|yoyo|churro|churros|panettone|pandoro)\b/i.test(m);
  }

  buildClarificationForMetaGuidance(userMessage) {
    const lang = this.getUiLang();
    const base = String(userMessage || '').trim();

    // Keep it short and actionable; no link until clarified.
    const it =
      `Posso aiutarti volentieri, ma mi serve un dettaglio: su quale linea/prodotto vuoi fare "${base}"?\n` +
      `Esempi rapidi (scrivine uno): Gelato Lab (coni/coppette/Yo-Yo), Cakes (Pastry Lab), Crepe/Waffle/Churros (Sweet Treats), Bar & Drinks (caffè/matcha), Seasonal (panettone/colomba), oppure Operations (apertura/chiusura). [[NOLINK]]`;

    const en =
      `Happy to help—quick clarification: which product/category is your "${base}" about?\n` +
      `Examples: Gelato Lab (cones/cups/Yo-Yo), Cakes (Pastry Lab), Crepe/Waffle/Churros (Sweet Treats), Bar & Drinks, Seasonal, or Operations (opening/closing). [[NOLINK]]`;

    const es =
      `¡Claro! Solo una aclaración: ¿sobre qué producto/categoría es tu "${base}"?\n` +
      `Ejemplos: Gelato Lab (Yo-Yo), Cakes (Pastry Lab), Crepe/Waffle/Churros (Sweet Treats), Bar & Drinks, Seasonal, u Operations (apertura/cierre). [[NOLINK]]`;

    const fr =
      `Avec plaisir—petite précision: ton "${base}" concerne quel produit/catégorie ?\n` +
      `Exemples : Gelato Lab (Yo-Yo), Cakes (Pastry Lab), Crêpe/Waffle/Churros (Sweet Treats), Bar & Drinks, Seasonal, ou Operations (ouverture/fermeture). [[NOLINK]]`;

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
      // Note: there is no dedicated "buontalenti" card id; route to the Gelato Lab cups card as the closest practical entry point.
      { href: 'gelato-lab.html?q=cups', keys: ['buontalenti'] },
      { href: 'gelato-lab.html?q=coppa-gelato', keys: ['coppa badiani', 'coppa gelato', 'coppa'] },
      { href: 'gelato-lab.html?q=cups', keys: ['coppette', 'cups', 'cup', 'copas gelato', 'coupes gelato'] },
      { href: 'gelato-lab.html?q=cones', keys: ['coni', 'cone', 'cones', 'cornets', 'conos'] },
      { href: 'gelato-lab.html?q=boxes', keys: ['box gelato', 'take home box', 'gelato boxes', 'boîtes glace', 'cajas helado'] },
      // No dedicated "gusti"/"vetrina" card ids exist on Gelato Lab; route to stable entry points.
      { href: 'gelato-lab.html?q=cups', keys: ['gusti', 'flavour', 'flavors', 'parfums', 'sabores', 'sabor'] },
      { href: 'gelato-lab.html?q=gelato-setup', keys: ['vetrina', 'display', 'vitrine', 'vitrina'] },
      { href: 'gelato-lab.html?q=gelato-setup', keys: ['setup gelato', 'set up gelato'] },
      { href: 'gelato-lab.html?q=temperatura-porte-standard', keys: ['temperatura porte', 'porta gelato'] },
      { href: 'gelato-lab.html?q=shelf-life-treats-dopo-esposizione', keys: ['shelf life gelato', 'durata esposizione gelato'] },
      { href: 'gelato-lab.html?q=gestione-treat-freezer', keys: ['freezer treat', 'gestione freezer treat'] },
      { href: 'gelato-lab.html?q=regola-scampolo-1-4-pan', keys: ['regola scampolo', '1/4 pan', 'un quarto pan'] },
      { href: 'gelato-lab.html?q=chiusura-deep-clean-vetrina', keys: ['chiusura vetrina', 'deep clean vetrina'] },

      { href: 'caffe.html?q=espresso-single', keys: ['espresso', 'shot', 'estrazione', 'portafiltro', 'grinder', 'tamper', 'expreso', 'café espresso'] },
      { href: 'caffe.html?q=americano', keys: ['americano', 'caffe americano', 'caffè americano', 'american coffee', 'café americano'] },
      { href: 'caffe.html?q=smoothies-parametri-di-produzione', keys: ['smoothie', 'smoothies', 'frullato', 'frullati', 'frappe', 'frappè', 'frappé'] },
      // Be careful with generic keywords like "latte"/"milk": they would incorrectly match Chai Latte, Matcha Latte, Iced Latte, etc.
      { href: 'caffe.html?q=chai-latte', keys: ['chai', 'chai latte', 'chai-latte'] },
      { href: 'caffe.html?q=cappuccino', keys: ['cappuccino', 'microfoam', 'schiuma', 'schiuma fine', 'montare latte', 'latte art', 'steam', 'steam wand', 'lancia vapore', 'wand'] },
      { href: 'caffe.html?q=affogato', keys: ['affogato', 'dirty matcha'] },

      { href: 'sweet-treats.html?q=crepe-sauce', keys: ['crepe', 'crepes', 'crepe', 'crêpe', 'crêpes', 'crêpe', 'crêpes'] },
      { href: 'sweet-treats.html?q=waffles', keys: ['waffle'] },
      { href: 'sweet-treats.html?q=pancake', keys: ['pancake'] },

      { href: 'sweet-treats.html?q=churros', keys: ['churro', 'churros'] },
      { href: 'festive.html?q=panettone-classico', keys: ['panettone'] },
      { href: 'festive.html?q=pandoro-classico', keys: ['pandoro'] },
      { href: 'festive.html?q=hot-chocolate', keys: ['cioccolata calda', 'hot chocolate', 'chocolate caliente', 'chocolat chaud'] },
      { href: 'festive.html?q=colomba', keys: ['colomba'] },

      { href: 'operations.html?q=ops-opening', keys: ['apertura', 'opening', 'open store'] },
      // NOTE: do NOT map generic "upsell/upselling" here; it must be anchored to a product.
      { href: 'operations.html?q=service-chiusura', keys: ['servizio', 'service', 'obiezione'] },
      { href: 'operations.html?q=service-chiusura', keys: ['chiusura', 'closing', 'close store'] },
      { href: 'operations.html?q=schedule-pulizie-giorno-settimana', keys: ['pulizia', 'cleaning', 'sanificazione', 'sanitize'] },

      { href: 'gelato-lab.html?q=yoyo-product', keys: ['yoyo', 'yo-yo', 'yo yo'] },
      { href: 'pastries.html?q=croissants', keys: ['croissant'] },
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
        { href: 'operations.html?q=ops-opening', label: { it: 'Apertura', en: 'Opening', es: 'Apertura', fr: 'Ouverture' } },
        { href: 'sweet-treats.html?q=waffles', label: { it: 'Waffle', en: 'Waffle', es: 'Waffle', fr: 'Waffle' } },
        { href: 'sweet-treats.html?q=churros', label: { it: 'Churros', en: 'Churros', es: 'Churros', fr: 'Churros' } },
        { href: 'caffe.html?q=espresso-single', label: { it: 'Espresso', en: 'Espresso', es: 'Espresso', fr: 'Espresso' } },
        { href: 'gelato-lab.html?q=cups', label: { it: 'Gelato Lab', en: 'Gelato Lab', es: 'Gelato Lab', fr: 'Gelato Lab' } },
        { href: 'gelato-lab.html?q=yoyo-product', label: { it: 'Yo-Yo', en: 'Yo-Yo', es: 'Yo-Yo', fr: 'Yo-Yo' } },
      ];
      const pick = this.pickDifferent(options, last?.href);
      const label = pick?.label?.[uiLang] || pick?.label?.it || 'Training';
      return { href: pick?.href || 'operations.html?q=ops-opening', reason: isShort ? 'short' : 'smalltalk', label };
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
      { href: 'pastries.html?q=croissants', keywords: ['croissant', 'croissants', 'farcit'] },
      { href: 'pastries.html?q=scones', keywords: ['scone', 'scones'] },
      // Gelato
      // No dedicated Buontalenti card id exists; keep it inside Gelato Lab entry points.
      { href: 'gelato-lab.html?q=cups', keywords: ['buontalenti'] },
      { href: 'gelato-lab.html?q=coppa-gelato', keywords: ['coppa badiani', 'coppa gelato', 'coppa'] },
      { href: 'gelato-lab.html?q=cups', keywords: ['gusti', 'flavors', 'parfums'] },
      // Coffee
      { href: 'caffe.html?q=espresso-single', keywords: ['espresso', 'estrazione', 'portafiltro', 'expreso', 'espresso corto', 'café serré'] },
      { href: 'caffe.html?q=cappuccino', keywords: ['cappuccino', 'microfoam', 'schiuma fine', 'capuchino', 'mousse de lait'] },
      { href: 'caffe.html?q=hot-chocolate', keywords: ['hot chocolate', 'cioccolata calda', 'hot-choc', 'chocolate drink', 'chocolat chaud', 'chocolate caliente'] },
      { href: 'caffe.html?q=americano', keywords: ['americano', 'caffe americano', 'american coffee', 'café americano', 'café allongé'] },
      { href: 'caffe.html?q=smoothies-parametri-di-produzione', keywords: ['smoothie', 'smoothies', 'frullato', 'frullati', 'frappe', 'frappè', 'frappé', 'blender smoothie', 'fruit smoothie'] },
      { href: 'caffe.html?q=chai-latte', keywords: ['chai', 'chai latte', 'té chai', 'chaï latte'] },
      { href: 'caffe.html?q=macchiato-single', keywords: ['macchiato', 'espresso macchiato', 'macchiato corto', 'macchiato lungo', 'café manchado', 'café noisette'] },
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
      { href: 'sweet-treats.html?q=crepe-sauce', keywords: ['crepe', 'crêpe', 'crepes', 'crepa', 'crepé', 'crêpes'] },
      { href: 'sweet-treats.html?q=waffles', keywords: ['waffle', 'waffles', 'gaufre'] },
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
      // Seasonal
      { href: 'sweet-treats.html?q=churros', keywords: ['churro', 'churros', 'churro caliente'] },
      { href: 'festive.html?q=panettone-classico', keywords: ['panettone', 'panetón', 'panettone classic', 'panettone classique'] },
      { href: 'festive.html?q=pandoro-classico', keywords: ['pandoro'] },
      { href: 'festive.html?q=panettone-classico', keywords: ['panettone classico', 'classic panettone'] },
      { href: 'festive.html?q=panettone-dark-chocolate', keywords: ['panettone dark', 'panettone cioccolato'] },
      { href: 'festive.html?q=pandoro-classico', keywords: ['pandoro', 'pandoro classico'] },
      { href: 'festive.html?q=servizio-caldo-pandoro', keywords: ['servizio caldo pandoro', 'warm pandoro'] },
      { href: 'festive.html?q=hot-chocolate', keywords: ['cioccolata calda', 'hot chocolate', 'chocolate caliente', 'chocolat chaud'] },
      { href: 'festive.html?q=colomba', keywords: ['colomba', 'colomba pasquale', 'easter colomba'] },
      { href: 'festive.html?q=packaging-mini-panettone-delivery', keywords: ['packaging mini panettone', 'delivery panettone'] },
      // Other
      { href: 'gelato-lab.html?q=yoyo-product', keywords: ['yoyo', 'yo-yo'] },
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

    const msgBMatch = this.normalizeForMatch(msgB);
    products.forEach((prod) => {
      let minPos = msgB.length; // Posizione della prima menzione di questo prodotto
      let score = 0;
      let foundCount = 0;

      (prod.keywords || []).forEach((kw) => {
        const kwn = this.normalizeText(kw);
        if (!kwn) return;

        // For short keywords (e.g. "tè" -> "te"), require whole-word match.
        // We also compute a stable "position" using the cleaned string.
        const kwMatch = this.normalizeForMatch(kwn);
        if (!kwMatch) return;

        let hit = false;
        let kwPos = -1;
        if (kwMatch.length <= 3) {
          const re = new RegExp(`(?:^|\\s)${kwMatch}(?:\\s|$)`, 'i');
          kwPos = msgBMatch.search(re);
          hit = kwPos >= 0;
        } else {
          kwPos = msgBMatch.indexOf(kwMatch);
          hit = kwPos >= 0;
        }

        if (hit) {
          foundCount++;
          minPos = Math.min(minPos, kwPos);
          // Score basato su lunghezza del keyword (più specifico = più importante)
          score += (kwMatch.length >= 15 ? 4 : (kwMatch.length >= 10 ? 3 : (kwMatch.length >= 6 ? 2 : 1)));
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

  // Mappa di tutti i prodotti specifici disponibili
  // Formato: { nome: '', alias: [], href: '', label: '' }
  getProductCatalog() {
    return [
      // Bar & Drinks - Caffetteria
      { name: 'espresso', aliases: ['espresso'], href: 'caffe.html?q=espresso-single', label: '☕ Apri Espresso Single' },
      { name: 'americano', aliases: ['americano'], href: 'caffe.html?q=americano', label: '☕ Apri Americano' },
      { name: 'cappuccino', aliases: ['cappuccino'], href: 'caffe.html?q=cappuccino', label: '☕ Apri Cappuccino' },
      { name: 'macchiato', aliases: ['macchiato'], href: 'caffe.html?q=macchiato-single', label: '☕ Apri Macchiato' },
      { name: 'flat white', aliases: ['flat white', 'flat-white'], href: 'caffe.html?q=flat-white', label: '☕ Apri Flat White' },
      { name: 'mocha', aliases: ['mocha', 'mocca'], href: 'caffe.html?q=mocha', label: '☕ Apri Mocha' },
      { name: 'whipped coffee', aliases: ['whipped coffee', 'dalgona', 'caffe montato', 'caffè montato', 'caffè montato', 'cafe fouette', 'café fouetté'], href: 'caffe.html?q=whipped-coffee', label: '☕ Apri Whipped Coffee' },
      { name: 'matcha', aliases: ['matcha', 'tè verde'], href: 'caffe.html?q=matcha-latte', label: '🍵 Apri Matcha Latte' },
      { name: 'affogato', aliases: ['affogato'], href: 'caffe.html?q=affogato', label: '☕ Apri Affogato' },
      
      // Bar & Drinks - Smoothies
      { name: 'smoothie giallo', aliases: ['smoothie giallo', 'tropical', 'passion', 'mango'], href: 'caffe.html?q=smoothie-giallo-passion', label: '🍹 Apri Smoothie Giallo Passion' },
      { name: 'smoothie rosso', aliases: ['smoothie rosso', 'antioxidant', 'berry', 'frutti di bosco'], href: 'caffe.html?q=smoothie-rosso-berry', label: '🍹 Apri Smoothie Rosso Berry' },
      { name: 'smoothie verde', aliases: ['smoothie verde', 'detox', 'green power', 'spinaci'], href: 'caffe.html?q=smoothie-verde-boost', label: '🍹 Apri Smoothie Verde Boost' },
      
      // Gelato Lab
      // No dedicated Buontalenti card id exists; route to Gelato Lab entry.
      { name: 'buontalenti', aliases: ['buontalenti'], href: 'gelato-lab.html?q=cups', label: '🍦 Apri Buontalenti' },
      { name: 'gelato', aliases: ['gelato', 'gusto', 'flavour', 'flavor'], href: 'gelato-lab.html', label: '🍦 Apri Gelato Lab' },
      
      // Sweet Treats
      { name: 'waffle', aliases: ['waffle', 'waffel'], href: 'sweet-treats.html?q=waffles', label: '🧇 Apri Waffle' },
      { name: 'crepe', aliases: ['crepe', 'crêpe'], href: 'sweet-treats.html?q=crepe-sauce', label: '🧇 Apri Crepe' },
      { name: 'pancake', aliases: ['pancake'], href: 'sweet-treats.html?q=pancake', label: '🧇 Apri Pancake' },
      
      // Pastries
      { name: 'cakes', aliases: ['cake', 'torta', 'torte', 'fetta'], href: 'pastries.html?q=cakes', label: '🎂 Apri Cakes' },
      
      // Festive / Seasonal
      { name: 'churro', aliases: ['churro', 'churros'], href: 'sweet-treats.html?q=churros', label: '🧇 Apri Churros' },
      { name: 'panettone', aliases: ['panettone'], href: 'festive.html?q=panettone-classico', label: '🎄 Apri Panettone' },
      { name: 'pandoro', aliases: ['pandoro'], href: 'festive.html?q=pandoro-classico', label: '🎄 Apri Pandoro' },
      { name: 'cioccolata-calda', aliases: ['cioccolata calda', 'hot chocolate', 'chocolate caliente', 'chocolat chaud'], href: 'festive.html?q=hot-chocolate', label: '🎄 Apri Cioccolata Calda' },
      { name: 'colomba', aliases: ['colomba'], href: 'festive.html?q=colomba', label: '🎄 Apri Colomba' },
      
      // Story Orbit
      { name: 'story', aliases: ['story', 'storia', 'badiani', 'firenze', 'origine'], href: 'story-orbit.html?q=story', label: '🌟 Apri Story Orbit' },
      
      // Yo-Yo
      { name: 'yoyo', aliases: ['yoyo', 'yo-yo'], href: 'gelato-lab.html?q=yoyo-product', label: '🍦 Apri Yo-Yo' }
    ];
  }

  // Nuova funzione: cerca TUTTI i link rilevanti per il messaggio dell'utente
  // Ritorna un array di link con label
  inferMultipleRecommendations(userMessage, assistantMessage = '') {
    const results = [];
    const seenHrefs = new Set();
    
    const msgA = this.normalizeText(userMessage);
    const msgB = this.normalizeText(assistantMessage);
    
    const hasIn = (hay, needle) => this.hasKeyword(hay, needle);

    // If Berny is clearly talking about Whipped Coffee, don't let the word "espresso"
    // inside the explanation hijack the CTA (unless the user explicitly asked espresso).
    const userAskedEspresso = /\bespresso\b/i.test(msgA);
    const userAskedWhippedCoffee = /\bwhipped\s+coffee\b|\bdalgona\b|\bcaff[eè]\s+montat/i.test(msgA);
    const responseIsWhippedCoffee = /\bwhipped\s+coffee\b|\bdalgona\b|\bcaff[eè]\s+montat/i.test(msgB);
    const isWhippedCoffeeContext = (userAskedWhippedCoffee || responseIsWhippedCoffee);

    // I 3 smoothies disponibili (per scelta random se non specifico)
    const smoothiesOptions = [
      { href: 'caffe.html?q=smoothie-giallo-passion', label: '🍹 Apri Smoothie Giallo Passion' },
      { href: 'caffe.html?q=smoothie-rosso-berry', label: '🍹 Apri Smoothie Rosso Berry' },
      { href: 'caffe.html?q=smoothie-verde-boost', label: '🍹 Apri Smoothie Verde Boost' }
    ];

    // Tutti i candidati (da inferRecommendationFromContext)
    const topicCandidates = [
      { href: 'pastries.html?q=cakes', keys: ['cakes', 'cake', 'torta', 'torte', 'fetta', 'slice'], label: '📖 Apri scheda Cakes' },
      { href: 'gelato-lab.html?q=cups', keys: ['buontalenti'], label: '🍦 Apri scheda Buontalenti' },
      { href: 'caffe.html?q=whipped-coffee', keys: ['whipped coffee', 'dalgona', 'caffe montato', 'caffè montato'], label: '☕ Apri Whipped Coffee' },
      // Per smoothies: suggerisci sia i parametri che UNO dei 3 smoothies specifici
      { 
        href: 'caffe.html?q=smoothies-parametri-di-produzione', 
        keys: ['smoothie', 'smoothies', 'frullato', 'frullati', 'frappe', 'frappè', 'frappé'], 
        label: '🍹 Apri parametri Smoothies',
        relatedLink: smoothiesOptions[Math.floor(Math.random() * smoothiesOptions.length)] // Scegli uno random
      },
      { href: 'caffe.html', keys: ['caffe', 'caffè', 'espresso', 'cappuccino', 'bar', 'bevanda'], label: '☕ Apri scheda Bar & Drinks' },
      { href: 'sweet-treats.html?q=waffles', keys: ['waffle', 'waffel', 'crepe', 'crêpe', 'pancake'], label: '🧇 Apri scheda Sweet Treats' },
      { href: 'festive.html?q=panettone-classico', keys: ['panettone', 'pandoro', 'natale', 'capodanno', 'cioccolata calda', 'colomba'], label: '🎄 Apri scheda Seasonal' },
      { href: 'sweet-treats.html?q=churros', keys: ['churro', 'churros'], label: '🧇 Apri Churros' },
      { href: 'story-orbit.html?q=story', keys: ['story', 'storia', 'badiani', 'firenze', 'origine', 'tradizione'], label: '🌟 Apri Story Orbit' },
      { href: 'gelato-lab.html?q=yoyo-product', keys: ['yoyo', 'yo-yo', 'cioccolato'], label: '🍦 Apri scheda Yo-Yo' },
      { href: 'gelato-lab.html', keys: ['gelato', 'gusto', 'flavour', 'flavor', 'ricetta'], label: '🍦 Apri scheda Gelato Lab' },
    ];

    // Step 1: Cerca prodotti SPECIFICI menzionati nel messaggio di Berny (prioritario)
    const catalog = this.getProductCatalog();
    catalog.forEach((product) => {
      if (seenHrefs.has(product.href)) return; // Evita duplicati

      // Avoid suggesting Espresso when the actual topic is Whipped Coffee (unless user asked espresso).
      if (isWhippedCoffeeContext && !userAskedEspresso && product.name === 'espresso') return;
      
      // Controlla tutti gli alias del prodotto
      for (const alias of product.aliases) {
        if (hasIn(msgB, alias)) { // Cerca nel messaggio di Berny (assistantMessage)
          results.push({
            url: product.href,
            label: product.label
          });
          seenHrefs.add(product.href);
          console.log(`✅ Found product "${product.name}" in response`);
          break;
        }
      }
    });

    // Step 2: Verifica quali categorie generiche sono rilevanti (solo se non già aggiunte)
    topicCandidates.forEach((cand) => {
      if (seenHrefs.has(cand.href)) return; // Evita duplicati

      // If we already have a specific Bar & Drinks card (caffe.html?q=...), don't add the generic page.
      if (cand.href === 'caffe.html') {
        const alreadyHasSpecificCaffe = results.some((r) => String(r?.url || '').startsWith('caffe.html?q='));
        if (alreadyHasSpecificCaffe) return;
      }
      
      for (const key of cand.keys) {
        if (hasIn(msgA, key) || hasIn(msgB, key)) {
          results.push({
            url: cand.href,
            label: cand.label
          });
          seenHrefs.add(cand.href);
          
          // Se c'è un link correlato (e.g., smoothies con uno specifico), aggiungilo
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

    const hasIn = (hay, needle) => this.hasKeyword(hay, needle);

    const topicCandidates = [
      // Cakes / torta: route to Pastry Lab (avoid generic "servizio" matches hijacking the link).
      { href: 'pastries.html?q=cakes', keys: ['cakes', 'cake', 'torta', 'torte', 'fetta', 'slice'] },
      { href: 'gelato-lab.html?q=cups', keys: ['buontalenti'] },
      { href: 'gelato-lab.html?q=coppa-gelato', keys: ['coppa badiani', 'coppa gelato', 'coppa'] },
      { href: 'gelato-lab.html?q=cones', keys: ['cono', 'coni', 'cone'] },
      { href: 'gelato-lab.html?q=cups', keys: ['gusti', 'flavour', 'flavors', 'parfums', 'sabores'] },
      { href: 'gelato-lab.html?q=gelato-setup', keys: ['vetrina', 'display', 'vitrine'] },

      { href: 'caffe.html?q=espresso-single', keys: ['espresso', 'shot', 'estrazione', 'portafiltro', 'grinder', 'tamper'] },
      { href: 'caffe.html?q=americano', keys: ['americano', 'caffe americano', 'caffè americano', 'american coffee'] },
      { href: 'caffe.html?q=smoothies-parametri-di-produzione', keys: ['smoothie', 'smoothies', 'frullato', 'frullati', 'frappe', 'frappè', 'frappé'] },
      { href: 'caffe.html?q=hot-chocolate', keys: ['hot chocolate', 'hot-choc', 'cioccolata calda', 'chocolate drink', 'chocolat chaud', 'chocolate caliente'] },
      { href: 'caffe.html?q=macchiato-single', keys: ['macchiato', 'espresso macchiato', 'macchiato corto', 'macchiato lungo'] },
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

      { href: 'sweet-treats.html?q=crepe-sauce', keys: ['crepe', 'crepes', 'crêpe', 'crêpes', 'crêpe', 'crêpes'] },
      { href: 'sweet-treats.html?q=waffles', keys: ['waffle', 'gaufre'] },
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

      { href: 'sweet-treats.html?q=churros', keys: ['churro', 'churros'] },
      { href: 'festive.html?q=panettone-classico', keys: ['panettone'] },
      { href: 'festive.html?q=pandoro-classico', keys: ['pandoro'] },
      { href: 'festive.html?q=panettone-classico', keys: ['panettone classico', 'classic panettone'] },
      { href: 'festive.html?q=panettone-dark-chocolate', keys: ['panettone dark', 'panettone cioccolato'] },
      { href: 'festive.html?q=pandoro-classico', keys: ['pandoro', 'pandoro classico'] },
      { href: 'festive.html?q=servizio-caldo-pandoro', keys: ['servizio caldo pandoro', 'warm pandoro'] },
      { href: 'festive.html?q=hot-chocolate', keys: ['cioccolata calda', 'hot chocolate', 'chocolate caliente', 'chocolat chaud'] },
      { href: 'festive.html?q=colomba', keys: ['colomba', 'colomba pasquale', 'easter colomba'] },
      { href: 'festive.html?q=packaging-mini-panettone-delivery', keys: ['packaging mini panettone', 'delivery panettone'] },

      { href: 'operations.html?q=ops-opening', keys: ['apertura', 'opening', 'open store'] },
      // NOTE: do NOT map generic "upsell/upselling" here; it must be anchored to a product.
      { href: 'operations.html?q=service-chiusura', keys: ['servizio', 'service', 'obiezione'] },
      { href: 'operations.html?q=service-chiusura', keys: ['chiusura', 'closing', 'close store'] },
      { href: 'operations.html?q=schedule-pulizie-giorno-settimana', keys: ['pulizia', 'cleaning', 'sanificazione', 'sanitize'] },

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

      { href: 'gelato-lab.html?q=yoyo-product', keys: ['yoyo', 'yo-yo', 'yo yo'] },
      { href: 'pastries.html?q=croissants', keys: ['croissant'] },
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
    // Use [\s\S] so we also match tags that contain newlines.
    out = out.replace(/\[\[LINK:[\s\S]*?\]\]/g, '').trim();
    // LINKS tags can end with "]]]"; match the closing "]]" that is NOT followed by another "]".
    out = out.replace(/\[\[LINKS:[\s\S]*?\]\](?!\])/g, '').trim();

    if (reco) {
      // Se reco è un array di link multipli
      if (Array.isArray(reco) && reco.length > 0) {
        // Cap to max 3 links.
        const limitedReco = this.limitLinks(reco, 3);
        console.log('🔗 applyRecommendationToResponse - Multiple links detected:', reco);
        const linksJson = JSON.stringify(limitedReco);
        const linksStr = linksJson.slice(1, -1);
        out = `${out} [[LINKS:[${linksStr}]]]`;
        console.log('📎 Applied LINKS tag:', out.substring(Math.max(0, out.length - 100)));
        // Salva il primo come recommendation principale
        if (limitedReco[0] && limitedReco[0].href) {
          this.saveLastRecommendation({ href: limitedReco[0].href });
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
    // IMPORTANT: Language must NOT auto-switch based on what the user types.
    // The assistant language follows ONLY the UI language selection.
    const t = String(text || '').toLowerCase();
    const wantsQuiz = /\b(domande|interrogami|sfida|questions|challenge|ask\s+me|cuestionario|preguntas|desaf[ií]o|d[ée]fi|interroge\s*[- ]?moi|quiz|test)\b/i.test(t);
    if (!wantsQuiz) return null;
    return this.getUiLang();
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
    // 0. CHECK CACHE per risposte frequenti
    const cachedResponse = this.getCachedResponse(userMessage);
    if (cachedResponse) {
      return this.addressUser(cachedResponse);
    }

    // 1. QUIZ INTERCEPTION
    if (this.quizState.active) {
      return this.addressUser(await this.handleQuizAnswer(userMessage));
    }

    const detectedLang = this.detectLanguage(userMessage);
    if (detectedLang) {
      return this.addressUser(await this.startQuiz(detectedLang));
    }

    // 1b. Handle very short / small-talk inputs locally so the suggestion card is coherent and varies.
    const reco = this.inferRecommendationFromMessage(userMessage);
    const msgNorm = this.normalizeText(userMessage);
    if (this.isSmallTalk(msgNorm)) {
      const resp = this.addressUser(this.buildSmallTalkResponse(reco));
      this.recordConversationTurn(userMessage, resp);
      return resp;
    }

    // 1b2. Meta-guidance (upselling/setup/open/close/service): require an explicit topic.
    // If missing, ask a clarifying question instead of guessing a page.
    // (Keeps the generated link coherent and avoids "Pandoro" hijacks.)
    if (this.isMetaGuidanceRequest(msgNorm) && !this.hasExplicitTopicSignal(msgNorm)) {
      const resp = this.addressUser(this.buildClarificationForMetaGuidance(userMessage));
      this.recordConversationTurn(userMessage, resp);
      return resp;
    }

    // 1c. If the question clearly matches a legacy KB entry, answer locally.
    // This prevents occasional mid-sentence truncation from providers.
    const kbHit = this.matchLegacyKbProduct(userMessage);
    if (kbHit && kbHit.response) {
      let localOut = String(kbHit.response).trim();
      localOut = this.polishAssistantText(localOut);
      localOut = this.compactAssistantText(localOut);
      
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

      finalResp = this.addressUser(finalResp);
      this.recordConversationTurn(userMessage, finalResp);
      // Cache la risposta per usi futuri
      this.setCachedResponse(userMessage, finalResp);
      return finalResp;
    }

    // 2. STANDARD LLM LOGIC (proxy preferred)
    if (this.mode === 'proxy') {
      const endpoint = String(this.proxyEndpoint || '').trim();
      if (!endpoint) return "⚠️ Config proxy mancante. Imposta badianiBerny.config.v1.";

      // Notifica UI
      window.dispatchEvent(new CustomEvent('berny-typing-start'));

      try {
        const systemPrompt = this.buildSystemPrompt(userMessage);
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
              if (add) out = this.mergeContinuation(String(out).trim(), add);
            }
          } catch {
            // ignore and keep original
          }
        }

        // Final polish for UI rendering (avoid missing punctuation / messy ellipses)
        out = this.polishAssistantText(out);
        out = this.compactAssistantText(out);

        const recoFinal = this.getRecommendationOrMultiple(userMessage, out, false);
        
        // Se è un array (link multipli), non c'è bisogno di coerceHref
        if (Array.isArray(recoFinal)) {
          // Link multipli
          const finalResponse = this.applyRecommendationToResponse(out, recoFinal);
          const addressed = this.addressUser(finalResponse);
          this.recordConversationTurn(userMessage, addressed);
          return addressed;
        } else if (recoFinal?.href) {
          // Link singolo
          recoFinal.href = this.coerceHrefToCatalogCard(recoFinal.href, userMessage, out);
          const finalResponse = this.applyRecommendationToResponse(out, recoFinal);
          const addressed = this.addressUser(finalResponse);
          this.recordConversationTurn(userMessage, addressed);
          return addressed;
        } else {
          // Nessun link
          const finalResponse = this.applyRecommendationToResponse(out, null);
          const addressed = this.addressUser(finalResponse);
          this.recordConversationTurn(userMessage, addressed);
          return addressed;
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
    if (!this.apiKey || this.apiKey.length < 10) {
      // 🔄 FALLBACK: Prova Legacy KB anche senza API key
      const fallbackResponse = this.tryLegacyKBFallback(userMessage, (window.BadianiI18n?.getLang?.() || 'it'));
      if (fallbackResponse) {
        console.log('📚 Berny: No API key, uso fallback KB');
        return this.addressUser(fallbackResponse);
      }
      return "⚠️ Scrivi '/apikey LA_TUA_CHIAVE' per attivarmi (oppure usa il proxy)!";
    }
    if (!this.model) this.init();

    // Notifica UI
    window.dispatchEvent(new CustomEvent('berny-typing-start'));

    try {
      const systemPrompt = this.buildSystemPrompt(userMessage);
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

      out = this.polishAssistantText(out);
      out = this.compactAssistantText(out);

      const recoFinal = this.getRecommendationOrMultiple(userMessage, out, false);
      
      // Se è un array (link multipli), non c'è bisogno di coerceHref
      if (Array.isArray(recoFinal)) {
        // Link multipli
        const finalResponse = this.applyRecommendationToResponse(out, recoFinal);
        const addressed = this.addressUser(finalResponse);
        this.recordConversationTurn(userMessage, addressed);
        return addressed;
      } else if (recoFinal?.href) {
        // Link singolo
        recoFinal.href = this.coerceHrefToCatalogCard(recoFinal.href, userMessage, out);
        const finalResponse = this.applyRecommendationToResponse(out, recoFinal);
        const addressed = this.addressUser(finalResponse);
        this.recordConversationTurn(userMessage, addressed);
        return addressed;
      } else {
        // Nessun link
        const finalResponse = this.applyRecommendationToResponse(out, null);
        const addressed = this.addressUser(finalResponse);
        this.recordConversationTurn(userMessage, addressed);
        return addressed;
      }

    } catch (error) {
      console.warn(`⚠️ Errore o Timeout (${error.message}). Passo al BACKUP...`);

      // Se fallisce per limiti (429), errore tecnico o TIMEOUT
      if (true) { // Entra sempre nel backup se il primo fallisce
        
        try {
          // TENTATIVO 2: Modello Backup (Gemini 1.5 Flash - Più stabile)
          const backupModel = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
          
          const systemPrompt = this.buildSystemPrompt(userMessage);
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

          out = this.polishAssistantText(out);
          out = this.compactAssistantText(out);

          const recoFinal = this.getRecommendationOrMultiple(userMessage, out, false);
          
          // Se è un array (link multipli), non c'è bisogno di coerceHref
          if (Array.isArray(recoFinal)) {
            // Link multipli
            const finalResponse = this.applyRecommendationToResponse(out, recoFinal);
            const addressed = this.addressUser(finalResponse);
            this.recordConversationTurn(userMessage, addressed);
            return addressed;
          } else if (recoFinal?.href) {
            // Link singolo
            recoFinal.href = this.coerceHrefToCatalogCard(recoFinal.href, userMessage, out);
            const finalResponse = this.applyRecommendationToResponse(out, recoFinal);
            const addressed = this.addressUser(finalResponse);
            this.recordConversationTurn(userMessage, addressed);
            return addressed;
          } else {
            // Nessun link
            const finalResponse = this.applyRecommendationToResponse(out, null);
            const addressed = this.addressUser(finalResponse);
            this.recordConversationTurn(userMessage, addressed);
            return addressed;
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

  // ============================================================
  // CACHING SYSTEM - Risposte frequenti con TTL
  // ============================================================
  static CACHE_KEY = 'badianiBerny.responseCache.v1';
  static CACHE_TTL = 1000 * 60 * 60 * 24; // 24 ore

  getCachedResponse(query) {
    try {
      const cache = JSON.parse(localStorage.getItem(BernyBrainAPI.CACHE_KEY) || '{}');
      const queryKey = this.normalizeText(query).substring(0, 100);
      const entry = cache[queryKey];
      if (entry && (Date.now() - entry.ts) < BernyBrainAPI.CACHE_TTL) {
        console.log('📦 Berny Cache HIT:', queryKey.substring(0, 30));
        return entry.response;
      }
    } catch (e) {
      console.warn('⚠️ Cache read error:', e);
    }
    return null;
  }

  setCachedResponse(query, response) {
    try {
      const cache = JSON.parse(localStorage.getItem(BernyBrainAPI.CACHE_KEY) || '{}');
      const queryKey = this.normalizeText(query).substring(0, 100);
      
      // Limita cache a 50 entry
      const keys = Object.keys(cache);
      if (keys.length >= 50) {
        // Rimuovi le più vecchie
        const sorted = keys.sort((a, b) => (cache[a].ts || 0) - (cache[b].ts || 0));
        sorted.slice(0, 10).forEach(k => delete cache[k]);
      }
      
      cache[queryKey] = { response, ts: Date.now() };
      localStorage.setItem(BernyBrainAPI.CACHE_KEY, JSON.stringify(cache));
      console.log('💾 Berny Cache SET:', queryKey.substring(0, 30));
    } catch (e) {
      console.warn('⚠️ Cache write error:', e);
    }
  }

  // ============================================================
  // FALLBACK con Legacy KB
  // ============================================================
  tryLegacyKBFallback(query, lang = 'it') {
    // Prima prova la nuova KB strutturata
    if (typeof window.BERNY_KNOWLEDGE_SEARCH === 'function') {
      const match = window.BERNY_KNOWLEDGE_SEARCH(query, lang);
      if (match && match.entry) {
        const response = window.BERNY_GET_RESPONSE(match.entry, lang);
        if (response) {
          console.log('📚 Berny Fallback: KB strutturata match per', match.key);
          return response;
        }
      }
    }

    // Fallback alla legacy KB
    const kb = window.BERNY_KNOWLEDGE || {};
    const queryNorm = this.normalizeText(query);
    
    // Cerca nei prodotti
    if (kb.products) {
      for (const [key, val] of Object.entries(kb.products)) {
        if (!val.keywords) continue;
        for (const kw of val.keywords) {
          if (queryNorm.includes(this.normalizeText(kw))) {
            console.log('📚 Berny Fallback: Legacy KB match per', key);
            return val.response;
          }
        }
      }
    }

    // Cerca nelle procedure
    if (kb.procedures) {
      for (const [key, val] of Object.entries(kb.procedures)) {
        if (!val.keywords) continue;
        for (const kw of val.keywords) {
          if (queryNorm.includes(this.normalizeText(kw))) {
            console.log('📚 Berny Fallback: Procedure match per', key);
            let response = val.response;
            if (val.steps && response.includes('{steps}')) {
              response = response.replace('{steps}', val.steps.map((s, i) => `${i + 1}. ${s}`).join('\n'));
            }
            return response;
          }
        }
      }
    }

    // Cerca nelle FAQ
    if (kb.faq) {
      for (const [key, val] of Object.entries(kb.faq)) {
        if (!val.keywords) continue;
        for (const kw of val.keywords) {
          if (queryNorm.includes(this.normalizeText(kw))) {
            console.log('📚 Berny Fallback: FAQ match per', key);
            if (val.responses && Array.isArray(val.responses)) {
              return val.responses[Math.floor(Math.random() * val.responses.length)];
            }
            return val.response;
          }
        }
      }
    }

    return null;
  }

  buildSystemPrompt(userQuery = '') {
    const kb = window.BERNY_KNOWLEDGE || {};
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

    const nickname = String(this.getUserNickname() || '').trim();
    
    let info = "";
    
    // ============================================================
    // CONTEXT-AWARE PROMPTING: Inietta solo KB rilevante
    // ============================================================
    if (userQuery && typeof window.BERNY_GET_RELEVANT_KB === 'function') {
      const relevantKB = window.BERNY_GET_RELEVANT_KB(userQuery, userLangCode, 5);
      if (relevantKB) {
        info += relevantKB + "\n";
      }
    }

    // Legacy KB compatta (solo chiavi principali)
    if (kb.products) {
      info += "\n📦 PRODOTTI (sintesi):\n";
      Object.entries(kb.products).forEach(([key, val]) => {
        // Solo una riga per prodotto
        const shortResponse = String(val.response || '').split('\n')[0].substring(0, 150);
        info += `• ${key}: ${shortResponse}\n`;
      });
    }

    // App Context solo se query specifica (non sempre)
    // Riduciamo il contesto a max 8000 caratteri per risparmiare token
    if (appContext && appContext.length > 0) {
      const trimmedContext = appContext.substring(0, 8000);
      info += "\n--- APP CONTEXT (ridotto) ---\n";
      info += trimmedContext;
      if (appContext.length > 8000) {
        info += "\n... [contesto troncato per efficienza] ...\n";
      }
      info += "\n--- END APP CONTEXT ---\n";
    }

    return `
      SEI BERNY, ASSISTENTE DI BADIANI 1932. 🍦
      RISPONDI IN: ${userLang}

      CONTESTO UTENTE:
      - Nome profilo: ${nickname || '(non disponibile)'}
      REGOLE:
      - Rivolgiti all'utente usando SEMPRE il suo nome profilo quando rispondi (es. "${nickname || 'Nome'}, ...").
      - Non inventare nomi.

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
      3b. Evita i puntini di sospensione "..." come separatore: usa frasi complete.
      3c. Evita ripetizioni (non ripetere l'ultima frase/pezzo se stai continuando).
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
          // Stream by words / line breaks (not fixed characters) so the text looks presentable
          // while typing (avoids mid-word fragments and "appiccicato").
          const parts = text.match(/(?:\r?\n+|\S+\s*)/g) || [];
          const partsPerTick = parts.length > 140 ? 3 : 2;
          let i = 0;
          const tick = () => {
            if (i < parts.length) {
              const c = parts.slice(i, i + partsPerTick).join('');
              if (c) {
                try { onChunk(c); } catch {}
              }
              i += partsPerTick;
              // Typing rhythm: keep it readable, not too slow.
              window.setTimeout(tick, 45);
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
