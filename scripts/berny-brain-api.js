// FILE: scripts/berny-brain-api.js
// Integrazione Google Gemini via SDK Ufficiale

class BernyBrainAPI {
  constructor() {
    this.apiKey = localStorage.getItem('berny_api_key');
    this.modelName = "gemini-2.0-flash-exp";
    this.history = [];
    this.genAI = null;
    this.model = null;
    
    this.init();
  }

  init() {
    // Aspetta che l'SDK sia caricato
    if (window.GoogleGenerativeAI && this.apiKey) {
      this.genAI = new window.GoogleGenerativeAI(this.apiKey);
      this.model = this.genAI.getGenerativeModel({ model: this.modelName });
      console.log("🤖 Berny Brain (Google SDK) pronto!");
    } else {
      console.warn("⚠️ SDK Google o API Key mancante.");
    }

    // Listener per inserimento chiave via chat
    window.addEventListener('berny-user-message', (e) => {
      if (e.detail.message.startsWith('/apikey')) {
        const key = e.detail.message.replace('/apikey', '').trim();
        localStorage.setItem('berny_api_key', key);
        alert("Chiave salvata! Ricarico...");
        window.location.reload();
      }
    });
  }

  async processMessage(userMessage) {
    if (!this.apiKey) return "⚠️ Scrivi '/apikey LA_TUA_CHIAVE' per attivarmi!";
    if (!this.model) this.init(); // Riprova init se fallito prima
    if (!this.model) return "⚠️ Errore caricamento SDK Google. Controlla la connessione.";

    window.dispatchEvent(new CustomEvent('berny-typing-start'));

    try {
      // Costruisci il prompt con il contesto
      const systemPrompt = this.buildSystemPrompt();
      const fullPrompt = `${systemPrompt}\n\nUtente: ${userMessage}`;

      // Chiamata via SDK
      const result = await this.model.generateContent(fullPrompt);
      const response = await result.response;
      const text = response.text();

      return text;

    } catch (error) {
      console.error("Errore Gemini SDK:", error);
      return `Mi dispiace, errore tecnico: ${error.message || "Connessione fallita"}`;
    } finally {
      window.dispatchEvent(new CustomEvent('berny-typing-end'));
    }
  }

  buildSystemPrompt() {
    const kb = window.BERNY_KNOWLEDGE || {};
    let info = "Sei Berny, l'assistente esperto di gelato Badiani. Rispondi in italiano.\n\nINFO PRODOTTI:\n";
    
    // Inietta info dal knowledge base
    if (kb.products) {
      Object.entries(kb.products).forEach(([key, val]) => {
        info += `- ${key.toUpperCase()}: ${val.response}\n`;
      });
    }
    return info;
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

        // pseudo-stream per UI
        if (typeof onChunk === 'function') {
          const chunkSize = 24;
          let i = 0;
          const tick = () => {
            const c = text.slice(i, i + chunkSize);
            if (c) {
              try { onChunk(c); } catch {}
              i += chunkSize;
              window.setTimeout(tick, 16);
            } else {
              if (typeof onComplete === 'function') onComplete(text, 'gemini-sdk');
            }
          };
          tick();
          return;
        }

        if (typeof onComplete === 'function') onComplete(text, 'gemini-sdk');
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
