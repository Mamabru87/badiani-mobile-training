// FILE: scripts/settings-panel.js
// Hub Settings Panel controller (no modules; vanilla JS; IIFE).
// Integrates with:
// - StorageManager (scripts/storage-manager.js)
// - Legacy profile + gamification system (scripts/site.js)

(() => {
  'use strict';

  const LEGACY_PROFILE_KEY = 'badianiUser.profile.v1';
  const LEGACY_PROFILES_KEY = 'badianiUser.profiles';
  const LEGACY_GAMIFICATION_PREFIX = 'badianiGamification.v3';
  const LEGACY_UI_LANG_KEY = 'badianiUILang.v1';

  const safeJsonParse = (raw, fallback = null) => {
    try {
      if (raw == null) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  };

  const getLegacyProfile = () => {
    try {
      const raw = localStorage.getItem(LEGACY_PROFILE_KEY);
      return safeJsonParse(raw, null);
    } catch {
      return null;
    }
  };

  const setLegacyNickname = (nickname) => {
    const trimmed = String(nickname || '').trim();
    if (!trimmed) return false;

    try {
      const current = getLegacyProfile();
      if (!current || !current.id) return false;

      const updated = { ...current, nickname: trimmed };
      localStorage.setItem(LEGACY_PROFILE_KEY, JSON.stringify(updated));

      // Keep the profiles list in sync as well.
      const rawProfiles = localStorage.getItem(LEGACY_PROFILES_KEY);
      const profiles = safeJsonParse(rawProfiles, []);
      if (Array.isArray(profiles) && profiles.length) {
        const nextProfiles = profiles.map((p) => {
          if (p && p.id === updated.id) return { ...p, nickname: trimmed };
          return p;
        });
        localStorage.setItem(LEGACY_PROFILES_KEY, JSON.stringify(nextProfiles));
      }

      return true;
    } catch {
      return false;
    }
  };

  const getLegacyGamificationState = () => {
    try {
      const user = getLegacyProfile();
      const id = user?.id ? String(user.id) : '';
      const key = id ? `${LEGACY_GAMIFICATION_PREFIX}:${id}` : LEGACY_GAMIFICATION_PREFIX;
      const raw = localStorage.getItem(key);
      return safeJsonParse(raw, null);
    } catch {
      return null;
    }
  };

  const computeLegacyStats = (legacyState) => {
    const state = legacyState || {};

    const quizHistory = Array.isArray(state.history?.quiz) ? state.history.quiz : [];
    const wrong = quizHistory.filter((q) => q && q.correct === false).length;

    const totals = state.history?.totals || {};
    const totalsStars = Number(totals.stars || 0);
    const totalsGelati = Number(totals.gelati || 0);

    const days = Array.isArray(state.history?.days) ? state.history.days : [];
    const daysActive = days.length;

    return {
      starsTotal: totalsStars,
      gelatiTotal: totalsGelati,
      daysActive,
      quizCompleted: quizHistory.length,
      wrongCount: wrong
    };
  };

  const ensureStorageManager = () => {
    if (window.storageManager) return window.storageManager;
    if (window.StorageManager) {
      try {
        window.storageManager = new window.StorageManager({ manageUI: false });
        return window.storageManager;
      } catch {
        return null;
      }
    }
    return null;
  };

  class SettingsController {
    constructor() {
      this.panel = document.getElementById('settings-panel');
      this.fileInput = document.getElementById('import-file-input');
      this._openScrollY = 0;

      this.init();
    }

    init() {
      if (!this.panel) return;

      document.querySelectorAll('[data-settings-open]').forEach((btn) => {
        btn.addEventListener('click', () => this.open());
      });

      document.querySelectorAll('[data-settings-close]').forEach((btn) => {
        btn.addEventListener('click', () => this.close());
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !this.panel.hidden) {
          e.preventDefault();
          this.close();
        }
      });

      document.getElementById('save-profile-btn')?.addEventListener('click', () => this.saveProfile());

      document.querySelectorAll('.emoji-btn').forEach((btn) => {
        btn.addEventListener('click', () => this.selectEmoji(btn));
      });

      document.getElementById('export-data-btn')?.addEventListener('click', () => this.exportData());
      document.getElementById('import-data-btn')?.addEventListener('click', () => this.importData());
      document.getElementById('reset-data-btn')?.addEventListener('click', () => this.resetData());

      this.fileInput?.addEventListener('change', (e) => this.handleImport(e));

      // Live refresh when other scripts update storage
      window.addEventListener('storageUpdate', () => {
        if (!this.panel.hidden) {
          this.loadCurrentData();
          this.updateStorageInfo();
        }
      });

      window.addEventListener('storage', () => {
        if (!this.panel.hidden) {
          this.loadCurrentData();
          this.updateStorageInfo();
        }
      });
    }

    open() {
      if (!this.panel) return;
      this.panel.hidden = false;

      // Lock scroll (match the site's bodyScrollLock behaviour).
      this._openScrollY = window.scrollY || 0;
      document.body.classList.add('no-scroll');
      document.body.style.top = `-${this._openScrollY}px`;

      this.loadCurrentData();
      this.updateStorageInfo();

      // Focus first control
      setTimeout(() => {
        document.getElementById('nickname-input')?.focus({ preventScroll: true });
      }, 0);
    }

    close() {
      if (!this.panel) return;
      this.panel.hidden = true;

      // Unlock scroll
      document.body.classList.remove('no-scroll');
      const top = document.body.style.top;
      document.body.style.top = '';
      const restoreY = top ? Math.abs(parseInt(top, 10) || 0) : this._openScrollY;
      window.scrollTo(0, restoreY || 0);
    }

    loadCurrentData() {
      const sm = ensureStorageManager();

      // Prefer legacy profile for nickname (it's what the app actually uses today).
      const legacyProfile = getLegacyProfile();
      const smUser = sm?.getUser?.() || { nickname: 'Apprendista', avatar: '🍦' };

      const nickname = (legacyProfile?.nickname || smUser.nickname || 'Apprendista').trim();
      const avatar = (smUser.avatar || '🍦').trim();

      const nicknameInput = document.getElementById('nickname-input');
      if (nicknameInput) nicknameInput.value = nickname;

      // Set active emoji
      document.querySelectorAll('.emoji-btn').forEach((btn) => {
        const isActive = btn instanceof HTMLElement && btn.dataset.emoji === avatar;
        btn.classList.toggle('active', !!isActive);
      });

      // Stats: prefer legacy gamification if present.
      const legacyState = getLegacyGamificationState();
      const legacyStats = legacyState ? computeLegacyStats(legacyState) : null;

      const totals = sm?.getTotals?.() || {
        starsTotal: 0,
        gelatiTotal: 0,
        daysActive: 0,
        quizCompleted: 0
      };

      const wrong = sm?.getWrongAnswers?.() || [];

      const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = String(value);
      };

      setText('stats-stars', legacyStats ? legacyStats.starsTotal : totals.starsTotal);
      setText('stats-gelati', legacyStats ? legacyStats.gelatiTotal : totals.gelatiTotal);
      setText('stats-days', legacyStats ? legacyStats.daysActive : totals.daysActive);
      setText('stats-quiz', legacyStats ? legacyStats.quizCompleted : totals.quizCompleted);
      setText('stats-wrong', legacyStats ? legacyStats.wrongCount : wrong.length);
    }

    saveProfile() {
      const sm = ensureStorageManager();
      const nickname = String(document.getElementById('nickname-input')?.value || '').trim();
      const selectedEmoji = document.querySelector('.emoji-btn.active')?.dataset.emoji;
      const avatar = String(selectedEmoji || '🍦').trim();

      if (!nickname) {
        alert('Inserisci un nickname!');
        return;
      }

      // Save to StorageManager (avatar lives here).
      try {
        sm?.setUser?.({ nickname, avatar });
      } catch {}

      // If the legacy system exists, keep it in sync for nickname.
      setLegacyNickname(nickname);

      // Update visible UI immediately.
      const nickBar = document.getElementById('nickname-display');
      if (nickBar) nickBar.textContent = nickname;

      document.querySelectorAll('[data-profile-nick]').forEach((el) => {
        el.textContent = nickname;
      });

      const emojiEl = document.querySelector('.profile-avatar__emoji');
      if (emojiEl) emojiEl.textContent = avatar;

      // Best-effort: show a toast/notification.
      if (sm && typeof sm.showNotification === 'function') {
        sm.showNotification('✅ Profilo salvato!', 'success');
      } else {
        alert('✅ Profilo salvato!');
      }
    }

    selectEmoji(btn) {
      document.querySelectorAll('.emoji-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    }

    exportData() {
      const sm = ensureStorageManager();

      const legacy = {};
      try {
        // Exact legacy keys
        legacy[LEGACY_PROFILE_KEY] = safeJsonParse(localStorage.getItem(LEGACY_PROFILE_KEY), null);
        legacy[LEGACY_PROFILES_KEY] = safeJsonParse(localStorage.getItem(LEGACY_PROFILES_KEY), null);
        legacy[LEGACY_UI_LANG_KEY] = localStorage.getItem(LEGACY_UI_LANG_KEY);

        // All gamification keys (global + per-profile)
        Object.keys(localStorage)
          .filter((k) => k === LEGACY_GAMIFICATION_PREFIX || k.startsWith(`${LEGACY_GAMIFICATION_PREFIX}:`))
          .forEach((k) => {
            legacy[k] = safeJsonParse(localStorage.getItem(k), null);
          });
      } catch {}

      const payload = {
        app: 'badiani-training-orbit-backup',
        exportedAt: new Date().toISOString(),
        storageManager: sm && typeof sm.exportData === 'function' ? sm.exportData() : null,
        legacy
      };

      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      const day = new Date().toISOString().split('T')[0];
      a.download = `badiani-backup-full-${day}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      if (sm && typeof sm.showNotification === 'function') {
        sm.showNotification('💾 Backup scaricato!', 'success');
      }
    }

    importData() {
      this.fileInput?.click();
    }

    handleImport(e) {
      const file = e?.target?.files?.[0];
      if (!file) return;

      const sm = ensureStorageManager();
      const reader = new FileReader();

      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(String(event?.target?.result || ''));

          // Accept both:
          // 1) Full payload { app, storageManager, legacy }
          // 2) StorageManager-native payload { version, exportedAt, data }
          let ok = false;

          if (parsed && parsed.app === 'badiani-training-orbit-backup') {
            if (sm && parsed.storageManager && typeof sm.importData === 'function') {
              ok = sm.importData(parsed.storageManager);
            }

            // Restore legacy keys
            if (parsed.legacy && typeof parsed.legacy === 'object') {
              Object.entries(parsed.legacy).forEach(([k, v]) => {
                try {
                  if (v === null || v === undefined) {
                    localStorage.removeItem(k);
                    return;
                  }
                  if (typeof v === 'string') {
                    localStorage.setItem(k, v);
                  } else {
                    localStorage.setItem(k, JSON.stringify(v));
                  }
                } catch {}
              });
              ok = true;
            }
          } else if (sm && parsed && typeof parsed === 'object' && parsed.data && typeof sm.importData === 'function') {
            ok = sm.importData(parsed);
          }

          if (ok) {
            this.loadCurrentData();
            this.updateStorageInfo();

            // Reload to let site.js re-hydrate all UI and state consistently.
            window.location.reload();
            return;
          }

          alert('File non valido!');
        } catch {
          alert('File non valido!');
        }
      };

      reader.readAsText(file);

      // Allow importing the same file twice in a row.
      try {
        e.target.value = '';
      } catch {}
    }

    resetData() {
      if (!confirm('⚠️ ATTENZIONE: Tutti i dati verranno cancellati! Confermi?')) return;
      if (!confirm('Sei davvero sicuro? Questa azione è irreversibile!')) return;

      const sm = ensureStorageManager();
      try {
        sm?.clear?.();
      } catch {}

      // Clear legacy keys too (the app will show the signup gate again).
      try {
        localStorage.removeItem(LEGACY_PROFILE_KEY);
        localStorage.removeItem(LEGACY_PROFILES_KEY);

        Object.keys(localStorage)
          .filter((k) => k === LEGACY_GAMIFICATION_PREFIX || k.startsWith(`${LEGACY_GAMIFICATION_PREFIX}:`))
          .forEach((k) => localStorage.removeItem(k));
      } catch {}

      try {
        sm?.initializeIfNeeded?.();
      } catch {}

      window.location.reload();
    }

    updateStorageInfo() {
      let totalBytes = 0;
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!key) continue;
          const value = localStorage.getItem(key) || '';
          totalBytes += String(key).length + String(value).length;
        }
      } catch {}

      const kb = (totalBytes / 1024).toFixed(2);
      const percentage = Math.min((totalBytes / (5 * 1024 * 1024)) * 100, 100).toFixed(1);

      const used = document.getElementById('storage-used');
      if (used) used.textContent = kb;

      const fill = document.getElementById('storage-fill');
      if (fill) fill.style.width = `${percentage}%`;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    // Only on pages that have the settings panel markup.
    if (!document.getElementById('settings-panel')) return;
    window.settingsController = new SettingsController();
  });
})();
