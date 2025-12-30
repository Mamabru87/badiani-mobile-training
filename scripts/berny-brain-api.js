// FILE: scripts/berny-brain-api.js
// Integrazione Google Gemini via SDK Ufficiale

class BernyBrainAPI {
  constructor() {
    // HARDCODED FALLBACK per sbloccare la situazione
    const HARDCODED_KEY = "AIzaSyDDMtpPb6C3LA0SNWU2ghSZ48dx67HvOjc";
    
    let stored = localStorage.getItem('berny_api_key');
    if (!stored || stored.length < 10) {
      console.log("🔑 Inietto la nuova chiave fornita...");
      localStorage.setItem('berny_api_key', HARDCODED_KEY);
      stored = HARDCODED_KEY;
    }

    this.apiKey = stored;
    // USO IL MODELLO PRESENTE NELLA LISTA (Gemini 2.0 Flash Experimental)
    this.modelName = "gemini-2.0-flash-exp";
    this.history = [];
    this.genAI = null;
    this.model = null;
    
    if (this.apiKey) {
      console.log("🔑 API Key caricata:", this.apiKey.substring(0, 8) + "...");
    }
    
    this.init();
  }

  // (Test rimosso perché la chiave funziona, era solo il modello sbagliato)
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
      
      // Timeout di 8 secondi per evitare blocchi infiniti
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Timeout - Il modello ci sta mettendo troppo")), 8000)
      );

      const result = await Promise.race([
        this.model.generateContent(fullPrompt),
        timeoutPromise
      ]);

      const response = await result.response;
      return response.text();

    } catch (error) {
      console.warn(`⚠️ Errore o Timeout (${error.message}). Passo al BACKUP...`);

      // Se fallisce per limiti (429), errore tecnico o TIMEOUT
      if (true) { // Entra sempre nel backup se il primo fallisce
        
        try {
          // TENTATIVO 2: Modello Backup (Gemini 1.5 Flash - Più stabile)
          // Nota: gemini-1.0-pro è deprecato, meglio usare 1.5-flash come backup solido
          const backupModel = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
          
          const systemPrompt = this.buildSystemPrompt();
          const result = await backupModel.generateContent(`${systemPrompt}\n\nUtente: ${userMessage}`);
          const response = await result.response;
          
          return response.text(); // Restituisce la risposta senza errori!
          
        } catch (backupError) {
          console.error("❌ Anche il backup è fallito:", backupError);
          
          // Se è un errore di chiave/permessi, la rimuoviamo per forzare il reinserimento
          if (error.message.includes('404') || error.message.includes('403')) {
            // localStorage.removeItem('berny_api_key'); // DISABILITATO AUTO-DELETE PER DEBUG
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

      IL TUO OBIETTIVO:
      Dare risposte "flash" (max 2 frasi) che invitano l'utente ad aprire la scheda tecnica.
      
      REGOLE DI RISPOSTA:
      1. Sii brevissimo. Riassumi i punti chiave.
      2. NON fare elenchi puntati lunghi.
      3. Chiudi SEMPRE invitando ad aprire la scheda (es: "Apri la scheda qui sotto per i dettagli!").
      4. Usa emoji ma non esagerare.

      REGOLE LINK SCHEDE:
      Se la tua risposta riguarda uno di questi argomenti, AGGIUNGI ALLA FINE del messaggio il tag corrispondente (invisibile all'utente):
      - Gelato/Gusti -> [[LINK:gelato-lab.html]]
      - Caffè/Bar -> [[LINK:caffe.html]]
      - Churros/Crepes/Waffle -> [[LINK:sweet-treats.html]] (o pastries.html se specifico)
      - Storia/Azienda -> [[LINK:story-orbit.html]]
      - Procedure/Operazioni -> [[LINK:operations.html]]

      CONOSCENZA ATTUALE:
      ${info}
      
      ESEMPIO:
      Utente: "Come si fanno i churros?"
      Tu: "I churros vanno fritti a 190°C. 🥨 Apri la scheda per i dettagli!" [[LINK:sweet-treats.html]]
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
