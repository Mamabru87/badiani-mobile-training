/* Badiani Training Orbit – i18n Manager (enhancements + dynamic helpers)
   - Complements existing scripts/i18n.js (BadianiI18n) without breaking it.
   - Adds: pluralization, relative time formatting, number/date formatters,
     and a small extra translation bundle for cockpit/settings-facing UI.

   Load AFTER scripts/i18n.js (both can coexist).
*/

(() => {
  'use strict';

  const LEGACY_KEY = 'badianiUILang.v1';
  const ALT_KEY = 'user-language';
  const SUPPORTED = ['it', 'en', 'es', 'fr'];
  const FALLBACK = 'it';

  const normalizeLang = (value) => {
    const v = String(value || '').trim().toLowerCase();
    if (SUPPORTED.includes(v)) return v;
    if (v.startsWith('en')) return 'en';
    if (v.startsWith('es')) return 'es';
    if (v.startsWith('fr')) return 'fr';
    if (v.startsWith('it')) return 'it';
    return '';
  };

  const safeGet = (k) => {
    try { return localStorage.getItem(k); } catch { return null; }
  };

  const safeSet = (k, v) => {
    try { localStorage.setItem(k, v); } catch {}
  };

  const interpolate = (raw, vars) => {
    if (raw == null) return '';
    let out = String(raw);
    if (!vars) return out;

    // Support both {{var}} (existing i18n.js) and {var} (new snippets)
    Object.keys(vars).forEach((k) => {
      const val = vars[k];
      const s = (val == null) ? '' : String(val);
      out = out.replaceAll(`{{${k}}}`, s);
      out = out.replaceAll(`{${k}}`, s);
    });

    return out;
  };

  class I18nManager {
    constructor() {
      this.currentLang = this.detectLanguage();
      this.fallbackLang = FALLBACK;
      this.translations = {};
      this.dateFormatters = {};
      this.numberFormatters = {};

      // Initialize asynchronously but safely.
      this.init();
    }

    dispatchUpdated() {
      try {
        window.dispatchEvent(
          new CustomEvent('i18nUpdated', {
            detail: { lang: this.getLang() },
          })
        );
      } catch {}
    }

    detectLanguage() {
      // 1) Prefer legacy key used by scripts/i18n.js
      const legacy = normalizeLang(safeGet(LEGACY_KEY));
      if (legacy) return legacy;

      // 2) Support alternative key requested by the new system
      const stored = normalizeLang(safeGet(ALT_KEY));
      if (stored) return stored;

      // 3) Try <html lang>
      try {
        const fromHtml = normalizeLang(document.documentElement.getAttribute('lang'));
        if (fromHtml) return fromHtml;
      } catch {}

      // 4) Browser language
      try {
        const nav = normalizeLang(navigator.language || navigator.userLanguage);
        if (nav) return nav;
      } catch {}

      return FALLBACK;
    }

    async init() {
      // Load/merge translations
      await this.loadTranslations();

      // Initialize formatters
      this.initializeFormatters();

      // Apply initial translations via existing engine if present
      this.applyTranslations();

      // If the legacy runtime is NOT present on this page, expose a compatible shim
      // so the rest of the app (e.g. scripts/site.js) can keep using BadianiI18n.
      this.ensureCoreShim();

      // Setup language switcher hooks
      this.setupLanguageSwitcher();

      // Listen for dynamic updates
      this.setupDynamicListeners();

      // Keep formatters in sync with the site language changes
      this.bindLangChangeListener();

      // eslint-disable-next-line no-console
      console.log(`🌍 i18n manager ready: ${this.getLang()}`);
    }

    ensureCoreShim() {
      if (window.BadianiI18n) return;

      const self = this;
      window.BadianiI18n = {
        __isShim: true,
        dict: self.translations,
        getLang() {
          return self.getLang();
        },
        setLang(lang) {
          self.setLang(lang);
        },
        t(key, vars) {
          return self.t(key, vars);
        },
        applyTranslations(root) {
          return self.applyTranslations(root);
        },
      };
    }

    getLang() {
      // If the core i18n is present, trust it.
      const core = window.BadianiI18n;
      // IMPORTANT: when we created a shim, its getLang delegates back to this.getLang().
      // Avoid recursion by short-circuiting for shims.
      if (core && core.__isShim) {
        return this.currentLang || FALLBACK;
      }
      if (core && typeof core.getLang === 'function') {
        return normalizeLang(core.getLang()) || this.currentLang || FALLBACK;
      }
      return this.currentLang || FALLBACK;
    }

    setLang(lang) {
      const next = normalizeLang(lang) || FALLBACK;
      this.currentLang = next;
      safeSet(LEGACY_KEY, next);
      safeSet(ALT_KEY, next);

      // If the full legacy runtime is present, let it handle DOM translation and UI.
      // If we only have our shim, we do the translation ourselves.
      if (window.BadianiI18n && !window.BadianiI18n.__isShim && typeof window.BadianiI18n.setLang === 'function') {
        window.BadianiI18n.setLang(next);
      } else {
        try {
          document.documentElement.setAttribute('lang', next);
          document.documentElement.dataset.lang = next;
        } catch {}
        this.applyTranslations();
      }

      this.initializeFormatters();

      // Notify listeners that any dynamic UI may need rerendering.
      this.dispatchUpdated();
    }

    // Compatibility alias for the snippet API.
    setLanguage(lang) {
      this.setLang(lang);
      const next = this.getLang();
      try {
        // Optional toast (best-effort)
        const langNames = { it: 'Italiano', en: 'English', es: 'Español', fr: 'Français' };
        window.storageManager?.showNotification?.(`🌍 ${langNames[next] || next}`, 'success');
      } catch {}
    }

    // Compatibility alias for the snippet API.
    getCurrentLanguage() {
      return this.getLang();
    }

    // Compatibility alias for the snippet API.
    getSupportedLanguages() {
      return [...SUPPORTED];
    }

    // Future: RTL languages.
    isRTL() {
      return false;
    }

    async loadTranslations() {
      // Embedded bundle: focused on hub/cockpit/assistant + dynamic helpers.
      // This merges into BadianiI18n.dict when available.
      this.translations = {
        it: {
          // Language UI (used by dropdown / pills)
          'lang.label': 'Lingua',
          'lang.it': 'Italiano',
          'lang.en': 'English',
          'lang.es': 'Español',
          'lang.fr': 'Français',
          'lang.loading': 'Aggiornamento lingua in corso...',

          // Navigation
          'nav.menu': 'Menu',
          'nav.profileLabel': 'Profilo',
          'nav.homeAria': 'Torna alla home Badiani',
          'nav.profileAria': 'Profilo utente',

          // Hub/Hero
          'hub.badge': 'Training Orbit',
          'hub.eyebrow': 'Hub operativo · aggiornato ogni giorno',
          'hub.title': 'Playbook operativo Badiani 1932',
          'hub.lede': 'Tradizione fiorentina, rituali di boutique e procedure digitalizzate in un\'unica plancia: consulta, ripassa e chiudi i quiz per riscattare gelati reali.',
          'hub.openCategories': 'Apri categorie',
          'hub.rules': 'Regolamento',

          // Cockpit Dashboard
          'cockpit.eyebrow': 'Orbit cockpit',
          'cockpit.title': 'Panoramica live',
          'cockpit.sub': 'Scorri le schede e resta sempre sul pezzo.',
          'cockpit.indicatorsAria': 'Indicatori panoramica',

          // Daily Card
          'cockpit.daily.eyebrow': 'Training',
          'cockpit.daily.badge': 'Live',
          'cockpit.daily.title': 'Training quotidiano',
          'cockpit.daily.loading': 'Caricamento domanda del giorno...',
          'cockpit.daily.hint': 'Apri una scheda, rispondi e guadagna stelline extra.',

          // Performance Card
          'cockpit.perf.eyebrow': 'Oggi',
          'cockpit.perf.badge': 'Aggiornato',
          'cockpit.perf.title': 'Performance oggi',

          // Stats labels
          'cockpit.stat.stars': 'Stelle',
          'cockpit.stat.bonusPoints': 'Punti Bonus',
          'cockpit.stat.correct': 'Corrette',
          'cockpit.stat.wrong': 'Sbagliate',
          'cockpit.stat.gelato': 'Gelati',
          'cockpit.stat.gelatoTotal': 'Gelati totali',

          // Totals Card
          'cockpit.totals.title': 'Totali',
          'cockpit.totals.eyebrow': 'Lifetime',

          // Wrong Answers Card
          'cockpit.wrong.title': 'Da rivedere',
          'cockpit.wrong.subtitle': 'domande sbagliate',
          'cockpit.wrong.empty': 'Nessun errore! Sei un campione! 🎉',
          'cockpit.wrong.viewAll': 'Vedi tutte',

          // History Card
          'cockpit.history.title': 'Cronologia',
          'cockpit.history.subtitle': 'giorni di training',
          'cockpit.history.empty': 'Inizia oggi il tuo percorso!',

          // Profile Card
          'cockpit.profile.title': 'Il tuo profilo',
          'cockpit.profile.level': 'Livello',
          'cockpit.profile.progress': 'Completamento',
          'cockpit.profile.edit': 'Modifica profilo',

          // Menu Categories
          'menu.cluster.orbit': 'Orbit',
          'menu.cluster.beverage': 'Beverage & Treats',
          'menu.cluster.gelato': 'Gelato & Speciali',

          // Menu Links
          'menu.link.hub': 'Hub',
          'menu.link.storyOrbit': 'Story Orbit',
          'menu.link.operations': 'Operations & Setup',
          'menu.link.caffe': 'Bar & Drinks',
          'menu.link.sweetTreats': 'Sweet Treat Atelier',
          'menu.link.pastries': 'Pastry Lab',
          'menu.link.slittiYoyo': 'Slitti & Yo-Yo',
          'menu.link.gelatoLab': 'Gelato Lab',
          'menu.link.festive': 'Festive & Churros',

          // Drawer
          'drawer.categories': 'Categorie',
          'drawer.close': 'Chiudi menu',

          // Moods
          'mood.1': 'Fai brillare Badiani oggi!',
          'mood.2': 'Brilla: i dettagli fanno la differenza.',
          'mood.3': 'Ogni gelato racconta la nostra storia.',
          'mood.4': 'L\'eccellenza è nel sorriso e nel gelato.',
          'mood.5': 'Tradizione e innovazione, ogni giorno.',

          // BERNY Assistant
          'assistant.title': 'Parla con BERNY',
          'assistant.eyebrow': 'Assistente',
          'assistant.placeholder': 'Es. Coni: quanti gusti e quanti grammi?',
          'assistant.inputPlaceholder': 'Chiedi a BERNY…',
          'assistant.aria': 'Chat con BERNY',
          'assistant.status': 'Sempre disponibile',

          // Loading & Errors
          'loading.message': 'Caricamento in corso...',
          'error.generic': 'Oops! Qualcosa è andato storto.',
          'error.network': 'Errore di connessione. Riprova.',
          'error.storage': 'Spazio storage insufficiente.',

          // Dynamic Content Templates
          'dynamic.wrongAnswer': 'Domanda sbagliata:',
          'dynamic.correctAnswer': 'Risposta corretta:',
          'dynamic.yourAnswer': 'La tua risposta:',
          'dynamic.module': 'Modulo:',
          'dynamic.noErrors': 'Nessun errore! 🎉',
          'dynamic.achievement': 'Achievement sbloccato!',
          'dynamic.milestone': 'Traguardo raggiunto!',

          // Time formatting
          'time.justNow': 'Proprio ora',
          'time.minutesAgo': '{n} minuti fa',
          'time.hoursAgo': '{n} ore fa',
          'time.daysAgo': '{n} giorni fa',
          'time.today': 'Oggi',
          'time.yesterday': 'Ieri',

          // Plurals
          'plural.stars': '{n} stella | {n} stelle',
          'plural.gelato': '{n} gelato | {n} gelati',
          'plural.days': '{n} giorno | {n} giorni',
          'plural.questions': '{n} domanda | {n} domande',

          // Notifications
          'notif.profileSaved': '✅ Profilo salvato!',
          'notif.dataExported': '💾 Backup scaricato!',
          'notif.dataImported': '✅ Dati importati con successo!',
          'notif.dataReset': '🗑️ Tutti i dati sono stati cancellati.',
          'notif.achievementUnlocked': '🏆 Achievement sbloccato: {achievement}!',
          'notif.dailyCompleted': '⭐ Domanda giornaliera completata!',
          'notif.moduleCompleted': '📚 Modulo completato: {module}!',
        },

        en: {
          // Language UI
          'lang.label': 'Language',
          'lang.it': 'Italiano',
          'lang.en': 'English',
          'lang.es': 'Español',
          'lang.fr': 'Français',
          'lang.loading': 'Updating language…',

          // Navigation
          'nav.menu': 'Menu',
          'nav.profileLabel': 'Profile',
          'nav.homeAria': 'Back to Badiani home',
          'nav.profileAria': 'User profile',

          // Hub/Hero
          'hub.badge': 'Training Orbit',
          'hub.eyebrow': 'Operations hub · updated daily',
          'hub.title': 'Badiani 1932 Operations Playbook',
          'hub.lede': 'Florentine tradition, boutique rituals and digitized procedures in one dashboard: consult, review and complete quizzes to redeem real gelato.',
          'hub.openCategories': 'Open categories',
          'hub.rules': 'Rules',

          // Cockpit Dashboard
          'cockpit.eyebrow': 'Orbit cockpit',
          'cockpit.title': 'Live overview',
          'cockpit.sub': 'Scroll through cards and stay on top.',
          'cockpit.indicatorsAria': 'Overview indicators',

          // Daily Card
          'cockpit.daily.eyebrow': 'Training',
          'cockpit.daily.badge': 'Live',
          'cockpit.daily.title': 'Daily training',
          'cockpit.daily.loading': 'Loading question of the day...',
          'cockpit.daily.hint': 'Open a card, answer and earn extra stars.',

          // Performance Card
          'cockpit.perf.eyebrow': 'Today',
          'cockpit.perf.badge': 'Updated',
          'cockpit.perf.title': 'Today\'s performance',

          // Stats labels
          'cockpit.stat.stars': 'Stars',
          'cockpit.stat.bonusPoints': 'Bonus Points',
          'cockpit.stat.correct': 'Correct',
          'cockpit.stat.wrong': 'Wrong',
          'cockpit.stat.gelato': 'Gelato',
          'cockpit.stat.gelatoTotal': 'Total gelato',

          // Totals Card
          'cockpit.totals.title': 'Totals',
          'cockpit.totals.eyebrow': 'Lifetime',

          // Wrong Answers Card
          'cockpit.wrong.title': 'To review',
          'cockpit.wrong.subtitle': 'wrong answers',
          'cockpit.wrong.empty': 'No mistakes! You\'re a champion! 🎉',
          'cockpit.wrong.viewAll': 'View all',

          // History Card
          'cockpit.history.title': 'History',
          'cockpit.history.subtitle': 'days of training',
          'cockpit.history.empty': 'Start your journey today!',

          // Profile Card
          'cockpit.profile.title': 'Your profile',
          'cockpit.profile.level': 'Level',
          'cockpit.profile.progress': 'Completion',
          'cockpit.profile.edit': 'Edit profile',

          // Menu Categories
          'menu.cluster.orbit': 'Orbit',
          'menu.cluster.beverage': 'Beverage & Treats',
          'menu.cluster.gelato': 'Gelato & Specials',

          // Menu Links
          'menu.link.hub': 'Hub',
          'menu.link.storyOrbit': 'Story Orbit',
          'menu.link.operations': 'Operations & Setup',
          'menu.link.caffe': 'Bar & Drinks',
          'menu.link.sweetTreats': 'Sweet Treat Atelier',
          'menu.link.pastries': 'Pastry Lab',
          'menu.link.slittiYoyo': 'Slitti & Yo-Yo',
          'menu.link.gelatoLab': 'Gelato Lab',
          'menu.link.festive': 'Festive & Churros',

          // Drawer
          'drawer.categories': 'Categories',
          'drawer.close': 'Close menu',

          // Moods
          'mood.1': 'Make Badiani shine today!',
          'mood.2': 'Shine: details make the difference.',
          'mood.3': 'Every gelato tells our story.',
          'mood.4': 'Excellence is in the smile and the gelato.',
          'mood.5': 'Tradition and innovation, every day.',

          // BERNY Assistant
          'assistant.title': 'Chat with BERNY',
          'assistant.eyebrow': 'Assistant',
          'assistant.placeholder': 'E.g. Cones: how many flavors and grams?',
          'assistant.inputPlaceholder': 'Ask BERNY…',
          'assistant.aria': 'Chat with BERNY',
          'assistant.status': 'Always available',

          // Loading & Errors
          'loading.message': 'Loading...',
          'error.generic': 'Oops! Something went wrong.',
          'error.network': 'Connection error. Try again.',
          'error.storage': 'Insufficient storage space.',

          // Dynamic Content Templates
          'dynamic.wrongAnswer': 'Wrong answer:',
          'dynamic.correctAnswer': 'Correct answer:',
          'dynamic.yourAnswer': 'Your answer:',
          'dynamic.module': 'Module:',
          'dynamic.noErrors': 'No errors! 🎉',
          'dynamic.achievement': 'Achievement unlocked!',
          'dynamic.milestone': 'Milestone reached!',

          // Time formatting
          'time.justNow': 'Just now',
          'time.minutesAgo': '{n} minutes ago',
          'time.hoursAgo': '{n} hours ago',
          'time.daysAgo': '{n} days ago',
          'time.today': 'Today',
          'time.yesterday': 'Yesterday',

          // Plurals
          'plural.stars': '{n} star | {n} stars',
          'plural.gelato': '{n} gelato | {n} gelatos',
          'plural.days': '{n} day | {n} days',
          'plural.questions': '{n} question | {n} questions',

          // Notifications
          'notif.profileSaved': '✅ Profile saved!',
          'notif.dataExported': '💾 Backup downloaded!',
          'notif.dataImported': '✅ Data imported successfully!',
          'notif.dataReset': '🗑️ All data has been deleted.',
          'notif.achievementUnlocked': '🏆 Achievement unlocked: {achievement}!',
          'notif.dailyCompleted': '⭐ Daily question completed!',
          'notif.moduleCompleted': '📚 Module completed: {module}!',
        },

        es: {
          // Language UI
          'lang.label': 'Idioma',
          'lang.it': 'Italiano',
          'lang.en': 'English',
          'lang.es': 'Español',
          'lang.fr': 'Français',
          'lang.loading': 'Actualizando idioma…',

          // Navigation
          'nav.menu': 'Menú',
          'nav.profileLabel': 'Perfil',
          'nav.homeAria': 'Volver al inicio de Badiani',
          'nav.profileAria': 'Perfil de usuario',

          // Hub/Hero
          'hub.badge': 'Training Orbit',
          'hub.eyebrow': 'Centro operativo · actualizado cada día',
          'hub.title': 'Manual operativo Badiani 1932',
          'hub.lede': 'Tradición florentina, rituales boutique y procedimientos digitalizados en un solo panel: consulta, repasa y completa cuestionarios para canjear helado real.',
          'hub.openCategories': 'Abrir categorías',
          'hub.rules': 'Reglas',

          // Cockpit Dashboard
          'cockpit.eyebrow': 'Orbit cockpit',
          'cockpit.title': 'Vista general en vivo',
          'cockpit.sub': 'Desplázate por las tarjetas y mantente al día.',
          'cockpit.indicatorsAria': 'Indicadores de vista general',

          // Daily Card
          'cockpit.daily.eyebrow': 'Training',
          'cockpit.daily.badge': 'En vivo',
          'cockpit.daily.title': 'Training diario',
          'cockpit.daily.loading': 'Cargando pregunta del día...',
          'cockpit.daily.hint': 'Abre una tarjeta, responde y gana estrellas extra.',

          // Performance Card
          'cockpit.perf.eyebrow': 'Hoy',
          'cockpit.perf.badge': 'Actualizado',
          'cockpit.perf.title': 'Rendimiento de hoy',

          // Stats labels
          'cockpit.stat.stars': 'Estrellas',
          'cockpit.stat.bonusPoints': 'Puntos bonus',
          'cockpit.stat.correct': 'Correctas',
          'cockpit.stat.wrong': 'Incorrectas',
          'cockpit.stat.gelato': 'Helados',
          'cockpit.stat.gelatoTotal': 'Helados totales',

          // Totals Card
          'cockpit.totals.title': 'Totales',
          'cockpit.totals.eyebrow': 'Acumulado',

          // Wrong Answers Card
          'cockpit.wrong.title': 'Para revisar',
          'cockpit.wrong.subtitle': 'respuestas incorrectas',
          'cockpit.wrong.empty': '¡Sin errores! ¡Eres un campeón! 🎉',
          'cockpit.wrong.viewAll': 'Ver todas',

          // History Card
          'cockpit.history.title': 'Historial',
          'cockpit.history.subtitle': 'días de training',
          'cockpit.history.empty': '¡Empieza tu viaje hoy!',

          // Profile Card
          'cockpit.profile.title': 'Tu perfil',
          'cockpit.profile.level': 'Nivel',
          'cockpit.profile.progress': 'Completado',
          'cockpit.profile.edit': 'Editar perfil',

          // Menu Categories
          'menu.cluster.orbit': 'Orbit',
          'menu.cluster.beverage': 'Bebidas y dulces',
          'menu.cluster.gelato': 'Gelato y especiales',

          // Menu Links
          'menu.link.hub': 'Hub',
          'menu.link.storyOrbit': 'Story Orbit',
          'menu.link.operations': 'Operaciones y configuración',
          'menu.link.caffe': 'Bar y bebidas',
          'menu.link.sweetTreats': 'Atelier de dulces',
          'menu.link.pastries': 'Laboratorio de pastelería',
          'menu.link.slittiYoyo': 'Slitti & Yo-Yo',
          'menu.link.gelatoLab': 'Laboratorio Gelato',
          'menu.link.festive': 'Festivos y churros',

          // Drawer
          'drawer.categories': 'Categorías',
          'drawer.close': 'Cerrar menú',

          // Moods
          'mood.1': '¡Haz brillar Badiani hoy!',
          'mood.2': 'Brilla: los detalles marcan la diferencia.',
          'mood.3': 'Cada helado cuenta nuestra historia.',
          'mood.4': 'La excelencia está en la sonrisa y el helado.',
          'mood.5': 'Tradición e innovación, cada día.',

          // BERNY Assistant
          'assistant.title': 'Habla con BERNY',
          'assistant.eyebrow': 'Asistente',
          'assistant.placeholder': 'Ej. Conos: ¿cuántos sabores y gramos?',
          'assistant.inputPlaceholder': 'Pregunta a BERNY…',
          'assistant.aria': 'Chat con BERNY',
          'assistant.status': 'Siempre disponible',

          // Loading & Errors
          'loading.message': 'Cargando...',
          'error.generic': '¡Vaya! Algo salió mal.',
          'error.network': 'Error de conexión. Inténtalo de nuevo.',
          'error.storage': 'Espacio de almacenamiento insuficiente.',

          // Dynamic Content Templates
          'dynamic.wrongAnswer': 'Respuesta incorrecta:',
          'dynamic.correctAnswer': 'Respuesta correcta:',
          'dynamic.yourAnswer': 'Tu respuesta:',
          'dynamic.module': 'Módulo:',
          'dynamic.noErrors': '¡Sin errores! 🎉',
          'dynamic.achievement': '¡Logro desbloqueado!',
          'dynamic.milestone': '¡Hito alcanzado!',

          // Time formatting
          'time.justNow': 'Ahora mismo',
          'time.minutesAgo': 'hace {n} minutos',
          'time.hoursAgo': 'hace {n} horas',
          'time.daysAgo': 'hace {n} días',
          'time.today': 'Hoy',
          'time.yesterday': 'Ayer',

          // Plurals
          'plural.stars': '{n} estrella | {n} estrellas',
          'plural.gelato': '{n} helado | {n} helados',
          'plural.days': '{n} día | {n} días',
          'plural.questions': '{n} pregunta | {n} preguntas',

          // Notifications
          'notif.profileSaved': '✅ ¡Perfil guardado!',
          'notif.dataExported': '💾 ¡Copia de seguridad descargada!',
          'notif.dataImported': '✅ ¡Datos importados correctamente!',
          'notif.dataReset': '🗑️ Se han eliminado todos los datos.',
          'notif.achievementUnlocked': '🏆 Logro desbloqueado: {achievement}!',
          'notif.dailyCompleted': '⭐ ¡Pregunta diaria completada!',
          'notif.moduleCompleted': '📚 Módulo completado: {module}!',
        },

        fr: {
          // Language UI
          'lang.label': 'Langue',
          'lang.it': 'Italiano',
          'lang.en': 'English',
          'lang.es': 'Español',
          'lang.fr': 'Français',
          'lang.loading': 'Mise à jour de la langue…',

          // Navigation
          'nav.menu': 'Menu',
          'nav.profileLabel': 'Profil',
          'nav.homeAria': 'Retour à l\'accueil Badiani',
          'nav.profileAria': 'Profil utilisateur',

          // Hub/Hero
          'hub.badge': 'Training Orbit',
          'hub.eyebrow': 'Hub opérationnel · mis à jour chaque jour',
          'hub.title': 'Playbook opérationnel Badiani 1932',
          'hub.lede': 'Tradition florentine, rituels boutique et procédures numérisées sur un seul tableau de bord : consulte, révise et termine les quiz pour gagner de vraies glaces.',
          'hub.openCategories': 'Ouvrir les catégories',
          'hub.rules': 'Règlement',

          // Cockpit Dashboard
          'cockpit.eyebrow': 'Orbit cockpit',
          'cockpit.title': 'Aperçu en direct',
          'cockpit.sub': 'Fais défiler les cartes et reste au top.',
          'cockpit.indicatorsAria': 'Indicateurs d\'aperçu',

          // Daily Card
          'cockpit.daily.eyebrow': 'Training',
          'cockpit.daily.badge': 'Live',
          'cockpit.daily.title': 'Training quotidien',
          'cockpit.daily.loading': 'Chargement de la question du jour…',
          'cockpit.daily.hint': 'Ouvre une carte, réponds et gagne des étoiles en plus.',

          // Performance Card
          'cockpit.perf.eyebrow': 'Aujourd\'hui',
          'cockpit.perf.badge': 'Mis à jour',
          'cockpit.perf.title': 'Performance du jour',

          // Stats labels
          'cockpit.stat.stars': 'Étoiles',
          'cockpit.stat.bonusPoints': 'Points bonus',
          'cockpit.stat.correct': 'Correctes',
          'cockpit.stat.wrong': 'Incorrectes',
          'cockpit.stat.gelato': 'Glaces',
          'cockpit.stat.gelatoTotal': 'Glaces totales',

          // Totals Card
          'cockpit.totals.title': 'Totaux',
          'cockpit.totals.eyebrow': 'Historique',

          // Wrong Answers Card
          'cockpit.wrong.title': 'À revoir',
          'cockpit.wrong.subtitle': 'réponses incorrectes',
          'cockpit.wrong.empty': 'Aucune erreur ! Tu es un champion ! 🎉',
          'cockpit.wrong.viewAll': 'Voir tout',

          // History Card
          'cockpit.history.title': 'Historique',
          'cockpit.history.subtitle': 'jours de training',
          'cockpit.history.empty': 'Commence ton parcours aujourd\'hui !',

          // Profile Card
          'cockpit.profile.title': 'Ton profil',
          'cockpit.profile.level': 'Niveau',
          'cockpit.profile.progress': 'Progression',
          'cockpit.profile.edit': 'Modifier le profil',

          // Menu Categories
          'menu.cluster.orbit': 'Orbit',
          'menu.cluster.beverage': 'Boissons & douceurs',
          'menu.cluster.gelato': 'Gelato & spéciaux',

          // Menu Links
          'menu.link.hub': 'Hub',
          'menu.link.storyOrbit': 'Story Orbit',
          'menu.link.operations': 'Opérations & mise en place',
          'menu.link.caffe': 'Bar & boissons',
          'menu.link.sweetTreats': 'Atelier Sweet Treat',
          'menu.link.pastries': 'Pastry Lab',
          'menu.link.slittiYoyo': 'Slitti & Yo-Yo',
          'menu.link.gelatoLab': 'Gelato Lab',
          'menu.link.festive': 'Festif & churros',

          // Drawer
          'drawer.categories': 'Catégories',
          'drawer.close': 'Fermer le menu',

          // Moods
          'mood.1': 'Fais briller Badiani aujourd\'hui !',
          'mood.2': 'Brille : les détails font la différence.',
          'mood.3': 'Chaque glace raconte notre histoire.',
          'mood.4': 'L\'excellence est dans le sourire et la glace.',
          'mood.5': 'Tradition et innovation, chaque jour.',

          // BERNY Assistant
          'assistant.title': 'Parle avec BERNY',
          'assistant.eyebrow': 'Assistant',
          'assistant.placeholder': 'Ex. Cornets : combien de parfums et de grammes ?',
          'assistant.inputPlaceholder': 'Demande à BERNY…',
          'assistant.aria': 'Chat avec BERNY',
          'assistant.status': 'Toujours disponible',

          // Loading & Errors
          'loading.message': 'Chargement…',
          'error.generic': 'Oups ! Quelque chose a mal tourné.',
          'error.network': 'Erreur de connexion. Réessaie.',
          'error.storage': 'Espace de stockage insuffisant.',

          // Dynamic Content Templates
          'dynamic.wrongAnswer': 'Réponse incorrecte :',
          'dynamic.correctAnswer': 'Bonne réponse :',
          'dynamic.yourAnswer': 'Ta réponse :',
          'dynamic.module': 'Module :',
          'dynamic.noErrors': 'Aucune erreur ! 🎉',
          'dynamic.achievement': 'Succès débloqué !',
          'dynamic.milestone': 'Objectif atteint !',

          // Time formatting
          'time.justNow': 'À l\'instant',
          'time.minutesAgo': 'il y a {n} minutes',
          'time.hoursAgo': 'il y a {n} heures',
          'time.daysAgo': 'il y a {n} jours',
          'time.today': 'Aujourd\'hui',
          'time.yesterday': 'Hier',

          // Plurals
          'plural.stars': '{n} étoile | {n} étoiles',
          'plural.gelato': '{n} glace | {n} glaces',
          'plural.days': '{n} jour | {n} jours',
          'plural.questions': '{n} question | {n} questions',

          // Notifications
          'notif.profileSaved': '✅ Profil enregistré !',
          'notif.dataExported': '💾 Sauvegarde téléchargée !',
          'notif.dataImported': '✅ Données importées avec succès !',
          'notif.dataReset': '🗑️ Toutes les données ont été supprimées.',
          'notif.achievementUnlocked': '🏆 Succès débloqué : {achievement} !',
          'notif.dailyCompleted': '⭐ Question du jour terminée !',
          'notif.moduleCompleted': '📚 Module terminé : {module} !',
        },
      };

      // Merge into core dict if available.
      if (window.BadianiI18n && window.BadianiI18n.dict) {
        const coreDict = window.BadianiI18n.dict;
        SUPPORTED.forEach((lang) => {
          if (!coreDict[lang]) coreDict[lang] = {};
          if (this.translations[lang]) {
            Object.assign(coreDict[lang], this.translations[lang]);
          }
        });
      }

      // If we are running without scripts/i18n.js, make sure the shim sees the full dict.
      if (window.BadianiI18n && window.BadianiI18n.__isShim) {
        window.BadianiI18n.dict = this.translations;
      }
    }

    initializeFormatters() {
      const lang = this.getLang();
      try {
        this.dateFormatters[lang] = {
          short: new Intl.DateTimeFormat(lang, { year: 'numeric', month: 'short', day: '2-digit' }),
          long: new Intl.DateTimeFormat(lang, { weekday: 'long', year: 'numeric', month: 'long', day: '2-digit' }),
        };
      } catch {
        this.dateFormatters[lang] = {
          short: { format: (d) => String(d) },
          long: { format: (d) => String(d) },
        };
      }

      try {
        this.numberFormatters[lang] = {
          int: new Intl.NumberFormat(lang, { maximumFractionDigits: 0 }),
          compact: new Intl.NumberFormat(lang, { notation: 'compact', maximumFractionDigits: 1 }),
        };
      } catch {
        this.numberFormatters[lang] = {
          int: { format: (n) => String(n) },
          compact: { format: (n) => String(n) },
        };
      }
    }

    t(key, vars) {
      const lang = this.getLang();
      const core = window.BadianiI18n;

      // Prefer direct dict access so we can interpolate {x} too.
      try {
        const table = (core && core.dict && core.dict[lang]) ? core.dict[lang] : null;
        const fallback = (core && core.dict && core.dict[this.fallbackLang]) ? core.dict[this.fallbackLang] : null;
        const raw = (table && table[key] != null) ? table[key] : ((fallback && fallback[key] != null) ? fallback[key] : key);
        return interpolate(raw, vars);
      } catch {
        if (core && typeof core.t === 'function') return core.t(key, vars);
        const raw = (this.translations[lang] && this.translations[lang][key] != null)
          ? this.translations[lang][key]
          : ((this.translations[this.fallbackLang] && this.translations[this.fallbackLang][key] != null)
            ? this.translations[this.fallbackLang][key]
            : key);
        return interpolate(raw, vars);
      }
    }

    plural(key, n) {
      const raw = this.t(key, { n });
      // Format: "singular | plural"
      const parts = raw.split('|').map((s) => s.trim()).filter(Boolean);
      if (parts.length === 0) return String(n);
      if (parts.length === 1) return interpolate(parts[0], { n });
      const chosen = (Number(n) === 1) ? parts[0] : parts[1];
      return interpolate(chosen, { n });
    }

    formatNumber(n, mode = 'int') {
      const lang = this.getLang();
      const formatter = this.numberFormatters[lang] && this.numberFormatters[lang][mode];
      try {
        return formatter.format(n);
      } catch {
        return String(n);
      }
    }

    formatDate(date, mode = 'short') {
      const d = (date instanceof Date) ? date : new Date(date);
      const lang = this.getLang();
      const formatter = this.dateFormatters[lang] && this.dateFormatters[lang][mode];
      try {
        return formatter.format(d);
      } catch {
        return d.toISOString();
      }
    }

    formatTimeAgo(date) {
      const d = (date instanceof Date) ? date : new Date(date);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      const diffHr = Math.floor(diffMs / 3600000);
      const diffDay = Math.floor(diffMs / 86400000);

      if (diffMs < 60 * 1000) return this.t('time.justNow');
      if (diffMin < 60) return this.t('time.minutesAgo', { n: diffMin });
      if (diffHr < 24) return this.t('time.hoursAgo', { n: diffHr });

      // Today / yesterday shortcuts
      try {
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const startOfYesterday = startOfToday - 86400000;
        const ts = d.getTime();
        if (ts >= startOfToday) return this.t('time.today');
        if (ts >= startOfYesterday) return this.t('time.yesterday');
      } catch {}

      return this.t('time.daysAgo', { n: diffDay });
    }

    // Compatibility alias for the snippet API.
    formatRelativeTime(date) {
      return this.formatTimeAgo(date);
    }

    applyTranslations(root = document) {
      if (window.BadianiI18n && typeof window.BadianiI18n.applyTranslations === 'function') {
        window.BadianiI18n.applyTranslations(root);
        return;
      }

      // Minimal fallback if core i18n is not present
      const scope = root instanceof Element || root instanceof Document ? root : document;
      scope.querySelectorAll?.('[data-i18n]').forEach((node) => {
        const key = node.getAttribute('data-i18n');
        if (!key) return;
        node.textContent = this.t(key);
      });
      scope.querySelectorAll?.('[data-i18n-html]').forEach((node) => {
        const key = node.getAttribute('data-i18n-html');
        if (!key) return;
        node.innerHTML = this.t(key);
      });
      scope.querySelectorAll?.('[data-i18n-attr]').forEach((node) => {
        const raw = node.getAttribute('data-i18n-attr');
        if (!raw) return;
        raw.split('|').map((s) => s.trim()).filter(Boolean).forEach((pair) => {
          const idx = pair.indexOf(':');
          if (idx <= 0) return;
          const attr = pair.slice(0, idx).trim();
          const key = pair.slice(idx + 1).trim();
          if (!attr || !key) return;
          try { node.setAttribute(attr, this.t(key)); } catch {}
        });
      });

      // Language UI (mirrors the legacy runtime behavior)
      const lang = this.getLang();
      scope.querySelectorAll?.('[data-lang-current]').forEach((el) => {
        el.textContent = this.t(`lang.${lang}`);
      });
      scope.querySelectorAll?.('[data-lang-option]').forEach((btn) => {
        const opt = normalizeLang(btn.getAttribute('data-lang-option'));
        const active = opt === lang;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-checked', active ? 'true' : 'false');
        btn.textContent = this.t(`lang.${opt || lang}`);
      });
      scope.querySelectorAll?.('[data-lang-label]').forEach((el) => {
        el.textContent = this.t('lang.label');
      });
    }

    setupLanguageSwitcher(root = document) {
      // Core i18n already binds [data-lang-option]; we just ensure labels exist.
      if (window.BadianiI18n && typeof window.BadianiI18n.applyTranslations === 'function') {
        // Nothing extra required.
        return;
      }

      root.querySelectorAll?.('[data-lang-option]').forEach((btn) => {
        if (btn.dataset.langBound === 'true') return;
        btn.dataset.langBound = 'true';
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const opt = btn.getAttribute('data-lang-option');
          if (!opt) return;
          this.setLang(opt);
        });
      });
    }

    updateWrongAnswersList() {
      try {
        // Keep this intentionally lightweight: site.js owns the list content,
        // we just (re)apply translations to any i18n-marked nodes.
        const root = document.querySelector('[data-summary]') || document;
        const wrongRoot = root.querySelector?.('[data-wrong-list]')?.closest?.('[data-carousel-item]') || root;
        this.applyTranslations(wrongRoot);
      } catch {
        // no-op
      }
    }

    setupDynamicListeners() {
      // Listen for storage updates to re-translate wrong answers
      window.addEventListener('storageUpdate', (e) => {
        if (e.detail.key === 'wrong-answers') {
          this.updateWrongAnswersList();
        }
      });

      // Listen for DOM mutations to translate new elements
      // FIX: Usa un flag per prevenire loop infiniti
      let isTranslating = false;

      let observer;
      try {
        observer = new MutationObserver((mutations) => {
        // Se stiamo già traducendo, skippa per evitare loop
        if (isTranslating) return;

        // Filtra solo mutations rilevanti (elementi aggiunti, non modifiche di testo)
        const hasRelevantChanges = mutations.some((mutation) => {
          return mutation.type === 'childList' && mutation.addedNodes.length > 0;
        });

        if (!hasRelevantChanges) return;

        isTranslating = true;

        // Usa setTimeout per evitare stack overflow
        setTimeout(() => {
          mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === 1) {
                // Element node
                // Translate new elements
                const i18nElements = node.querySelectorAll?.('[data-i18n]');
                if (i18nElements) {
                  i18nElements.forEach((el) => {
                    const key = el.getAttribute('data-i18n');
                    if (!key) return;
                    // Solo se il testo è diverso
                    const newText = this.t(key);
                    if (el.textContent !== newText) {
                      el.textContent = newText;
                    }
                  });
                }

                const i18nAttrElements = node.querySelectorAll?.('[data-i18n-attr]');
                if (i18nAttrElements) {
                  i18nAttrElements.forEach((el) => {
                    const mapping = el.getAttribute('data-i18n-attr');
                    if (!mapping) return;
                    mapping.split(/[,|]/).forEach((pair) => {
                      const [attr, key] = pair.trim().split(':');
                      if (attr && key) {
                        const newValue = this.t(key);
                        // Solo se l'attributo è diverso
                        if (el.getAttribute(attr) !== newValue) {
                          el.setAttribute(attr, newValue);
                        }
                      }
                    });
                  });
                }

                // Se il nodo stesso ha attributi i18n
                if (node.hasAttribute?.('data-i18n')) {
                  const key = node.getAttribute('data-i18n');
                  if (!key) return;
                  const newText = this.t(key);
                  if (node.textContent !== newText) {
                    node.textContent = newText;
                  }
                }

                if (node.hasAttribute?.('data-i18n-attr')) {
                  const mapping = node.getAttribute('data-i18n-attr');
                  if (!mapping) return;
                  mapping.split(/[,|]/).forEach((pair) => {
                    const [attr, key] = pair.trim().split(':');
                    if (attr && key) {
                      const newValue = this.t(key);
                      if (node.getAttribute(attr) !== newValue) {
                        node.setAttribute(attr, newValue);
                      }
                    }
                  });
                }
              }
            });
          });

          isTranslating = false;
        }, 0);
      });
      } catch {
        return;
      }

      const startObserving = () => {
        try {
          const target = document.body || document.documentElement;
          if (!target) return;
          // Osserva solo childList (elementi aggiunti/rimossi), NON characterData
          observer.observe(target, {
            childList: true,
            subtree: true,
            // NON osservare caratteri/attributi per evitare loop
            characterData: false,
            attributes: false,
          });
        } catch {}
      };

      // If executed in <head> before <body> exists, delay observer startup.
      if (!document.body) {
        try {
          document.addEventListener('DOMContentLoaded', startObserving, { once: true });
        } catch {
          // Fallback: try immediately anyway.
          startObserving();
        }
      } else {
        startObserving();
      }
    }

    bindLangChangeListener() {
      // Update formatters when the core system changes language.
      try {
        document.addEventListener('badiani:lang-changed', (e) => {
          const next = normalizeLang(e?.detail?.lang) || this.detectLanguage();
          this.currentLang = next;
          safeSet(ALT_KEY, next);
          this.initializeFormatters();

          // Let any dynamic widgets (outside the core i18n system) refresh.
          this.dispatchUpdated();
        });
      } catch {}
    }
  }

  // Expose
  window.I18nManager = I18nManager;
  window.i18nManager = window.i18nManager || new I18nManager();
  // Common alias used by some snippets
  window.i18n = window.i18n || window.i18nManager;
})();
