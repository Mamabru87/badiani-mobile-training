// FILE: scripts/berny-brain-local.js
// Self-contained BERNY brain (local/offline). This is the same implementation previously shipped as berny-brain.js,
// exposed under a new filename to match the page include order.

// Sistema di intelligenza AI per BERNY con context awareness
// NOTE SECURITY:
// - This project is a static site (no backend). Do NOT hardcode real API keys in client code.
// - If you want real AI calls, prefer a server-side proxy endpoint that injects secrets.
// - This file supports 3 modes: local (default), proxy, openai (not recommended in production).

(() => {
  if (window.BernyBrain || window.bernyBrain) {
    // Avoid double-init if the script is loaded twice.
    return;
  }

  const STORAGE = {
    uiLang: 'badianiUILang.v1',
    activeProfile: 'badianiUser.profile.v1',
    gamificationPrefix: 'badianiGamification.v3',
    gamificationGlobal: 'badianiGamification.v3',
    bernyConfig: 'badianiBerny.config.v1',
    bernyAnalytics: 'berny-analytics',
    // Optional (client-side) key storage. Not recommended — use a proxy.
    bernyOpenAIKey: 'badianiBerny.openaiKey.v1',
  };

  const safeJsonParse = (raw, fallback) => {
    try {
      if (raw == null || raw === '') return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  };

  const getUiLang = () => {
    try {
      const raw = String(localStorage.getItem(STORAGE.uiLang) || '').trim().toLowerCase();
      if (raw === 'it' || raw === 'en' || raw === 'es' || raw === 'fr') return raw;
    } catch {}
    try {
      const docLang = String(document.documentElement.lang || '').trim().toLowerCase();
      if (docLang === 'it' || docLang === 'en' || docLang === 'es' || docLang === 'fr') return docLang;
    } catch {}
    return 'it';
  };

  const tr = (key, vars, fallback) => {
    try {
      const api = window.BadianiI18n;
      if (api && typeof api.t === 'function') {
        const out = api.t(key, vars);
        if (out !== key) return out;
      }
    } catch {}
    return fallback != null ? String(fallback) : String(key || '');
  };

  const normalize = (value) => String(value ?? '').toLowerCase().trim();

  const getActiveProfile = () => {
    try {
      const raw = localStorage.getItem(STORAGE.activeProfile);
      const profile = safeJsonParse(raw, null);
      return profile && profile.id ? profile : null;
    } catch {
      return null;
    }
  };

  const getGamificationState = () => {
    const prof = getActiveProfile();
    const key = `${STORAGE.gamificationPrefix}:${prof?.id || 'guest'}`;
    try {
      const raw = localStorage.getItem(key);
      const parsed = safeJsonParse(raw, null);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {}
    try {
      const rawGlobal = localStorage.getItem(STORAGE.gamificationGlobal);
      const parsedGlobal = safeJsonParse(rawGlobal, null);
      if (parsedGlobal && typeof parsedGlobal === 'object') return parsedGlobal;
    } catch {}
    return null;
  };

  const loadConfig = () => {
    const defaults = {
      // local | proxy | openai
      provider: 'local',
      // For proxy mode, set to something like: /api/berny
      proxyEndpoint: '',
      // For openai mode (NOT recommended for production)
      openaiEndpoint: 'https://api.openai.com/v1/chat/completions',
      openaiModel: 'gpt-4o-mini',
      // Optional: if true, allows openai mode from the browser.
      // Strongly discouraged because keys are exposed.
      allowBrowserOpenAI: false,
    };

    try {
      const stored = safeJsonParse(localStorage.getItem(STORAGE.bernyConfig), null);
      if (!stored || typeof stored !== 'object') return { ...defaults };
      return { ...defaults, ...stored };
    } catch {
      return { ...defaults };
    }
  };

  class BernyBrain {
    constructor() {
      this.version = '1.0.0';
      this.conversationHistory = [];
      this.maxHistory = 10; // Ultimi 10 messaggi
      this.config = loadConfig();
      this.userContext = this.loadUserContext();
      this.knowledgeBase = this.loadBadianiKnowledge();

      // Refresh context when the UI language changes.
      document.addEventListener('badiani:lang-changed', () => {
        try {
          this.userContext = this.loadUserContext();
        } catch {}
      });

      // Best-effort refresh when gamification updates.
      document.addEventListener('badiani:crystals-updated', () => {
        try {
          this.userContext = this.loadUserContext();
        } catch {}
      });
      document.addEventListener('badiani:category-completion-updated', () => {
        try {
          this.userContext = this.loadUserContext();
        } catch {}
      });

      // Refresh KB when the new i18n manager emits updates.
      // (Useful when scripts/i18n.js is not present or when relying on i18nUpdated.)
      window.addEventListener('i18nUpdated', () => {
        try {
          this.knowledgeBase = this.loadBadianiKnowledge();
        } catch {}
      });
    }

    // Carica il knowledge base Badiani (lightweight, can be expanded later)
    loadBadianiKnowledge() {
      // Prefer the dedicated localized KB provider if present.
      try {
        if (window.bernyNLP && typeof window.bernyNLP.getLocalizedKnowledge === 'function') {
          const kb = window.bernyNLP.getLocalizedKnowledge();
          if (kb && typeof kb === 'object') return kb;
        }
      } catch {}

      // Fallback (legacy shape)
      return {
        products: {
          coni: {
            gusti: { piccolo: 2, medio: 3, grande: 4 },
            grammi: { piccolo: 80, medio: 120, grande: 180 },
          },
          buontalenti: {
            descrizione: tr('assistant.kb.buontalenti.desc', null, 'Gelato storico fiorentino dal 1932'),
            ingredienti: ['crema', 'tuorli', 'zucchero', 'vaniglia Bourbon'],
          },
        },
        procedures: {
          apertura: tr('assistant.kb.proc.open', null, 'Check temperature gelato (-14°C), pulizia vetrine, attivazione POS'),
          servizio: tr('assistant.kb.proc.service', null, 'Saluto clienti, presentazione gusti, suggerimenti personalizzati'),
          chiusura: tr('assistant.kb.proc.close', null, 'Sanificazione superfici, copertura gelato, check cassa'),
        },
        training: {
          storyOrbit: tr('menu.link.storyOrbit', null, 'Story Orbit'),
          operations: tr('menu.link.operations', null, 'Operations & Setup'),
          gelatoLab: tr('menu.link.gelatoLab', null, 'Gelato Lab'),
        },
      };
    }

    // Carica contesto utente (profile + gamification)
    loadUserContext() {
      const profile = getActiveProfile();
      const state = getGamificationState();
      const lang = getUiLang();

      const nickname = profile?.nickname || tr('assistant.user.defaultName', null, 'Utente');
      const stars = Number.isFinite(state?.stars) ? Number(state.stars) : 0;
      const quizTokens = Number.isFinite(state?.quizTokens) ? Number(state.quizTokens) : 0;
      const gelati = Number.isFinite(state?.gelati) ? Number(state.gelati) : 0;

      // Approximation: count distinct opened cards (lifetime-ish) if present.
      const unlockedCardsCount = state?.unlockedCards && typeof state.unlockedCards === 'object'
        ? Object.keys(state.unlockedCards).length
        : 0;

      return {
        nickname,
        stars,
        quizTokens,
        gelati,
        unlockedCardsCount,
        language: lang,
        profileId: profile?.id || 'guest',
      };
    }

    // Sistema di intent recognition locale
    detectIntent(message) {
      const msg = normalize(message);

      const intents = {
        product_info: /\b(coni|cono|gusti|grammi|buontalenti|gelato|prezzo|peso)\b/i,
        procedure: /\b(apertura|chiusura|procedura|procedure|come\s+si|setup|pulizia|sanificazione)\b/i,
        training_help: /\b(quiz|stelle|punti|modulo|capitolo|corso|token)\b/i,
        greeting: /\b(ciao|salve|buongiorno|buonasera|hey|hola|hello)\b/i,
        help: /\b(aiuto|help|non\s+capisco|come\s+funziona)\b/i,
      };

      for (const [intent, pattern] of Object.entries(intents)) {
        if (pattern.test(msg)) return intent;
      }
      return 'general';
    }

    buildSystemPrompt() {
      const ctx = this.loadUserContext();
      // Keep the prompt short because we target concise answers.
      return `Sei BERNY, l'assistente virtuale di formazione per Badiani 1932.\n\nCONTESTO UTENTE:\n- Nome: ${ctx.nickname}\n- Stelle: ${ctx.stars}\n- Quiz token: ${ctx.quizTokens}\n- Gelati vinti: ${ctx.gelati}\n- Schede sbloccate: ${ctx.unlockedCardsCount}\n- Lingua: ${ctx.language}\n\nKNOWLEDGE BASE BADIANI (estratto):\n${JSON.stringify(this.knowledgeBase, null, 2)}\n\nISTRUZIONI:\n1) Rispondi nella lingua utente (it/en/es/fr).\n2) Usa il knowledge base quando possibile.\n3) Risposte concise (max 2-3 frasi).\n4) Se manca info, rimanda al modulo giusto (Story Orbit / Operations / Gelato Lab).`;
    }

    // Local answers for common intents (fast and offline)
    answerLocally(userMessage, intent) {
      const msg = normalize(userMessage);
      const ctx = this.loadUserContext();

      if (intent === 'greeting') {
        return tr('assistant.greeting', { name: ctx.nickname }, `Ciao ${ctx.nickname}! Sono BERNY. Come posso aiutarti oggi?`);
      }

      // Stars / tokens / progress
      if (/(quante|quanti)\s+stelle|stelle\s+ho|my\s+stars|estrellas/i.test(msg)) {
        if (ctx.language === 'en') return `You have ${ctx.stars} stars ⭐.`;
        if (ctx.language === 'es') return `Tienes ${ctx.stars} estrellas ⭐.`;
        if (ctx.language === 'fr') return `Tu as ${ctx.stars} étoiles ⭐.`;
        return `Hai ${ctx.stars} stelle ⭐.`;
      }

      if (/token|quiz\s+token|pass|credit/i.test(msg)) {
        if (ctx.language === 'en') return `You have ${ctx.quizTokens} quiz tokens 📚.`;
        if (ctx.language === 'es') return `Tienes ${ctx.quizTokens} tokens de quiz 📚.`;
        if (ctx.language === 'fr') return `Tu as ${ctx.quizTokens} jetons quiz 📚.`;
        return `Hai ${ctx.quizTokens} token quiz 📚.`;
      }

      // Cones
      if (/\bcono\b|\bconi\b/.test(msg)) {
        const { gusti, grammi } = this.knowledgeBase.products.coni;
        const size = /piccol/.test(msg) ? 'piccolo' : /medi/.test(msg) ? 'medio' : /grand/.test(msg) ? 'grande' : '';
        if (size) {
          if (ctx.language === 'en') return `Cones (${size}): up to ${gusti[size]} flavours, about ${grammi[size]}g.`;
          if (ctx.language === 'es') return `Conos (${size}): hasta ${gusti[size]} sabores, aprox. ${grammi[size]}g.`;
          if (ctx.language === 'fr') return `Cornets (${size}) : jusqu’à ${gusti[size]} parfums, env. ${grammi[size]}g.`;
          return `Coni (${size}): fino a ${gusti[size]} gusti, circa ${grammi[size]}g.`;
        }
        if (ctx.language === 'en') return `Cones: small ${grammi.piccolo}g (up to ${gusti.piccolo} flavours), medium ${grammi.medio}g (up to ${gusti.medio}), large ${grammi.grande}g (up to ${gusti.grande}).`;
        if (ctx.language === 'es') return `Conos: pequeño ${grammi.piccolo}g (hasta ${gusti.piccolo} sabores), mediano ${grammi.medio}g (hasta ${gusti.medio}), grande ${grammi.grande}g (hasta ${gusti.grande}).`;
        if (ctx.language === 'fr') return `Cornets : petit ${grammi.piccolo}g (jusqu’à ${gusti.piccolo} parfums), moyen ${grammi.medio}g (jusqu’à ${gusti.medio}), grand ${grammi.grande}g (jusqu’à ${gusti.grande}).`;
        return `Coni: piccolo ${grammi.piccolo}g (fino a ${gusti.piccolo} gusti), medio ${grammi.medio}g (fino a ${gusti.medio}), grande ${grammi.grande}g (fino a ${gusti.grande}).`;
      }

      // Default fallback
      if (ctx.language === 'en') return 'I can help with cones, Buontalenti, procedures, and quizzes. What do you need?';
      if (ctx.language === 'es') return 'Puedo ayudarte con conos, Buontalenti, procedimientos y quizzes. ¿Qué necesitas?';
      if (ctx.language === 'fr') return 'Je peux t’aider avec les cornets, Buontalenti, les procédures et les quiz. De quoi as-tu besoin ?';
      return 'Posso aiutarti su coni, Buontalenti, procedure e quiz. Cosa ti serve?';
    }

    // Main API: sendMessage with streaming callbacks
    sendMessage(userMessage, onChunk, onDone) {
      const message = String(userMessage ?? '').trim();
      const intent = this.detectIntent(message);

      // Local provider: respond immediately.
      if (this.config.provider === 'local') {
        const response = this.answerLocally(message, intent);
        try {
          // Stream in small chunks for UI effect.
          const text = String(response || '');
          const chunkSize = 18;
          let i = 0;
          const tick = () => {
            const chunk = text.slice(i, i + chunkSize);
            if (chunk) {
              if (typeof onChunk === 'function') onChunk(chunk);
              i += chunkSize;
              setTimeout(tick, 18);
            } else {
              if (typeof onDone === 'function') onDone(text, 'local');
            }
          };
          tick();
        } catch {
          if (typeof onDone === 'function') onDone(String(response || ''), 'local');
        }
        return;
      }

      // If other providers are configured, keep the existing file’s behavior by falling back to local.
      const fallback = this.answerLocally(message, intent);
      if (typeof onDone === 'function') onDone(String(fallback || ''), 'local');
    }
  }

  window.BernyBrain = BernyBrain;
  window.bernyBrain = new BernyBrain();
})();
