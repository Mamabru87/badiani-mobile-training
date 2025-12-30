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
    }

    // Carica il knowledge base Badiani (lightweight, can be expanded later)
    loadBadianiKnowledge() {
      return {
        products: {
          coni: {
            gusti: { piccolo: 2, medio: 3, grande: 4 },
            grammi: { piccolo: 80, medio: 120, grande: 180 },
          },
          buontalenti: {
            descrizione: tr(
              'assistant.kb.buontalenti.desc',
              null,
              'Gelato storico fiorentino dal 1932'
            ),
            ingredienti: ['crema', 'tuorli', 'zucchero', 'vaniglia Bourbon'],
          },
        },
        procedures: {
          apertura: tr(
            'assistant.kb.proc.open',
            null,
            'Check temperature gelato (-14°C), pulizia vetrine, attivazione POS'
          ),
          servizio: tr(
            'assistant.kb.proc.service',
            null,
            'Saluto clienti, presentazione gusti, suggerimenti personalizzati'
          ),
          chiusura: tr(
            'assistant.kb.proc.close',
            null,
            'Sanificazione superfici, copertura gelato, check cassa'
          ),
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
        return tr(
          'assistant.greeting',
          { name: ctx.nickname },
          `Ciao ${ctx.nickname}! Sono BERNY. Come posso aiutarti oggi?`
        );
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
        // If user mentions a size, answer that size, else provide the table.
        if (/piccol/.test(msg)) return `Cono piccolo: ${gusti.piccolo} gusti, ${grammi.piccolo}g 🍦.`;
        if (/medi/.test(msg)) return `Cono medio: ${gusti.medio} gusti, ${grammi.medio}g 🍦.`;
        if (/grand/.test(msg)) return `Cono grande: ${gusti.grande} gusti, ${grammi.grande}g 🍦.`;

        return `Coni: piccolo ${gusti.piccolo} gusti (${grammi.piccolo}g), medio ${gusti.medio} gusti (${grammi.medio}g), grande ${gusti.grande} gusti (${grammi.grande}g) 🍦.`;
      }

      // Buontalenti
      if (/buontalenti/.test(msg)) {
        const b = this.knowledgeBase.products.buontalenti;
        return `${b.descrizione}. Ingredienti: ${b.ingredienti.join(', ')} 🍦.`;
      }

      // Procedures
      if (/apertura/.test(msg)) {
        return `${this.knowledgeBase.procedures.apertura}. ${tr('assistant.suggest.operations', null, 'Trovi i dettagli in Operations & Setup 📚.')}`;
      }
      if (/chiusura/.test(msg)) {
        return `${this.knowledgeBase.procedures.chiusura}. ${tr('assistant.suggest.operations', null, 'Trovi i dettagli in Operations & Setup 📚.')}`;
      }
      if (/pulizia|sanific/.test(msg)) {
        return `${this.knowledgeBase.procedures.chiusura}. ${tr('assistant.suggest.operations', null, 'Per checklist completa: Operations & Setup 📚.')}`;
      }

      if (intent === 'help') {
        if (ctx.language === 'en') return 'Ask me about cones, Buontalenti, opening/closing procedures, or your stars ⭐.';
        if (ctx.language === 'es') return 'Pregúntame por conos, Buontalenti, apertura/cierre o tus estrellas ⭐.';
        if (ctx.language === 'fr') return 'Demande-moi les cones, Buontalenti, l’ouverture/fermeture, ou tes étoiles ⭐.';
        return 'Chiedimi coni, Buontalenti, procedure di apertura/chiusura o le tue stelle ⭐.';
      }

      // No strong local answer.
      return null;
    }

    // Proxy call (recommended): POST endpoint with { messages, userContext, intent }
    async callProxy({ userMessage, intent, onChunk }) {
      const endpoint = String(this.config.proxyEndpoint || '').trim();
      if (!endpoint) throw new Error('Proxy endpoint not configured');

      const payload = {
        intent,
        userContext: this.loadUserContext(),
        messages: [
          { role: 'system', content: this.buildSystemPrompt() },
          ...this.conversationHistory,
          { role: 'user', content: userMessage },
        ],
      };

      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        throw new Error(`Proxy error: ${resp.status}`);
      }

      // If proxy streams SSE, try to stream; else parse JSON.
      const ctype = String(resp.headers.get('content-type') || '');
      if (ctype.includes('text/event-stream') && resp.body && onChunk) {
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let full = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          // Very lightweight: accept raw chunks as text (proxy can pre-format)
          full += chunk;
          onChunk(chunk);
        }
        return full;
      }

      const data = await resp.json().catch(() => ({}));
      const text = String(data?.text || data?.message || '').trim();
      if (!text) throw new Error('Proxy returned empty response');
      return text;
    }

    // Direct OpenAI call (NOT recommended in client). Requires CORS + exposed key.
    async callOpenAI({ userMessage, onChunk }) {
      if (!this.config.allowBrowserOpenAI) {
        throw new Error('Browser OpenAI calls are disabled (allowBrowserOpenAI=false)');
      }

      const apiKey =
        (window.BERNY_OPENAI_API_KEY && String(window.BERNY_OPENAI_API_KEY)) ||
        (() => {
          try { return String(localStorage.getItem(STORAGE.bernyOpenAIKey) || '').trim(); } catch { return ''; }
        })();

      if (!apiKey) {
        throw new Error('Missing OpenAI API key (set localStorage badianiBerny.openaiKey.v1 or window.BERNY_OPENAI_API_KEY)');
      }

      const endpoint = this.config.openaiEndpoint || 'https://api.openai.com/v1/chat/completions';
      const model = this.config.openaiModel || 'gpt-4o-mini';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: this.buildSystemPrompt() },
            ...this.conversationHistory,
            { role: 'user', content: userMessage },
          ],
          temperature: 0.7,
          max_tokens: 180,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter((line) => line.trim().startsWith('data:'));

        for (const line of lines) {
          const data = line.replace('data: ', '').trim();
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content || '';
            if (content) {
              fullResponse += content;
              if (onChunk) onChunk(content);
            }
          } catch {
            // ignore parse errors
          }
        }
      }

      return fullResponse;
    }

    // Unified sendMessage API for the chat UI
    async sendMessage(userMessage, onChunk, onComplete) {
      try {
        const intent = this.detectIntent(userMessage);

        // Refresh context each message.
        this.userContext = this.loadUserContext();

        // Fast local route when possible.
        const local = this.answerLocally(userMessage, intent);
        if (local) {
          if (typeof onComplete === 'function') onComplete(local, 'local');
          return;
        }

        // Update history (user)
        this.conversationHistory.push({ role: 'user', content: String(userMessage || '') });
        if (this.conversationHistory.length > this.maxHistory * 2) {
          this.conversationHistory = this.conversationHistory.slice(-this.maxHistory * 2);
        }

        let fullResponse = '';

        if (this.config.provider === 'proxy') {
          fullResponse = await this.callProxy({ userMessage, intent, onChunk });
        } else if (this.config.provider === 'openai') {
          fullResponse = await this.callOpenAI({ userMessage, onChunk });
        } else {
          // Local fallback when no provider configured.
          fullResponse = tr(
            'assistant.offlineFallback',
            null,
            'Posso aiutarti su coni, Buontalenti, procedure e quiz. Prova a chiedermi una di queste!'
          );
        }

        // Update history (assistant)
        this.conversationHistory.push({ role: 'assistant', content: fullResponse });

        if (typeof onComplete === 'function') onComplete(fullResponse, this.config.provider);

        // Best effort analytics
        try { this.saveConversation(); } catch {}
      } catch (error) {
        console.error('BERNY error:', error);
        const msg = tr(
          'assistant.error',
          null,
          'Oops! Ho avuto un problema tecnico 😅 Riprova o consulta direttamente i moduli training.'
        );
        if (typeof onComplete === 'function') onComplete(msg, 'error');
      }
    }

    // Suggerimenti contestuali basati su progresso
    getSuggestions() {
      const ctx = this.loadUserContext();
      const suggestions = [];

      if (!ctx.unlockedCardsCount) {
        suggestions.push(tr('assistant.suggest.start', null, 'Da dove inizio?'));
        suggestions.push(tr('assistant.suggest.story', null, "Cos'è Story Orbit?"));
      } else {
        suggestions.push(tr('assistant.suggest.buontalenti', null, 'Dimmi qualcosa sul Buontalenti 🍦'));
        suggestions.push(tr('assistant.suggest.stars', null, 'Quante stelle ho?'));
      }

      suggestions.push(tr('assistant.suggest.quiz', null, 'Come funzionano i quiz?'));
      suggestions.push(tr('assistant.suggest.opening', null, 'Procedura apertura negozio'));

      return suggestions;
    }

    // Salva conversazione per analytics
    saveConversation() {
      const timestamp = new Date().toISOString();
      const lastUser = (() => {
        for (let i = this.conversationHistory.length - 1; i >= 0; i -= 1) {
          if (this.conversationHistory[i]?.role === 'user') return this.conversationHistory[i]?.content || '';
        }
        return '';
      })();

      const convData = {
        timestamp,
        user: this.userContext.nickname,
        messages: Math.floor(this.conversationHistory.length / 2),
        lastTopic: this.detectIntent(lastUser || ''),
        provider: this.config.provider,
      };

      const analytics = safeJsonParse(localStorage.getItem(STORAGE.bernyAnalytics) || '[]', []);
      if (Array.isArray(analytics)) {
        analytics.push(convData);
        localStorage.setItem(STORAGE.bernyAnalytics, JSON.stringify(analytics.slice(-50)));
      }
    }
  }

  window.BernyBrain = BernyBrain;
  window.bernyBrain = new BernyBrain();
})();
