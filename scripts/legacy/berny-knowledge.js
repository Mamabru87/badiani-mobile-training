// FILE: scripts/berny-knowledge.js
// Base knowledge payload for BERNY.
// This file is intentionally standalone (no bundler) and provides:
// - window.BERNY_KNOWLEDGE: Italian default KB (fallback)
// - window.BernyKnowledge: tiny namespace marker for the split architecture

(() => {
  if (window.BERNY_KNOWLEDGE) {
    // Avoid double init if script is loaded twice.
    return;
  }

  // Keep a minimal namespace marker for compatibility.
  if (!window.BernyKnowledge) {
    window.BernyKnowledge = { version: '1.0.0' };
  }

  // Default (it) knowledge. Other languages are provided by berny-nlp.js.
  window.BERNY_KNOWLEDGE = {
    products: {
      coni: {
        keywords: ['coni', 'cono', 'gelato cono', 'gusti', 'grammi', 'prezzi', 'peso'],
        // Keep numeric data too (used by berny-brain-local.js local answers).
        gusti: { piccolo: 2, medio: 3, grande: 4 },
        grammi: { piccolo: 80, medio: 120, grande: 180 },
        response:
          'Coni Badiani 🍦:\n' +
          '• Piccolo: 2 gusti, 80g (€3.50)\n' +
          '• Medio: 3 gusti, 120g (€4.50)\n' +
          '• Grande: 4 gusti, 180g (€5.50)',
      },
      buontalenti: {
        keywords: ['buontalenti', 'gelato storico', '1932'],
        descrizione: 'Gelato storico fiorentino dal 1932',
        ingredienti: ['crema fresca', 'tuorli', 'zucchero', 'vaniglia Bourbon del Madagascar'],
        response:
          '**Buontalenti** è il nostro gelato storico dal 1932! 🍦✨\n\n' +
          'Creato nel 1559 da Bernardo Buontalenti per i Medici, fatto con crema fresca, tuorli, zucchero e vaniglia Bourbon del Madagascar. ' +
          'Servito a -14°C per una cremosità perfetta!',
      },
    },
    procedures: {
      apertura: {
        keywords: ['apertura', 'aprire', 'setup', 'mattina', 'routine apertura'],
        steps: [
          '🌡️ Controlla temperatura gelato (-14°C ±1°)',
          '🧼 Pulisci vetrine e superfici',
          '💳 Accendi POS e verifica connessione',
          '📋 Controlla scorte (coni, coppette, topping)',
          '👔 Indossa uniforme e badge',
          '😊 Sorriso pronto!',
        ],
        response:
          '**Procedura apertura negozio** 🏪\n\n{steps}\n\n✅ Dettagli completi nel modulo **Operations & Setup**!',
      },
    },
    faq: {
      help: {
        keywords: ['aiuto', 'come funziona', 'cosa fai', 'help'],
        response:
          "👋 Ciao! Sono BERNY, il tuo assistente Badiani!\n\n" +
          "Posso aiutarti con:\n" +
          "• 📦 Info prodotti (coni, gusti, pesi)\n" +
          "• 📋 Procedure operative\n" +
          "• 📚 Moduli training\n" +
          "• ⭐ Sistema stelle e quiz\n\n" +
          "Chiedimi pure!",
      },
      greeting: {
        keywords: ['ciao', 'salve', 'buongiorno', 'buonasera', 'hey'],
        responses: [
          'Ciao! 👋 Come posso aiutarti oggi?',
          'Hey! 😊 Dimmi pure!',
          'Buongiorno! ☀️ Pronti a imparare?',
          'Ciao! 🍦 Cosa vuoi sapere?',
        ],
      },
    },
  };
})();
