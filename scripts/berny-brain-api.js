// FILE: scripts/berny-brain-api.js
// Integrazione Google Gemini via SDK Ufficiale + Quiz System (Embedded Data)

class BernyBrainAPI {
  constructor() {
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
    this.mode = (String(this.config.provider || '')).toLowerCase() === 'proxy' && this.config.proxyEndpoint
      ? 'proxy'
      : 'sdk';

    // SDK mode requires the user to provide their own key (via /apikey) and the SDK script to be present.
    this.apiKey = '';
    if (this.mode === 'sdk') {
      try { this.apiKey = String(localStorage.getItem('berny_api_key') || '').trim(); } catch { this.apiKey = ''; }
    }

    // Default model (only used for SDK mode)
    this.modelName = "gemini-2.0-flash-exp";
    this.history = [];
    this.genAI = null;
    this.model = null;
    
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
        { text: "Slitti: in che anno è stata fondata l'azienda come torrefazione di caffè?\nA) 1932\nB) 1969\nC) 1990\nD) 1993", answer: "B" },
        { text: "Pralina Slitti Irish Coffee: qual è la percentuale di alcol contenuta?\nA) 0.5%\nB) 0.9%\nC) 1.5%\nD) 2.1%", answer: "B" },
        { text: "Spalmabile Gianera: qual è la percentuale di nocciole dichiarata?\nA) 37%\nB) 51%\nC) 57%\nD) 65%", answer: "C" },
        { text: "Mulled wine (Vin Brulé): quanto tempo deve riscaldare al livello 10 prima del servizio?\nA) 10-15 min\nB) 15-20 min\nC) 25-30 min\nD) 45-60 min", answer: "C" }
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
        { text: "Waffle: how much batter corresponds to \"one entire scoopful\"?\nA) 120 ml\nB) 150 ml\nC) 177 ml\nD) 250 ml", answer: "C" }
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
        { text: "Waffle: ¿cuánta masa corresponde a \"one entire scoopful\"?\nA) 120 ml\nB) 150 ml\nC) 177 ml\nD) 250 ml", answer: "C" }
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
        { text: "Waffle : quel volume de pâte correspond à \"one entire scoopful\" ?\nA) 120 ml\nB) 150 ml\nC) 177 ml\nD) 250 ml", answer: "C" }
      ]
    };

    this.init();
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
  }

  // --- QUIZ LOGIC START ---

  detectLanguage(text) {
    const t = text.toLowerCase();
    
    // Italian
    if (/\b(domande|interrogami|sfida)\b/i.test(t)) return 'it';
    // English
    if (/\b(questions|challenge|ask me)\b/i.test(t)) return 'en';
    // Spanish
    if (/\b(cuestionario|preguntas|desafío|desafio)\b/i.test(t)) return 'es';
    // French
    if (/\b(défi|defi|interroge-moi)\b/i.test(t)) return 'fr';

    // Common words: test, quiz. Check UI lang or default to IT.
    if (/\b(test|quiz)\b/i.test(t)) {
        // Try to respect current UI language if ambiguous
        const uiLang = (window.BadianiI18n?.getLang?.() || 'it').toLowerCase();
        if (['it','en','es','fr'].includes(uiLang)) return uiLang;
        return 'it';
    }

    return null; 
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

  async processMessage(userMessage) {
    // 1. QUIZ INTERCEPTION
    if (this.quizState.active) {
        return this.handleQuizAnswer(userMessage);
    }

    const detectedLang = this.detectLanguage(userMessage);
    if (detectedLang) {
        return this.startQuiz(detectedLang);
    }

    // 2. STANDARD LLM LOGIC (proxy preferred)
    if (this.mode === 'proxy') {
      const endpoint = String(this.config.proxyEndpoint || '').trim();
      if (!endpoint) return "⚠️ Config proxy mancante. Imposta badianiBerny.config.v1.";

      // Notifica UI
      window.dispatchEvent(new CustomEvent('berny-typing-start'));

      try {
        const systemPrompt = this.buildSystemPrompt();
        const messages = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: String(userMessage ?? '') },
        ];

        const ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
        // Proxy calls may occasionally take longer (network + model latency).
        // A too-low timeout looks like a UI freeze.
        const timer = setTimeout(() => { try { ctrl?.abort(); } catch {} }, 25000);

        const r = await fetch(endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
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

        if (!r || !r.ok) {
          const t = await r.text().catch(() => '');
          return `❌ Proxy error ${r?.status || 0}: ${t}`;
        }
        const data = await r.json().catch(() => null);
        const text = String(data?.text || '').trim();
        return text || 'Mi sa che il proxy non mi ha risposto bene. Riprova tra poco.';
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
    if (!this.apiKey || this.apiKey.length < 10) return "⚠️ Scrivi '/apikey LA_TUA_CHIAVE' per attivarmi (oppure usa il proxy)!";
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
          const backupModel = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
          
          const systemPrompt = this.buildSystemPrompt();
          const result = await backupModel.generateContent(`${systemPrompt}\n\nUtente: ${userMessage}`);
          const response = await result.response;
          
          return response.text(); 
          
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

      ### 🍦 PROTOCOLLO "SECRET CHALLENGE" (Easter Egg)
      (NOTA: Il quiz è ora gestito direttamente dal codice, ma se l'utente chiede info generiche sul quiz, rispondi così:)
      Se l'utente chiede "come funziona il quiz" o simili:
      "Scrivi 'quiz' o 'sfida' per iniziare il test ufficiale e provare a vincere un gelato!"

      ### REGOLE DI TONO:
      Sii simpatico, leggermente sfacciato ma incoraggiante. Usa emoji gelato (🍦, 🍧, 🧊).

      IL TUO OBIETTIVO PRINCIPALE (se non è un quiz):
      Dare risposte "flash" (max 2 frasi) che invitano l'utente ad aprire la scheda tecnica.
      
      REGOLE DI RISPOSTA (Standard):
      1. Sii brevissimo. Riassumi i punti chiave.
      2. NON fare elenchi puntati lunghi.
      3. Chiudi SEMPRE invitando l'utente ad aprire la scheda per i dettagli (usa la lingua dell'utente).
      4. Usa emoji ma non esagerare.

      REGOLE LINK SCHEDE:
      Se la tua risposta riguarda uno di questi argomenti, AGGIUNGI ALLA FINE del messaggio il tag corrispondente (invisibile all'utente).
      IMPORTANTE: Aggiungi sempre "?q=PAROLA_CHIAVE" per aprire la scheda specifica (es. buontalenti, pistacchio, waffle).

      - Gelato/Gusti -> [[LINK:gelato-lab.html?q=PAROLA_CHIAVE]]
      - Caffè/Bar -> [[LINK:caffe.html?q=PAROLA_CHIAVE]]
      - Crepes/Waffle -> [[LINK:sweet-treats.html?q=PAROLA_CHIAVE]]
      - Churros/Festive -> [[LINK:festive.html?q=PAROLA_CHIAVE]]
      - Storia/Azienda -> [[LINK:story-orbit.html?q=PAROLA_CHIAVE]]
      - Procedure/Operazioni -> [[LINK:operations.html?q=PAROLA_CHIAVE]]

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
          // Faster streaming so longer replies don't look like they "freeze" mid-sentence.
          const chunkSize = 4;
          let i = 0;
          const tick = () => {
            const c = text.slice(i, i + chunkSize);
            if (c) {
              try { onChunk(c); } catch {}
              i += chunkSize;
              window.setTimeout(tick, 15);
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
