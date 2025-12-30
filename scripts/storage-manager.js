// FILE: scripts/storage-manager.js
// Sistema centralizzato per gestione dati profili e quiz
// NOTE: This project already has an existing profile/gamification system in scripts/site.js.
// This StorageManager is namespaced (badiani_orbit_) to avoid collisions, and it is defensive
// to avoid clobbering UI managed by the existing system.

(() => {
  class StorageManager {
    constructor(options = {}) {
      this.version = '1.0.0';
      this.namespace = typeof options.namespace === 'string' ? options.namespace : 'badiani_orbit_';
      this.isAvailable = this.checkAvailability();

      // Control whether StorageManager pushes values into the DOM.
      // Default: false if the main app profile key exists (avoid UI conflicts).
      this.manageUI =
        typeof options.manageUI === 'boolean'
          ? options.manageUI
          : !this.detectExistingBadianiProfileSystem();

      // Schema dati (documentazione interna)
      this.schema = {
        user: {
          nickname: 'string',
          avatar: 'string',
          level: 'number',
          registrationDate: 'date',
          lastActive: 'date'
        },
        performance: {
          date: 'date',
          starsToday: 'number',
          quizCorrect: 'number',
          quizWrong: 'number',
          gelatiToday: 'number',
          pointsToday: 'number'
        },
        totals: {
          starsTotal: 'number',
          gelatiTotal: 'number',
          bonusTotal: 'number',
          daysActive: 'number',
          quizCompleted: 'number'
        },
        quiz: {
          dailyQuestionId: 'string',
          dailyAnswered: 'boolean',
          wrongAnswers: 'array',
          completedModules: 'array',
          history: 'object'
        }
      };

      this.init();
    }

    detectExistingBadianiProfileSystem() {
      // Heuristic: if the app already has a profile created, avoid rewriting UI.
      try {
        return !!localStorage.getItem('badianiUser.profile.v1');
      } catch {
        return false;
      }
    }

    // Verifica disponibilità localStorage
    checkAvailability() {
      try {
        const testKey = '__storage_test__';
        localStorage.setItem(testKey, testKey);
        localStorage.removeItem(testKey);
        return true;
      } catch (e) {
        console.error('localStorage non disponibile:', e);
        return false;
      }
    }

    init() {
      if (!this.isAvailable) {
        this.showStorageError();
        return;
      }

      // Verifica versione e migra se necessario
      this.checkVersion();

      // Reset giornaliero automatico
      this.checkDailyReset();

      // Inizializza dati se primo accesso
      this.initializeIfNeeded();

      // Setup auto-save su beforeunload
      this.setupAutoSave();

      // Setup storage event listener per sync tra tabs
      this.setupStorageSync();

      // Best-effort: refresh UI once DOM is ready
      if (this.manageUI) {
        this.onDomReady(() => {
          this.updateUI('user');
          this.updateUI('performance');
          this.updateUI('totals');
          this.updateUI('wrong');
        });
      }
    }

    onDomReady(cb) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => cb(), { once: true });
      } else {
        cb();
      }
    }

    // ============================================
    // CORE METHODS - GET/SET con namespacing
    // ============================================

    get(key, defaultValue = null) {
      if (!this.isAvailable) return defaultValue;

      try {
        const fullKey = this.namespace + key;
        const value = localStorage.getItem(fullKey);

        if (value === null) return defaultValue;

        // Parse JSON automatico
        try {
          return JSON.parse(value);
        } catch {
          return value; // Return raw string se non è JSON
        }
      } catch (e) {
        console.error(`Error getting ${key}:`, e);
        return defaultValue;
      }
    }

    set(key, value) {
      if (!this.isAvailable) return false;

      try {
        const fullKey = this.namespace + key;
        const stringValue = typeof value === 'string' ? value : JSON.stringify(value);

        localStorage.setItem(fullKey, stringValue);

        // Dispatch custom event per sync
        window.dispatchEvent(
          new CustomEvent('storageUpdate', {
            detail: { key, value }
          })
        );

        return true;
      } catch (e) {
        // Quota exceeded error
        if (e && (e.name === 'QuotaExceededError' || e.code === 22)) {
          this.handleQuotaExceeded();
        }
        console.error(`Error setting ${key}:`, e);
        return false;
      }
    }

    remove(key) {
      if (!this.isAvailable) return false;

      try {
        const fullKey = this.namespace + key;
        localStorage.removeItem(fullKey);
        return true;
      } catch (e) {
        console.error(`Error removing ${key}:`, e);
        return false;
      }
    }

    clear() {
      if (!this.isAvailable) return false;

      try {
        // Rimuovi solo chiavi con namespace
        Object.keys(localStorage)
          .filter((key) => key.startsWith(this.namespace))
          .forEach((key) => localStorage.removeItem(key));

        return true;
      } catch (e) {
        console.error('Error clearing storage:', e);
        return false;
      }
    }

    // ============================================
    // USER PROFILE METHODS
    // ============================================

    getUser() {
      return {
        nickname: this.get('user-nickname', 'Apprendista'),
        avatar: this.get('user-avatar', '🍦'),
        level: this.get('user-level', 1),
        registrationDate: this.get('user-registration-date', new Date().toISOString()),
        lastActive: this.get('user-last-active', new Date().toISOString())
      };
    }

    setUser(userData) {
      const current = this.getUser();
      const updated = { ...current, ...userData };

      this.set('user-nickname', updated.nickname);
      this.set('user-avatar', updated.avatar);
      this.set('user-level', updated.level);
      this.set('user-registration-date', updated.registrationDate);
      this.set('user-last-active', new Date().toISOString());

      this.updateUI('user');
      return updated;
    }

    // ============================================
    // PERFORMANCE METHODS (Giornaliere)
    // ============================================

    getPerformance() {
      return {
        date: this.get('perf-date', this.getTodayString()),
        starsToday: this.get('perf-stars-today', 0),
        quizCorrect: this.get('perf-quiz-correct', 0),
        quizWrong: this.get('perf-quiz-wrong', 0),
        gelatiToday: this.get('perf-gelati-today', 0),
        pointsToday: this.get('perf-points-today', 0)
      };
    }

    incrementPerformance(field, amount = 1) {
      const current = this.getPerformance();
      current[field] = (current[field] || 0) + amount;

      this.set(`perf-${this.camelToKebab(field)}`, current[field]);

      // Aggiorna anche totali
      if (field === 'starsToday') {
        this.incrementTotal('starsTotal', amount);
      } else if (field === 'gelatiToday') {
        this.incrementTotal('gelatiTotal', amount);
      }

      this.updateUI('performance');
      return current[field];
    }

    resetDailyPerformance() {
      const fields = ['starsToday', 'quizCorrect', 'quizWrong', 'gelatiToday', 'pointsToday'];

      fields.forEach((field) => {
        this.set(`perf-${this.camelToKebab(field)}`, 0);
      });

      this.set('perf-date', this.getTodayString());
      this.updateUI('performance');
    }

    // ============================================
    // TOTALS METHODS (Accumulati)
    // ============================================

    getTotals() {
      return {
        starsTotal: this.get('stars-total', 0),
        gelatiTotal: this.get('gelati-total', 0),
        bonusTotal: this.get('bonus-total', 0),
        daysActive: this.get('days-active', 0),
        quizCompleted: this.get('quiz-completed', 0)
      };
    }

    incrementTotal(field, amount = 1) {
      const key = this.camelToKebab(field);
      const current = this.get(key, 0);
      const newValue = current + amount;

      this.set(key, newValue);
      this.updateUI('totals');

      // Check achievements/milestones
      this.checkMilestones(field, newValue);

      return newValue;
    }

    // ============================================
    // QUIZ METHODS
    // ============================================

    getDailyQuestion() {
      return {
        id: this.get('daily-question-id', null),
        answered: this.get('daily-question-answered', false),
        date: this.get('daily-question-date', null)
      };
    }

    setDailyQuestion(questionId) {
      const today = this.getTodayString();

      this.set('daily-question-id', questionId);
      this.set('daily-question-answered', false);
      this.set('daily-question-date', today);
    }

    answerDailyQuestion(correct) {
      this.set('daily-question-answered', true);

      if (correct) {
        this.incrementPerformance('starsToday', 1);
        this.incrementPerformance('quizCorrect', 1);
        this.incrementTotal('bonusTotal', 1); // Bonus per daily
      } else {
        this.incrementPerformance('quizWrong', 1);
      }
    }

    getWrongAnswers() {
      return this.get('wrong-answers', []);
    }

    addWrongAnswer(questionData) {
      const wrongAnswers = this.getWrongAnswers();

      // Evita duplicati
      const exists = wrongAnswers.find((q) => q.id === questionData.id);
      if (exists) return wrongAnswers;

      wrongAnswers.push({
        id: questionData.id,
        question: questionData.question,
        correctAnswer: questionData.correctAnswer,
        userAnswer: questionData.userAnswer,
        module: questionData.module,
        timestamp: new Date().toISOString()
      });

      // Limita a ultimi 50
      if (wrongAnswers.length > 50) {
        wrongAnswers.shift();
      }

      this.set('wrong-answers', wrongAnswers);
      this.updateUI('wrong');

      return wrongAnswers;
    }

    removeWrongAnswer(questionId) {
      const wrongAnswers = this.getWrongAnswers();
      const filtered = wrongAnswers.filter((q) => q.id !== questionId);

      this.set('wrong-answers', filtered);
      this.updateUI('wrong');

      return filtered;
    }

    getCompletedModules() {
      return this.get('completed-modules', []);
    }

    completeModule(moduleId, score) {
      const completed = this.getCompletedModules();

      // Update o add
      const existing = completed.findIndex((m) => m.id === moduleId);
      const moduleData = {
        id: moduleId,
        score: score,
        completedAt: new Date().toISOString()
      };

      if (existing >= 0) {
        // Aggiorna solo se score migliorato
        if (score > completed[existing].score) {
          completed[existing] = moduleData;
        }
      } else {
        completed.push(moduleData);
        this.incrementTotal('quizCompleted', 1);
      }

      this.set('completed-modules', completed);
      this.updateUI('modules');

      return completed;
    }

    // ============================================
    // DAILY RESET & VERSION CHECK
    // ============================================

    checkDailyReset() {
      const lastDate = this.get('perf-date', null);
      const today = this.getTodayString();

      if (lastDate !== today) {
        console.log('📅 Daily reset triggered');

        // Incrementa giorni attivi
        this.incrementTotal('daysActive', 1);

        // Reset performance
        this.resetDailyPerformance();

        // Reset daily question
        this.set('daily-question-answered', false);
      }
    }

    checkVersion() {
      const storedVersion = this.get('app-version', null);

      if (storedVersion !== this.version) {
        console.log(`🔄 Version update: ${storedVersion} → ${this.version}`);
        this.migrate(storedVersion, this.version);
        this.set('app-version', this.version);
      }
    }

    migrate(fromVersion, toVersion) {
      // Future: implementa logica migrazione
      console.log('Migration logic placeholder', { fromVersion, toVersion });
    }

    // ============================================
    // MILESTONE & REWARDS
    // ============================================

    checkMilestones(field, value) {
      const milestones = {
        starsTotal: [10, 25, 50, 100, 250, 500],
        gelatiTotal: [1, 3, 5, 10],
        daysActive: [7, 30, 90, 365]
      };

      if (milestones[field]) {
        const milestone = milestones[field].find((m) => m === value);

        if (milestone) {
          this.unlockAchievement(field, milestone);
        }
      }
    }

    unlockAchievement(type, value) {
      console.log(`🏆 Achievement unlocked: ${type} = ${value}`);

      // Save achievement
      const achievements = this.get('achievements', []);
      achievements.push({
        type,
        value,
        unlockedAt: new Date().toISOString()
      });
      this.set('achievements', achievements);

      // Show notification
      this.showNotification(`🎉 Achievement! ${value} ${type}!`);

      // Trigger confetti
      if (window.dashboardAnimations && typeof window.dashboardAnimations.confettiEffect === 'function') {
        window.dashboardAnimations.confettiEffect();
      }
    }

    // ============================================
    // UI UPDATE
    // ============================================

    updateUI(section) {
      if (!this.manageUI) return;

      switch (section) {
        case 'user':
          this.updateUserUI();
          break;
        case 'performance':
          this.updatePerformanceUI();
          break;
        case 'totals':
          this.updateTotalsUI();
          break;
        case 'wrong':
          this.updateWrongUI();
          break;
        case 'modules':
          this.updateModulesUI();
          break;
        default:
          break;
      }
    }

    updateUserUI() {
      const user = this.getUser();

      document.querySelectorAll('[data-profile-nick], #nickname-display').forEach((el) => {
        // Avoid clobbering values already set by the main app.
        if (el && !String(el.textContent || '').trim()) {
          el.textContent = user.nickname;
        }
      });

      document.querySelectorAll('[data-profile-gelato]').forEach((el) => {
        if (el && !String(el.textContent || '').trim()) {
          el.textContent = user.avatar;
        }
      });
    }

    updatePerformanceUI() {
      const perf = this.getPerformance();

      const mapping = {
        'data-perf-stars': perf.starsToday,
        'data-perf-quiz-correct': perf.quizCorrect,
        'data-perf-quiz-wrong': perf.quizWrong,
        'data-perf-gelati': perf.gelatiToday,
        'data-perf-points': perf.pointsToday
      };

      Object.entries(mapping).forEach(([attr, value]) => {
        document.querySelectorAll(`[${attr}]`).forEach((el) => {
          el.textContent = value;
        });
      });
    }

    updateTotalsUI() {
      const totals = this.getTotals();

      const mapping = {
        'data-perf-stars-total': totals.starsTotal,
        'data-perf-gelati-total': totals.gelatiTotal,
        'data-perf-bonus-total': totals.bonusTotal,
        'data-history-days': totals.daysActive
      };

      Object.entries(mapping).forEach(([attr, value]) => {
        document.querySelectorAll(`[${attr}]`).forEach((el) => {
          el.textContent = value;
        });
      });

      // Update progress ring
      if (window.dashboardAnimations && typeof window.dashboardAnimations.animateProgressRing === 'function') {
        window.dashboardAnimations.animateProgressRing();
      }
    }

    updateWrongUI() {
      const wrongAnswers = this.getWrongAnswers();
      const countEl = document.querySelector('[data-wrong-count]');
      const listEl = document.querySelector('[data-wrong-list]');

      if (countEl) {
        countEl.textContent = wrongAnswers.length;
      }

      if (listEl) {
        if (wrongAnswers.length === 0) {
          listEl.innerHTML = '<p class="empty">Nessun errore! 🎉</p>';
        } else {
          // Mostra ultimi 3
          const preview = wrongAnswers.slice(-3).reverse();
          listEl.innerHTML = preview
            .map(
              (q) => `
          <div class="wrong-preview__item">
            <strong>${String(q.module || '').trim()}</strong><br>
            <span>${String(q.question || '').trim().slice(0, 60)}...</span>
          </div>
        `
            )
            .join('');
        }
      }
    }

    updateModulesUI() {
      const completed = this.getCompletedModules();
      // Update progress percentage, badges, etc.
      console.log(`Modules completed: ${completed.length}`);
    }

    // ============================================
    // UTILITIES
    // ============================================

    getTodayString() {
      return new Date().toISOString().split('T')[0];
    }

    camelToKebab(str) {
      return String(str).replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
    }

    // ============================================
    // ERROR HANDLING
    // ============================================

    handleQuotaExceeded() {
      console.error('⚠️ localStorage quota exceeded!');

      // Cleanup old data
      this.cleanup();

      this.showNotification('⚠️ Spazio storage pieno. Alcuni dati vecchi sono stati rimossi.', 'warning');
    }

    cleanup() {
      // Rimuovi wrong answers più vecchie
      const wrongAnswers = this.getWrongAnswers();
      if (wrongAnswers.length > 20) {
        const reduced = wrongAnswers.slice(-20);
        this.set('wrong-answers', reduced);
      }

      console.log('🧹 Cleanup completed');
    }

    showStorageError() {
      this.showNotification('❌ localStorage non disponibile. Alcune funzionalità potrebbero non funzionare.', 'error');
    }

    showNotification(message, type = 'info') {
      console.log(`[${String(type || 'info').toUpperCase()}] ${message}`);

      // Se esiste toast UI
      const toast = document.querySelector('[data-error-toast]');
      if (toast) {
        const messageEl = toast.querySelector('[data-error-message]');
        if (messageEl) {
          messageEl.textContent = message;
          toast.hidden = false;

          setTimeout(() => {
            toast.hidden = true;
          }, 5000);
        }
      }
    }

    // ============================================
    // AUTO-SAVE & SYNC
    // ============================================

    setupAutoSave() {
      window.addEventListener('beforeunload', () => {
        // Update last active
        this.set('user-last-active', new Date().toISOString());
      });
    }

    setupStorageSync() {
      // Sync tra tabs/windows
      window.addEventListener('storage', (e) => {
        if (e.key && e.key.startsWith(this.namespace)) {
          console.log('🔄 Storage sync from other tab:', e.key);

          // Re-render UI per sezione modificata
          if (e.key.includes('perf')) {
            this.updateUI('performance');
            this.updateUI('totals');
          } else if (e.key.includes('user')) {
            this.updateUI('user');
          } else if (e.key.includes('wrong')) {
            this.updateUI('wrong');
          }
        }
      });
    }

    // ============================================
    // EXPORT/IMPORT (Backup)
    // ============================================

    exportData() {
      const data = {};

      Object.keys(localStorage)
        .filter((key) => key.startsWith(this.namespace))
        .forEach((key) => {
          const cleanKey = key.replace(this.namespace, '');
          data[cleanKey] = this.get(cleanKey);
        });

      return {
        version: this.version,
        exportedAt: new Date().toISOString(),
        data: data
      };
    }

    importData(exportedData) {
      if (!exportedData || !exportedData.data) {
        console.error('Invalid export format');
        return false;
      }

      try {
        Object.entries(exportedData.data).forEach(([key, value]) => {
          this.set(key, value);
        });

        // Update all UI
        this.updateUI('user');
        this.updateUI('performance');
        this.updateUI('totals');
        this.updateUI('wrong');

        this.showNotification('✅ Dati importati con successo!', 'success');
        return true;
      } catch (e) {
        console.error('Import failed:', e);
        this.showNotification('❌ Errore durante importazione dati', 'error');
        return false;
      }
    }

    downloadBackup() {
      const data = this.exportData();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `badiani-backup-${this.getTodayString()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.showNotification('💾 Backup scaricato!', 'success');
    }

    // ============================================
    // INITIALIZATION
    // ============================================

    initializeIfNeeded() {
      // Check se è la prima volta
      const isFirstTime = !this.get('user-nickname');

      if (isFirstTime) {
        console.log('🎉 First time initialization');

        // Setup default values
        this.setUser({
          nickname: 'Apprendista',
          avatar: '🍦',
          level: 1,
          registrationDate: new Date().toISOString()
        });

        this.resetDailyPerformance();
        this.set('stars-total', 0);
        this.set('gelati-total', 0);
        this.set('bonus-total', 0);
        this.set('days-active', 1);
        this.set('wrong-answers', []);
        this.set('completed-modules', []);
        this.set('achievements', []);

        // Update UI
        this.updateUI('user');
        this.updateUI('performance');
        this.updateUI('totals');
      }
    }
  }

  // Export
  window.StorageManager = StorageManager;

  // Init globally (safe boot)
  const boot = () => {
    if (window.storageManager) return;
    window.storageManager = new StorageManager();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
