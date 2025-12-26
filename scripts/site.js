document.documentElement.classList.add('has-js');

const bodyScrollLock = (() => {
  let locks = 0;
  let scrollPosition = 0;
  return {
    lock() {
      locks += 1;
      if (locks === 1) {
        scrollPosition = window.pageYOffset;
        document.body.style.top = `-${scrollPosition}px`;
        document.body.classList.add('no-scroll');
      }
    },
    unlock() {
      locks = Math.max(0, locks - 1);
      if (locks === 0) {
        document.body.classList.remove('no-scroll');
        document.body.style.top = '';
        window.scrollTo(0, scrollPosition);
      }
    },
    forceUnlock() {
      locks = 0;
      document.body.classList.remove('no-scroll');
      document.body.style.top = '';
    }
  };
})();

// Safety: force unlock scroll on page show (back button, etc)
window.addEventListener('pageshow', () => {
  bodyScrollLock.forceUnlock();
});

// Safety: force unlock on escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    bodyScrollLock.forceUnlock();
  }
});

// ============================================================
// SIGNUP/LOGIN GATE (INITIALIZES FIRST - BLOCKS ACCESS)
// ============================================================

// Chiavi profilo globali
const STORAGE_KEY_USER = 'badianiUser.profile.v1';
const STORAGE_KEY_PROFILES = 'badianiUser.profiles';

// Mostra nickname utente nella barra
window.addEventListener('DOMContentLoaded', function() {
  try {
    const user = (function() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_USER);
        if (!raw) return null;
        const user = JSON.parse(raw);
        if (!user?.nickname) return null;
        return user;
      } catch { return null; }
    })();
    const bar = document.getElementById('user-nickname-bar');
    const nick = document.getElementById('nickname-display');
    if (user && bar && nick) {
      nick.textContent = user.nickname;
      bar.style.display = 'flex';
    }
  } catch {}
});

(function signupGate() {

  const getProfiles = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PROFILES);
      const parsed = JSON.parse(raw || '[]');
      if (Array.isArray(parsed)) return parsed;
      return [];
    } catch {
      return [];
    }
  };

  const saveProfiles = (profiles) => {
    localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(profiles || []));
  };

  const getUser = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_USER);
      if (!raw) return null;
      const user = JSON.parse(raw);
      if (!user?.id || !user?.nickname || !user?.gelato) return null;
      return user;
    } catch {
      return null;
    }
  };

  const saveUser = (id, nickname, gelato) => {
    const profile = { id, nickname: nickname.trim(), gelato: gelato.trim(), createdAt: Date.now() };
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(profile));
    return profile;
  };

  const createNewProfile = (nickname, gelato) => {
    const createdAt = Date.now();
    const base = nickname.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'user';
    const id = `${base}-${Math.floor(createdAt / 1000)}`;
    const profiles = getProfiles();
    if (profiles.some(p => p.nickname.toLowerCase() === nickname.toLowerCase())) {
      return null;
    }
    const profile = { id, nickname: nickname.trim(), gelato: gelato.trim(), createdAt };
    profiles.push(profile);
    saveProfiles(profiles);
    saveUser(id, nickname, gelato);
    // RESET GAMIFICATION STATE per nuovo profilo e rimuovi chiavi residue
    try {
      // Rimuovi tutte le chiavi gamification residue
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith('badianiGamification.v3')) {
          localStorage.removeItem(k);
        }
      });
      // Azzera anche le schede aperte
      localStorage.removeItem('badiani_opened_cards');
      if (typeof defaultState !== 'undefined') {
        localStorage.setItem(`badianiGamification.v3:${id}`, JSON.stringify(defaultState));
      }
    } catch {}
    // Reload forzato per caricare solo lo stato nuovo
    setTimeout(() => { window.location.reload(true); }, 100);
    return profile;
  };

  const loginWithProfile = (nickname, gelato) => {
    const profiles = getProfiles();
    const found = profiles.find(p => p.nickname.toLowerCase() === nickname.toLowerCase() && p.gelato.toLowerCase() === gelato.toLowerCase());
    if (!found) return null;
    saveUser(found.id, found.nickname, found.gelato);
    return found;
  };

  const showGate = () => {
    bodyScrollLock.lock();
    const overlay = document.createElement('div');
    overlay.className = 'signup-gate';
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-labelledby', 'signup-title');
    overlay.style.cssText = `position: fixed; inset: 0; z-index: 99999; background: radial-gradient(1200px 600px at 20% -10%, rgba(33,64,152,0.12), transparent 60%), radial-gradient(900px 600px at 120% 50%, rgba(246,147,170,0.12), transparent 60%), rgba(248, 250, 255, 0.95); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center;`;

    const card = document.createElement('div');
    card.className = 'signup-card';
    card.style.cssText = `width: min(92vw, 480px); background: #fff; border-radius: 16px; box-shadow: 0 16px 44px rgba(15,33,84,0.18); padding: 24px; color: var(--ink, #0f2154);`;

    card.innerHTML = `
      <h2 id="signup-title" style="margin:0 0 16px 0; font-size:24px; font-family: var(--font-medium);">Badiani Training</h2>
      <div style="display:flex; gap:12px; margin-bottom:16px;">
        <button type="button" data-tab="signup" class="tab-btn is-active" style="flex:1; padding:10px; border-radius:10px; border:2px solid #214098; background:#214098; color:#fff; font-weight:600; cursor:pointer;">Iscrizione</button>
        <button type="button" data-tab="login" class="tab-btn" style="flex:1; padding:10px; border-radius:10px; border:2px solid #d1d5db; background:transparent; color:#0f2154; font-weight:600; cursor:pointer;">Accedi</button>
      </div>
      <div data-panel="signup" style="display:block;">
        <p style="margin:0 0 16px 0; color: var(--brand-gray-soft, #6b7280);">Crea un nuovo profilo con il tuo nickname e gusto di gelato preferito.</p>
        <form data-form="signup" novalidate>
          <label style="display:block; font-weight:600; margin-bottom:6px;">Nickname</label>
          <input type="text" data-input="nickname" name="nickname" placeholder="Es. StellaRosa" required style="width:100%; padding:12px 14px; border:1px solid #d1d5db; border-radius:10px; font-size:16px; margin-bottom:14px;" />
          <label style="display:block; font-weight:600; margin-bottom:6px;">Gusto gelato preferito</label>
          <input type="text" data-input="gelato" name="gelato" placeholder="Es. Buontalenti" required style="width:100%; padding:12px 14px; border:1px solid #d1d5db; border-radius:10px; font-size:16px; margin-bottom:18px;" />
          <p data-error style="margin:0 0 12px 0; color:#b91c1c; display:none; font-size:14px;"></p>
          <button type="submit" style="padding:10px 14px; border-radius:10px; background:#214098; color:#fff; border:none; font-weight:600; cursor:pointer;">Iscriviti</button>
        </form>
      </div>
      <div data-panel="login" style="display:none;">
        <p style="margin:0 0 16px 0; color: var(--brand-gray-soft, #6b7280);">Accedi con il tuo nickname e gusto di gelato.</p>
        <form data-form="login" novalidate>
          <label style="display:block; font-weight:600; margin-bottom:6px;">Nickname</label>
          <input type="text" data-input="nickname" name="nickname" placeholder="Es. StellaRosa" required style="width:100%; padding:12px 14px; border:1px solid #d1d5db; border-radius:10px; font-size:16px; margin-bottom:14px;" />
          <label style="display:block; font-weight:600; margin-bottom:6px;">Gusto gelato preferito</label>
          <input type="text" data-input="gelato" name="gelato" placeholder="Es. Buontalenti" required style="width:100%; padding:12px 14px; border:1px solid #d1d5db; border-radius:10px; font-size:16px; margin-bottom:18px;" />
          <p data-error style="margin:0 0 12px 0; color:#b91c1c; display:none; font-size:14px;"></p>
          <button type="submit" style="padding:10px 14px; border-radius:10px; background:#214098; color:#fff; border:none; font-weight:600; cursor:pointer;">Accedi</button>
        </form>
      </div>
      <p style="margin-top:12px; font-size:12px; color:var(--brand-gray-soft, #6b7280);">I dati sono salvati solo su questo dispositivo.</p>
    `;

    const tabBtns = Array.from(card.querySelectorAll('[data-tab]'));
    const panels = Array.from(card.querySelectorAll('[data-panel]'));
    const signupForm = card.querySelector('[data-form="signup"]');
    const loginForm = card.querySelector('[data-form="login"]');

    const switchTab = (targetTab) => {
      tabBtns.forEach(btn => {
        const isActive = btn.dataset.tab === targetTab;
        btn.classList.toggle('is-active', isActive);
        btn.style.cssText = isActive ? 'flex:1; padding:10px; border-radius:10px; border:2px solid #214098; background:#214098; color:#fff; font-weight:600; cursor:pointer;' : 'flex:1; padding:10px; border-radius:10px; border:2px solid #d1d5db; background:transparent; color:#0f2154; font-weight:600; cursor:pointer;';
      });
      panels.forEach(p => {
        p.style.display = (p.dataset.panel === targetTab) ? 'block' : 'none';
      });
      const focusInput = card.querySelector(`[data-form="${targetTab}"] [data-input="nickname"]`);
      if (focusInput) focusInput.focus();
    };

    tabBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        switchTab(btn.dataset.tab);
      });
    });

    if (signupForm) {
      const submitBtn = signupForm.querySelector('button[type="submit"]');
      
      signupForm.addEventListener('submit', (e) => {
        e.preventDefault();
        console.log('Signup form submitted');
        const nicknameInput = signupForm.querySelector('[data-input="nickname"]');
        const gelatoInput = signupForm.querySelector('[data-input="gelato"]');
        const error = signupForm.querySelector('[data-error]');
        const nickname = nicknameInput?.value.trim() || '';
        const gelato = gelatoInput?.value.trim() || '';

        console.log('Nickname:', nickname, 'Gelato:', gelato);

        if (nickname.length < 2 || gelato.length < 2) {
          if (error) {
            error.style.display = 'block';
            error.textContent = 'Compila entrambi i campi (minimo 2 caratteri).';
          }
          alert('Errore: Compila entrambi i campi (minimo 2 caratteri).');
          return;
        }
        const result = createNewProfile(nickname, gelato);
        console.log('createNewProfile result:', result);
        if (!result) {
          if (error) {
            error.style.display = 'block';
            error.textContent = 'Questo nickname è già in uso. Scegline un altro.';
          }
          alert('Errore: Questo nickname è già in uso. Scegline un altro.');
          return;
        }
        alert('Registrazione riuscita! Benvenuto/a ' + nickname + '. Ricarico la pagina...');
        console.log('User created successfully, reloading...');
        overlay.remove();
        bodyScrollLock.unlock();
        try { window.location.reload(); } catch {}
      });

      if (submitBtn) {
        submitBtn.addEventListener('click', (e) => {
          e.preventDefault();
          console.log('Submit button clicked');
          signupForm.dispatchEvent(new Event('submit', { bubbles: true }));
        });
      }
    }

    if (loginForm) {
      const submitBtn = loginForm.querySelector('button[type="submit"]');
      
      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        console.log('Login form submitted');
        const nicknameInput = loginForm.querySelector('[data-input="nickname"]');
        const gelatoInput = loginForm.querySelector('[data-input="gelato"]');
        const error = loginForm.querySelector('[data-error]');
        const nickname = nicknameInput?.value.trim() || '';
        const gelato = gelatoInput?.value.trim() || '';

        console.log('Login - Nickname:', nickname, 'Gelato:', gelato);

        if (nickname.length < 2 || gelato.length < 2) {
          if (error) {
            error.style.display = 'block';
            error.textContent = 'Compila entrambi i campi.';
          }
          alert('Errore: Compila entrambi i campi.');
          return;
        }
        const result = loginWithProfile(nickname, gelato);
        console.log('loginWithProfile result:', result);
        if (!result) {
          if (error) {
            error.style.display = 'block';
            error.textContent = 'Profilo non trovato. Controlla nickname e gusto.';
          }
          alert('Errore: Profilo non trovato. Controlla nickname e gusto.');
          return;
        }
        alert('Login riuscito! Bentornato/a ' + nickname + '. Ricarico la pagina...');
        console.log('Login successful, reloading...');
        overlay.remove();
        bodyScrollLock.unlock();
        try { window.location.reload(); } catch {}
      });

      if (submitBtn) {
        submitBtn.addEventListener('click', (e) => {
          e.preventDefault();
          console.log('Login submit button clicked');
          loginForm.dispatchEvent(new Event('submit', { bubbles: true }));
        });
      }
    }

    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') e.preventDefault();
    });

    overlay.appendChild(card);
    document.body.appendChild(overlay);
    signupForm.querySelector('[data-input="nickname"]')?.focus({ preventScroll: true });
  };

  const init = () => {
    const user = getUser();
    if (!user) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', showGate);
      } else {
        showGate();
      }
    }
  };

  init();
})();

const sectionActivators = new Map();

const registerSectionActivator = (id, activator) => {
  if (!id || typeof activator !== 'function') return;
  const existing = sectionActivators.get(id) || [];
  existing.push(activator);
  sectionActivators.set(id, existing);
};

const activateSectionById = (id, options) => {
  if (!id) return;
  const activators = sectionActivators.get(id);
  if (!activators) return;
  activators.forEach((fn) => fn(options));
};

const scrollButtons = document.querySelectorAll('[data-scroll]');
scrollButtons.forEach((btn) => {
  const targetId = btn.getAttribute('data-scroll');
  btn.addEventListener('click', () => {
    if (targetId) {
      activateSectionById(targetId, { scroll: false });
    }
    const target = document.getElementById(targetId);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

// Search catalog: auto-extract guide cards from each page and persist them.
// This keeps the menu search results aligned with “nuove schede” without hardcoding.
(() => {
  const KEY = 'badianiSearchCatalog.v2';

  const getPageKey = () => {
    try {
      return (location.pathname || '').split('/').pop() || '';
    } catch {
      return '';
    }
  };

  const slugify = (value = '') => {
    return (value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '') || '';
  };

  const load = () => {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return { pages: {} };
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return { pages: {} };
      return {
        updatedAt: parsed.updatedAt || '',
        pages: (parsed.pages && typeof parsed.pages === 'object') ? parsed.pages : {},
      };
    } catch {
      return { pages: {} };
    }
  };

  const save = (catalog) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(catalog));
    } catch {
      /* ignore */
    }
  };

  const hydrate = () => {
    const pageKey = getPageKey();
    if (!pageKey || /^(index|index_new)\.html$/i.test(pageKey)) return;

    const category = document.querySelector('h1')?.textContent?.trim()
      || document.title?.split('·')[0]?.trim()
      || pageKey.replace(/\.html$/i, '');

    const cards = Array.from(document.querySelectorAll('.guide-card'))
      .map((card) => {
        const title = card?.querySelector?.('h3')?.textContent?.trim() || '';
        if (!title) return null;
        const cardKey = slugify(title);
        if (!cardKey) return null;

        // Lightweight keyword indexing: allow searching by intent words even when
        // they appear only inside tags/details (e.g. “Upselling”, “Sicurezza”, “Chiusura”).
        let text = '';
        try {
          const tagText = Array.from(card.querySelectorAll('.tag-row .tag'))
            .map((n) => n.textContent || '')
            .join(' ');
          const detailsText = card.querySelector('.details')?.textContent || '';
          text = `${title} ${tagText} ${detailsText}`;
        } catch {
          text = title;
        }
        const norm = (text || '').toLowerCase();
        const signals = {
          sicurezza: norm.includes('sicurezza') || norm.includes('safety'),
          chiusura: norm.includes('chiusura') || norm.includes('closing'),
          upselling: norm.includes('upselling') || norm.includes('upsell'),
        };

        return { title, cardKey, signals };
      })
      .filter(Boolean);

    if (!cards.length) return;

    const catalog = load();
    catalog.pages[pageKey] = {
      href: pageKey,
      category,
      cards,
      updatedAt: new Date().toISOString(),
    };
    catalog.updatedAt = new Date().toISOString();
    save(catalog);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hydrate, { once: true });
  } else {
    hydrate();
  }
})();

(() => {
  const drawer = document.querySelector('[data-menu-drawer]');
  const closers = document.querySelectorAll('[data-menu-close]');
  const menuLinks = drawer?.querySelectorAll('.menu-categories a');
  const moodLine = drawer?.querySelector('[data-menu-mood]');
  const searchInput = drawer?.querySelector('[data-menu-search]');
  const searchSuggestions = drawer?.querySelector('[data-menu-suggestions]');
  const COMPLETION_KEY_PREFIX = 'badianiCategoryCompletion.v1';
  const GAMIFICATION_KEY_PREFIX = 'badianiGamification.v3';
  const moods = [
    'Coraggio: ogni servizio è un racconto.',
    'Brilla: i dettagli fanno la differenza.',
    'Energia gentile: sorridi e guida l’esperienza.',
    'Precisione oggi, eccellenza domani.',
    'Servi bellezza: cura, ritmo, calore umano.',
    'Ogni caffè è una promessa mantenuta.',
  ];
  let lastMood = '';
  
  if (!drawer) return;

  const pickMood = () => {
    if (!moods.length) return '';
    let next = moods[Math.floor(Math.random() * moods.length)];
    if (moods.length > 1 && next === lastMood) {
      next = moods[(Math.floor(Math.random() * (moods.length - 1)) + 1) % moods.length];
    }
    lastMood = next;
    return next;
  };

  const normalize = (str) => (str || '').toLowerCase().trim();

  const normalizeQuery = (value) => {
    const q = normalize(value);
    if (!q) return { q, qAlt: '' };
    // Small typo-tolerance for common training keywords.
    // Keep it intentionally conservative to avoid surprising matches.
    const fixes = {
      'sicurecca': 'sicurezza',
      'sicurezze': 'sicurezza',
      'upsell': 'upselling',
    };
    const qAlt = fixes[q] || '';
    return { q, qAlt };
  };

  const GENERIC_CATEGORY_KEYWORDS = [
    'sicurezza',
    'sicurecca',
    'chiusura',
    'upselling',
    'upsell',
  ];

  // NOTE: Despite the name, this returns the *weekly* stamp used for resets.
  // A new stamp starts at local Sunday 00:00.
  const getDayStamp = (date = new Date()) => {
    try {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      // getDay(): 0=Sunday ... 6=Saturday
      d.setDate(d.getDate() - d.getDay());
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    } catch {
      return '';
    }
  };

  const getActiveProfileId = () => {
    try {
      const raw = localStorage.getItem('badianiUser.profile.v1');
      if (!raw) return 'guest';
      const p = JSON.parse(raw);
      return p?.id || 'guest';
    } catch {
      return 'guest';
    }
  };

  const completionKey = () => `${COMPLETION_KEY_PREFIX}:${getActiveProfileId()}`;
  const gamificationKey = () => `${GAMIFICATION_KEY_PREFIX}:${getActiveProfileId()}`;

  const loadCompletion = () => {
    const today = getDayStamp();
    try {
      const raw = localStorage.getItem(completionKey());
      if (!raw) return { dayStamp: today, completed: {} };
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return { dayStamp: today, completed: {} };
      if (parsed.dayStamp !== today) return { dayStamp: today, completed: {} };
      return {
        dayStamp: today,
        completed: (parsed.completed && typeof parsed.completed === 'object') ? parsed.completed : {},
      };
    } catch {
      return { dayStamp: today, completed: {} };
    }
  };

  const saveCompletion = (value) => {
    try {
      localStorage.setItem(completionKey(), JSON.stringify(value));
    } catch {
      /* ignore */
    }
  };

  const normalizeLegacyCardId = (id) => {
    try {
      if (!id) return '';
      return String(id).replace(/-\d+$/g, '');
    } catch {
      return '';
    }
  };

  const loadOpenedBaseIdsToday = () => {
    const today = getDayStamp();
    try {
      const raw = localStorage.getItem(gamificationKey()) || localStorage.getItem(GAMIFICATION_KEY_PREFIX) || '';
      if (!raw) return new Set();
      const parsed = JSON.parse(raw);
      const opened = parsed?.openedToday && typeof parsed.openedToday === 'object'
        ? parsed.openedToday
        : {};
      const out = new Set();
      Object.keys(opened).forEach((key) => {
        const ts = opened[key];
        if (!ts) return;
        try {
          if (getDayStamp(new Date(ts)) !== today) return;
        } catch {
          return;
        }
        const base = normalizeLegacyCardId(key);
        if (base) out.add(base);
      });
      return out;
    } catch {
      return new Set();
    }
  };

  const loadStarredBaseIdsToday = () => {
    const today = getDayStamp();
    try {
      const raw = localStorage.getItem(gamificationKey()) || localStorage.getItem(GAMIFICATION_KEY_PREFIX) || '';
      if (!raw) return new Set();
      const parsed = JSON.parse(raw);
      const converted = parsed?.cardCrystalConvertedAtToday && typeof parsed.cardCrystalConvertedAtToday === 'object'
        ? parsed.cardCrystalConvertedAtToday
        : {};
      const out = new Set();
      Object.keys(converted).forEach((key) => {
        const ts = converted[key];
        if (!ts) return;
        try {
          if (getDayStamp(new Date(ts)) !== today) return;
        } catch {
          return;
        }
        const base = normalizeLegacyCardId(key);
        if (base) out.add(base);
      });
      return out;
    } catch {
      return new Set();
    }
  };

  const syncCompletionFromGamificationState = () => {
    // Compute completion for all known categories so stars can appear in the drawer even on index.html.
    const totalsBySlug = {
      'caffe': 18,
      'sweet-treats': 10,
      'pastries': 6,
      'slitti-yoyo': 7,
      'gelato-lab': 8,
      'festive': 10,
      'story-orbit': 5,
    };
    const fileBySlug = {
      'caffe': 'caffe.html',
      'sweet-treats': 'sweet-treats.html',
      'pastries': 'pastries.html',
      'slitti-yoyo': 'slitti-yoyo.html',
      'gelato-lab': 'gelato-lab.html',
      'festive': 'festive.html',
      'story-orbit': 'story-orbit.html',
    };

    const starred = loadStarredBaseIdsToday();
    const opened = loadOpenedBaseIdsToday();
    const completion = loadCompletion();
    let changed = false;

    Object.keys(totalsBySlug).forEach((slug) => {
      const total = totalsBySlug[slug] || 0;
      if (!total) return;
      const pageKey = fileBySlug[slug] || '';
      if (!pageKey) return;
      let starredCount = 0;
      starred.forEach((baseId) => {
        if (baseId.startsWith(`${slug}-`)) starredCount += 1;
      });
      let openedCount = 0;
      opened.forEach((baseId) => {
        if (baseId.startsWith(`${slug}-`)) openedCount += 1;
      });

      // Consider a category completed if all cards were opened today OR all cards
      // were fully starred today. This matches the on-page badge (e.g. 7/7 opened)
      // and still rewards full tab completion.
      const isComplete = (openedCount >= total) || (starredCount >= total);
      const prev = !!completion.completed[pageKey];
      if (isComplete && !prev) {
        completion.completed[pageKey] = true;
        changed = true;
      }
      // IMPORTANT: completion should be monotonic within the same day.
      // Avoid deleting a completion flag here: a conservative approach prevents
      // edge cases where counting differs across pages / DOM order and would
      // otherwise hide the badge after it was legitimately earned.
    });

    if (changed) {
      saveCompletion(completion);
    }
  };

  const pageKeyFromHref = (href) => {
    try {
      if (!href) return '';
      const url = new URL(href, window.location.href);
      return (url.pathname || '').split('/').pop() || '';
    } catch {
      // Relative or malformed href: best-effort fallback.
      try {
        const cleaned = String(href).split('#')[0].split('?')[0];
        return cleaned.split('/').pop() || '';
      } catch {
        return '';
      }
    }
  };

  const applyCategoryCompletionStars = () => {
    if (!menuLinks || !menuLinks.length) return;
    syncCompletionFromGamificationState();
    const { completed } = loadCompletion();
    menuLinks.forEach((link) => {
      const href = link.getAttribute('href');
      const pageKey = pageKeyFromHref(href);
      const isComplete = !!(pageKey && completed && completed[pageKey]);
      const existing = link.querySelector('.menu-category__star');

      if (isComplete) {
        link.setAttribute('data-category-complete', 'true');
        if (!existing) {
          const star = document.createElement('span');
          star.className = 'menu-category__star';
          star.setAttribute('aria-hidden', 'true');
          star.textContent = '★';
          link.appendChild(star);
        }
      } else {
        link.removeAttribute('data-category-complete');
        if (existing) existing.remove();
      }
    });
  };

  const loadSearchCatalogPages = () => {
    try {
      const rawV2 = localStorage.getItem('badianiSearchCatalog.v2');
      const rawV1 = localStorage.getItem('badianiSearchCatalog.v1');
      const raw = rawV2 || rawV1;
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return {};
      return (parsed.pages && typeof parsed.pages === 'object') ? parsed.pages : {};
    } catch {
      return {};
    }
  };

  const buildCatalogProducts = () => {
    const pages = loadSearchCatalogPages();
    const out = [];
    Object.keys(pages).forEach((pageKey) => {
      const page = pages[pageKey];
      const category = (page?.category || '').trim() || pageKey.replace(/\.html$/i, '');
      const href = (page?.href || pageKey).trim() || pageKey;
      const cards = Array.isArray(page?.cards) ? page.cards : [];
      cards.forEach((card) => {
        const title = (card?.title || '').trim();
        const cardKey = (card?.cardKey || '').trim();
        if (!title || !cardKey) return;
        const s = (card?.signals && typeof card.signals === 'object') ? card.signals : {};
        const intents = [
          s.sicurezza ? 'sicurezza' : '',
          s.chiusura ? 'chiusura' : '',
          s.upselling ? 'upselling' : '',
        ].filter(Boolean).join(' ');
        out.push({
          name: normalize(`${title} ${category} ${intents}`),
          label: title,
          category,
          categoryHref: href,
          card: cardKey,
          description: intents ? `Scheda · ${intents}` : 'Scheda',
        });
      });
    });
    return out;
  };

  const hardcodedProducts = [
    // Caffè Rituals - all drinks
    { name: 'americano', label: 'Americano', category: 'Caffè Rituals', categoryHref: 'caffe.html', tab: 'espresso-core', description: 'Diluito' },
    { name: 'cappuccino', label: 'Cappuccino', category: 'Caffè Rituals', categoryHref: 'caffe.html', tab: 'milk', description: 'Foam classico' },
    { name: 'flat white', label: 'Flat White', category: 'Caffè Rituals', categoryHref: 'caffe.html', tab: 'milk', description: 'Latte vellutato' },
    { name: 'chai latte dirty', label: 'Chai Latte', category: 'Caffè Rituals', categoryHref: 'caffe.html', tab: 'signature', description: 'Speziato (Dirty optional)' },
    { name: 'mocha cioccolato caffè', label: 'Mocha', category: 'Caffè Rituals', categoryHref: 'caffe.html', tab: 'signature', description: 'Con cioccolato' },
    { name: 'hot chocolate cioccolata calda', label: 'Hot Chocolate', category: 'Caffè Rituals', categoryHref: 'caffe.html', tab: 'signature', description: 'Cremosa' },
    { name: 'iced americano freddo', label: 'Iced Americano', category: 'Caffè Rituals', categoryHref: 'caffe.html', tab: 'freddo', description: 'Freddo' },
    { name: 'iced latte freddo', label: 'Iced Latte', category: 'Caffè Rituals', categoryHref: 'caffe.html', tab: 'freddo', description: 'Ghiacciato' },
    { name: 'pistachio iced latte pistacchio freddo', label: 'Pistachio Iced Latte', category: 'Caffè Rituals', categoryHref: 'caffe.html', tab: 'freddo', description: 'Signature' },
    { name: 'cioccolata calda classica', label: 'Cioccolata Calda Classica', category: 'Caffè Rituals', categoryHref: 'caffe.html', tab: 'signature', description: 'Ricetta classica' },
    { name: 'cioccolata calda pistacchio', label: 'Cioccolata Calda Pistacchio', category: 'Caffè Rituals', categoryHref: 'caffe.html', tab: 'signature', description: 'Variante pistacchio' },
    { name: 'cioccolata calda pistacchio kids', label: 'Cioccolata Calda Pistacchio Kids', category: 'Caffè Rituals', categoryHref: 'caffe.html', tab: 'signature', description: 'Formato kids' },
    { name: 'cioccolata classica kids', label: 'Cioccolata Classica Kids', category: 'Caffè Rituals', categoryHref: 'caffe.html', tab: 'signature', description: 'Formato kids' },
    { name: 'cioccolata calda affogato', label: 'Cioccolata Calda Affogato', category: 'Caffè Rituals', categoryHref: 'caffe.html', tab: 'signature', description: 'Twist caldo/freddo' },
    { name: 'pistachio hot', label: 'Pistachio Hot', category: 'Caffè Rituals', categoryHref: 'caffe.html', tab: 'signature', description: 'Comfort drink' },
    { name: 'tea', label: 'Tea', category: 'Caffè Rituals', categoryHref: 'caffe.html', tab: 'signature', description: 'Tè' },
    { name: 'whipped coffee panna', label: 'Whipped Coffee', category: 'Caffè Rituals', categoryHref: 'caffe.html', tab: 'signature', description: 'Espresso + panna' },
    { name: 'affogato gelato caffè', label: 'Affogato', category: 'Caffè Rituals', categoryHref: 'caffe.html', tab: 'signature', description: 'Gelato + espresso' },
    // Sweet Treats
    { name: 'base crepe dolce', label: 'Base Crepe', category: 'Sweet Treat Atelier', categoryHref: 'sweet-treats.html', tab: 'crepe', description: 'Crepe semplice' },
    { name: 'signature buontalenti crepe', label: 'Signature Buontalenti Crepe', category: 'Sweet Treat Atelier', categoryHref: 'sweet-treats.html', tab: 'crepe', description: 'Crepe signature' },
    { name: 'crepe italiana dolce', label: 'Crepe Italiana', category: 'Sweet Treat Atelier', categoryHref: 'sweet-treats.html', tab: 'crepe', description: 'Crepe italiana' },
    { name: 'crepe prosciutto salata', label: 'Crepe Prosciutto', category: 'Sweet Treat Atelier', categoryHref: 'sweet-treats.html', tab: 'crepe', description: 'Con prosciutto' },
    { name: 'waffles dolce', label: 'Waffles', category: 'Sweet Treat Atelier', categoryHref: 'sweet-treats.html', tab: 'warm', description: 'Waffle' },
    { name: 'pancake stack dolce', label: 'Pancake Stack', category: 'Sweet Treat Atelier', categoryHref: 'sweet-treats.html', tab: 'warm', description: 'Pancake' },
    { name: 'porridge bowl colazione', label: 'Porridge Bowl', category: 'Sweet Treat Atelier', categoryHref: 'sweet-treats.html', tab: 'warm', description: 'Porridge' },
    { name: 'gelato burger gelato pane', label: 'Gelato Burger', category: 'Sweet Treat Atelier', categoryHref: 'sweet-treats.html', tab: 'gelato-bread', description: 'Gelato in pane' },
    { name: 'gelato croissant dolce', label: 'Gelato Croissant', category: 'Sweet Treat Atelier', categoryHref: 'sweet-treats.html', tab: 'gelato-bread', description: 'Croissant gelato' },
    { name: 'afternoon tea signature', label: 'Afternoon Tea Signature', category: 'Sweet Treat Atelier', categoryHref: 'sweet-treats.html', tab: 'ritual', description: 'Tea time' },
    // Gelato Lab
    { name: 'coppette gelato coni', label: 'Coppette', category: 'Gelato Lab', categoryHref: 'gelato-lab.html', tab: 'cups', description: 'Coppa gelato' },
    { name: 'coni classici gelato', label: 'Coni classici', category: 'Gelato Lab', categoryHref: 'gelato-lab.html', tab: 'cups', description: 'Cono gelato' },
    { name: 'gelato boxes asporto', label: 'Gelato Boxes', category: 'Gelato Lab', categoryHref: 'gelato-lab.html', tab: 'boxes', description: 'Box gelato' },
    { name: 'coppa gelato dolce', label: 'Coppa Gelato', category: 'Gelato Lab', categoryHref: 'gelato-lab.html', tab: 'treats', description: 'Coppa speciale' },
    // Pastries
    { name: 'cakes dolce torta', label: 'Cakes', category: 'Pastry Lab', categoryHref: 'pastries.html', tab: 'cakes', description: 'Dolci' },
    { name: 'brownie tray dolce', label: 'Brownie Tray', category: 'Pastry Lab', categoryHref: 'pastries.html', tab: 'cakes', description: 'Brownies' },
    { name: 'banana loaf dolce pane', label: 'Banana / altri loaf', category: 'Pastry Lab', categoryHref: 'pastries.html', tab: 'cakes', description: 'Banana bread' },
    { name: 'croissant farciti dolce', label: 'Croissant farciti', category: 'Pastry Lab', categoryHref: 'pastries.html', tab: 'croissants', description: 'Croissant riempiti' },
    { name: 'scone buontalenti dolce', label: 'Scone con Buontalenti', category: 'Pastry Lab', categoryHref: 'pastries.html', tab: 'croissants', description: 'Scone' },
    // Slitti & Yo-Yo (cards)
    { name: 'timeline essenziale slitti storia premi', label: 'Timeline essenziale', category: 'Slitti & Yo-Yo', categoryHref: 'slitti-yoyo.html', card: 'timeline-essenziale', description: 'Storia e premi' },
    { name: 'tavolette lattenero gran cacao cioccolato', label: 'Tavolette LatteNero & Gran Cacao', category: 'Slitti & Yo-Yo', categoryHref: 'slitti-yoyo.html', card: 'tavolette-lattenero-gran-cacao', description: 'Cioccolato Slitti' },
    { name: 'minicake dolce slitti', label: 'Minicake', category: 'Slitti & Yo-Yo', categoryHref: 'slitti-yoyo.html', card: 'minicake', description: 'Mini torta' },
    { name: 'praline dragee cioccolato', label: 'Praline & Dragée', category: 'Slitti & Yo-Yo', categoryHref: 'slitti-yoyo.html', card: 'praline-drag-e', description: 'Praline' },
    { name: 'creme slittosa riccosa gianera dolce', label: 'Creme Slittosa / Riccosa / Gianera', category: 'Slitti & Yo-Yo', categoryHref: 'slitti-yoyo.html', card: 'creme-slittosa-riccosa-gianera', description: 'Creme Slitti' },
    { name: 'setup stock display fifo yoyo', label: 'Setup & stock', category: 'Slitti & Yo-Yo', categoryHref: 'slitti-yoyo.html', card: 'setup-stock', description: 'Display + FIFO' },
    { name: 'procedura servizio yoyo wafer tool', label: 'Procedura servizio', category: 'Slitti & Yo-Yo', categoryHref: 'slitti-yoyo.html', card: 'procedura-servizio', description: 'Step operativi' },
    // Festive
    { name: 'cottura perfetta churros frittura', label: 'Cottura perfetta', category: 'Festive & Churros', categoryHref: 'festive.html', tab: 'churros', description: 'Frittura' },
    { name: 'impiattamento upsell dolce', label: 'Impiattamento & upsell', category: 'Festive & Churros', categoryHref: 'festive.html', tab: 'churros', description: 'Presentazione' },
    { name: 'taglio presentazione panettone', label: 'Taglio & presentazione', category: 'Festive & Churros', categoryHref: 'festive.html', tab: 'mulled', description: 'Panettone' },
    { name: 'slice calda dolce', label: 'Slice calda', category: 'Festive & Churros', categoryHref: 'festive.html', tab: 'mulled', description: 'Fetta calda' },
    { name: 'piatto classico festivo', label: 'Piatto classico', category: 'Festive & Churros', categoryHref: 'festive.html', tab: 'mulled', description: 'Piatto' },
    { name: 'opzione calda festiva', label: 'Opzione calda', category: 'Festive & Churros', categoryHref: 'festive.html', tab: 'mulled', description: 'Opzione calda' },
    { name: 'mini panettone buontalenti dolce', label: 'Mini panettone con Buontalenti', category: 'Festive & Churros', categoryHref: 'festive.html', tab: 'mulled', description: 'Mini panettone' },
    { name: 'packaging take away panettone', label: 'Packaging take away', category: 'Festive & Churros', categoryHref: 'festive.html', tab: 'mulled', description: 'Confezione' },
    { name: 'mulled wine vin brule natale caldo', label: 'Mulled Wine', category: 'Festive & Churros', categoryHref: 'festive.html', tab: 'mulled', description: 'Vin brulé' },
    { name: 'churros frittura dolce', label: 'Churros', category: 'Festive & Churros', categoryHref: 'festive.html', tab: 'churros', description: 'Frittura' },
  ];

  // Merge (prefer catalog-derived cards, which stay in sync with new/updated pages).
  const allProducts = (() => {
    const catalogProducts = buildCatalogProducts();
    const catalogPages = loadSearchCatalogPages();
    const out = [];
    const seen = new Set();
    const pushUnique = (item) => {
      if (!item) return;
      const href = item.categoryHref || '';
      const keyPart = item.card || item.tab || item.label || item.name || '';
      const k = `${href}::${keyPart}`;
      if (seen.has(k)) return;
      seen.add(k);
      out.push(item);
    };

    // 1) Catalog-derived (fresh)
    catalogProducts.forEach(pushUnique);

    // 2) Hardcoded fallback only for pages not yet present in the catalog
    hardcodedProducts
      .filter((item) => {
        const pageKey = (item?.categoryHref || '').trim();
        return !(pageKey && catalogPages && catalogPages[pageKey]);
      })
      .forEach(pushUnique);

    return out;
  })();

  const menuItems = menuLinks
    ? Array.from(menuLinks).map((link) => ({
        name: normalize(link.textContent),
        label: (link.textContent || '').trim(),
        href: link.getAttribute('href'),
        isCategory: true,
      }))
    : [];

  let lastFiltered = [];

  const renderSuggestions = (query) => {
    if (!searchSuggestions) return;
    const { q, qAlt } = normalizeQuery(query);
    let filtered = [];
    
    if (q) {
      // Show both products and categories when user types
      const isGenericCategoryQuery = (() => {
        const hay = q || '';
        const hayAlt = qAlt || '';
        return GENERIC_CATEGORY_KEYWORDS.some((kw) => {
          if (!kw) return false;
          return hay.includes(kw) || (hayAlt && hayAlt.includes(kw));
        });
      })();
      const matchesQuery = (haystack) => {
        const h = normalize(haystack);
        if (!h) return false;
        if (h.includes(q)) return true;
        if (qAlt && h.includes(qAlt)) return true;
        return false;
      };

      const productMatches = allProducts.filter((item) => {
        return matchesQuery(item.name) || matchesQuery(item.category);
      });

      // For broad training keywords (es. sicurezza/chiusura/upselling), show categories too.
      // This helps the user jump to the right area even when the category name doesn't contain the keyword.
      const categoryMatches = isGenericCategoryQuery
        ? menuItems
        : menuItems.filter((cat) => matchesQuery(cat.name) || matchesQuery(cat.label));

      filtered = [...categoryMatches, ...productMatches];
    }
    // Don't show anything if query is empty - user must type to see suggestions.
    searchSuggestions.innerHTML = '';
    lastFiltered = filtered;
    if (!q) return;
    filtered.forEach((item, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'menu-search__suggestion';
      btn.style.setProperty('--i', idx);
      
      if (item.isCategory) {
        btn.textContent = item.label;
        btn.addEventListener('click', () => navigateTo(item.href));
      } else {
        const inner = document.createElement('span');
        const title = document.createElement('strong');
        title.textContent = item.label;
        const cat = document.createElement('small');
        cat.textContent = item.category;
        const desc = document.createElement('em');
        desc.textContent = item.description;
        inner.appendChild(title);
        inner.appendChild(document.createElement('br'));
        inner.appendChild(cat);
        inner.appendChild(document.createElement('br'));
        inner.appendChild(desc);
        btn.appendChild(inner);
        btn.dataset.href = item.categoryHref;
        if (item.tab) btn.dataset.tab = item.tab;
        if (item.card) btn.dataset.card = item.card;
        btn.addEventListener('click', () => {
          if (item.card) return navigateToCard(item.categoryHref, item.card);
          if (item.tab) return navigateToTab(item.categoryHref, item.tab);
          return navigateTo(item.categoryHref);
        });
      }
      searchSuggestions.appendChild(btn);
    });
    if (!filtered.length) {
      const empty = document.createElement('div');
      empty.className = 'menu-search__empty';
      empty.textContent = 'Nessun modulo trovato';
      searchSuggestions.appendChild(empty);
    }
  };

  const navigateToTab = (href, tabId) => {
    if (!href || !tabId) return;
    window.location.href = href + '?tab=' + tabId;
    closeDrawer();
  };

  const navigateToCard = (href, cardKey) => {
    if (!href || !cardKey) return;
    const card = encodeURIComponent(String(cardKey));
    window.location.href = href + '?card=' + card;
    closeDrawer();
  };

  const navigateTo = (href) => {
    if (!href) return;
    window.location.href = href;
    closeDrawer();
  };

  const handleSearchSubmit = () => {
    if (!allProducts.length && !menuItems.length) return;
    const q = normalize(searchInput?.value);
    if (!q) return;
    // Prefer what the user is actually seeing in the suggestion list.
    const target = (Array.isArray(lastFiltered) && lastFiltered.length)
      ? lastFiltered[0]
      : (allProducts.find((item) => item.name.includes(q)) || menuItems.find((item) => item.name.includes(q)));
    if (!target) return;
    if (target.isCategory) return navigateTo(target.href);
    if (target.card) return navigateToCard(target.categoryHref, target.card);
    if (target.tab) return navigateToTab(target.categoryHref, target.tab);
    return navigateTo(target.categoryHref);
  };

  const openDrawer = () => {
    if (moodLine) {
      const mood = pickMood();
      if (mood) moodLine.textContent = mood;
    }
    applyCategoryCompletionStars();
    renderSuggestions(searchInput?.value || '');
    drawer.setAttribute('aria-hidden', 'false');
    bodyScrollLock.lock();
  };

  const closeDrawer = () => {
    drawer.setAttribute('aria-hidden', 'true');
    bodyScrollLock.unlock();
  };

  // Toggle menu on nav menu button
  document.addEventListener('click', (e) => {
    const menuBtn = e.target.closest('[data-menu-toggle]');
    if (menuBtn) {
      const isOpen = drawer.getAttribute('aria-hidden') === 'false';
      if (isOpen) {
        closeDrawer();
      } else {
        openDrawer();
      }
    }
  });
  
  closers.forEach(closer => {
    closer.addEventListener('click', closeDrawer);
  });

  // Close on category link click
  menuLinks?.forEach(link => {
    link.addEventListener('click', closeDrawer);
  });

  // Don't pre-render suggestions - only show on user input

  drawer.addEventListener('click', (e) => {
    if (e.target === drawer.querySelector('.menu-drawer__overlay')) {
      closeDrawer();
    }
  });

  if (searchInput) {
    searchInput.addEventListener('input', () => renderSuggestions(searchInput.value));
    searchInput.addEventListener('focus', () => renderSuggestions(searchInput.value));
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSearchSubmit();
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer.getAttribute('aria-hidden') === 'false') {
      closeDrawer();
    }
  });

  // If completion changes while the drawer is open, refresh the indicators.
  document.addEventListener('badiani:category-completion-updated', () => {
    if (drawer.getAttribute('aria-hidden') === 'false') {
      applyCategoryCompletionStars();
    }
  });
})();

// ============================================================
// MOBILE-FIRST NAV: fallback menu panel (used on index.html)
// ============================================================
// Some pages ship a full-screen drawer ([data-menu-drawer]) while the home page
// uses a simpler overlay panel ([data-menu-panel]). The drawer handler returns
// early when the drawer isn't present, so ensure the panel works too.
(() => {
  const drawer = document.querySelector('[data-menu-drawer]');
  if (drawer) return;

  const panel = document.querySelector('[data-menu-panel]');
  if (!panel) return;

  const toggles = Array.from(document.querySelectorAll('[data-menu-toggle]'));
  if (!toggles.length) return;

  let lastFocus = null;

  const setExpanded = (expanded) => {
    toggles.forEach((btn) => {
      try {
        btn.setAttribute('aria-expanded', String(expanded));
      } catch (e) {}
    });
  };

  const open = () => {
    if (panel.classList.contains('is-open')) return;
    lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.classList.add('is-open');
    panel.setAttribute('aria-hidden', 'false');
    setExpanded(true);
    bodyScrollLock.lock();
    requestAnimationFrame(() => {
      const focusable = panel.querySelector('a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (focusable) focusable.focus({ preventScroll: true });
    });
  };

  const close = () => {
    if (!panel.classList.contains('is-open')) return;
    panel.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
    setExpanded(false);
    bodyScrollLock.unlock();
    if (lastFocus) {
      try { lastFocus.focus({ preventScroll: true }); } catch (e) {}
      lastFocus = null;
    }
  };

  const toggle = () => {
    if (panel.classList.contains('is-open')) close();
    else open();
  };

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-menu-toggle]');
    if (btn) {
      e.preventDefault();
      toggle();
      return;
    }

    // click on backdrop closes (panel root is the backdrop)
    if (panel.classList.contains('is-open') && e.target === panel) {
      close();
      return;
    }

    // clicking a link inside closes
    if (panel.classList.contains('is-open') && e.target.closest('a')) {
      close();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
})();

(() => {
  const nav = document.querySelector('.nav-shell');
  if (!nav) return;
  const brandImg = nav.querySelector('.brand-avatar');
  const defaultLogo = brandImg ? brandImg.getAttribute('data-default-src') || brandImg.getAttribute('src') : null;
  const altLogo = brandImg ? brandImg.getAttribute('data-alt-src') || 'assets/brand/logo-avatar.svg' : null;
  let ticking = false;
  let isShrunk = false;
  const shrinkThreshold = 90;
  const expandThreshold = 50; // hysteresis to prevent flicker near top

  const handleScroll = () => {
    const scrollY = window.scrollY || window.pageYOffset;
    if (!isShrunk && scrollY > shrinkThreshold) {
      isShrunk = true;
      nav.classList.add('is-shrunk');
      if (brandImg && altLogo && brandImg.getAttribute('src') !== altLogo) {
        brandImg.setAttribute('src', altLogo);
      }
    } else if (isShrunk && scrollY < expandThreshold) {
      isShrunk = false;
      nav.classList.remove('is-shrunk');
      if (brandImg && defaultLogo && brandImg.getAttribute('src') !== defaultLogo) {
        brandImg.setAttribute('src', defaultLogo);
      }
    }
    ticking = false;
  };

  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(handleScroll);
      ticking = true;
    }
  }, { passive: true });

  // Initialize state on load to avoid flash
  handleScroll();
})();

const gamification = (() => {
  const isStoryOrbitPage = (() => {
    try {
      if (/story-orbit\.html/i.test(location.pathname || '')) return true;
    } catch {}
    return document.body?.classList?.contains('page-story-orbit') || !!document.querySelector('[data-story-modal]');
  })();
  const STORAGE_KEY_PREFIX = 'badianiGamification.v3';
  const GLOBAL_KEY = 'badianiGamification.v3';
  const getActiveProfile = () => {
    try {
      const raw = localStorage.getItem('badianiUser.profile.v1');
      if (!raw) return null;
      const p = JSON.parse(raw);
      return p?.id ? p : null;
    } catch { return null; }
  };
  const storageKey = () => {
    const prof = getActiveProfile();
    const id = prof?.id || 'guest';
    return `${STORAGE_KEY_PREFIX}:${id}`;
  };
  const STARS_FOR_QUIZ = 3;
  const CRYSTALS_PER_STAR = 5;
  const MAX_STARS = 65;

  // Story Orbit uses a “virtual card” to convert 5 crystals -> 1 star.
  // Separately, we mark 5 pseudo-steps as opened today so the page badge and
  // drawer completion indicator can show 0/5 -> 5/5 like other categories.
  const STORY_ORBIT_MAIN_CARD_ID = 'story-orbit-story-experience-1';
  const storyOrbitStepCardId = (stepKey) => `story-orbit-step-${String(stepKey || 'step')}-1`;

  let audioContext = null;

  // Global audio unlocker to ensure context is ready on first touch
  const unlockAudioContext = () => {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    
    if (!audioContext) {
      audioContext = new AudioCtor();
    }
    if (audioContext.state === 'suspended') {
      audioContext.resume().then(() => {
        // Remove listeners once unlocked
        ['click', 'touchstart', 'keydown'].forEach(evt => 
          document.removeEventListener(evt, unlockAudioContext)
        );
      }).catch(() => {});
    }
  };
  ['click', 'touchstart', 'keydown'].forEach(evt => 
    document.addEventListener(evt, unlockAudioContext)
  );

  const playTabOpenSound = () => {
    try {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return;

      if (!audioContext) {
        audioContext = new AudioCtor();
      }
      if (audioContext.state === 'suspended') {
        audioContext.resume().catch(() => {});
      }
      
      const now = audioContext.currentTime;
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      
      osc.connect(gain);
      gain.connect(audioContext.destination);
      
      // "Cute" UI Pop: High pitch sine wave
      osc.type = 'sine';
      
      // Pitch envelope: Quick rise (chirp)
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(1400, now + 0.1);
      
      // Volume envelope: Fast attack, fast decay
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.6, now + 0.02); // Louder attack
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      
      osc.start(now);
      osc.stop(now + 0.2);
    } catch (e) {}
  };

  const playCrystalSound = () => {
    try {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return;
      if (!audioContext) audioContext = new AudioCtor();
      if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});

      const now = audioContext.currentTime;
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();

      osc.connect(gain);
      gain.connect(audioContext.destination);

      // Crystal "Ting": High pitch sine with bell-like decay
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1800, now);
      osc.frequency.exponentialRampToValueAtTime(2200, now + 0.1);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.4, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

      osc.start(now);
      osc.stop(now + 0.5);
    } catch (e) {}
  };

  const playStarChime = (level = 1) => {
    try {
      if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioContext.state === 'suspended') audioContext.resume();

      const now = audioContext.currentTime;
      const masterGain = audioContext.createGain();
      masterGain.connect(audioContext.destination);
      masterGain.gain.value = 0.15;

      // Nintendo-style "Get Item" fanfare (Square waves)
      // Arpeggio: C5, E5, G5, C6
      const notes = [523.25, 659.25, 783.99, 1046.50]; 
      
      notes.forEach((freq, i) => {
        const osc = audioContext.createOscillator();
        osc.type = 'square'; 
        osc.frequency.value = freq;
        osc.connect(masterGain);
        
        const start = now + (i * 0.08);
        const dur = 0.1;
        
        osc.start(start);
        osc.stop(start + dur);
      });
      
      // Final sustain note
      const finalOsc = audioContext.createOscillator();
      finalOsc.type = 'triangle';
      finalOsc.frequency.value = 1046.50; // C6
      finalOsc.connect(masterGain);
      finalOsc.start(now + 0.32);
      finalOsc.stop(now + 0.8);
      
      // Envelope
      masterGain.gain.setValueAtTime(0.15, now);
      masterGain.gain.setValueAtTime(0.15, now + 0.4);
      masterGain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);

    } catch (error) {
      console.warn('Audio playback not available', error);
    }
  };

  const playGelatoPop = () => {
    try {
      if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      const now = audioContext.currentTime;
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.frequency.setValueAtTime(600, now);
      oscillator.frequency.exponentialRampToValueAtTime(900, now + 0.08);
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.2, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      oscillator.start(now);
      oscillator.stop(now + 0.3);
    } catch (error) {
      console.warn('Audio playback not available', error);
    }
  };

  const playBonusTwinkle = () => {
    try {
      if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      const now = audioContext.currentTime;
      [0, 0.15, 0.3].forEach((offset) => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.frequency.setValueAtTime(800 + offset * 400, now + offset);
        osc.frequency.exponentialRampToValueAtTime(1600 + offset * 600, now + offset + 0.12);
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.12, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.01, now + offset + 0.5);
        osc.start(now + offset);
        osc.stop(now + offset + 0.5);
      });
    } catch (error) {
      console.warn('Audio playback not available', error);
    }
  };
  const BONUS_POINTS_PER_FULL_SET = 5;
  const GELATO_COOLDOWN = 24 * 60 * 60 * 1000;
  const GELATO_GOAL = 3;
  const COOLDOWN_REWARDS = {
    twelve: { threshold: 12, hours: 12 },
    thirty: { threshold: 30, hours: 3 },
  };
  const QUIZ_QUESTIONS = [
    { id: 'q1', question: 'Il latte fresco ha un odore leggermente acido. Cosa fai?', options: ['Lo uso comunque', 'Lo scarto immediatamente', 'Lo annuso di nuovo'], correct: 1 },
    { id: 'q2', question: 'Temperatura ideale del latte nel frigo?', options: ['4°C', '8°C', '2°C'], correct: 0 },
    { id: 'q3', question: 'La crema dell\'espresso è bianca invece che nocciola. Possibile causa?', options: ['Caffè vecchio', 'Grinder pulito', 'Tazza calda'], correct: 0 },
    { id: 'q4', question: 'Shelf life latte di avena dopo apertura?', options: ['3 giorni', '5 giorni', '7 giorni'], correct: 1 },
    { id: 'q5', question: 'Cliente chiede cappuccino extra hot (80°C). Come rispondi?', options: ['Lo faccio', 'Spiego che 65°C è ideale', 'Dico di no'], correct: 1 },
    { id: 'q6', question: 'Rush hour con 20 persone. Priorità operativa?', options: ['Velocità + qualità', 'Solo velocità', 'Solo qualità'], correct: 0 },
    { id: 'q7', question: 'Il steam wand fischia. Problema?', options: ['Wand ostruito', 'Tutto ok', 'Latte freddo'], correct: 0 },
    { id: 'q8', question: 'Come distribuisci il caffè nel portafiltro?', options: ['Scuoto', 'Distribution tool', 'Tampo forte'], correct: 1 },
    { id: 'q9', question: 'Cliente indeciso tra cappuccino e latte. Come guidi?', options: ['Scelgo io', 'Chiedo preferenza foam', 'Propongo caffè'], correct: 1 },
    { id: 'q10', question: 'Cliente si lamenta del prezzo €4 cappuccino. Response?', options: ['Sconto', 'Spiego qualità', 'Ignoro'], correct: 1 },
    { id: 'q11', question: 'Studente budget limitato. Come upselli?', options: ['Non upsello', 'Combo risparmio', 'Insisto'], correct: 1 },
    { id: 'q12', question: 'Cliente dice: "Da Starbucks costa meno". Gestione?', options: ['Abbasso prezzo', 'Spiego differenze', 'Critico Starbucks'], correct: 1 },
    { id: 'q13', question: 'Cade corrente durante servizio. Priorità?', options: ['Chiudo', 'Continuo a mano', 'Chiamo tecnico'], correct: 1 },
    { id: 'q14', question: 'Finisci latte intero durante rush. Piano B?', options: ['Chiudo', 'Uso alternative milk', 'Mando qualcuno'], correct: 2 },
    { id: 'q15', question: 'Cliente ha reazione allergica. Primo step?', options: ['Acqua', 'Chiamo 118', 'Aspetto'], correct: 1 },
    { id: 'q16', question: 'Cliente dice: "C\'è un capello nel croissant". Gestione?', options: ['Ignoro', 'Mi scuso e sostituisco', 'Dico non è vero'], correct: 1 },
    { id: 'q17', question: 'Differenza Buontalenti vs gelato normale?', options: ['Stesso', 'Ricetta esclusiva', 'Marketing'], correct: 1 },
    { id: 'q18', question: 'Blend Badiani è:', options: ['100% Arabica', '80% Arabica 20% Robusta', '50/50'], correct: 1 },
    { id: 'q19', question: 'Temperatura cottura ideale churros?', options: ['160°C', '180°C', '200°C'], correct: 1 },
    { id: 'q20', question: 'Perché Flat White ha meno foam?', options: ['Errore', 'Tecnica specifica', 'Risparmio'], correct: 1 },
    { id: 'q21', question: 'Un sacchetto caffè aperto 3 settimane fa. Procedi?', options: ['Uso', 'Scarto', 'Annuso'], correct: 1 },
    { id: 'q22', question: 'Noti cristalli nello sciroppo caramel. Azione?', options: ['Uso', 'Butto', 'Scaldo'], correct: 1 },
    { id: 'q23', question: 'Brownie con macchia verde. Azione?', options: ['Vendo', 'Scarto', 'Taglio parte'], correct: 1 },
    { id: 'q24', question: 'Caffè gusto bruciato. Causa?', options: ['Temperatura alta', 'Vecchio', 'Entrambi'], correct: 2 },
    { id: 'q25', question: 'Come verifichi freschezza caffè?', options: ['Gusto', 'Odore + lucido', 'Colore'], correct: 1 },
    { id: 'q26', question: 'Gelato con cristalli ghiaccio. Significa?', options: ['Ok', 'Scongelato', 'Vecchio'], correct: 1 },
    { id: 'q27', question: 'Panettone tagliato ieri vendibile oggi?', options: ['Sì', 'No', 'Dipende'], correct: 2 },
    { id: 'q28', question: 'Macchina mostra 95°C invece 90°C. Problema?', options: ['Sì', 'No', 'Forse'], correct: 0 },
    { id: 'q29', question: 'Brick latte gonfio. Azione?', options: ['Uso', 'Scarto', 'Apro'], correct: 1 },
    { id: 'q30', question: 'Churros sera prima riutilizzabili?', options: ['Sì', 'No', 'Riscaldo'], correct: 1 },
    { id: 'q31', question: 'Tempo max tra estrazione e servizio espresso?', options: ['30 sec', '10 sec', '1 min'], correct: 1 },
    { id: 'q32', question: 'Latte scaldato oltre 70°C. Come capirlo?', options: ['Gusto', 'Odore bruciato', 'Colore'], correct: 1 },
    { id: 'q33', question: 'Cliente chiede cappuccino extra foam. Come adatti?', options: ['Monto di più', 'Dico no', 'Spiego'], correct: 0 },
    { id: 'q34', question: 'Latte urla durante montatura. Stai sbagliando?', options: ['Temperatura', 'Posizione wand', 'Entrambi'], correct: 1 },
    { id: 'q35', question: 'Come eviti channeling nell\'espresso?', options: ['Tamper uniforme', 'Distribution', 'Entrambi'], correct: 2 },
    { id: 'q36', question: 'Cliente chiede caffè lungo italiano. Come prepari?', options: ['Americano', 'Estrazione lunga', 'Doppio'], correct: 1 },
    { id: 'q37', question: 'Brocca latte sporca residui. Impatto?', options: ['Nessuno', 'Sapore alterato', 'Ok'], correct: 1 },
    { id: 'q38', question: 'Famiglia 2 bambini. Strategia upsell?', options: ['Combo family', 'Singoli', 'Niente'], correct: 0 },
    { id: 'q39', question: 'Cliente vegano. Prodotti proponi?', options: ['Niente', 'Alternative milk + vegan gelato', 'Solo caffè'], correct: 1 },
    { id: 'q40', question: 'Studente budget limitato. Upsell senza pressione?', options: ['Combo risparmio', 'Niente', 'Insisto'], correct: 0 },
    { id: 'q41', question: 'Cliente torna: cappuccino freddo. Procedura?', options: ['Ignoro', 'Rifaccio + scuse', 'Riscaldo'], correct: 1 },
    { id: 'q42', question: 'Gruppo 8 persone ordina tutto. Come organizzi?', options: ['Sequenziale', 'Batch simili', 'Caos'], correct: 1 },
    { id: 'q43', question: 'Cliente: non mi piace caffè. Come conquisti?', options: ['Abbandono', 'Alternative dolci', 'Insisto'], correct: 1 },
    { id: 'q44', question: 'Pendolare fretta. Upsell veloce?', options: ['Niente', 'Extra shot 1 sec', 'Spiego lungo'], correct: 1 },
    { id: 'q45', question: 'Come presenti loyalty a nuovo cliente?', options: ['Lungo', 'Breve benefici', 'Non presento'], correct: 1 },
    { id: 'q46', question: 'Cliente: costa meno da Starbucks. Gestione?', options: ['Sconto', 'Spiego qualità', 'Ignoro'], correct: 1 },
    { id: 'q47', question: 'Perché alternative milk costa di più?', options: ['Costo superiore', 'Marketing', 'Caso'], correct: 0 },
    { id: 'q48', question: 'Cliente diabetico. Opzioni sugar-free?', options: ['Niente', 'Alternative sweetener', 'Normale'], correct: 1 },
    { id: 'q49', question: 'Cliente dice: sorprendimi. Come scegli?', options: ['Random', 'Signature + storia', 'Economico'], correct: 1 },
    { id: 'q50', question: 'Influencer chiede gratis per post. Response?', options: ['Ok', 'No + spiego policy', 'Sconto'], correct: 1 },
    { id: 'q51', question: 'Espresso esce in 20s con 36g out. Primo intervento?', options: ['Più fine al grinder', 'Dose più bassa', 'Tamp più forte'], correct: 0 },
    { id: 'q52', question: 'Crema cappuccino con bolle grandi. Problema principale?', options: ['Stretch troppo lungo', 'Latte troppo freddo', 'Tazza fredda'], correct: 0 },
    { id: 'q53', question: 'Americano: quando versi acqua?', options: ['Dopo shot', 'Prima dello shot', 'Insieme'], correct: 1 },
    { id: 'q54', question: 'Flat white: latte art fallisce. Causa tipica?', options: ['Latte troppo schiumoso', 'Shot ristretto', 'Tazza calda'], correct: 0 },
    { id: 'q55', question: 'Macchiato corretto: quanto foam?', options: ['1 cucchiaio', 'Metà tazza', 'Nessuno'], correct: 0 },
    { id: 'q56', question: 'Cioccolata macchina: prima accensione. Cosa controlli?', options: ['Acqua serbatoio esterno', 'Beccuccio pulito', 'Zucchero'], correct: 0 },
    { id: 'q57', question: 'Churros: olio a 160°C. Cosa fai?', options: ['Alzi a 180°C', 'Continui', 'Aggiungi sale'], correct: 0 },
    { id: 'q58', question: 'Gelato con cristalli: azione?', options: ['Rigeli', 'Scarti vaschetta', 'Aggiungi panna'], correct: 1 },
    { id: 'q59', question: 'Spatolatura Buontalenti: priorità?', options: ['Resta morbida', 'Pressare forte', 'Mescolare aria'], correct: 0 },
    { id: 'q60', question: 'Story Orbit: come presenti il Buontalenti?', options: ['Solo prezzo', 'Origine Firenze + assaggio', 'Parli di Starbucks'], correct: 1 },
    { id: 'q61', question: 'Panettone tagliato ieri. Come lo servi oggi?', options: ['Non lo servi', 'Tosti leggermente', 'Aggiungi zucchero'], correct: 1 },
    { id: 'q62', question: 'Learn bubbles: a cosa serve il trigger?', options: ['Aprire overlay', 'Mostrare prodotti rapidi', 'Cambiare tema'], correct: 1 },
    { id: 'q63', question: 'Menu drawer: come blocchi lo scroll?', options: ['bodyScrollLock.lock()', 'overflow:hidden sul main', 'position:fixed su nav'], correct: 0 },
    { id: 'q64', question: 'Cooldown gelato: perché esiste?', options: ['Limitare spam premi', 'Bug sonoro', 'Serve per layout'], correct: 0 },
    { id: 'q65', question: 'Challenge ogni quante stelline?', options: ['3', '5', '10'], correct: 0 },
    { id: 'q66', question: 'Quiz perfetto concede?', options: ['1 gelato reale', '5 stelle', 'Cooldown azzerato'], correct: 0 },
    { id: 'q67', question: 'Come salvi il profilo utente?', options: ['badianiUser.profile.v1', 'localUser', 'sessionStorage'], correct: 0 },
    { id: 'q68', question: 'Card aperta questa settimana: come viene marcata?', options: ['state.openedToday[id]', 'cookie', 'query string'], correct: 0 },
    { id: 'q69', question: 'Se il quiz fallisce, cosa succede alle stelline?', options: ['Reset a 0', 'Meno 1', 'Niente'], correct: 0 },

    // --- ORDER TYPE (metti in ordine i passaggi) ---
    {
      id: 'o1',
      type: 'order',
      question: 'Metti in ordine i passaggi per montare il latte (cappuccino) in modo pulito e consistente.',
      steps: [
        'Purge steam wand (scarico rapido)',
        'Posiziona la punta: fase di stretching (aria) per pochi secondi',
        'Scendi di più: fase di rolling (vortice) per microfoam',
        'Ferma a circa 65°C',
        'Pulisci e purge steam wand',
        'Swirl + tap: texture lucida pronta per latte art',
      ],
    },
    {
      id: 'o2',
      type: 'order',
      question: 'Metti in ordine i passaggi base per un espresso consistente (routine rapida).',
      steps: [
        'Pulisci/flush il gruppo e asciuga il portafiltro',
        'Macinatura nel portafiltro e livellamento (distribution)',
        'Tamp uniforme e pulizia bordo',
        'Aggancia e avvia subito l’estrazione',
        'Controlla tempo/resa e valuta la crema',
        'Servi immediatamente (entro 10 secondi)',
      ],
    },
    {
      id: 'o3',
      type: 'order',
      question: 'Churros: metti in ordine i passaggi per una cottura corretta e sicura.',
      steps: [
        'Porta l’olio a circa 180°C',
        'Forma i churros in modo uniforme (attenzione sicurezza)',
        'Friggi fino a doratura omogenea',
        'Scola e lascia drenare l’olio in eccesso',
        'Zucchero/cannella (o topping) solo a fine cottura',
        'Servi caldo e comunica eventuali allergeni',
      ],
    },
    {
      id: 'o4',
      type: 'order',
      question: 'Fine servizio: metti in ordine i passaggi essenziali di pulizia della postazione caffè.',
      steps: [
        'Svuota e risciacqua brocche/utensili (subito)',
        'Pulisci e purge steam wand',
        'Flush gruppo e pulizia area portafiltro',
        'Riordina ingredienti e controlla scadenze/shelf life',
        'Pulisci superfici e pavimento zona lavoro',
        'Log/brief: note su stock e problemi tecnici',
      ],
    }
  ];
  // NOTE: "Sfida continua" was an experimental extra flow that can pop up on every 3rd star.
  // It contains legacy questions (incl. "Sicurezza") and was confusing users who expect the
  // 3-star moment to be the tab-based Quiz Slot.
  // Keep the code for future iterations, but disable auto-trigger by default.
  const ENABLE_CONTINUOUS_CHALLENGE = false;
  const CHALLENGE_INTERVAL = 3;
  const CHALLENGE_QUESTIONS = [
    { id: 'c1', topic: 'Emergenza', question: 'Fumo dalla macchina espresso. Azioni primi 30 sec?', options: ['Spegni + estintore', 'Continuo', 'Chiamo tecnico'], correct: 0 },
    { id: 'c2', topic: 'Qualità', question: 'Cliente dice: questo sa di detersivo. Possibili contaminazioni?', options: ['Pulizia mal risciacquata', 'Latte', 'Caffè'], correct: 0 },
    { id: 'c3', topic: 'Sicurezza', question: 'Coworker si scotta con steam wand. First aid?', options: ['Acqua fredda immediata', 'Ghiaccio', 'Niente'], correct: 0 },
    { id: 'c4', topic: 'Prodotto', question: 'Vetrina gelato -8°C invece -14°C. Procedura?', options: ['Ok', 'Chiama tecnico + check prodotti', 'Chiudo'], correct: 1 },
    { id: 'c5', topic: 'Inventario', question: 'Noti discrepanza inventario. Procedura?', options: ['Ignoro', 'Report + verifica', 'Aggiusto'], correct: 1 },
    { id: 'c6', topic: 'Team', question: 'Collega sembra ubriaco. Cosa fai?', options: ['Ignoro', 'Parlo con manager', 'Rido'], correct: 1 },
    { id: 'c7', topic: 'Cliente', question: 'Cliente minaccia recensione negativa. De-escalation?', options: ['Ignoro', 'Ascolto + soluzione', 'Minaccio'], correct: 1 },
    { id: 'c8', topic: 'Igiene', question: 'Noti collega non segue igiene. Come intervieni?', options: ['Ignoro', 'Richiamo gentile', 'Segnalo'], correct: 1 },
    { id: 'c9', topic: 'Prodotto', question: 'Delivery con prodotti danneggiati. Accetti?', options: ['Sì', 'Rifiuto + foto', 'Accetto parziale'], correct: 1 },
    { id: 'c10', topic: 'Servizio', question: 'Cliente rovescia caffè bollente. Procedura?', options: ['Ignoro', 'First aid + report', 'Solo scuse'], correct: 1 },
    { id: 'c11', topic: 'Attrezzature', question: 'Grinder bloccato con chicchi. Come sblocchi?', options: ['Forzo', 'Spegni + pulisci', 'Continuo'], correct: 1 },
    { id: 'c12', topic: 'Conservazione', question: 'Frigo pasticceria non raffredda. Cosa salvi prima?', options: ['Tutto', 'Prodotti più deperibili', 'Niente'], correct: 1 },
    { id: 'c13', topic: 'POS', question: 'POS non funziona, cliente solo carta. Opzioni?', options: ['Rifiuto', 'Contanti o gratuito', 'Aspetto'], correct: 1 },
    { id: 'c14', topic: 'Sicurezza', question: 'Bambino corre verso vetrina calda. Azione?', options: ['Ignoro', 'Blocco + avviso genitore', 'Urlo'], correct: 1 },
    { id: 'c15', topic: 'Stock', question: 'Finisci coni gelato pomeriggio. Alternative?', options: ['Chiudo', 'Solo coppette + comunicazione', 'Uso altro'], correct: 1 },
    { id: 'c16', topic: 'Qualità', question: 'Shot esce in 18 sec invece 28. Correttivo?', options: ['Ok', 'Grinder più fine', 'Rifaccio'], correct: 1 },
    { id: 'c17', topic: 'Pulizia', question: 'Come pulisci group head tra servizi?', options: ['Non pulisco', 'Flush + wipe', 'Solo flush'], correct: 1 },
    { id: 'c18', topic: 'Tecnica', question: 'Portafiltro freddo. Impatto estrazione?', options: ['Nessuno', 'Shot sotto-estratto', 'Shot bruciato'], correct: 1 },
    { id: 'c19', topic: 'Servizio', question: 'Cliente celiaco chiede dolce. Procedura?', options: ['Normale', 'Verifico ingredienti + contamination', 'Rifiuto'], correct: 1 },
    { id: 'c20', topic: 'Manutenzione', question: 'Backflush macchina: quando?', options: ['Mai', 'Fine giornata', 'Ogni ora'], correct: 1 },
    { id: 'c21', topic: 'Menu', question: 'Cliente allergico noci chiede brownie. Procedura?', options: ['Dico ok', 'Verifico + avviso rischio', 'Rifiuto'], correct: 1 },
    { id: 'c22', topic: 'Attrezzature', question: 'Macchina gruppo non scalda. Workaround?', options: ['Chiudo', 'Uso altri gruppi', 'Forzo'], correct: 1 },
    { id: 'c23', topic: 'Stock', question: 'Finisci ghiaccio per iced. Alternative?', options: ['Non servo', 'Uso congelato + comunico', 'Tiepido'], correct: 1 },
    { id: 'c24', topic: 'Team', question: 'Coworker assente, sei solo con 15 ordini. Strategia?', options: ['Panico', 'Priorizzo + batch', 'Chiudo'], correct: 1 },
    { id: 'c25', topic: 'Cliente', question: 'Cliente filma dicendo: Vi segnalo ASL. Reazione?', options: ['Calma + dialogo', 'Minaccio', 'Chiamo polizia'], correct: 0 }
  ];

  const defaultState = {
    version: 4,
    // Legacy global crystals counter (no longer used; kept for backward compatibility)
    crystals: 0,
    stars: 0,
    quizTokens: 0,
    // Access passes to the harder "Test me" quiz.
    // Earned by passing the mini-quiz that appears at each 3-star milestone.
    testMeCredits: 0,
    progress: 0,
    unlockedCards: {},
    cardTopupToday: {},
    topupCrystalsToday: {},
    // Per-card crystal -> star conversion tracking (weekly reset)
    cardCrystalConvertedAtToday: {},
    cardStarAwardedToday: {},
    openedToday: {},
    openedTabsToday: {},
    // Snapshot testuale dei tab aperti nel periodo di reset (settimanale).
    // Key: `${cardId}::${slug(tabTitle)}` -> { ts, pageSlug, cardTitle, tabTitle, content }
    openedTabContextToday: {},
    dayStamp: getDayStamp(),
    celebratedSets: 0,
    gelati: 0,
    lastGelatoTs: 0,
    cooldownReductionMs: 0,
    pendingCooldownMs: 0,
    cooldownCuts: { twelve: false, thirty: false },
    bonusPoints: 0,
    askedQuestions: [],
    challengeAsked: [],
    history: { quiz: [], days: [], totals: { stars: 0, gelati: 0, bonusPoints: 0 } },
    _lastBonusPoints: 0,
  };

  let state = loadState();
  let cardSerial = 0;
  let hubNodes = {};
  let overlayNodes = {};
  let lastFocus = null;
  let countdownTicker = null;
  let activePopover = null;
  let popoverHandlersBound = false;
  let infoHandlerBound = false;
  let challengeActive = false;
  let pendingMilestoneCheck = false;
  let quizOnClose = false;

  // NOTE: Despite the name, this returns the *weekly* stamp used for resets.
  // A new stamp starts at local Sunday 00:00.
  function getDayStamp(date = new Date()) {
    try {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      // getDay(): 0=Sunday ... 6=Saturday
      d.setDate(d.getDate() - d.getDay());
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    } catch {
      return '';
    }
  }

  function loadState() {
    try {
      // Prefer per-profile storage
      let raw = localStorage.getItem(storageKey());
      // Migrate from global key if present and no user state yet
      if (!raw) {
        const globalRaw = localStorage.getItem(GLOBAL_KEY);
        if (globalRaw) {
          localStorage.setItem(storageKey(), globalRaw);
          localStorage.removeItem(GLOBAL_KEY);
          raw = globalRaw;
        }
      }
      if (!raw) return { ...defaultState };
      const parsed = JSON.parse(raw);
      const parsedVersion = typeof parsed.version === 'number' ? parsed.version : 0;
      const merged = {
        ...defaultState,
        ...parsed,
        version: 4,
        crystals: typeof parsed.crystals === 'number' ? parsed.crystals : 0,
        unlockedCards: parsed.unlockedCards || {},
        cardTopupToday: parsed.cardTopupToday || {},
        topupCrystalsToday: parsed.topupCrystalsToday || {},
        cardCrystalConvertedAtToday: parsed.cardCrystalConvertedAtToday || {},
        cardStarAwardedToday: parsed.cardStarAwardedToday || {},
        openedToday: parsed.openedToday || {},
        openedTabsToday: parsed.openedTabsToday || {},
        openedTabContextToday: parsed.openedTabContextToday || {},
        dayStamp: parsed.dayStamp || getDayStamp(),
        cooldownCuts: {
          twelve: parsed.cooldownCuts?.twelve || false,
          thirty: parsed.cooldownCuts?.thirty || false,
        },
        askedQuestions: parsed.askedQuestions || [],
        challengeAsked: parsed.challengeAsked || [],
        testMeCredits: typeof parsed.testMeCredits === 'number' ? parsed.testMeCredits : 0,
        history: {
          quiz: parsed.history?.quiz || [],
          days: parsed.history?.days || [],
          totals: {
            stars: parsed.history?.totals?.stars || 0,
            gelati: parsed.history?.totals?.gelati || 0,
            bonusPoints: parsed.history?.totals?.bonusPoints || 0,
          },
        },
        _lastBonusPoints: typeof parsed._lastBonusPoints === 'number' ? parsed._lastBonusPoints : (parsed.bonusPoints || 0),
      };

      // Migration to per-card crystal progress (v4): reset daily crystal-related fields to avoid
      // accidentally granting multiple stars based on a legacy global counter.
      if (parsedVersion > 0 && parsedVersion < 4) {
        merged.dayStamp = getDayStamp();
        merged.openedToday = {};
        merged.openedTabsToday = {};
        merged.openedTabContextToday = {};
        merged.cardTopupToday = {};
        merged.topupCrystalsToday = {};
        merged.cardCrystalConvertedAtToday = {};
        merged.cardStarAwardedToday = {};
        merged.crystals = 0;
        merged.progress = 0;
        merged.stars = 0;
        merged.quizTokens = 0;
        try { delete merged.crystalConvertedAt; } catch (e) {}
      }

      return merged;
    } catch (error) {
      console.warn('Gamification state reset', error);
      return { ...defaultState };
    }
  }

  function saveState() {
    try {
      localStorage.setItem(storageKey(), JSON.stringify(state));
    } catch (error) {
      console.warn('Gamification state not persisted', error);
    }
  }

  function ensureDailyState() {
    const today = getDayStamp();
    if (state.dayStamp !== today) {
      // Snapshot previous period (weekly) before reset
      try {
        const prevDay = state.dayStamp;
        const cardsOpened = Object.keys(state.openedToday || {}).length;
        const quizzesCorrect = (state.history?.quiz || []).filter(q => q.correct && getDayStamp(new Date(q.ts)) === prevDay).length;
        const quizzesWrong = (state.history?.quiz || []).filter(q => q.correct === false && getDayStamp(new Date(q.ts)) === prevDay).length;
        const gelatiToday = quizzesCorrect; // ogni quiz perfetto = 1 gelato
        const bonusDelta = Math.max(0, (state.bonusPoints || 0) - (state._lastBonusPoints || 0));
        if (!Array.isArray(state.history.days)) state.history.days = [];
        state.history.days.push({
          date: prevDay,
          stars: state.stars || 0,
          cardsOpened,
          quizzes: { correct: quizzesCorrect, wrong: quizzesWrong },
          gelati: gelatiToday,
          bonusDelta,
        });
        // keep last 90 days
        if (state.history.days.length > 90) {
          state.history.days = state.history.days.slice(-90);
        }
        state._lastBonusPoints = state.bonusPoints || 0;
      } catch (e) {
        console.warn('Failed to snapshot daily history', e);
      }

      state.dayStamp = today;
      state.openedToday = {};
      state.openedTabsToday = {};
      state.openedTabContextToday = {};
      state.cardTopupToday = {};
      state.topupCrystalsToday = {};
      state.cardCrystalConvertedAtToday = {};
      state.cardStarAwardedToday = {};
      state.storyOrbitPrereqToday = {};
      state.crystals = 0;
      try { delete state.crystalConvertedAt; } catch (e) {}
      state.progress = 0;
      state.stars = 0;
      state.quizTokens = 0;
      state.testMeCredits = 0;
      state.celebratedSets = 0;
      state.cooldownCuts = { twelve: false, thirty: false };
      state.pendingCooldownMs = 0;
      saveState();
      return true;
    }
    return false;
  }

  function init() {
    ensureDailyState();
    initStoryOrbitRewards();
    buildHub();
    buildOverlay();
    updateUI();
    formatStatListLabels();
    initProfileControls();
    checkStarMilestones();
    if (state.gelati >= GELATO_GOAL) {
      showVictoryMessage();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  function formatStatListLabels() {
    document.querySelectorAll('.stat-list li').forEach((item) => {
      if (item.querySelector('strong')) return;
      const text = (item.textContent || '').trim();
      const idx = text.indexOf(':');
      if (idx <= 0) return;
      const label = text.slice(0, idx).trim();
      const rest = text.slice(idx + 1).trim();
      if (!label || !rest) return;
      item.innerHTML = `<strong>${label}:</strong> ${rest}`;
    });
  }

  function buildHub() {
    const nav = document.querySelector('.nav-shell');
    if (!nav || hubNodes.shell) return;
    const shell = document.createElement('div');
    shell.className = 'nav-token-shell';
    shell.innerHTML = getTokenShellMarkup();
    const menuButton = document.querySelector('[data-menu-toggle]');
    if (menuButton) {
      nav.insertBefore(shell, menuButton);
    } else {
      nav.appendChild(shell);
    }
    setupPopoverTriggers(shell);
    ensureInfoHandler();

    hubNodes = {
      shell,
      starValue: shell.querySelector('[data-star-value]'),
      starCounter: shell.querySelector('[data-star-token]'),
      progress: shell.querySelector('[data-star-progress]'),
      crystalProgress: shell.querySelector('[data-crystal-progress]'),
      gelatoValue: shell.querySelector('[data-gelato-value]'),
      gelatoCounter: shell.querySelector('[data-gelato-token]'),
      bonusValue: shell.querySelector('[data-bonus-value]'),
      bonusCounter: shell.querySelector('[data-bonus-token]'),
      quizBtn: shell.querySelector('[data-quiz-launch]'),
      cooldownHint: shell.querySelector('[data-cooldown-hint]'),
      countdown: shell.querySelector('[data-countdown]'),
      countdownValue: shell.querySelector('[data-countdown-value]'),
    };

    if (hubNodes.quizBtn) {
      hubNodes.quizBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        if (state.quizTokens < STARS_FOR_QUIZ) return;
        // If the user already unlocked access, run the hard quiz; otherwise run the mini quiz.
        if ((state.testMeCredits || 0) > 0) {
          showTestMeQuiz();
        } else {
          showMiniQuiz();
        }
      });
    }
  }

  function getTokenShellMarkup() {
    return `
      <div class="nav-token nav-token--stars" data-star-token>
        <button class="nav-token__btn" type="button" aria-expanded="false" aria-haspopup="dialog" data-popover-toggle="stars">
          <span class="nav-token__icon" aria-hidden="true">★</span>
          <span class="nav-token__badge">
            <span class="nav-token__label">Stelline</span>
            <span class="nav-token__value reward-value" data-star-value data-current="0">0</span>
          </span>
        </button>
        <div class="reward-popover" data-popover-panel="stars" role="dialog" aria-label="Dettagli stelline" hidden>
          <div class="reward-popover__header">
            <p class="reward-popover__label">Progressi</p>
            <span class="reward-progress" data-star-progress>0/${MAX_STARS}</span>
          </div>
          <p class="reward-popover__text">
            Apri i tab dentro una scheda: ogni tab svela 1 cristallo di zucchero. Ogni ${CRYSTALS_PER_STAR} cristalli (per singola scheda info) si fondono in 1 stellina.
          </p>
          <p class="reward-popover__hint reward-hint" data-crystal-progress>Cristalli: progressi per scheda (0/${CRYSTALS_PER_STAR}). Se i tab sono meno di ${CRYSTALS_PER_STAR}, completiamo la differenza all'apertura della scheda info.</p>
          <button class="reward-popover__cta" type="button" data-quiz-launch hidden>Test me</button>
          <p class="reward-popover__hint">3 stelline = mini quiz (1 domanda) sulle schede/tab aperti. Se giusto sblocchi “Test me”.</p>
          <button class="reward-popover__link" type="button" data-info-launch>Regole complete</button>
        </div>
      </div>
      <div class="nav-token nav-token--gelato" data-gelato-token>
        <button class="nav-token__btn" type="button" aria-expanded="false" aria-haspopup="dialog" data-popover-toggle="gelato">
          <span class="nav-token__icon" aria-hidden="true">🍨</span>
          <span class="nav-token__badge">
            <span class="nav-token__label">Gelati</span>
            <span class="nav-token__value reward-value" data-gelato-value data-current="0">0</span>
          </span>
        </button>
        <div class="reward-popover" data-popover-panel="gelato" role="dialog" aria-label="Dettagli gelati" hidden>
          <p class="reward-popover__text">
            Tre quiz perfetti = un gelato reale da riscattare con il trainer. Il timer ti impedisce gli sprint consecutivi.
          </p>
          <div class="reward-countdown" data-countdown hidden>
            <span class="countdown-label">Cooldown</span>
            <span class="countdown-digits" data-countdown-value>24:00:00</span>
          </div>
          <p class="reward-popover__hint reward-hint" data-cooldown-hint hidden></p>
          <button class="reward-popover__link" type="button" data-info-launch>Vedi regolamento</button>
        </div>
      </div>
      <div class="nav-token nav-token--bonus" data-bonus-token>
        <button class="nav-token__btn" type="button" aria-expanded="false" aria-haspopup="dialog" data-popover-toggle="bonus">
          <span class="nav-token__icon" aria-hidden="true">⚡</span>
          <span class="nav-token__badge">
            <span class="nav-token__label">Bonus</span>
            <span class="nav-token__value reward-value" data-bonus-value data-current="0">0</span>
          </span>
        </button>
        <div class="reward-popover" data-popover-panel="bonus" role="dialog" aria-label="Dettagli punti bonus" hidden>
          <p class="reward-popover__text">
            65 stelline azzerano il loop e assegnano +${BONUS_POINTS_PER_FULL_SET} punti bonus convertibili in cash o prodotti Badiani.
          </p>
          <button class="reward-popover__link" type="button" data-info-launch>Come si sblocca</button>
        </div>
      </div>
    `;
  }

  function setupPopoverTriggers(shell) {
    const triggers = shell.querySelectorAll('[data-popover-toggle]');
    triggers.forEach((trigger) => {
      const id = trigger.getAttribute('data-popover-toggle');
      const panel = shell.querySelector(`[data-popover-panel="${id}"]`);
      if (!panel) return;
      trigger.addEventListener('click', () => togglePopover(trigger, panel));
    });
    if (!popoverHandlersBound) {
      document.addEventListener('click', handleDocumentClick);
      document.addEventListener('keydown', handlePopoverKeydown);
      popoverHandlersBound = true;
    }
  }

  function togglePopover(trigger, panel) {
    if (activePopover?.panel === panel) {
      closeActivePopover();
      return;
    }
    closeActivePopover();
    activePopover = { trigger, panel };
    panel.hidden = false;
    panel.classList.add('is-open');
    trigger.setAttribute('aria-expanded', 'true');
    const autoFocus = panel.querySelector('button, [href], input, select, textarea');
    if (autoFocus) {
      requestAnimationFrame(() => autoFocus.focus({ preventScroll: true }));
    }
  }

  function closeActivePopover() {
    if (!activePopover) return;
    activePopover.panel.hidden = true;
    activePopover.panel.classList.remove('is-open');
    activePopover.trigger.setAttribute('aria-expanded', 'false');
    activePopover = null;
  }

  function handleDocumentClick(event) {
    if (!activePopover) return;
    const { panel, trigger } = activePopover;
    if (panel.contains(event.target) || trigger.contains(event.target)) return;
    closeActivePopover();
  }

  function handlePopoverKeydown(event) {
    if (event.key === 'Escape') {
      closeActivePopover();
    }
  }

  function ensureInfoHandler() {
    if (infoHandlerBound) return;
    document.addEventListener('click', (event) => {
      const trigger = event.target.closest('[data-info-launch]');
      if (!trigger) return;
      event.preventDefault();
      closeActivePopover();
      showGameInfo();
    });
    infoHandlerBound = true;
  }

  function maybeTriggerChallenge() {
    if (!ENABLE_CONTINUOUS_CHALLENGE) return false;
    if (challengeActive) return false;
    if (state.stars === 0) return false;
    if (state.stars % CHALLENGE_INTERVAL !== 0) return false;
    launchChallengeTest();
    return true;
  }

  function launchChallengeTest() {
    challengeActive = true;
    const challenge = pickChallengeQuestion();
    const container = document.createElement('div');
    container.className = 'challenge-card';

    const eyebrow = document.createElement('p');
    eyebrow.className = 'challenge-card__eyebrow';
    eyebrow.textContent = 'Sfida continua';

    const topic = document.createElement('p');
    topic.className = 'challenge-card__topic';
    topic.textContent = challenge.topic;

    const prompt = document.createElement('h3');
    prompt.className = 'challenge-card__prompt';
    prompt.textContent = challenge.question;

    const optionsWrap = document.createElement('div');
    optionsWrap.className = 'challenge-card__options';

    challenge.options.forEach((option, optionIndex) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'challenge-card__option';
      btn.textContent = option;
      btn.dataset.challengeOption = String(optionIndex);
      btn.addEventListener('click', () => handleChallengeChoice(optionIndex, challenge, optionsWrap));
      optionsWrap.appendChild(btn);
    });

    const hint = document.createElement('p');
    hint.className = 'challenge-card__hint';
    hint.textContent = 'Rispondi subito: errore = -3 stelline.';

    container.append(eyebrow, topic, prompt, optionsWrap, hint);
    openOverlay(container);
    lockOverlayClose();
  }

  function handleChallengeChoice(selectedIndex, challenge, optionsWrap) {
    if (optionsWrap.dataset.locked === 'true') return;
    optionsWrap.dataset.locked = 'true';
    const buttons = Array.from(optionsWrap.querySelectorAll('[data-challenge-option]'));
    buttons.forEach((btn, idx) => {
      btn.disabled = true;
      if (idx === challenge.correct) {
        btn.classList.add('is-correct');
      }
      if (idx === selectedIndex && idx !== challenge.correct) {
        btn.classList.add('is-wrong');
      }
    });
    setTimeout(() => {
      unlockOverlayClose();
      if (selectedIndex === challenge.correct) {
        showChallengeResult(true);
      } else {
        applyChallengePenalty();
      }
    }, 650);
  }

  function pickChallengeQuestion() {
    if (!Array.isArray(state.challengeAsked)) state.challengeAsked = [];

    let pool = CHALLENGE_QUESTIONS.filter((q) => !state.challengeAsked.includes(q.id));

    // Se esaurite, reset pool
    if (pool.length === 0) {
      state.challengeAsked = [];
      pool = [...CHALLENGE_QUESTIONS];
    }

    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (!state.challengeAsked.includes(pick.id)) {
      state.challengeAsked.push(pick.id);
      saveState();
    }
    return pick;
  }

  function applyChallengePenalty() {
    state.stars = Math.max(0, state.stars - CHALLENGE_INTERVAL);
    state.quizTokens = Math.max(0, state.quizTokens - CHALLENGE_INTERVAL);
    state.progress = state.stars;
    state.celebratedSets = Math.min(state.celebratedSets, getAvailableSets());
    saveState();
    updateUI();

    if (state.stars === 0) {
      showZeroStarsMessage();
      return;
    }
    showChallengeResult(false);
  }

  function showChallengeResult(passed) {
    const container = document.createElement('div');
    container.className = 'reward-modal';
    const burst = document.createElement('div');
    burst.className = 'reward-modal__burst';
    burst.textContent = passed ? '⚔️' : '🧊';
    const title = document.createElement('h3');
    title.className = 'reward-modal__title';
    title.textContent = passed ? 'Sfida superata' : 'Sfida persa: -3 stelline';
    const text = document.createElement('p');
    text.className = 'reward-modal__text';
    text.textContent = passed
      ? 'Ottimo! Conosci il playbook Badiani: continua a collezionare stelline senza perdere ritmo.'
      : 'Niente panico: raccogli nuove schede e rientra subito nel giro delle stelline.';
    const actions = document.createElement('div');
    actions.className = 'reward-modal__actions';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'reward-action primary';
    btn.textContent = passed ? 'Continua' : 'Ci riprovo';
    btn.dataset.overlayFocus = 'true';
    btn.addEventListener('click', () => {
      unlockOverlayClose();
      closeOverlay();
      completeChallenge();
    });
    actions.appendChild(btn);
    container.append(burst, title, text, actions);
    openOverlay(container);
    lockOverlayClose();
  }

  function showZeroStarsMessage() {
    const container = document.createElement('div');
    container.className = 'zero-splash';
    const eyebrow = document.createElement('p');
    eyebrow.className = 'zero-splash__eyebrow';
    eyebrow.textContent = 'Zero stelline';
    const title = document.createElement('h3');
    title.className = 'zero-splash__title';
    title.textContent = 'Ops! Sembra tu abbia bisogno di piu zucchero.';
    const text = document.createElement('p');
    text.className = 'zero-splash__text';
    text.textContent = 'Prendi un respiro, riapri il playbook e riprova subito: ogni scheda raccontata vale di nuovo una stellina.';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'zero-splash__cta';
    btn.textContent = 'Riprovo subito';
    btn.dataset.overlayFocus = 'true';
    btn.addEventListener('click', () => {
      unlockOverlayClose();
      closeOverlay();
      completeChallenge();
    });
    container.append(eyebrow, title, text, btn);
    openOverlay(container, { fullScreen: true });
    lockOverlayClose();
  }

  function completeChallenge() {
    challengeActive = false;
    if (pendingMilestoneCheck) {
      pendingMilestoneCheck = false;
      checkStarMilestones();
    }
  }

  function buildOverlay() {
    if (overlayNodes.overlay) return;
    const overlay = document.createElement('div');
    overlay.className = 'reward-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
      <div class="reward-overlay__panel" role="dialog" aria-modal="true">
        <button class="reward-overlay__close" type="button" data-overlay-close aria-label="Chiudi">×</button>
        <div class="reward-overlay__content" data-overlay-content></div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlayNodes = {
      overlay,
      panel: overlay.querySelector('.reward-overlay__panel'),
      content: overlay.querySelector('[data-overlay-content]'),
      closeButtons: overlay.querySelectorAll('[data-overlay-close]'),
    };

    overlayNodes.closeButtons.forEach((btn) => btn.addEventListener('click', () => closeOverlay()));
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        closeOverlay();
      }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && overlayNodes.overlay?.classList.contains('is-visible')) {
        closeOverlay();
      }
    });
  }

  function lockOverlayClose() {
    if (overlayNodes.panel) {
      overlayNodes.panel.setAttribute('data-lock-close', 'true');
    }
  }

  function unlockOverlayClose() {
    if (overlayNodes.panel) {
      overlayNodes.panel.removeAttribute('data-lock-close');
    }
  }

  function openOverlay(content, { fullScreen = false } = {}) {
    if (!overlayNodes.overlay || !overlayNodes.content || !overlayNodes.panel) return;
    unlockOverlayClose();
    closeActivePopover();
    overlayNodes.content.innerHTML = '';
    overlayNodes.content.appendChild(content);
    overlayNodes.panel.classList.toggle('is-wide', Boolean(fullScreen));
    overlayNodes.overlay.classList.add('is-visible');
    overlayNodes.overlay.setAttribute('aria-hidden', 'false');
    lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    quizOnClose = false;
    bodyScrollLock.lock();
    requestAnimationFrame(() => {
      const autoFocus = overlayNodes.content.querySelector('[data-overlay-focus]') ||
        overlayNodes.content.querySelector('button, [href], input, select, textarea');
      if (autoFocus) autoFocus.focus();
    });
  }

  function closeOverlay(options = {}) {
    if (!overlayNodes.overlay) return;
    const { force = false, triggerQuiz = false } = options;
    if (!force && overlayNodes.panel?.dataset.lockClose === 'true') {
      return;
    }
    unlockOverlayClose();
    overlayNodes.overlay.classList.remove('is-visible');
    overlayNodes.overlay.setAttribute('aria-hidden', 'true');
    overlayNodes.panel?.classList.remove('is-wide');
    bodyScrollLock.unlock();
    if (lastFocus) {
      lastFocus.focus({ preventScroll: true });
      lastFocus = null;
    }

    // Some overlays (e.g. the 3-stars milestone notice) want to start the quiz
    // right after the overlay is dismissed. We read that intent from the content
    // so every close path (backdrop, X, Escape) behaves consistently.
    const contentWantsMiniQuizOnClose = !!overlayNodes.content?.querySelector('[data-trigger-mini-quiz-on-close="true"]');
    const shouldRunMiniQuiz = triggerQuiz || quizOnClose || contentWantsMiniQuizOnClose;
    quizOnClose = false;

    if (shouldRunMiniQuiz) {
      setTimeout(() => {
        if (state.quizTokens >= STARS_FOR_QUIZ) {
          showMiniQuiz();
        }
      }, 300);
    }
  }

  function updateUI() {
    if (hubNodes.starValue) {
      setNumericValue(hubNodes.starValue, state.stars, hubNodes.starCounter);
    }
    if (hubNodes.gelatoValue) {
      setNumericValue(hubNodes.gelatoValue, state.gelati, hubNodes.gelatoCounter);
    }
    if (hubNodes.bonusValue) {
      setNumericValue(hubNodes.bonusValue, state.bonusPoints, hubNodes.bonusCounter);
    }
    if (hubNodes.progress) {
      hubNodes.progress.textContent = `${Math.min(state.stars, MAX_STARS)}/${MAX_STARS}`;
    }
    if (hubNodes.crystalProgress) {
      hubNodes.crystalProgress.textContent = `Cristalli: progressi per scheda (0/${CRYSTALS_PER_STAR})`;
    }
    if (hubNodes.quizBtn) {
      const canAttempt = state.quizTokens >= STARS_FOR_QUIZ;
      const hasAccess = (state.testMeCredits || 0) > 0;
      // If 3 stars are ready, always show a CTA:
      // - first: "Mini quiz" (unlock)
      // - then: "Test me" (hard quiz)
      hubNodes.quizBtn.hidden = !canAttempt;
      hubNodes.quizBtn.textContent = hasAccess ? 'Test me' : 'Mini quiz';
      // Cooldown blocks only the hard quiz.
      hubNodes.quizBtn.disabled = !canAttempt || (hasAccess && isCooldownActive());
    }
    if (hubNodes.cooldownHint) {
      const cooldownActive = isCooldownActive();
      if (cooldownActive) {
        hubNodes.cooldownHint.hidden = false;
        hubNodes.cooldownHint.classList.add('reward-hint--alert');
        hubNodes.cooldownHint.textContent = `Gelato di ieri! Torna tra ${formatDuration(getCooldownRemaining())}`;
      } else {
        hubNodes.cooldownHint.hidden = true;
        hubNodes.cooldownHint.classList.remove('reward-hint--alert');
      }
    }
    updatePageBadges();
    syncCountdown();
    updateCardChecks();
    renderSummary();
  }

  function updateCardChecks() {
    const cards = document.querySelectorAll('.guide-card');
    if (!cards.length) return;
    cards.forEach((card) => {
      const id = getCardId(card);
      const opened = !!(id && state.openedToday && state.openedToday[id]);
      const status = id ? getCardCrystalStatus(id) : { crystals: 0, converted: false };
      const starred = !!status.converted;

      card.classList.toggle('opened', opened);

      // Card-level indicator on the page button:
      // - hidden until the card is opened at least once this week
      // - ✓ once opened
      // - ★ + golden button once the 5 crystals have converted to a star
      try {
        const btn = card.querySelector('button[data-toggle-card]');
        if (!btn) return;

        let ind = btn.querySelector('.card-progress-indicator');
        const shouldShow = opened || starred;

        if (!shouldShow) {
          if (ind) ind.remove();
          btn.classList.remove('is-opened', 'is-starred');
          return;
        }

        if (!ind) {
          ind = document.createElement('span');
          ind.className = 'card-progress-indicator';
          ind.setAttribute('aria-hidden', 'true');
          btn.insertBefore(ind, btn.firstChild);
        }

        if (starred) {
          ind.textContent = '★';
          btn.classList.add('is-starred');
          btn.classList.remove('is-opened');
        } else {
          ind.textContent = '✓';
          btn.classList.add('is-opened');
          btn.classList.remove('is-starred');
        }
      } catch (e) {}
    });
  }

  function renderSummary() {
    const root = document.querySelector('[data-summary]');
    if (!root) return;
    // Profile info
    try {
      const raw = localStorage.getItem('badianiUser.profile.v1');
      if (raw) {
        const user = JSON.parse(raw);
        const nickNode = root.querySelector('[data-profile-nick]');
        const gelatoNode = root.querySelector('[data-profile-gelato]');
        if (nickNode) nickNode.textContent = user?.nickname || '—';
        if (gelatoNode) gelatoNode.textContent = user?.gelato || '—';
      }
    } catch {}
    const stars = state.stars || 0;
    const points = state.bonusPoints || 0;
    const gelati = state.gelati || 0;
    const quizHistory = Array.isArray(state.history?.quiz) ? state.history.quiz : [];
    const correct = quizHistory.filter(q => q.correct).length;
    const wrong = quizHistory.filter(q => q.correct === false).length;
    const setText = (sel, val) => { const el = root.querySelector(sel); if (el) el.textContent = String(val); };
    setText('[data-perf-stars]', stars);
    setText('[data-perf-points]', points);
    setText('[data-perf-gelati]', gelati);
    setText('[data-perf-quiz-correct]', correct);
    setText('[data-perf-quiz-wrong]', wrong);
    // Optionally fill cumulative totals if placeholders exist
    const totals = state.history?.totals || {};
    setText('[data-perf-stars-total]', totals.stars || 0);
    setText('[data-perf-gelati-total]', totals.gelati || 0);
    setText('[data-perf-bonus-total]', totals.bonusPoints || 0);
    const list = root.querySelector('[data-wrong-list]');
    if (list) {
      list.innerHTML = '';
      const wrongItems = quizHistory.filter(q => q.correct === false).slice(-10).reverse();
      if (!wrongItems.length) {
        const li = document.createElement('li');
        li.className = 'empty';
        li.textContent = 'Nessun errore recente — continua così! ✨';
        list.appendChild(li);
      } else {
        wrongItems.forEach(item => {
          const li = document.createElement('li');
          const when = new Date(item.ts || Date.now());
          const date = when.toLocaleDateString();
          const time = when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'summary-list__btn';
          btn.textContent = `${date} ${time} · ${item.prompt || 'Quiz'}`;
          btn.setAttribute('aria-label', `Apri revisione errore: ${item.prompt || 'Quiz'}`);
          btn.addEventListener('click', () => openWrongReviewModal(item));
          li.appendChild(btn);
          list.appendChild(li);
        });
      }
    }

    // Optional daily history list if present
    const daysRoot = root.querySelector('[data-history-days]');
    if (daysRoot && Array.isArray(state.history?.days)) {
      daysRoot.innerHTML = '';
      const days = [...state.history.days].slice(-14).reverse();
      if (!days.length) {
        const li = document.createElement('li');
        li.className = 'empty';
        li.textContent = 'Nessuna cronologia disponibile ancora.';
        daysRoot.appendChild(li);
      } else {
        days.forEach(d => {
          const li = document.createElement('li');
          li.textContent = `${d.date} · ⭐ ${d.stars} · 📖 ${d.cardsOpened} · ✅ ${d.quizzes?.correct || 0} · ❌ ${d.quizzes?.wrong || 0} · 🍨 ${d.gelati}`;
          daysRoot.appendChild(li);
        });
      }
    }
  }

  function getCorrectAnswerText(question) {
    if (!question) return '';
    if (question.type === 'order' && Array.isArray(question.steps)) {
      return question.steps.filter(Boolean).join(' → ');
    }
    if (Array.isArray(question.options) && Number.isInteger(question.correct)) {
      return question.options[question.correct] || '';
    }
    return '';
  }

  function guessSpecFromPrompt(prompt = '') {
    const p = String(prompt || '').toLowerCase();
    const has = (...needles) => needles.some(n => p.includes(String(n).toLowerCase()));

    if (has('churro', 'churros', 'panettone', 'pandoro', 'vin brule', 'mulled')) {
      return { href: 'festive.html', label: 'Apri Festive' };
    }
    if (has('espresso', 'cappuccino', 'americano', 'latte ', 'flat white', 'macchiato', 'shot', 'estrazione', 'grinder', 'steam', 'wand', 'portafiltro', 'tamper')) {
      return { href: 'caffe.html', label: 'Apri Caffè Rituals' };
    }
    if (has('croissant', 'brownie', 'pastry', 'scone', 'loaf', 'cake', 'vetrina pasticceria')) {
      return { href: 'pastries.html', label: 'Apri Pastry Lab' };
    }
    if (has('waffle', 'pancake', 'crepe', 'porridge', 'dessert', 'sweet')) {
      return { href: 'sweet-treats.html', label: 'Apri Sweet Treats' };
    }
    if (has('slitti', 'yo-yo', 'yoyo')) {
      return { href: 'slitti-yoyo.html', label: 'Apri Slitti & Yo-Yo' };
    }
    if (has('gelato', 'buontalenti', 'vetrina', 'vaschetta', 'cristalli', 'spatol')) {
      return { href: 'gelato-lab.html', label: 'Apri Gelato Lab' };
    }
    if (has('story orbit', 'firenze', 'origine')) {
      return { href: 'story-orbit.html', label: 'Apri Story Orbit' };
    }
    return { href: 'index.html', label: 'Apri Hub' };
  }

  function autoExplainForQuiz(prompt = '', correctText = '') {
    const p = String(prompt || '').toLowerCase();
    const c = String(correctText || '');
    const has = (...needles) => needles.some(n => p.includes(String(n).toLowerCase()));

    if (has('shelf life', 'dopo apertura', 'scadenza', 'brick', 'gonfio', 'cristalli', 'macchia')) {
      return `La risposta corretta è "${c}" perché qui conta prima di tutto la sicurezza alimentare: se un prodotto è fuori standard, non si rischia.`;
    }
    if (has('temperatura', '°c') && has('latte', 'cappuccino', 'steam')) {
      return `La risposta corretta è "${c}" perché la temperatura e la tecnica di montatura determinano microfoam e gusto (oltre una soglia il latte perde dolcezza e qualità).`;
    }
    if (has('espresso', 'estrazione', 'channeling', 'grinder', 'portafiltro', 'tamper', 'distribution')) {
      return `La risposta corretta è "${c}" perché la consistenza dell’espresso dipende da distribuzione, tamp e parametri: piccoli errori qui cambiano subito crema e resa.`;
    }
    if (has('cliente', 'prezzo', 'upsell', 'obiezione', 'starbucks', 'influencer')) {
      return `La risposta corretta è "${c}" perché in servizio conta guidare con una risposta breve, professionale e orientata al valore (senza essere aggressivi).`;
    }
    if (has('churro', 'olio', 'frigg')) {
      return `La risposta corretta è "${c}" perché tempi/temperatura dell’olio impattano croccantezza e sicurezza: lo standard evita churros unti o crudi.`;
    }
    if (has('metti in ordine', 'ordine i passaggi') || has('metti in ordine')) {
      return 'L’ordine corretto serve a ridurre errori e sprechi: la routine standard rende la qualità replicabile anche in rush.';
    }
    return `La risposta corretta è "${c}" perché è lo standard operativo previsto dal training.`;
  }

  function autoSuggestionForQuiz(prompt = '') {
    const p = String(prompt || '').toLowerCase();
    const has = (...needles) => needles.some(n => p.includes(String(n).toLowerCase()));

    if (has('shelf life', 'dopo apertura', 'scadenza')) {
      return 'Suggerimento: etichetta sempre data/ora apertura e applica FIFO. Se hai dubbi, non servire e chiedi conferma al responsabile.';
    }
    if (has('latte', 'steam', 'wand')) {
      return 'Suggerimento: fai purge, aria solo 2–3s, poi rolling fino a ~65°C. Microfoam lucida = niente urla e niente bolle grandi.';
    }
    if (has('espresso', 'estrazione', 'grinder', 'channeling')) {
      return 'Suggerimento: controlla dose, distribuzione e tamp uniforme. Se la resa/tempo è fuori target, correggi prima la macinatura (un click alla volta).';
    }
    if (has('cliente', 'prezzo', 'starbucks')) {
      return 'Suggerimento: usa una frase di valore (ingredienti, cura, esperienza) + una domanda chiusa (“Preferisci più intenso o più cremoso?”) per guidare la scelta.';
    }
    if (has('churro', 'olio', 'frigg')) {
      return 'Suggerimento: verifica temperatura con termometro, friggi in batch coerenti e scola bene. Servi subito: è lì che si vince la qualità.';
    }
    return 'Suggerimento: apri la scheda della categoria collegata e ripassa i 3 punti chiave. Poi rifai il quiz a mente in 20 secondi.';
  }

  function buildQuizReview(question) {
    const prompt = question?.question || '';
    const correctText = getCorrectAnswerText(question);
    const spec = guessSpecFromPrompt(prompt);
    return {
      prompt,
      correctText,
      explanation: autoExplainForQuiz(prompt, correctText),
      suggestion: autoSuggestionForQuiz(prompt),
      specHref: spec?.href || 'index.html',
      specLabel: spec?.label || 'Apri specifiche',
    };
  }

  function openWrongReviewModal(item) {
    const prompt = item?.prompt || 'Quiz';
    const correctText = item?.correctText || '';
    const explanation = item?.explanation || autoExplainForQuiz(prompt, correctText);
    const suggestion = item?.suggestion || autoSuggestionForQuiz(prompt);
    const specHref = item?.specHref || guessSpecFromPrompt(prompt).href;
    const specLabel = item?.specLabel || guessSpecFromPrompt(prompt).label;

    const container = document.createElement('div');
    container.className = 'reward-modal';

    const eyebrow = document.createElement('p');
    eyebrow.style.cssText = 'margin:0 0 8px 0; font-size:12px; letter-spacing:0.22em; text-transform:uppercase; color:var(--brand-rose); font-family:var(--font-medium);';
    eyebrow.textContent = 'Revisione · errore recente';

    const title = document.createElement('h3');
    title.className = 'reward-modal__title';
    title.textContent = 'Rivedi la specifica';

    const q = document.createElement('p');
    q.className = 'reward-modal__text';
    q.style.marginTop = '10px';
    q.textContent = prompt;

    const answer = document.createElement('div');
    answer.style.cssText = 'margin-top:12px; padding:14px 14px; border-radius:14px; background: rgba(236, 65, 140, 0.06); border: 1px solid rgba(236, 65, 140, 0.18); color: var(--ink); line-height:1.55;';
    answer.textContent = correctText ? `Risposta corretta: ${correctText}` : 'Risposta corretta: (non disponibile)';

    const expl = document.createElement('p');
    expl.className = 'reward-modal__text';
    expl.style.marginTop = '12px';
    expl.textContent = `Spiegazione: ${explanation}`;

    const tip = document.createElement('p');
    tip.className = 'reward-modal__text';
    tip.style.marginTop = '10px';
    tip.textContent = suggestion;

    const actions = document.createElement('div');
    actions.className = 'reward-modal__actions';

    const openSpec = document.createElement('button');
    openSpec.type = 'button';
    openSpec.className = 'reward-action primary';
    openSpec.textContent = specLabel || 'Apri specifiche';
    openSpec.dataset.overlayFocus = 'true';
    openSpec.addEventListener('click', () => {
      closeOverlay();
      if (specHref) window.location.href = specHref;
    });

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'reward-action secondary';
    closeBtn.textContent = 'Chiudi';
    closeBtn.addEventListener('click', closeOverlay);

    actions.append(openSpec, closeBtn);
    container.append(eyebrow, title, q, answer, expl, tip, actions);
    openOverlay(container);
  }

  function showChangeGelatoModal() {
    const getUser = () => {
      try { return JSON.parse(localStorage.getItem('badianiUser.profile.v1') || 'null'); } catch { return null; }
    };
    const saveUserGelato = (gelato) => {
      const current = getUser() || {};
      const profile = {
        id: current.id,
        nickname: current.nickname,
        gelato: gelato.trim(),
        createdAt: current.createdAt || Date.now(),
      };
      localStorage.setItem('badianiUser.profile.v1', JSON.stringify(profile));
      return profile;
    };

    const container = document.createElement('div');
    container.className = 'reward-modal';
    container.innerHTML = `
      <div style="text-align:center; margin-bottom:12px;">
        <p style="font-size:28px; margin:0;">🍨</p>
      </div>
      <h3 style="margin:0 0 8px 0; font-size:20px;">Cambia gusto preferito</h3>
      <p style="margin:0 0 16px 0; color:var(--brand-gray-soft, #6b7280); font-size:14px;">Inserisci il tuo nuovo gusto gelato preferito.</p>
      <form novalidate style="margin-bottom:16px;">
        <input type="text" data-new-gelato placeholder="Es. Buontalenti" style="width:100%; padding:12px 14px; border:1px solid #d1d5db; border-radius:10px; font-size:16px; margin-bottom:10px;" />
        <p data-gelato-error style="margin:0 0 10px 0; color:#b91c1c; display:none; font-size:14px;">Inserisci un gusto valido.</p>
        <div style="display:flex; gap:8px;">
          <button type="submit" style="flex:1; padding:10px; border-radius:10px; background:#214098; color:#fff; border:none; font-weight:600;">Salva</button>
          <button type="button" data-cancel-gelato style="flex:1; padding:10px; border-radius:10px; background:#e5e7eb; color:#0f2154; border:none; font-weight:600;">Annulla</button>
        </div>
      </form>
    `;
    const form = container.querySelector('form');
    const input = container.querySelector('[data-new-gelato]');
    const error = container.querySelector('[data-gelato-error]');
    const user = getUser() || {};
    if (input) input.value = user.gelato || '';

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const gelato = (input?.value || '').trim();
      if (gelato.length < 2) {
        if (error) error.style.display = 'block';
        return;
      }
      saveUserGelato(gelato);
      updateUI();
      closeOverlay();
      showToast('🍨 Gusto aggiornato!');
    });
    const cancelBtn = container.querySelector('[data-cancel-gelato]');
    if (cancelBtn) cancelBtn.addEventListener('click', closeOverlay);

    openOverlay(container);
    setTimeout(() => input?.focus({ preventScroll: true }), 0);
  }

  function showChangeProfileModal() {
    const container = document.createElement('div');
    container.className = 'reward-modal';
    container.innerHTML = `
      <div style="text-align:center; margin-bottom:12px;">
        <p style="font-size:28px; margin:0;">👤</p>
      </div>
      <h3 style="margin:0 0 8px 0; font-size:20px;">Cambia profilo</h3>
      <p style="margin:0 0 16px 0; color:var(--brand-gray-soft, #6b7280); font-size:14px;">Vuoi passare a un altro profilo? I progressi del profilo attuale rimarranno salvati.</p>
      <div style="display:flex; gap:8px;">
        <button type="button" data-confirm-switch style="flex:1; padding:10px; border-radius:10px; background:#e11d48; color:#fff; border:none; font-weight:600;">Sì, cambia profilo</button>
        <button type="button" data-cancel-switch style="flex:1; padding:10px; border-radius:10px; background:#e5e7eb; color:#0f2154; border:none; font-weight:600;">Annulla</button>
      </div>
    `;
    const confirmBtn = container.querySelector('[data-confirm-switch]');
    const cancelBtn = container.querySelector('[data-cancel-switch]');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        try { localStorage.removeItem('badianiUser.profile.v1'); } catch {}
        try { window.location.reload(); } catch {}
      });
    }
    if (cancelBtn) cancelBtn.addEventListener('click', closeOverlay);

    openOverlay(container);
  }

  function initProfileControls() {
    const profileRoot = document.querySelector('[data-summary] [data-profile]');
    if (!profileRoot) return;

    // Ensure toolbar and buttons exist
    let toolbar = profileRoot.querySelector('[data-profile-toolbar]');
    if (!toolbar) {
      toolbar = document.createElement('div');
      toolbar.className = 'profile-toolbar';
      toolbar.setAttribute('data-profile-toolbar', '');
      toolbar.style.cssText = 'display:flex; gap:8px; justify-content:flex-end; margin-top:4px; margin-bottom:8px;';
      const stats = profileRoot.querySelector('.summary-stats');
      if (stats) profileRoot.insertBefore(toolbar, stats);
    }

    let editBtnNode = profileRoot.querySelector('[data-profile-edit]');
    if (!editBtnNode) {
      editBtnNode = document.createElement('button');
      editBtnNode.type = 'button';
      editBtnNode.setAttribute('data-profile-edit', '');
      editBtnNode.textContent = 'Cambia gusto';
      editBtnNode.style.cssText = 'padding:8px 12px; border-radius:10px; background:#214098; color:#fff; border:none; font-weight:600;';
      toolbar.appendChild(editBtnNode);
    }

    let switchBtnNode = profileRoot.querySelector('[data-profile-switch]');
    if (!switchBtnNode) {
      switchBtnNode = document.createElement('button');
      switchBtnNode.type = 'button';
      switchBtnNode.setAttribute('data-profile-switch', '');
      switchBtnNode.textContent = 'Cambia profilo';
      switchBtnNode.style.cssText = 'padding:8px 12px; border-radius:10px; background:#e11d48; color:#fff; border:none; font-weight:600;';
      toolbar.appendChild(switchBtnNode);
    }

    // Direct bindings on the buttons to avoid carousel capture from eating clicks.
    // Keep stable handler references so re-initialising doesn't stack multiple listeners.
    if (!editBtnNode.__badianiHandleEdit) {
      editBtnNode.__badianiHandleEdit = (event) => {
        event.preventDefault();
        event.stopPropagation();
        showChangeGelatoModal();
      };
    }
    if (!switchBtnNode.__badianiHandleSwitch) {
      switchBtnNode.__badianiHandleSwitch = (event) => {
        event.preventDefault();
        event.stopPropagation();
        showChangeProfileModal();
      };
    }

    editBtnNode.removeEventListener('click', editBtnNode.__badianiHandleEdit);
    switchBtnNode.removeEventListener('click', switchBtnNode.__badianiHandleSwitch);
    editBtnNode.addEventListener('click', editBtnNode.__badianiHandleEdit);
    switchBtnNode.addEventListener('click', switchBtnNode.__badianiHandleSwitch);

    // Keep delegation for any dynamically injected buttons inside the profile area.
    if (!profileRoot.hasAttribute('data-profile-delegation-bound')) {
      profileRoot.setAttribute('data-profile-delegation-bound', 'true');
      profileRoot.addEventListener('click', (e) => {
        if (e.target.closest('[data-profile-edit]')) {
          e.preventDefault();
          showChangeGelatoModal();
        } else if (e.target.closest('[data-profile-switch]')) {
          e.preventDefault();
          showChangeProfileModal();
        }
      });
    }
  }

  function syncCountdown() {
    if (!hubNodes.countdown || !hubNodes.countdownValue) return;
    if (isCooldownActive()) {
      hubNodes.countdown.hidden = false;
      updateCountdownDigits();
      if (!countdownTicker) {
        countdownTicker = setInterval(() => {
          updateCountdownDigits();
          if (!isCooldownActive()) {
            clearInterval(countdownTicker);
            countdownTicker = null;
            hubNodes.countdown.hidden = true;
            updateUI();
          }
        }, 1000);
      }
    } else if (countdownTicker) {
      clearInterval(countdownTicker);
      countdownTicker = null;
      hubNodes.countdown.hidden = true;
    } else {
      hubNodes.countdown.hidden = true;
    }
  }

  function updateCountdownDigits() {
    if (!hubNodes.countdownValue) return;
    hubNodes.countdownValue.textContent = formatCountdown(getCooldownRemaining());
  }

  function setNumericValue(node, value, counter) {
    if (!node) return;
    const previous = Number(node.getAttribute('data-current') || '0');
    const formatted = String(value);
    if (previous === value) {
      node.textContent = formatted;
      return;
    }
    node.textContent = formatted;
    node.setAttribute('data-current', String(value));
    node.classList.add('is-rolling');
    if (counter) pulseCounter(counter);
    setTimeout(() => node.classList.remove('is-rolling'), 600);
  }

  let toastTimer = null;
  function showToast(message, options = {}) {
    let toast = document.querySelector('[data-toast]');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      toast.setAttribute('data-toast', '');
      const fxLayer = document.querySelector('[data-fx-layer]');
      (fxLayer || document.body).appendChild(toast);
    }

    const anchor = options?.anchor || null;
    const hasAnchor = anchor && Number.isFinite(anchor.x) && Number.isFinite(anchor.y);
    if (hasAnchor) {
      const safeX = Math.min(window.innerWidth - 24, Math.max(24, anchor.x));
      const safeY = Math.min(window.innerHeight - 24, Math.max(64, anchor.y));
      toast.classList.add('toast--anchored');
      toast.style.left = `${safeX}px`;
      toast.style.top = `${safeY}px`;
      toast.style.right = 'auto';
      toast.style.bottom = 'auto';
    } else {
      toast.classList.remove('toast--anchored');
      toast.style.left = '';
      toast.style.top = '';
      toast.style.right = '';
      toast.style.bottom = '';
    }

    toast.textContent = message;
    requestAnimationFrame(() => {
      toast.classList.add('is-visible');
      // Notify listeners that a toast has just been shown
      try {
        document.dispatchEvent(new CustomEvent('badiani:toast-shown', { detail: { message, anchor } }));
      } catch (e) {}
    });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('is-visible');
    }, 2200);
  }

  function pulseCounter(counter) {
    counter.classList.add('nav-token--pulse');
    setTimeout(() => counter.classList.remove('nav-token--pulse'), 650);
  }

  const slugify = (value = '') => {
    return (value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '') || 'tab';
  };

  function getStartOfTodayTs() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  function normalizeOpenedEntryTs(value) {
    if (!value) return 0;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (value === true) return getStartOfTodayTs();
    if (typeof value === 'object' && typeof value.ts === 'number' && Number.isFinite(value.ts)) return value.ts;
    return getStartOfTodayTs();
  }

  function computeCrystalsFromOpenedTabs() {
    // Legacy global recount (v3). Kept to avoid breaking older references.
    // v4 uses per-card progress and no longer relies on this.
    return 0;
  }

  function syncCrystalsFromOpenedTabs() {
    // Legacy no-op (v4). Kept to avoid breaking older references.
    return 0;
  }

  function hasCardCrystalStarToday(cardId) {
    try {
      if (!cardId) return false;
      ensureDailyState();
      const today = getDayStamp();
      const ts = state.cardCrystalConvertedAtToday && state.cardCrystalConvertedAtToday[cardId];
      return !!(ts && getDayStamp(new Date(ts)) === today);
    } catch (e) {
      return false;
    }
  }

  function getCardOpenedTabsCount(cardId) {
    if (!cardId) return 0;
    const opened = state.openedTabsToday || {};
    return Object.keys(opened).filter((key) => key.startsWith(`${cardId}::`)).length;
  }

  function getCardTopupCrystalsCount(cardId) {
    try {
      const entry = (state.topupCrystalsToday || {})[cardId];
      const count = entry && typeof entry.count === 'number' ? entry.count : 0;
      return Math.max(0, count);
    } catch (e) {
      return 0;
    }
  }

  function getCardCrystalTotal(cardId) {
    return getCardOpenedTabsCount(cardId) + getCardTopupCrystalsCount(cardId);
  }

  function getCardCrystalStatus(cardId) {
    ensureDailyState();
    const converted = hasCardCrystalStarToday(cardId);
    if (converted) return { crystals: 0, converted: true };
    const total = getCardCrystalTotal(cardId);
    const crystals = Math.max(0, Math.min(CRYSTALS_PER_STAR - 1, total));
    return { crystals, converted: false };
  }

  function dispatchCardCrystalsUpdated(cardId, { crystals, converted, awarded = 0 } = {}) {
    try {
      document.dispatchEvent(
        new CustomEvent('badiani:crystals-updated', {
          detail: { cardId, crystals, converted, awarded },
        })
      );
    } catch (e) {
      /* ignore */
    }
  }

  function convertCardCrystalsToStar(cardId, source, evt = null) {
    if (!cardId) return;
    if (!state.cardCrystalConvertedAtToday) state.cardCrystalConvertedAtToday = {};
    if (!state.cardStarAwardedToday) state.cardStarAwardedToday = {};
    if (hasCardCrystalStarToday(cardId)) return;
    state.cardCrystalConvertedAtToday[cardId] = Date.now();
    saveState();
    dispatchCardCrystalsUpdated(cardId, { crystals: 0, converted: true, awarded: 1 });
    // Award exactly once per card per day.
    if (!state.cardStarAwardedToday[cardId]) {
      state.cardStarAwardedToday[cardId] = true;
      saveState();
      awardStarFromCrystals(source, { animateFromCrystal: true, evt });
    }
  }

  function recordCard(card, source, totalTabsCount = null, evt = null) {
    if (isStoryOrbitPage) return;
    if (!card) return;
    const resetToday = ensureDailyState();
    if (resetToday) updateUI();
    const id = getCardId(card);
    if (!id) return;
    state.unlockedCards[id] = true;
    // Mark card as opened for the current reset period (weekly).
    if (!state.openedToday) state.openedToday = {};
    state.openedToday[id] = true;

    // If a card has fewer than CRYSTALS_PER_STAR tabs, grant the difference immediately
    // when opening the info sheet (only once per day per card).
    const tabsCount = typeof totalTabsCount === 'number' ? totalTabsCount : null;
    if (tabsCount !== null && tabsCount < CRYSTALS_PER_STAR) {
      if (!state.cardTopupToday) state.cardTopupToday = {};
      if (!state.cardTopupToday[id]) {
        state.cardTopupToday[id] = true;
        saveState();
        const missing = Math.max(0, CRYSTALS_PER_STAR - tabsCount);
        if (missing > 0) {
          if (!state.topupCrystalsToday) state.topupCrystalsToday = {};
          state.topupCrystalsToday[id] = { count: missing, ts: Date.now() };
          saveState();
          handleCardCrystalGain(id, missing, source || card, 'Top-up scheda', evt);
        }
        try { updateCardChecks(); } catch (e) {}
        return;
      }
    }
    saveState();
    try { updateCardChecks(); } catch (e) {}
  }

  function recordTabOpen(card, tabTitle, source, totalTabsCount = null, evt = null) {
    if (isStoryOrbitPage) return;
    if (!card || !tabTitle) return;
    const resetToday = ensureDailyState();
    if (resetToday) updateUI();
    const cardId = getCardId(card);
    if (!cardId) return;
    if (!state.openedTabsToday) state.openedTabsToday = {};
    const tabId = `${cardId}::${slugify(tabTitle)}`;
    const alreadyOpened = !!state.openedTabsToday[tabId];
    if (!alreadyOpened) {
      // Store a richer entry (ts + labels). Backward compatible: normalizeOpenedEntryTs() handles objects.
      const pageSlug = getPageSlug();
      const cardTitle = (card.querySelector('h3')?.textContent || '').trim();
      state.openedTabsToday[tabId] = {
        ts: Date.now(),
        pageSlug,
        cardTitle,
        tabTitle: String(tabTitle || '').trim(),
      };
    }

    // Store a small snapshot of what was read (for quiz generation).
    try {
      if (!state.openedTabContextToday || typeof state.openedTabContextToday !== 'object') {
        state.openedTabContextToday = {};
      }
      const pageSlug = getPageSlug();
      const cardTitle = (card.querySelector('h3')?.textContent || '').trim();
      const raw = (typeof source === 'string') ? source : '';
      // NOTE: tab content is optionally attached by the UI as source.dataset.tabContent
      const contentFromDataset = (() => {
        try {
          const el = (source && source instanceof HTMLElement) ? source : null;
          const txt = el?.dataset?.tabContent || '';
          return String(txt || '');
        } catch {
          return '';
        }
      })();
      const clean = (value) => String(value || '')
        .replace(/\s+/g, ' ')
        .replace(/\s+([,:;.!?])/g, '$1')
        .trim();
      const content = clean(contentFromDataset || raw).slice(0, 900);
      const existing = state.openedTabContextToday[tabId];
      const shouldWrite = !existing || (existing && (!existing.content || String(existing.content).trim().length < 40));
      if (shouldWrite) {
        state.openedTabContextToday[tabId] = {
          ts: Date.now(),
          pageSlug,
          cardTitle,
          tabTitle: String(tabTitle || '').trim(),
          content,
        };
      }
    } catch (e) {
      // Non bloccare la progressione se lo snapshot fallisce.
    }

    state.unlockedCards[cardId] = true;
    state.openedToday[cardId] = true;
    saveState();
    try { updateCardChecks(); } catch (e) {}

    // If this tab was already opened in the current reset period, do not award again.
    if (alreadyOpened) return;

    // Per-card crystals: count up to CRYSTALS_PER_STAR for this card only.
    if (hasCardCrystalStarToday(cardId)) return;
    const totalAfter = getCardCrystalTotal(cardId);
    if (totalAfter <= CRYSTALS_PER_STAR) {
      playCrystalTabAnimation(source, evt);
      handleCardCrystalGain(cardId, 1, source, tabTitle, evt);
    }
  }

  function initStoryOrbitRewards() {
    if (!isStoryOrbitPage) return;
    const storyNodes = Array.from(document.querySelectorAll('[data-story-target]'));
    const storyMedia = document.querySelector('[data-story-fullscreen]');
    if (!storyNodes.length) return;

    if (!state.storyOrbitPrereqToday || typeof state.storyOrbitPrereqToday !== 'object') {
      state.storyOrbitPrereqToday = {};
    }
    const prereq = state.storyOrbitPrereqToday;

    const getActiveStoryId = () => {
      const active = document.querySelector('.story-image.is-active');
      const id = active?.dataset?.storyImage;
      return id || storyNodes[0]?.dataset?.storyTarget || '';
    };

    const getNodeForId = (id) => storyNodes.find((n) => n?.dataset?.storyTarget === id) || null;

    const markPrereq = (id, key) => {
      ensureDailyState();
      if (!id) return;
      if (!prereq[id] || typeof prereq[id] !== 'object') prereq[id] = { tab: false, photo: false };
      prereq[id][key] = true;
      saveState();
    };

    const hasBothPrereqs = (id) => !!(prereq?.[id]?.tab && prereq?.[id]?.photo);

    const ensureStoryStepOpened = (stepKey) => {
      if (!state.openedToday) state.openedToday = {};
      const pseudoId = storyOrbitStepCardId(stepKey);
      state.openedToday[pseudoId] = true;
      if (!state.unlockedCards) state.unlockedCards = {};
      state.unlockedCards[pseudoId] = true;
    };

    const awardStoryCrystalOnce = (crystalKey, stepKey, source, label, evt = null) => {
      ensureDailyState();
      if (!state.openedTabsToday) state.openedTabsToday = {};
      if (!state.openedToday) state.openedToday = {};
      if (!state.unlockedCards) state.unlockedCards = {};

      // Track crystal progress on the virtual card.
      const tabId = `${STORY_ORBIT_MAIN_CARD_ID}::story-${slugify(crystalKey)}`;
      if (state.openedTabsToday[tabId]) return;
      state.openedTabsToday[tabId] = Date.now();
      state.unlockedCards[STORY_ORBIT_MAIN_CARD_ID] = true;

      // Track completion steps for page badge / drawer completion.
      ensureStoryStepOpened(stepKey);

      saveState();

      // Show crystal toast + auto-convert to star at 5.
      playCrystalTabAnimation(source, evt);
      handleCardCrystalGain(STORY_ORBIT_MAIN_CARD_ID, 1, source, label, evt);
      updateUI();
    };

    const tryAwardChapter = (id, source, evt = null) => {
      if (!id) return;
      if (!hasBothPrereqs(id)) return;
      const node = getNodeForId(id);
      const pretty = node?.querySelector('.node-label')?.textContent?.trim() || id;
      awardStoryCrystalOnce(id, id, source || node || storyNodes[0], `Story · ${pretty}`, evt);
    };

    // Fifth crystal: granted on page open (once per day).
    awardStoryCrystalOnce('page-open', 'welcome', document.querySelector('.hero') || storyNodes[0], 'Apertura pagina');

    // Prereq: clicking the left media (fullscreen trigger) counts as “photo seen” for the current chapter.
    if (storyMedia) {
      const onPhoto = (evt) => {
        const id = getActiveStoryId();
        if (!id) return;
        markPrereq(id, 'photo');
        tryAwardChapter(id, storyMedia, evt);
        if (!prereq?.[id]?.tab) {
          const anchor = getOriginPoint(storyMedia, evt);
          showToast('Foto ok. Ora seleziona il capitolo per completare il cristallo.', { anchor });
        }
      };
      storyMedia.addEventListener('click', onPhoto);
      storyMedia.addEventListener('keydown', (evt) => {
        if (evt.key === 'Enter' || evt.key === ' ') {
          onPhoto(evt);
        }
      });
    }

    storyNodes.forEach((node) => {
      node.addEventListener('click', (evt) => {
        const id = node.dataset.storyTarget || '';
        if (!id) return;

        markPrereq(id, 'tab');
        tryAwardChapter(id, node, evt);
        if (!prereq?.[id]?.photo) {
          const anchor = getOriginPoint(node, evt);
          showToast('Capitolo selezionato. Ora clicca la foto a sinistra per completare il cristallo.', { anchor });
        }
      });
    });
  }

  function handleCardCrystalGain(cardId, amount, source, tabTitle, evt = null) {
    if (!cardId) return;
    if (!amount || amount <= 0) return;
    ensureDailyState();

    // If already converted for this card today, ignore any further gains.
    if (hasCardCrystalStarToday(cardId)) return;

    const totalAfter = getCardCrystalTotal(cardId);
    if (totalAfter >= CRYSTALS_PER_STAR) {
      convertCardCrystalsToStar(cardId, source, evt);
      return;
    }

    const crystalsAfter = Math.max(0, Math.min(CRYSTALS_PER_STAR - 1, totalAfter));
    dispatchCardCrystalsUpdated(cardId, { crystals: crystalsAfter, converted: false, awarded: 0 });

    const label = tabTitle ? ` · ${tabTitle}` : '';
    // Force toast to top-center as requested to avoid distraction
    const anchor = { x: window.innerWidth / 2, y: 60 };
    showToast(`✧ +${amount} cristallo${amount > 1 ? 'i' : 'o'}${label} (${crystalsAfter}/${CRYSTALS_PER_STAR})`, { anchor });
    playCrystalPing(source, evt);
    playCrystalSound();
  }

  function awardStarFromCrystals(source, { animateFromCrystal = false, evt = null } = {}) {
    state.stars = Math.min(MAX_STARS, (state.stars || 0) + 1);
    state.progress = state.stars;
    state.quizTokens += 1;
    try {
      if (!state.history) state.history = { quiz: [], days: [], totals: { stars: 0, gelati: 0, bonusPoints: 0 } };
      if (!state.history.totals) state.history.totals = { stars: 0, gelati: 0, bonusPoints: 0 };
      state.history.totals.stars += 1;
    } catch {}
    saveState();
    updateUI();
    const readableTitle = (source?.closest('.guide-card') || source)?.querySelector?.('h3')?.textContent?.trim();
    const label = readableTitle ? `: ${readableTitle}` : '';
    // Force toast to top-center for star award too
    const anchor = { x: window.innerWidth / 2, y: 60 };
    showToast(`⭐ Cristalli -> +1 stella${label}`, { anchor });
    const celebrateSet = state.quizTokens % STARS_FOR_QUIZ === 0;
    const noteLevel = celebrateSet ? 4 : ((state.quizTokens - 1) % STARS_FOR_QUIZ) + 1;
    if (animateFromCrystal) {
      playCrystalMergeToStarAnimation(source, celebrateSet, noteLevel);
    } else {
      playStarAnimation(source, celebrateSet, noteLevel);
    }
    applyStarThresholds();
    const challengeTriggered = maybeTriggerChallenge();
    if (challengeTriggered) {
      pendingMilestoneCheck = true;
    } else {
      checkStarMilestones();
    }
  }

  function applyStarThresholds() {
    if (state.stars >= COOLDOWN_REWARDS.twelve.threshold) {
      applyCooldownCut('twelve');
    }
    if (state.stars >= COOLDOWN_REWARDS.thirty.threshold) {
      applyCooldownCut('thirty');
    }
    if (state.stars >= MAX_STARS) {
      handleFullStarSet();
    }
  }

  function checkStarMilestones() {
    const availableSets = getAvailableSets();
    if (availableSets > state.celebratedSets) {
      state.celebratedSets = availableSets;
      saveState();
      showStarMilestone();
    }
  }

  function applyCooldownCut(key) {
    const reward = COOLDOWN_REWARDS[key];
    if (!reward || state.cooldownCuts[key]) return;
    state.cooldownCuts[key] = true;
    const reductionMs = reward.hours * 60 * 60 * 1000;
    if (isCooldownActive()) {
      state.cooldownReductionMs = Math.min(GELATO_COOLDOWN, state.cooldownReductionMs + reductionMs);
      saveState();
      updateUI();
      if (!isCooldownActive()) {
        clearCooldown();
      }
    } else {
      state.pendingCooldownMs = Math.min(GELATO_COOLDOWN, state.pendingCooldownMs + reductionMs);
      saveState();
    }
  }

  function clearCooldown() {
    state.lastGelatoTs = 0;
    state.cooldownReductionMs = 0;
    state.pendingCooldownMs = 0;
    saveState();
    updateUI();
  }

  function handleFullStarSet() {
    state.stars = 0;
    state.crystals = 0;
    state.quizTokens = 0;
    state.testMeCredits = 0;
    state.progress = 0;
    state.openedToday = {};
    state.openedTabsToday = {};
    state.openedTabContextToday = {};
    state.celebratedSets = 0;
    state.cooldownCuts = { twelve: false, thirty: false };
    state.pendingCooldownMs = 0;
    state.bonusPoints += BONUS_POINTS_PER_FULL_SET;
    try {
      if (!state.history) state.history = { quiz: [], days: [], totals: { stars: 0, gelati: 0, bonusPoints: 0 } };
      if (!state.history.totals) state.history.totals = { stars: 0, gelati: 0, bonusPoints: 0 };
      state.history.totals.bonusPoints += BONUS_POINTS_PER_FULL_SET;
    } catch {}
    saveState();
    updateUI();
    playBonusAnimation();
    showBonusReward();
  }

  function getCardId(card) {
    if (card.dataset.rewardId) return card.dataset.rewardId;
    cardSerial += 1;
    const pageSlug = getPageSlug();
    const title = card.querySelector('h3')?.textContent?.trim().toLowerCase().replace(/[^a-z0-9]+/gi, '-') || 'card';
    const uid = `${pageSlug}-${title}-${cardSerial}`;
    card.dataset.rewardId = uid;
    return uid;
  }

  function getPageSlug() {
    const fromBody = document.body?.dataset?.product;
    if (fromBody) return fromBody;
    return window.location.pathname
      .replace(/\\/g, '/')
      .split('/')
      .pop()
      ?.replace(/\.[^/.]+$/, '') || 'index';
  }

  function getPageStarCount() {
    const slug = getPageSlug();
    // Conta schede UNICHE aperte oggi (non duplicate).
    // Use a stable base id (strip the trailing serial) to avoid over-counting
    // when card ids are generated in different order across reloads.
    const normalizeBaseId = (id) => {
      try {
        return String(id || '').replace(/-\d+$/g, '');
      } catch {
        return '';
      }
    };
    const uniqueCards = new Set();
    Object.keys(state.openedToday || {}).forEach((key) => {
      if (key.startsWith(`${slug}-`)) {
        const base = normalizeBaseId(key);
        if (base) uniqueCards.add(base);
      }
    });
    return uniqueCards.size;
  }

  function getTotalPageCards() {
    // Conta solo le schede prodotto (escluse best practices)
    const totalsMap = {
      'caffe': 18,
      'sweet-treats': 10, // 13 totali - 3 best practices
      'pastries': 6,      // 9 totali - 3 best practices
      'slitti-yoyo': 7,   // 10 totali - 3 best practices (stima)
      'gelato-lab': 8,    // 11 totali - 3 best practices
      'festive': 10,      // 13 totali - 3 best practices (stima)
      'story-orbit': 5    // 4 capitoli + 1 bonus (apertura pagina) = 5 step
    };
    const slug = getPageSlug();
    return totalsMap[slug] || 0;
  }

  function updatePageBadges() {
    const count = getPageStarCount();
    const total = getTotalPageCards();
    document.querySelectorAll('[data-page-stars]').forEach((el) => {
      el.textContent = `⭐ Stelle: ${count}/${total}`;
    });
  }

  function getAvailableSets() {
    return Math.floor(state.quizTokens / STARS_FOR_QUIZ);
  }

  function showStarMilestone() {
    const waiting = isCooldownActive();
    const container = document.createElement('div');
    container.className = 'reward-modal';
    const burst = document.createElement('div');
    burst.className = 'reward-modal__burst';
    burst.textContent = '★ ★ ★';
    const title = document.createElement('h3');
    title.className = 'reward-modal__title';
    title.textContent = waiting ? 'Tre stelline: mini quiz (poi aspetti il cooldown)' : 'Tre stelline: mini quiz sbloccato!';
    const text = document.createElement('p');
    text.className = 'reward-modal__text';
    text.textContent = waiting
      ? 'Puoi fare adesso il mini quiz sulle schede/tab che hai aperto. Se lo passi, sblocchi “Test me”, ma potrai farlo solo quando finisce il countdown del gelato.'
      : 'Fai il mini quiz su ciò che hai aperto: se rispondi giusto, sblocchi “Test me” (il quiz più difficile che assegna il gelato).';
    const actions = document.createElement('div');
    actions.className = 'reward-modal__actions';

    const instruction = document.createElement('p');
    instruction.className = 'reward-modal__hint';
    instruction.style.marginTop = '12px';
    instruction.style.fontSize = '14px';
    instruction.style.color = 'var(--brand-gray-soft)';
    instruction.textContent = 'Chiudi questa notifica per avviare il mini quiz.';

    // Start the MINI quiz as soon as this overlay is dismissed.
    container.dataset.triggerMiniQuizOnClose = 'true';

    const start = document.createElement('button');
    start.className = 'reward-action primary';
    start.type = 'button';
    start.textContent = 'Inizia mini quiz';
    start.dataset.overlayFocus = 'true';
    start.addEventListener('click', () => closeOverlay({ triggerQuiz: true }));

    const later = document.createElement('button');
    later.className = 'reward-action secondary';
    later.type = 'button';
    later.textContent = 'Più tardi';
    later.addEventListener('click', () => {
      // Allow dismissing the milestone without auto-starting the mini quiz.
      try { delete container.dataset.triggerMiniQuizOnClose; } catch (e) {}
      closeOverlay();
    });

    actions.appendChild(start);
    actions.appendChild(later);
    actions.appendChild(instruction);

    container.appendChild(burst);
    container.appendChild(title);
    container.appendChild(text);
    container.appendChild(actions);
    openOverlay(container);
  }

  function showGameInfo() {
    closeActivePopover();
    const container = document.createElement('div');
    container.className = 'reward-modal';
    const burst = document.createElement('div');
    burst.className = 'reward-modal__burst';
    burst.textContent = 'ⓘ';
    const title = document.createElement('h3');
    title.className = 'reward-modal__title';
    title.textContent = 'Come funziona il mini game';
    const text1 = document.createElement('p');
    text1.className = 'reward-modal__text';
    text1.textContent = `Apri i tab dentro una scheda: ogni tab = 1 cristallo di zucchero. ${CRYSTALS_PER_STAR} cristalli si trasformano in 1 stellina (se i tab sono meno di ${CRYSTALS_PER_STAR}, completiamo i cristalli all'ultimo tab). Ogni 3 stelline parte un mini quiz (1 domanda) sulle schede/tab che hai aperto.`;
    const text2 = document.createElement('p');
    text2.className = 'reward-modal__text';
    text2.textContent = 'Mini quiz giusto = sblocchi “Test me” (quiz più difficile). “Test me” perfetto = gelato aggiunto al counter e countdown di 24h (riducibile con 12 e 30 stelline). Mini quiz sbagliato = -3 stelline. Reset automatico: domenica a mezzanotte.';
    const text3 = document.createElement('p');
    text3.className = 'reward-modal__text';
    text3.textContent = 'Completando tutte e 65 le stelline guadagni punti bonus reali da convertire in cash o prodotti Badiani.';
    const actions = document.createElement('div');
    actions.className = 'reward-modal__actions';
    const ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'reward-action primary';
    ok.textContent = 'Ok, giochiamo';
    ok.dataset.overlayFocus = 'true';
    ok.addEventListener('click', closeOverlay);
    actions.appendChild(ok);
    container.append(burst, title, text1, text2, text3, actions);
    openOverlay(container);
  }

  function showBonusReward() {
    const container = document.createElement('div');
    container.className = 'reward-modal';
    const burst = document.createElement('div');
    burst.className = 'reward-modal__burst';
    burst.textContent = '⚡';
    const title = document.createElement('h3');
    title.className = 'reward-modal__title';
    title.textContent = '65 stelline completate!';
    const text = document.createElement('p');
    text.className = 'reward-modal__text';
    text.textContent = `Hai sbloccato il loop completo: stelline azzerate e +${BONUS_POINTS_PER_FULL_SET} punti bonus da spendere in premi cash o prodotti.`;
    const actions = document.createElement('div');
    actions.className = 'reward-modal__actions';
    const ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'reward-action primary';
    ok.textContent = 'Riparto da capo';
    ok.dataset.overlayFocus = 'true';
    ok.addEventListener('click', closeOverlay);
    actions.appendChild(ok);
    container.append(burst, title, text, actions);
    openOverlay(container);
  }

  const KNOWN_PAGE_SLUGS = [
    'sweet-treats',
    'slitti-yoyo',
    'gelato-lab',
    'story-orbit',
    'pastries',
    'festive',
    'caffe',
  ];

  function getCardSlugFromId(cardId) {
    if (!cardId) return '';
    const normalized = String(cardId);
    // Match longest slugs first (some contain hyphens).
    const match = KNOWN_PAGE_SLUGS.find((slug) => normalized.startsWith(`${slug}-`));
    return match || '';
  }

  function getOpenedPageSlugsToday() {
    try {
      ensureDailyState();
      const slugs = new Set();
      const openedToday = state.openedToday || {};
      Object.keys(openedToday).forEach((cardId) => {
        const slug = getCardSlugFromId(cardId);
        if (slug) slugs.add(slug);
      });
      const openedTabsToday = state.openedTabsToday || {};
      Object.keys(openedTabsToday).forEach((tabId) => {
        const cardId = String(tabId).split('::')[0];
        const slug = getCardSlugFromId(cardId);
        if (slug) slugs.add(slug);
      });
      return slugs;
    } catch {
      return new Set();
    }
  }

  const quizTagCache = new Map();
  function inferQuizTags(question) {
    if (!question) return { slugs: new Set(), themes: new Set() };
    if (question.id && quizTagCache.has(question.id)) return quizTagCache.get(question.id);

    const stepsBlob = Array.isArray(question.steps) ? question.steps.join(' ') : '';
    const blob = `${question.question || ''} ${(question.options || []).join(' ')} ${stepsBlob}`.toLowerCase();
    const slugs = new Set();
    const themes = new Set();

    // Slug heuristics (lightweight, no content rewriting required).
    if (/(espresso|cappuccino|latte\b|americano|flat white|macchiato|steam|wand|grinder|portafiltro|shot|crema\b)/i.test(blob)) slugs.add('caffe');
    if (/(waffle|pancake|crepe|cr[eè]pes|porridge|afternoon tea|gelato burger|gelato croissant)/i.test(blob)) slugs.add('sweet-treats');
    if (/(croissant|brownie|cake\b|scone|loaf)/i.test(blob)) slugs.add('pastries');
    if (/(slitti|praline|drag[eè]e|crema slitti|yo-yo|yoyo)/i.test(blob)) slugs.add('slitti-yoyo');
    if (/(gelato|buontalenti|vetrina|spatolatura|vaschetta|coni\b|coppette|affogato premium|stracciatella|nocciola|pistachio)/i.test(blob)) slugs.add('gelato-lab');
    if (/(churros|mulled|vin brul[eè]|panettone|pandoro|natale|festiv)/i.test(blob)) slugs.add('festive');
    if (/(story orbit)/i.test(blob)) slugs.add('story-orbit');

    // Theme heuristics.
    if (/(sicurezza|emergenza|fumo|estintore|118|scott|first aid|igiene|as(l|l\b)|allerg|corrente|pos\b|incident|frigo|temperatura|shelf life)/i.test(blob)) {
      themes.add('safety');
    }
    if (/(upsell|combo|loyalty|cliente|prezzo|starbucks|influencer|sorprendimi|propon|consigl)/i.test(blob)) {
      themes.add('upsell');
    }

    const meta = { slugs, themes };
    if (question.id) quizTagCache.set(question.id, meta);
    return meta;
  }

  const QUIZ_PRODUCT_GUESS_ITEMS = [
    { id: 'caffe-espresso', label: 'Espresso', image: 'assets/products/caffe-espresso.webp', slug: 'caffe' },
    { id: 'caffe-cappuccino', label: 'Cappuccino', image: 'assets/products/caffe-cappuccino.webp', slug: 'caffe' },
    { id: 'caffe-americano', label: 'Americano', image: 'assets/products/caffe-americano.webp', slug: 'caffe' },
    { id: 'caffe-affogato', label: 'Affogato', image: 'assets/products/caffe-affogato.webp', slug: 'caffe' },
    { id: 'sweet-waffle', label: 'Waffle', image: 'assets/products/sweet-waffle.webp', slug: 'sweet-treats' },
    { id: 'sweet-pancake', label: 'Pancake', image: 'assets/products/sweet-pancake.webp', slug: 'sweet-treats' },
    { id: 'sweet-mini-stack', label: 'Mini Stack', image: 'assets/products/sweet-storage.webp', slug: 'sweet-treats' },
    { id: 'pastry-croissant', label: 'Croissant', image: 'assets/products/pastry-croissant.webp', slug: 'pastries' },
    { id: 'pastry-brownie', label: 'Brownie', image: 'assets/products/pastry-brownie.webp', slug: 'pastries' },
    { id: 'pastry-cake', label: 'Cake', image: 'assets/products/pastry-cake.webp', slug: 'pastries' },
    { id: 'slitti-praline', label: 'Praline', image: 'assets/products/slitti-praline.webp', slug: 'slitti-yoyo' },
    { id: 'gelato-box', label: 'Gelato Box', image: 'assets/products/gelato-box.webp', slug: 'gelato-lab' },
    { id: 'gelato-cones', label: 'Coni gelato', image: 'assets/products/gelato-cones.webp', slug: 'gelato-lab' },
    { id: 'festive-churros', label: 'Churros', image: 'assets/products/festive-churros.webp', slug: 'festive' },
    { id: 'panettone', label: 'Panettone', image: 'assets/products/panettone.webp', slug: 'festive' },
    { id: 'pandoro', label: 'Pandoro', image: 'assets/products/pandoro.webp', slug: 'festive' },
  ];

  const QUIZ_FLASH_QUESTIONS = [
    { id: 'f1', question: 'Qual è la priorità in caso di cliente con reazione allergica?', options: ['Chiamo 118', 'Aspetto che passi', 'Offro acqua', 'Cambio argomento'], correct: 0 },
    { id: 'f2', question: 'Temperatura ideale del latte per un cappuccino equilibrato?', options: ['65°C circa', '80°C', '45°C', '100°C'], correct: 0 },
    { id: 'f3', question: 'Cosa fai se noti fumo dalla macchina espresso?', options: ['Spegni e attivi procedura sicurezza', 'Continui a servire', 'Aumenti la pressione', 'Ignori e speri'], correct: 0 },
    { id: 'f4', question: 'Per evitare channeling nell\'espresso la cosa più importante è…', options: ['Distribuzione e tamp uniforme', 'Tampare fortissimo', 'Bagnare il caffè', 'Usare tazza fredda'], correct: 0 },
    { id: 'f5', question: 'Come fai upsell senza pressione con uno studente budget-limitato?', options: ['Proponi una combo risparmio', 'Insisti finché dice sì', 'Non dici nulla mai', 'Sminuisci la scelta'], correct: 0 },
    { id: 'f6', question: 'Churros: olio a 160°C. Cosa fai?', options: ['Porti a 180°C', 'Continui così', 'Aggiungi zucchero in olio', 'Raffreddi l\'olio'], correct: 0 },
    { id: 'f7', question: 'Se il frigo non raffredda correttamente, qual è l\'azione corretta?', options: ['Metti al sicuro i prodotti deperibili e segnali', 'Lasci tutto com\'è', 'Aumenti la temperatura', 'Servi più veloce'], correct: 0 },
    { id: 'f8', question: 'Perché esiste il cooldown gelato?', options: ['Limitare spam premi', 'Per far sembrare il sito lento', 'Serve per i font', 'È un errore'], correct: 0 },
    { id: 'f9', question: 'Cliente indeciso tra cappuccino e latte: come guidi?', options: ['Chiedi preferenza di foam/morbidezza', 'Decidi tu senza domande', 'Ignori e fai espresso', 'Dici che è uguale'], correct: 0 },
    { id: 'f10', question: 'Gelato con cristalli di ghiaccio: cosa indica?', options: ['È stato scongelato/ricongelato', 'È perfetto', 'È più fresco', 'È più dolce'], correct: 0 },
  ];

  function getAskedByMode() {
    if (!state.askedQuestionsByMode || typeof state.askedQuestionsByMode !== 'object') {
      state.askedQuestionsByMode = {};
    }
    return state.askedQuestionsByMode;
  }

  function pickFromPool(pool, count) {
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  function pickQuestionsWithAskedTracking(modeKey, pool, count) {
    if (!modeKey) modeKey = 'classic';
    const askedByMode = getAskedByMode();
    if (!Array.isArray(askedByMode[modeKey])) askedByMode[modeKey] = [];

    let available = pool.filter((q) => !askedByMode[modeKey].includes(q.id));
    if (available.length < count) {
      askedByMode[modeKey] = [];
      available = [...pool];
    }
    const selected = pickFromPool(available, count);
    selected.forEach((q) => {
      if (q && q.id && !askedByMode[modeKey].includes(q.id)) askedByMode[modeKey].push(q.id);
    });
    saveState();
    return selected;
  }

  function buildProductGuessQuestions(modeKey, count, filterSlugs = null) {
    const items = Array.isArray(filterSlugs) && filterSlugs.length
      ? QUIZ_PRODUCT_GUESS_ITEMS.filter((it) => filterSlugs.includes(it.slug))
      : [...QUIZ_PRODUCT_GUESS_ITEMS];
    const base = pickQuestionsWithAskedTracking(`product:${modeKey}`, items, Math.min(count, 3));
    return base.map((item) => {
      const distractors = pickFromPool(
        items.filter((it) => it.id !== item.id),
        3
      );
      const options = [...distractors.map((d) => d.label), item.label].sort(() => Math.random() - 0.5);
      const correct = options.indexOf(item.label);
      return {
        id: `pg-${item.id}`,
        question: 'Indovina il prodotto dalla foto:',
        image: item.image,
        options,
        correct,
      };
    });
  }

  function buildOpenedTabsQuizQuestions(count = 1) {
    try {
      ensureDailyState();

      const ctxRaw = (state.openedTabContextToday && typeof state.openedTabContextToday === 'object')
        ? state.openedTabContextToday
        : {};

      const unslugify = (value) => {
        const s = String(value || '').replace(/[-_]+/g, ' ').trim();
        if (!s) return '';
        return s.charAt(0).toUpperCase() + s.slice(1);
      };

      const entriesFromContext = Object.keys(ctxRaw)
        .map((tabId) => {
          const e = ctxRaw[tabId] || {};
          return {
            tabId,
            ts: typeof e.ts === 'number' ? e.ts : 0,
            pageSlug: String(e.pageSlug || '').trim(),
            cardTitle: String(e.cardTitle || '').trim(),
            tabTitle: String(e.tabTitle || '').trim(),
            content: String(e.content || '').trim(),
          };
        })
        // Keep entries even if content is short: we can still quiz on “which tab did you open”.
        .filter((e) => e.tabTitle || e.cardTitle || e.pageSlug);

      const entriesFromOpenedTabs = (() => {
        try {
          const opened = (state.openedTabsToday && typeof state.openedTabsToday === 'object') ? state.openedTabsToday : {};
          return Object.keys(opened).map((tabId) => {
            const value = opened[tabId];
            const ts = normalizeOpenedEntryTs(value);
            const parts = String(tabId || '').split('::');
            const cardId = parts[0] || '';
            const tabSlug = parts[1] || '';
            const maybeObj = (value && typeof value === 'object') ? value : null;
            const pageSlug = String(maybeObj?.pageSlug || getCardSlugFromId(cardId) || '').trim();
            const cardTitle = String(maybeObj?.cardTitle || '').trim();
            const tabTitle = String(maybeObj?.tabTitle || unslugify(tabSlug) || '').trim();
            return { tabId, ts, pageSlug, cardTitle, tabTitle, content: '' };
          });
        } catch {
          return [];
        }
      })();

      const entriesRaw = [...entriesFromContext, ...entriesFromOpenedTabs]
        .filter((e) => e && e.tabId && (e.tabTitle || e.cardTitle || e.pageSlug));

      if (entriesRaw.length < 1) return [];

      // Dedupe on a stable label (keep the newest snapshot).
      const byLabel = new Map();
      entriesRaw
        .sort((a, b) => (b.ts || 0) - (a.ts || 0))
        .forEach((e) => {
          const label = `${e.pageSlug}::${e.cardTitle}::${e.tabTitle}`.toLowerCase();
          if (!byLabel.has(label)) byLabel.set(label, e);
        });

      const entries = Array.from(byLabel.values());
      if (entries.length < 1) return [];

      const PAGE_LABELS = {
        'caffe': 'Caffè',
        'sweet-treats': 'Sweet treats',
        'pastries': 'Pastries',
        'slitti-yoyo': 'Slitti & Yo-Yo',
        'gelato-lab': 'Gelato Lab',
        'festive': 'Festive',
        'story-orbit': 'Story Orbit',
      };

      const optionLabel = (e) => {
        const page = PAGE_LABELS[e.pageSlug] || (e.pageSlug ? e.pageSlug : 'Scheda');
        const card = e.cardTitle || 'Scheda';
        const tab = e.tabTitle || 'Tab';
        return `${page} · ${card} · ${tab}`;
      };

      const pickRandom = (arr) => {
        if (!Array.isArray(arr) || !arr.length) return '';
        return arr[Math.floor(Math.random() * arr.length)] || '';
      };

      const getProductLabelPool = () => {
        try {
          if (typeof allProducts !== 'undefined' && Array.isArray(allProducts) && allProducts.length) {
            return allProducts.map((p) => String(p?.label || p?.name || '').trim()).filter(Boolean);
          }
        } catch (e) {}
        try {
          if (typeof hardcodedProducts !== 'undefined' && Array.isArray(hardcodedProducts) && hardcodedProducts.length) {
            return hardcodedProducts.map((p) => String(p?.label || p?.name || '').trim()).filter(Boolean);
          }
        } catch (e) {}
        return ['Cappuccino', 'Americano', 'Affogato', 'Gelato Box', 'Churros', 'Croissant'];
      };

      const pickSnippet = (text) => {
        const cleaned = String(text || '')
          .replace(/\s+/g, ' ')
          .replace(/\s+([,:;.!?])/g, '$1')
          .trim();

        const chunks = cleaned.match(/[^.!?]+[.!?]+/g) || [];
        const parts = chunks
          .map((p) => p.trim())
          .filter((p) => p.length >= 35 && p.length <= 140 && !/^https?:\/\//i.test(p));
        if (parts.length) return parts[Math.floor(Math.random() * parts.length)];

        if (cleaned.length <= 140) return cleaned;
        return `${cleaned.slice(0, 120).trim()}…`;
      };

      const templates = entries
        .filter((e) => (e.cardTitle && e.cardTitle.length >= 2) || (e.tabTitle && e.tabTitle.length >= 2))
        .map((e) => ({ id: `tabctx:${e.tabId}`, entry: e }));
      const desiredCount = Math.max(1, Math.min(3, Number(count) || 1));
      const selected = pickQuestionsWithAskedTracking('slot-tabs', templates, Math.min(desiredCount, templates.length));

      if (!Array.isArray(selected) || !selected.length) return [];

      const productLabelPool = getProductLabelPool();

      return selected
        .map((tpl) => {
          const entry = tpl.entry;
          if (!entry || !entry.tabId) return null;

          // Product-first quiz: show what you read, ask which product it matches.
          const productName = String(entry.cardTitle || '').trim();
          const snippet = pickSnippet(entry.content);
          const hasSnippet = !!(snippet && snippet.replace(/\s+/g, ' ').trim().length >= 25);

          // If we don't have enough text to ask a description-based question, fall back to a “which tab” question
          // (still based on opened tabs, never on the old safety pool).
          if (!hasSnippet) {
            const correctLabel = optionLabel(entry);
            const optionsSet = new Set([correctLabel]);
            const distractorPool = entries.filter((e) => e.tabId !== entry.tabId);
            pickFromPool(distractorPool, Math.min(2, distractorPool.length)).forEach((d) => optionsSet.add(optionLabel(d)));
            let guard = 0;
            while (optionsSet.size < 3 && guard < 20) {
              guard += 1;
              const page = PAGE_LABELS[entry.pageSlug] || (entry.pageSlug ? entry.pageSlug : 'Scheda');
              const fakeProduct = pickRandom(productLabelPool) || 'Scheda';
              const label = `${page} · ${fakeProduct} · Tab`;
              if (label === correctLabel) continue;
              optionsSet.add(label);
            }
            const options = Array.from(optionsSet).slice(0, 3).sort(() => Math.random() - 0.5);
            const correct = options.indexOf(correctLabel);
            if (correct < 0 || options.length < 2) return null;
            return {
              id: tpl.id,
              question: productName
                ? `Quale tab hai aperto nella scheda “${productName}”?`
                : 'Quale tab hai aperto questa settimana?',
              options,
              correct,
            };
          }

          const correctProduct = productName || (PAGE_LABELS[entry.pageSlug] || 'Questo prodotto');
          const optionsSet = new Set([correctProduct]);
          let guard = 0;
          while (optionsSet.size < 3 && guard < 40) {
            guard += 1;
            const d = pickRandom(productLabelPool);
            if (!d) continue;
            if (String(d).trim().toLowerCase() === String(correctProduct).trim().toLowerCase()) continue;
            optionsSet.add(String(d).trim());
          }
          const options = Array.from(optionsSet).slice(0, 3).sort(() => Math.random() - 0.5);
          const correct = options.indexOf(correctProduct);
          if (correct < 0 || options.length < 2) return null;

          return {
            id: tpl.id,
            question: `Quale prodotto corrisponde a questa descrizione? “${snippet}”`,
            options,
            correct,
          };
        })
        .filter(Boolean);
    } catch (e) {
      return [];
    }
  }

  function startQuizSession({
    modeKey,
    title,
    introText,
    questions,
    theme = 'default',
    isFlash = false,
    onSuccess = null,
    onFail = null,
    onCancel = null,
  }) {
    const wrapper = document.createElement('div');
    wrapper.className = `quiz-screen quiz-screen--${theme}`;
    const heading = document.createElement('h3');
    heading.textContent = title || 'Quiz';
    const intro = document.createElement('p');
    intro.className = 'reward-modal__text';
    intro.textContent = introText || 'Rispondi correttamente a tutte le domande per vincere.';
    const progress = document.createElement('div');
    progress.className = 'quiz-progress';
    questions.forEach((_, index) => {
      const bar = document.createElement('span');
      if (index === 0) bar.classList.add('is-active');
      bar.dataset.quizStep = index;
      progress.appendChild(bar);
    });

    const stage = document.createElement('div');
    stage.className = 'quiz-stage';

    const actions = document.createElement('div');
    actions.className = 'quiz-actions';
    const later = document.createElement('button');
    later.type = 'button';
    later.className = 'reward-action secondary';
    later.textContent = 'Not now';
    actions.appendChild(later);

    wrapper.append(heading, intro, progress, stage, actions);
    openOverlay(wrapper);

    let currentIndex = 0;
    let sessionActive = true;
    let timerId = null;
    let rafId = null;

    const cleanupTimers = () => {
      if (timerId) {
        clearInterval(timerId);
        timerId = null;
      }
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };

    const observer = new MutationObserver(() => {
      if (sessionActive && !document.body.contains(wrapper)) {
        sessionActive = false;
        cleanupTimers();
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    later.addEventListener('click', () => {
      sessionActive = false;
      cleanupTimers();
      if (typeof onCancel === 'function') {
        try { onCancel(); } catch (e) {}
      }
      closeOverlay({ force: true });
    });

    const markProgress = (index, complete) => {
      const bar = progress.querySelector(`[data-quiz-step="${index}"]`);
      if (!bar) return;
      bar.classList.remove('is-active', 'is-complete');
      bar.classList.add(complete ? 'is-complete' : 'is-active');
    };

    const finishSuccess = () => {
      sessionActive = false;
      cleanupTimers();
      closeOverlay({ force: true });
      if (typeof onSuccess === 'function') {
        try { onSuccess(); } catch (e) { handleQuizSuccess(); }
      } else {
        handleQuizSuccess();
      }
    };

    const fail = (question) => {
      sessionActive = false;
      cleanupTimers();
      if (typeof onFail === 'function') {
        try { onFail(question); } catch (e) { handleQuizWrong(question); }
      } else {
        handleQuizWrong(question);
      }
    };

    const renderOrderStep = (question) => {
      stage.innerHTML = '';
      const card = document.createElement('div');
      card.className = 'quiz-card';

      const stepLabel = document.createElement('p');
      stepLabel.className = 'quiz-step';
      stepLabel.textContent = `Domanda ${currentIndex + 1}/${questions.length}`;

      const prompt = document.createElement('p');
      prompt.className = 'quiz-prompt';
      prompt.textContent = question.question;

      const hint = document.createElement('p');
      hint.className = 'quiz-hint';
      hint.textContent = 'Tocca i passaggi nell’ordine corretto. Poi conferma.';

      const steps = Array.isArray(question.steps) ? question.steps.filter(Boolean) : [];
      const shuffled = [...steps].sort(() => Math.random() - 0.5);

      const shell = document.createElement('div');
      shell.className = 'quiz-order';

      const grid = document.createElement('div');
      grid.className = 'quiz-order__grid';

      const colA = document.createElement('div');
      colA.className = 'quiz-order__col';
      const colATitle = document.createElement('p');
      colATitle.className = 'quiz-order__title';
      colATitle.textContent = 'Passaggi disponibili';
      const availableList = document.createElement('div');
      availableList.className = 'quiz-order__list';
      colA.append(colATitle, availableList);

      const colB = document.createElement('div');
      colB.className = 'quiz-order__col';
      const colBTitle = document.createElement('p');
      colBTitle.className = 'quiz-order__title';
      colBTitle.textContent = 'Il tuo ordine';
      const selectedList = document.createElement('div');
      selectedList.className = 'quiz-order__list quiz-order__list--selected';
      colB.append(colBTitle, selectedList);

      grid.append(colA, colB);
      shell.appendChild(grid);

      const selected = [];
      const availableButtons = [];

      const renderSelected = () => {
        selectedList.innerHTML = '';

        if (!selected.length) {
          const empty = document.createElement('p');
          empty.className = 'quiz-order__empty';
          empty.textContent = 'Seleziona i passaggi dalla lista a sinistra.';
          selectedList.appendChild(empty);
          return;
        }

        selected.forEach((text, idx) => {
          const row = document.createElement('div');
          row.className = 'quiz-order__item';

          const badge = document.createElement('span');
          badge.className = 'quiz-order__index';
          badge.textContent = String(idx + 1);

          const label = document.createElement('span');
          label.className = 'quiz-order__text';
          label.textContent = text;

          const controls = document.createElement('div');
          controls.className = 'quiz-order__controls';

          const up = document.createElement('button');
          up.type = 'button';
          up.className = 'quiz-order__btn';
          up.textContent = '↑';
          up.setAttribute('aria-label', 'Sposta su');
          up.disabled = idx === 0;

          const down = document.createElement('button');
          down.type = 'button';
          down.className = 'quiz-order__btn';
          down.textContent = '↓';
          down.setAttribute('aria-label', 'Sposta giù');
          down.disabled = idx === selected.length - 1;

          const remove = document.createElement('button');
          remove.type = 'button';
          remove.className = 'quiz-order__btn quiz-order__btn--remove';
          remove.textContent = '×';
          remove.setAttribute('aria-label', 'Rimuovi');

          up.addEventListener('click', () => {
            if (!sessionActive) return;
            if (idx <= 0) return;
            const tmp = selected[idx - 1];
            selected[idx - 1] = selected[idx];
            selected[idx] = tmp;
            renderSelected();
            syncConfirm();
          });
          down.addEventListener('click', () => {
            if (!sessionActive) return;
            if (idx >= selected.length - 1) return;
            const tmp = selected[idx + 1];
            selected[idx + 1] = selected[idx];
            selected[idx] = tmp;
            renderSelected();
            syncConfirm();
          });
          remove.addEventListener('click', () => {
            if (!sessionActive) return;
            const removed = selected.splice(idx, 1)[0];
            // Re-enable matching available button
            const btn = availableButtons.find((b) => b && b.dataset && b.dataset.stepText === removed);
            if (btn) {
              btn.disabled = false;
              btn.classList.remove('is-selected');
            }
            renderSelected();
            syncConfirm();
          });

          controls.append(up, down, remove);
          row.append(badge, label, controls);
          selectedList.appendChild(row);
        });
      };

      const footer = document.createElement('div');
      footer.className = 'quiz-order__footer';
      const confirm = document.createElement('button');
      confirm.type = 'button';
      confirm.className = 'reward-action primary';
      confirm.textContent = 'Conferma ordine';
      confirm.disabled = true;

      const reset = document.createElement('button');
      reset.type = 'button';
      reset.className = 'reward-action secondary';
      reset.textContent = 'Reset';

      const syncConfirm = () => {
        confirm.disabled = selected.length !== steps.length;
      };

      reset.addEventListener('click', () => {
        if (!sessionActive) return;
        selected.splice(0, selected.length);
        availableButtons.forEach((btn) => {
          if (!btn) return;
          btn.disabled = false;
          btn.classList.remove('is-selected');
        });
        renderSelected();
        syncConfirm();
      });

      confirm.addEventListener('click', () => {
        if (!sessionActive) return;
        if (selected.length !== steps.length) return;

        // lock UI
        confirm.disabled = true;
        reset.disabled = true;
        availableButtons.forEach((btn) => {
          if (btn) btn.disabled = true;
        });
        selectedList.querySelectorAll('button').forEach((btn) => (btn.disabled = true));

        const isCorrect = steps.every((s, i) => selected[i] === s);
        selectedList.classList.add(isCorrect ? 'is-correct' : 'is-wrong');
        if (!isCorrect) {
          setTimeout(() => fail(question), 550);
          return;
        }

        if (currentIndex === questions.length - 1) {
          setTimeout(() => finishSuccess(), 700);
        } else {
          setTimeout(() => {
            markProgress(currentIndex, true);
            currentIndex += 1;
            markProgress(currentIndex, false);
            renderStep();
          }, 650);
        }
      });

      footer.append(reset, confirm);

      shuffled.forEach((text) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'quiz-option quiz-option--step';
        btn.textContent = text;
        btn.dataset.stepText = text;
        btn.addEventListener('click', () => {
          if (!sessionActive) return;
          if (btn.disabled) return;
          selected.push(text);
          btn.disabled = true;
          btn.classList.add('is-selected');
          renderSelected();
          syncConfirm();
        });
        availableButtons.push(btn);
        availableList.appendChild(btn);
      });

      renderSelected();
      syncConfirm();

      card.append(stepLabel, prompt, hint, shell, footer);
      stage.appendChild(card);
    };

    const renderClassicStep = () => {
      const question = questions[currentIndex];

      if (question && question.type === 'order') {
        renderOrderStep(question);
        return;
      }

      stage.innerHTML = '';
      const card = document.createElement('div');
      card.className = 'quiz-card';
      const stepLabel = document.createElement('p');
      stepLabel.className = 'quiz-step';
      stepLabel.textContent = `Domanda ${currentIndex + 1}/${questions.length}`;
      const prompt = document.createElement('p');
      prompt.className = 'quiz-prompt';
      prompt.textContent = question.question;

      if (question.image) {
        const media = document.createElement('div');
        media.className = 'quiz-media';
        const img = document.createElement('img');
        img.loading = 'lazy';
        img.alt = 'Immagine prodotto del quiz';
        img.src = question.image;
        media.appendChild(img);
        card.appendChild(media);
      }

      const options = document.createElement('div');
      options.className = 'quiz-options';

      const disableAll = () => {
        options.querySelectorAll('button').forEach((btn) => {
          btn.disabled = true;
        });
      };

      (question.options || []).forEach((option, optionIndex) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'quiz-option';
        btn.textContent = option;
        btn.addEventListener('click', () => {
          if (!sessionActive) return;
          disableAll();
          const isCorrect = optionIndex === question.correct;
          btn.classList.add(isCorrect ? 'is-correct' : 'is-wrong');
          if (!isCorrect) {
            setTimeout(() => fail(question), 400);
            return;
          }
          if (currentIndex === questions.length - 1) {
            setTimeout(() => finishSuccess(), 600);
          } else {
            setTimeout(() => {
              markProgress(currentIndex, true);
              currentIndex += 1;
              markProgress(currentIndex, false);
              renderStep();
            }, 500);
          }
        });
        options.appendChild(btn);
      });

      card.append(stepLabel, prompt, options);
      stage.appendChild(card);
    };

    const renderFlashStep = () => {
      const question = questions[currentIndex];
      stage.innerHTML = '';
      cleanupTimers();

      const card = document.createElement('div');
      card.className = 'quiz-card';
      const stepLabel = document.createElement('p');
      stepLabel.className = 'quiz-step';
      stepLabel.textContent = `Flash ${currentIndex + 1}/${questions.length}`;
      const prompt = document.createElement('p');
      prompt.className = 'quiz-prompt';
      prompt.textContent = question.question;

      const hint = document.createElement('p');
      hint.className = 'quiz-hint';
      hint.textContent = 'Seleziona 2 opzioni ERRATE (hai 5 secondi).';

      const timer = document.createElement('div');
      timer.className = 'quiz-timer';
      const timerFill = document.createElement('div');
      timerFill.className = 'quiz-timer__fill';
      const timerLabel = document.createElement('p');
      timerLabel.className = 'quiz-timer__label';
      timerLabel.textContent = '5.0s';
      timer.append(timerFill);

      const options = document.createElement('div');
      options.className = 'quiz-options';

      const selected = new Set();
      const disableAll = () => {
        options.querySelectorAll('button').forEach((btn) => (btn.disabled = true));
      };

      const evaluate = () => {
        disableAll();
        const picks = Array.from(selected);
        const hitCorrect = picks.includes(question.correct);
        if (hitCorrect || picks.length !== 2) {
          // mark picks
          picks.forEach((idx) => {
            const btn = options.querySelector(`[data-option-index="${idx}"]`);
            if (btn) btn.classList.add('is-wrong');
          });
          const correctBtn = options.querySelector(`[data-option-index="${question.correct}"]`);
          if (correctBtn) correctBtn.classList.add('is-correct');
          setTimeout(() => fail(question), 450);
          return;
        }
        // success: show selected as correct (they were wrong options)
        picks.forEach((idx) => {
          const btn = options.querySelector(`[data-option-index="${idx}"]`);
          if (btn) btn.classList.add('is-correct');
        });
        const correctBtn = options.querySelector(`[data-option-index="${question.correct}"]`);
        if (correctBtn) correctBtn.classList.add('is-neutral');

        if (currentIndex === questions.length - 1) {
          setTimeout(() => finishSuccess(), 600);
        } else {
          setTimeout(() => {
            markProgress(currentIndex, true);
            currentIndex += 1;
            markProgress(currentIndex, false);
            renderStep();
          }, 450);
        }
      };

      (question.options || []).forEach((option, optionIndex) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'quiz-option quiz-option--multi';
        btn.textContent = option;
        btn.dataset.optionIndex = String(optionIndex);
        btn.addEventListener('click', () => {
          if (!sessionActive) return;
          if (btn.disabled) return;
          if (selected.has(optionIndex)) {
            selected.delete(optionIndex);
            btn.classList.remove('is-selected');
          } else {
            if (selected.size >= 2) return;
            selected.add(optionIndex);
            btn.classList.add('is-selected');
          }
          if (selected.size === 2) {
            evaluate();
          }
        });
        options.appendChild(btn);
      });

      // 5-second countdown
      const durationMs = 5000;
      const startedAt = Date.now();
      const tick = () => {
        if (!sessionActive) return;
        const elapsed = Date.now() - startedAt;
        const remaining = Math.max(0, durationMs - elapsed);
        const ratio = remaining / durationMs;
        timerFill.style.transform = `scaleX(${ratio})`;
        timerLabel.textContent = `${(remaining / 1000).toFixed(1)}s`;
        if (remaining <= 0) {
          disableAll();
          const correctBtn = options.querySelector(`[data-option-index="${question.correct}"]`);
          if (correctBtn) correctBtn.classList.add('is-correct');
          setTimeout(() => fail(question), 250);
          return;
        }
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);

      card.append(stepLabel, prompt, hint, timer, timerLabel, options);
      stage.appendChild(card);
    };

    const renderStep = () => {
      if (!sessionActive) return;
      if (isFlash) {
        renderFlashStep();
      } else {
        renderClassicStep();
      }
    };

    renderStep();
  }

  function applyMiniQuizPenalty() {
    // Mini quiz fail = -3 stelline (and related tokens).
    state.stars = Math.max(0, (state.stars || 0) - STARS_FOR_QUIZ);
    state.quizTokens = Math.max(0, (state.quizTokens || 0) - STARS_FOR_QUIZ);
    state.progress = state.stars;
    state.celebratedSets = Math.min(state.celebratedSets || 0, getAvailableSets());
    saveState();
    updateUI();
  }

  function showMiniQuiz() {
    closeActivePopover();
    ensureDailyState();
    if (state.quizTokens < STARS_FOR_QUIZ) return;

    const questions = buildOpenedTabsQuizQuestions(1);
    if (!questions.length) {
      const container = document.createElement('div');
      container.className = 'reward-modal';
      const title = document.createElement('h3');
      title.className = 'reward-modal__title';
      title.textContent = 'Mini quiz: apri prima un tab';
      const text = document.createElement('p');
      text.className = 'reward-modal__text';
      text.textContent = 'Per far partire il mini quiz serve aver aperto almeno 1 tab dentro una scheda (es. “Preparazione”, “Suggerimenti”…).';
      const actions = document.createElement('div');
      actions.className = 'reward-modal__actions';
      const ok = document.createElement('button');
      ok.type = 'button';
      ok.className = 'reward-action primary';
      ok.textContent = 'Ok';
      ok.dataset.overlayFocus = 'true';
      ok.addEventListener('click', closeOverlay);
      actions.appendChild(ok);
      container.append(title, text, actions);
      openOverlay(container);
      return;
    }

    const handleMiniSuccess = () => {
      state.testMeCredits = Math.max(0, (state.testMeCredits || 0) + 1);
      saveState();
      updateUI();

      const container = document.createElement('div');
      container.className = 'reward-modal';
      const title = document.createElement('h3');
      title.className = 'reward-modal__title';
      title.textContent = 'Mini quiz superato!';
      const text = document.createElement('p');
      text.className = 'reward-modal__text';
      text.textContent = isCooldownActive()
        ? `Hai sbloccato “Test me”, ma hai già un gelato in cooldown. Torna tra ${formatDuration(getCooldownRemaining())} per provarci.`
        : 'Hai sbloccato “Test me”: è il quiz più difficile che assegna il gelato.';
      const actions = document.createElement('div');
      actions.className = 'reward-modal__actions';

      const later = document.createElement('button');
      later.type = 'button';
      later.className = 'reward-action secondary';
      later.textContent = 'Più tardi';
      later.addEventListener('click', closeOverlay);
      actions.appendChild(later);

      if (!isCooldownActive()) {
        const go = document.createElement('button');
        go.type = 'button';
        go.className = 'reward-action primary';
        go.textContent = 'Inizia Test me';
        go.dataset.overlayFocus = 'true';
        go.addEventListener('click', () => {
          closeOverlay({ force: true });
          showTestMeQuiz();
        });
        actions.appendChild(go);
      } else {
        const ok = document.createElement('button');
        ok.type = 'button';
        ok.className = 'reward-action primary';
        ok.textContent = 'Ok';
        ok.dataset.overlayFocus = 'true';
        ok.addEventListener('click', closeOverlay);
        actions.appendChild(ok);
      }

      container.append(title, text, actions);
      openOverlay(container);
    };

    const handleMiniFail = () => {
      applyMiniQuizPenalty();
      const container = document.createElement('div');
      container.className = 'reward-modal';
      const title = document.createElement('h3');
      title.className = 'reward-modal__title';
      title.textContent = 'Mini quiz perso: -3 stelline';
      const text = document.createElement('p');
      text.className = 'reward-modal__text';
      text.textContent = 'Niente panico: apri nuove schede/tab e riparti. Al prossimo set di 3 stelline ritenti il mini quiz.';
      const actions = document.createElement('div');
      actions.className = 'reward-modal__actions';
      const ok = document.createElement('button');
      ok.type = 'button';
      ok.className = 'reward-action primary';
      ok.textContent = 'Ok';
      ok.dataset.overlayFocus = 'true';
      ok.addEventListener('click', closeOverlay);
      actions.appendChild(ok);
      container.append(title, text, actions);
      openOverlay(container);
    };

    startQuizSession({
      modeKey: 'mini-tabs',
      title: 'Mini quiz · 1 domanda',
      introText: 'Domanda semplice su schede/tab che hai aperto. Sbagli = -3 stelline. Giusto = sblocchi “Test me”.',
      questions,
      theme: 'default',
      onSuccess: handleMiniSuccess,
      onFail: handleMiniFail,
    });
  }

  // Backward compatibility: older flows may still refer to showQuiz().
  function showQuiz() {
    showMiniQuiz();
  }

  function showTestMeQuiz() {
    closeActivePopover();
    ensureDailyState();
    if (state.quizTokens < STARS_FOR_QUIZ) return;
    if ((state.testMeCredits || 0) <= 0) {
      // No access yet: run mini quiz.
      showMiniQuiz();
      return;
    }
    if (isCooldownActive()) {
      showCooldownMessage();
      return;
    }

    // Consume one access credit when starting the hard quiz.
    state.testMeCredits = Math.max(0, (state.testMeCredits || 0) - 1);
    saveState();
    updateUI();

    const restoreCredit = () => {
      state.testMeCredits = Math.max(0, (state.testMeCredits || 0) + 1);
      saveState();
      updateUI();
    };

    const picked = pickQuestionsWithAskedTracking('test-me', QUIZ_QUESTIONS, 3);
    startQuizSession({
      modeKey: 'test-me',
      title: 'Test me · quiz avanzato',
      introText: '3 domande. Perfetto = gelato. Sbagli = vai alla soluzione e riparti.',
      questions: picked,
      theme: 'default',
      // default handlers => handleQuizSuccess / handleQuizWrong
      onCancel: restoreCredit,
    });
  }

  function handleQuizWrong(question) {
    // reset progress
    state.stars = 0;
    state.quizTokens = 0;
    state.testMeCredits = 0;
    state.progress = 0;
    state.celebratedSets = 0;
    state.cooldownCuts = { twelve: false, thirty: false };
    state.pendingCooldownMs = 0;
    if (!state.history) state.history = { quiz: [] };
    if (!Array.isArray(state.history.quiz)) state.history.quiz = [];

    const review = buildQuizReview(question);
    state.history.quiz.push({
      ts: Date.now(),
      correct: false,
      prompt: review.prompt,
      qid: question?.id || null,
      qtype: question?.type || 'mcq',
      correctText: review.correctText,
      explanation: review.explanation,
      suggestion: review.suggestion,
      specHref: review.specHref,
      specLabel: review.specLabel,
    });
    if (state.history.quiz.length > 300) state.history.quiz = state.history.quiz.slice(-300);
    saveState();
    updateUI();

    const prompt = encodeURIComponent(review.prompt || '');
    const answer = encodeURIComponent(review.correctText || '');
    const explain = encodeURIComponent(review.explanation || '');
    const tip = encodeURIComponent(review.suggestion || '');
    const spec = encodeURIComponent(review.specHref || '');
    const target = `quiz-solution.html?prompt=${prompt}&answer=${answer}&explain=${explain}&tip=${tip}&spec=${spec}`;
    window.location.href = target;
  }

  function showQuizFailure() {
    state.stars = 0;
    state.quizTokens = 0;
    state.progress = 0;
    state.celebratedSets = 0;
    state.cooldownCuts = { twelve: false, thirty: false };
    state.pendingCooldownMs = 0;
    saveState();
    updateUI();
    const container = document.createElement('div');
    container.className = 'reward-modal';
    const title = document.createElement('h3');
    title.className = 'reward-modal__title';
    title.textContent = 'Stelline perse!';
    const text = document.createElement('p');
    text.className = 'reward-modal__text';
    text.textContent = 'Il quiz ha trollato: le stelline sono tornate a zero. Apri nuove specifiche oppure aspetta il reset automatico (domenica a mezzanotte).';
    const actions = document.createElement('div');
    actions.className = 'reward-modal__actions';
    const ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'reward-action primary';
    ok.textContent = 'Ci riprovo';
    ok.dataset.overlayFocus = 'true';
    ok.addEventListener('click', closeOverlay);
    actions.appendChild(ok);
    container.append(title, text, actions);
    openOverlay(container);
  }

  function handleQuizSuccess() {
    if (isCooldownActive()) {
      showCooldownMessage(true);
      return;
    }
    state.quizTokens = Math.max(0, state.quizTokens - STARS_FOR_QUIZ);
    state.progress = state.stars;
    state.celebratedSets = Math.min(state.celebratedSets, getAvailableSets());
    state.gelati += 1;
    state.lastGelatoTs = Date.now();
    state.cooldownReductionMs = Math.min(GELATO_COOLDOWN, state.pendingCooldownMs);
    state.pendingCooldownMs = 0;
    if (!state.history) state.history = { quiz: [] };
    if (!Array.isArray(state.history.quiz)) state.history.quiz = [];
    state.history.quiz.push({ ts: Date.now(), correct: true });
    if (state.history.quiz.length > 300) state.history.quiz = state.history.quiz.slice(-300);
    try {
      if (!state.history.totals) state.history.totals = { stars: 0, gelati: 0, bonusPoints: 0 };
      state.history.totals.gelati += 1;
    } catch {}
    saveState();
    updateUI();
    renderGelatoSuccess();
    playGelatoAnimation();
  }

  function renderGelatoSuccess() {
    const container = document.createElement('div');
    container.className = 'reward-modal';
    const burst = document.createElement('div');
    burst.className = 'reward-modal__burst';
    burst.textContent = '🍨';
    const title = document.createElement('h3');
    title.className = 'reward-modal__title';
    title.textContent = 'Bravo! Hai vinto un gelato';
    const text = document.createElement('p');
    text.className = 'reward-modal__text';
    text.textContent = 'Il gelato vola verso il counter e parte il timer di 24 ore. Conserva il mood vincente!';
    const actions = document.createElement('div');
    actions.className = 'reward-modal__actions';
    const ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'reward-action primary';
    ok.textContent = 'Grande!';
    ok.dataset.overlayFocus = 'true';
    ok.addEventListener('click', () => {
      closeOverlay({ force: true });
      if (state.gelati >= GELATO_GOAL) {
        showVictoryMessage();
      }
    });
    actions.appendChild(ok);
    container.append(burst, title, text, actions);
    openOverlay(container);
  }

  function showVictoryMessage() {
    const container = document.createElement('div');
    container.className = 'reward-modal';
    const title = document.createElement('h3');
    title.className = 'reward-modal__title';
    title.textContent = 'Complimenti hai vinto un gelato!';
    const text = document.createElement('p');
    text.className = 'reward-modal__text';
    text.textContent = 'Tre quiz perfetti di fila. Avvisa il trainer e ricomincia la corsa al prossimo cono.';
    const actions = document.createElement('div');
    actions.className = 'reward-modal__actions';
    const ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'reward-action primary';
    ok.textContent = 'Ok';
    ok.dataset.overlayFocus = 'true';
    ok.addEventListener('click', () => {
      closeOverlay();
      state.gelati = 0;
      saveState();
      updateUI();
    });
    actions.appendChild(ok);
    container.append(title, text, actions);
    openOverlay(container, { fullScreen: true });
  }

  let fxLayerEl = null;
  const getFxLayer = () => {
    if (fxLayerEl && fxLayerEl.isConnected) return fxLayerEl;
    fxLayerEl = document.querySelector('[data-fx-layer]');
    if (!fxLayerEl) {
      fxLayerEl = document.createElement('div');
      fxLayerEl.className = 'fx-layer';
      fxLayerEl.setAttribute('data-fx-layer', 'true');
      (document.documentElement || document.body).appendChild(fxLayerEl);
    }
    return fxLayerEl;
  };

  function playCrystalPing(source, evt = null) {
    const { x: cx, y: cy } = getOriginPoint(source, evt);
    const crystal = document.createElement('span');
    crystal.className = 'crystal-flight';
    crystal.textContent = '✧';
    getFxLayer().appendChild(crystal);
    crystal.animate(
      [
        { left: `${cx}px`, top: `${cy}px`, transform: 'translate(-50%, -50%) scale(0.35)', opacity: 0 },
        { left: `${cx}px`, top: `${cy}px`, transform: 'translate(-50%, -50%) scale(1.05)', opacity: 1, offset: 0.35 },
        { left: `${cx}px`, top: `${cy - 10}px`, transform: 'translate(-50%, -50%) scale(0.9)', opacity: 0 },
      ],
      { duration: 520, easing: 'ease-out', fill: 'forwards' }
    ).onfinish = () => crystal.remove();
  }

  const getOriginPoint = (el, evt = null) => {
    // Prefer viewport coordinates (FX layer is fixed to viewport).
    const xFromEvt = evt?.clientX ?? null;
    const yFromEvt = evt?.clientY ?? null;
    if (Number.isFinite(xFromEvt) && Number.isFinite(yFromEvt)) return { x: xFromEvt, y: yFromEvt };

    // Otherwise fall back to the element center.
    if (el && el.getBoundingClientRect) {
      const r = el.getBoundingClientRect();
      const x = r.left + (r.width || 0) / 2;
      const y = r.top + (r.height || 0) / 2;
      if (!Number.isNaN(x) && !Number.isNaN(y)) {
        return { x, y };
      }
    }

    // Last resort: screen center.
    return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  };

  function playCrystalTabAnimation(source, evt = null) {
    const { x: startX, y: startY } = getOriginPoint(source, evt);
    playCrystalRipple(startX, startY);
    const shards = 5;
    for (let i = 0; i < shards; i += 1) {
      const shard = document.createElement('span');
      shard.className = 'crystal-shard';
      shard.style.left = `${startX}px`;
      shard.style.top = `${startY}px`;
      getFxLayer().appendChild(shard);
      const angle = (Math.PI * 2 * i) / shards + Math.random() * 0.6;
      const distance = 30 + Math.random() * 20;
      const offsetX = Math.cos(angle) * distance;
      const offsetY = Math.sin(angle) * distance;
      shard.animate(
        [
          { left: `${startX}px`, top: `${startY}px`, transform: 'translate(-50%, -50%) scale(0.6)', opacity: 0 },
          { left: `${startX + offsetX * 0.5}px`, top: `${startY + offsetY * 0.5}px`, transform: 'translate(-50%, -50%) scale(1)', opacity: 1, offset: 0.35 },
          { left: `${startX + offsetX}px`, top: `${startY + offsetY}px`, transform: 'translate(-50%, -50%) scale(0.4)', opacity: 0 },
        ],
        { duration: 520 + Math.random() * 180, easing: 'ease-out', fill: 'forwards' }
      ).onfinish = () => shard.remove();
    }
    playCrystalPing(source, evt);
  }

  function playCrystalMergeToStarAnimation(source, celebrateSet = false, noteLevel = 1) {
    if (!hubNodes.starValue) {
      playStarAnimation(source, celebrateSet, noteLevel);
      return;
    }
    const { x: startX, y: startY } = getOriginPoint(source);
    const shards = 5;
    for (let i = 0; i < shards; i += 1) {
      const shard = document.createElement('span');
      shard.className = 'crystal-shard';
      shard.style.left = `${startX}px`;
      shard.style.top = `${startY}px`;
      getFxLayer().appendChild(shard);
      const angle = (Math.PI * 2 * i) / shards + Math.random() * 0.4;
      const distance = 28 + Math.random() * 18;
      const offsetX = Math.cos(angle) * distance;
      const offsetY = Math.sin(angle) * distance;
      shard.animate(
        [
          { left: `${startX + offsetX}px`, top: `${startY + offsetY}px`, transform: 'translate(-50%, -50%) scale(0.8)', opacity: 0 },
          { left: `${startX + offsetX * 0.4}px`, top: `${startY + offsetY * 0.4}px`, transform: 'translate(-50%, -50%) scale(1)', opacity: 1, offset: 0.35 },
          { left: `${startX}px`, top: `${startY}px`, transform: 'translate(-50%, -50%) scale(0.4)', opacity: 0 },
        ],
        { duration: 620 + Math.random() * 200, easing: 'ease-in-out', fill: 'forwards' }
      ).onfinish = () => shard.remove();
    }

    const fakeRect = { left: startX, top: startY, width: 0, height: 0 };
    setTimeout(() => {
      playStarAnimation(source, celebrateSet, noteLevel, { startRect: fakeRect, variant: 'from-crystal' });
    }, 260);
  }

  function playCrystalRipple(x, y) {
    const ring = document.createElement('span');
    ring.className = 'crystal-ripple';
    ring.style.left = `${x}px`;
    ring.style.top = `${y}px`;
    getFxLayer().appendChild(ring);
    ring.animate(
      [
        { transform: 'translate(-50%, -50%) scale(0.25)', opacity: 0.45 },
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 0.18 },
        { transform: 'translate(-50%, -50%) scale(1.4)', opacity: 0 },
      ],
      { duration: 520, easing: 'ease-out', fill: 'forwards' }
    ).onfinish = () => ring.remove();
  }

  function playStarAnimation(source, celebrateSet = false, noteLevel = 1, options = {}) {
    if (!hubNodes.starValue) return;
    playStarChime(noteLevel);
    const rectEnd = hubNodes.starValue.getBoundingClientRect();
    const originRect = options.startRect || null;
    const origin = originRect
      ? {
          x: originRect.left + (originRect.width || 0) / 2,
          y: originRect.top + (originRect.height || 0) / 2,
        }
      : getOriginPoint(source);
    const startX = origin.x;
    const startY = origin.y;
    const endX = rectEnd.left + rectEnd.width / 2;
    const endY = rectEnd.top + rectEnd.height / 2;
    
    // Center of viewport for the "Big Float"
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    const star = document.createElement('span');
    star.className = 'star-flight';
    if (options.variant === 'from-crystal') {
      star.classList.add('star-flight--from-crystal');
    }
    const icon = options.icon || (celebrateSet ? '✦' : '★');
    star.textContent = icon;
    getFxLayer().appendChild(star);

    // Animation Sequence:
    // 1. Pop from origin to Center (Fast)
    // 2. Float Big in Center (Pause/Rotate)
    // 3. Fly to Destination (Fast)
    const keyframes = [
      // Start at origin
      { left: `${startX}px`, top: `${startY}px`, transform: 'translate(-50%, -50%) scale(0.5)', opacity: 0, offset: 0 },
      
      // Move to center and grow BIG
      { left: `${centerX}px`, top: `${centerY}px`, transform: 'translate(-50%, -50%) scale(5) rotate(0deg)', opacity: 1, offset: 0.2 },
      
      // Float/Rotate in center
      { left: `${centerX}px`, top: `${centerY}px`, transform: 'translate(-50%, -50%) scale(5.5) rotate(20deg)', opacity: 1, offset: 0.6 },
      
      // Fly to end
      { left: `${endX}px`, top: `${endY}px`, transform: 'translate(-50%, -50%) scale(1)', opacity: 0, offset: 1 }
    ];

    star.animate(
      keyframes,
      { duration: 1500, easing: 'ease-in-out', fill: 'forwards' }
    ).onfinish = () => star.remove();

    // Add extra sparkles during the "Big" phase
    setTimeout(() => {
      for (let i = 0; i < 8; i++) {
        const sparkle = document.createElement('span');
        sparkle.className = 'star-sparkle';
        sparkle.textContent = '✨';
        getFxLayer().appendChild(sparkle);
        const angle = (Math.PI * 2 * i) / 8;
        const dist = 120;
        const tx = Math.cos(angle) * dist;
        const ty = Math.sin(angle) * dist;
        
        sparkle.animate([
          { left: `${centerX}px`, top: `${centerY}px`, transform: 'translate(-50%, -50%) scale(0)', opacity: 1 },
          { left: `${centerX + tx}px`, top: `${centerY + ty}px`, transform: 'translate(-50%, -50%) scale(1.5)', opacity: 0 }
        ], { duration: 600, easing: 'ease-out' }).onfinish = () => sparkle.remove();
      }
    }, 300);
  }

  function playBonusAnimation() {
    if (!hubNodes.bonusValue) return;
    playBonusTwinkle();
    const rect = hubNodes.bonusValue.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    for (let i = 0; i < 12; i++) {
      const particle = document.createElement('span');
      particle.className = 'bonus-particle';
      particle.textContent = ['✨', '⭐', '💫'][Math.floor(Math.random() * 3)];
      getFxLayer().appendChild(particle);
      const angle = (Math.PI * 2 * i) / 12;
      const distance = 60 + Math.random() * 40;
      const offsetX = Math.cos(angle) * distance;
      const offsetY = Math.sin(angle) * distance;
      particle.animate(
        [
          { left: `${centerX}px`, top: `${centerY}px`, transform: 'translate(-50%, -50%) scale(0.3) rotate(0deg)', opacity: 0 },
          { left: `${centerX}px`, top: `${centerY}px`, transform: 'translate(-50%, -50%) scale(1) rotate(90deg)', opacity: 1, offset: 0.2 },
          { left: `${centerX + offsetX}px`, top: `${centerY + offsetY}px`, transform: 'translate(-50%, -50%) scale(0.4) rotate(180deg)', opacity: 0 },
        ],
        { duration: 1200 + Math.random() * 400, easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)', fill: 'forwards' }
      ).onfinish = () => particle.remove();
    }

    const glow = document.createElement('div');
    glow.className = 'bonus-glow';
    getFxLayer().appendChild(glow);
    glow.style.left = `${centerX}px`;
    glow.style.top = `${centerY}px`;
    glow.animate(
      [
        { transform: 'translate(-50%, -50%) scale(0.5)', opacity: 0 },
        { transform: 'translate(-50%, -50%) scale(2.5)', opacity: 0.6, offset: 0.3 },
        { transform: 'translate(-50%, -50%) scale(4)', opacity: 0 },
      ],
      { duration: 800, easing: 'ease-out', fill: 'forwards' }
    ).onfinish = () => glow.remove();
  }

  function playGelatoAnimation() {
    if (!hubNodes.gelatoValue) return;
    playGelatoPop();
    const rect = hubNodes.gelatoValue.getBoundingClientRect();
    const gelato = document.createElement('span');
    gelato.className = 'gelato-flight';
    gelato.textContent = '🍨';
    getFxLayer().appendChild(gelato);
    const startX = window.innerWidth / 2;
    const startY = window.innerHeight / 2;
    const endX = rect.left + rect.width / 2;
    const endY = rect.top + rect.height / 2;

    const pastelColors = ['rgba(255, 182, 193, 0.8)', 'rgba(173, 216, 230, 0.8)', 'rgba(255, 218, 185, 0.8)', 'rgba(221, 160, 221, 0.8)', 'rgba(240, 248, 255, 0.8)'];
    for (let i = 0; i < 8; i++) {
      const sprinkle = document.createElement('span');
      sprinkle.className = 'gelato-sprinkle';
      sprinkle.style.backgroundColor = pastelColors[Math.floor(Math.random() * pastelColors.length)];
      getFxLayer().appendChild(sprinkle);
      const angle = (Math.PI * 2 * i) / 8;
      const distance = 40 + Math.random() * 25;
      const offsetX = Math.cos(angle) * distance;
      const offsetY = Math.sin(angle) * distance;
      sprinkle.animate(
        [
          { left: `${startX}px`, top: `${startY}px`, transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
          { left: `${startX + offsetX}px`, top: `${startY + offsetY}px`, transform: 'translate(-50%, -50%) scale(0.4)', opacity: 0 },
        ],
        { duration: 600 + Math.random() * 200, easing: 'ease-out', fill: 'forwards' }
      ).onfinish = () => sprinkle.remove();
    }

    gelato.animate(
      [
        { left: `${startX}px`, top: `${startY}px`, transform: 'translate(-50%, -50%) scale(0.6)', opacity: 0 },
        { left: `${startX}px`, top: `${startY}px`, transform: 'translate(-50%, -50%) scale(1.2)', opacity: 1 },
        { left: `${endX}px`, top: `${endY - 30}px`, transform: 'translate(-50%, -50%) scale(0.9)', opacity: 1, offset: 0.7 },
        { left: `${endX}px`, top: `${endY}px`, transform: 'translate(-50%, -50%) scale(0.85)', opacity: 0 },
      ],
      { duration: 1200, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', fill: 'forwards' }
    ).onfinish = () => gelato.remove();
  }

  function showCooldownMessage(afterQuiz = false) {
    const container = document.createElement('div');
    container.className = 'reward-modal';
    const title = document.createElement('h3');
    title.className = 'reward-modal__title';
    title.textContent = afterQuiz ? 'Gelato già riscattato' : 'Frena la gola!';
    const text = document.createElement('p');
    text.className = 'reward-modal__text';
    text.textContent = `Hai già ottenuto un gelato virtuale: non essere ingordo! Aspetta ancora ${formatDuration(
      getCooldownRemaining()
    )} prima di tentare di nuovo.`;
    const actions = document.createElement('div');
    actions.className = 'reward-modal__actions';
    const ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'reward-action primary';
    ok.textContent = 'Capito';
    ok.dataset.overlayFocus = 'true';
    ok.addEventListener('click', closeOverlay);
    actions.appendChild(ok);
    container.append(title, text, actions);
    openOverlay(container);
  }

  function isCooldownActive() {
    if (!state.lastGelatoTs) return false;
    return getCooldownRemaining() > 0;
  }

  function getCooldownRemaining() {
    if (!state.lastGelatoTs) return 0;
    const elapsed = Date.now() - state.lastGelatoTs;
    const remaining = GELATO_COOLDOWN - elapsed - state.cooldownReductionMs;
    return Math.max(0, remaining);
  }

  function formatDuration(ms) {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    if (hours <= 0 && minutes <= 0) return 'pochi minuti';
    if (hours <= 0) return `${minutes} min`;
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  function formatCountdown(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }

  return {
    getCardIdFor(card) {
      try {
        if (!card) return '';
        return getCardId(card);
      } catch (e) {
        return '';
      }
    },
    getTabIdFor(card, tabTitle) {
      try {
        if (!card || !tabTitle) return '';
        const cardId = getCardId(card);
        return `${cardId}::${slugify(tabTitle)}`;
      } catch (e) {
        return '';
      }
    },
    getCardCrystalStatus(cardOrCardId) {
      try {
        const cardId = typeof cardOrCardId === 'string'
          ? cardOrCardId
          : (cardOrCardId ? getCardId(cardOrCardId) : '');
        return getCardCrystalStatus(cardId);
      } catch (e) {
        return { crystals: 0, converted: false };
      }
    },
    // Legacy helper: returns crystals for a specific card (if provided).
    getCrystals(cardOrCardId = null) {
      try {
        const status = this.getCardCrystalStatus(cardOrCardId);
        return typeof status.crystals === 'number' ? status.crystals : 0;
      } catch (e) {
        return 0;
      }
    },
    // Legacy helper: true if this card has already converted to a star today.
    hasCrystalStarToday(cardOrCardId = null) {
      try {
        const status = this.getCardCrystalStatus(cardOrCardId);
        return !!status.converted;
      } catch (e) {
        return false;
      }
    },
    isTabOpened(tabId) {
      try {
        ensureDailyState();
        return !!(tabId && state.openedTabsToday && state.openedTabsToday[tabId]);
      } catch (e) {
        return false;
      }
    },
    handleCardOpen(card, source, totalTabsCount, evt) {
      recordCard(card, source, totalTabsCount, evt);
    },
    handleTabOpen(card, tabTitle, source, totalTabsCount, evt) {
      recordTabOpen(card, tabTitle, source, totalTabsCount, evt);
    },
  };
})();

const sectionMenus = document.querySelectorAll('[data-section-menu]');
sectionMenus.forEach((menu) => {
  const trigger = menu.querySelector('[data-section-menu-open]');
  const panel = menu.querySelector('[data-section-menu-panel]');
  const closeButtons = menu.querySelectorAll('[data-section-menu-close]');
  const labelNode = menu.querySelector('[data-section-menu-label]');
  const optionNodes = Array.from(menu.querySelectorAll('[data-section-select]'));
  if (!trigger || !panel || !optionNodes.length) return;

  const sections = new Map();
  optionNodes.forEach((option) => {
    const id = option.dataset.sectionSelect;
    if (!id) return;
    const section = document.getElementById(id);
    if (section) sections.set(id, section);
  });

  if (!sections.size) return;

  const setActiveSection = (id, { scroll = false } = {}) => {
    if (!sections.has(id)) return;
    sections.forEach((section, key) => {
      const isActive = key === id;
      section.classList.toggle('is-visible', isActive);
      section.setAttribute('aria-hidden', String(!isActive));
    });

    optionNodes.forEach((option) => {
      const isActive = option.dataset.sectionSelect === id;
      option.classList.toggle('is-active', isActive);
      option.setAttribute('aria-current', isActive ? 'true' : 'false');
    });

    if (labelNode) {
      const activeOption = optionNodes.find((option) => option.dataset.sectionSelect === id);
      if (activeOption) {
        const label = activeOption.dataset.sectionLabel || activeOption.textContent.trim();
        if (label) labelNode.textContent = label;
      }
    }

    trigger.setAttribute('data-active-section', id);

    if (scroll) {
      const targetSection = sections.get(id);
      if (targetSection) {
        targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  sections.forEach((_, id) => {
    registerSectionActivator(id, (options = {}) => setActiveSection(id, options));
  });

  const openPanel = () => {
    panel.classList.add('is-open');
    panel.setAttribute('aria-hidden', 'false');
    trigger.setAttribute('aria-expanded', 'true');
    bodyScrollLock.lock();
    const focusTarget = panel.querySelector('.section-switcher__option.is-active') || optionNodes[0];
    if (focusTarget) focusTarget.focus({ preventScroll: true });
  };

  const closePanel = () => {
    if (!panel.classList.contains('is-open')) return;
    panel.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
    trigger.setAttribute('aria-expanded', 'false');
    bodyScrollLock.unlock();
    trigger.focus({ preventScroll: true });
  };

  trigger.addEventListener('click', openPanel);
  closeButtons.forEach((button) => button.addEventListener('click', closePanel));
  panel.addEventListener('click', (event) => {
    if (event.target === panel) closePanel();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && panel.classList.contains('is-open')) {
      closePanel();
    }
  });

  optionNodes.forEach((option) => {
    option.addEventListener('click', () => {
      const id = option.dataset.sectionSelect;
      if (!id) return;
      setActiveSection(id, { scroll: true });
      closePanel();
    });
  });

  const defaultOption = optionNodes[0];
  if (defaultOption) {
    const params = new URLSearchParams(window.location.search);
    const tabFromUrl = params.get('tab');
    if (tabFromUrl && sections.has(tabFromUrl)) {
      setActiveSection(tabFromUrl);
    } else {
      setActiveSection(defaultOption.dataset.sectionSelect);
    }
  }
});

// Deep-link to a specific guide card (used by menu search results): ?card=<slug>
(() => {
  let cardKey = '';
  try {
    const params = new URLSearchParams(window.location.search);
    cardKey = (params.get('card') || '').trim().toLowerCase();
  } catch {
    cardKey = '';
  }

  if (!cardKey) return;

  const slugify = (value = '') => {
    return (value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '') || '';
  };

  const focusCard = () => {
    const cards = Array.from(document.querySelectorAll('.guide-card'));
    if (!cards.length) return;

    const target = cards.find((card) => {
      const title = card?.querySelector?.('h3')?.textContent?.trim() || '';
      return slugify(title) === cardKey;
    });

    if (!target) return;

    // If the card sits inside a section switcher panel, ensure it's visible.
    const hiddenSection = target.closest('[id][aria-hidden="true"]');
    if (hiddenSection && hiddenSection.id) {
      try { activateSectionById(hiddenSection.id, { scroll: false }); } catch {}
    }

    try {
      target.classList.add('is-search-target');
      window.setTimeout(() => target.classList.remove('is-search-target'), 2200);
    } catch {
      /* ignore */
    }

    try {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch {
      /* ignore */
    }

    // Optionally open details, so the user lands “inside” the right card.
    const toggle = target.querySelector('[data-toggle-card]');
    if (toggle) {
      try { toggle.click(); } catch {}
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => requestAnimationFrame(focusCard), { once: true });
  } else {
    requestAnimationFrame(focusCard);
  }
})();

// Category completion (daily): if all cards in a page have the gold star, mark category as completed.
(() => {
  const COMPLETION_KEY_PREFIX = 'badianiCategoryCompletion.v1';
  const GAMIFICATION_KEY_PREFIX = 'badianiGamification.v3';

  // NOTE: Despite the name, this returns the *weekly* stamp used for resets.
  // A new stamp starts at local Sunday 00:00.
  const getDayStamp = (date = new Date()) => {
    try {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      // getDay(): 0=Sunday ... 6=Saturday
      d.setDate(d.getDate() - d.getDay());
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    } catch {
      return '';
    }
  };

  const getActiveProfileId = () => {
    try {
      const raw = localStorage.getItem('badianiUser.profile.v1');
      if (!raw) return 'guest';
      const p = JSON.parse(raw);
      return p?.id || 'guest';
    } catch {
      return 'guest';
    }
  };

  const storageKey = () => `${COMPLETION_KEY_PREFIX}:${getActiveProfileId()}`;
  const gamificationKey = () => `${GAMIFICATION_KEY_PREFIX}:${getActiveProfileId()}`;

  const getPageKey = () => {
    try {
      const path = (location.pathname || '').split('/').pop() || '';
      return path || '';
    } catch {
      return '';
    }
  };

  const loadCompletion = () => {
    const today = getDayStamp();
    try {
      const raw = localStorage.getItem(storageKey());
      if (!raw) return { dayStamp: today, completed: {}, celebrated: {} };
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return { dayStamp: today, completed: {}, celebrated: {} };
      if (parsed.dayStamp !== today) return { dayStamp: today, completed: {}, celebrated: {} };
      return {
        dayStamp: today,
        completed: (parsed.completed && typeof parsed.completed === 'object') ? parsed.completed : {},
        celebrated: (parsed.celebrated && typeof parsed.celebrated === 'object') ? parsed.celebrated : {},
      };
    } catch {
      return { dayStamp: today, completed: {}, celebrated: {} };
    }
  };

  const saveCompletion = (value) => {
    try {
      localStorage.setItem(storageKey(), JSON.stringify(value));
    } catch {
      /* ignore */
    }
  };

  const slugify = (value = '') => {
    return (value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '') || 'card';
  };

  const normalizeLegacyCardId = (id) => {
    try {
      if (!id) return '';
      // Legacy ids were `${pageSlug}-${titleSlug}-${serial}`.
      return String(id).replace(/-\d+$/g, '');
    } catch {
      return '';
    }
  };

  const getPageSlug = () => {
    try {
      const fromBody = document.body?.dataset?.product;
      if (fromBody) return fromBody;
      return window.location.pathname
        .replace(/\\/g, '/')
        .split('/')
        .pop()
        ?.replace(/\.[^/.]+$/, '') || 'index';
    } catch {
      return 'index';
    }
  };

  const getCardBaseIdFromNode = (card) => {
    try {
      const pageSlug = getPageSlug();
      const titleText = card?.querySelector?.('h3')?.textContent?.trim() || '';
      const titleSlug = slugify(titleText);
      return `${pageSlug}-${titleSlug}`;
    } catch {
      return '';
    }
  };

  const loadStarredBaseIdsToday = () => {
    const today = getDayStamp();
    try {
      const raw = localStorage.getItem(gamificationKey()) || localStorage.getItem(GAMIFICATION_KEY_PREFIX) || '';
      if (!raw) return new Set();
      const parsed = JSON.parse(raw);
      const converted = parsed?.cardCrystalConvertedAtToday && typeof parsed.cardCrystalConvertedAtToday === 'object'
        ? parsed.cardCrystalConvertedAtToday
        : {};
      const out = new Set();
      Object.keys(converted).forEach((key) => {
        const ts = converted[key];
        if (!ts) return;
        try {
          if (getDayStamp(new Date(ts)) !== today) return;
        } catch {
          return;
        }
        const base = normalizeLegacyCardId(key);
        if (base) out.add(base);
      });
      return out;
    } catch {
      return new Set();
    }
  };

  const loadOpenedBaseIdsToday = () => {
    const today = getDayStamp();
    try {
      const raw = localStorage.getItem(gamificationKey()) || localStorage.getItem(GAMIFICATION_KEY_PREFIX) || '';
      if (!raw) return new Set();
      const parsed = JSON.parse(raw);
      const opened = parsed?.openedToday && typeof parsed.openedToday === 'object'
        ? parsed.openedToday
        : {};
      const out = new Set();
      Object.keys(opened).forEach((key) => {
        const ts = opened[key];
        if (!ts) return;
        try {
          if (getDayStamp(new Date(ts)) !== today) return;
        } catch {
          return;
        }
        const base = normalizeLegacyCardId(key);
        if (base) out.add(base);
      });
      return out;
    } catch {
      return new Set();
    }
  };

  let toastTimer = null;
  const showToastLite = (message) => {
    try {
      let toast = document.querySelector('[data-toast]');
      if (!toast) {
        toast = document.createElement('div');
        toast.className = 'toast';
        toast.setAttribute('data-toast', '');
        const fxLayer = document.querySelector('[data-fx-layer]');
        (fxLayer || document.body).appendChild(toast);
      }
      toast.textContent = message;
      requestAnimationFrame(() => toast.classList.add('is-visible'));
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2600);
    } catch {
      /* ignore */
    }
  };

  const computeAndStoreForCurrentPage = () => {
    const pageKey = getPageKey();
    // Skip hub or pages without a stable key.
    if (!pageKey || /^(index|index_new)\.html$/i.test(pageKey)) return;
    const cards = Array.from(document.querySelectorAll('.guide-card[data-carousel-item], .guide-card[data-toggle-card], .guide-card'))
      .filter((node) => node && node.classList && node.classList.contains('guide-card'));
    if (!cards.length) return;

    const baseIds = cards.map(getCardBaseIdFromNode).filter(Boolean);
    if (!baseIds.length) return;
    const starred = loadStarredBaseIdsToday();
    const opened = loadOpenedBaseIdsToday();
    const allSatisfied = baseIds.every((base) => opened.has(base) || starred.has(base));

    const completion = loadCompletion();
    const prev = !!completion.completed[pageKey];
    if (allSatisfied) completion.completed[pageKey] = true;
    else delete completion.completed[pageKey];

    // Congrats toast (once per day per category), only when it becomes completed.
    const next = !!completion.completed[pageKey];
    const alreadyCelebrated = !!completion.celebrated?.[pageKey];
    if (!prev && next && !alreadyCelebrated) {
      completion.celebrated[pageKey] = true;
      const categoryName = document.querySelector('h1')?.textContent?.trim() || 'la categoria';
      showToastLite(`⭐ Complimenti! Hai completato “${categoryName}”.`);
    }

    saveCompletion(completion);

    if (prev !== next) {
      try {
        document.dispatchEvent(new CustomEvent('badiani:category-completion-updated', {
          detail: { pageKey, completed: next },
        }));
      } catch {
        /* ignore */
      }
    }
  };

  let raf = 0;
  const scheduleCompute = () => {
    if (raf) return;
    raf = window.requestAnimationFrame(() => {
      raf = 0;
      computeAndStoreForCurrentPage();
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleCompute, { once: true });
  } else {
    scheduleCompute();
  }

  document.addEventListener('badiani:crystals-updated', scheduleCompute);
})();

const categoryOrbit = document.querySelector('[data-category-orbit]');
if (categoryOrbit) {
  const chips = categoryOrbit.querySelectorAll('[data-category-target]');
  const panels = categoryOrbit.querySelectorAll('[data-category-panel]');
  const storyExperience = document.querySelector('.story-experience');

  const activateStory = (id) => {
    chips.forEach((chip) => {
      const isActive = chip.dataset.categoryTarget === id;
      chip.classList.toggle('is-active', isActive);
      chip.setAttribute('aria-selected', String(isActive));
      if (isActive && storyExperience) {
        const accent = chip.dataset.accent;
        if (accent) storyExperience.style.setProperty('--story-accent', accent);
      }
    });

    panels.forEach((panel) => {
      const isActive = panel.dataset.categoryPanel === id;
      panel.classList.toggle('is-active', isActive);
    });
  };

  chips.forEach((chip) => {
    chip.addEventListener('click', () => activateStory(chip.dataset.categoryTarget));
  });

  const firstChip = chips[0];
  if (firstChip) activateStory(firstChip.dataset.categoryTarget);
}

const drawerGroups = document.querySelectorAll('[data-drawer-group]');
drawerGroups.forEach((group) => {
  const drawers = group.querySelectorAll('[data-drawer]');
  drawers.forEach((drawer) => {
    const trigger = drawer.querySelector('.drawer-trigger');
    const body = drawer.querySelector('.drawer-body');
    if (!trigger || !body) return;

    const setState = (expand) => {
      drawer.classList.toggle('is-open', expand);
      trigger.setAttribute('aria-expanded', String(expand));
      body.style.maxHeight = expand ? `${body.scrollHeight}px` : '0px';
    };

    trigger.addEventListener('click', () => {
      const willExpand = !drawer.classList.contains('is-open');
      drawers.forEach((item) => {
        if (item !== drawer) {
          item.classList.remove('is-open');
          const itemBody = item.querySelector('.drawer-body');
          const itemTrigger = item.querySelector('.drawer-trigger');
          if (itemBody) itemBody.style.maxHeight = '0px';
          if (itemTrigger) itemTrigger.setAttribute('aria-expanded', 'false');
        }
      });
      setState(willExpand);
    });
  });
});

const quickNav = document.querySelector('.quick-nav');
if (quickNav) {
  const links = quickNav.querySelectorAll('a[href^="#"]');
  const map = new Map();
  links.forEach((link) => {
    const id = link.getAttribute('href').replace('#', '');
    const section = document.getElementById(id);
    if (section) map.set(section, link);
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const link = map.get(entry.target);
        if (!link) return;
        if (entry.isIntersecting) {
          links.forEach((l) => l.removeAttribute('aria-current'));
          link.setAttribute('aria-current', 'true');
        }
      });
    },
    { threshold: 0.4 }
  );

  map.forEach((_, section) => observer.observe(section));
}

// Normalizza le "specifiche" nelle card quando sono incollate troppo "a lista" (es. Cup/Pulizia/Servizio in un solo punto)
// e rimuove voci duplicate per ottimizzare spazio.
const normalizeGuideCardStatLists = () => {
  const specTidy = (value) => (value || '').replace(/\s+/g, ' ').trim();
  const isJunkSpecText = (value) => {
    const t = specTidy(value).toLowerCase();
    if (!t) return true;
    // Pasted separators / placeholders that should never become a list item.
    if (/^[·•\-–—.]+$/.test(t)) return true;
    if (t === 'niente' || t === 'nulla' || t === 'nessuno') return true;
    if (t === 'da definire') return true;
    return false;
  };
  const normalizeBulletNoise = (value) => {
    const text = specTidy(value);
    if (!text) return '';
    return text
      // Clean odd paste artifacts like "·. ·" or "+.".
      .replace(/\s*\+\s*\./g, ' +')
      .replace(/\s*·\s*\./g, ' ·')
      .replace(/\s*\.\s*·\s*/g, ' · ')
      .replace(/\s*·\s*/g, ' · ')
      // Collapse repeated separators and punctuation noise.
      .replace(/(\s*·\s*){2,}/g, ' · ')
      .replace(/,{2,}/g, ',')
      .replace(/\s*\+\s*$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };
  const escapeHtml = (value) => (value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const splitMultiSpecsInline = (raw) => {
    const text = normalizeBulletNoise(raw);
    if (!text) return [];
    const keys = ['Cup', 'Tazza', 'Milk', 'Latte', 'Pulizia', 'Servizio', 'Temperatura', 'Target', 'Mix', 'Warm-up', 'Riposo', 'Shelf life', 'Conservazione', 'Porzioni'];
    const keyAlternation = keys
      .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .sort((a, b) => b.length - a.length)
      .join('|');
    const re = new RegExp(`\\b(${keyAlternation})\\b`, 'gi');
    const matches = [];
    let m;
    while ((m = re.exec(text))) matches.push({ index: m.index });
    if (matches.length <= 1) return [text];

    const out = [];
    for (let i = 0; i < matches.length; i += 1) {
      const start = matches[i].index;
      const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
      const seg = normalizeBulletNoise(text.slice(start, end));
      if (seg) out.push(seg);
    }
    return out.length ? out : [text];
  };

  const parseInlineSpec = (raw) => {
    const text = normalizeBulletNoise(raw);
    if (!text) return null;
    if (text.includes(':')) {
      const [labelPart, ...rest] = text.split(':');
      return { label: specTidy(labelPart) || 'Dettaglio', detail: specTidy(rest.join(':')) || 'Da definire' };
    }
    const tokenMatch = text.match(/^([A-Za-zÀ-ÿ0-9°]{2,14})\s+(.+)$/);
    if (tokenMatch) {
      const labelCandidate = specTidy(tokenMatch[1]);
      const rest = specTidy(tokenMatch[2]);
      const punctuationCount = (rest.match(/[.!?]/g) || []).length;
      const isProbablySentence = rest.length > 120 || punctuationCount >= 2;
      // Allow short specs that end with a dot.
      if (!isProbablySentence) return { label: labelCandidate, detail: rest.replace(/[.\s]+$/g, '').trim() };
    }
    return { label: 'Dettaglio', detail: text };
  };

  const normalizeInlineLabel = (label, detail) => {
    const l = specTidy(label).toLowerCase();
    const d = specTidy(detail).toLowerCase();
    if (l === 'cup' || l === 'tazza') return 'Tazza';
    if (l.includes('pulizia') || l.includes('clean')) return 'Pulizia';
    if (l.includes('servizio') || l.includes('service')) return 'Servizio';
    if (l.includes('milk') || l.includes('latte')) return 'Latte';
    if (l.includes('temperatura') || l.includes('target')) return 'Temperatura';
    if ((label || '') === 'Dettaglio') {
      if (d.includes('°c') || d.includes('target')) return 'Temperatura';
      if (d.includes('oz') || d.includes('tazza') || d.includes('cup')) return 'Tazza';
      if (d.includes('flush') || d.includes('portafiltro') || d.includes('pulizia')) return 'Pulizia';
      if (d.includes('vassoio') || d.includes('multi-ordine') || d.includes('servi')) return 'Servizio';
    }
    return specTidy(label) || 'Dettaglio';
  };

  const contextualizeInlineDetail = (label, detail) => {
    const l = specTidy(label).toLowerCase();
    const d = specTidy(detail);
    if (!d) return 'Da definire';
    if (l === 'shelf life' && /^life\s+/i.test(d)) return d.replace(/^life\s+/i, '').trim();
    if (l === 'servizio' && /multi-ordine/i.test(d) && /ultimo/i.test(d)) return 'In multi-ordine: servilo per ultimo sul vassoio.';
    if (l === 'pulizia' && /flush/i.test(d) && d.includes('+')) {
      const normalized = d
        .replace(/\s*\+\s*/g, ' e ')
        .replace(/\basciugare\b/gi, 'asciuga')
        .replace(/\bportafiltro\b/gi, 'il portafiltro');
      return /[.!?]$/.test(normalized) ? normalized : `${normalized}.`;
    }
    if (l === 'tazza' && /\boz\b/i.test(d) && /preriscald/i.test(d) && !/[()]/.test(d)) {
      return d.replace(/\s+preriscald\w*/i, (m) => ` (${m.trim()})`);
    }
    return /[.!?]$/.test(d) ? d : (d.length < 60 ? `${d}.` : d);
  };

  const dedupeInline = (items) => {
    const map = new Map();
    const order = [];
    items.forEach((item) => {
      const label = specTidy(item?.label);
      const detail = specTidy(item?.detail);
      if (!label || !detail) return;
      if (isJunkSpecText(detail)) return;
      const key = label.toLowerCase();
      if (!map.has(key)) {
        map.set(key, { label, details: new Set() });
        order.push(key);
      }
      map.get(key).details.add(detail);
    });
    return order.map((key) => {
      const entry = map.get(key);
      return { label: entry.label, detail: Array.from(entry.details).join(' · ') };
    });
  };

  document.querySelectorAll('.guide-card .stat-list').forEach((list) => {
    const items = Array.from(list.querySelectorAll('li'));
    if (!items.length) return;

    let hadMulti = false;
    const parsed = [];
    items.forEach((li) => {
      const raw = specTidy(li.textContent);
      if (!raw) return;
      const segs = splitMultiSpecsInline(raw);
      if (segs.length > 1) hadMulti = true;
      segs.forEach((seg) => {
        const p = parseInlineSpec(seg);
        if (!p) return;
        const label = normalizeInlineLabel(p.label, p.detail);
        const detail = contextualizeInlineDetail(label, p.detail);
        parsed.push({ label, detail });
      });
    });

    const normalized = dedupeInline(parsed);
    const hasDuplicatesRemoved = normalized.length < parsed.length;
    if (!hadMulti && !hasDuplicatesRemoved) return;

    list.innerHTML = '';
    normalized.forEach((item) => {
      const li = document.createElement('li');
      if (item.label && item.label !== 'Dettaglio') {
        li.innerHTML = `<strong>${escapeHtml(item.label)}</strong> <span class="stat-text">${escapeHtml(item.detail)}</span>`;
      } else {
        li.textContent = item.detail;
      }
      list.appendChild(li);
    });
  });
};

try {
  // Esegui subito (script spesso è in fondo pagina) e anche a DOM pronto.
  normalizeGuideCardStatLists();
  window.addEventListener('DOMContentLoaded', normalizeGuideCardStatLists);
} catch {}

// Fix common emoji/encoding paste artifacts across pages (e.g. "?? Upselling", "??? Pro tip", search button).
const normalizePasteArtifactsInUI = () => {
  try {
    const fixText = (node) => {
      if (!node) return;
      const t = (node.textContent || '').trim();
      if (!t) return;
      if (t === '?? Upselling') node.textContent = '💰 Upselling';
      if (t === '?? Tecniche di Vendita' || t === '?? Tecniche di vendita') node.textContent = '💰 Tecniche di vendita';
      if (t === '??? Pro tip:' || t === '??? Pro tip') node.textContent = '🛠️ Pro tip:';
      if (t === '??? Qualità check:' || t === '??? Qualita check:' || t === '??? Qualità check') node.textContent = '🛠️ Qualità check:';
    };

    document
      .querySelectorAll('.details strong, .tips strong, .steps strong')
      .forEach((el) => fixText(el));

    const searchBtn = document.querySelector('[data-menu-search-btn]');
    if (searchBtn && (searchBtn.textContent || '').trim() === '??') {
      searchBtn.textContent = '🔎';
      searchBtn.setAttribute('aria-label', 'Cerca');
    }
  } catch (e) {}
};

try {
  normalizePasteArtifactsInUI();
  window.addEventListener('DOMContentLoaded', normalizePasteArtifactsInUI);
} catch {}

// Mobile-first: ensure product photos inside horizontally scrollable carousels actually load.
// Some mobile browsers are flaky with native lazy-loading inside overflow containers.
const eagerLoadGuideMedia = () => {
  try {
    document.querySelectorAll('.guide-media img').forEach((img) => {
      try {
        img.loading = 'eager';
        img.decoding = 'async';
        // Optional hint; ignored where unsupported.
        img.fetchPriority = 'high';
      } catch (e) {}
      try {
        img.removeAttribute('loading');
      } catch (e) {}
    });
  } catch (e) {}
};

try {
  eagerLoadGuideMedia();
  window.addEventListener('DOMContentLoaded', eagerLoadGuideMedia);
} catch {}

const toggles = document.querySelectorAll('[data-toggle-card]');
toggles.forEach((button) => {
  button.setAttribute('aria-expanded', 'false');

  button.addEventListener('click', (event) => {
    const card = button.closest('.guide-card');
    if (!card) return;
    const details = card.querySelector('.details');
    if (!details) return;
    const cardTitle = card.querySelector('h3')?.textContent || '';
    const cardId = (gamification?.getCardIdFor ? gamification.getCardIdFor(card) : '') || card.dataset.rewardId || cardTitle;

    bodyScrollLock.lock();
    
    // Crea overlay
    const overlay = document.createElement('div');
    overlay.className = 'card-modal-overlay';
    
    // Crea modal
    const modal = document.createElement('div');
    modal.className = 'card-modal';
    
    // Crea header modal con pillole cristalli
    const modalHeader = document.createElement('div');
    modalHeader.className = 'card-modal-header';

    const headerTitle = document.createElement('h3');
    headerTitle.textContent = cardTitle;

    const crystalChip = document.createElement('div');
    crystalChip.className = 'card-modal-crystals';
    crystalChip.setAttribute('role', 'status');
    crystalChip.setAttribute('aria-live', 'polite');
    crystalChip.setAttribute('aria-label', 'Cristalli disponibili');
    crystalChip.innerHTML = `
      <span class="card-modal-crystals__icon" aria-hidden="true">✧</span>
      <span class="card-modal-crystals__value" data-card-modal-crystals>0</span>
      <span class="card-modal-crystals__suffix" aria-hidden="true">cristalli</span>
    `;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'card-modal-close';
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `;

    modalHeader.appendChild(headerTitle);
    modalHeader.appendChild(crystalChip);
    modalHeader.appendChild(closeBtn);

    const modalCrystalValue = crystalChip.querySelector('[data-card-modal-crystals]');
    const refreshCrystalBadge = () => {
      if (!modalCrystalValue) return;
      const status = gamification?.getCardCrystalStatus ? gamification.getCardCrystalStatus(cardId) : { crystals: 0, converted: false };
      handleCrystalUpdate({ detail: { ...status, cardId } });
    };
    // Live update handler for crystal changes
    const handleCrystalUpdate = (e) => {
      if (!modalCrystalValue) return;
      const detail = (e && e.detail) || {};
      if (detail.cardId && cardId && detail.cardId !== cardId) return;
      const next = typeof detail.crystals === 'number' ? detail.crystals : (gamification?.getCrystals ? gamification.getCrystals(cardId) : 0);
      const converted = !!detail.converted;
      const icon = crystalChip.querySelector('.card-modal-crystals__icon');
      const suffix = crystalChip.querySelector('.card-modal-crystals__suffix');
      if (converted) {
        crystalChip.classList.add('is-starred');
        if (icon) icon.textContent = '★';
        modalCrystalValue.textContent = '';
        modalCrystalValue.hidden = true;
        if (suffix) {
          suffix.textContent = '';
          suffix.hidden = true;
        }
        crystalChip.setAttribute('aria-label', 'Stella ottenuta');
      } else {
        crystalChip.classList.remove('is-starred');
        if (icon) icon.textContent = '✧';
        modalCrystalValue.textContent = String(next);
        modalCrystalValue.hidden = false;
        if (suffix) {
          suffix.textContent = 'cristalli';
          suffix.hidden = false;
        }
        crystalChip.setAttribute('aria-label', 'Cristalli disponibili');
      }
    };
    document.addEventListener('badiani:crystals-updated', handleCrystalUpdate);
    const handleToastShown = (e) => {
      const msg = (e && e.detail && e.detail.message) || '';
      if (!msg) return;
      if (/stella|cristall|✧/i.test(msg)) {
        refreshCrystalBadge();
      }
    };
    document.addEventListener('badiani:toast-shown', handleToastShown);
    // Initialize badge according to persisted state (show starred if conversion happened today)
    try {
      refreshCrystalBadge();
    } catch (e) {}
    
    // Crea sidebar per immagine e info rapide
    const modalSidebar = document.createElement('div');
    modalSidebar.className = 'card-modal-sidebar';
    
    // Crea body modal per dettagli tecnici
    const modalBody = document.createElement('div');
    modalBody.className = 'card-modal-body';

    // Soft auto-scroll: when a tab opens, center it in view inside the modal body
    const prefersReducedMotion = (() => {
      try {
        return !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      } catch (e) {
        return false;
      }
    })();

    const softRevealOpenedTabInModalBody = (headerNode, bodyNode) => {
      try {
        if (!headerNode || !modalBody) return;
        const container = modalBody;
        const containerRect = container.getBoundingClientRect();
        const headerRect = headerNode.getBoundingClientRect();
        const currentTop = container.scrollTop;

        // Put the header closer to the top so the expanded content below is visible.
        // Smaller offset => scroll a bit more.
        const topOffset = Math.round(Math.min(110, Math.max(20, containerRect.height * 0.06)));
        const maxTop = Math.max(0, container.scrollHeight - container.clientHeight);
        const targetTop = currentTop + (headerRect.top - containerRect.top) - topOffset;
        const nextTop = Math.max(0, Math.min(maxTop, targetTop));
        container.scrollTo({ top: nextTop, behavior: prefersReducedMotion ? 'auto' : 'smooth' });

        // If the expanded panel is still cut at the bottom, nudge the scroll down.
        if (bodyNode) {
          requestAnimationFrame(() => {
            try {
              const cRect = container.getBoundingClientRect();
              const bRect = bodyNode.getBoundingClientRect();
              const bottomPad = 18;
              if (bRect.bottom > cRect.bottom - bottomPad) {
                const delta = bRect.bottom - (cRect.bottom - bottomPad);
                const freshMaxTop = Math.max(0, container.scrollHeight - container.clientHeight);
                const nudged = Math.max(0, Math.min(freshMaxTop, container.scrollTop + delta));
                container.scrollTo({ top: nudged, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
              }
            } catch (e) {}
          });
        }
      } catch (e) {}
    };
    const figure = card.querySelector('.guide-media') || card.querySelector('figure');
    const intro = card.querySelector('p');
    const tags = card.querySelector('.tag-row');
    const statList = card.querySelector('.stat-list');
    const sidebarFragment = document.createDocumentFragment();
    const bodyFragment = document.createDocumentFragment();

    if (figure) {
      const figClone = figure.cloneNode(true);
      figClone.className = 'modal-product-image';
      figClone.style.display = 'block';
      figClone.style.visibility = 'visible';
      figClone.style.opacity = '1';

      // Ensure the modal image loads immediately.
      try {
        figClone.querySelectorAll('img').forEach((img) => {
          try {
            img.loading = 'eager';
            img.decoding = 'async';
            img.fetchPriority = 'high';
            img.style.display = 'block';
            img.style.visibility = 'visible';
            img.style.opacity = '1';
          } catch (e) {}
          try {
            img.removeAttribute('loading');
          } catch (e) {}
        });
      } catch (e) {}
      sidebarFragment.appendChild(figClone);
    }
    if (tags) {
      const tagsClone = tags.cloneNode(true);
      sidebarFragment.appendChild(tagsClone);
    }
    let introClone = null;
    if (intro) {
      introClone = intro.cloneNode(true);
      introClone.classList.add('card-modal-intro');
    }

    const statItemsData = [];

    const tidy = (value) => (value || '').replace(/\s+/g, ' ').trim();

    const isMeaningfulPoint = (value) => {
      const t = tidy(value).toLowerCase();
      if (!t) return false;
      // Discard pasted separators / punctuation-only fragments.
      if (/^[·•\-–—.]+$/.test(t)) return false;
      // Discard explicit placeholders.
      if (t === 'niente' || t === 'nulla' || t === 'nessuno') return false;
      if (t === 'da definire') return false;
      return true;
    };

    const normalizeBulletNoise = (value) => {
      const text = tidy(value);
      if (!text) return '';
      return text
        // Clean odd paste artifacts like "·. ·" or "+.".
        .replace(/\s*\+\s*\./g, ' +')
        .replace(/\s*·\s*\./g, ' ·')
        .replace(/\s*\.\s*·\s*/g, ' · ')
        .replace(/\s*·\s*/g, ' · ')
        // Collapse repeated separators and punctuation noise.
        .replace(/(\s*·\s*){2,}/g, ' · ')
        .replace(/,{2,}/g, ',')
        .replace(/\s*\+\s*$/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    };

    const splitDetailPoints = (detail) => {
      const text = normalizeBulletNoise(detail);
      if (!text) return [];
      const parts = text
        .split(' · ')
        .map((p) => tidy(p).replace(/^[\-•]+\s*/g, '').trim())
        .map((p) => p.replace(/^[.]+\s*/g, '').trim())
        .map((p) => p.replace(/[.\s]+$/g, '').trim())
        .map((p) => p.replace(/\s*\+\s*$/g, '').trim())
        .filter((p) => isMeaningfulPoint(p));
      return parts.length ? parts : [];
    };

    const splitMultiSpecs = (raw) => {
      const text = normalizeBulletNoise(raw);
      if (!text) return [];

      // Some lists are pasted as: "Cup ... Pulizia ... Servizio ..." in a single <li>.
      const keys = [
        'Cup',
        'Tazza',
        'Milk',
        'Latte',
        'Pulizia',
        'Servizio',
        'Temperatura',
        'Target',
        'Mix',
        'Warm-up',
        'Riposo',
        'Shelf life',
        'Conservazione',
        'Porzioni'
      ];

      const keyAlternation = keys
        .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .sort((a, b) => b.length - a.length)
        .join('|');

      const re = new RegExp(`\\b(${keyAlternation})\\b`, 'gi');
      const matches = [];
      let m;
      while ((m = re.exec(text))) {
        matches.push({ index: m.index });
      }

      if (matches.length <= 1) return [text];

      const segments = [];
      for (let i = 0; i < matches.length; i += 1) {
        const start = matches[i].index;
        const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
        const seg = normalizeBulletNoise(text.slice(start, end));
        if (seg) segments.push(seg);
      }
      return segments.length ? segments : [text];
    };

    const normalizeSpecLabel = (label, detail) => {
      const rawLabel = tidy(label);
      const rawDetail = tidy(detail);
      const l = rawLabel.toLowerCase();
      const d = rawDetail.toLowerCase();

      if (l === 'cup' || l === 'tazza') return 'Tazza';
      if (l.includes('pulizia') || l.includes('clean')) return 'Pulizia';
      if (l.includes('servizio') || l.includes('service')) return 'Servizio';
      if (l.includes('milk') || l.includes('latte')) return 'Latte';
      if (l.includes('temperatura') || l.includes('temp') || l.includes('target')) return 'Temperatura';
      if (l.includes('stop') && d.includes('°c')) return 'Temperatura';
      if (l.includes('shelf') || l.includes('durata')) return 'Shelf life';
      if (l.includes('riposo')) return 'Riposo';
      if (l.includes('mix')) return 'Mix';
      if (l.includes('warm')) return 'Warm-up';
      if (l.includes('ladle') || l.includes('mestolo')) return 'Dosaggio';
      if (l.includes('vaso') || l.includes('bicchiere')) return 'Tazza';
      if (l.includes('shot')) return 'Espresso';
      if (l.includes('foam') || l.includes('schium')) return 'Schiuma';

      if (rawLabel === 'Dettaglio' || !rawLabel) {
        if (d.includes('°c') || d.includes('target')) return 'Temperatura';
        if (d.includes('oz') || d.includes('tazza') || d.includes('cup')) return 'Tazza';
        if (d.includes('flush') || d.includes('portafiltro') || d.includes('pulizia')) return 'Pulizia';
        if (d.includes('vassoio') || d.includes('multi-ordine') || d.includes('servi') || d.includes('servizio')) return 'Servizio';
        if (d.includes('stretch') || d.includes('whirlpool') || d.includes('microfoam')) return 'Latte';
        if (d.includes('warm')) return 'Warm-up';
        if (d.includes('ladle') || d.includes('mestol')) return 'Dosaggio';
      }

      return rawLabel || 'Dettaglio';
    };

    const contextualizeDetail = (label, detail) => {
      const rawLabel = tidy(label);
      const rawDetail = normalizeBulletNoise(detail);
      if (!rawDetail) return 'Da definire';

      const l = rawLabel.toLowerCase();
      const d = rawDetail;
      const dl = rawDetail.toLowerCase();

      if (l === 'tazza') {
        const cleaned = d
          .replace(/^\s*[:\-]\s*/, '')
          .replace(/\s*\(\s*/g, ' (')
          .replace(/\s+/g, ' ')
          .trim();
        // Small contextualization without adding new info.
        if (/\boz\b/i.test(cleaned) && /preriscald/i.test(cleaned) && !/[()]/.test(cleaned)) {
          return cleaned.replace(/\s+preriscald\w*/i, (m) => ` (${m.trim()})`);
        }
        return cleaned;
      }
      if (l === 'pulizia') {
        const cleaned = d.replace(/\s+/g, ' ').trim();
        if (dl.includes('flush') && cleaned.includes('+')) {
          const normalized = cleaned
            .replace(/\s*\+\s*/g, ' e ')
            .replace(/\basciugare\b/gi, 'asciuga')
            .replace(/\bportafiltro\b/gi, 'il portafiltro');
          return /[.!?]$/.test(normalized) ? normalized : `${normalized}.`;
        }
        if (!/[.!?]$/.test(cleaned)) return `${cleaned}.`;
        return cleaned;
      }
      if (l === 'servizio') {
        if (dl.includes('multi-ordine') && dl.includes('ultimo')) return 'In multi-ordine: servilo per ultimo sul vassoio.';
        if (!/[.!?]$/.test(d)) return `${d}.`;
        return d;
      }
      if (l === 'temperatura') {
        const cleaned = d.replace(/[\s.]+$/g, '').trim();
        if (/^\d+(?:[.,]\d+)?\s*°c$/i.test(cleaned)) {
          return `Target: ${cleaned} (temperatura di servizio).`;
        }
        const withColon = cleaned.replace(/^target\s+/i, 'Target: ');
        if (/^stop\s+a\s+\d+(?:[.,]\d+)?\s*°c$/i.test(withColon)) {
          return `${withColon} (fermati a questa temperatura).`;
        }
        return /[.!?]$/.test(withColon) ? withColon : `${withColon}.`;
      }
      if (l === 'shelf life') {
        return d.replace(/^life\s+/i, '').trim();
      }
      if (l === 'espresso') {
        const cleaned = d.replace(/[.\s]+$/g, '').trim();
        if (!cleaned) return 'Da definire.';
        if (/^single$/i.test(cleaned)) return '1 shot (singolo).';
        if (/^double$|^doppio$/i.test(cleaned)) return '2 shot (doppio).';
        return /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`;
      }
      if (l === 'schiuma') {
        const cleaned = d.replace(/[.\s]+$/g, '').trim();
        if (!cleaned) return 'Da definire.';
        if (/\+\s*⅓\s*volume/i.test(cleaned) || /\+\s*1\/3\s*volume/i.test(cleaned)) {
          return 'Obiettivo: aumentare il volume di circa 1/3 (incorporando aria all’inizio).';
        }
        return /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`;
      }
      if (l === 'warm-up') {
        const cleaned = d.replace(/[.\s]+$/g, '').trim();
        if (!cleaned || cleaned.toLowerCase() === 'warm-up' || cleaned.toLowerCase() === 'warm up') {
          return 'Preriscaldamento: completa la fase di avvio dell’attrezzatura prima del servizio (segui le indicazioni della postazione).';
        }
        return /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`;
      }
      if (l === 'dosaggio') {
        const cleaned = d.replace(/[.\s]+$/g, '').trim();
        if (!cleaned) return 'Da definire.';
        return /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`;
      }
      if (l === 'latte') {
        const out = d.replace(/\s+poi\s+/i, ', poi ');
        const clarified = out
          .replace(/\bstretch\b/gi, 'stretch (fase iniziale: incorpori aria)')
          .replace(/\bwhirlpool\b/gi, 'whirlpool (crei un vortice per lucidare la texture)')
          .replace(/\bmicrofoam\b/gi, 'microfoam (schiuma fine e vellutata)');
        return /[.!?]$/.test(clarified) ? clarified : `${clarified}.`;
      }

      // Generic: add punctuation if it is a short instruction.
      if (d.length < 60 && !/[.!?]$/.test(d)) return `${d}.`;
      return d;
    };

    const parseStatLine = (raw) => {
      const text = normalizeBulletNoise(raw);
      if (!text) return null;

      // Common shorthand patterns (make them consistent).
      const ozLeading = text.match(/^\s*(\d+(?:[.,]\d+)?)\s*oz\b/i);
      if (ozLeading) {
        return { label: 'Tazza', detail: `${ozLeading[1]} oz` };
      }
      const ozCup = text.match(/^\s*(?:cup|tazza|vaso|bicchiere)\s*(\d+(?:[.,]\d+)?)\s*oz\b/i);
      if (ozCup) {
        return { label: 'Tazza', detail: `${ozCup[1]} oz` };
      }
      const stopTemp = text.match(/^\s*stop\s+a\s*(\d+(?:[.,]\d+)?)\s*°c\b/i);
      if (stopTemp) {
        return { label: 'Temperatura', detail: `Stop a ${stopTemp[1]}°C` };
      }
      const targetTemp = text.match(/^\s*target\s*(\d+(?:[.,]\d+)?)\s*°c\b/i);
      if (targetTemp) {
        return { label: 'Temperatura', detail: `Target: ${targetTemp[1]}°C` };
      }

      if (text.includes(':')) {
        const [labelPart, ...rest] = text.split(':');
        const detail = tidy(rest.join(':'));
        const labelText = tidy(labelPart) || 'Dettaglio';
        return { label: labelText, detail: detail || 'Da definire' };
      }

      // Heuristic: "Key value" (e.g., Milk stretch...).
      const tokenMatch = text.match(/^([A-Za-zÀ-ÿ0-9°]{2,14})\s+(.+)$/);
      if (tokenMatch) {
        const labelCandidate = tidy(tokenMatch[1]);
        const rest = tidy(tokenMatch[2]);
        const punctuationCount = (rest.match(/[.!?]/g) || []).length;
        const isProbablySentence = rest.length > 120 || punctuationCount >= 2;
        // Allow short specs that end with a dot.
        if (!isProbablySentence) {
          return { label: labelCandidate, detail: rest.replace(/[.\s]+$/g, '').trim() };
        }
      }
      return { label: 'Dettaglio', detail: text };
    };

    const dedupeSpecs = (items) => {
      const map = new Map();
      const order = [];

      (items || []).forEach((item) => {
        const label = tidy(item?.label);
        const detail = tidy(item?.detail);
        if (!label || !detail) return;
        if (!isMeaningfulPoint(detail)) return;
        const key = label.toLowerCase();
        if (!map.has(key)) {
          map.set(key, { label, details: new Set() });
          order.push(key);
        }
        map.get(key).details.add(detail);
      });

      return order
        .map((key) => {
          const entry = map.get(key);
          const details = Array.from(entry.details);
          return {
            label: entry.label,
            detail: details.join(' · ')
          };
        })
        .filter(Boolean);
    };

    if (statList) {
      const rawItems = Array.from(statList.querySelectorAll('li'))
        .map((li) => tidy(li.textContent))
        .filter(Boolean);

      rawItems.forEach((raw) => {
        splitMultiSpecs(raw).forEach((seg) => {
          const parsed = parseStatLine(seg);
          if (!parsed) return;
          const label = normalizeSpecLabel(parsed.label, parsed.detail);
          const detail = contextualizeDetail(label, parsed.detail);
          statItemsData.push({ label, detail });
        });
      });
    }

    const tagsForDedupe = Array.from(card.querySelectorAll('.tag-row .tag'))
      .map((t) => tidy(t.textContent).toLowerCase())
      .filter(Boolean);

    const specItemsNormalized = dedupeSpecs(
      statItemsData
        .map((item) => ({
          label: tidy(item.label),
          detail: tidy(item.detail)
        }))
        // Drop exact duplicates that are already stated in tags.
        .filter((item) => !tagsForDedupe.includes(tidy(item.detail).toLowerCase()))
    );

    const displayLabel = (label, detail) => {
      const l = tidy(label);
      if (l && l.toLowerCase() !== 'dettaglio') return l;
      if (isSafetyCard) return 'Nota operativa';

      const d = tidy(detail).toLowerCase();
      // For product cards: avoid turning every generic "Dettaglio" into "Ricetta".
      // If it looks like an ingredients/impasto line, treat as "Ricetta"; otherwise it belongs to "Preparazione".
      const looksLikeRecipe =
        looksLikeIngredientsList(d) ||
        /\b(big batch|small batch|batch|impasto|ingredient|mix)\b/i.test(d);
      return looksLikeRecipe ? 'Ricetta' : 'Preparazione';
    };

    const createSpecsPanel = (items, opts) => {
      const panel = document.createElement('section');
      panel.className = 'modal-specs';
      const title = document.createElement('h4');
      title.className = 'modal-specs__title';
      title.textContent = 'Specifiche';
      panel.appendChild(title);

      const subtitle = document.createElement('p');
      subtitle.className = 'modal-specs__subtitle';
      subtitle.textContent = opts?.subtitle || 'In sintesi, ciò che serve ricordare.';
      panel.appendChild(subtitle);

      const grid = document.createElement('div');
      grid.className = 'modal-specs__grid';

      const safeItems = (items || []).filter((i) => i?.label && i?.detail).slice(0, 8);
      safeItems.forEach((item) => {
        const row = document.createElement('div');
        row.className = 'modal-specs__item';
        const k = document.createElement('span');
        k.className = 'modal-specs__key';
        k.textContent = displayLabel(item.label, item.detail);
        const v = document.createElement('div');
        v.className = 'modal-specs__value';

        const parts = splitDetailPoints(item.detail);
        if (parts.length > 1) {
          const ul = document.createElement('ul');
          ul.className = 'modal-specs__bullets';
          parts.slice(0, 6).forEach((p) => {
            const li = document.createElement('li');
            li.textContent = p;
            ul.appendChild(li);
          });
          v.appendChild(ul);
        } else if (parts.length === 1) {
          // If we ended up with a single cleaned point, prefer it over the raw detail.
          v.textContent = parts[0];
        } else {
          // If everything is junk/noise, don't render misleading content.
          v.textContent = '';
        }
        row.appendChild(k);
        row.appendChild(v);
        grid.appendChild(row);
      });

      panel.appendChild(grid);
      return panel;
    };

    const isSafetyCard = (() => {
      const hasSafetyTag = !!card.querySelector('.tag--safety, .tag--maintenance');
      const titleLower = (cardTitle || '').toLowerCase();
      return hasSafetyTag || titleLower.includes('sicurezza') || titleLower.includes('haccp') || titleLower.includes('allergen');
    })();

    const specItemsForCard = (() => {
      if (specItemsNormalized.length) return specItemsNormalized;

      const tagsForCard = Array.from(card.querySelectorAll('.tag-row .tag'))
        .map((t) => tidy(t.textContent))
        .filter(Boolean);

      const introText = tidy(intro?.textContent);
      const objectiveFromIntro = (() => {
        if (!introText) return '';
        // Take the first sentence-ish chunk (avoid overlong paragraphs).
        const firstMatch = introText.match(/[^.!?]+[.!?]+/);
        const first = (firstMatch && firstMatch[0]) ? firstMatch[0] : introText;
        const cleaned = tidy(first).replace(/[\s.]+$/g, '').trim();
        if (cleaned.length < 18) return '';
        return cleaned;
      })();

      const deriveFrequency = (text) => {
        const t = tidy(text).toLowerCase();
        if (!t) return '';
        if (/\b(a\s+)?fine\s+giornat(a|e)\b|\bchiusura\b|\bclosing\b/.test(t)) return 'Fine giornata (chiusura)';
        if (/\bogni\s+\d+\s*(min|minuti|h|ore)\b/.test(t)) {
          const m = t.match(/\bogni\s+(\d+)\s*(min|minuti|h|ore)\b/);
          if (m) return `Ogni ${m[1]} ${m[2]}`;
        }
        if (/\bsettiman(al|a|e)\b/.test(t)) return 'Settimanale';
        if (/\bgiornalier(a|o)\b|\bogni\s+giorno\b/.test(t)) return 'Giornaliera';
        if (/\bprima\s+(dell'?|di\s+)apertura\b|\bapertura\b/.test(t)) return 'Prima dell’apertura';
        return '';
      };

      const frequency = deriveFrequency(`${cardTitle} ${introText} ${(details?.textContent || '')}`);

      const category = (() => {
        const hasSafety = !!card.querySelector('.tag--safety');
        const hasMaint = !!card.querySelector('.tag--maintenance');
        if (hasSafety && hasMaint) return 'Sicurezza & Manutenzione';
        if (hasSafety) return 'Sicurezza';
        if (hasMaint) return 'Manutenzione';
        return 'Procedura';
      })();

      // No source specs available: provide meaningful, non-invented structure.
      // Prefer existing text: tags + intro + inferred frequency.
      const items = [
        { label: 'Categoria', detail: category },
        ...(tagsForCard.length ? [{ label: 'Focus', detail: tagsForCard.join(' · ') }] : []),
        ...(objectiveFromIntro ? [{ label: 'Obiettivo', detail: objectiveFromIntro }] : []),
        ...(frequency ? [{ label: 'Quando', detail: frequency }] : [])
      ];
      return items;
    })();

    const applyDisplayLabelsAndDedupe = (items) => {
      const withDisplay = (items || []).map((i) => ({
        label: displayLabel(i?.label, i?.detail),
        detail: tidy(i?.detail)
      }));
      return dedupeSpecs(withDisplay);
    };

    function looksLikeIngredientsList(text) {
      const t = tidy(text).toLowerCase();
      if (!t) return false;
      const unitHits = (t.match(/\b(ml|l|g|kg|uova|pz|gr)\b/g) || []).length;
      const commas = (t.match(/,/g) || []).length;
      return unitHits >= 2 && commas >= 2;
    }

    const isRecipeItem = (item) => {
      const label = tidy(item?.label).toLowerCase();
      const detail = tidy(item?.detail);
      const display = tidy(displayLabel(item?.label, item?.detail)).toLowerCase();
      if (!label && !detail) return false;
      if (detail.toLowerCase() === 'da definire') return false;
      if (display === 'ricetta') return true;
      const recipeKeywords = ['impasto', 'ingredient', 'mix', 'big batch', 'small batch', 'batch'];
      if (recipeKeywords.some((k) => label.includes(k))) return true;
      return looksLikeIngredientsList(detail);
    };

    const isPreparationMetaItem = (item) => {
      const label = tidy(item?.label).toLowerCase();
      const detail = tidy(item?.detail);
      const display = tidy(displayLabel(item?.label, item?.detail)).toLowerCase();
      if (!label && !detail) return false;
      if (detail.toLowerCase() === 'da definire') return false;
      if (display === 'preparazione') return true;
      const prepKeywords = ['preparazione', 'riposo', 'cottura', 'cuoci', 'warm-up', 'warm up', 'piastra', 'ladle', 'mestoli', 'temperatura'];
      return prepKeywords.some((k) => label.includes(k));
    };

    const isPrepExcludedFromSummary = (item) => {
      const label = tidy(item?.label).toLowerCase();
      const display = tidy(displayLabel(item?.label, item?.detail)).toLowerCase();
      return label.includes('shelf life') || display.includes('shelf life');
    };

    // Avoid repeating the same info in both "In primo piano" (chips) and "Specifiche".
    // Chips = highlights; Specifiche = complementary details.
    const statItemsDeduped = dedupeSpecs(
      (statItemsData || []).map((item) => ({
        label: tidy(item?.label),
        detail: tidy(item?.detail)
      }))
    );

    const essentialsRaw = (specItemsNormalized.length ? specItemsNormalized : statItemsDeduped).slice(0, 4);
    const essentialsItems = applyDisplayLabelsAndDedupe(essentialsRaw);

    // Product modules: split info into two dedicated tabs: "Ricetta" and "Preparazione".
    const recipeItems = (!isSafetyCard)
      ? applyDisplayLabelsAndDedupe(
        (specItemsForCard || [])
          .filter((i) => isRecipeItem(i) && !isPrepExcludedFromSummary(i))
      )
      : [];
    const preparationMetaItems = (!isSafetyCard)
      ? applyDisplayLabelsAndDedupe(
        (specItemsForCard || [])
          .filter((i) => isPreparationMetaItem(i) && !isPrepExcludedFromSummary(i))
      )
      : [];

    const recipeKeys = new Set(recipeItems.map((i) => tidy(i?.label).toLowerCase()).filter(Boolean));
    const preparationKeys = new Set(preparationMetaItems.map((i) => tidy(i?.label).toLowerCase()).filter(Boolean));

    const essentialsKeys = new Set(
      essentialsItems
        .map((item) => tidy(item?.label).toLowerCase())
        .filter(Boolean)
    );

    // Sidebar "Specifiche" must not repeat what's already in "Ricetta" or "Preparazione".
    const filteredSpecsRaw = (specItemsForCard || []).filter((item) => {
      const displayKey = tidy(displayLabel(item?.label, item?.detail)).toLowerCase();
      if (!displayKey) return true;

      if (!isSafetyCard) {
        if (displayKey === 'ricetta') return false;
        if (displayKey === 'preparazione') return false;
        if (recipeKeys.has(displayKey) || preparationKeys.has(displayKey)) return false;
        if ((isRecipeItem(item) || isPreparationMetaItem(item)) && !isPrepExcludedFromSummary(item)) return false;
        return true;
      }

      return !essentialsKeys.has(displayKey);
    });
    const specsWithoutEssentials = applyDisplayLabelsAndDedupe(filteredSpecsRaw);

    // IMPORTANT: never fallback to a duplicated list.
    if (specsWithoutEssentials.length) {
      sidebarFragment.appendChild(
        createSpecsPanel(specsWithoutEssentials, {
          subtitle: isSafetyCard ? 'Promemoria operativo (da completare se mancano dati).' : 'Parametri chiave (senza prezzi).'
        })
      );
    }
    const detailsClone = details.cloneNode(true);
    detailsClone.classList.add('details--modal');

    const sectionWrap = document.createElement('div');
    sectionWrap.className = 'card-modal-sections';

    const primaryWrap = document.createElement('div');
    primaryWrap.className = 'card-modal-primary';

    let totalTabsCount = 0;

    // "In primo piano" becomes a collapsible "Preparazione" section (for non-safety modules)
    // to avoid repetition and keep a consistent information hierarchy.
    const createEssentialsBox = (items, opts = {}) => {
      const box = document.createElement('div');
      box.className = opts.embedded
        ? 'card-modal-essentials card-modal-essentials--embedded'
        : 'card-modal-essentials';

      if (opts.titleText) {
        const title = document.createElement('p');
        title.className = 'card-modal-essentials__title';
        title.textContent = opts.titleText;
        box.appendChild(title);
      }

      const chips = document.createElement('div');
      chips.className = 'card-modal-essentials__chips';

      const splitForChip = (label, detail) => {
        const base = splitDetailPoints(detail);
        if (base.length > 1) return base;
        const key = tidy(label).toLowerCase();
        if ((key.includes('batch') || key.includes('ricetta') || key.includes('impasto') || key.includes('ingredient')) && detail.includes(',')) {
          const parts = detail.split(',').map((p) => tidy(p)).filter(Boolean);
          if (parts.length >= 3) return parts;
        }
        return base;
      };

      (items || []).forEach((item) => {
        const chip = document.createElement('span');
        chip.className = 'card-modal-essentials__chip';

        const label = tidy(item?.label);
        const detail = tidy(item?.detail);
        const labelEl = document.createElement('strong');
        labelEl.textContent = label;
        chip.appendChild(labelEl);

        const parts = splitForChip(label, detail);
        if (parts.length > 1) {
          const ul = document.createElement('ul');
          ul.className = 'card-modal-essentials__bullets';
          parts.slice(0, 5).forEach((p) => {
            const li = document.createElement('li');
            li.textContent = p;
            ul.appendChild(li);
          });
          chip.appendChild(ul);
        } else {
          const valueEl = document.createElement('span');
          valueEl.textContent = parts[0] || detail;
          chip.appendChild(valueEl);
        }

        chips.appendChild(chip);
      });

      box.appendChild(chips);
      return box;
    };

    const recipeSummary = (!isSafetyCard && recipeItems.length)
      ? createEssentialsBox(recipeItems, { embedded: true })
      : null;

    const preparationMetaSummary = (!isSafetyCard && preparationMetaItems.length)
      ? createEssentialsBox(preparationMetaItems, { embedded: true })
      : null;

    if (introClone) {
      const introBox = document.createElement('div');
      introBox.className = 'card-modal-primary__intro';
      introBox.appendChild(introClone);
      primaryWrap.appendChild(introBox);
    }

    // Note: recipeSummary is rendered in its own "Ricetta" accordion tab.
    // preparationMetaSummary is injected inside the "Preparazione" accordion section.
    if (isSafetyCard && essentialsItems.length) {
      primaryWrap.appendChild(createEssentialsBox(essentialsItems, { titleText: 'In primo piano' }));
    }

    if (primaryWrap.childElementCount) {
      bodyFragment.appendChild(primaryWrap);
    }

    const blocks = Array.from(detailsClone.children).filter((el) => {
      if (!(el instanceof HTMLElement)) return false;
      if (el.tagName === 'HR') return false;
      return el.classList.contains('steps') || el.classList.contains('tips');
    });

    const blockTitles = new WeakMap();
    const getInlineHeadingText = (el) => (el.querySelector(':scope > strong')?.textContent || '').toLowerCase();

    const pickTitle = (el) => {
      const strongText = getInlineHeadingText(el);
      if (el.classList.contains('steps')) {
        const isSalesBlock = strongText.includes('upsell') || strongText.includes('upselling') || strongText.includes('💰') || strongText.includes('vendita');
        if (isSalesBlock) {
          if (strongText.includes('vendita')) return 'Tecniche di vendita';
          return isSafetyCard ? 'Comunicazione al cliente' : 'Upselling';
        }
        return 'Preparazione';
      }
      if (strongText.includes('pro tip') || strongText.includes('🛠')) return 'Pro tip';
      return 'Suggerimenti';
    };

    // Compute titles first (for correct grouping), then remove only the icon-label headings.
    blocks.forEach((el) => {
      const title = pickTitle(el);
      blockTitles.set(el, title);

      const heading = el.querySelector(':scope > strong');
      if (!heading) return;
      const text = (heading.textContent || '');
      // User request: remove only the label line with the icon, not the whole module.
      if (text.includes('💰') || text.includes('🛠')) {
        heading.remove();
      }
    });

    if (blocks.length) {
      const accordion = document.createElement('div');
      accordion.className = 'modal-accordion';
      const openers = [];

      const createAccordionItem = (title, contentEl, expandByDefault = false) => {
        totalTabsCount += 1;
        const item = document.createElement('article');
        item.className = 'accordion-item';
        const header = document.createElement('button');
        header.type = 'button';
        header.className = 'accordion-header';
        header.setAttribute('aria-expanded', 'false');
        header.innerHTML = `<span class="accordion-title">${title}</span><span class="accordion-chevron" aria-hidden="true">⌄</span>`;
        const body = document.createElement('div');
        body.className = 'accordion-body';
        body.appendChild(contentEl);

        // Add per-tab indicator: pending (✧) if not opened today, completed (✓) if already opened.
        try {
          // Keep right-side controls grouped (indicator + chevron)
          const chevron = header.querySelector('.accordion-chevron');
          let meta = header.querySelector('.accordion-meta');
          if (!meta) {
            meta = document.createElement('span');
            meta.className = 'accordion-meta';
            if (chevron) {
              chevron.replaceWith(meta);
              meta.appendChild(chevron);
            } else {
              header.appendChild(meta);
            }
          }

          const tabIdLocal = (gamification?.getTabIdFor ? gamification.getTabIdFor(card, title) : '') || `${cardId}::${String(title || '').toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'tab'}`;
          header.dataset.tabId = tabIdLocal;
          const alreadyOpened = gamification?.isTabOpened ? gamification.isTabOpened(tabIdLocal) : false;
          const cardStatus = gamification?.getCardCrystalStatus
            ? gamification.getCardCrystalStatus(cardId)
            : { crystals: 0, converted: false };
          const isStarred = !!cardStatus.converted;

          const ind = document.createElement('span');
          ind.className = 'crystal-indicator';
          ind.setAttribute('aria-hidden', 'true');

          if (isStarred) {
            ind.classList.add('is-starred');
            ind.textContent = '★';
            header.classList.add('tab-starred');
          } else if (alreadyOpened) {
            ind.classList.add('is-opened');
            ind.textContent = '✓';
            header.classList.add('tab-opened');
          } else {
            ind.classList.add('is-hidden');
            ind.textContent = '';
          }

          meta.insertBefore(ind, meta.firstChild);
        } catch (e) {}

        // Accordion sizing note:
        // We animate open/close using `max-height`, but keeping a fixed px `max-height`
        // after opening can clip content on mobile (font wrapping, late image loads, etc.).
        // Fix: after the open transition ends, set `max-height: none` so the content can
        // grow naturally. When closing, if `max-height` is `none`, we first snap to the
        // current scrollHeight, then animate back to 0.
        const settleOpenMaxHeight = () => {
          if (!item.classList.contains('is-open')) return;
          body.style.maxHeight = 'none';
        };

        const animateOpen = () => {
          item.classList.add('is-open');
          header.setAttribute('aria-expanded', 'true');

          // Ensure we start from a numeric max-height so the transition can run.
          body.style.maxHeight = '0px';
          requestAnimationFrame(() => {
            body.style.maxHeight = `${body.scrollHeight}px`;
          });

          // One extra recalculation shortly after (helps with late layout/line-wrapping).
          setTimeout(() => {
            if (!item.classList.contains('is-open')) return;
            if (body.style.maxHeight === 'none') return;
            body.style.maxHeight = `${body.scrollHeight}px`;
          }, 80);

          try {
            const onEnd = (e) => {
              if (e && e.target !== body) return;
              settleOpenMaxHeight();
            };
            body.addEventListener('transitionend', onEnd, { once: true });
            setTimeout(settleOpenMaxHeight, 320);
          } catch (e) {
            setTimeout(settleOpenMaxHeight, 0);
          }
        };

        const animateClose = () => {
          if (!item.classList.contains('is-open')) return;
          item.classList.remove('is-open');
          header.setAttribute('aria-expanded', 'false');

          // If we previously settled to `none`, snap to current px height first.
          if (body.style.maxHeight === 'none' || !body.style.maxHeight) {
            body.style.maxHeight = `${body.scrollHeight}px`;
          }
          requestAnimationFrame(() => {
            body.style.maxHeight = '0px';
          });
        };

        const setOpen = (expand) => {
          if (expand) animateOpen();
          else animateClose();
        };

        header.addEventListener('click', (event) => {
          const willExpand = !item.classList.contains('is-open');

          // Accordion behavior: only one tab open at a time.
          if (willExpand) {
            try { playTabOpenSound(); } catch (e) {}
            try {
              accordion.querySelectorAll('.accordion-item.is-open').forEach((openItem) => {
                if (openItem === item) return;
                openItem.classList.remove('is-open');
                const openHeader = openItem.querySelector('.accordion-header');
                const openBody = openItem.querySelector('.accordion-body');
                if (openHeader) openHeader.setAttribute('aria-expanded', 'false');
                if (openBody) {
                  // If the open body was settled to `none`, snap then animate closed.
                  if (openBody.style.maxHeight === 'none' || !openBody.style.maxHeight) {
                    openBody.style.maxHeight = `${openBody.scrollHeight}px`;
                  }
                  requestAnimationFrame(() => {
                    openBody.style.maxHeight = '0px';
                  });
                }
              });
            } catch (e) {}
          }

          setOpen(willExpand);
          if (willExpand && gamification?.handleTabOpen) {
            // Attach a small snapshot of the opened panel text for quiz generation.
            try {
              header.dataset.tabContent = String(body?.textContent || '').slice(0, 2000);
            } catch (e) {}
            gamification.handleTabOpen(card, title, header, totalTabsCount, event);
            refreshCrystalBadge();
            try {
              const ind = header.querySelector('.crystal-indicator');
              const status = gamification?.getCardCrystalStatus
                ? gamification.getCardCrystalStatus(cardId)
                : { crystals: 0, converted: false };
              const isStarred = !!status.converted;

              if (ind) {
                ind.classList.remove('is-hidden', 'is-opened', 'is-starred');
                if (isStarred) {
                  ind.classList.add('is-starred');
                  ind.textContent = '★';
                } else {
                  ind.classList.add('is-opened');
                  ind.textContent = '✓';
                }
              }

              header.classList.toggle('tab-opened', !isStarred);
              header.classList.toggle('tab-starred', isStarred);
            } catch (e) {}

            // After the panel starts opening, softly scroll so the opened tab is fully visible.
            try {
              requestAnimationFrame(() => {
                requestAnimationFrame(() => softRevealOpenedTabInModalBody(header, body));
              });
              setTimeout(() => softRevealOpenedTabInModalBody(header, body), 160);
            } catch (e) {}
          }
        });

        item.appendChild(header);
        item.appendChild(body);
        accordion.appendChild(item);
        if (expandByDefault) {
          openers.push(() => setOpen(true));
        }
      };

      const grouped = [];
      const titleMap = new Map();

      blocks.forEach((el) => {
        const title = blockTitles.get(el) || pickTitle(el);
        if (!titleMap.has(title)) {
          const group = { title, items: [] };
          titleMap.set(title, group);
          grouped.push(group);
        }
        titleMap.get(title).items.push(el);
      });

      let prepSummaryInserted = false;

      // Product-only: ensure "Ricetta" exists first.
      if (!isSafetyCard && recipeSummary) {
        createAccordionItem('Ricetta', recipeSummary, false);
      }

      const hasPreparazioneGroup = grouped.some((g) => g.title === 'Preparazione');
      if (!isSafetyCard && preparationMetaSummary && !hasPreparazioneGroup) {
        createAccordionItem('Preparazione', preparationMetaSummary, false);
        prepSummaryInserted = true;
      }

      const orderedGroups = isSafetyCard
        ? grouped
        : [
          ...grouped.filter((g) => g.title === 'Preparazione'),
          ...grouped.filter((g) => g.title !== 'Preparazione')
        ];

      orderedGroups.forEach((group) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'accordion-group';

        if (!prepSummaryInserted && !isSafetyCard && preparationMetaSummary && group.title === 'Preparazione') {
          wrapper.appendChild(preparationMetaSummary);
          prepSummaryInserted = true;
        }

        group.items.forEach((el) => wrapper.appendChild(el));
        const shouldOpen = false;
        createAccordionItem(group.title, wrapper, shouldOpen);
      });

      sectionWrap.appendChild(accordion);
      bodyFragment.appendChild(sectionWrap);

      requestAnimationFrame(() => {
        openers.forEach((fn) => fn());

        // Safety: if multiple sections were opened by defaults, keep only the first open.
        try {
          const openItems = Array.from(accordion.querySelectorAll('.accordion-item.is-open'));
          if (openItems.length > 1) {
            openItems.slice(1).forEach((openItem) => {
              openItem.classList.remove('is-open');
              const openHeader = openItem.querySelector('.accordion-header');
              const openBody = openItem.querySelector('.accordion-body');
              if (openHeader) openHeader.setAttribute('aria-expanded', 'false');
              if (openBody) openBody.style.maxHeight = '0px';
            });
          }
        } catch (e) {}
      });
    } else {
      if (!isSafetyCard && (recipeSummary || preparationMetaSummary)) {
        const accordion = document.createElement('div');
        accordion.className = 'modal-accordion';

        const addFallbackAccordionItem = (titleText, contentEl, openByDefault) => {
          totalTabsCount += 1;
          const item = document.createElement('article');
          item.className = 'accordion-item';
          const header = document.createElement('button');
          header.type = 'button';
          header.className = 'accordion-header';
          header.setAttribute('aria-expanded', 'false');
          header.innerHTML = `<span class="accordion-title">${titleText}</span><span class="accordion-chevron" aria-hidden="true">⌄</span>`;
          const body = document.createElement('div');
          body.className = 'accordion-body';
          body.appendChild(contentEl);

          // Add per-tab indicator: pending (✧) if not opened today, completed (✓) if already opened.
          try {
            // Keep right-side controls grouped (indicator + chevron)
            const chevron = header.querySelector('.accordion-chevron');
            let meta = header.querySelector('.accordion-meta');
            if (!meta) {
              meta = document.createElement('span');
              meta.className = 'accordion-meta';
              if (chevron) {
                chevron.replaceWith(meta);
                meta.appendChild(chevron);
              } else {
                header.appendChild(meta);
              }
            }

            const tabIdLocal = (gamification?.getTabIdFor ? gamification.getTabIdFor(card, titleText) : '') || `${cardId}::${String(titleText || '').toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'tab'}`;
            header.dataset.tabId = tabIdLocal;
            const alreadyOpened = gamification?.isTabOpened ? gamification.isTabOpened(tabIdLocal) : false;
            const cardStatus = gamification?.getCardCrystalStatus
              ? gamification.getCardCrystalStatus(cardId)
              : { crystals: 0, converted: false };
            const isStarred = !!cardStatus.converted;

            const ind = document.createElement('span');
            ind.className = 'crystal-indicator';
            ind.setAttribute('aria-hidden', 'true');

            if (isStarred) {
              ind.classList.add('is-starred');
              ind.textContent = '★';
              header.classList.add('tab-starred');
            } else if (alreadyOpened) {
              ind.classList.add('is-opened');
              ind.textContent = '✓';
              header.classList.add('tab-opened');
            } else {
              ind.classList.add('is-hidden');
              ind.textContent = '';
            }

            meta.insertBefore(ind, meta.firstChild);
          } catch (e) {}

          const setOpen = (expand) => {
            item.classList.toggle('is-open', expand);
            header.setAttribute('aria-expanded', String(expand));
            body.style.maxHeight = expand ? `${body.scrollHeight}px` : '0px';
          };
          header.addEventListener('click', (event) => {
            const willExpand = !item.classList.contains('is-open');

            // Accordion behavior: only one tab open at a time.
            if (willExpand) {
              try {
                accordion.querySelectorAll('.accordion-item.is-open').forEach((openItem) => {
                  if (openItem === item) return;
                  openItem.classList.remove('is-open');
                  const openHeader = openItem.querySelector('.accordion-header');
                  const openBody = openItem.querySelector('.accordion-body');
                  if (openHeader) openHeader.setAttribute('aria-expanded', 'false');
                  if (openBody) openBody.style.maxHeight = '0px';
                });
              } catch (e) {}
            }

            setOpen(willExpand);
            if (willExpand && gamification?.handleTabOpen) {
              // Attach a small snapshot of the opened panel text for quiz generation.
              try {
                header.dataset.tabContent = String(body?.textContent || '').slice(0, 2000);
              } catch (e) {}
              gamification.handleTabOpen(card, titleText, header, totalTabsCount, event);
              refreshCrystalBadge();
              try {
                const ind = header.querySelector('.crystal-indicator');
                const status = gamification?.getCardCrystalStatus
                  ? gamification.getCardCrystalStatus(cardId)
                  : { crystals: 0, converted: false };
                const isStarred = !!status.converted;

                if (ind) {
                  ind.classList.remove('is-hidden', 'is-opened', 'is-starred');
                  if (isStarred) {
                    ind.classList.add('is-starred');
                    ind.textContent = '★';
                  } else {
                    ind.classList.add('is-opened');
                    ind.textContent = '✓';
                  }
                }

                header.classList.toggle('tab-opened', !isStarred);
                header.classList.toggle('tab-starred', isStarred);
              } catch (e) {}

              // After the panel starts opening, softly scroll so the opened tab is fully visible.
              try {
                requestAnimationFrame(() => {
                  requestAnimationFrame(() => softRevealOpenedTabInModalBody(header, body));
                });
                setTimeout(() => softRevealOpenedTabInModalBody(header, body), 160);
              } catch (e) {}
            }
          });

          item.appendChild(header);
          item.appendChild(body);
          accordion.appendChild(item);

          requestAnimationFrame(() => setOpen(!!openByDefault));
        };

        if (recipeSummary) addFallbackAccordionItem('Ricetta', recipeSummary, false);
        if (preparationMetaSummary) addFallbackAccordionItem('Preparazione', preparationMetaSummary, false);

        sectionWrap.appendChild(accordion);
        bodyFragment.appendChild(sectionWrap);
      }

      bodyFragment.appendChild(detailsClone);
    }

    // Give the scroll area some breathing room at the bottom so the last accordion
    // can be fully revealed without manual scrolling.
    try {
      const spacer = document.createElement('div');
      spacer.className = 'card-modal-scroll-spacer';
      spacer.setAttribute('aria-hidden', 'true');
      bodyFragment.appendChild(spacer);
    } catch (e) {}
    
    modalSidebar.appendChild(sidebarFragment);
    modalBody.appendChild(bodyFragment);
    
    modal.appendChild(modalHeader);
    modal.appendChild(modalSidebar);
    modal.appendChild(modalBody);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Some mobile browsers can fail to render cloned <picture>/<img> nodes inside overlays
    // (especially when they were lazily loaded inside overflow containers).
    // Force a refresh + eager loading once the modal is in the DOM.
    try {
      const primeOverlayImages = () => {
        try {
          overlay.querySelectorAll('source[srcset]').forEach((source) => {
            const v = source.getAttribute('srcset');
            if (v) {
              // Force re-evaluation by resetting the attribute
              source.removeAttribute('srcset');
              source.setAttribute('srcset', v);
            }
          });
        } catch (e) {}
        try {
          overlay.querySelectorAll('img').forEach((img) => {
            try {
              img.loading = 'eager';
              img.decoding = 'sync';
              img.fetchPriority = 'high';
            } catch (e) {}
            try {
              img.removeAttribute('loading');
            } catch (e) {}

            // Re-apply src and srcset to kick some engines into actually fetching/painting.
            try {
              const srcAttr = img.getAttribute('src');
              const srcsetAttr = img.getAttribute('srcset');
              if (srcAttr) {
                img.src = ''; 
                img.src = srcAttr;
              }
              if (srcsetAttr) {
                img.srcset = '';
                img.srcset = srcsetAttr;
              }
            } catch (e) {}
          });
        } catch (e) {}
      };

      primeOverlayImages();
      requestAnimationFrame(primeOverlayImages);
      // Multiple attempts to catch slow layout engines on mobile
      setTimeout(primeOverlayImages, 50);
      setTimeout(primeOverlayImages, 150);
      setTimeout(primeOverlayImages, 400);
    } catch (e) {}
    
    // Animazione apertura
    requestAnimationFrame(() => {
      overlay.classList.add('is-visible');
    });

    // Mobile: start from the top so the sidebar image is immediately visible.
    // (On small screens users can otherwise land in the body scroll area and
    // interpret the image as “missing”.)
    try {
      const isNarrow = !!(window.matchMedia && window.matchMedia('(max-width: 900px)').matches);
      if (isNarrow) {
        requestAnimationFrame(() => {
          try { modal.scrollTop = 0; } catch (e) {}
          try { modalSidebar.scrollTop = 0; } catch (e) {}
          try { modalBody.scrollTop = 0; } catch (e) {}
        });
      }
    } catch (e) {}
    
    if (gamification) {
      gamification.handleCardOpen(card, button, totalTabsCount, event);
      refreshCrystalBadge();
    }
    
    // Chiusura modal
    const closeModal = () => {
      overlay.classList.remove('is-visible');
      setTimeout(() => {
        try { document.removeEventListener('badiani:crystals-updated', handleCrystalUpdate); } catch (e) {}
        try { document.removeEventListener('badiani:toast-shown', handleToastShown); } catch (e) {}
        overlay.remove();
        bodyScrollLock.unlock();
      }, 300);
    };
    
    // Click su overlay (fuori dal modal)
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal();
      }
    });
    
    // Click su bottone close
    closeBtn.addEventListener('click', closeModal);
    
    // ESC key
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', handleEsc);
      }
    };
    document.addEventListener('keydown', handleEsc);
  });
});

const storyNodes = document.querySelectorAll('[data-story-target]');
if (storyNodes.length) {
  const storyImages = document.querySelectorAll('[data-story-image]');
  const storyPanels = document.querySelectorAll('[data-story-panel]');
  const storyExperience = document.querySelector('.story-experience');

  const activateStory = (id) => {
    console.log('[Story Orbit] activateStory called with id:', id);
    storyNodes.forEach((node) => {
      const isActive = node.dataset.storyTarget === id;
      node.classList.toggle('is-active', isActive);
      node.setAttribute('aria-selected', String(isActive));
      if (isActive && storyExperience) {
        const accent = node.dataset.accent;
        if (accent) storyExperience.style.setProperty('--story-accent', accent);
      }
    });

    storyImages.forEach((image) => {
      const isActive = image.dataset.storyImage === id;
      image.classList.toggle('is-active', isActive);
    });

    storyPanels.forEach((panel) => {
      const isActive = panel.dataset.storyPanel === id;
      panel.classList.toggle('is-active', isActive);
    });
  };

  storyNodes.forEach((node) => {
    console.log('[Story Orbit] Adding click listener to node:', node.dataset.storyTarget);
    node.addEventListener('click', (e) => {
      console.log('[Story Orbit] Node clicked:', node.dataset.storyTarget);
      e.stopPropagation();
      activateStory(node.dataset.storyTarget);
    });
  });

  // Non attivare automaticamente il primo tab: la pagina parte con tutto chiuso.
  // L'utente deve cliccare un tab per vedere le specifiche.
  console.log('[Story Orbit] Setup complete, found', storyNodes.length, 'nodes');
}

const storyMedia = document.querySelector('[data-story-fullscreen]');
const storyModal = document.querySelector('[data-story-modal]');
if (storyMedia && storyModal) {
  const modalImage = storyModal.querySelector('[data-story-modal-image]');
  const modalCaption = storyModal.querySelector('[data-story-modal-caption]');
  const closeButtons = storyModal.querySelectorAll('[data-story-modal-close]');
  let lastFocusedElement = null;

  const openStoryModal = () => {
    const activeImage = document.querySelector('.story-image.is-active img');
    if (!activeImage) return;
    modalImage.src = activeImage.src;
    modalImage.alt = activeImage.alt;
    modalCaption.textContent = activeImage.alt || '';
    lastFocusedElement = document.activeElement;
    storyModal.classList.add('is-visible');
    storyModal.setAttribute('aria-hidden', 'false');
    bodyScrollLock.lock();
    const firstClose = closeButtons[0];
    if (firstClose) firstClose.focus({ preventScroll: true });
  };

  const closeStoryModal = () => {
    if (!storyModal.classList.contains('is-visible')) return;
    storyModal.classList.remove('is-visible');
    storyModal.setAttribute('aria-hidden', 'true');
    bodyScrollLock.unlock();
    setTimeout(() => {
      modalImage.src = '';
      if (lastFocusedElement) lastFocusedElement.focus();
    }, 150);
  };

  storyMedia.addEventListener('click', openStoryModal);
  storyMedia.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openStoryModal();
    }
  });

  closeButtons.forEach((button) => button.addEventListener('click', closeStoryModal));

  storyModal.addEventListener('click', (event) => {
    if (event.target === storyModal) closeStoryModal();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && storyModal.classList.contains('is-visible')) {
      closeStoryModal();
    }
  });
}

// ================================
// DAILY TRAINING QUESTIONS SYSTEM
// ================================

const dailyQuestions = (() => {
  const questions = [
    // CONSERVAZIONE & QUALITÀ (40 domande)
    "Il latte fresco ha un odore leggermente acido - cosa fai?",
    "Un cliente dice che il cappuccino sa di 'cartone'. Qual è il primo check da fare?",
    "Hai aperto un brick di latte d'avena 6 giorni fa. È ancora utilizzabile?",
    "Un sacchetto di caffè in grani è stato aperto 3 settimane fa. Come procedi?",
    "La crema dell'espresso è bianca/chiara invece che nocciola. Quali sono le 3 possibili cause?",
    "Il cliente chiede: 'Questo gelato è prodotto oggi?' Come rispondi?",
    "Noti cristalli nello sciroppo caramel. Cosa fai?",
    "Il latte monta male anche se freddo. Cosa controlli?",
    "Un brownie ha una macchia verde. Azione immediata?",
    "Il caffè ha un gusto bruciato/amaro eccessivo. Da cosa dipende?",
    
    "Temperatura ideale del latte nel frigo?",
    "Dopo quanti giorni scade un croissant farcito?",
    "Shelf life massima per alternative milk post-apertura?",
    "Come si verifica la freschezza di un caffè in grani?",
    "Un gelato presenta cristalli di ghiaccio sulla superficie. Cosa significa?",
    "Il panettone tagliato ieri è ancora vendibile oggi?",
    "Come conservi i prodotti Slitti (praline e tavolette)?",
    "La macchina espresso mostra 95°C invece di 90°C. È un problema?",
    "Il cliente dice: 'Questo latte sa di cipolla'. Possibile causa?",
    "Quanti shot puoi estrarre con 1kg di caffè?",
    
    "Come implementi il sistema FIFO per i sacchi di caffè?",
    "Un brick di latte è gonfio. Cosa fai?",
    "I churros avanzati dalla sera prima - riutilizzabili?",
    "Come si conserva la panna montata avanzata?",
    "Il gelato Buontalenti ha una texture granulosa. Causa?",
    "Crema spalmabile Slitti: shelf life post-apertura?",
    "Un cliente chiede se il caffè è biologico. Come verifichi?",
    "Noti condensa dentro la vetrina gelato. Azione?",
    "Come conservi i muffin/loaf dopo l'apertura della confezione?",
    "Il foam del cappuccino si sgonfia dopo 30 secondi. Perché?",
    
    "Tempo massimo tra estrazione espresso e servizio?",
    "Come capire se il latte è stato scaldato oltre 70°C?",
    "Un croissant ha l'interno crudo. Procedura?",
    "Affogato: il gelato si scioglie troppo velocemente. Cosa cambi?",
    "Come testi la freschezza dei chicchi di caffè al tatto?",
    "Il cliente dice: 'Il cappuccino è tiepido'. Range temperatura corretto?",
    "Mulled wine: come conservi il mix preparato?",
    "Quanto dura una crepe preparata ma non servita?",
    "Come riconosci un espresso sotto-estratto vs sovra-estratto?",
    "Il grinder fa rumore strano. Primo check?",
    
    // TECNICHE & PROCEDURE (50 domande)
    "Cliente chiede cappuccino 'extra hot' (80°C). Come rispondi?",
    "Preparare 3 cappuccini insieme: ordine operativo corretto?",
    "Un bambino chiede 'cioccolata senza lattosio'. Opzioni?",
    "Cliente celiaco chiede un dolce. Come procedi?",
    "Rush hour (20 persone in fila). Priorità operativa?",
    "La macchina espresso perde acqua dal portafiltro. Primo check?",
    "Cliente dice: 'Il mio latte è bruciato'. Come lo riconosci?",
    "Devi preparare 10 americani per asporto. Workflow ottimale?",
    "Un cliente chiede latte art a forma di orso. Come gestisci?",
    "Il steam wand fischia/stride. Problema?",
    
    "Cliente allergico alle noci chiede un brownie. Procedura?",
    "Devi cambiare il tipo di latte (intero → avena) durante servizio. Step?",
    "Un espresso esce in 18 secondi invece di 28. Correttivo immediato?",
    "Come pulisci il group head tra un servizio e l'altro?",
    "Cliente chiede flat white 'ben caldo ma non bruciato'. Strategia?",
    "Devi servire 5 affogati simultaneamente. Organizzazione?",
    "Il portafiltro è freddo. Impatto sull'estrazione?",
    "Come distribuisci uniformemente il caffè nel portafiltro?",
    "Un cliente dice: 'Troppa schiuma'. Quale drink probabilmente ha ordinato?",
    "Backflush della macchina: quando e come?",
    
    "Cliente chiede cappuccino decaffeinato. Procedura per evitare contaminazione?",
    "Devi ricalibrare il grinder durante il servizio. Possibile?",
    "Come verifichi che il tamper sia uniforme?",
    "Il latte 'urla' durante la montatura. Cosa stai sbagliando?",
    "Cliente chiede 'extra foam' nel cappuccino. Come adatti?",
    "Serving temperature ideale per un flat white vs cappuccino?",
    "Come eviti channeling nell'estrazione espresso?",
    "Cliente vuole macchiato 'layered' (stratificato). Tecnica?",
    "Differenza tra purge e flush della steam wand?",
    "Come cambi l'acqua nel bricco per americani?",
    
    "Un gruppo della macchina non scalda. Workaround temporaneo?",
    "Cliente chiede caffè 'lungo' italiano (non americano). Come lo prepari?",
    "Devi preparare un iced latte ma hai finito il ghiaccio. Alternative?",
    "Come posizioni la steam wand per creare vortex perfetto?",
    "Cliente dice: 'Voglio un caffè normale'. Cosa servi?",
    "La brocca latte è sporca di residui secchi. Impatto?",
    "Come servi un espresso doppio in tazza piccola (demitasse)?",
    "Cliente chiede latte 'extra cremoso'. Quale alternativa milk suggerisci?",
    "Devi fare latte art ma il foam è troppo denso. Fix veloce?",
    "Qual è la sequenza corretta per uno shutdown macchina a fine giornata?",
    
    // VENDITA & CUSTOMER SERVICE (60 domande)
    "Cliente indeciso tra cappuccino e latte. Come guidi la scelta?",
    "Un cliente abituale ordina sempre 'il solito'. Oggi è finito. Come comunichi?",
    "Cliente si lamenta del prezzo (€4 per cappuccino). Response?",
    "Famiglia con 2 bambini. Strategia upsell per aumentare scontrino?",
    "Cliente chiede sconto perché 'è la terza volta oggi'. Come gestisci?",
    "Turista chiede: 'What's buontalenti?' Come lo descrivi in inglese?",
    "Cliente dice: 'L'ultima volta era più buono'. Come rispondi?",
    "Coppia in appuntamento romantico. Suggerimenti per massimizzare esperienza?",
    "Cliente vegano chiede opzioni. Quali prodotti proponi?",
    "Un cliente fotografa il drink e chiede di rifarlo 'più instagrammabile'. Come procedi?",
    
    "Studente con budget limitato. Come proponi upsell senza pressione?",
    "Cliente chiede: 'Qual è il vostro best seller?' Come rispondi?",
    "Un bambino vuole 'caffè come papà'. Alternative adatte?",
    "Cliente torna dopo 5 minuti: 'Il cappuccino è freddo'. Procedura?",
    "Gruppo di 8 persone ordina tutto insieme. Come organizzi?",
    "Cliente chiede consiglio per regalo aziendale. Proposte?",
    "Un cliente dice: 'Non mi piace il caffè'. Come lo conquisti?",
    "Pendolare mattutino di fretta. Upsell veloce (<10 secondi)?",
    "Cliente con intolleranza al lattosio. Full menu alternativo?",
    "Come presenti il programma loyalty a un nuovo cliente?",
    
    "Un cliente chiede: 'Posso avere lo sconto studenti?' (non esistente). Response?",
    "Cliente dice: 'Da Starbucks costa meno'. Come gestisci?",
    "Devi spiegare perché l'alternative milk costa di più. Argomentazione?",
    "Cliente chiede di 'riempire la tazza fino al bordo'. Come gestisci?",
    "Un nonno chiede un dolce 'non troppo dolce' per la nipotina. Suggerimenti?",
    "Cliente business al telefono. Come servi senza interrompere?",
    "Un cliente chiede: 'Questo ha caffeina?' per OGNI prodotto. Pazienza?",
    "Come proponi un size upgrade senza sembrare insistente?",
    "Cliente chiede extra shot gratis 'perché sono stanco'. Response?",
    "Un turista chiede: 'What's the difference between caffè and espresso?' Spiegazione?",
    
    "Cliente diabetico chiede opzioni sugar-free. Cosa proponi?",
    "Un cliente vuole 'cappuccino ma senza foam'. Come lo correggi educatamente?",
    "Bambino piange per gelato ma genitore dice no. Come de-escalare?",
    "Cliente chiede: 'È tutto artigianale vero?' Come confermi?",
    "Un cliente ha fretta ma c'è fila. Come gestisci aspettativa?",
    "Cliente chiede 'qualcosa di nuovo da provare'. Suggerimenti strategici?",
    "Un cliente dice: 'Ho fame ma non so cosa'. Menu guidance?",
    "Come upselli un pairing caffè+dolce senza essere invadente?",
    "Cliente chiede: 'Avete promozioni oggi?' (no). Come rispondi positivamente?",
    "Un cliente ordina per 6 persone ma dice nomi confusi. Come organizzi?",
    
    "Cliente chiede croissant 'appena sfornato' ma è di ieri. Onestà vs vendita?",
    "Un cliente dice: 'Sorprendimi!' Come scegli?",
    "Coppia litiga al tavolo. Intervieni?",
    "Cliente con accento forte, non capisci l'ordine. Strategia?",
    "Un cliente chiede: 'Cosa prenderesti tu?' Come rispondi?",
    "Cliente vuole 'mezzo cappuccino' per risparmiare. Opzioni?",
    "Un influencer chiede prodotto gratis per post Instagram. Response?",
    "Cliente chiede modifiche estreme (es: cappuccino con 6 shot). Gestione?",
    "Un cliente dice: 'Vorrei X ma sono a dieta'. Come supporti?",
    "Come recuperi un cliente insoddisfatto senza offrire rimborso?",
    
    // PROBLEM SOLVING & EMERGENZE (30 domande)
    "Cade corrente durante servizio mattutino (20 clienti in attesa). Priorità?",
    "Un cliente ha reazione allergica dopo aver consumato un dolce. Primo step?",
    "Noti un bambino che corre verso vetrina calda. Azione immediata?",
    "Finisci il latte intero durante rush hour. Piano B?",
    "La macchina espresso smette di funzionare. Workflow alternativo?",
    "Un cliente rovescia caffè bollente addosso. Procedura?",
    "Noti una perdita d'acqua sotto il bancone. Cosa fai?",
    "Grinder bloccato con chicchi dentro. Come lo sblocchi?",
    "Un cliente dice: 'C'è un capello nel mio croissant'. Gestione?",
    "Il POS non funziona e cliente ha solo carta. Opzioni?",
    
    "Fumo dalla macchina espresso. Azioni nei primi 30 secondi?",
    "Un cliente sviene nel locale. Step by step?",
    "Finisci i coni per gelato durante pomeriggio affollato. Alternative creative?",
    "Vetrina gelato mostra temperatura -8°C invece di -14°C. Procedura?",
    "Un cliente dice: 'Questo sa di detersivo'. Possibili contaminazioni?",
    "Coworker si scotta gravemente con steam wand. First aid?",
    "Cade un barattolo di Nutella: vetri nel prodotto. Area control?",
    "Cliente chiede rimborso perché 'non gli è piaciuto' dopo aver finito. Response?",
    "Noti un collega che non segue norme igieniche. Come intervieni?",
    "Il frigo pasticceria non raffredda. Cosa salvi per primo?",
    
    "Un cliente minaccia di lasciare recensione negativa. De-escalation?",
    "Noti discrepanza inventario (manca stock). Procedura?",
    "Coworker non si presenta: sei da solo con 15 ordini. Strategia?",
    "Il delivery arriva con prodotti danneggiati. Accetti o rifiuti?",
    "Un cliente filma dicendo 'Vi segnalo alla ASL'. Come reagisci?",
    "Allarme antincendio durante servizio pieno. Evacuazione?",
    "Nota un cliente che ruba prodotti. Approccio?",
    "Finisci il ghiaccio per iced drinks in estate. Alternative?",
    "Un collega sembra ubriaco durante turno. Cosa fai?",
    "Cliente dice: 'Ho trovato qualcosa di strano nel gelato'. Investigation?",
    
    // PRODOTTO & MENU KNOWLEDGE (20 domande)
    "Differenza tra Buontalenti gelato e gelato normale?",
    "Cosa rende unico il blend Badiani 80/20?",
    "Cliente chiede origine del caffè. Cosa sai?",
    "Slitti: anno di fondazione e caratteristica principale?",
    "Quali prodotti contengono alcool?",
    "Temperatura di cottura ideale churros?",
    "Ingredienti signature Buontalenti crepe?",
    "Perché il Flat White ha meno foam del cappuccino?",
    "Cosa significa 'affogato' letteralmente?",
    "Differenza tra latte macchiato e macchiato?",
    
    "Quali prodotti sono senza glutine?",
    "Storia del panettone Badiani: cosa lo rende speciale?",
    "Quante calorie in un cappuccino medio?",
    "Cosa contiene il Dirty Chai?",
    "Differenza tra cold brew e iced americano?",
    "Quali gusti gelato sono vegan-friendly?",
    "Origine della ricetta churros spagnola?",
    "Cosa rende 'signature' un drink signature?",
    "Quali prodotti sono adatti a bambini <3 anni?",
    "Shelf life di una tavoletta Slitti non aperta?",
  ];

  const getUsedQuestions = () => {
    try {
      return JSON.parse(localStorage.getItem('badiani_used_questions') || '[]');
    } catch {
      return [];
    }
  };

  const saveUsedQuestions = (used) => {
    localStorage.setItem('badiani_used_questions', JSON.stringify(used));
  };

  const getNextQuestion = () => {
    // Generate a new question each time (no "same all day" cache).
    let usedQuestions = getUsedQuestions();
    
    // Reset if all used
    if (usedQuestions.length >= questions.length) {
      usedQuestions = [];
      saveUsedQuestions([]);
    }

    // Find unused question
    const availableQuestions = questions.filter(q => !usedQuestions.includes(q));
    const randomQuestion = availableQuestions[Math.floor(Math.random() * availableQuestions.length)];

    // Mark as used
    usedQuestions.push(randomQuestion);
    saveUsedQuestions(usedQuestions);
    return randomQuestion;
  };

  const displayQuestion = () => {
    const questionElements = document.querySelectorAll('[data-daily-question]');
    if (!questionElements.length) return;

    const question = getNextQuestion();
    questionElements.forEach(el => {
      el.textContent = `💭 ${question}`;
    });
  };

  // Check at midnight
  const scheduleNextUpdate = () => {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const msUntilMidnight = midnight - now;

    setTimeout(() => {
      displayQuestion();
      scheduleNextUpdate();
    }, msUntilMidnight);
  };

  return {
    init: () => {
      displayQuestion();
      scheduleNextUpdate();
    }
  };
})();

// Carousel initialization with Intersection Observer
const initCarousels = () => {
  const carouselEls = document.querySelectorAll('[data-carousel]');
  if (!carouselEls.length) return;

  const dialSound = (() => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return { play: () => {} };
    }

    let ctx;
    let buffer;

    const ensureContext = () => {
      if (!ctx) {
        ctx = new AudioContextClass();
      }
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      return ctx;
    };

    const buildBuffer = (context) => {
      const duration = 0.22;
      const sampleRate = context.sampleRate;
      const bufferNode = context.createBuffer(1, sampleRate * duration, sampleRate);
      const channelData = bufferNode.getChannelData(0);
      for (let i = 0; i < channelData.length; i += 1) {
        const decay = 1 - i / channelData.length;
        channelData[i] = (Math.random() * 2 - 1) * Math.pow(decay, 3);
      }
      return bufferNode;
    };

    return {
      play: () => {
        const context = ensureContext();
        if (!context) return;
        if (!buffer) {
          buffer = buildBuffer(context);
        }
        const source = context.createBufferSource();
        source.buffer = buffer;

        const filter = context.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1200;
        filter.Q.value = 14;

        const gain = context.createGain();
        gain.gain.setValueAtTime(0.16, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.28);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(context.destination);

        source.start();
      }
    };
  })();

  const setupCarousel = (carouselEl) => {
    const isCockpit = carouselEl?.dataset?.carousel === 'cockpit';
    const carouselTrack = carouselEl.querySelector('[data-carousel-track]');
    const carouselHeader = carouselEl.querySelector('[data-carousel-header]');
    const carouselTitle = carouselHeader?.querySelector('[data-carousel-title]');
    const carouselIndicatorsContainer = carouselHeader?.querySelector('[data-carousel-indicators]');
    const carouselItems = carouselTrack?.querySelectorAll('[data-carousel-item]');

    if (!carouselTrack || !carouselHeader || !carouselTitle || !carouselItems || !carouselItems.length) return;

    const items = Array.from(carouselItems);
    const baseTitle = carouselTitle.textContent?.trim() || carouselTitle.dataset.carouselTitle || '';
    carouselTitle.dataset.carouselTitle = baseTitle;

    if (!carouselHeader.hasAttribute('tabindex')) {
      carouselHeader.setAttribute('tabindex', '0');
    }
    carouselHeader.setAttribute('role', 'button');
    carouselHeader.setAttribute('aria-label', 'Scorri il carosello: clic sinistra per precedente, destra per successivo');

    // Populate indicators
    let indicators = [];
    // Counter + meta wrapper (optional UI polish)
    let counterNode = null;
    let headerMeta = null;

    if (carouselIndicatorsContainer) {
      // Ensure a consistent wrapper so we can style the right side as a compact unit.
      // Keep data attributes in place (JS relies on them).
      headerMeta = carouselHeader.querySelector('.carousel-header__meta');
      if (!headerMeta) {
        headerMeta = document.createElement('div');
        headerMeta.className = 'carousel-header__meta';
        // Insert after title block if present, otherwise at end.
        const titleBlock = carouselHeader.querySelector('.carousel-header__title-block');
        if (titleBlock && titleBlock.nextSibling) {
          carouselHeader.insertBefore(headerMeta, titleBlock.nextSibling);
        } else {
          carouselHeader.appendChild(headerMeta);
        }
      }

      counterNode = carouselHeader.querySelector('[data-carousel-counter]');
      if (!counterNode) {
        counterNode = document.createElement('span');
        counterNode.className = 'carousel-counter';
        counterNode.setAttribute('data-carousel-counter', '');
        counterNode.setAttribute('aria-hidden', 'true');
      }

      // Move indicators container into meta (visual-only restructure).
      if (carouselIndicatorsContainer.parentElement !== headerMeta) {
        try {
          headerMeta.appendChild(counterNode);
          headerMeta.appendChild(carouselIndicatorsContainer);
        } catch (e) {
          // Fallback: keep original structure.
          if (!counterNode.parentElement) carouselHeader.appendChild(counterNode);
        }
      } else {
        // Ensure order: counter then indicators.
        if (counterNode.parentElement !== headerMeta) headerMeta.insertBefore(counterNode, headerMeta.firstChild);
        if (carouselIndicatorsContainer.previousSibling !== counterNode) {
          headerMeta.insertBefore(counterNode, carouselIndicatorsContainer);
        }
      }

      carouselIndicatorsContainer.innerHTML = '';
      indicators = items.map((item, index) => {
        const indicator = document.createElement('div');
        indicator.className = 'carousel-indicator';
        indicator.dataset.index = index;
        indicator.addEventListener('click', (event) => {
          event.stopPropagation();
          dialSound.play();
          goToIndex(index);
        });
        carouselIndicatorsContainer.appendChild(indicator);
        return indicator;
      });
    }

    const clampIndex = (index) => Math.max(0, Math.min(items.length - 1, index));
    let currentIndex = -1;

    // Cockpit: when the user scrolls (wheel/trackpad) and stops, gently re-center the nearest
    // card so the focused state matches the visual center.
    const getNearestIndexByCenter = () => {
      const trackRect = carouselTrack.getBoundingClientRect();
      const trackCenter = trackRect.left + carouselTrack.clientWidth / 2;
      let bestIndex = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      items.forEach((item, idx) => {
        const rect = item.getBoundingClientRect();
        const itemCenter = rect.left + rect.width / 2;
        const dist = Math.abs(itemCenter - trackCenter);
        if (dist < bestDistance) {
          bestDistance = dist;
          bestIndex = idx;
        }
      });
      return bestIndex;
    };

    // Drag-to-scroll with momentum (mouse/pen). Touch keeps native scrolling physics.
    (() => {
      if (!carouselTrack) return;

      let isPointerDown = false;
      let isDragging = false;
      let dragStartX = 0;
      let dragStartScrollLeft = 0;
      let lastMoveX = 0;
      let lastMoveTime = 0;
      let velocity = 0;
      let momentumRaf = 0;
      let lastDragEndedAt = 0;

      const MOMENTUM_MIN_VELOCITY = 0.015; // px/ms
      const MOMENTUM_VELOCITY_MULTIPLIER = 1.35;
      const MOMENTUM_DECAY_BASE = 0.982; // closer to 1 => longer glide

      const isInteractiveTarget = (target) => {
        return target && target.closest('button, a, input, select, textarea, [role="button"], [data-profile]');
      };

      const stopMomentum = () => {
        if (momentumRaf) {
          cancelAnimationFrame(momentumRaf);
          momentumRaf = 0;
        }
      };

      const disableSnap = () => {
        if (!carouselTrack.dataset.prevScrollSnapType) {
          carouselTrack.dataset.prevScrollSnapType = carouselTrack.style.scrollSnapType || '';
        }
        carouselTrack.style.scrollSnapType = 'none';
      };

      const restoreSnap = () => {
        if (!('prevScrollSnapType' in carouselTrack.dataset)) return;
        const prev = carouselTrack.dataset.prevScrollSnapType;
        carouselTrack.style.scrollSnapType = prev || '';
        delete carouselTrack.dataset.prevScrollSnapType;
      };

      const clampScrollLeft = (left) => {
        const maxLeft = Math.max(0, carouselTrack.scrollWidth - carouselTrack.clientWidth);
        return Math.max(0, Math.min(maxLeft, left));
      };

      const startMomentum = () => {
        stopMomentum();

        // Ignore tiny flicks.
        if (Math.abs(velocity) < MOMENTUM_MIN_VELOCITY) {
          restoreSnap();
          return;
        }

        // Prevent scroll-snap from fighting momentum.
        disableSnap();

        // Boost release velocity slightly for a more natural "glide".
        velocity *= MOMENTUM_VELOCITY_MULTIPLIER;

        let lastTime = performance.now();
        const step = (now) => {
          const dt = Math.min(40, now - lastTime);
          lastTime = now;

          // Exponential decay for a "natural" feel.
          const decay = Math.pow(MOMENTUM_DECAY_BASE, dt / 16.67);
          velocity *= decay;

          const nextLeft = clampScrollLeft(carouselTrack.scrollLeft - velocity * dt);
          carouselTrack.scrollLeft = nextLeft;

          if (Math.abs(velocity) >= MOMENTUM_MIN_VELOCITY) {
            momentumRaf = requestAnimationFrame(step);
          } else {
            momentumRaf = 0;
            restoreSnap();
          }
        };

        momentumRaf = requestAnimationFrame(step);
      };

      const onPointerDown = (event) => {
        // Let touch keep native scrolling and inertia.
        if (event.pointerType === 'touch') return;
        if (isInteractiveTarget(event.target)) return;

        stopMomentum();
        restoreSnap();
        isPointerDown = true;
        isDragging = false;
        dragStartX = event.clientX;
        dragStartScrollLeft = carouselTrack.scrollLeft;
        lastMoveX = event.clientX;
        lastMoveTime = performance.now();
        velocity = 0;

        carouselTrack.classList.add('is-drag-ready');
        document.body.classList.add('is-dragging-carousel');

        // Avoid smooth snapping while dragging.
        carouselTrack.dataset.prevScrollBehavior = carouselTrack.style.scrollBehavior || '';
        carouselTrack.style.scrollBehavior = 'auto';

        try {
          carouselTrack.setPointerCapture(event.pointerId);
        } catch (err) {
          // Ignore capture failures.
        }
      };

      const onPointerMove = (event) => {
        if (!isPointerDown) return;
        if (event.pointerType === 'touch') return;

        const dx = event.clientX - dragStartX;
        if (!isDragging && Math.abs(dx) > 6) {
          isDragging = true;
          carouselTrack.classList.add('is-dragging');
          disableSnap();
        }

        if (!isDragging) return;

        event.preventDefault();

        const nextLeft = clampScrollLeft(dragStartScrollLeft - dx);
        carouselTrack.scrollLeft = nextLeft;

        const now = performance.now();
        const dt = Math.max(1, now - lastMoveTime);
        const moveDx = event.clientX - lastMoveX;
        // Positive velocity means content should keep moving in the same drag direction.
        velocity = moveDx / dt;
        lastMoveX = event.clientX;
        lastMoveTime = now;
      };

      const endDrag = () => {
        if (!isPointerDown) return;
        isPointerDown = false;

        carouselTrack.classList.remove('is-drag-ready');
        document.body.classList.remove('is-dragging-carousel');

        const prev = carouselTrack.dataset.prevScrollBehavior;
        carouselTrack.style.scrollBehavior = prev || '';
        delete carouselTrack.dataset.prevScrollBehavior;

        if (isDragging) {
          lastDragEndedAt = performance.now();
          carouselTrack.classList.remove('is-dragging');
          startMomentum();
        } else {
          restoreSnap();
        }

        isDragging = false;
      };

      // Some desktop setups behave better with classic mouse events (or when pointer
      // capture fails). Keep them as a fallback.
      const onMouseDown = (event) => {
        if (event.button !== 0) return;
        if (isInteractiveTarget(event.target)) return;
        stopMomentum();
        restoreSnap();
        isPointerDown = true;
        isDragging = false;
        dragStartX = event.clientX;
        dragStartScrollLeft = carouselTrack.scrollLeft;
        lastMoveX = event.clientX;
        lastMoveTime = performance.now();
        velocity = 0;

        carouselTrack.classList.add('is-drag-ready');
        document.body.classList.add('is-dragging-carousel');
        carouselTrack.dataset.prevScrollBehavior = carouselTrack.style.scrollBehavior || '';
        carouselTrack.style.scrollBehavior = 'auto';

        // Prevent text selection drag.
        event.preventDefault();
      };

      const onMouseMove = (event) => {
        if (!isPointerDown) return;
        const dx = event.clientX - dragStartX;
        if (!isDragging && Math.abs(dx) > 6) {
          isDragging = true;
          carouselTrack.classList.add('is-dragging');
          disableSnap();
        }
        if (!isDragging) return;

        event.preventDefault();
        const nextLeft = clampScrollLeft(dragStartScrollLeft - dx);
        carouselTrack.scrollLeft = nextLeft;

        const now = performance.now();
        const dt = Math.max(1, now - lastMoveTime);
        const moveDx = event.clientX - lastMoveX;
        velocity = moveDx / dt;
        lastMoveX = event.clientX;
        lastMoveTime = now;
      };

      const onMouseUp = () => {
        if (!isPointerDown) return;
        endDrag();
      };

      // Improve desktop behavior: avoid native dragstart (e.g. images/selection).
      carouselTrack.addEventListener('dragstart', (event) => event.preventDefault());

      // Hint to browsers: allow vertical page scrolling, handle horizontal drag ourselves.
      // (Mostly affects touch/pen, harmless for mouse.)
      carouselTrack.style.touchAction = 'pan-x pan-y';

      carouselTrack.addEventListener('pointerdown', onPointerDown, { passive: true });
      carouselTrack.addEventListener('pointermove', onPointerMove, { passive: false });
      carouselTrack.addEventListener('pointerup', endDrag);
      carouselTrack.addEventListener('pointercancel', endDrag);
      carouselTrack.addEventListener('pointerleave', endDrag);

      carouselTrack.addEventListener('mousedown', onMouseDown);
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);

      // Prevent accidental clicks on cards/controls right after a drag.
      carouselTrack.addEventListener(
        'click',
        (event) => {
          const now = performance.now();
          if (now - lastDragEndedAt < 350) {
            event.preventDefault();
            event.stopPropagation();
          }
        },
        true
      );
    })();

    const updateFocusedCard = (index) => {
      items.forEach((item, idx) => {
        item.classList.toggle('is-focused', idx === index);
      });
    };

    const applyState = (index, options = {}) => {
      const { preserveTitle = false } = options;
      const targetIndex = clampIndex(index);
      if (currentIndex === targetIndex) return;
      currentIndex = targetIndex;

      const targetItem = items[targetIndex];
      if (!targetItem) return;

      if (!preserveTitle) {
        const productName = targetItem.querySelector('h3')?.textContent?.trim() || baseTitle;
        carouselTitle.textContent = productName;
        if (isCockpit) {
          carouselTitle.classList.remove('is-scrolling');
        } else {
          const isEdge = targetIndex === 0 || targetIndex === items.length - 1;
          carouselTitle.classList.toggle('is-scrolling', isEdge);
        }
      } else {
        carouselTitle.classList.remove('is-scrolling');
      }

      indicators.forEach((indicator, idx) => {
        indicator.classList.toggle('is-active', idx === targetIndex);
      });

      // Update counter/progress (if enabled)
      try {
        const total = items.length;
        const current = targetIndex + 1;
        if (counterNode) {
          counterNode.textContent = `${current}/${total}`;
        }
        // Useful for CSS progress bars if needed.
        carouselHeader.style.setProperty('--carousel-progress', String(total ? current / total : 0));
      } catch (e) {}

      updateFocusedCard(targetIndex);
    };

    const goToIndex = (index, options = {}) => {
      const targetIndex = clampIndex(index);
      const targetItem = items[targetIndex];
      if (!targetItem) return;
      applyState(targetIndex);
      const behavior = options.behavior || 'smooth';

      // Center using real viewport geometry (robust across padding, scrollbars, rounding).
      const trackRect = carouselTrack.getBoundingClientRect();
      const itemRect = targetItem.getBoundingClientRect();
      // Use clientWidth to represent the actually visible scroll viewport (more stable on Windows
      // where scrollbar/padding rounding can make rect.width slightly differ).
      const trackCenter = trackRect.left + carouselTrack.clientWidth / 2;
      const itemCenter = itemRect.left + itemRect.width / 2;
      let targetLeft = carouselTrack.scrollLeft + (itemCenter - trackCenter);
      const maxLeft = Math.max(0, carouselTrack.scrollWidth - carouselTrack.clientWidth);
      targetLeft = Math.max(0, Math.min(maxLeft, targetLeft));

      try {
        carouselTrack.scrollTo({ left: targetLeft, behavior });
      } catch (err) {
        carouselTrack.scrollLeft = targetLeft;
      }
    };

    let focusLock = true;
    const releaseFocusLock = () => {
      focusLock = false;
    };

    carouselTrack.addEventListener('pointerdown', releaseFocusLock, { once: true, passive: true });
    carouselTrack.addEventListener('wheel', releaseFocusLock, { once: true, passive: true });
    carouselHeader.addEventListener('keydown', releaseFocusLock, { once: true });

    const observerOptions = isCockpit
      ? {
          root: carouselTrack,
          // Shrink the observation area to a center band, so focus only updates when
          // the card is actually near the center (more stable + "magnetic" feel).
          rootMargin: '0px -35% 0px -35%',
          threshold: [0.15]
        }
      : {
          root: carouselTrack,
          // Trigger focus sooner while scrolling so the upcoming card ingrandisce prima.
          rootMargin: '0px -25% 0px -25%',
          threshold: [0.35]
        };

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        const visibleEntries = entries.filter((entry) => entry.isIntersecting);
        if (!visibleEntries.length) return;

        if (focusLock) return;

        // Pick the card whose center is closest to the track center, so the next card
        // takes focus as soon as it overtakes the current one during scroll.
        const trackRect = carouselTrack.getBoundingClientRect();
        const trackCenter = trackRect.left + carouselTrack.clientWidth / 2;
        let bestIdx = -1;
        let bestDist = Number.POSITIVE_INFINITY;
        visibleEntries.forEach((entry) => {
          const rect = entry.target.getBoundingClientRect();
          const itemCenter = rect.left + rect.width / 2;
          const dist = Math.abs(itemCenter - trackCenter);
          if (dist < bestDist) {
            bestDist = dist;
            bestIdx = items.indexOf(entry.target);
          }
        });

        if (bestIdx === -1) return;
        applyState(bestIdx);
      }, observerOptions);

      items.forEach((item) => observer.observe(item));

      // Also update focus on scroll using geometric center so the next card takes focus promptly.
      let scrollRaf = 0;
      const onScroll = () => {
        if (focusLock) return;
        if (scrollRaf) return;
        scrollRaf = requestAnimationFrame(() => {
          scrollRaf = 0;
          // If siamo attaccati all'inizio, forza la prima card come focus.
          if (carouselTrack.scrollLeft <= 2) {
            applyState(0);
            return;
          }

          const nextIndex = getNearestIndexByCenter();
          applyState(nextIndex);
        });
      };

      carouselTrack.addEventListener('scroll', onScroll, { passive: true });
    } else {
      // Fallback: approximate focused card by distance to the track center on scroll.
      let scrollRaf = 0;
      const getNearestIndex = () => {
        const trackRect = carouselTrack.getBoundingClientRect();
        const trackCenter = trackRect.left + trackRect.width / 2;
        let bestIndex = 0;
        let bestDistance = Number.POSITIVE_INFINITY;
        items.forEach((item, idx) => {
          const rect = item.getBoundingClientRect();
          const itemCenter = rect.left + rect.width / 2;
          const dist = Math.abs(itemCenter - trackCenter);
          if (dist < bestDistance) {
            bestDistance = dist;
            bestIndex = idx;
          }
        });
        return bestIndex;
      };

      const onScroll = () => {
        if (scrollRaf) return;
        scrollRaf = requestAnimationFrame(() => {
          scrollRaf = 0;
          if (carouselTrack.scrollLeft <= 2) {
            applyState(0);
            return;
          }

          const nextIndex = getNearestIndex();
          applyState(nextIndex);
        });
      };

      carouselTrack.addEventListener('scroll', onScroll, { passive: true });
    }

    if (isCockpit) {
      let settleTimer = 0;
      const settleToCenter = () => {
        settleTimer = 0;

        // Don't fight drag/momentum.
        if (carouselTrack.classList.contains('is-dragging')) return;
        if ('prevScrollSnapType' in carouselTrack.dataset) return;

        const idx = getNearestIndexByCenter();
        const item = items[idx];
        if (!item) return;

        const trackRect = carouselTrack.getBoundingClientRect();
        const itemRect = item.getBoundingClientRect();
        const trackCenter = trackRect.left + carouselTrack.clientWidth / 2;
        const itemCenter = itemRect.left + itemRect.width / 2;
        const delta = itemCenter - trackCenter;

        // If already basically centered, don't move.
        if (Math.abs(delta) < 2) return;
        goToIndex(idx);
      };

      carouselTrack.addEventListener(
        'scroll',
        () => {
          if (settleTimer) window.clearTimeout(settleTimer);
          settleTimer = window.setTimeout(settleToCenter, 140);
        },
        { passive: true }
      );
    }

    const getStartIndex = () => {
      if (!isCockpit) return 0;
      // Cockpit: start centered on Totali (or fallback to first item), so title/dots match the visible card.
      const preferredIndex = items.findIndex((item) => item.classList.contains('summary-card--totals'));
      return preferredIndex >= 0 ? preferredIndex : 0;
    };

    const headerNavigate = (direction) => {
      dialSound.play();
      goToIndex(currentIndex + direction);
    };

    carouselHeader.addEventListener('click', (event) => {
      if (event.target.closest('[data-carousel-indicators]')) return;
      const rect = carouselHeader.getBoundingClientRect();
      const isLeft = event.clientX < rect.left + rect.width / 2;
      headerNavigate(isLeft ? -1 : 1);
    });

    carouselHeader.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        headerNavigate(-1);
      }
      if (event.key === 'ArrowRight' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        headerNavigate(1);
      }
    });

    carouselHeader.addEventListener('pointerdown', () => {
      carouselHeader.classList.add('is-pressed');
    });

    const releasePress = () => {
      carouselHeader.classList.remove('is-pressed');
    };

    carouselHeader.addEventListener('pointerup', releasePress);
    carouselHeader.addEventListener('pointerleave', releasePress);
    carouselHeader.addEventListener('pointercancel', releasePress);

    const initialIndex = getStartIndex();
    // Non-cockpit carousels keep their section title on load.
    // Cockpit shows the focused card title in the header.
    const preserveTitle = !isCockpit;
    requestAnimationFrame(() => {
      applyState(initialIndex, { preserveTitle });
      goToIndex(initialIndex, { behavior: 'auto' });
    });
  };

  carouselEls.forEach(setupCarousel);
};

// Initialize carousels on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCarousels);
} else {
  initCarousels();
}

// Initialize daily questions
dailyQuestions.init();

// Profile controls are initialized inside gamification init()

// Summary tabs (homepage): simple tab switcher
const initSummaryTabs = () => {
  const root = document.querySelector('[data-summary]');
  if (!root) return;
  const tabs = Array.from(root.querySelectorAll('[data-summary-tab]'));
  const panels = Array.from(root.querySelectorAll('[data-summary-panel]'));
  if (!tabs.length || !panels.length) return;

  const getTabId = (t) => t?.dataset?.summaryTab || t?.dataset?.target || '';

  const activate = (id) => {
    tabs.forEach((t) => {
      const on = getTabId(t) === id;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', String(on));
      t.setAttribute('tabindex', on ? '0' : '-1');
    });
    panels.forEach((p) => {
      const on = p.dataset.summaryPanel === id;
      p.classList.toggle('is-active', on);
      p.setAttribute('aria-hidden', String(!on));
    });
  };

  tabs.forEach((t) => {
    t.addEventListener('click', () => activate(getTabId(t)));
    t.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        activate(getTabId(t));
      }
    });
  });

  const current = tabs.find((t) => t.classList.contains('is-active')) || tabs[0];
  if (current) activate(getTabId(current));
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSummaryTabs);
} else {
  initSummaryTabs();
}

// ============================================================
// GUIDE CARD AUTO-SCROLL (CAROUSELS)
// - Click on a card (not buttons) => keep it focused + scroll page to reveal content
// - Hover (desktop) => center page on that card's "Specifiche"
// ============================================================

const initGuideCardAutoScroll = () => {
  try {
    const prefersReducedMotion = (() => {
      try {
        return !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      } catch (e) {
        return false;
      }
    })();

    const supportsHover = (() => {
      try {
        return !!window.matchMedia && window.matchMedia('(hover: hover)').matches;
      } catch (e) {
        return false;
      }
    })();

    const scrollBehavior = prefersReducedMotion ? 'auto' : 'smooth';
    // Prevent "violent" jumps: limit how much vertical scroll we can request per interaction.
    // (Keeps motion subtle inside long pages + carousels.)
    const MAX_SCROLL_DELTA_PX = prefersReducedMotion ? Infinity : 260;

    const isInteractiveTarget = (node) => {
      try {
        return !!node?.closest?.('button, a, input, textarea, select, summary, [role="button"], [data-toggle-card], [data-popover-toggle]');
      } catch (e) {
        return false;
      }
    };

    const scrollToTop = (top) => {
      const currentTop = window.pageYOffset || document.documentElement.scrollTop || 0;
      let nextTop = Math.max(0, Math.floor(top));

      const delta = nextTop - currentTop;
      if (Number.isFinite(MAX_SCROLL_DELTA_PX) && Math.abs(delta) > MAX_SCROLL_DELTA_PX) {
        nextTop = Math.max(0, Math.floor(currentTop + Math.sign(delta) * MAX_SCROLL_DELTA_PX));
      }
      try {
        window.scrollTo({ top: nextTop, behavior: scrollBehavior });
      } catch (err) {
        window.scrollTo(0, nextTop);
      }
    };

    // Minimal vertical adjustment: keep the element center inside a safe band without forcing true centering.
    const nudgeElementCenterIntoBand = (el, { topSafe = 120, bottomSafe = 120 } = {}) => {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight || 0;
      if (!vh) return;

      const center = rect.top + rect.height / 2;
      const minCenter = topSafe;
      const maxCenter = vh - bottomSafe;
      if (center >= minCenter && center <= maxCenter) return;

      // Compute the smallest scroll delta that brings the center back into the band.
      let adjust = 0;
      if (center < minCenter) adjust = center - minCenter; // negative => scroll up (less pageYOffset)
      if (center > maxCenter) adjust = center - maxCenter; // positive => scroll down

      scrollToTop((window.pageYOffset || 0) + adjust);
    };

    const scrollIntoViewVertical = (el, block = 'center', pad = 24) => {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight || 0;
      if (!vh) return;

      let targetTop = window.pageYOffset;
      if (block === 'start') {
        targetTop = window.pageYOffset + rect.top - pad;
      } else if (block === 'end') {
        targetTop = window.pageYOffset + rect.bottom - vh + pad;
      } else {
        // Center element within viewport.
        const elementCenter = rect.top + rect.height / 2;
        const viewportCenter = vh / 2;
        targetTop = window.pageYOffset + (elementCenter - viewportCenter);
      }

      scrollToTop(targetTop);
    };

    const ensureCardFullyVisible = (card, { padTop = 20, padBottom = 20 } = {}) => {
      if (!card) return;
      const rect = card.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight || 0;
      if (!vh) return;

      // If the card is taller than the viewport, never force-scroll to the bottom:
      // it feels like a "jump" and fights the user's intent.
      const cardFitsViewport = rect.height <= (vh - padTop - padBottom);

      // If card is above viewport => align start.
      if (rect.top < padTop) {
        scrollIntoViewVertical(card, 'start', padTop);
        return;
      }

      // If card bottom is cut => align end.
      if (cardFitsViewport && rect.bottom > vh - padBottom) {
        scrollIntoViewVertical(card, 'end', padBottom);
      }
    };

    const cards = Array.from(document.querySelectorAll('.guide-card'))
      // Avoid modal/overlay content.
      .filter((card) => !card.closest('.card-modal') && !card.closest('.card-modal-overlay'));

    if (!cards.length) return;

    const hoverTimers = new WeakMap();

    const clearHoverTimer = (card) => {
      const t = hoverTimers.get(card);
      if (t) window.clearTimeout(t);
      hoverTimers.delete(card);
    };

    const setFocusedCard = (targetCard) => {
      cards.forEach((c) => {
        if (c === targetCard) return;
        c.classList.remove('is-focused');
      });
    };

    cards.forEach((card) => {
      // Only apply to cards that are inside carousels/tracks.
      const isInCarousel = !!card.closest('[data-carousel-track], .carousel-track');
      if (!isInCarousel) return;

      // Drag-guard for horizontal carousels: ignore "clicks" that started as drags.
      let pointerDown = false;
      let moved = false;
      let startX = 0;
      let startY = 0;

      card.addEventListener(
        'pointerdown',
        (e) => {
          if (isInteractiveTarget(e.target)) return;
          pointerDown = true;
          moved = false;
          startX = e.clientX;
          startY = e.clientY;
        },
        { passive: true }
      );

      card.addEventListener(
        'pointermove',
        (e) => {
          if (!pointerDown) return;
          if (moved) return;
          const dx = Math.abs(e.clientX - startX);
          const dy = Math.abs(e.clientY - startY);
          if (dx > 10 || dy > 10) moved = true;
        },
        { passive: true }
      );

      const endPointer = () => {
        pointerDown = false;
      };
      card.addEventListener('pointerup', endPointer);
      card.addEventListener('pointercancel', endPointer);

      // Click: keep the card focused and auto-scroll the page to show its content.
      card.addEventListener('click', (event) => {
        try {
          if (moved) return;
          if (document.body.classList.contains('is-dragging-carousel')) return;
          if (isInteractiveTarget(event.target)) return;

          const alreadyFocused = card.classList.contains('is-focused');
          setFocusedCard(card);
          card.classList.toggle('is-focused', !alreadyFocused);

          // 1) Nudge viewport to include the full card (top-to-bottom).
          requestAnimationFrame(() => {
            ensureCardFullyVisible(card, { padTop: 24, padBottom: 24 });

            // 2) When focused, center on Specifiche so the user immediately sees them.
            if (!card.classList.contains('is-focused')) return;
            const spec = card.querySelector('.stat-list');
            if (!spec) return;
            window.setTimeout(() => {
              // Skip if already basically centered.
              const rect = spec.getBoundingClientRect();
              const vh = window.innerHeight || document.documentElement.clientHeight || 0;
              if (!vh) return;
              const center = rect.top + rect.height / 2;
              if (center > 90 && center < vh - 90) return;
              // Gentle nudge (not strict centering) to avoid "violent" scroll down.
              nudgeElementCenterIntoBand(spec, { topSafe: 140, bottomSafe: 140 });
            }, prefersReducedMotion ? 0 : 160);
          });
        } catch (e) {}
      });

      // Hover (desktop): center the page on the specific card's specs.
      if (supportsHover) {
        card.addEventListener('mouseenter', () => {
          try {
            if (document.body.classList.contains('is-dragging-carousel')) return;
            clearHoverTimer(card);
            const spec = card.querySelector('.stat-list');
            if (!spec) return;

            const timer = window.setTimeout(() => {
              // The CSS reveal is transition-based; wait a bit so geometry updates.
              const rect = spec.getBoundingClientRect();
              const vh = window.innerHeight || document.documentElement.clientHeight || 0;
              if (!vh) return;
              // If the list is still basically collapsed, don't fight the layout.
              if (rect.height < 6) return;

              const center = rect.top + rect.height / 2;
              // Only scroll when the "spec center" is outside a safe band.
              if (center > 90 && center < vh - 90) return;
              nudgeElementCenterIntoBand(spec, { topSafe: 140, bottomSafe: 140 });
            }, prefersReducedMotion ? 0 : 180);

            hoverTimers.set(card, timer);
          } catch (e) {}
        });

        card.addEventListener('mouseleave', () => {
          clearHoverTimer(card);
        });
      }
    });
  } catch (e) {}
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGuideCardAutoScroll);
} else {
  initGuideCardAutoScroll();
}
