// FILE: scripts/berny-nlp.js
// Localized knowledge selector for BERNY (no bundler, vanilla JS).
// - Reads the UI language from `window.i18n.getCurrentLanguage()` when available.
// - Falls back to Italian.
// - Emits no UI changes; it only provides data.

(() => {
  if (window.BernyNLP || window.bernyNLP) {
    return;
  }

  const safeLang = () => {
    try {
      const lang = window.i18n?.getCurrentLanguage?.();
      if (lang === 'en' || lang === 'es' || lang === 'fr' || lang === 'it') return lang;
    } catch {}
    try {
      const doc = String(document.documentElement.lang || '').trim().toLowerCase();
      if (doc === 'en' || doc === 'es' || doc === 'fr' || doc === 'it') return doc;
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

  class BernyNLP {
    constructor() {
      this.version = '1.0.0';
      this.knowledgeBase = this.loadBadianiKnowledge();

      // Refresh localized KB on language changes.
      window.addEventListener('i18nUpdated', () => {
        try {
          this.knowledgeBase = this.loadBadianiKnowledge();
          // eslint-disable-next-line no-console
          console.log('🌍 BERNY knowledge updated to:', safeLang());
        } catch {}
      });
    }

    getLocalizedKnowledge() {
      const lang = safeLang();

      const baseIt = window.BERNY_KNOWLEDGE || {};
      const baseCones = baseIt?.products?.coni || {
        gusti: { piccolo: 2, medio: 3, grande: 4 },
        grammi: { piccolo: 80, medio: 120, grande: 180 },
      };

      const knowledge = {
        it: {
          // Use the global default if present.
          ...baseIt,
          // Ensure the legacy BernyBrain keys exist.
          products: {
            ...(baseIt.products || {}),
            coni: {
              ...(baseIt.products?.coni || {}),
              gusti: baseCones.gusti,
              grammi: baseCones.grammi,
            },
            buontalenti: {
              ...(baseIt.products?.buontalenti || {}),
              descrizione:
                baseIt.products?.buontalenti?.descrizione ||
                tr('assistant.kb.buontalenti.desc', null, 'Gelato storico fiorentino dal 1932'),
              ingredienti:
                baseIt.products?.buontalenti?.ingredienti ||
                ['crema fresca', 'tuorli', 'zucchero', 'vaniglia Bourbon del Madagascar'],
            },
          },
          procedures: {
            // Strings used by the existing BernyBrain local answers
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
            // NLP-rich entries (optional)
            nlp: {
              apertura: baseIt?.procedures?.apertura || null,
            },
          },
          training: {
            storyOrbit: tr('menu.link.storyOrbit', null, 'Story Orbit'),
            operations: tr('menu.link.operations', null, 'Operations & Setup'),
            gelatoLab: tr('menu.link.gelatoLab', null, 'Gelato Lab'),
          },
        },

        en: {
          products: {
            coni: {
              gusti: baseCones.gusti,
              grammi: baseCones.grammi,
              keywords: ['cones', 'cone', 'ice cream cone', 'flavors', 'grams'],
              response:
                'Badiani Cones 🍦:\n' +
                '• Small: 2 flavors, 80g (€3.50)\n' +
                '• Medium: 3 flavors, 120g (€4.50)\n' +
                '• Large: 4 flavors, 180g (€5.50)',
            },
            buontalenti: {
              descrizione: 'Our historical gelato since 1932',
              ingredienti: ['fresh cream', 'egg yolks', 'sugar', 'Madagascar Bourbon vanilla'],
              keywords: ['buontalenti', 'historical gelato'],
              response:
                "**Buontalenti** is our historical gelato since 1932! 🍦✨\n\n" +
                'Created in 1559 by Bernardo Buontalenti for the Medici, made with fresh cream, egg yolks, sugar and Madagascar Bourbon vanilla. ' +
                'Served at -14°C for perfect creaminess!',
            },
          },
          procedures: {
            apertura: 'Opening: temperature check, cleaning displays, POS on, supplies check.',
            servizio: 'Service: greet, explain flavors, suggest pairings and upsells.',
            chiusura: 'Closing: sanitize surfaces, cover gelato, cash check.',
            nlp: {
              apertura: {
                keywords: ['opening', 'open store', 'setup', 'morning'],
                steps: [
                  '🌡️ Check gelato temperature (-14°C ±1°)',
                  '🧼 Clean displays and surfaces',
                  '💳 Turn on POS and check connection',
                  '📋 Check supplies (cones, cups, toppings)',
                  '👔 Wear uniform and badge',
                  '😊 Ready smile!',
                ],
                response:
                  '**Store opening procedure** 🏪\n\n{steps}\n\n✅ Full details in **Operations & Setup** module!',
              },
            },
          },
          faq: {
            help: {
              keywords: ['help', 'how does it work', 'what do you do'],
              response:
                "👋 Hi! I'm BERNY, your Badiani assistant!\n\n" +
                'I can help you with:\n' +
                '• 📦 Product info (cones, flavors, prices)\n' +
                '• 📋 Operating procedures\n' +
                '• 📚 Training modules\n' +
                '• ⭐ Stars and quiz system\n\n' +
                'Ask me anything!',
            },
            greeting: {
              keywords: ['hi', 'hello', 'hey', 'good morning'],
              responses: [
                'Hi! 👋 How can I help you today?',
                'Hey! 😊 Tell me everything!',
                'Good morning! ☀️ Ready to learn?',
                'Hello! 🍦 What do you want to know?',
              ],
            },
          },
          training: {
            storyOrbit: 'Story Orbit',
            operations: 'Operations & Setup',
            gelatoLab: 'Gelato Lab',
          },
        },

        es: {
          products: {
            coni: {
              gusti: baseCones.gusti,
              grammi: baseCones.grammi,
              keywords: ['conos', 'cono', 'helado cono', 'sabores', 'gramos'],
              response:
                'Conos Badiani 🍦:\n' +
                '• Pequeño: 2 sabores, 80g (€3.50)\n' +
                '• Mediano: 3 sabores, 120g (€4.50)\n' +
                '• Grande: 4 sabores, 180g (€5.50)',
            },
            buontalenti: {
              descrizione: 'Nuestro helado histórico desde 1932',
              ingredienti: ['crema fresca', 'yemas de huevo', 'azúcar', 'vainilla Bourbon de Madagascar'],
              keywords: ['buontalenti', 'helado histórico'],
              response:
                "**Buontalenti** es nuestro helado histórico desde 1932! 🍦✨\n\n" +
                'Creado en 1559 por Bernardo Buontalenti para los Medici, hecho con crema fresca, yemas de huevo, azúcar y vainilla Bourbon de Madagascar. ' +
                '¡Servido a -14°C para cremosidad perfecta!',
            },
          },
          procedures: {
            apertura: 'Apertura: verificar temperatura, limpiar vitrinas, encender POS, revisar suministros.',
            servizio: 'Servicio: saludar, explicar sabores, sugerir combinaciones y upselling.',
            chiusura: 'Cierre: sanificar, cubrir el gelato, control de caja.',
            nlp: {
              apertura: {
                keywords: ['apertura', 'abrir tienda', 'configuración', 'mañana'],
                steps: [
                  '🌡️ Verificar temperatura helado (-14°C ±1°)',
                  '🧼 Limpiar vitrinas y superficies',
                  '💳 Encender POS y verificar conexión',
                  '📋 Verificar suministros (conos, copas, toppings)',
                  '👔 Ponerse uniforme y placa',
                  '😊 ¡Sonrisa lista!',
                ],
                response:
                  '**Procedimiento apertura tienda** 🏪\n\n{steps}\n\n✅ ¡Detalles completos en módulo **Operations & Setup**!',
              },
            },
          },
          faq: {
            help: {
              keywords: ['ayuda', 'cómo funciona', 'qué haces'],
              response:
                '👋 ¡Hola! ¡Soy BERNY, tu asistente Badiani!\n\n' +
                'Puedo ayudarte con:\n' +
                '• 📦 Info productos (conos, sabores, precios)\n' +
                '• 📋 Procedimientos operativos\n' +
                '• 📚 Módulos training\n' +
                '• ⭐ Sistema de estrellas y quiz\n\n' +
                '¡Pregúntame lo que quieras!',
            },
            greeting: {
              keywords: ['hola', 'buenos días', 'hey'],
              responses: [
                '¡Hola! 👋 ¿Cómo puedo ayudarte hoy?',
                '¡Hey! 😊 ¡Cuéntame todo!',
                '¡Buenos días! ☀️ ¿Listo para aprender?',
                '¡Hola! 🍦 ¿Qué quieres saber?',
              ],
            },
          },
          training: {
            storyOrbit: 'Story Orbit',
            operations: 'Operations & Setup',
            gelatoLab: 'Gelato Lab',
          },
        },

        fr: {
          products: {
            coni: {
              gusti: baseCones.gusti,
              grammi: baseCones.grammi,
              keywords: ['cornets', 'cornet', 'glace cornet', 'parfums', 'grammes'],
              response:
                'Cornets Badiani 🍦:\n' +
                '• Petit: 2 parfums, 80g (€3.50)\n' +
                '• Moyen: 3 parfums, 120g (€4.50)\n' +
                '• Grand: 4 parfums, 180g (€5.50)',
            },
            buontalenti: {
              descrizione: 'Notre glace historique depuis 1932',
              ingredienti: ['crème fraîche', "jaunes d'œufs", 'sucre', 'vanille Bourbon de Madagascar'],
              keywords: ['buontalenti', 'glace historique'],
              response:
                "**Buontalenti** est notre glace historique depuis 1932! 🍦✨\n\n" +
                "Créée en 1559 par Bernardo Buontalenti pour les Médicis, faite avec crème fraîche, jaunes d'œufs, sucre et vanille Bourbon de Madagascar. " +
                "Servie à -14°C pour une onctuosité parfaite!",
            },
          },
          procedures: {
            apertura: "Ouverture : vérifier la température, nettoyer vitrines, allumer le POS, vérifier les stocks.",
            servizio: "Service : accueil, présentation parfums, suggestions et upsell.",
            chiusura: 'Fermeture : nettoyage/sanification, couvrir les bacs, contrôle caisse.',
            nlp: {
              apertura: {
                keywords: ['ouverture', 'ouvrir boutique', 'configuration', 'matin'],
                steps: [
                  '🌡️ Vérifier température glace (-14°C ±1°)',
                  '🧼 Nettoyer vitrines et surfaces',
                  '💳 Allumer TPE et vérifier connexion',
                  '📋 Vérifier fournitures (cornets, coupes, toppings)',
                  '👔 Porter uniforme et badge',
                  '😊 Sourire prêt!',
                ],
                response:
                  '**Procédure ouverture boutique** 🏪\n\n{steps}\n\n✅ Détails complets dans module **Operations & Setup**!',
              },
            },
          },
          faq: {
            help: {
              keywords: ['aide', 'comment ça marche', 'que fais-tu'],
              response:
                '👋 Bonjour! Je suis BERNY, votre assistant Badiani!\n\n' +
                'Je peux vous aider avec:\n' +
                '• 📦 Info produits (cornets, parfums, prix)\n' +
                '• 📋 Procédures opérationnelles\n' +
                '• 📚 Modules training\n' +
                "• ⭐ Système d'étoiles et quiz\n\n" +
                'Demandez-moi n\'importe quoi!',
            },
            greeting: {
              keywords: ['bonjour', 'salut', 'hey'],
              responses: [
                "Bonjour! 👋 Comment puis-je vous aider aujourd'hui?",
                'Hey! 😊 Dites-moi tout!',
                'Bonjour! ☀️ Prêt à apprendre?',
                'Salut! 🍦 Que voulez-vous savoir?',
              ],
            },
          },
          training: {
            storyOrbit: 'Story Orbit',
            operations: 'Operations & Setup',
            gelatoLab: 'Gelato Lab',
          },
        },
      };

      return knowledge[lang] || knowledge.it;
    }

    loadBadianiKnowledge() {
      return this.getLocalizedKnowledge();
    }
  }

  window.BernyNLP = BernyNLP;
  window.bernyNLP = new BernyNLP();
})();
