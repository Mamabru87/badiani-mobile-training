// FILE: scripts/berny-brain-api.js
// Integrazione Google Gemini via SDK Ufficiale

class BernyBrainAPI {
  constructor() {
    this.apiKey = localStorage.getItem('berny_api_key');
    this.modelName = "gemini-1.5-flash-8b";
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
    if (!this.model) this.init();

    // Notifica UI
    window.dispatchEvent(new CustomEvent('berny-typing-start'));

    try {
      const systemPrompt = this.buildSystemPrompt();
      const fullPrompt = `${systemPrompt}\n\nUtente: ${userMessage}`;
      
      // TENTATIVO 1: Modello Veloce (Flash)
      console.log(`Tentativo 1 con ${this.modelName}...`);
      const result = await this.model.generateContent(fullPrompt);
      const response = await result.response;
      return response.text();

    } catch (error) {
      // Se fallisce per limiti (429) o errore tecnico
      if (error.message.includes('429') || error.message.includes('quota') || error.message.includes('404')) {
        
        console.warn(`⚠️ ${this.modelName} fallito. Passo al BACKUP (gemini-pro)...`);
        
        try {
          // TENTATIVO 2: Modello Backup (Gemini Pro)
          // Istanzia al volo il modello Pro
          const backupModel = this.genAI.getGenerativeModel({ model: "gemini-pro" });
          
          const systemPrompt = this.buildSystemPrompt();
          const result = await backupModel.generateContent(`${systemPrompt}\n\nUtente: ${userMessage}`);
          const response = await result.response;
          
          return response.text(); // Restituisce la risposta senza errori!
          
        } catch (backupError) {
          console.error("❌ Anche il backup è fallito:", backupError);
          return "Mi dispiace, oggi sono richiestissimo! 🚦 Riprova tra 1 minuto (Quota Google esaurita).";
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
    const userLang = (window.BadianiI18n?.currentLang || 'it').toLowerCase();
    
    let info = `Sei Berny, l'assistente esperto di gelato Badiani. Rispondi in ${userLang}.\n\n`;
    
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
