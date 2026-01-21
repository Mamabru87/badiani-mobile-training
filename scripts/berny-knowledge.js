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

  // ============================================================
  // STRUCTURED KNOWLEDGE BASE (v2.0) - Context-Aware
  // Categorie: brand, gelato, crepes, waffle, caffe, slitti, festive, procedures, faq
  // Ogni entry ha: keywords[], category, params{}, response{}
  // ============================================================
  window.BERNY_KNOWLEDGE_STRUCTURED = {
    // === BRAND & HERITAGE ===
    brand: {
      badiani_story: {
        keywords: ['storia badiani', 'brand story', 'tradizione', 'fondazione', '1932', '1993', '2015', 'londra', 'firenze', 'pomposi', 'idilio'],
        category: 'brand',
        params: { fondazione: 1932, acquisizione: 1993, ukExpansion: 2015, fondatore: 'Idilio Badiani' },
        response: {
          it: '**Badiani 1932** nasce a Firenze, fondata da Idilio Badiani. Nel 1993 acquisita dalla famiglia Pomposi. Dal 2015 presente a Londra.',
          en: '**Badiani 1932** was born in Florence, founded by Idilio Badiani. In 1993 acquired by the Pomposi family. Since 2015 present in London.',
          es: '**Badiani 1932** nació en Florencia. En 1993 adquirida por la familia Pomposi. Desde 2015 presente en Londres.',
          fr: '**Badiani 1932** est né à Florence. En 1993 acquis par la famille Pomposi. Depuis 2015 présent à Londres.'
        }
      },
      buontalenti_cultura: {
        keywords: ['buontalenti', 'storia gelato', 'rinascimento', 'medici', 'bernardo buontalenti', 'cinquecento'],
        category: 'brand',
        params: { epoca: 'Cinquecento', personaggio: 'Bernardo Buontalenti' },
        response: {
          it: 'Nel Cinquecento, **Bernardo Buontalenti** creò una crema ghiacciata per i Medici. È lo storytelling heritage del Buontalenti.',
          en: 'In the 16th century, **Bernardo Buontalenti** created an iced cream for the Medici. Heritage storytelling.',
          es: 'En el siglo XVI, **Bernardo Buontalenti** creó una crema helada para los Medici.',
          fr: 'Au XVIe siècle, **Bernardo Buontalenti** créa une crème glacée pour les Médicis.'
        }
      }
    },
    // === GELATO ===
    gelato: {
      coni: {
        keywords: ['cono', 'coni', 'gusti cono', 'prezzo cono', 'peso cono', 'grammi cono'],
        category: 'gelato',
        params: {
          piccolo: { gusti: 2, grammi: '80-100' },
          medio: { gusti: 3, grammi: '100-120' },
          grande: { gusti: 4, grammi: '140-160' }
        },
        response: {
          it: '🍦 **Coni**: Piccolo 2 gusti (80-100g), Medio 3 gusti (100-120g), Grande 4 gusti (140-160g)',
          en: '🍦 **Cones**: Small 2 flavors (80-100g), Medium 3 flavors (100-120g), Large 4 flavors (140-160g)',
          es: '🍦 **Conos**: Pequeño 2 sabores, Mediano 3, Grande 4',
          fr: '🍦 **Cornets**: Petit 2 parfums, Moyen 3, Grand 4'
        }
      },
      coppette: {
        keywords: ['coppetta', 'coppette', 'peso coppetta', 'grammi coppetta', 'small cup'],
        category: 'gelato',
        params: {
          piccola: { grammi: '100-120' },
          media: { grammi: '140-160' },
          grande: { grammi: '200-220' }
        },
        response: {
          it: '🥤 **Coppette**: Piccola 100-120g, Media 140-160g, Grande 200-220g',
          en: '🥤 **Cups**: Small 100-120g, Medium 140-160g, Large 200-220g',
          es: '🥤 **Tarrinas**: Pequeña 100-120g, Mediana 140-160g, Grande 200-220g',
          fr: '🥤 **Coupes**: Petite 100-120g, Moyenne 140-160g, Grande 200-220g'
        }
      },
      vaschette: {
        keywords: ['vaschetta', 'asporto', 'takeaway', 'tub', 'ml vaschetta'],
        category: 'gelato',
        params: { piccola: { ml: 500 }, media: { ml: 750 }, grande: { ml: 1000 } },
        response: {
          it: '📦 **Vaschette**: Piccola 500ml, Media 750ml, Grande 1000ml',
          en: '📦 **Tubs**: Small 500ml, Medium 750ml, Large 1000ml',
          es: '📦 **Tarrinas**: Pequeña 500ml, Mediana 750ml, Grande 1000ml',
          fr: '📦 **Pots**: Petit 500ml, Moyen 750ml, Grand 1000ml'
        }
      },
      temperatura: {
        keywords: ['temperatura gelato', 'temperatura vetrina', 'conservazione', 'freezer', 'servizio'],
        category: 'gelato',
        params: { vetrina: { min: -14, max: -8 }, freezer: { min: -20, max: -18 }, servizio: -12 },
        response: {
          it: '🌡️ **Temperature**: Vetrina -8/-14°C, Freezer -18/-20°C, Servizio -10/-12°C',
          en: '🌡️ **Temperatures**: Display -8/-14°C, Freezer -18/-20°C, Serving -10/-12°C',
          es: '🌡️ **Temperaturas**: Vitrina -8/-14°C, Congelador -18/-20°C, Servicio -10/-12°C',
          fr: '🌡️ **Températures**: Vitrine -8/-14°C, Congélateur -18/-20°C, Service -10/-12°C'
        }
      }
    },
    // === CREPES ===
    crepes: {
      mix_big_batch: {
        keywords: ['big batch', 'mix crepes', 'ricetta crepes', 'latte crepes', 'uova crepes', '1500'],
        category: 'crepes',
        params: { latte: 1500, acqua: 300, uova: 9, shelfLife: 3, riposo: 2 },
        response: {
          it: '🥞 **BIG BATCH**: 1500ml latte, 300ml acqua, 9 uova. Riposo min 2h. Shelf life 3 giorni.',
          en: '🥞 **BIG BATCH**: 1500ml milk, 300ml water, 9 eggs. Rest min 2h. Shelf life 3 days.',
          es: '🥞 **BIG BATCH**: 1500ml leche, 300ml agua, 9 huevos. Reposo min 2h. Shelf life 3 días.',
          fr: '🥞 **BIG BATCH**: 1500ml lait, 300ml eau, 9 œufs. Repos min 2h. Conservation 3 jours.'
        }
      },
      mix_small_batch: {
        keywords: ['small batch', 'mix piccolo', 'batch piccolo', '200 ml acqua'],
        category: 'crepes',
        params: { latte: 1000, acqua: 200, uova: 6, shelfLife: 3 },
        response: {
          it: '🥞 **SMALL BATCH**: 1000ml latte, 200ml acqua, 6 uova. Shelf life 3 giorni.',
          en: '🥞 **SMALL BATCH**: 1000ml milk, 200ml water, 6 eggs. Shelf life 3 days.',
          es: '🥞 **SMALL BATCH**: 1000ml leche, 200ml agua, 6 huevos. Shelf life 3 días.',
          fr: '🥞 **SMALL BATCH**: 1000ml lait, 200ml eau, 6 œufs. Conservation 3 jours.'
        }
      },
      signature_buontalenti: {
        keywords: ['signature crepe', 'buontalenti crepe', 'pallina gelato crepe', '70g'],
        category: 'crepes',
        params: { gelato: 70, salsa: 30, finish: 'icing sugar' },
        response: {
          it: '🍦 **Signature Crepe**: 70g gelato Buontalenti + 30g salsa. Finish: zucchero a velo.',
          en: '🍦 **Signature Crepe**: 70g Buontalenti gelato + 30g sauce. Finish: icing sugar.',
          es: '🍦 **Signature Crepe**: 70g helado + 30g salsa. Finish: azúcar glas.',
          fr: '🍦 **Signature Crêpe**: 70g glace + 30g sauce. Finition: sucre glace.'
        }
      },
      italiana: {
        keywords: ['crepe italiana', 'crepe salata', 'pomodorini', 'rucola', '3 pomodorini'],
        category: 'crepes',
        params: { pomodorini: 3, rucola: true, mozzarella: true },
        response: {
          it: '🇮🇹 **Crepe Italiana**: 3 pomodorini (12 quarti), rucola, mozzarella.',
          en: '🇮🇹 **Italiana Crepe**: 3 cherry tomatoes (12 quarters), rocket, mozzarella.',
          es: '🇮🇹 **Crepe Italiana**: 3 tomatitos (12 cuartos), rúcula, mozzarella.',
          fr: '🇮🇹 **Crêpe Italiana**: 3 tomates cerises (12 quartiers), roquette, mozzarella.'
        }
      }
    },
    // === WAFFLE ===
    waffle: {
      preparazione: {
        keywords: ['waffle', 'pastella waffle', 'dose waffle', 'ml waffle', 'power waffle', '177'],
        category: 'waffle',
        params: { pastella: 177, power: 3, cottura: '3-4 min' },
        response: {
          it: '🧇 **Waffle**: 177ml pastella, Power 3, cottura 3-4 min.',
          en: '🧇 **Waffle**: 177ml batter, Power 3, cooking 3-4 min.',
          es: '🧇 **Waffle**: 177ml masa, Power 3, cocción 3-4 min.',
          fr: '🧇 **Gaufre**: 177ml pâte, Power 3, cuisson 3-4 min.'
        }
      }
    },
    // === CAFFÈ ===
    caffe: {
      espresso: {
        keywords: ['espresso', 'caffè', 'temperatura acqua', 'pressione bar', 'estrazione', '88', '92'],
        category: 'caffe',
        params: { temperatura: { min: 88, max: 92 }, pressione: 9, estrazione: '25-30 sec', dose: '7-9g' },
        response: {
          it: '☕ **Espresso**: acqua 88-92°C, 9 bar, estrazione 25-30 sec, dose 7-9g.',
          en: '☕ **Espresso**: water 88-92°C, 9 bar, extraction 25-30 sec, dose 7-9g.',
          es: '☕ **Espresso**: agua 88-92°C, 9 bar, extracción 25-30 seg, dosis 7-9g.',
          fr: '☕ **Espresso**: eau 88-92°C, 9 bar, extraction 25-30 sec, dose 7-9g.'
        }
      },
      cappuccino: {
        keywords: ['cappuccino', 'latte montato', 'schiuma', 'microfoam', 'temperatura latte', '65'],
        category: 'caffe',
        params: { temperaturaLatte: 65, schiuma: 'microfoam' },
        response: {
          it: '☕ **Cappuccino**: latte montato a ~65°C per microfoam perfetta.',
          en: '☕ **Cappuccino**: milk steamed to ~65°C for perfect microfoam.',
          es: '☕ **Cappuccino**: leche a ~65°C para microespuma perfecta.',
          fr: '☕ **Cappuccino**: lait moussé à ~65°C pour une microfoam parfaite.'
        }
      }
    },
    // === SLITTI ===
    slitti: {
      brand: {
        keywords: ['slitti', 'cioccolato slitti', 'fondazione slitti', '1969'],
        category: 'slitti',
        params: { fondazione: 1969, origine: 'Torrefazione' },
        response: {
          it: '🍫 **Slitti**: fondata nel 1969 come torrefazione, oggi cioccolato artigianale.',
          en: '🍫 **Slitti**: founded in 1969 as a roaster, now artisan chocolate.',
          es: '🍫 **Slitti**: fundada en 1969, hoy chocolate artesanal.',
          fr: '🍫 **Slitti**: fondée en 1969, aujourd\'hui chocolat artisanal.'
        }
      },
      conservazione: {
        keywords: ['temperatura cioccolato', 'conservazione cioccolato', '16', '18'],
        category: 'slitti',
        params: { temperatura: { min: 16, max: 18 } },
        response: {
          it: '🍫 Conserva cioccolato Slitti a 16-18°C in luogo fresco e asciutto.',
          en: '🍫 Store Slitti chocolate at 16-18°C in a cool, dry place.',
          es: '🍫 Conserva chocolate Slitti a 16-18°C en lugar fresco y seco.',
          fr: '🍫 Conservez chocolat Slitti à 16-18°C dans un endroit frais et sec.'
        }
      },
      gianera: {
        keywords: ['gianera', 'spalmabile', 'nocciole', '57'],
        category: 'slitti',
        params: { nocciole: 57 },
        response: {
          it: '🍫 **Gianera**: spalmabile con 57% di nocciole.',
          en: '🍫 **Gianera**: spread with 57% hazelnuts.',
          es: '🍫 **Gianera**: crema con 57% de avellanas.',
          fr: '🍫 **Gianera**: pâte à tartiner avec 57% de noisettes.'
        }
      }
    },
    // === FESTIVE ===
    festive: {
      churros: {
        keywords: ['churros', 'temperatura olio', 'frittura', '190'],
        category: 'festive',
        params: { temperaturaOlio: 190 },
        response: {
          it: '🥖 **Churros**: friggere a 190°C.',
          en: '🥖 **Churros**: fry at 190°C.',
          es: '🥖 **Churros**: freír a 190°C.',
          fr: '🥖 **Churros**: frire à 190°C.'
        }
      },
      mulled_wine: {
        keywords: ['mulled wine', 'vin brulé', 'vino caldo', '25', '30 min'],
        category: 'festive',
        params: { riscaldamento: '25-30 min', livello: 10 },
        response: {
          it: '🍷 **Mulled Wine**: riscaldare 25-30 min a livello 10.',
          en: '🍷 **Mulled Wine**: heat 25-30 min at level 10.',
          es: '🍷 **Vino caliente**: calentar 25-30 min a nivel 10.',
          fr: '🍷 **Vin chaud**: chauffer 25-30 min au niveau 10.'
        }
      },
      panettone: {
        keywords: ['panettone', 'conservazione panettone', '2-3 giorni'],
        category: 'festive',
        params: { shelfLifeAperto: '2-3 giorni' },
        response: {
          it: '🎄 **Panettone**: dopo apertura, consumare entro 2-3 giorni.',
          en: '🎄 **Panettone**: after opening, consume within 2-3 days.',
          es: '🎄 **Panettone**: después de abrir, consumir en 2-3 días.',
          fr: '🎄 **Panettone**: après ouverture, consommer sous 2-3 jours.'
        }
      }
    },
    // === FAQ ===
    faq: {
      help: {
        keywords: ['aiuto', 'help', 'come funziona', 'cosa fai', 'chi sei'],
        category: 'faq',
        params: {},
        response: {
          it: '👋 Sono **BERNY**, il tuo assistente Badiani! Posso aiutarti con prodotti, procedure, training e quiz.',
          en: '👋 I\'m **BERNY**, your Badiani assistant! I can help with products, procedures, training and quiz.',
          es: '👋 Soy **BERNY**, tu asistente Badiani! Puedo ayudarte con productos, procedimientos, training y quiz.',
          fr: '👋 Je suis **BERNY**, ton assistant Badiani! Je peux t\'aider avec produits, procédures, training et quiz.'
        }
      }
    }
  };

  // ============================================================
  // HELPER: Cerca nella KB strutturata per keywords
  // Ritorna { entry, category, key, score } o null
  // ============================================================
  window.BERNY_KNOWLEDGE_SEARCH = function(query, lang = 'it') {
    const kb = window.BERNY_KNOWLEDGE_STRUCTURED;
    if (!kb || !query) return null;

    const normalize = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const queryNorm = normalize(query);
    const queryWords = queryNorm.split(/\s+/).filter(w => w.length > 2);

    let bestMatch = null;
    let bestScore = 0;

    Object.entries(kb).forEach(([category, entries]) => {
      Object.entries(entries).forEach(([key, entry]) => {
        if (!entry.keywords) return;
        let score = 0;
        entry.keywords.forEach(kw => {
          const kwNorm = normalize(kw);
          if (queryNorm.includes(kwNorm)) score += 10;
          queryWords.forEach(word => {
            if (kwNorm.includes(word)) score += 3;
          });
        });
        if (score > bestScore) {
          bestScore = score;
          bestMatch = { entry, category, key, score };
        }
      });
    });

    return bestScore >= 3 ? bestMatch : null;
  };

  // ============================================================
  // HELPER: Ottieni risposta localizzata
  // ============================================================
  window.BERNY_GET_RESPONSE = function(entry, lang = 'it') {
    if (!entry || !entry.response) return null;
    if (typeof entry.response === 'string') return entry.response;
    return entry.response[lang] || entry.response['it'] || null;
  };

  // ============================================================
  // HELPER: Ottieni KB rilevante per categoria (context-aware prompting)
  // Ritorna stringa compatta con solo le entry rilevanti
  // ============================================================
  window.BERNY_GET_RELEVANT_KB = function(query, lang = 'it', maxEntries = 5) {
    const kb = window.BERNY_KNOWLEDGE_STRUCTURED;
    if (!kb || !query) return '';

    const normalize = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const queryNorm = normalize(query);
    const queryWords = queryNorm.split(/\s+/).filter(w => w.length > 2);

    const matches = [];

    Object.entries(kb).forEach(([category, entries]) => {
      Object.entries(entries).forEach(([key, entry]) => {
        if (!entry.keywords) return;
        let score = 0;
        entry.keywords.forEach(kw => {
          const kwNorm = normalize(kw);
          if (queryNorm.includes(kwNorm)) score += 10;
          queryWords.forEach(word => {
            if (kwNorm.includes(word)) score += 3;
          });
        });
        if (score >= 3) {
          const response = window.BERNY_GET_RESPONSE(entry, lang);
          const paramsStr = entry.params ? JSON.stringify(entry.params) : '';
          matches.push({ category, key, score, response, params: paramsStr });
        }
      });
    });

    // Ordina per score e prendi i top N
    matches.sort((a, b) => b.score - a.score);
    const top = matches.slice(0, maxEntries);

    if (top.length === 0) return '';

    // Costruisci stringa compatta
    let result = '📚 KNOWLEDGE BASE RILEVANTE:\n';
    top.forEach(m => {
      result += `[${m.category.toUpperCase()}] ${m.response}\n`;
      if (m.params && m.params !== '{}') {
        result += `  📊 Params: ${m.params}\n`;
      }
    });
    return result;
  };
})();
