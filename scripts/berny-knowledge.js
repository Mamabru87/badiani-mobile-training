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
      // ------------------------------
      // BRAND / HERITAGE (IT)
      // NOTE: Kept under `products` so berny-brain-api.js always injects it.
      // ------------------------------
      badiani_brand_story: {
        keywords: [
          'storia badiani', 'brand story', 'tradizione familiare',
          'idilio badiani', 'orazio pomposi', 'paolo pomposi', 'patrizio pomposi',
          'quando nasce badiani', 'fondazione badiani', '1932', '1993', '2015',
          'londra', 'inghilterra', 'uk'
        ],
        response:
          '**Badiani 1932 — Brand story (in breve)**\n\n' +
          '• **1932 (Firenze)**: nasce la prima gelateria Badiani, fondata dal gelatiere **Idilio Badiani**.\n' +
          '• **1993**: il brand viene acquisito dal gelatiere **Orazio Pomposi**, che con i figli **Paolo** e **Patrizio** guida crescita, innovazione e creatività (gusti + produzione).\n' +
          '• **2015 (UK)**: ingresso nel mercato inglese con più store a **Londra** e un laboratorio dedicato.\n\n' +
          'Oggi Badiani è internazionale ma mantiene standard elevati della tradizione fiorentina, con il gusto firma **Buontalenti** come simbolo.'
      },
      badiani_brand_promise: {
        keywords: [
          'brand promise', 'promessa di marca', 'idea badiani',
          'firenze nel cono', 'heritage', 'artigianalita', 'artigianalità',
          'maestro gelatiere', 'paolo pomposi'
        ],
        response:
          '**Brand promise Badiani — “l’idea”**\n\n' +
          'Badiani 1932 nasce a **Firenze**, icona di bellezza, artigianalità e genialità creativa: il brand trae forza da questa eredità.\n' +
          'Ogni gusto è studiato con cura da un Maestro Gelatiere: **Paolo Pomposi** (uno dei proprietari e figlio d’arte).\n' +
          'Con il gusto firma **Buontalenti**, Badiani promette un’esperienza al palato unica ed esclusiva, legata a una storia fiorentina “leggendaria”.'
      },
      buontalenti_cultura: {
        keywords: [
          'cultura del buontalenti', 'storia del gelato', 'origine gelato',
          'rinascimento', 'medici', 'cosimo i', 'delegazione spagnola', 'caterina de medici'
        ],
        response:
          '**La cultura del Buontalenti (storytelling heritage)**\n\n' +
          'A Firenze, intorno alla metà del **Cinquecento**, Cosimo I de’ Medici chiede a **Bernardo Buontalenti** di organizzare festeggiamenti per stupire una delegazione spagnola.\n' +
          'Nei banchetti compare una **crema ghiacciata** addolcita con una spezia preziosa arrivata dalle Americhe: **lo zucchero**.\n' +
          'Il racconto collega poi la diffusione del gelato anche alle corti europee tramite **Caterina de’ Medici**.'
      },
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
        keywords: ['buontalenti', 'gelato storico', '1932', 'bernardo buontalenti', 'medici', 'rinascimento'],
        descrizione: 'Gusto firma Badiani (heritage fiorentino) + storytelling rinascimentale legato a Bernardo Buontalenti.',
        ingredienti: ['latte fresco', 'panna', 'tuorli', 'zucchero'],
        response:
          '**Buontalenti (Badiani) — cosa dire in 20 secondi** 🍦\n\n' +
          'Badiani nasce a Firenze nel **1932** e Buontalenti è il nostro gusto firma.\n' +
          'Il suo storytelling si collega al Rinascimento: a metà del Cinquecento, **Bernardo Buontalenti** crea una “crema ghiacciata” per i Medici, resa speciale dall’arrivo dello **zucchero** dalle Americhe.\n' +
          'Per approfondire il racconto e i rituali di servizio, apri la scheda dedicata.'
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
