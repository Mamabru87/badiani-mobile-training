document.documentElement.classList.add('has-js');

// ============================================================
// STORAGE ADAPTER + PROFILE API (stability layer)
// - Centralizes JSON parsing, safe storage access, and profile consistency.
// - Does NOT change any DOM hooks; it only makes persistence more reliable.
// ============================================================

(() => {
  if (window.BadianiStorage) return;

  const safeGet = (store, key) => {
    try { return store.getItem(key); } catch { return null; }
  };
  const safeSet = (store, key, value) => {
    try { store.setItem(key, value); return true; } catch { return false; }
  };
  const safeRemove = (store, key) => {
    try { store.removeItem(key); return true; } catch { return false; }
  };

  const jsonParse = (raw, fallback = null) => {
    try {
      if (raw == null || raw === '') return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  };

  const jsonStringify = (value) => {
    try { return JSON.stringify(value); } catch { return ''; }
  };

  const hasLocalStorage = () => {
    try {
      const k = '__badiani_ls_test__';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      return true;
    } catch {
      return false;
    }
  };

  const getRaw = (key) => {
    // Prefer localStorage when available.
    if (hasLocalStorage()) {
      const raw = safeGet(localStorage, key);
      if (raw != null) return raw;
    }
    // Fallback to sessionStorage.
    const s = safeGet(sessionStorage, key);
    if (s != null) return s;
    return null;
  };

  const setRaw = (key, value) => {
    // Best-effort local first, session fallback.
    if (hasLocalStorage() && safeSet(localStorage, key, value)) return true;
    return safeSet(sessionStorage, key, value);
  };

  const removeRaw = (key) => {
    // Remove from both stores.
    let ok = false;
    ok = safeRemove(localStorage, key) || ok;
    ok = safeRemove(sessionStorage, key) || ok;
    return ok;
  };

  window.BadianiStorage = {
    hasLocalStorage,
    getRaw,
    setRaw,
    removeRaw,
    getJSON(key, fallback = null) {
      return jsonParse(getRaw(key), fallback);
    },
    setJSON(key, value) {
      return setRaw(key, jsonStringify(value));
    },
    remove(key) {
      return removeRaw(key);
    },
  };
})();

(() => {
  if (window.BadianiProfile) return;

  const KEY_ACTIVE = 'badianiUser.profile.v1';
  const KEY_LIST = 'badianiUser.profiles';

  const normalizeText = (v) => String(v || '').trim();

  const readProfiles = () => {
    const list = window.BadianiStorage?.getJSON?.(KEY_LIST, []) || [];
    return Array.isArray(list) ? list : [];
  };

  const writeProfiles = (profiles) => {
    const arr = Array.isArray(profiles) ? profiles : [];
    window.BadianiStorage?.setJSON?.(KEY_LIST, arr);
    return arr;
  };

  const sanitizeProfile = (p) => {
    if (!p || typeof p !== 'object') return null;
    const id = normalizeText(p.id);
    const nickname = normalizeText(p.nickname);
    const gelato = normalizeText(p.gelato);
    if (!id || nickname.length < 1 || gelato.length < 1) return null;
    return {
      id,
      nickname,
      gelato,
      createdAt: (typeof p.createdAt === 'number' && Number.isFinite(p.createdAt)) ? p.createdAt : Date.now(),
      updatedAt: (typeof p.updatedAt === 'number' && Number.isFinite(p.updatedAt)) ? p.updatedAt : undefined,
    };
  };

  const upsertIntoList = (profile) => {
    const p = sanitizeProfile(profile);
    if (!p) return null;
    const profiles = readProfiles();
    const idx = profiles.findIndex((x) => x && x.id === p.id);
    if (idx >= 0) {
      const prev = profiles[idx] || {};
      profiles[idx] = {
        ...prev,
        ...p,
        createdAt: (typeof prev.createdAt === 'number' && Number.isFinite(prev.createdAt)) ? prev.createdAt : p.createdAt,
      };
    } else {
      profiles.push(p);
    }
    writeProfiles(profiles);
    return p;
  };

  const dispatchUpdated = (profile) => {
    try {
      document.dispatchEvent(new CustomEvent('badiani:profile-updated', { detail: { profile } }));
    } catch {}
  };

  const getActive = () => {
    const raw = window.BadianiStorage?.getJSON?.(KEY_ACTIVE, null);
    return sanitizeProfile(raw);
  };

  const setActive = (profile) => {
    const p = sanitizeProfile(profile);
    if (!p) return null;
    const now = Date.now();
    const next = { ...p, updatedAt: now };
    window.BadianiStorage?.setJSON?.(KEY_ACTIVE, next);
    upsertIntoList(next);
    dispatchUpdated(next);
    return next;
  };

  const updateActive = (patch) => {
    const current = getActive();
    if (!current) return null;
    const next = {
      ...current,
      ...patch,
      nickname: patch && Object.prototype.hasOwnProperty.call(patch, 'nickname') ? normalizeText(patch.nickname) : current.nickname,
      gelato: patch && Object.prototype.hasOwnProperty.call(patch, 'gelato') ? normalizeText(patch.gelato) : current.gelato,
      updatedAt: Date.now(),
    };
    return setActive(next);
  };

  window.BadianiProfile = {
    KEY_ACTIVE,
    KEY_LIST,
    getActive,
    getProfiles: readProfiles,
    setActive,
    updateActive,
    logout() {
      window.BadianiStorage?.remove?.(KEY_ACTIVE);
      dispatchUpdated(null);
    },
  };
})();

// ============================================================
// AVATAR SPRITE (index.html)
// Sprite sheet animation helper (no bundler, vanilla JS, IIFE).
// Renders via <canvas> by default for crisp, pixel-perfect cropping (prevents
// edge bleeding and frame wrap-around). Background-position mode remains as a
// fallback.
// ============================================================

(() => {
  const num = (value, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };

  const prefersReducedMotion = (() => {
    try {
      return !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    } catch {
      return false;
    }
  })();

  // Row mapping (6x4 sprite sheet):
  // row 1 -> idle, row 2 -> tap/click, row 3 -> think (user typing / assistant thinking), row 4 -> type (assistant typing answer)
  const STATE_ROWS = {
    idle: 0,
    tap: 1,
    think: 2,
    type: 3,
  };

  const imageCache = new Map();

  const loadImage = (src) => {
    const key = String(src || '').trim();
    if (!key) return Promise.resolve(null);
    if (imageCache.has(key)) return imageCache.get(key);
    const p = new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.loading = 'eager';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      try { img.src = key; } catch { resolve(null); }
    });
    imageCache.set(key, p);
    return p;
  };

  const getFrameRect = (imgW, imgH, cols, rows, frameIndex) => {
    const col = frameIndex % cols;
    const row = Math.floor(frameIndex / cols);

    // Compute integer rects by distributing remainder pixels across cells.
    const cellW = imgW / cols;
    const cellH = imgH / rows;

    const sx = Math.round(col * cellW);
    const sx2 = Math.round((col + 1) * cellW);
    const sy = Math.round(row * cellH);
    const sy2 = Math.round((row + 1) * cellH);

    return {
      sx,
      sy,
      sw: Math.max(1, sx2 - sx),
      sh: Math.max(1, sy2 - sy),
    };
  };

  const all = new Set();
  const animators = new WeakMap();

  const resolveSpriteEl = (target) => {
    if (!target) return null;
    if (target instanceof Element) {
      if (target.matches?.('[data-avatar-sprite]')) return target;
      return target.querySelector?.('[data-avatar-sprite]') || null;
    }
    return null;
  };

  const readConfig = (el) => {
    const src = el.getAttribute('data-avatar-src') || '';
    const cols = Math.max(1, num(el.getAttribute('data-avatar-cols'), 6));
    const rows = Math.max(1, num(el.getAttribute('data-avatar-rows'), 4));
    const fps = Math.max(1, Math.min(30, num(el.getAttribute('data-avatar-fps'), 6)));
    const total = Math.max(1, Math.floor(num(el.getAttribute('data-avatar-total'), cols * rows)));
    return { src, cols, rows, fps, total };
  };

  const applyStaticConfig = (el, cfg) => {
    try {
      el.style.setProperty('--avatar-cols', String(cfg.cols));
      el.style.setProperty('--avatar-rows', String(cfg.rows));
    } catch {}

    if (cfg.src) {
      try {
        el.style.backgroundImage = `url("${cfg.src}")`;
      } catch {}
    }
  };

  const clampStateRow = (row, cfg) => {
    const maxRow = Math.max(0, Math.min(cfg.rows - 1, Math.floor(cfg.total / cfg.cols) - 1));
    const safe = Number.isFinite(row) ? row : 0;
    return Math.max(0, Math.min(maxRow, safe));
  };

  const getStateRow = (state, cfg) => {
    const key = String(state || '').trim();
    if (key && key in STATE_ROWS) return clampStateRow(STATE_ROWS[key], cfg);
    // Allow manual override via data-avatar-row="0..".
    const manual = num(cfg?.el?.getAttribute?.('data-avatar-row'), NaN);
    if (Number.isFinite(manual)) return clampStateRow(manual, cfg);
    return clampStateRow(STATE_ROWS.idle, cfg);
  };

  const computeRange = (cfg, stateName) => {
    const row = clampStateRow(STATE_ROWS[String(stateName || 'idle')] ?? 0, cfg);
    const start = row * cfg.cols;
    const len = Math.min(cfg.cols, Math.max(1, cfg.total - start));
    return { row, start, len };
  };

  const createAnimator = (el) => {
    const cfg = { ...readConfig(el), el };
    applyStaticConfig(el, cfg);

    const renderMode = (el.getAttribute('data-avatar-render') || 'canvas').toLowerCase();
    let canvas = null;
    let ctx = null;
    let img = null;
    let dpr = 1;

    const ensureCanvas = () => {
      if (renderMode === 'background') return;
      if (canvas && ctx) return;
      canvas = el.querySelector('canvas[data-avatar-canvas]');
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.setAttribute('data-avatar-canvas', '');
        canvas.setAttribute('aria-hidden', 'true');
        canvas.tabIndex = -1;
        // Keep clicks on the wrapper element.
        canvas.style.pointerEvents = 'none';
        el.appendChild(canvas);
      }
      try {
        ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          try { ctx.imageSmoothingQuality = 'high'; } catch {}
        }
      } catch {
        ctx = null;
      }

      // If canvas works, disable background image to avoid any bleed artifacts.
      try {
        el.style.backgroundImage = 'none';
      } catch {}
    };

    // Preload image for canvas mode.
    if (renderMode !== 'background' && cfg.src) {
      ensureCanvas();
      loadImage(cfg.src).then((loaded) => {
        img = loaded;
        // First paint after image arrives.
        try { applyFrame(); } catch {}
      });
    }

    const initialState = el.getAttribute('data-avatar-state') || 'idle';
    let { start: rangeStart, len: rangeLen } = computeRange(cfg, initialState);
    let state = String(initialState || 'idle');

    // Allow slower idle animation without affecting other states.
    // Base fps comes from data-avatar-fps; idle can be overridden with data-avatar-fps-idle.
    const baseFps = Math.max(1, Math.min(30, Number(cfg.fps) || 12));
    const idleFpsOverride = num(el.getAttribute('data-avatar-fps-idle'), NaN);
    const idleFps = Math.max(1, Math.min(30,
      Number.isFinite(idleFpsOverride) ? idleFpsOverride : Math.max(1, Math.round(baseFps * 0.5))
    ));
    let activeFps = (state === 'idle') ? idleFps : baseFps;

    let frame = 0;
    let rafId = 0;
    let lastT = 0;
    let acc = 0;
    let isOnScreen = true;
    let pulseToken = 0;

    const frameMs = () => 1000 / activeFps;

    const applyFrame = () => {
      const abs = rangeStart + (frame % rangeLen);
      // Canvas mode (preferred): pixel-perfect crop => no wrap-around / edge bleed.
      if (renderMode !== 'background') {
        ensureCanvas();
        if (!canvas || !ctx || !img) return;

        const rect = el.getBoundingClientRect();
        const w = el.clientWidth || rect.width || 0;
        const h = el.clientHeight || rect.height || 0;
        if (!w || !h) return;

        dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
        const cw = Math.max(1, Math.round(w * dpr));
        const ch = Math.max(1, Math.round(h * dpr));
        if (canvas.width !== cw || canvas.height !== ch) {
          canvas.width = cw;
          canvas.height = ch;
        }

        const fr = getFrameRect(img.naturalWidth || img.width || 0, img.naturalHeight || img.height || 0, cfg.cols, cfg.rows, abs);
        try {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, fr.sx, fr.sy, fr.sw, fr.sh, 0, 0, canvas.width, canvas.height);
        } catch {}
        return;
      }

      // Background mode (fallback): round offsets to reduce subpixel jitter.
      const col = abs % cfg.cols;
      const row = Math.floor(abs / cfg.cols);
      const rect = el.getBoundingClientRect();
      // Use padding-box size (client*) so borders don't accumulate into the step size.
      // Falling back to rect keeps it resilient for edge cases where client* is 0.
      const w = el.clientWidth || rect.width || 0;
      const h = el.clientHeight || rect.height || 0;
      const x = Math.round(col * w);
      const y = Math.round(row * h);
      try {
        el.style.setProperty('--avatar-x', String(x));
        el.style.setProperty('--avatar-y', String(y));
      } catch {}
    };

    const step = (t) => {
      if (!rafId) return;
      if (document.hidden || prefersReducedMotion || !isOnScreen) {
        stop();
        return;
      }
      if (!lastT) lastT = t;
      const dt = Math.max(0, t - lastT);
      lastT = t;
      acc += dt;

      const ms = frameMs();
      while (acc >= ms) {
        acc -= ms;
        frame = (frame + 1) % rangeLen;
      }

      applyFrame();
      rafId = window.requestAnimationFrame(step);
    };

    const start = () => {
      if (prefersReducedMotion) {
        frame = 0;
        applyFrame();
        return;
      }
      if (document.hidden || !isOnScreen) return;
      if (rafId) return;
      lastT = 0;
      acc = 0;
      rafId = window.requestAnimationFrame(step);
    };

    const stop = () => {
      if (!rafId) return;
      window.cancelAnimationFrame(rafId);
      rafId = 0;
    };

    const setState = (nextState) => {
      const s = String(nextState || 'idle');
      state = s;
      try { el.setAttribute('data-avatar-state', s); } catch {}
      const r = computeRange(cfg, s);
      rangeStart = r.start;
      rangeLen = r.len;
      activeFps = (s === 'idle') ? idleFps : baseFps;
      frame = 0;
      applyFrame();
      if (!prefersReducedMotion) start();
    };

    const pulseState = (tempState, ms = 900) => {
      const token = ++pulseToken;
      const prev = state;
      setState(tempState);
      window.setTimeout(() => {
        if (token !== pulseToken) return;
        setState(prev);
      }, Math.max(0, Number(ms) || 0));
    };

    // Click interaction: tap animation (row 2)
    if (!el.hasAttribute('data-avatar-click')) {
      try { el.setAttribute('data-avatar-click', '1'); } catch {}
      el.addEventListener('click', () => pulseState('tap', 900));
    }

    // Keep the frame aligned if layout changes.
    window.addEventListener('resize', applyFrame, { passive: true });

    // Pause if scrolled away.
    let io = null;
    if ('IntersectionObserver' in window) {
      try {
        io = new IntersectionObserver((entries) => {
          isOnScreen = entries.some((e) => e.isIntersecting);
          if (isOnScreen) start();
          else stop();
        }, { threshold: 0.12 });
        io.observe(el);
      } catch {
        io = null;
      }
    }

    // Initial paint.
    applyFrame();
    start();

    return {
      el,
      start,
      stop,
      applyFrame,
      setState,
      pulseState,
      get state() { return state; },
      destroy() {
        stop();
        try { io?.disconnect?.(); } catch {}
      },
    };
  };

  const ensureAnimator = (el) => {
    if (!el || !(el instanceof Element)) return null;
    const existing = animators.get(el);
    if (existing) return existing;
    const a = createAnimator(el);
    animators.set(el, a);
    all.add(a);
    return a;
  };

  const init = (root = document) => {
    const scope = (root && root.querySelectorAll) ? root : document;
    const nodes = Array.from(scope.querySelectorAll('[data-avatar-sprite]'));
    nodes.forEach((n) => ensureAnimator(n));
    return nodes.length;
  };

  const setState = (target, state) => {
    const el = resolveSpriteEl(target);
    if (!el) return;
    ensureAnimator(el)?.setState(state);
  };

  const pulseState = (target, state, ms = 900) => {
    const el = resolveSpriteEl(target);
    if (!el) return;
    ensureAnimator(el)?.pulseState(state, ms);
  };

  const refresh = (target) => {
    const el = resolveSpriteEl(target);
    if (!el) return;
    ensureAnimator(el)?.applyFrame();
  };

  // Global visibility hook
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      all.forEach((a) => a.stop());
      return;
    }
    all.forEach((a) => a.start());
  });

  // Expose API for dynamically inserted avatars (assistant UIs).
  try {
    window.BadianiAvatarSprites = {
      init,
      setState,
      pulseState,
      refresh,
    };
  } catch {}

  // Auto-init (safe for pages without sprites).
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init(document), { once: true });
  } else {
    init(document);
  }
})();

// ============================================================
// INPUT MODE / MOBILE UI FLAGS
// Some mobile browsers (or emulation modes) can report unexpected values for
// CSS (hover/pointer) media queries. We set a deterministic class so popovers
// can reliably switch to bottom-sheet on real mobile.
// ============================================================

(function setupInputModeClasses() {
  const root = document.documentElement;
  const mqCoarse = window.matchMedia?.('(hover: none) and (pointer: coarse)');
  const mqPointerCoarse = window.matchMedia?.('(pointer: coarse)');
  const supportsTouch = (() => {
    try {
      return (
        'ontouchstart' in window ||
        (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) ||
        (navigator.msMaxTouchPoints && navigator.msMaxTouchPoints > 0)
      );
    } catch {
      return false;
    }
  })();

  const computeUseSheet = () => {
    // Prefer the standards-based media query when available.
    const coarsePrimary = !!mqCoarse?.matches || !!mqPointerCoarse?.matches;

    // Fallback: if touch-capable *and* in a mobile-sized viewport, behave like mobile.
    // This avoids enabling sheet mode on touch laptops/desktops.
    const touchNarrow = supportsTouch && window.innerWidth <= 860;
    return coarsePrimary || touchNarrow;
  };

  const apply = () => {
    root.classList.toggle('use-popover-sheet', computeUseSheet());
  };

  apply();
  mqCoarse?.addEventListener?.('change', apply);
  mqPointerCoarse?.addEventListener?.('change', apply);
  window.addEventListener('resize', apply, { passive: true });
  window.addEventListener('orientationchange', apply);
})();

const bodyScrollLock = (() => {
  let locks = 0;
  let scrollPosition = 0;

  const isIOSLike = (() => {
    try {
      const ua = String(navigator.userAgent || '');
      const iOS = /iPad|iPhone|iPod/.test(ua);
      const iPadOS = /Macintosh/.test(ua) && !!navigator.maxTouchPoints && navigator.maxTouchPoints > 1;
      return iOS || iPadOS;
    } catch {
      return false;
    }
  })();

  const getEffectiveScrollY = () => {
    try {
      const y = window.pageYOffset;
      if (typeof y === 'number' && y > 0) return y;
    } catch {}

    try {
      const de = document.documentElement;
      const y2 = de ? de.scrollTop : 0;
      if (typeof y2 === 'number' && y2 > 0) return y2;
    } catch {}

    try {
      const y3 = document.body ? document.body.scrollTop : 0;
      if (typeof y3 === 'number' && y3 > 0) return y3;
    } catch {}

    // If the body is currently fixed (no-scroll), window.pageYOffset can read as 0.
    // In that case recover the position from body.style.top (e.g. "-123px").
    try {
      const top = String(document.body?.style?.top || '').trim();
      if (!top) return 0;
      const n = parseInt(top, 10);
      if (!Number.isFinite(n)) return 0;
      return Math.abs(n);
    } catch {
      return 0;
    }
  };

  return {
    lock() {
      locks += 1;
      if (locks === 1) {
        scrollPosition = getEffectiveScrollY();

        // Prefer overflow-based locking on non-iOS: it avoids any visible scroll
        // jump/snap and does not require restoration.
        if (!isIOSLike) {
          try { document.documentElement.classList.add('no-scroll-overflow'); } catch {}
          try { document.body.classList.add('no-scroll-overflow'); } catch {}
          return;
        }

        // iOS/iPadOS: overflow hidden is unreliable; use the fixed-body strategy.
        document.body.style.top = `-${scrollPosition}px`;
        document.body.classList.add('no-scroll');
      }
    },
    unlock(targetScrollY) {
      // If nothing is locked, do NOT run side effects.
      // (Some callers may "unlock" defensively; restoring scroll in that case
      // can incorrectly jump the page to the top.)
      if (locks === 0) return;

      locks = Math.max(0, locks - 1);
      if (locks === 0) {
        // Overflow mode (non-iOS): just remove the lock classes. No scrollTo.
        if (!isIOSLike) {
          try { document.documentElement.classList.remove('no-scroll-overflow'); } catch {}
          try { document.body.classList.remove('no-scroll-overflow'); } catch {}
          return;
        }

        const nextY = typeof targetScrollY === 'number' && Number.isFinite(targetScrollY)
          ? targetScrollY
          : scrollPosition;

        // Critical ordering:
        // 1) Set the *document* scroll position while the body is still fixed.
        //    This avoids a brief snap to 0 when removing position:fixed.
        // 2) Unfix body.
        // 3) Re-apply on next frame to win against any competing scroll.
        try { window.scrollTo(0, nextY); } catch (e) {}

        document.body.classList.remove('no-scroll');
        document.body.style.top = '';

        try {
          requestAnimationFrame(() => {
            try { window.scrollTo(0, nextY); } catch (err) {}
          });
        } catch (e) {}
      }
    },
    forceUnlock() {
      locks = 0;
      try { document.documentElement.classList.remove('no-scroll-overflow'); } catch {}
      try { document.body.classList.remove('no-scroll-overflow'); } catch {}
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

// ============================================================
// I18N HELPERS (loaded via scripts/i18n.js before this file)
// ============================================================
const I18N_STORAGE_KEY = 'badianiUILang.v1';

const getUiLang = () => {
  try {
    const raw = String(localStorage.getItem(I18N_STORAGE_KEY) || '').trim().toLowerCase();
    if (raw === 'it' || raw === 'en' || raw === 'es' || raw === 'fr') return raw;
  } catch {}
  return 'it';
};

const tr = (key, vars, fallback) => {
  try {
    const api = window.BadianiI18n;
    if (api && typeof api.t === 'function') {
      const translated = api.t(key, vars);
      // If the translation is missing (api returns the key), check for EN fallback for sm- quiz questions
      if (translated !== key) return translated;
      
      // Special fallback: use EN for sm-XXX questions when IT doesn't have them
      if (api.getLang() === 'it' && key && key.startsWith('quiz.q.sm-')) {
        const enTable = api.dict?.en || {};
        const enTranslated = enTable[key];
        if (enTranslated != null) return String(enTranslated);
      }
    }
  } catch {}
  if (fallback != null && fallback !== undefined) return String(fallback);
  return String(key || '');
};

// Mostra nickname utente nella barra
window.addEventListener('DOMContentLoaded', function() {
  try {
    const user = window.BadianiProfile?.getActive?.() || null;
    const bar = document.getElementById('user-nickname-bar');
    const nick = document.getElementById('nickname-display');
    if (user && bar && nick) {
      nick.textContent = user.nickname;
      bar.style.display = 'flex';
    }
  } catch {}
});

// Live update nickname bar if profile changes while the app is open.
document.addEventListener('badiani:profile-updated', (e) => {
  try {
    const profile = e?.detail?.profile;
    const bar = document.getElementById('user-nickname-bar');
    const nick = document.getElementById('nickname-display');
    if (!bar || !nick) return;
    if (profile && profile.nickname) {
      nick.textContent = profile.nickname;
      bar.style.display = 'flex';
    }
  } catch {}
});

(function signupGate() {

  // ============================================================
  // PHONE VERIFICATION (device-level)
  // - The real enforcement is server-side on the Worker (for Berny/proxy calls).
  // - This client gate is for UX and blocks the app UI until verified.
  // ============================================================
  const AUTH_TOKEN_KEY = 'badianiAuth.token.v1';
  const AUTH_VERIFIED_AT_KEY = 'badianiAuth.verifiedAt.v1';
  // Beta-only: allow entering the UI without a phone (does NOT grant server-side access).
  // This is intentionally separate from the real token so it won't compromise normal login.
  const AUTH_BETA_SKIP_KEY = 'badianiAuth.betaSkip.v1';

  const getAuthToken = () => {
    try { return String(localStorage.getItem(AUTH_TOKEN_KEY) || '').trim(); } catch { return ''; }
  };

  const decodeTokenPayload = (token) => {
    try {
      const t = String(token || '').trim();
      const part = t.split('.')[0] || '';
      if (!part) return null;
      const b64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
      const json = atob(b64);
      return JSON.parse(json);
    } catch {
      return null;
    }
  };

  const isVerified = () => {
    const token = getAuthToken();
    if (!token) return false;
    const payload = decodeTokenPayload(token);
    const exp = payload?.exp;
    if (typeof exp !== 'number' || !Number.isFinite(exp)) return false;
    return (exp * 1000) > Date.now();
  };

  const isVerifiedOrBeta = () => {
    if (isVerified()) return true;
    try {
      return String(localStorage.getItem(AUTH_BETA_SKIP_KEY) || '') === '1';
    } catch {
      return false;
    }
  };

  const getAuthBase = () => {
    // Prefer explicit endpoint.
    try {
      const explicit = String(window.BADIANI_AUTH_ENDPOINT || '').trim();
      if (explicit) return explicit.replace(/\/+$/g, '');
    } catch {}

    // Derive from proxy endpoint.
    let endpoint = '';
    try {
      const w = (typeof window !== 'undefined') ? window : null;
      endpoint = w ? String(w.BERNY_PROXY_ENDPOINT || w.__BERNY_PROXY_ENDPOINT__ || '').trim() : '';
    } catch {}
    if (!endpoint) {
      try {
        const cfg = JSON.parse(localStorage.getItem('badianiBerny.config.v1') || 'null');
        endpoint = (cfg && typeof cfg === 'object') ? String(cfg.proxyEndpoint || '').trim() : '';
      } catch {}
    }
    if (!endpoint) return '';
    return endpoint.replace(/\/?berny\/?$/i, '').replace(/\/+$/g, '');
  };

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

  const saveUser = (id, nickname, gelato, createdAt = null) => {
    const now = Date.now();
    const profile = { id, nickname: nickname.trim(), gelato: gelato.trim(), createdAt: (typeof createdAt === 'number' ? createdAt : now), updatedAt: now };
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(profile));
    // Keep the profiles list in sync (stability).
    try {
      const profiles = getProfiles();
      const idx = profiles.findIndex((p) => p && p.id === id);
      if (idx >= 0) {
        const prev = profiles[idx] || {};
        profiles[idx] = {
          ...prev,
          ...profile,
          createdAt: (typeof prev.createdAt === 'number' && Number.isFinite(prev.createdAt)) ? prev.createdAt : profile.createdAt,
        };
      } else {
        profiles.push(profile);
      }
      saveProfiles(profiles);
    } catch {}
    try {
      document.dispatchEvent(new CustomEvent('badiani:profile-updated', { detail: { profile } }));
    } catch {}
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
    saveUser(id, nickname, gelato, createdAt);
    // NOTE: Do NOT wipe other profiles' gamification keys.
    // Gamification is stored per profile (badianiGamification.v3:<profileId>) and will be
    // initialized automatically on first load for the new profile.
    return profile;
  };

  const loginWithProfile = (nickname, gelato) => {
    const profiles = getProfiles();
    const found = profiles.find(p => p.nickname.toLowerCase() === nickname.toLowerCase() && p.gelato.toLowerCase() === gelato.toLowerCase());
    if (!found) return null;
    saveUser(found.id, found.nickname, found.gelato, found.createdAt);
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

    const verifiedNow = isVerifiedOrBeta();

    card.innerHTML = `
      <h2 id="signup-title" style="margin:0 0 16px 0; font-size:24px; font-family: var(--font-medium);">Badiani Training</h2>
      <div style="display:flex; gap:12px; margin-bottom:16px;">
        <button type="button" data-tab="verify" class="tab-btn ${verifiedNow ? '' : 'is-active'}" style="flex:1; padding:10px; border-radius:10px; border:2px solid ${verifiedNow ? '#d1d5db' : '#214098'}; background:${verifiedNow ? 'transparent' : '#214098'}; color:${verifiedNow ? '#0f2154' : '#fff'}; font-weight:600; cursor:pointer;">${tr('auth.verify.tab', null, 'Verifica')}</button>
        <button type="button" data-tab="signup" class="tab-btn ${verifiedNow ? 'is-active' : ''}" ${verifiedNow ? '' : 'disabled'} style="flex:1; padding:10px; border-radius:10px; border:2px solid ${verifiedNow ? '#214098' : '#d1d5db'}; background:${verifiedNow ? '#214098' : '#f3f4f6'}; color:${verifiedNow ? '#fff' : '#9ca3af'}; font-weight:600; cursor:${verifiedNow ? 'pointer' : 'not-allowed'};">${tr('profile.gate.signup', null, 'Iscrizione')}</button>
        <button type="button" data-tab="login" class="tab-btn" ${verifiedNow ? '' : 'disabled'} style="flex:1; padding:10px; border-radius:10px; border:2px solid #d1d5db; background:${verifiedNow ? 'transparent' : '#f3f4f6'}; color:${verifiedNow ? '#0f2154' : '#9ca3af'}; font-weight:600; cursor:${verifiedNow ? 'pointer' : 'not-allowed'};">${tr('profile.gate.login', null, 'Accedi')}</button>
      </div>
      <div data-panel="verify" style="display:${verifiedNow ? 'none' : 'block'};">
        <p style="margin:0 0 16px 0; color: var(--brand-gray-soft, #6b7280);">${tr('auth.verify.lede', null, 'Inserisci il tuo numero di cellulare. Se risulti nel registro Badiani, riceverai un codice SMS per sbloccare l\'accesso.')}</p>

        <div style="display:grid; gap:10px;">
          <label style="display:block; font-weight:600; margin-bottom:6px;">${tr('auth.verify.phoneLabel', null, 'Numero di cellulare')}</label>
          <input type="tel" data-input="phone" placeholder="${tr('auth.verify.phonePh', null, 'Es. +39 333 123 4567')}" style="width:100%; padding:12px 14px; border:1px solid #d1d5db; border-radius:10px; font-size:16px;" />

          <button type="button" data-action="send-otp" style="padding:10px 14px; border-radius:10px; background:#214098; color:#fff; border:none; font-weight:600; cursor:pointer;">${tr('auth.verify.sendBtn', null, 'Invia codice SMS')}</button>

          <label style="display:block; font-weight:600; margin:8px 0 6px;">${tr('auth.verify.codeLabel', null, 'Codice (5 cifre)')}</label>
          <input type="text" inputmode="numeric" maxlength="5" data-input="otp" placeholder="${tr('auth.verify.codePh', null, 'Es. 12345')}" style="width:100%; padding:12px 14px; border:1px solid #d1d5db; border-radius:10px; font-size:16px;" />

          <p data-error-verify style="margin:0; color:#b91c1c; display:none; font-size:14px;"></p>
          <p data-info-verify style="margin:0; color:#1f2937; display:none; font-size:14px;"></p>

          <button type="button" data-action="verify-otp" style="padding:10px 14px; border-radius:10px; background:#0f2154; color:#fff; border:none; font-weight:600; cursor:pointer;">${tr('auth.verify.confirmBtn', null, 'Conferma e continua')}</button>

          <div style="border-top:1px solid #d1d5db; padding-top:10px; margin-top:10px;">
            <p style="margin:0 0 10px 0; font-size:12px; color:#666; font-weight:600;">🧪 BETA - Accedi senza verifica:</p>
            <button type="button" data-action="skip-verification" style="width:100%; padding:10px 14px; border-radius:10px; background:#f3f4f6; color:#0f2154; border:1px solid #d1d5db; font-weight:600; cursor:pointer;">${tr('auth.beta.skipBtn', null, 'Continua senza numero (test)')}</button>
          </div>
        </div>
      </div>

      <div data-panel="signup" style="display:${verifiedNow ? 'block' : 'none'};">
        <p style="margin:0 0 16px 0; color: var(--brand-gray-soft, #6b7280);">${tr('profile.gate.signupLead', null, 'Crea un nuovo profilo con il tuo nickname e gusto di gelato preferito.')}</p>
        <form data-form="signup" novalidate>
          <label style="display:block; font-weight:600; margin-bottom:6px;">${tr('profile.gate.nickname', null, 'Nickname')}</label>
          <input type="text" data-input="nickname" name="nickname" placeholder="${tr('profile.gate.nicknamePh', null, 'Es. StellaRosa')}" required style="width:100%; padding:12px 14px; border:1px solid #d1d5db; border-radius:10px; font-size:16px; margin-bottom:14px;" />
          <label style="display:block; font-weight:600; margin-bottom:6px;">${tr('profile.gate.gelatoLabel', null, 'Gusto gelato preferito')}</label>
          <input type="text" data-input="gelato" name="gelato" placeholder="${tr('profile.gate.gelatoPh', null, 'Es. Buontalenti')}" required style="width:100%; padding:12px 14px; border:1px solid #d1d5db; border-radius:10px; font-size:16px; margin-bottom:18px;" />
          <p data-error style="margin:0 0 12px 0; color:#b91c1c; display:none; font-size:14px;"></p>
          <button type="submit" style="padding:10px 14px; border-radius:10px; background:#214098; color:#fff; border:none; font-weight:600; cursor:pointer;">${tr('profile.gate.signupBtn', null, 'Iscriviti')}</button>
        </form>
      </div>
      <div data-panel="login" style="display:none;">
        <p style="margin:0 0 16px 0; color: var(--brand-gray-soft, #6b7280);">${tr('profile.gate.loginLead', null, 'Accedi con il tuo nickname e gusto di gelato.')}</p>
        <form data-form="login" novalidate>
          <label style="display:block; font-weight:600; margin-bottom:6px;">${tr('profile.gate.nickname', null, 'Nickname')}</label>
          <input type="text" data-input="nickname" name="nickname" placeholder="${tr('profile.gate.nicknamePh', null, 'Es. StellaRosa')}" required style="width:100%; padding:12px 14px; border:1px solid #d1d5db; border-radius:10px; font-size:16px; margin-bottom:14px;" />
          <label style="display:block; font-weight:600; margin-bottom:6px;">${tr('profile.gate.gelatoLabel', null, 'Gusto gelato preferito')}</label>
          <input type="text" data-input="gelato" name="gelato" placeholder="${tr('profile.gate.gelatoPh', null, 'Es. Buontalenti')}" required style="width:100%; padding:12px 14px; border:1px solid #d1d5db; border-radius:10px; font-size:16px; margin-bottom:18px;" />
          <p data-error style="margin:0 0 12px 0; color:#b91c1c; display:none; font-size:14px;"></p>
          <button type="submit" style="padding:10px 14px; border-radius:10px; background:#214098; color:#fff; border:none; font-weight:600; cursor:pointer;">${tr('profile.gate.loginBtn', null, 'Accedi')}</button>
        </form>
      </div>
      <p style="margin-top:12px; font-size:12px; color:var(--brand-gray-soft, #6b7280);">${tr('profile.gate.deviceNote', null, 'I dati sono salvati solo su questo dispositivo.')}</p>
    `;

    const tabBtns = Array.from(card.querySelectorAll('[data-tab]'));
    const panels = Array.from(card.querySelectorAll('[data-panel]'));
    const signupForm = card.querySelector('[data-form="signup"]');
    const loginForm = card.querySelector('[data-form="login"]');

    const verifyPanel = card.querySelector('[data-panel="verify"]');
    const phoneInput = verifyPanel?.querySelector('[data-input="phone"]');
    const otpInput = verifyPanel?.querySelector('[data-input="otp"]');
    const sendOtpBtn = verifyPanel?.querySelector('[data-action="send-otp"]');
    const verifyOtpBtn = verifyPanel?.querySelector('[data-action="verify-otp"]');
    const verifyErr = verifyPanel?.querySelector('[data-error-verify]');
    const verifyInfo = verifyPanel?.querySelector('[data-info-verify]');

    const setVerifyMessage = (kind, text) => {
      if (verifyErr) verifyErr.style.display = 'none';
      if (verifyInfo) verifyInfo.style.display = 'none';
      const el = kind === 'error' ? verifyErr : verifyInfo;
      if (!el) return;
      el.textContent = String(text || '');
      el.style.display = 'block';
    };

    const updateTabsEnabled = () => {
      const ok = isVerifiedOrBeta();
      tabBtns.forEach((btn) => {
        if (!btn?.dataset?.tab) return;
        if (btn.dataset.tab === 'verify') return;
        btn.disabled = !ok;
        if (!ok) {
          btn.style.cursor = 'not-allowed';
          btn.style.color = '#9ca3af';
          btn.style.background = '#f3f4f6';
          btn.style.borderColor = '#d1d5db';
        }
      });
    };

    const switchTab = (targetTab) => {
      if (targetTab !== 'verify' && !isVerifiedOrBeta()) {
        setVerifyMessage('error', tr('auth.verify.required', null, 'Prima devi verificare il numero di telefono.'));
        targetTab = 'verify';
      }
      tabBtns.forEach(btn => {
        const isActive = btn.dataset.tab === targetTab;
        btn.classList.toggle('is-active', isActive);
        btn.style.cssText = isActive ? 'flex:1; padding:10px; border-radius:10px; border:2px solid #214098; background:#214098; color:#fff; font-weight:600; cursor:pointer;' : 'flex:1; padding:10px; border-radius:10px; border:2px solid #d1d5db; background:transparent; color:#0f2154; font-weight:600; cursor:pointer;';
      });
      panels.forEach(p => {
        p.style.display = (p.dataset.panel === targetTab) ? 'block' : 'none';
      });

      if (targetTab === 'verify') {
        phoneInput?.focus?.({ preventScroll: true });
        return;
      }

      const focusInput = card.querySelector(`[data-form="${targetTab}"] [data-input="nickname"]`);
      if (focusInput) focusInput.focus({ preventScroll: true });
    };

    tabBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        switchTab(btn.dataset.tab);
      });
    });

    // Verification handlers
    if (phoneInput) {
      phoneInput.addEventListener('input', () => {
        if (verifyErr) verifyErr.style.display = 'none';
        if (verifyInfo) verifyInfo.style.display = 'none';
      });
    }
    if (otpInput) {
      otpInput.addEventListener('input', () => {
        if (verifyErr) verifyErr.style.display = 'none';
        if (verifyInfo) verifyInfo.style.display = 'none';
      });
    }

    const requestOtp = async () => {
      const base = getAuthBase();
      if (!base) {
        setVerifyMessage('error', 'Config mancante: endpoint di verifica non disponibile.');
        return;
      }
      const phone = String(phoneInput?.value || '').trim();
      if (phone.length < 8) {
        setVerifyMessage('error', tr('auth.verify.phoneInvalid', null, 'Inserisci un numero valido.'));
        return;
      }
      if (sendOtpBtn) sendOtpBtn.disabled = true;
      try {
        const r = await fetch(`${base}/auth/request`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ phone }),
        });
        if (r.status === 404) {
          setVerifyMessage('error', tr('auth.verify.notInRegistry', null, 'Numero non trovato nel registro Badiani.'));
          return;
        }
        if (!r.ok) {
          const t = await r.text().catch(() => '');
          setVerifyMessage('error', `Errore verifica (${r.status}): ${t}`);
          return;
        }
        setVerifyMessage('info', tr('auth.verify.sent', null, 'Codice inviato via SMS. Inseriscilo qui sotto.'));
        otpInput?.focus?.({ preventScroll: true });
      } catch (e) {
        setVerifyMessage('error', `Errore rete: ${String(e?.message || e)}`);
      } finally {
        if (sendOtpBtn) sendOtpBtn.disabled = false;
      }
    };

    const confirmOtp = async () => {
      const base = getAuthBase();
      if (!base) {
        setVerifyMessage('error', 'Config mancante: endpoint di verifica non disponibile.');
        return;
      }
      const phone = String(phoneInput?.value || '').trim();
      const code = String(otpInput?.value || '').trim();
      if (code.length !== 5) {
        setVerifyMessage('error', tr('auth.verify.codeInvalid', null, 'Inserisci un codice di 5 cifre.'));
        return;
      }

      if (verifyOtpBtn) verifyOtpBtn.disabled = true;
      try {
        const r = await fetch(`${base}/auth/verify`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ phone, code }),
        });
        if (r.status === 401) {
          setVerifyMessage('error', tr('auth.verify.wrong', null, 'Codice non valido o scaduto.'));
          return;
        }
        if (r.status === 404) {
          setVerifyMessage('error', tr('auth.verify.notInRegistry', null, 'Numero non trovato nel registro Badiani.'));
          return;
        }
        if (!r.ok) {
          const t = await r.text().catch(() => '');
          setVerifyMessage('error', `Errore verifica (${r.status}): ${t}`);
          return;
        }
        const data = await r.json().catch(() => null);
        const token = String(data?.token || '').trim();
        if (!token) {
          setVerifyMessage('error', 'Risposta inattesa dal server (token mancante).');
          return;
        }
        localStorage.setItem(AUTH_TOKEN_KEY, token);
        localStorage.setItem(AUTH_VERIFIED_AT_KEY, String(Date.now()));
        // If user later completes real verification, remove beta bypass.
        try { localStorage.removeItem(AUTH_BETA_SKIP_KEY); } catch {}
        setVerifyMessage('info', tr('auth.verify.ok', null, 'Verifica completata. Ora puoi accedere.'));

        updateTabsEnabled();
        switchTab('signup');
      } catch (e) {
        setVerifyMessage('error', `Errore rete: ${String(e?.message || e)}`);
      } finally {
        if (verifyOtpBtn) verifyOtpBtn.disabled = false;
      }
    };

    if (sendOtpBtn) sendOtpBtn.addEventListener('click', (e) => { e.preventDefault(); requestOtp(); });
    if (verifyOtpBtn) verifyOtpBtn.addEventListener('click', (e) => { e.preventDefault(); confirmOtp(); });

    // Beta: Skip verification (bypass phone verification for testing)
    const skipVerificationBtn = verifyPanel?.querySelector('[data-action="skip-verification"]');
    if (skipVerificationBtn) {
      skipVerificationBtn.addEventListener('click', (e) => {
        e.preventDefault();
        // Mark as verified in beta mode (UI-only; does not create a real auth token)
        try { localStorage.setItem(AUTH_BETA_SKIP_KEY, '1'); } catch {}
        try { localStorage.setItem(AUTH_VERIFIED_AT_KEY, String(Date.now())); } catch {}
        setVerifyMessage('info', tr('auth.beta.enabled', null, '✓ Modalità beta attivata. Procedi con la creazione del profilo.'));
        updateTabsEnabled();
        switchTab('signup');
      });
    }

    if (signupForm) {
      const submitBtn = signupForm.querySelector('button[type="submit"]');
      const error = signupForm.querySelector('[data-error]');
      const inputs = signupForm.querySelectorAll('input');
      
      // Nascondi errori quando l'utente inizia a digitare
      inputs.forEach(input => {
        input.addEventListener('input', () => {
          if (error) error.style.display = 'none';
        });
      });
      
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
            error.textContent = tr('profile.err.fillBothMin2', null, 'Compila entrambi i campi (minimo 2 caratteri).');
          }
          return;
        }
        const result = createNewProfile(nickname, gelato);
        console.log('createNewProfile result:', result);
        if (!result) {
          if (error) {
            error.style.display = 'block';
            error.textContent = tr('profile.err.nicknameTaken', null, 'Questo nickname � gi� in uso. Scegline un altro.');
          }
          return;
        }
        console.log('User created successfully, reloading...');
        // Chiudi overlay prima del reload per evitare problemi
        overlay.remove();
        bodyScrollLock.unlock();
        // Breve delay per permettere la chiusura dell'overlay
        setTimeout(() => {
          try { window.location.reload(); } catch {}
        }, 50);
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
      const error = loginForm.querySelector('[data-error]');
      const inputs = loginForm.querySelectorAll('input');
      
      // Nascondi errori quando l'utente inizia a digitare
      inputs.forEach(input => {
        input.addEventListener('input', () => {
          if (error) error.style.display = 'none';
        });
      });
      
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
            error.textContent = tr('profile.err.fillBoth', null, 'Compila entrambi i campi.');
          }
          return;
        }
        const result = loginWithProfile(nickname, gelato);
        console.log('loginWithProfile result:', result);
        if (!result) {
          if (error) {
            error.style.display = 'block';
            error.textContent = tr('profile.err.notFound', null, 'Profilo non trovato. Controlla nickname e gusto.');
          }
          return;
        }
        console.log('Login successful, reloading...');
        // Chiudi overlay prima del reload per evitare problemi
        overlay.remove();
        bodyScrollLock.unlock();
        // Breve delay per permettere la chiusura dell'overlay
        setTimeout(() => {
          try { window.location.reload(); } catch {}
        }, 50);
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

    updateTabsEnabled();
    if (!isVerifiedOrBeta()) {
      switchTab('verify');
    } else {
      signupForm?.querySelector?.('[data-input="nickname"]')?.focus?.({ preventScroll: true });
    }
  };

  const init = () => {
    const user = getUser();
    const verified = isVerifiedOrBeta();
    if (!verified || !user) {
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
// This keeps the menu search results aligned with "nuove schede" without hardcoding.
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
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '') || '';
  };

  const load = () => {
    try {
      const parsed = window.BadianiStorage?.getJSON
        ? window.BadianiStorage.getJSON(KEY, null)
        : (function() {
            const raw = localStorage.getItem(KEY);
            if (!raw) return null;
            return JSON.parse(raw);
          })();
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
      if (window.BadianiStorage?.setJSON) {
        window.BadianiStorage.setJSON(KEY, catalog);
        return;
      }
      localStorage.setItem(KEY, JSON.stringify(catalog));
    } catch {
      /* ignore */
    }
  };

  const hydrate = () => {
    const pageKey = getPageKey();
    if (!pageKey || /^(index|index_new)\.html$/i.test(pageKey)) return;

    // Ensure stable ids for deep-linking (and catalog cardKey stability)
    // If a card has no id, we generate id="card-<slug>" based on its title.
    try {
      Array.from(document.querySelectorAll('.guide-card')).forEach((card) => {
        if (!card) return;
        const existing = String(card.getAttribute('id') || '').trim();
        if (existing) return;
        const titleEl = card.querySelector('h3');
        const title = titleEl?.textContent?.trim() || '';
        if (!title) return;
        const key = slugify(title);
        if (!key) return;
        card.setAttribute('id', `card-${key}`);
      });
    } catch {
      /* ignore */
    }

    const category = document.querySelector('h1')?.textContent?.trim()
      || document.title?.split('')[0]?.trim()
      || pageKey.replace(/\.html$/i, '');

    const cards = Array.from(document.querySelectorAll('.guide-card'))
      .map((card) => {
        const titleEl = card?.querySelector?.('h3') || null;
        const title = titleEl?.textContent?.trim() || '';
        if (!title) return null;

        // Prefer a stable key derived from the card id (e.g. id="card-waffles" => "waffles").
        // This keeps deep-links stable even if titles are translated.
        let cardKey = '';
        try {
          const rawId = String(card?.getAttribute?.('id') || '').trim().toLowerCase();
          if (rawId.startsWith('card-') && rawId.length > 5) {
            cardKey = rawId.slice(5);
          }
        } catch {
          cardKey = '';
        }
        if (!cardKey) cardKey = slugify(title);
        if (!cardKey) return null;

        const titleKey = titleEl?.getAttribute?.('data-i18n') || '';

        // Lightweight keyword indexing: allow searching by intent words even when
        // they appear only inside tags/details (e.g. "Upselling", "Sicurezza", "Chiusura").
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

        return { title, cardKey, titleKey, signals };
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
  const searchRoot = drawer?.querySelector('.menu-search');
  const COMPLETION_KEY_PREFIX = 'badianiCategoryCompletion.v1';
  const GAMIFICATION_KEY_PREFIX = 'badianiGamification.v3';
  const moodKeys = ['mood.1', 'mood.2', 'mood.3', 'mood.4', 'mood.5', 'mood.6'];
  let lastMoodKey = '';
  let assistantNodes = null;
  let lastAssistantQuery = '';
  let typingToken = 0;
  let typingTimer = 0;
  let avatarInputTimer = 0;
  const KB_LANGS = ['it', 'en', 'es', 'fr'];
  const kbLoadPromises = new Map();
  const kbIndexByLang = new Map();
  
  if (!drawer) return;

  // Listen for language changes and reload KB
  document.addEventListener('badiani:lang-changed', async (e) => {
    const newLang = e.detail?.lang || 'it';
    console.log(`[Assistant] Language changed to ${newLang}, reloading KB...`);
    
    // Clear existing KB cache for all languages to force reload
    kbLoadPromises.clear();
    kbIndexByLang.clear();
    
    // Preload KB for new language
    try {
      await loadKB(newLang);
      console.log(`[Assistant] KB loaded for ${newLang}`);
    } catch (err) {
      console.error(`[Assistant] Failed to load KB for ${newLang}:`, err);
    }
  });

  const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, Math.max(0, Number(ms) || 0)));

  const stopAssistantTyping = () => {
    typingToken += 1;
    if (typingTimer) {
      window.clearTimeout(typingTimer);
      typingTimer = 0;
    }
  };

  const tokenize = (text) => {
    const raw = normalize(text)
      .replace(/[^a-z0-9������\s]+/gi, ' ')
      .split(/\s+/)
      .filter(Boolean);
    const stop = new Set([
      'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'una', 'uno', 'di', 'del', 'della', 'dei', 'delle', 'da', 'in', 'su',
      'per', 'con', 'senza', 'e', 'o', 'ma', 'che', 'chi', 'cosa', 'come', 'quanto', 'quale', 'quali', 'quando', 'dove',
      'mi', 'ti', 'si', 'no', 'ok', 'poi', 'nel', 'nella', 'nei', 'nelle', 'al', 'allo', 'alla', 'agli', 'alle',
    ]);
    return raw.filter((t) => t.length >= 3 && !stop.has(t));
  };

  const KB_SOURCES = [
    { id: 'gelato', file: 'gelato.txt', defaultHref: 'gelato-lab.html?center=1' },
    { id: 'sweet', file: 'sweet-treats.txt', defaultHref: 'sweet-treats.html?center=1' },
    { id: 'festive', file: 'churros-christmas.txt', defaultHref: 'festive.html?center=1' },
    { id: 'pastries', file: 'pastries.txt', defaultHref: 'pastries.html?center=1' },
    { id: 'slitti', file: 'slitti-yoyo.txt', defaultHref: 'slitti-yoyo.html?center=1' },
    { id: 'freshdrinks', file: 'drinks.txt', defaultHref: 'caffe.html?center=1' },
    { id: 'caffe', file: 'caffe.txt', defaultHref: 'caffe.html?center=1' },
  ];

  const detectKbLanguage = (text) => {
    // ALWAYS use UI language selection instead of auto-detecting from query text.
    // This ensures the assistant responds ONLY in the selected language.
    const selectedLang = getUiLang();
    return KB_LANGS.includes(selectedLang) ? selectedLang : 'it';
  };

  const loadKB = async (lang = getUiLang()) => {
    const safeLang = KB_LANGS.includes(lang) ? lang : 'it';
    if (kbLoadPromises.has(safeLang)) return kbLoadPromises.get(safeLang);
    const promise = (async () => {
      const chunks = [];
      await Promise.all(KB_SOURCES.map(async (src) => {
        const path = `notes/kb/${safeLang}/${src.file}`;
        try {
          const res = await fetch(encodeURI(path), { cache: 'no-store' });
          if (!res || !res.ok) return;
          const txt = await res.text();
          if (!txt || txt.length < 50) return;
          const parts = String(txt)
            .replace(/\r/g, '')
            .split(/\n{2,}/g)
            .map((p) => p.trim())
            .filter((p) => p.length >= 80);
          parts.forEach((p) => {
            chunks.push({
              sourceId: src.id,
              defaultHref: src.defaultHref,
              text: p,
              tokens: tokenize(p),
            });
          });
        } catch {
          /* ignore */
        }
      }));

      const index = chunks.map((c) => {
        const freq = Object.create(null);
        c.tokens.forEach((t) => { freq[t] = (freq[t] || 0) + 1; });
        return { ...c, freq };
      });
      kbIndexByLang.set(safeLang, index);
      return index;
    })();
    kbLoadPromises.set(safeLang, promise);
    return promise;
  };

  const pickDefaultCtaHref = (query) => {
    const q = normalize(query);
    if (!q) return '';
    if (/(cono|coni|coppett|vetrina|scampol|treat\s*freezer|gelato\s*box|vaschett|porzion)/i.test(q)) {
      return 'gelato-lab.html?center=1';
    }
    if (/(waffl|crepe|cr[eè]p|pancak|porridge|gelato\s*burger|croissant)/i.test(q)) {
      return 'sweet-treats.html?center=1';
    }
    if (/(churros|vin\s*brul|mulled|panettone|festive)/i.test(q)) {
      return 'festive.html?center=1';
    }
    if (/(cappucc|flat\s*white|americano|latte|schium|espresso|mocha|chai|tea|cioccolat|iced)/i.test(q)) {
      return 'caffe.html?center=1';
    }
    if (/(apertura|chiusura|closing|setup|packaging|sicurezza|allergen|gluten)/i.test(q)) {
      return 'operations.html?center=1';
    }
    return '';
  };

  const kbRetrieve = async (query) => {
    const qTokens = tokenize(query);
    if (!qTokens.length) return null;
    const lang = detectKbLanguage(query);
    let kbIndex = await loadKB(lang);
    if (!Array.isArray(kbIndex) || !kbIndex.length) {
      kbIndex = await loadKB('it');
    }
    if (!Array.isArray(kbIndex) || !kbIndex.length) return null;

    let best = null;
    let bestScore = 0;
    kbIndex.forEach((chunk) => {
      let score = 0;
      qTokens.forEach((t) => {
        if (chunk.freq[t]) score += 2 + Math.min(3, chunk.freq[t]);
      });
      // Small boost for very domain-specific keywords
      if (/\b(grammi|ml|temperatura|minuti|conservazione|chiusura|apertura)\b/i.test(chunk.text)) score += 1;
      if (score > bestScore) {
        bestScore = score;
        best = chunk;
      }
    });
    if (!best || bestScore < 8) return null;
    return { ...best, score: bestScore };
  };

  const summarizeSnippet = (text, maxLen = 220) => {
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    if (!t) return '';
    if (t.length <= maxLen) return t;
    const cut = t.slice(0, maxLen);
    const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; '), cut.lastIndexOf(': '));
    return (lastStop > 80 ? cut.slice(0, lastStop + 1) : cut).trim() + '…';
  };

  // Slitti: compute "tavolette/barre" variants by reading the Slitti page.
  // This avoids hardcoding counts and stays aligned to the actual training file.
  let slittiTavoletteInfoPromise = null;
  const getSlittiTavoletteInfo = async () => {
    if (slittiTavoletteInfoPromise) return slittiTavoletteInfoPromise;
    slittiTavoletteInfoPromise = (async () => {
      try {
        const res = await fetch('slitti-yoyo.html', { cache: 'no-store' });
        if (!res || !res.ok) return null;
        const html = await res.text();
        if (!html) return null;
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const cards = Array.from(doc.querySelectorAll('.guide-card'));
        const pick = (card) => {
          const tagText = (card.querySelector('.tag-row')?.textContent || '').toLowerCase();
          const title = (card.querySelector('h3')?.textContent || '').toLowerCase();
          return tagText.includes('tavolette') || title.includes('tavolette');
        };
        const card = cards.find(pick);
        if (!card) return null;

        const text = (card.textContent || '').toLowerCase();
        const percSet = new Set();
        for (const m of text.matchAll(/(\d{2,3})\s*%/g)) {
          const n = Number(m[1]);
          if (Number.isFinite(n) && n > 0 && n <= 100) percSet.add(n);
        }
        const perc = Array.from(percSet).sort((a, b) => a - b);
        const labels = perc.map((p) => `${p}%`);
        const hasCaffeLatte = /caff[eè]\s*latte/.test(text);
        if (hasCaffeLatte) labels.push('Caffè Latte');

        return {
          count: labels.length,
          labels,
          cardKey: 'tavolette-lattenero-gran-cacao',
        };
      } catch {
        return null;
      }
    })();
    return slittiTavoletteInfoPromise;
  };

  const pickMoodKey = () => {
    if (!moodKeys.length) return '';
    let next = moodKeys[Math.floor(Math.random() * moodKeys.length)];
    if (moodKeys.length > 1 && next === lastMoodKey) {
      next = moodKeys[(Math.floor(Math.random() * (moodKeys.length - 1)) + 1) % moodKeys.length];
    }
    lastMoodKey = next;
    return next;
  };

  const applyMoodLine = (key) => {
    if (!moodLine) return;
    const k = String(key || moodLine.dataset.moodKey || 'mood.2');
    moodLine.dataset.moodKey = k;
    moodLine.textContent = tr(k, null, moodLine.textContent || '');
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
      const p = window.BadianiProfile?.getActive?.();
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
      // Totals must match the number of rewardable cards per page (data-carousel-item).
      // NOTE: story-orbit uses pseudo-cards (steps) and has no carousel items.
      'operations': 11,
      'caffe': 29,
      'sweet-treats': 14,
      'pastries': 10,
      'slitti-yoyo': 11,
      'gelato-lab': 10,
      'festive': 12,
      'story-orbit': 5,
    };
    const fileBySlug = {
      'operations': 'operations.html',
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
          // Use a real star glyph (avoid '?' placeholders).
          star.textContent = '\u2605';
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
    // Operations & Setup (non-product modules)
    { name: 'routine apertura apertura checklist', label: 'Routine apertura', category: 'Operations & Setup', categoryHref: 'operations.html', card: 'routine-apertura', description: 'Checklist apertura' },
    { name: 'set-up giornaliero setup daily', label: 'Set-up giornaliero', category: 'Operations & Setup', categoryHref: 'operations.html', card: 'set-up-giornaliero', description: 'Setup giorno' },
    { name: 'servizio caldo pandoro piastra 10 secondi', label: 'Servizio Caldo (Pandoro)', category: 'Operations & Setup', categoryHref: 'operations.html', card: 'servizio-caldo-pandoro', description: 'Warm slice' },
    { name: 'packaging take away treat box delivery', label: 'Packaging take away', category: 'Operations & Setup', categoryHref: 'operations.html', card: 'packaging-take-away', description: 'Delivery' },
    { name: 'allestimento macchina Vin Brulé setup 600 ml acqua', label: 'Allestimento macchina', category: 'Operations & Setup', categoryHref: 'operations.html', card: 'allestimento-macchina', description: 'Vin Brulé setup' },
    { name: 'service chiusura Vin Brulé pulizia shelf life', label: 'Service & chiusura', category: 'Operations & Setup', categoryHref: 'operations.html', card: 'service-chiusura', description: 'Fine turno' },
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
    { name: 'praline dragee cioccolato', label: 'Praline & Dragéee', category: 'Slitti & Yo-Yo', categoryHref: 'slitti-yoyo.html', card: 'praline-drag-e', description: 'Praline' },
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
    { name: 'mulled wine Vin Brulé natale caldo', label: 'Mulled Wine', category: 'Festive & Churros', categoryHref: 'festive.html', tab: 'mulled', description: 'Vin Brulé' },
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

  const ensureAssistantUI = () => {
    if (!searchRoot) return null;
    const existing = searchRoot.querySelector('[data-menu-assistant]');
    if (existing) {
      return {
        root: existing,
        avatar: existing.querySelector('[data-menu-assistant-avatar]'),
        message: existing.querySelector('[data-menu-assistant-message]'),
        actions: existing.querySelector('[data-menu-assistant-actions]'),
        examples: existing.querySelector('[data-menu-assistant-examples]'),
        clear: existing.querySelector('[data-menu-assistant-clear]'),
      };
    }

    const box = document.createElement('div');
    box.className = 'menu-search__assistant';
    box.setAttribute('data-menu-assistant', '');
    box.setAttribute('role', 'status');
    box.setAttribute('aria-live', 'polite');
    box.hidden = false;

    const avatar = document.createElement('div');
    avatar.className = 'menu-search__assistant-avatar';
    avatar.setAttribute('data-menu-assistant-avatar', '');
    avatar.setAttribute('aria-hidden', 'true');
    // Use sprite avatar if available (same asset as the Hub profile).
    // Falls back to SVG on any unexpected errors.
    try {
      const spr = document.createElement('div');
      spr.className = 'avatar-sprite avatar-sprite--assistant';
      spr.setAttribute('data-avatar-sprite', '');
      spr.setAttribute('data-avatar-src', 'assets/avatars/berny-sprite.png?v=20251228');
      spr.setAttribute('data-avatar-cols', '6');
      spr.setAttribute('data-avatar-rows', '4');
      spr.setAttribute('data-avatar-fps', '6');
      spr.setAttribute('data-avatar-total', '24');
      avatar.replaceChildren(spr);
      window.BadianiAvatarSprites?.init?.();
    } catch {
      // Keep legacy SVG avatar (no external assets).
      avatar.innerHTML = `
        <svg class="gelatiere-svg" viewBox="0 0 96 120" width="56" height="70" role="img" aria-label="Assistente BERNY" focusable="false">
          <defs>
            <linearGradient id="skinGrad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stop-color="#FFE7D0"/>
              <stop offset="1" stop-color="#FFD0B0"/>
            </linearGradient>
            <linearGradient id="apronGrad" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0" stop-color="#2A54C4"/>
              <stop offset="1" stop-color="#173A8A"/>
            </linearGradient>
            <linearGradient id="hairGrad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stop-color="#6B4A2A"/>
              <stop offset="1" stop-color="#3B2412"/>
            </linearGradient>
            <radialGradient id="eyeIris" cx="50%" cy="50%" r="50%">
              <stop offset="0" stop-color="#6EC6FF"/>
              <stop offset="1" stop-color="#214098"/>
            </radialGradient>
            <radialGradient id="blushGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0" stop-color="rgba(255,150,180,0.55)"/>
              <stop offset="1" stop-color="rgba(255,150,180,0)"/>
            </radialGradient>
            <radialGradient id="shadowGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0" stop-color="rgba(15,33,84,0.22)"/>
              <stop offset="1" stop-color="rgba(15,33,84,0)"/>
            </radialGradient>
          </defs>
          <ellipse cx="48" cy="115" rx="24" ry="6" fill="url(#shadowGrad)"/>
          <g class="gelatiere-svg__body">
            <rect x="35" y="86" width="11" height="24" rx="5.5" fill="#1a1f35"/>
            <rect x="50" y="86" width="11" height="24" rx="5.5" fill="#0f1426"/>
            <path d="M26 50c0-12 10-20 22-20s22 8 22 20v30c0 3-2 6-5 6H31c-3 0-5-3-5-6V50z" fill="#FFFFFF" stroke="rgba(33,64,152,0.08)"/>
            <path d="M32 56c0-5 5-10 9-10h14c4 0 9 5 9 10v24c0 2-2 4-4 4H36c-2 0-4-2-4-4V56z" fill="url(#apronGrad)"/>
            <rect x="40" y="66" width="16" height="12" rx="6" fill="rgba(255,255,255,0.2)"/>
            <circle cx="48" cy="72" r="1.5" fill="rgba(255,255,255,0.3)"/>
            <path class="gelatiere-arm-l" d="M26 54c-5 3-9 10-9 16 0 4 2 8 3 10" fill="none" stroke="url(#skinGrad)" stroke-width="7" stroke-linecap="round"/>
            <path class="gelatiere-arm-r" d="M70 54c5 3 9 10 9 16 0 4-2 8-3 10" fill="none" stroke="url(#skinGrad)" stroke-width="7" stroke-linecap="round"/>
            <g class="gelatiere-cone" transform="translate(74, 74) rotate(18)">
              <path d="M-1 0l5 12 5-12z" fill="#E8A842" stroke="#C78F35" stroke-width="0.5"/>
              <ellipse cx="4" cy="-1" rx="4.5" ry="4" fill="#FF6BA8"/>
              <ellipse cx="4" cy="-1" rx="3" ry="2.5" fill="#FF8FBF" opacity="0.6"/>
              <circle cx="5.5" cy="-2" r="1" fill="rgba(255,255,255,0.7)"/>
            </g>
          </g>
          <g class="gelatiere-svg__head">
            <path d="M28 22c0-14 8-22 20-22s20 8 20 22c0 4-2 8-4 10-2-3-4-6-8-6-3 0-5 2-8 2s-5-2-8-2c-4 0-6 3-8 6-2-2-4-6-4-10z" fill="url(#hairGrad)"/>
            <path d="M38 10c2-4 6-6 10-6s8 2 10 6" fill="url(#hairGrad)" opacity="0.7"/>
            <ellipse cx="48" cy="30" rx="20" ry="22" fill="url(#skinGrad)"/>
            <rect x="43" y="48" width="10" height="6" rx="5" fill="url(#skinGrad)"/>
            <ellipse class="gelatiere-blush" cx="35" cy="36" rx="6" ry="4" fill="url(#blushGrad)"/>
            <ellipse class="gelatiere-blush" cx="61" cy="36" rx="6" ry="4" fill="url(#blushGrad)"/>
            <g class="gelatiere-svg__eyes">
              <g class="gelatiere-eye-group-l">
                <ellipse cx="40" cy="30" rx="7" ry="8" fill="#0A1942"/>
                <ellipse class="gelatiere-pupil" cx="40" cy="32" rx="4.5" ry="5.5" fill="url(#eyeIris)"/>
                <ellipse cx="40" cy="30" rx="2.5" ry="3" fill="#fff" opacity="0.7"/>
                <ellipse cx="38" cy="28" rx="1.2" ry="1.5" fill="#fff" opacity="0.9"/>
                <ellipse cx="42" cy="33" rx="0.8" ry="1.2" fill="#fff" opacity="0.5"/>
              </g>
              <g class="gelatiere-eye-group-r">
                <ellipse cx="56" cy="30" rx="7" ry="8" fill="#0A1942"/>
                <ellipse class="gelatiere-pupil" cx="56" cy="32" rx="4.5" ry="5.5" fill="url(#eyeIris)"/>
                <ellipse cx="56" cy="30" rx="2.5" ry="3" fill="#fff" opacity="0.7"/>
                <ellipse cx="54" cy="28" rx="1.2" ry="1.5" fill="#fff" opacity="0.9"/>
                <ellipse cx="58" cy="33" rx="0.8" ry="1.2" fill="#fff" opacity="0.5"/>
              </g>
              <path class="gelatiere-blink" d="M34 30c0-4 2.5-7 6-7s6 3 6 7" fill="url(#skinGrad)" opacity="0" stroke="#3B2412" stroke-width="0.5"/>
              <path class="gelatiere-blink" d="M50 30c0-4 2.5-7 6-7s6 3 6 7" fill="url(#skinGrad)" opacity="0" stroke="#3B2412" stroke-width="0.5"/>
            </g>
            <path class="gelatiere-brow-l" d="M35 23c2-2 5-2 7 0" fill="none" stroke="#3B2412" stroke-width="2" stroke-linecap="round"/>
            <path class="gelatiere-brow-r" d="M54 23c2-2 5-2 7 0" fill="none" stroke="#3B2412" stroke-width="2" stroke-linecap="round"/>
            <path d="M48 36c0 2-1 3-1 4" fill="none" stroke="rgba(15,33,84,0.15)" stroke-width="1.5" stroke-linecap="round"/>
            <circle cx="47" cy="40" r="0.8" fill="rgba(255,150,180,0.3)"/>
            <path class="gelatiere-mouth" d="M42 42c2 4 4 6 6 6s4-2 6-6" fill="none" stroke="#3B2412" stroke-width="2.2" stroke-linecap="round"/>
            <ellipse class="gelatiere-mouth--talk" cx="48" cy="46" rx="5" ry="2.5" fill="#FFB8C8" stroke="#3B2412" stroke-width="1.2" opacity="0"/>
            <path d="M32 18c3-4 6-6 9-6 2 0 3 2 3 4" fill="url(#hairGrad)" opacity="0.8"/>
            <path d="M64 18c-3-4-6-6-9-6-2 0-3 2-3 4" fill="url(#hairGrad)" opacity="0.8"/>
            <path d="M45 14c1-3 2-5 3-5s2 2 3 5" fill="url(#hairGrad)" opacity="0.8"/>
            <ellipse cx="48" cy="12" rx="19" ry="6" fill="#FFFFFF" stroke="rgba(33,64,152,0.12)"/>
            <rect x="29" y="10" width="38" height="7" rx="3.5" fill="#FFFFFF" stroke="rgba(33,64,152,0.1)"/>
            <ellipse cx="48" cy="13.5" rx="15" ry="2" fill="rgba(42,84,196,0.08)"/>
          </g>
          <g class="gelatiere-sparkles">
            <g class="gelatiere-sparkle" transform="translate(16, 28)">
              <circle r="1.5" fill="#FFD700"/>
              <path d="M-3 0h6M0-3v6" stroke="#FFF4A3" stroke-width="1" stroke-linecap="round"/>
            </g>
            <g class="gelatiere-sparkle" transform="translate(78, 18)">
              <circle r="1.2" fill="#FFD700"/>
              <path d="M-2.5 0h5M0-2.5v5" stroke="#FFF4A3" stroke-width="0.8" stroke-linecap="round"/>
            </g>
            <g class="gelatiere-sparkle" transform="translate(22, 50)">
              <circle r="1" fill="#FFE4B3"/>
              <path d="M-2 0h4M0-2v4" stroke="#FFF4A3" stroke-width="0.6" stroke-linecap="round"/>
            </g>
          </g>
        </svg>
      `;
    }

    const header = document.createElement('div');
    header.className = 'menu-search__assistant-header';
    header.innerHTML = `
      <p class="menu-search__assistant-title" data-i18n="assistant.title">BERNY</p>
      <button class="menu-search__assistant-clear" type="button" data-menu-assistant-clear aria-label="Pulisci" data-i18n-attr="aria-label:assistant.clearAria">&times;</button>
    `;

    const msg = document.createElement('p');
    msg.className = 'menu-search__assistant-message';
    msg.setAttribute('data-menu-assistant-message', '');

    const actions = document.createElement('div');
    actions.className = 'menu-search__assistant-actions';
    actions.setAttribute('data-menu-assistant-actions', '');

    const examples = document.createElement('div');
    examples.className = 'menu-search__assistant-examples';
    examples.setAttribute('data-menu-assistant-examples', '');

    const bubble = document.createElement('div');
    bubble.className = 'menu-search__assistant-bubble';
    bubble.append(header, msg, actions, examples);

    box.append(avatar, bubble);
    searchRoot.appendChild(box);

    // Apply translations to dynamically created UI
    if (typeof window.BadianiI18n?.applyTranslations === 'function') {
      try { window.BadianiI18n.applyTranslations(box); } catch {}
    }

    const clearBtn = box.querySelector('[data-menu-assistant-clear]');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        try { if (searchInput) searchInput.value = ''; } catch {}
        lastAssistantQuery = '';
        renderSuggestions('');
        showAssistantGreeting();
        try { searchInput?.focus({ preventScroll: true }); } catch {}
      });
    }

    return {
      root: box,
      avatar,
      message: msg,
      actions,
      examples,
      clear: clearBtn,
    };
  };

  const showAssistantGreeting = () => {
    setAssistant({
      message: tr('assistant.greeting', null, 'Dimmi cosa ti serve: io sono BERNY, il tuo assistente di fiducia. (Prometto di non giudicare gli errori… troppo.)'),
      actions: [
        { label: tr('assistant.action.openHub', null, 'Apri Hub'), href: 'index.html', kind: 'secondary' },
      ],
      examples: [
        tr('assistant.example.cones', null, 'Coni: quanti gusti e quanti grammi?'),
        tr('assistant.example.cappuccino', null, 'Come preparo un cappuccino?'),
        tr('assistant.example.churros', null, 'Churros: temperatura olio e timing?'),
        tr('assistant.example.gelatoBox', null, 'Gelato box: quale formato uso?'),
      ],
    });
  };

  const renderAssistantMessage = async (message, renderMode = 'instant') => {
    assistantNodes = assistantNodes || ensureAssistantUI();
    if (!assistantNodes?.root || !assistantNodes?.message) return;

    const msgEl = assistantNodes.message;
    stopAssistantTyping();
    const setAvatarState = (state) => {
      try { window.BadianiAvatarSprites?.setState?.(assistantNodes?.avatar, state); } catch {}
    };

    const clearMsg = () => {
      msgEl.classList.remove('is-thinking');
      msgEl.classList.remove('is-typing');
      msgEl.innerHTML = '';
    };

    if (renderMode === 'thinking') {
      clearMsg();
      msgEl.classList.add('is-thinking');
      setAvatarState('think');
      const textSpan = document.createElement('span');
      textSpan.textContent = String(message || tr('assistant.thinking', null, 'Ok, ci penso'));
      const dots = document.createElement('span');
      dots.className = 'assistant-dots';
      dots.setAttribute('aria-hidden', 'true');
      dots.textContent = '...';
      msgEl.append(textSpan, ' ', dots);
      return;
    }

    if (renderMode !== 'typewriter') {
      clearMsg();
      msgEl.textContent = String(message || '');
      setAvatarState('idle');
      return;
    }

    // Typewriter
    clearMsg();
    msgEl.classList.add('is-typing');
    setAvatarState('type');
    const originalLive = assistantNodes.root.getAttribute('aria-live');
    try { assistantNodes.root.setAttribute('aria-live', 'off'); } catch {}

    const token = ++typingToken;
    const fullText = String(message || '');
    const typed = document.createElement('span');
    typed.className = 'assistant-typed';
    const caret = document.createElement('span');
    caret.className = 'assistant-caret';
    caret.setAttribute('aria-hidden', 'true');
    // Blinking caret for the typewriter effect.
    caret.textContent = '|';
    msgEl.append(typed, caret);

    await new Promise((resolve) => {
      let i = 0;
      const step = () => {
        if (token !== typingToken) return resolve();
        typed.textContent = fullText.slice(0, i);
        i += 1;
        if (i <= fullText.length) {
          const jitter = 10 + Math.floor(Math.random() * 18);
          typingTimer = window.setTimeout(step, jitter);
        } else {
          resolve();
        }
      };
      step();
    });

    if (token !== typingToken) return;
    msgEl.classList.remove('is-typing');
    msgEl.textContent = fullText;
    setAvatarState('idle');
    try {
      assistantNodes.root.setAttribute('aria-live', originalLive || 'polite');
    } catch {}
  };

  const setAssistant = async ({ message = '', actions = [], examples = [], render = 'instant' } = {}) => {
    assistantNodes = assistantNodes || ensureAssistantUI();
    if (!assistantNodes?.root) return;

    await renderAssistantMessage(message, render);

    assistantNodes.actions.innerHTML = '';
    (Array.isArray(actions) ? actions : []).slice(0, 3).forEach((a) => {
      if (!a || !a.href) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = a.kind === 'secondary' ? 'btn btn-ghost btn--sm' : 'btn btn-primary btn--sm';
      btn.textContent = a.label || tr('assistant.action.open', null, 'Apri');
      btn.addEventListener('click', () => navigateTo(a.href));
      assistantNodes.actions.appendChild(btn);
    });

    assistantNodes.examples.innerHTML = '';
    if (Array.isArray(examples) && examples.length) {
      const wrap = document.createElement('div');
      wrap.className = 'menu-search__assistant-chiprow';
      examples.slice(0, 4).forEach((ex) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'menu-search__assistant-chip';
        chip.textContent = ex;
        chip.addEventListener('click', () => {
          if (searchInput) searchInput.value = ex;
          renderSuggestions(ex);
          handleAssistantSubmit();
        });
        wrap.appendChild(chip);
      });
      assistantNodes.examples.appendChild(wrap);
    }

    assistantNodes.root.hidden = false;

    // Tiny "speaking" cue on updates.
    try {
      assistantNodes.avatar?.classList.remove('is-speaking');
      // Force reflow for reliable restart
      void assistantNodes.avatar?.offsetHeight;
      assistantNodes.avatar?.classList.add('is-speaking');
      window.setTimeout(() => assistantNodes.avatar?.classList.remove('is-speaking'), 900);
    } catch (e) {}
  };

  const buildHrefFromResult = (item) => {
    if (!item) return '';
    if (item.isCategory && item.href) return item.href;
    const base = item.categoryHref || item.href || '';
    if (!base) return '';
    if (item.card) {
      // Use ?q= to leverage the smarter deep-link.js logic (exact ID match > title match)
      return `${base}?q=${encodeURIComponent(String(item.card))}`;
    }
    if (item.tab) {
      return `${base}?tab=${encodeURIComponent(String(item.tab))}&center=1`;
    }
    return base;
  };

  const bestMatch = (query) => {
    const { q, qAlt } = normalizeQuery(query);
    if (!q) return null;
    const hay = (s) => normalize(s);
    const score = (item) => {
      const name = hay(item?.name || '');
      const label = hay(item?.label || '');
      const category = hay(item?.category || '');
      const blob = `${name} ${label} ${category}`;
      const needle = q;
      const alt = qAlt;
      let sc = 0;
      if (label === needle || name === needle) sc += 200;
      if (blob.startsWith(needle)) sc += 120;
      if (blob.includes(needle)) sc += 80;
      if (alt && blob.includes(alt)) sc += 35;
      // Prefer cards over tabs over category-only
      if (item?.card) sc += 10;
      else if (item?.tab) sc += 6;
      else if (item?.isCategory) sc += 1;
      return sc;
    };

    const pool = [...(menuItems || []), ...(allProducts || [])];
    let top = null;
    let topScore = 0;
    pool.forEach((it) => {
      const sc = score(it);
      if (sc > topScore) {
        topScore = sc;
        top = it;
      }
    });
    return topScore >= 60 ? top : null;
  };

  const looksLikeQuestion = (query) => {
    const q = normalize(query);
    if (!q) return false;
    if (q.includes('?')) return true;
    return /^(come|quanto|quale|quali|cosa|perche|perché|quando|dove|posso|devo|si puo|si può|mi dici|mi spieghi|che differenza|qual\s+e|qual è)\b/i.test(q);
  };

  const assistantRuleAnswer = (query) => {
    const q = normalize(query);
    if (!q) return null;

    if (/(regole|regola|regolamento|mini\s*game|gioco|come\s*funziona|stellin|stelle|cristall|token|mini\s*quiz|test\s*me|cooldown|countdown|gelati\s*vinti|bonus)/i.test(q)) {
      return {
        message: tr('assistant.rules.message', null, 'Regole del gioco (in breve):\n• 1 tab aperto = 1 cristallo.\n• 5 cristalli = 1 stellina.\n• Ogni 3 stelline parte un mini quiz (1 domanda).\n• Mini quiz giusto = sblocchi "Test me". "Test me" perfetto = +1 gelato e cooldown 24h (riducibile a 12/30 stelline).\n• Mini quiz sbagliato = -3 stelline. Reset: domenica 00:00.'),
        actions: [
          { label: tr('assistant.rules.cta', null, 'Apri Regolamento'), href: 'index.html?open=regolamento&center=1' },
        ],
      };
    }

    // High-confidence answers + deep links (keep them short, always include the CTA)
    if (/(\bconi\b|\bcono\b|\bcone[s]?\b|choco\s*cone|gluten\s*free|\bgf\b)/i.test(q)) {
      return {
        message: tr('assistant.cones.message', null, 'Coni (standard): Piccolo 100g (1 gusto). Medio 140g (1�2 gusti). Grande 180g (1�3 gusti). Choco cone / GF: 140g. Per i dettagli, apri la scheda.'),
        actions: [
          { label: tr('assistant.cones.cta', null, 'Apri Coni classici'), href: 'gelato-lab.html?card=coni-classici&tab=parametri&center=1' },
        ],
      };
    }
    if (/(\bcoppett|coppa\b|cup\b)/i.test(q) && /(gramm|gust)/i.test(q)) {
      return {
        message: tr('assistant.cups.message', null, 'Coppette (standard): Piccolo 100g (1 gusto). Medio 140g (1�2). Grande 180g (1�3). Se vuoi, ti porto sulla scheda parametri.'),
        actions: [
          { label: tr('assistant.cups.cta', null, 'Apri Coppette'), href: 'gelato-lab.html?card=coppette&tab=parametri&center=1' },
        ],
      };
    }
    if (/(gelato\s*box|box\b|vaschett|asporto|take\s*away)/i.test(q)) {
      return {
        message: tr('assistant.gelatoBox.message', null, 'Gelato Boxes: formati 500 / 750 / 1000 ml. Autonomia termica circa 1 ora (poi meglio freezer). Apriamo la scheda per formato e servizio.'),
        actions: [
          { label: tr('assistant.gelatoBox.cta', null, 'Apri Gelato Boxes'), href: 'gelato-lab.html?card=gelato-boxes&center=1' },
        ],
      };
    }
    if (/(vetrina|banco|temperatura|\-14|\-15)/i.test(q) && /(gelato|conserv|setup|mattin|chiusur)/i.test(q)) {
      return {
        message: tr('assistant.display.message', null, 'Vetrina gelato: target -14 / -15�C. Lo standard completo (setup, scampoli e pulizie) � nella scheda dedicata.'),
        actions: [
          { label: tr('assistant.display.cta', null, 'Apri Setup vetrina'), href: 'gelato-lab.html?card=preparazione-vetrina-mattino&center=1' },
        ],
      };
    }
    if (/(\bchurros\b|frittura|olio|croccant)/i.test(q)) {
      return {
        message: tr('assistant.churros.message', null, 'Churros: olio a 190�C, porzione 8 pezzi, frittura 8�9 minuti. Zucchero+cannella: 600g + 20g. Ti apro la scheda per gli step.'),
        actions: [
          { label: tr('assistant.churros.cta', null, 'Apri Churros'), href: 'festive.html?tab=churros&center=1' },
        ],
      };
    }
    if (/(waffl)/i.test(q)) {
      return {
        message: tr('assistant.waffles.message', null, 'Waffles: macchina leggermente unta, potenza 3. 177ml impasto, 2:30 min per lato + riposo 45s. Mix: shelf-life 2 giorni. Apriamo la scheda.'),
        actions: [
          { label: tr('assistant.waffles.cta', null, 'Apri Waffles'), href: 'sweet-treats.html?card=waffles&center=1' },
        ],
      };
    }
    if (/((\bcrepe\b|\bcrepes\b|cr[eè]p).*(puliz|pulisci|clean|sanific|igien)|((puliz|pulisci|clean|sanific|igien).*(\bcrepe\b|\bcrepes\b|cr[eè]p)))/i.test(q)) {
      return {
        message: tr('assistant.crepeClean.message', null, 'Pulizia macchina cr�pe (fine servizio): spegni e lascia raffreddare in sicurezza; rimuovi residui e asciuga con blue-roll. Per la checklist completa di chiusura (macchine + frigo/label mix), apri la scheda �Chiusura & pulizia rapida�.'),
        actions: [
          { label: tr('assistant.crepeClean.cta', null, 'Apri Chiusura & pulizia rapida'), href: 'sweet-treats.html?card=chiusura-pulizia-rapida&center=1' },
        ],
      };
    }
    if (/(\bcrepe\b|\bcrepes\b|cr[eè]p)/i.test(q)) {
      return {
        message: tr('assistant.crepeStd.message', null, 'Cr�pe (standard con salsa): mix riposo =2h in frigo (shelf life 3 giorni). Piastra ben calda (non fumante). Cuoci ~20s per lato, spalma la salsa su met�, chiudi a mezzaluna poi a ventaglio; zucchero a velo + drizzle. Ti apro la scheda con gli step.'),
        actions: [
          { label: tr('assistant.crepeStd.cta', null, 'Apri Crepe con Salsa'), href: 'sweet-treats.html?card=crepe-con-salsa&center=1' },
        ],
      };
    }
    if (/(vin\s*brul|mulled|\bbrul\b)/i.test(q)) {
      return {
        message: tr('assistant.mulled.message', null, 'Vin Brulé: setup macchina con ~600ml acqua, poi warm-up 25–30 min (livello 10) e servizio a 6/7. Conservazione: raffredda e frigo; warmed ~3 giorni, box 30 giorni dall’apertura. Apriamo “Mulled”.'),
        actions: [
          { label: tr('assistant.mulled.cta', null, 'Apri Mulled Wine'), href: 'festive.html?tab=mulled&center=1' },
        ],
      };
    }
    if (/(cappuccino|flat\s*white|latte|schiuma|foam|montare\s+latte)/i.test(q)) {
      return {
        message: tr('assistant.milk.message', null, 'Latte & schiuma: andiamo nella sezione Milk. L� trovi tecnica e standard (senza improvvisazioni artistiche� a meno che non siano volute).'),
        actions: [
          { label: tr('assistant.milk.cta', null, 'Apri Milk (Bar & Drinks)'), href: 'caffe.html?tab=milk&center=1' },
        ],
      };
    }
    if (/(sicurezza|safety|allerg|gluten)/i.test(q)) {
      return {
        message: tr('assistant.safety.message', null, 'Sicurezza e allergeni: apriamo Operations & Setup per procedure e check (meglio 30 secondi qui che 30 minuti dopo).'),
        actions: [
          { label: tr('assistant.safety.cta', null, 'Apri Operations & Setup'), href: 'operations.html?center=1' },
        ],
      };
    }

    return null;
  };

  const wittyFallback = (query) => {
    const q = (query || '').trim();
    const lines = [
      tr('assistant.witty.line1', { q }, `Su �${q}� rischio di inventarmi cose� e non vogliamo gelati fantasy.`),
      tr('assistant.witty.line2', { q }, `Io sono fortissimo su ricette e procedure Badiani. Su �${q}� invece� mi manca la certificazione.`),
      tr('assistant.witty.line3', { q }, `Posso aiutarti con Bar, Gelato, Treats, Operations. Su �${q}� sono in modalit� �panna montata�: tanta aria e poca sostanza.`),
    ];
    const pick = () => lines[Math.floor(Math.random() * lines.length)];
    return {
      message: tr('assistant.witty.heading', { line: pick() }, `${pick()} Prova con una domanda tipo:`),
      actions: [
        { label: tr('assistant.witty.cta', null, 'Apri Hub'), href: 'index.html', kind: 'secondary' },
      ],
      examples: [
        tr('assistant.witty.example1', null, 'Come preparo un cappuccino?'),
        tr('assistant.witty.example2', null, 'Coni: quanti gusti e quanti grammi?'),
        tr('assistant.witty.example3', null, 'Churros: temperatura olio e timing?'),
        tr('assistant.witty.example4', null, 'Gelato box: quale formato usare?'),
      ],
    };
  };

  const answerAssistant = async (query) => {
    const raw = String(query || '').trim();
    const norm = normalize(raw);
    if (!norm) {
      return {
        message: 'Scrivimi una domanda (o il nome di un modulo) e ti porto alla scheda giusta.',
        actions: [],
        examples: ['Coni: quale frase � corretta?', 'Come faccio un flat white?', 'Packaging take away: cosa serve?'],
      };
    }

    // Slitti bars (tavolette): compute from the actual Slitti page.
    if (/(slitti)/i.test(norm) && /(barre|barra|tavolett|cioccolat)/i.test(norm) && /(quanti|numero|tipi|varian|offri|offerta|shop|negozi)/i.test(norm)) {
      const info = await getSlittiTavoletteInfo();
      const href = info?.cardKey
        ? `slitti-yoyo.html?card=${encodeURIComponent(String(info.cardKey))}&center=1`
        : 'slitti-yoyo.html?center=1';

      if (info && Number.isFinite(info.count) && info.count > 0) {
        const perc = (info.labels || []).filter((l) => /%$/.test(l));
        const hasCaffe = (info.labels || []).some((l) => /caff/i.test(l));
        const parts = [];
        if (perc.length) parts.push(`LatteNero ${perc.join(' / ')}`);
        if (hasCaffe) parts.push('Caffè Latte');
        const detail = parts.length ? ` (in scheda: ${parts.join(' + ')})` : '';
        return {
          message: `Barre Slitti (tavolette): ${info.count} tipologie${detail}. Per sicurezza, apri la scheda e verifica l'assortimento esposto.`,
          actions: [
            { label: 'Apri Tavolette Slitti', href },
          ],
          examples: ['Quali sono le varianti LatteNero?', 'Come si conserva il cioccolato?', 'Che cos�� Yo-Yo?'],
        };
      }

      return {
        message: 'Per contare le tavolette Slitti devo leggere la scheda (qui sul momento non riesco a recuperare l�elenco). Ti porto direttamente alla sezione giusta.',
        actions: [
          { label: 'Apri Slitti & Yo-Yo', href },
        ],
        examples: ['Quali percentuali LatteNero abbiamo?', 'Conservazione cioccolato: quanti �C?'],
      };
    }

    // 1) Rules (high confidence)
    const ruled = assistantRuleAnswer(raw);
    if (ruled) {
      return {
        ...ruled,
        examples: ruled.examples || ['Coni: choco cone?', 'Cappuccino: schiuma?', 'Churros: croccante?'],
      };
    }

    // 2) Local knowledge snippets (best-effort, avoids hallucinating: always paired with a CTA)
    const kbHit = await kbRetrieve(raw);
    if (kbHit) {
      const cta = pickDefaultCtaHref(raw) || kbHit.defaultHref || '';
      const currentLang = getUiLang();
      
      // Build language-specific messages
      const verifyMessages = {
        'it': '\n\nPer sicurezza, verifica i dettagli nella scheda di riferimento.',
        'en': '\n\nFor safety, verify the details in the reference card.',
        'es': '\n\nPor seguridad, verifica los detalles en la ficha de referencia.',
        'fr': '\n\nPour plus de s�ret�, v�rifiez les d�tails dans la fiche de r�f�rence.'
      };
      
      const ctaLabels = {
        'it': 'Apri scheda consigliata',
        'en': 'Open recommended card',
        'es': 'Abrir ficha recomendada',
        'fr': 'Ouvrir la fiche recommand�e'
      };
      
      const examplesByLang = {
        'it': ['Coni: quanti gusti e grammi?', 'Churros: timing?', 'Waffles: potenza e minuti?'],
        'en': ['Cones: how many flavors and grams?', 'Churros: timing?', 'Waffles: power and minutes?'],
        'es': ['Conos: �cu�ntos sabores y gramos?', 'Churros: �tiempo?', 'Waffles: �potencia y minutos?'],
        'fr': ['Cornets: combien de parfums et grammes?', 'Churros: timing?', 'Gaufres: puissance et minutes?']
      };
      
      return {
        message: `${summarizeSnippet(kbHit.text)}${verifyMessages[currentLang] || verifyMessages['it']}`,
        actions: cta ? [{ label: ctaLabels[currentLang] || ctaLabels['it'], href: cta }] : [],
        examples: examplesByLang[currentLang] || examplesByLang['it'],
      };
    }

    // 3) Catalog match
    const match = bestMatch(raw);
    if (match) {
      const href = buildHrefFromResult(match);
      const currentLang = getUiLang();
      
      const openLabels = {
        'it': 'Apri',
        'en': 'Open',
        'es': 'Abrir',
        'fr': 'Ouvrir'
      };
      
      const label = match.isCategory
        ? `${openLabels[currentLang] || 'Apri'} ${match.label}`
        : `${openLabels[currentLang] || 'Apri'} ${match.label}`;
      
      const messages = {
        'it': {
          question: 'Ok � ti porto alla scheda pi� pertinente. Dentro trovi lo standard completo.',
          found: 'Trovato. Ti porto alla scheda di riferimento.'
        },
        'en': {
          question: 'OK � I\'ll take you to the most relevant card. Inside you\'ll find the complete standard.',
          found: 'Found. I\'ll take you to the reference card.'
        },
        'es': {
          question: 'OK � te llevo a la ficha m�s relevante. Dentro encontrar�s el est�ndar completo.',
          found: 'Encontrado. Te llevo a la ficha de referencia.'
        },
        'fr': {
          question: 'OK � je vous emm�ne � la fiche la plus pertinente. � l\'int�rieur, vous trouverez le standard complet.',
          found: 'Trouv�. Je vous emm�ne � la fiche de r�f�rence.'
        }
      };
      
      const examplesByLang = {
        'it': ['Mostrami Gelato Boxes', 'Dove trovo upselling?', 'Come si fa l\'Afternoon Tea?'],
        'en': ['Show me Gelato Boxes', 'Where do I find upselling?', 'How do I make Afternoon Tea?'],
        'es': ['Mu�strame Gelato Boxes', '�D�nde encuentro upselling?', '�C�mo se hace Afternoon Tea?'],
        'fr': ['Montrez-moi Gelato Boxes', 'O� trouver l\'upselling?', 'Comment faire l\'Afternoon Tea?']
      };
      
      const langMessages = messages[currentLang] || messages['it'];
      const baseMsg = looksLikeQuestion(raw) ? langMessages.question : langMessages.found;
      
      return {
        message: `${baseMsg}`,
        actions: href ? [{ label, href }] : [],
        examples: examplesByLang[currentLang] || examplesByLang['it'],
      };
    }

    // 3) No match ? witty
    return wittyFallback(raw);
  };

  const renderSuggestions = (query) => {
    // Assistant mode: remove previews entirely.
    if (!searchSuggestions) return;
    searchSuggestions.innerHTML = '';
    searchSuggestions.hidden = true;

    const { q, qAlt } = normalizeQuery(query);
    if (!q) {
      lastFiltered = [];
      return;
    }

    const matchesQuery = (haystack) => {
      const h = normalize(haystack);
      if (!h) return false;
      if (h.includes(q)) return true;
      if (qAlt && h.includes(qAlt)) return true;
      return false;
    };

    const productMatches = allProducts.filter((item) => matchesQuery(item.name) || matchesQuery(item.category));
    const categoryMatches = menuItems.filter((cat) => matchesQuery(cat.name) || matchesQuery(cat.label));
    lastFiltered = [...categoryMatches, ...productMatches].slice(0, 10);
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

  const handleAssistantSubmit = async () => {
    if (!searchInput) return;
    const raw = String(searchInput.value || '');
    const norm = normalize(raw);
    if (!norm) {
      lastAssistantQuery = '';
      showAssistantGreeting();
      return;
    }
    // Avoid spamming the same answer if the user presses Enter repeatedly.
    if (norm === lastAssistantQuery) {
      return;
    }
    lastAssistantQuery = norm;

    // Thinking phase (visible)
    await setAssistant({ message: tr('assistant.thinking', null, 'Ok, ci penso'), actions: [], examples: [], render: 'thinking' });
    // Minimum �thinking� time so it reads as intentional.
    await sleep(420);
    const answer = await answerAssistant(raw);
    await setAssistant({ ...answer, render: 'typewriter' });
  };

  // Focus trap for the full-screen menu drawer.
  // Keeps Tab navigation inside the drawer while it is open.
  const trapFocus = (element) => {
    if (!element || !(element instanceof Element)) return () => {};

    const focusableElements = element.querySelectorAll(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (!firstElement || !lastElement) {
      return () => {};
    }

    const onKeyDown = (e) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          try { lastElement.focus({ preventScroll: true }); } catch { lastElement.focus(); }
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          try { firstElement.focus({ preventScroll: true }); } catch { firstElement.focus(); }
        }
      }
    };

    element.addEventListener('keydown', onKeyDown);
    try { firstElement.focus({ preventScroll: true }); } catch { firstElement?.focus?.(); }

    return () => {
      try { element.removeEventListener('keydown', onKeyDown); } catch {}
    };
  };

  let releaseDrawerFocusTrap = null;
  let lastFocusBeforeDrawer = null;
  let lastDrawerToggleButton = null;

  const openDrawer = (triggerEl) => {
    lastFocusBeforeDrawer = document.activeElement;
    lastDrawerToggleButton = triggerEl || lastDrawerToggleButton;
    applyMoodLine(pickMoodKey());
    applyCategoryCompletionStars();
    renderSuggestions(searchInput?.value || '');
    drawer.setAttribute('aria-hidden', 'false');
    bodyScrollLock.lock();

    if (releaseDrawerFocusTrap) {
      releaseDrawerFocusTrap();
      releaseDrawerFocusTrap = null;
    }
    releaseDrawerFocusTrap = trapFocus(drawer);
  };

  // Keep mood line aligned when UI language changes.
  document.addEventListener('badiani:lang-changed', () => {
    applyMoodLine();
    
    // Re-apply translations to assistant UI (title, labels, etc.)
    if (typeof window.BadianiI18n?.applyTranslations === 'function') {
      try {
        const assistantRoot = searchRoot?.querySelector('[data-menu-assistant]');
        if (assistantRoot) window.BadianiI18n.applyTranslations(assistantRoot);
      } catch {}
    }
    
    // ALWAYS refresh the assistant greeting and examples when language changes
    try {
      const current = normalize(searchInput?.value || '');
      if (!current) {
        // If no query, show greeting in new language
        lastAssistantQuery = '';
        showAssistantGreeting();
      } else {
        // If there's a query, re-run the assistant to get new language
        lastAssistantQuery = ''; // Force refresh
        handleAssistantSubmit();
      }
    } catch {}
  });

  const closeDrawer = () => {
    drawer.setAttribute('aria-hidden', 'true');
    bodyScrollLock.unlock();

    if (releaseDrawerFocusTrap) {
      releaseDrawerFocusTrap();
      releaseDrawerFocusTrap = null;
    }

    const restoreTarget = lastDrawerToggleButton || lastFocusBeforeDrawer;
    if (restoreTarget && typeof restoreTarget.focus === 'function') {
      try { restoreTarget.focus({ preventScroll: true }); } catch { restoreTarget.focus(); }
    }
  };

  // Toggle menu on nav menu button
  document.addEventListener('click', (e) => {
    const menuBtn = e.target.closest('[data-menu-toggle]');
    if (menuBtn) {
      const isOpen = drawer.getAttribute('aria-hidden') === 'false';
      if (isOpen) {
        closeDrawer();
      } else {
        openDrawer(menuBtn);
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
    searchInput.addEventListener('input', () => {
      renderSuggestions(searchInput.value);

      // Row 3: Berny "thinking" while the user types.
      assistantNodes = assistantNodes || ensureAssistantUI();
      try {
        const hasText = !!normalize(searchInput.value);
        window.BadianiAvatarSprites?.setState?.(assistantNodes?.avatar, hasText ? 'think' : 'idle');
      } catch {}

      if (avatarInputTimer) {
        window.clearTimeout(avatarInputTimer);
        avatarInputTimer = 0;
      }
      avatarInputTimer = window.setTimeout(() => {
        assistantNodes = assistantNodes || ensureAssistantUI();
        const msgEl = assistantNodes?.message;
        if (msgEl?.classList?.contains('is-thinking') || msgEl?.classList?.contains('is-typing')) return;
        try { window.BadianiAvatarSprites?.setState?.(assistantNodes?.avatar, 'idle'); } catch {}
      }, 650);
    });
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
// CHAT ASSISTANT (index.html): Messenger-style chat (BERNY)
// ============================================================
(() => {
  // Guard against double-init (e.g. script injected twice / hot reload / caching quirks)
  if (window.__badianiBernyChatInit) return;
  window.__badianiBernyChatInit = true;

  const chatInput = document.querySelector('[data-chat-input]');
  const chatSend = document.querySelector('[data-chat-send]');
  const messagesArea = document.querySelector('[data-messages-area]');
  const avatarContainer = document.querySelector('[data-chat-avatar]');

  if (!chatInput || !chatSend || !messagesArea) return;

  const ensureLottiePlayer = (() => {
    let promise = null;
    return () => {
      try {
        if (window.customElements?.get?.('lottie-player')) {
          return Promise.resolve(true);
        }
      } catch {}
      if (promise) return promise;
      promise = new Promise((resolve) => {
        const existing = document.querySelector('script[data-lottie-player]');
        if (existing) {
          // Assume it will load soon.
          existing.addEventListener('load', () => resolve(true), { once: true });
          existing.addEventListener('error', () => resolve(false), { once: true });
          return;
        }

        const s = document.createElement('script');
        s.src = 'https://unpkg.com/@lottiefiles/lottie-player@latest/dist/lottie-player.js';
        s.async = true;
        s.defer = true;
        s.setAttribute('data-lottie-player', '');
        s.addEventListener('load', () => resolve(true), { once: true });
        s.addEventListener('error', () => resolve(false), { once: true });
        (document.head || document.documentElement).appendChild(s);
      });
      return promise;
    };
  })();

  // Best-effort load of lottie-player for the avatar.
  ensureLottiePlayer().then((ok) => {
    if (ok) return;
    // Fallback to existing sprite if the CDN is blocked.
    if (!avatarContainer) return;
    try {
      avatarContainer.innerHTML = '';
      const img = document.createElement('img');
      img.src = 'assets/avatars/berny-sprite.png';
      img.alt = 'BERNY';
      img.width = 50;
      img.height = 50;
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';
      img.style.objectPosition = '0 0';
      avatarContainer.appendChild(img);
    } catch {}
  });

  const seenMessageIds = new Set();
  let seq = 0;
  const makeId = (prefix) => {
    seq += 1;
    const rand = Math.random().toString(16).slice(2);
    return `${prefix}:${Date.now()}:${seq}:${rand}`;
  };

  const cssEscape = (value) => {
    try {
      return CSS.escape(String(value));
    } catch {
      return String(value).replace(/[^a-zA-Z0-9_-]/g, (m) => `\\${m}`);
    }
  };

  const sanitizeChatText = (value) => {
    let t = String(value ?? '');
    // Remove replacement characters and legacy placeholders (keep single '?' for real questions)
    t = t.replace(/\uFFFD/g, '');
    t = t.replace(/\s*\?{2}\s*$/g, '');
    return t.trim();
  };

  const setAvatarThinking = (isThinking) => {
    if (!avatarContainer) return;
    try {
      avatarContainer.classList.toggle('is-thinking', !!isThinking);
      if (!isThinking) avatarContainer.classList.remove('is-thinking');
    } catch {}
  };

  const bounceAvatar = () => {
    if (!avatarContainer) return;
    try {
      avatarContainer.classList.remove('is-bounce');
      // Force reflow to restart animation reliably
      void avatarContainer.offsetHeight;
      avatarContainer.classList.add('is-bounce');
      window.setTimeout(() => avatarContainer.classList.remove('is-bounce'), 520);
    } catch {}
  };

  // Random blink every ~3-5 seconds (subtle)
  let blinkTimer = 0;
  const scheduleBlink = () => {
    if (!avatarContainer) return;
    if (blinkTimer) window.clearTimeout(blinkTimer);
    const next = 3000 + Math.floor(Math.random() * 2000);
    blinkTimer = window.setTimeout(() => {
      try {
        avatarContainer.classList.remove('is-blink');
        void avatarContainer.offsetHeight;
        avatarContainer.classList.add('is-blink');
        window.setTimeout(() => avatarContainer.classList.remove('is-blink'), 180);
      } catch {}
      scheduleBlink();
    }, next);
  };
  scheduleBlink();

  // Remove placeholder when first message is added
  const removePlaceholder = () => {
    const placeholder = messagesArea.querySelector('.chat-placeholder');
    if (placeholder) placeholder.remove();
  };

  const addMessage = ({ id, text, role }) => {
    const cleaned = sanitizeChatText(text);
    if (!cleaned) return null;
    const messageId = String(id || makeId(role || 'msg'));

    // De-dupe: don't allow the same message to be appended twice.
    if (seenMessageIds.has(messageId)) return null;
    if (messagesArea.querySelector(`[data-message-id="${cssEscape(messageId)}"]`)) {
      seenMessageIds.add(messageId);
      return null;
    }
    seenMessageIds.add(messageId);

    removePlaceholder();

    let wrapper;
    let bubble;

    if (role === 'user') {
      wrapper = document.createElement('div');
      wrapper.className = 'user-message';
      wrapper.setAttribute('data-message-id', messageId);
      bubble = document.createElement('div');
      bubble.className = 'user-bubble';
      bubble.textContent = cleaned;
      wrapper.appendChild(bubble);
    } else {
      wrapper = document.createElement('div');
      wrapper.className = 'berny-message';
      wrapper.setAttribute('data-message-id', messageId);
      bubble = document.createElement('div');
      bubble.className = 'message-bubble';
      bubble.textContent = cleaned;
      wrapper.appendChild(bubble);
    }

    messagesArea.appendChild(wrapper);

    // Scroll the chat body container (the scroller is the chat body, not the message column)
    try {
      const scroller = messagesArea.closest('.chat-body');
      if (scroller) scroller.scrollTop = scroller.scrollHeight;
      else messagesArea.scrollTop = messagesArea.scrollHeight;
    } catch {}

    return wrapper;
  };

  const removeMessageById = (id) => {
    if (!id) return;
    try {
      const el = messagesArea.querySelector(`[data-message-id="${cssEscape(String(id))}"]`);
      if (el) el.remove();
    } catch {}
  };

  // Send message handler
  let sendLock = 0;
  const sendMessage = () => {
    const text = sanitizeChatText(chatInput.value);
    if (!text) return;
    const now = Date.now();
    // Prevent accidental double-fire (Enter + click, key repeat, etc.)
    if (now - sendLock < 200) return;
    sendLock = now;

    addMessage({ id: makeId('user'), text, role: 'user' });
    chatInput.value = '';
    setAvatarThinking(true);

    const typingId = makeId('assistant-typing');
    addMessage({ id: typingId, text: '…', role: 'assistant' });

    // Simulate assistant response after short delay
    window.setTimeout(() => {
      removeMessageById(typingId);
      addMessage({ id: makeId('assistant'), text: 'Sto cercando informazioni per te…', role: 'assistant' });
      setAvatarThinking(false);
      bounceAvatar();
    }, 650);
  };

  // Event listeners
  chatSend.addEventListener('click', sendMessage);
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendMessage();
    }
  });

  chatInput.addEventListener('input', () => {
    // Subtle pulse while the user is actively typing
    const hasText = !!sanitizeChatText(chatInput.value);
    if (hasText) setAvatarThinking(true);
    else setAvatarThinking(false);
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
  const root = document.documentElement;
  let ticking = false;
  let isShrunk = false;
  let navHeightRaf = 0;
  const shrinkThreshold = 90;
  const expandThreshold = 50; // hysteresis to prevent flicker near top

  const updateNavHeight = () => {
    if (navHeightRaf) return;
    navHeightRaf = window.requestAnimationFrame(() => {
      navHeightRaf = 0;
      try {
        const height = nav.getBoundingClientRect().height;
        if (!height || !Number.isFinite(height)) return;
        root.style.setProperty('--nav-height', `${Math.ceil(height)}px`);
      } catch {}
    });
  };

  const handleScroll = () => {
    const scrollY = window.scrollY || window.pageYOffset;
    if (!isShrunk && scrollY > shrinkThreshold) {
      isShrunk = true;
      nav.classList.add('is-shrunk');
      if (brandImg && altLogo && brandImg.getAttribute('src') !== altLogo) {
        brandImg.setAttribute('src', altLogo);
      }
      updateNavHeight();
    } else if (isShrunk && scrollY < expandThreshold) {
      isShrunk = false;
      nav.classList.remove('is-shrunk');
      if (brandImg && defaultLogo && brandImg.getAttribute('src') !== defaultLogo) {
        brandImg.setAttribute('src', defaultLogo);
      }
      updateNavHeight();
    }
    ticking = false;
  };

  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(handleScroll);
      ticking = true;
    }
  }, { passive: true });

  window.addEventListener('resize', updateNavHeight, { passive: true });
  window.addEventListener('orientationchange', updateNavHeight, { passive: true });

  // If fonts load after initial paint, nav height can shift.
  try {
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(updateNavHeight).catch(() => {});
    }
  } catch {}

  // Initialize state on load to avoid flash
  handleScroll();
  updateNavHeight();
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
  const SESSION_KEY_PREFIX = 'badianiGamification.session.v1';
  const WINDOW_NAME_PREFIX = '__badianiGam__:';
  
  // Test storage availability once
  let storageAvailable = null;
  const testStorage = () => {
    if (storageAvailable !== null) return storageAvailable;
    try {
      const testKey = '__badiani_test__';
      localStorage.setItem(testKey, '1');
      const retrieved = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);
      storageAvailable = retrieved === '1';
      if (!storageAvailable) {
        console.warn('?? localStorage write/read test failed');
      }
      return storageAvailable;
    } catch (e) {
      console.warn('?? localStorage blocked or unavailable:', e.message);
      storageAvailable = false;
      return false;
    }
  };

  const getActiveProfile = () => {
    try {
      return window.BadianiProfile?.getActive?.() || null;
    } catch {
      return null;
    }
  };
  const storageKey = () => {
    const prof = getActiveProfile();
    const id = prof?.id || 'guest';
    return `${STORAGE_KEY_PREFIX}:${id}`;
  };
  const sessionKey = () => {
    const prof = getActiveProfile();
    const id = prof?.id || 'guest';
    return `${SESSION_KEY_PREFIX}:${id}`;
  };

  const readWindowNameState = () => {
    try {
      const raw = String(window.name || '');
      if (!raw.startsWith(WINDOW_NAME_PREFIX)) return null;
      const payload = raw.slice(WINDOW_NAME_PREFIX.length);
      if (!payload) return null;
      return JSON.parse(payload);
    } catch {
      return null;
    }
  };

  const writeWindowNameState = (value) => {
    try {
      const payload = JSON.stringify(pruneStateForStorage(value));
      window.name = `${WINDOW_NAME_PREFIX}${payload}`;
    } catch {
      /* ignore window.name errors */
    }
  };
  const STARS_FOR_QUIZ = 3;
  const CRYSTALS_PER_STAR = 5;
  const MAX_STARS = 65;

  // Story Orbit uses a �virtual card� to convert 5 crystals -> 1 star.
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
  // QUIZ CONTINUO (Test me): banca domande MCQ con motivazioni.
  // Nota: ogni oggetto pu� avere `explain` (motivazione) e viene mostrato nella pagina soluzione.
  // IDs: mantenuti come sequenza stabile (tm-001, tm-002, ...) per evitare collisioni e facilitare aggiornamenti.
  // ============================================
  // QUIZ QUESTIONS BY TOPIC (for adaptive mini quiz)
  // These questions are categorized by menu section to enable topic-based filtering
  // ============================================
  const QUIZ_TOPIC_MAPPING = {
    // Crepes, Waffles, Pancakes, Porridge (sweet-treats)
    'sweet-treats': ['tm-001', 'tm-002', 'tm-003', 'tm-004', 'tm-005', 'tm-006', 'tm-007', 'tm-008'],
    
    // Gelato Products (Burger, Croissant, Pancake, Porridge) + Display & Service
    'gelato-lab': ['tm-009', 'tm-010', 'tm-011', 'tm-012', 'tm-013', 'tm-014', 'tm-015', 'tm-016', 
                   'tm-017', 'tm-018', 'tm-019', 'tm-020', 'tm-021', 'tm-022', 'tm-023', 'tm-024', 
                   'tm-025', 'tm-026', 'tm-027', 'tm-028', 'tm-029', 'tm-030', 'tm-031', 'tm-032',
                   'tm-033', 'tm-034', 'tm-035', 'tm-036', 'tm-037', 'tm-038', 'tm-039', 'tm-040',
                   'tm-041'],
    
    // Drinks (Smoothie, Matcha, Cocktails, Mulled Wine)
    'caffe': ['tm-042', 'tm-043', 'tm-044', 'tm-045', 'tm-046', 'tm-047', 'tm-048', 'tm-049', 
              'tm-050', 'tm-051', 'tm-052', 'tm-053', 'tm-054', 'tm-055', 'tm-056', 'tm-057',
              'tm-058', 'tm-059'],
    
    // Sweet Treats & Festive (Churros, Panettone, Pandoro, Mulled Wine)
    'pastries': ['tm-060', 'tm-061', 'tm-062', 'tm-063', 'tm-064', 'tm-065', 'tm-066', 'tm-067',
                 'tm-068', 'tm-069', 'tm-070'],
    
    // Slitti History, Products, Yo-Yo & Advanced Gelato Service
    'slitti-yoyo': ['tm-071', 'tm-072', 'tm-073', 'tm-074', 'tm-075', 'tm-076', 'tm-077', 'tm-078',
                    'tm-079', 'tm-080', 'tm-081', 'tm-082', 'tm-083', 'tm-084', 'tm-085', 'tm-086',
                    'tm-087', 'tm-088', 'tm-089', 'tm-090', 'tm-091', 'tm-092', 'tm-093', 'tm-094',
                    'tm-095', 'tm-096', 'tm-097', 'tm-098', 'tm-099', 'tm-100'],
  };

  // Super-easy mode (sm-) questions: distributed across 5 topics (sm-001 to sm-100)
  const SUPER_EASY_QUESTIONS_MAPPING = {
    // Crepes, Waffles, Pancakes basics
    'sweet-treats': ['sm-001', 'sm-002', 'sm-003', 'sm-004', 'sm-005', 'sm-006', 'sm-007', 'sm-008'],
    
    // Gelato service basics
    'gelato-lab': ['sm-009', 'sm-010', 'sm-011', 'sm-012', 'sm-013', 'sm-014', 'sm-015', 'sm-016',
                   'sm-017', 'sm-018', 'sm-019', 'sm-020', 'sm-021', 'sm-022', 'sm-023', 'sm-024',
                   'sm-025', 'sm-026', 'sm-027', 'sm-028', 'sm-029', 'sm-030', 'sm-031'],
    
    // Drinks & Matcha
    'caffe': ['sm-032', 'sm-033', 'sm-034', 'sm-035', 'sm-036', 'sm-037', 'sm-038', 'sm-039',
              'sm-040', 'sm-041', 'sm-042', 'sm-043'],
    
    // Treats & Festive
    'pastries': ['sm-044', 'sm-045', 'sm-046', 'sm-047', 'sm-048', 'sm-049', 'sm-050', 'sm-051',
                 'sm-052', 'sm-053'],
    
    // Slitti Yo-Yo & Advanced
    'slitti-yoyo': ['sm-054', 'sm-055', 'sm-056', 'sm-057', 'sm-058', 'sm-059', 'sm-060', 'sm-061',
                    'sm-062', 'sm-063', 'sm-064', 'sm-065', 'sm-066', 'sm-067', 'sm-068', 'sm-069',
                    'sm-070', 'sm-071', 'sm-072', 'sm-073', 'sm-074', 'sm-075', 'sm-076', 'sm-077',
                    'sm-078', 'sm-079', 'sm-080', 'sm-081', 'sm-082', 'sm-083', 'sm-084', 'sm-085',
                    'sm-086', 'sm-087', 'sm-088', 'sm-089', 'sm-090', 'sm-091', 'sm-092', 'sm-093',
                    'sm-094', 'sm-095', 'sm-096', 'sm-097', 'sm-098', 'sm-099', 'sm-100'],
  };

  // Legacy structure: keep QUIZ_QUESTIONS flat
  const QUIZ_QUESTIONS = [
    {
      id: 'tm-001',
      question: 'Un collega prepara il mix crepes e lo lascia riposare 1 ora: qual è la correzione giusta?',
      options: ['Va bene cos�', 'Aggiungere pi� farina', 'Portare il riposo minimo a 2 ore', 'Cuocere pi� a lungo la crepe'],
      correct: 2,
      explain: 'Standard impasto crepes = riposo minimo 2 ore in frigo per stabilizzare la miscela.',
    },
    {
      id: 'tm-002',
      question: 'Stai facendo una Buontalenti crepe e il cliente vuole �pi� salsa sopra�: qual è la quantit� standard di salsa top prima di extra?',
      options: ['10g', '20g', '30g', '60g'],
      correct: 2,
      explain: 'La finitura standard prevede 30g di salsa sopra, poi eventuali extra sono un�aggiunta.',
    },
    {
      id: 'tm-003',
      question: 'Vuoi preparare una crepe �Italiana plain base�: quale combinazione � coerente con lo standard?',
      options: ['Mozzarella + rocket + 3 cherry tomatoes', 'Mozzarella + tonno + olive', 'Prosciutto + funghi', 'Bacon + cheddar'],
      correct: 0,
      explain: 'La farcitura standard include mozzarella grattugiata, rocket e 3 pomodorini (poi in quarti).',
    },
    {
      id: 'tm-004',
      question: 'La crepe salata � pronta ma �molle� al centro: quale step finale � stato probabilmente saltato?',
      options: ['Spolverata di zucchero a velo', '10 secondi extra di cottura dopo l�ultimo flip', 'Aggiunta della salsa top 30g', 'Riposo mix 2 ore'],
      correct: 1,
      explain: 'Dopo la piega si fa un�ulteriore breve cottura (10 sec) per compattare e scaldare l�interno.',
    },
    {
      id: 'tm-005',
      question: 'Stai preparando la versione beetroot: quale procedura � corretta?',
      options: ['3g beetroot powder in 250g mix, poi frullare', '30g beetroot powder in 250g mix, poi setacciare', '3g beetroot powder in 1000g mix, poi frullare', '10g beetroot powder direttamente sulla piastra'],
      correct: 0,
      explain: 'Standard colore beetroot = 3g su 250g di mix, miscelati con blender.',
    },
    {
      id: 'tm-006',
      question: 'Waffle: quale combinazione �setup + dose� � corretta?',
      options: ['Power 2 + 250ml', 'Power 3 + 177ml', 'Power 5 + 100ml', 'Power 3 + 50ml'],
      correct: 1,
      explain: 'Standard waffle = power 3 e una scoop di pastella pari a 177ml.',
    },
    {
      id: 'tm-007',
      question: 'Waffle: cosa evita di �sciupare� la presentazione quando aggiungi topping?',
      options: ['Togliere subito dal ferro e farcire', 'Riposo 45 secondi prima di topping/gelato', 'Aumentare la power a 5', 'Girare dopo 30 secondi'],
      correct: 1,
      explain: 'Lo standard prevede riposo 45 secondi per stabilizzare la struttura prima dei topping.',
    },
    {
      id: 'tm-008',
      question: 'Se vuoi un ciclo waffle completo, qual è il totale di cottura standard?',
      options: ['2.5 min', '5 min', '7.5 min', '10 min'],
      correct: 1,
      explain: 'Standard = 2.5 minuti, poi giri e fai altri 2.5 minuti (totale 5).',
    },
    {
      id: 'tm-009',
      question: 'Gelato Burger: quale regola �porzione + salsa� � corretta?',
      options: ['2 scoops + 2 salse', '1 scoop (70g) + 1 sola salsa', '1 scoop (100g) + salse illimitate', '3 scoops + 1 salsa'],
      correct: 1,
      explain: 'Standard prodotto = una sola scoop da 70g e una sola scelta di salsa.',
    },
    {
      id: 'tm-010',
      question: 'Gelato Burger: quale impostazione macchina � corretta per il tempo di chiusura?',
      options: ['8 sec', '10 sec', '12 sec', '20 sec'],
      correct: 2,
      explain: 'Il ciclo standard � 12 secondi.',
    },
    {
      id: 'tm-011',
      question: 'Gelato Burger: se trovi briciole sulla macchina, qual è l�azione corretta?',
      options: ['Sciacquare con acqua', 'Passare blue-roll paper', 'Usare spugna abrasiva', 'Spruzzare olio'],
      correct: 1,
      explain: 'La gestione standard delle briciole � rimuoverle con blue-roll paper.',
    },
    {
      id: 'tm-012',
      question: 'Gelato Croissant: quanta Buontalenti va inserita secondo standard?',
      options: ['1 scoop da 70g', '2 scoops da 70g', '3 scoops da 50g', '2 scoops da 100g'],
      correct: 1,
      explain: 'Standard = 2 scoops con scooper, 2�70g.',
    },
    {
      id: 'tm-013',
      question: 'Gelato Croissant: scegli l�ordine topping corretto.',
      options: ['Crumble ? pistacchio sauce', 'Pistacchio sauce ? crumble', 'Salsa dolcevita ? crumble', 'Panna ? crumble'],
      correct: 1,
      explain: 'Lo standard prevede pistacchio sauce prima e crumble dopo.',
    },
    {
      id: 'tm-014',
      question: 'Gelato Croissant: quale coppia quantit� � corretta?',
      options: ['Pistacchio sauce ~20g + crumble 7g', 'Pistacchio sauce 7g + crumble 20g', 'Pistacchio sauce 30g + crumble 3g', 'Pistacchio sauce 5g + crumble 14g'],
      correct: 0,
      explain: 'Standard topping = circa 20g salsa e 7g crumble.',
    },
    {
      id: 'tm-015',
      question: 'Pancake: come riconosci il timing giusto per girarli?',
      options: ['Dopo 10 sec', 'Dopo 30 sec', 'Quando iniziano le bolle (~90 sec)', 'Solo quando diventano scuri'],
      correct: 2,
      explain: 'Standard = si gira quando il mix inizia a fare bolle, circa 90 secondi.',
    },
    {
      id: 'tm-016',
      question: 'Pancake: quanti pancake compongono una porzione completa?',
      options: ['1', '2', '3', '5'],
      correct: 2,
      explain: 'Standard porzione = tre pancake (ripeti la dose tre volte).',
    },
    {
      id: 'tm-017',
      question: 'Blueberry Pancake: quale set �frutta� � corretto?',
      options: ['1 fragola (in 4) + 7�8 blueberries', '2 fragole + 3 blueberries', '1 fragola + 12 blueberries', '0 fragole + 7�8 blueberries'],
      correct: 0,
      explain: 'La presentazione standard usa 1 fragola tagliata e 7�8 mirtilli.',
    },
    {
      id: 'tm-018',
      question: 'BYO Pancake: quale abbinamento �dry ingredient� � coerente con standard?',
      options: ['Chocolate chips 3 tsp', 'Chocolate chips 1 tsp', 'Coconut chips 5 tsp', 'Whole nuts 12 pezzi'],
      correct: 0,
      explain: 'Standard BYO = chocolate chips 3 teaspoons (coconut chips 2 tsp, nuts 6�7).',
    },
    {
      id: 'tm-019',
      question: 'Porridge: qual è la dose latte standard?',
      options: ['80�90ml', '125�130ml', '175ml', '250ml'],
      correct: 1,
      explain: 'La base standard porridge usa 125�130ml di latte.',
    },
    {
      id: 'tm-020',
      question: 'Porridge: quanti misurini di oats?',
      options: ['1', '2', '3', '4'],
      correct: 1,
      explain: 'Lo standard prevede 2 misurini di porridge oats.',
    },
    {
      id: 'tm-021',
      question: 'Porridge: quanto tempo lasci �settare� dopo aver mescolato?',
      options: ['10 sec', '30 sec', '2 min', '5 min'],
      correct: 1,
      explain: 'Lo standard prevede 30 secondi di assestamento prima del servizio.',
    },
    {
      id: 'tm-022',
      question: 'Afternoon Tea Set: quale combinazione � corretta?',
      options: ['Buontalenti + strawberry jam + 2 teapots', 'Matcha + honey + 1 teapot', 'Lemon + marmellata d�arancia + 3 teapots', 'Strawberry + pistacchio sauce + 1 teapot'],
      correct: 0,
      explain: 'Il set standard include Buontalenti con wafer, strawberry jam e servizio t� con 2 teapots.',
    },
    {
      id: 'tm-023',
      question: 'Gelato cups: un �Medio� pu� contenere quanti gusti?',
      options: ['Solo 1', '1�2', '1�3', '1�5'],
      correct: 1,
      explain: 'Standard Medio = 1�2 gusti (140g nominali).',
    },
    {
      id: 'tm-024',
      question: 'Se un Medio cup pesa 170g, come lo valuti rispetto al range standard?',
      options: ['Dentro range', 'Fuori range perché supera max', 'Fuori range perché sotto min', 'Non esiste un range'],
      correct: 1,
      explain: 'Per Medio il massimo standard � 160g, quindi 170g � oltre soglia.',
    },
    {
      id: 'tm-025',
      question: 'Se un Piccolo cup pesa 115g, come lo valuti?',
      options: ['Sotto min', 'Dentro range', 'Sopra max', 'Non misurabile'],
      correct: 1,
      explain: 'Piccolo ha range 100�120g, quindi 115g � corretto.',
    },
    {
      id: 'tm-026',
      question: '�Mega� (linea portioning): qual è il massimo standard?',
      options: ['160g', '200g', '240g', '300g'],
      correct: 2,
      explain: 'Nella tabella portioning, Mega ha max 240g.',
    },
    {
      id: 'tm-027',
      question: 'Coni: quale frase � corretta?',
      options: ['Il gluten free consente 3 gusti', 'Il choco cone consente 1�2 gusti a 140g', 'Il Piccolo cone � 140g', 'I coni non hanno grammi'],
      correct: 1,
      explain: 'Choco cone = 1�2 gusti, 140g.',
    },
    {
      id: 'tm-028',
      question: 'Take-me-home boxes: quale set �taglia ? max gusti� � corretto?',
      options: ['Piccolo 1�3, Medio 1�4, Grande 1�5', 'Piccolo 1�2, Medio 1�3, Grande 1�4', 'Piccolo 1�5, Medio 1�3, Grande 1�4', 'Piccolo 1�4, Medio 1�5, Grande 1�6'],
      correct: 0,
      explain: 'Standard box = 500ml (1�3), 750ml (1�4), 1000ml (1�5).',
    },
    {
      id: 'tm-029',
      question: 'Box gelato: qual è la priorit� per evitare difetti visivi e strutturali?',
      options: ['Lasciare aria per �morbidezza�', 'Spingere il gelato dentro evitando air bubbles', 'Non pulire i bordi per velocit�', 'Mettere subito il nastro prima del coperchio'],
      correct: 1,
      explain: 'Lo standard � riempire comprimendo e senza bolle d�aria.',
    },
    {
      id: 'tm-030',
      question: 'Box gelato: quale azione � corretta per la chiusura?',
      options: ['Sigillare con Badiani tape sul punto box-lid', 'Avvolgere con alluminio', 'Usare elastico', 'Lasciare aperto e mettere in borsa'],
      correct: 0,
      explain: 'Lo standard di sicurezza/tenuta usa Badiani tape sul contatto box-lid.',
    },
    {
      id: 'tm-031',
      question: 'Box gelato: quale priorit� riduce contaminazioni in laboratorio/servizio?',
      options: ['Servire sempre i gusti cremosi prima dei sorbetti', 'Servire sempre i sorbetti prima', 'Mescolare sorbetto e crema nella stessa paletta senza lavare', 'Non cambiare mai utensili'],
      correct: 1,
      explain: 'Lo standard prevede di porzionare sorbetti per primi per minimizzare contaminazione.',
    },
    {
      id: 'tm-032',
      question: 'Vetrina treats: qual è il requisito minimo temperatura?',
      options: ['-5�C', '-10�C', '-14�C', '-18�C'],
      correct: 2,
      explain: 'La vertical vitrine deve stare almeno a -14�C.',
    },
    {
      id: 'tm-033',
      question: 'Vetrina treats: come imposti la disposizione �visiva� corretta?',
      options: ['Cakes in basso, cookies in alto', 'Tutto in alto', 'Cakes in alto, cookies e Pinguinos in basso', 'Cookies in alto, cakes in basso'],
      correct: 2,
      explain: 'Standard display = cakes in alto (adult-eye level), cookies/Pinguinos in basso (kids-eye level).',
    },
    {
      id: 'tm-034',
      question: 'Shelf life treats: quale coppia corretta?',
      options: ['Cookies 35 giorni', 'Mini cones 21 giorni', 'Mini cakes 14 giorni', 'Pinguinos 21 giorni'],
      correct: 1,
      explain: 'Standard shelf life = mini cones 21 giorni (cookies 14, pinguinos 35).',
    },
    {
      id: 'tm-035',
      question: 'Gelato display morning prep: quale azione viene prima di mettere i gelati a display?',
      options: ['Mettere i gelati subito', 'Pulire vetrina con acqua calda + sanitiser giallo e far brillare metalli con blue spray/blue roll', 'Solo passare un panno asciutto', 'Togliere le porte e lasciarle off'],
      correct: 1,
      explain: 'Lo standard prevede pulizia/sanificazione e finitura �shine� prima dell�esposizione.',
    },
    {
      id: 'tm-036',
      question: 'Temperatura di esposizione gelato (vetrina): quando inizi a mettere i gelati?',
      options: ['A 0�C', 'A -5�C', 'A -14/-15�C', 'A -25�C'],
      correct: 2,
      explain: 'Lo standard di servizio indica -14/-15�C per l�esposizione.',
    },
    {
      id: 'tm-037',
      question: 'Scampolo: quale definizione � corretta?',
      options: ['Quando resta meno di met� vaschetta', 'Quando resta meno di 1/4 di vaschetta', 'Quando resta meno di 1/10', 'Quando il gusto � duro'],
      correct: 1,
      explain: 'Scampolo = meno di 1/4 rimasto, quindi va sostituito.',
    },
    {
      id: 'tm-038',
      question: 'Scampolo: quale tecnica di integrazione � corretta?',
      options: ['Aggiungere tutto in una volta', 'Aggiungere circa 100g per volta e livellare', 'Aggiungere solo topping', 'Sciogliere e ricongelare'],
      correct: 1,
      explain: 'Lo standard prevede aggiunte graduali (~100g) e livellamento finale.',
    },
    {
      id: 'tm-039',
      question: 'Scampolo: quale limite massimo di �altezza aggiunta� � corretto?',
      options: ['1�2 cm', '3�4 cm', '5�7 cm', '10�12 cm'],
      correct: 2,
      explain: 'Lo standard pone limite massimo 5�7 cm.',
    },
    {
      id: 'tm-040',
      question: 'Manutenzione vetrina: quale frequenza � corretta?',
      options: ['Deep clean ogni giorno', 'Deep clean una volta a settimana', 'Deep clean una volta al mese', 'Mai deep clean'],
      correct: 1,
      explain: 'Lo standard prevede deep clean settimanale e filtri settimanali.',
    },
    {
      id: 'tm-041',
      question: 'Manutenzione vetrina: se il negozio � poco trafficato, come gestisci le sliding doors?',
      options: ['Le lasci aperte', 'Le tieni in posizione per preservare temperatura', 'Le rimuovi', 'Le blocchi con nastro'],
      correct: 1,
      explain: 'Lo standard richiede sliding doors in posizione per mantenere temperatura.',
    },
    {
      id: 'tm-042',
      question: 'Smoothie: qual è il parametro comune a Rosso/Verde/Giallo?',
      options: ['250ml apple juice', '250ml latte', '100ml acqua', '500ml succo'],
      correct: 0,
      explain: 'Lo standard smoothie usa 250ml di apple juice in tutte le varianti.',
    },
    {
      id: 'tm-043',
      question: 'Smoothie: quale �match colore sticker� � corretto?',
      options: ['Rosso Berry ? green sticker', 'Verde Boost ? pink sticker', 'Giallo Passion ? yellow sticker', 'Giallo Passion ? pink sticker'],
      correct: 2,
      explain: 'Standard sticker = Rosso/pink, Verde/green, Giallo/yellow.',
    },
    {
      id: 'tm-044',
      question: 'Premade matcha big batch: quante porzioni produce?',
      options: ['1', '5', '10', '20'],
      correct: 2,
      explain: 'Lo standard big batch � dichiarato per 10 portions.',
    },
    {
      id: 'tm-045',
      question: 'Premade matcha: shelf life corretta (incluso giorno di preparazione)?',
      options: ['1 giorno', '2 giorni', '3 giorni', '7 giorni'],
      correct: 0,
      explain: 'Lo standard premade matcha � 1 day includendo il giorno di preparazione.',
    },
    {
      id: 'tm-046',
      question: 'Premade matcha: qual è l�azione �anti-grumi� pi� importante?',
      options: ['Bollire la polvere', 'Setacciare (sift) la matcha', 'Aggiungere ghiaccio', 'Mescolare con cucchiaio'],
      correct: 1,
      explain: 'Lo standard prevede setaccio per evitare lumps prima di whiskare.',
    },
    {
      id: 'tm-047',
      question: 'Matcha Iced Latte: quale combinazione base � corretta?',
      options: ['200ml milk + 25ml premade matcha', '175ml milk + 50ml premade matcha', '250ml milk + 10ml premade matcha', '100ml milk + 100ml premade matcha'],
      correct: 0,
      explain: 'La ricetta standard usa 200ml milk e 25ml premade matcha (ice fino alla linea).',
    },
    {
      id: 'tm-048',
      question: 'Matcha Iced Latte: qual è l�opzione �su richiesta� (non obbligatoria)?',
      options: ['Premade matcha', 'Ice', 'Vanilla syrup (1 pump)', 'Milk'],
      correct: 2,
      explain: 'La ricetta prevede 1 pump vanilla syrup come optional.',
    },
    {
      id: 'tm-049',
      question: 'Buontalenti/Strawberry Iced (matcha): qual è la quantit� latte principale?',
      options: ['200ml', '175ml', '150ml', '250ml'],
      correct: 1,
      explain: 'La variante con gelato prevede 175ml milk nella cup.',
    },
    {
      id: 'tm-050',
      question: 'Buontalenti/Strawberry Iced (matcha): come prepari la schiuma topping gelato?',
      options: ['Blender', 'Forchetta in milkshake cup con 50ml latte', 'Shaker con ghiaccio', 'Microonde'],
      correct: 1,
      explain: 'Lo standard � whisk con forchetta e 50ml milk, non blender.',
    },
    {
      id: 'tm-051',
      question: 'Buontalenti/Strawberry Iced (matcha): qual è il massimo gelato consentito?',
      options: ['50g', '80g', '120g', '180g'],
      correct: 1,
      explain: 'Lo standard impone 80g max per la scoop in questa bevanda.',
    },
    {
      id: 'tm-052',
      question: 'Dirty Matcha Affogato: cosa lo rende �dirty�?',
      options: ['Premade matcha', 'Double espresso sopra matcha gelato', 'Latte di cocco', 'Apple juice'],
      correct: 1,
      explain: 'Lo standard dirty = matcha gelato + double shot espresso.',
    },
    {
      id: 'tm-053',
      question: 'Matcha Matcha Affogato: cosa versi sopra la scoop di matcha gelato?',
      options: ['25ml premade matcha', '50ml acqua', '200ml latte', '1 pump vanilla'],
      correct: 0,
      explain: 'Lo standard prevede 25ml di premade matcha.',
    },
    {
      id: 'tm-054',
      question: 'Buontalenti Matcha Affogato: quale gelato � usato?',
      options: ['Buontalenti', 'Matcha', 'Strawberry', 'Lemon'],
      correct: 0,
      explain: 'Lo standard usa Buontalenti gelato con 25ml premade matcha.',
    },
    {
      id: 'tm-055',
      question: 'Cocktail pouches: quale formula base � comune?',
      options: ['50ml alcol + 50ml liquido + 3 scoops + ghiaccio fino alla linea', '25ml alcol + 25ml acqua + 1 scoop', '100ml alcol senza ghiaccio', 'Solo gelato frullato'],
      correct: 0,
      explain: 'Lo standard ricette cocktail pouches usa 50ml shot, 50ml water (o coconut milk per Pi�a Colada), 3 scoops e ghiaccio fino al ridge line.',
    },
    {
      id: 'tm-056',
      question: 'Strawberry Daiquiri: quale alcol � previsto?',
      options: ['Vodka', 'White Rum', 'Aperol', 'Gin'],
      correct: 1,
      explain: 'Lo standard Strawberry Daiquiri usa 50ml white rum.',
    },
    {
      id: 'tm-057',
      question: 'Frozen Lemonade: quale alcol � previsto?',
      options: ['Vodka', 'White Rum', 'Aperol', 'Whisky'],
      correct: 0,
      explain: 'Lo standard Frozen Lemonade usa 50ml vodka.',
    },
    {
      id: 'tm-058',
      question: 'Frozen Aperol: quale ingrediente alcolico compare?',
      options: ['Aperol', 'Vodka', 'White Rum', 'Gin'],
      correct: 0,
      explain: 'Lo standard Frozen Aperol usa 50ml Aperol.',
    },
    {
      id: 'tm-059',
      question: 'Pi�a Colada: quale �milk� � previsto al posto dell�acqua?',
      options: ['Oat milk', 'Coconut milk', 'Whole milk', 'Soy milk'],
      correct: 1,
      explain: 'Lo standard Pi�a Colada usa 50ml coconut milk.',
    },
    {
      id: 'tm-060',
      question: 'Churros: quale triade � corretta?',
      options: ['180�C + 6 churros + 5 min', '190�C + 8 churros + 8�9 min', '200�C + 10 churros + 2 min', '170�C + 8 churros + 15 min'],
      correct: 1,
      explain: 'Standard churros = 190�C, porzione 8, frittura 8�9 min.',
    },
    {
      id: 'tm-061',
      question: 'Coating churros: quale rapporto � corretto?',
      options: ['600g zucchero + 20g cannella', '600g cannella + 20g zucchero', '300g zucchero + 30g cannella', '500g zucchero + 50g cannella'],
      correct: 0,
      explain: 'Lo standard coating � 600g white sugar e 20g cinnamon.',
    },
    {
      id: 'tm-062',
      question: 'Panettone warm slice: qual è la sequenza corretta?',
      options: ['Olio ? 10 sec ? flip ? 10 sec', '10 sec ? flip ? 10 sec (senza olio)', '20 sec un lato solo', '5 sec e basta'],
      correct: 1,
      explain: 'Lo standard scalda 10 sec per lato e vieta l�olio.',
    },
    {
      id: 'tm-063',
      question: 'Pandoro: quale finitura �base� � corretta?',
      options: ['Sale', 'Cacao amaro', 'Zucchero a velo', 'Sciroppo d�acero'],
      correct: 2,
      explain: 'Lo standard prevede zucchero a velo sulla fetta.',
    },
    {
      id: 'tm-064',
      question: 'Mini panettone in-store: quale coppia �azione + quantit� salsa� � corretta?',
      options: ['Prendi dalla vertical vitrina + riempi espresso cup 1/3', 'Prendi dal forno + riempi espresso cup piena', 'Prendi dalla cassa + riempi espresso cup 1/10', 'Prendi dal frigo + riempi espresso cup 2/3'],
      correct: 0,
      explain: 'Lo standard prevede prelievo dalla vertical vitrina (con guanti) e salsa 1/3 espresso cup.',
    },
    {
      id: 'tm-065',
      question: 'Delivery mini panettone: qual è il layout corretto nella treat box?',
      options: ['Sauce pot in un angolo', 'Panettoni al centro, salsa fuori', 'Un panettone per angolo e sauce pot al centro', 'Tutto mescolato'],
      correct: 2,
      explain: 'Lo standard posiziona i mini panettoni negli angoli e la salsa al centro.',
    },
    {
      id: 'tm-066',
      question: 'Delivery mini panettone: quando va conservata la box in attesa del driver?',
      options: ['A temperatura ambiente', 'In frigo', 'In freezer', 'Nel forno spento'],
      correct: 2,
      explain: 'Lo standard prevede che la box vada in freezer finch� arriva il driver.',
    },
    {
      id: 'tm-067',
      question: 'Mulled wine: quale setup evita errori meccanici?',
      options: ['Inner container che galleggia', 'Inner container inserito senza acqua', 'Inner container inserito correttamente e non deve galleggiare', 'Nessun inner container'],
      correct: 2,
      explain: 'Lo standard specifica che l�inner container non deve �float�.',
    },
    {
      id: 'tm-068',
      question: 'Mulled wine: quale warm-up � corretto?',
      options: ['Level 10 per 5 minuti', 'Level 10 per 25�30 minuti', 'Level 5 per 60 minuti', 'Dial 6/7 subito senza warm-up'],
      correct: 1,
      explain: 'Lo standard scalda a livello 10 per 25�30 min, poi imposta dial 6/7.',
    },
    {
      id: 'tm-069',
      question: 'Mulled wine: quale garnish � standard in servizio?',
      options: ['Cannella in stecca', 'Fetta d�arancia', 'Menta', 'Lime'],
      correct: 1,
      explain: 'Lo standard prevede una fetta d�arancia nella cup.',
    },
    {
      id: 'tm-070',
      question: 'Mulled wine: quale shelf life � corretta?',
      options: ['Scaldato: 30 giorni; In-box: 3 giorni', 'Scaldato: 3 giorni; In-box: 30 giorni', 'Scaldato: 7 giorni; In-box: 7 giorni', 'Scaldato: 1 giorno; In-box: 14 giorni'],
      correct: 1,
      explain: 'Standard = 3 giorni dal primo warm-up (macchina) e 30 giorni dalla prima apertura (box).',
    },
    {
      id: 'tm-071',
      question: 'Slitti: in che anno nasce come torrefazione?',
      options: ['1932', '1969', '1988', '1990'],
      correct: 1,
      explain: 'La fondazione come coffee roasting company � nel 1969.',
    },
    {
      id: 'tm-072',
      question: 'Slitti: quando Andrea espande la produzione al cioccolato?',
      options: ['1988', '1990', '1994', '2008'],
      correct: 1,
      explain: 'Lo standard storico indica il passaggio al cioccolato nel 1990.',
    },
    {
      id: 'tm-073',
      question: 'Slitti: quale premio � associato al 1994?',
      options: ['Eurochocolate Award', 'Grand Prix International de la Chocolaterie', 'Best chocolatier in Italy', 'Nessuno'],
      correct: 1,
      explain: 'Nel 1994 � associato il Grand Prix International de la Chocolaterie.',
    },
    {
      id: 'tm-074',
      question: 'Slitti: quale pralina contiene alcol e quanto?',
      options: ['Passion fruit 1.5%', 'Irish Coffee 0.9%', 'Origin 0%', 'Tutte 0.9%'],
      correct: 1,
      explain: 'La pralina Irish Coffee contiene 0.9% di alcol.',
    },
    {
      id: 'tm-075',
      question: 'Slitti Coffee Spoons: in che anno vengono create?',
      options: ['1969', '1988', '1993', '2008'],
      correct: 2,
      explain: 'Le �Coffee Spoons� sono create nel 1993.',
    },
    {
      id: 'tm-076',
      question: 'Dragee Pistacchi di Bronte: come sono descritti?',
      options: ['Solo cioccolato fondente', 'Pistacchi tostati coperti da strato di cioccolato bianco e latte, finiti con zucchero a velo', 'Pistacchi salati senza copertura', 'Pistacchi al caramello salato'],
      correct: 1,
      explain: 'Lo standard descrive Bronte pistachios tostati con copertura white + milk chocolate e finitura zucchero a velo.',
    },
    {
      id: 'tm-077',
      question: 'Dragee �Grani di Arabica�: quale copertura � citata?',
      options: ['64% dark chocolate', '45% milk chocolate', '82% dark chocolate', 'White chocolate'],
      correct: 0,
      explain: 'I grani di Arabica sono coperti con un sottile strato di 64% dark chocolate.',
    },
    {
      id: 'tm-078',
      question: 'Spread Slittosa: percentuale nocciole Langhe?',
      options: ['37%', '51%', '57%', '64%'],
      correct: 0,
      explain: 'Slittosa � descritta con 37% di nocciole delle Langhe.',
    },
    {
      id: 'tm-079',
      question: 'Spread Riccosa: percentuale nocciole Langhe?',
      options: ['37%', '51%', '57%', '73%'],
      correct: 1,
      explain: 'Riccosa � descritta con 51% di nocciole delle Langhe.',
    },
    {
      id: 'tm-080',
      question: 'Spread Gianera: percentuale nocciole Langhe?',
      options: ['37%', '51%', '57%', '82%'],
      correct: 2,
      explain: 'Gianera � descritta con 57% di nocciole delle Langhe.',
    },
    {
      id: 'tm-081',
      question: 'Yo-Yo: qual è la porzione gelato standard?',
      options: ['50�60g', '70g', '80�90g', '120g'],
      correct: 2,
      explain: 'Lo standard Yo-Yo � una scoop circa 80/90g tra due wafers.',
    },
    {
      id: 'tm-082',
      question: 'Yo-Yo: quale combo � corretta per il servizio?',
      options: ['Senza guanti, 1 wafer', 'Guanti + tool + 2 wafers', 'Solo spatola gelato', 'Solo coppetta'],
      correct: 1,
      explain: 'Lo standard prevede guanti, tool e due wafers per chiusura.',
    },
    {
      id: 'tm-083',
      question: 'Yo-Yo: quale pratica evita un risultato �sbordato�?',
      options: ['Fare due scoops', 'Porzionare con precisione e non far overflow', 'Premere con forza', 'Sciogliere il gelato'],
      correct: 1,
      explain: 'La regola � porzionare con precisione evitando overflow.',
    },
    {
      id: 'tm-084',
      question: 'Gelato box: quale azione migliora l�ordine e la pulizia in consegna?',
      options: ['Non pulire i bordi', 'Pulire i bordi con blue roll e rimuovere eccessi', 'Mettere topping sui bordi', 'Riempire oltre il bordo'],
      correct: 1,
      explain: 'Lo standard prevede pulizia dei bordi del box prima di servire.',
    },
    {
      id: 'tm-085',
      question: 'Gelato box: quale logica di riempimento � corretta quando hai gusti molto morbidi e gusti pi� �tenaci�?',
      options: ['Mettere prima i gusti morbidi', 'Mettere prima i gusti duri', 'Alternare a caso', 'Solo sorbetti'],
      correct: 0,
      explain: 'Lo standard suggerisce di �push soft flavours first� nel box.',
    },
    {
      id: 'tm-086',
      question: 'Coppa gelato: quale strumento � usato per fare le tre palline?',
      options: ['Scoop spatula', 'Round scooper', 'Mestolo', 'Spatola piatta'],
      correct: 1,
      explain: 'La coppa prevede �round scooper� per le tre balls.',
    },
    {
      id: 'tm-087',
      question: 'Morning prep: prima di riutilizzare spatole �di pulizia� su altri gusti, cosa fai?',
      options: ['Nulla', 'Lavare e asciugare con blue roll', 'Solo sciacquare', 'Metterle in freezer'],
      correct: 1,
      explain: 'Lo standard impone lavaggio dopo ogni uso e asciugatura con blue roll prima di passare ad altri gusti.',
    },
    {
      id: 'tm-088',
      question: 'Deep clean vetrina: quale step � parte della sequenza?',
      options: ['Aggiungere olio alle superfici', 'Rimuovere briciole/noci e residui dentro la macchina', 'Mettere ghiaccio', 'Spegnere e non pulire'],
      correct: 1,
      explain: 'La deep clean include rimozione di nuts/crumbs e residui, poi sanificazione.',
    },
    {
      id: 'tm-089',
      question: 'Deep clean vetrina: cosa �brilla� alla fine del ciclo?',
      options: ['Solo le etichette', 'Le superfici con blue spray e blue roll', 'Il pavimento', 'Le mani'],
      correct: 1,
      explain: 'Lo standard prevede finishing con blue spray/blue roll per far brillare le superfici.',
    },
    {
      id: 'tm-090',
      question: 'Smoothie: tempo minimo di blending indicativo?',
      options: ['10 sec', '20 sec', '30 sec', '90 sec'],
      correct: 2,
      explain: 'Lo standard indica 30 secondi o fino a consistenza smooth.',
    },
    {
      id: 'tm-091',
      question: 'Matcha iced latte: perché si versa lentamente la premade matcha su latte e ghiaccio?',
      options: ['Per scaldare la bevanda', 'Per creare un pattern visivo', 'Per sciogliere il gelato', 'Per aumentare lo zucchero'],
      correct: 1,
      explain: 'La procedura standard punta a creare un pattern versando lentamente.',
    },
    {
      id: 'tm-092',
      question: 'Buontalenti/Strawberry iced (matcha): dove deve �sedere� il topping gelato?',
      options: ['Sul fondo', 'A met�', 'Sopra, come strato superiore', 'Fuori dal bicchiere'],
      correct: 2,
      explain: 'Lo standard � versare il topping lentamente cos� resta sopra la bevanda.',
    },
    {
      id: 'tm-093',
      question: 'Cocktail pouches: quanti �large ice cubes� sono indicati come riferimento?',
      options: ['2', '4', '~6', '10'],
      correct: 2,
      explain: 'Lo standard indica ghiaccio fino al ridge line, circa 6 cubi grandi.',
    },
    {
      id: 'tm-094',
      question: 'Mulled wine: dove si conserva la miscela la notte dopo raffreddamento?',
      options: ['A temperatura ambiente', 'In freezer', 'In frigo', 'In macchina accesa'],
      correct: 2,
      explain: 'Lo standard prevede raffreddare, coprire con cling film e conservare in frigo.',
    },
    {
      id: 'tm-095',
      question: 'Mulled wine: quale pulizia � corretta a fine servizio?',
      options: ['Solo esterno macchina', 'Lavare inner container e lid con sapone e acqua calda + asciugare', 'Spruzzare profumo', 'Non pulire'],
      correct: 1,
      explain: 'Lo standard prevede lavaggio dei componenti interni e pulizia esterna con panno umido.',
    },
    {
      id: 'tm-096',
      question: 'Panettone/Pandoro: quale azione aumenta l�appeal �al banco�?',
      options: ['Servire sempre freddo senza opzioni', 'Chiedere se lo vogliono warm e tostare 10 sec per lato', 'Friggerlo', 'Mettere olio sulla piastra'],
      correct: 1,
      explain: 'Lo standard prevede opzione warm slice con tostatura 10+10 sec senza olio.',
    },
    {
      id: 'tm-097',
      question: 'Gelato cups: quale affermazione � coerente con il servizio (tecnica)?',
      options: ['Si prende la coppetta dal bordo', 'Si pressa delicatamente per togliere air bubbles', 'Non si usa mai wafer', 'Si mescola il gelato con acqua'],
      correct: 1,
      explain: 'Lo standard prevede pressare delicatamente per ridurre air bubbles e migliorare resa.',
    },
    {
      id: 'tm-098',
      question: 'Gelato cones: quale upsell � coerente con lo standard?',
      options: ['Non proporre nulla', 'Proporre whipped cream o passare al cono chocolate', 'Proporre solo acqua', 'Proporre spezie salate'],
      correct: 1,
      explain: 'Lo standard suggerisce upsell con whipped cream o cono chocolate.',
    },
    {
      id: 'tm-099',
      question: 'Slitti: quale affermazione � corretta sulle coffee spoons?',
      options: ['Ricetta pubblica e replicabile', 'Ricetta segreta e �first True Spoons�', 'Solo gusto fragola', 'Create nel 2008'],
      correct: 1,
      explain: 'Sono descritte come originali, ricetta segreta e prime �True Spoons�.',
    },
    {
      id: 'tm-100',
      question: 'Slitti: quale combinazione �spalmabile ? tipo� � corretta?',
      options: ['Riccosa = dark chocolate cream', 'Gianera = milk chocolate cream', 'Slittosa = cocoa spread', 'Slittosa = solo latte'],
      correct: 2,
      explain: 'Slittosa � descritta come cocoa spread, mentre Riccosa � milk chocolate cream e Gianera dark chocolate cream.',
    },
  ];

  // Super-easy pool (sm-001 .. sm-100). Base text is intentionally minimal; UI will pull i18n.
  const SM_CORRECT_ANSWERS = [2, 2, 0, 1, 0, 1, 1, 1, 1, 2, 1, 1, 1, 0, 2, 2, 0, 0, 1, 1, 1, 0, 1, 1, 1, 2, 1, 0, 1, 0, 1, 2, 2, 1, 1, 2, 1, 1, 2, 1, 1, 0, 2, 2, 0, 1, 0, 2, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 1, 2, 0, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 2, 1, 0, 0, 1, 2, 2, 1, 1, 1, 0, 1, 1, 1, 1, 2, 1, 2, 2, 2, 1, 1, 1, 1, 1, 2];

  const SUPER_EASY_QUESTIONS = Array.from({ length: 100 }, (_, idx) => ({
    id: `sm-${String(idx + 1).padStart(3, '0')}`,
    question: '',
    options: ['', '', '', ''],
    explain: '',
    correct: SM_CORRECT_ANSWERS[idx],
  }));
  // NOTE: "Sfida continua" was an experimental extra flow that can pop up on every 3rd star.
  // It contains legacy questions (incl. "Sicurezza") and was confusing users who expect the
  // 3-star moment to be the tab-based Quiz Slot.
  // Keep the code for future iterations, but disable auto-trigger by default.
  const ENABLE_CONTINUOUS_CHALLENGE = false;
  const CHALLENGE_INTERVAL = 3;
  const CHALLENGE_QUESTIONS = [
    { id: 'c1', topic: 'Emergenza', question: 'Fumo dalla macchina espresso. Azioni primi 30 sec?', options: ['Spegni + estintore', 'Continuo', 'Chiamo tecnico'], correct: 0 },
    { id: 'c2', topic: 'Qualit�', question: 'Cliente dice: questo sa di detersivo. Possibili contaminazioni?', options: ['Pulizia mal risciacquata', 'Latte', 'Caffè'], correct: 0 },
    { id: 'c3', topic: 'Sicurezza', question: 'Coworker si scotta con steam wand. First aid?', options: ['Acqua fredda immediata', 'Ghiaccio', 'Niente'], correct: 0 },
    { id: 'c4', topic: 'Prodotto', question: 'Vetrina gelato -8�C invece -14�C. Procedura?', options: ['Ok', 'Chiama tecnico + check prodotti', 'Chiudo'], correct: 1 },
    { id: 'c5', topic: 'Inventario', question: 'Noti discrepanza inventario. Procedura?', options: ['Ignoro', 'Report + verifica', 'Aggiusto'], correct: 1 },
    { id: 'c6', topic: 'Team', question: 'Collega sembra ubriaco. Cosa fai?', options: ['Ignoro', 'Parlo con manager', 'Rido'], correct: 1 },
    { id: 'c7', topic: 'Cliente', question: 'Cliente minaccia recensione negativa. De-escalation?', options: ['Ignoro', 'Ascolto + soluzione', 'Minaccio'], correct: 1 },
    { id: 'c8', topic: 'Igiene', question: 'Noti collega non segue igiene. Come intervieni?', options: ['Ignoro', 'Richiamo gentile', 'Segnalo'], correct: 1 },
    { id: 'c9', topic: 'Prodotto', question: 'Delivery con prodotti danneggiati. Accetti?', options: ['S�', 'Rifiuto + foto', 'Accetto parziale'], correct: 1 },
    { id: 'c10', topic: 'Servizio', question: 'Cliente rovescia caffè bollente. Procedura?', options: ['Ignoro', 'First aid + report', 'Solo scuse'], correct: 1 },
    { id: 'c11', topic: 'Attrezzature', question: 'Grinder bloccato con chicchi. Come sblocchi?', options: ['Forzo', 'Spegni + pulisci', 'Continuo'], correct: 1 },
    { id: 'c12', topic: 'Conservazione', question: 'Frigo pasticceria non raffredda. Cosa salvi prima?', options: ['Tutto', 'Prodotti pi� deperibili', 'Niente'], correct: 1 },
    { id: 'c13', topic: 'POS', question: 'POS non funziona, cliente solo carta. Opzioni?', options: ['Rifiuto', 'Contanti o gratuito', 'Aspetto'], correct: 1 },
    { id: 'c14', topic: 'Sicurezza', question: 'Bambino corre verso vetrina calda. Azione?', options: ['Ignoro', 'Blocco + avviso genitore', 'Urlo'], correct: 1 },
    { id: 'c15', topic: 'Stock', question: 'Finisci coni gelato pomeriggio. Alternative?', options: ['Chiudo', 'Solo coppette + comunicazione', 'Uso altro'], correct: 1 },
    { id: 'c16', topic: 'Qualit�', question: 'Shot esce in 18 sec invece 28. Correttivo?', options: ['Ok', 'Grinder pi� fine', 'Rifaccio'], correct: 1 },
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
    // Shuffle-bag per quiz (evita ripetizioni fino a esaurimento anche quando il quiz pesca N domande a sessione).
    questionBagByMode: {},
    history: { quiz: [], days: [], totals: { stars: 0, gelati: 0, bonusPoints: 0 } },
    _lastBonusPoints: 0,
  };

  // Helper functions (must be declared before state initialization)
  const sanitizeQuizHistory = (list) => {
    if (!Array.isArray(list)) return [];
    return list
      .filter((item) => item && typeof item === 'object')
      .map((item) => ({
        ts: typeof item.ts === 'number' ? item.ts : Date.now(),
        prompt: typeof item.prompt === 'string' ? item.prompt : '',
        qid: item.qid || null,
        qtype: item.qtype || item.type || 'mcq',
        correct: item.correct === true,
        correctText: typeof item.correctText === 'string' ? item.correctText : '',
        explanation: typeof item.explanation === 'string' ? item.explanation : '',
        suggestion: typeof item.suggestion === 'string' ? item.suggestion : '',
        specHref: typeof item.specHref === 'string' ? item.specHref : undefined,
        specLabel: typeof item.specLabel === 'string' ? item.specLabel : undefined,
        topic: typeof item.topic === 'string' ? item.topic : undefined,
      }));
  };

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

  let state = loadState();
  let cardSerial = 0;
  let hubNodes = {};
  let overlayNodes = {};
  let lastFocus = null;
  let countdownTicker = null;
  let activePopover = null;
  let popoverHandlersBound = false;
  let infoHandlerBound = false;
  let wrongLogHandlerBound = false;
  let challengeActive = false;
  let pendingMilestoneCheck = false;
  let quizOnClose = false;

  function loadState() {
    const key = storageKey();
    const freshState = () => {
      const fresh = { ...defaultState };
      try {
        localStorage.setItem(key, JSON.stringify(fresh));
      } catch {
        /* ignore persist errors here; caller will keep in-memory fallback */
      }
      return fresh;
    };
    try {
      // Prefer per-profile storage
      let raw = localStorage.getItem(key);
      // Migrate from global key if present and no user state yet
      if (!raw) {
        const globalRaw = localStorage.getItem(GLOBAL_KEY);
        if (globalRaw) {
          localStorage.setItem(key, globalRaw);
          localStorage.removeItem(GLOBAL_KEY);
          raw = globalRaw;
        }
      }
      // Fallback to sessionStorage if localStorage blocked/quota
      if (!raw) {
        try {
          raw = sessionStorage.getItem(sessionKey());
        } catch {}
      }

      // Fallback to same-tab navigation via window.name (useful on file:// where origins differ per page)
      if (!raw) {
        const fromWindow = readWindowNameState();
        if (fromWindow) {
          try {
            const serialized = JSON.stringify(fromWindow);
            raw = serialized;
            // Persist to local/session if possible for next loads on the same origin
            try { localStorage.setItem(key, serialized); } catch {}
            try { sessionStorage.setItem(sessionKey(), serialized); } catch {}
          } catch {}
        }
      }
      if (!raw) return freshState();

      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (error) {
        console.warn('Gamification state parse error, resetting', error);
        try { localStorage.removeItem(key); } catch {}
        try { sessionStorage.removeItem(sessionKey()); } catch {}
        return freshState();
      }
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
          quiz: sanitizeQuizHistory(parsed.history?.quiz),
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
      try { localStorage.removeItem(key); } catch {}
      try { sessionStorage.removeItem(sessionKey()); } catch {}
      return freshState();
    }
  }

  const MAX_QUIZ_HISTORY = 300;
  const MAX_OPENED_TABS = 520;
  const MAX_TAB_CONTEXT = 220;
  const MAX_TAB_CONTEXT_CONTENT = 240;

  const trimArrayTail = (arr, max) => (Array.isArray(arr) ? arr.slice(-max) : []);
  const clampText = (value, max) => {
    const s = String(value || '');
    if (s.length <= max) return s;
    return `${s.slice(0, max - 1)}�`;
  };

  const trimObjectByRecentTs = (obj, max) => {
    if (!obj || typeof obj !== 'object') return {};
    const entries = Object.entries(obj);
    if (entries.length <= max) return obj;
    // Keep most recent based on ts if present, otherwise keep tail order.
    const sorted = entries.sort((a, b) => {
      const tsA = typeof a[1]?.ts === 'number' ? a[1].ts : 0;
      const tsB = typeof b[1]?.ts === 'number' ? b[1].ts : 0;
      return tsA - tsB;
    });
    const trimmed = sorted.slice(-max);
    const next = {};
    trimmed.forEach(([k, v]) => { next[k] = v; });
    return next;
  };

  const pruneStateForStorage = (value) => {
    const next = { ...value };

    // Trim quiz history (keep most recent)
    if (next.history) {
      if (Array.isArray(next.history.quiz)) {
        next.history = { ...next.history, quiz: trimArrayTail(next.history.quiz, MAX_QUIZ_HISTORY) };
      }
      if (Array.isArray(next.history.days)) {
        next.history = { ...next.history, days: trimArrayTail(next.history.days, 90) };
      }
    }

    // Trim openedTabsToday and tab context to avoid quota errors
    if (next.openedTabsToday && typeof next.openedTabsToday === 'object') {
      next.openedTabsToday = trimObjectByRecentTs(next.openedTabsToday, MAX_OPENED_TABS);
    }
    if (next.openedTabContextToday && typeof next.openedTabContextToday === 'object') {
      const trimmed = trimObjectByRecentTs(next.openedTabContextToday, MAX_TAB_CONTEXT);
      Object.keys(trimmed).forEach((k) => {
        const entry = trimmed[k];
        if (entry && typeof entry === 'object') {
          trimmed[k] = {
            ...entry,
            content: clampText(entry.content, MAX_TAB_CONTEXT_CONTENT),
            tabTitle: clampText(entry.tabTitle, 120),
            cardTitle: clampText(entry.cardTitle, 120),
          };
        }
      });
      next.openedTabContextToday = trimmed;
    }

    return next;
  };

  function saveState() {
    const key = storageKey();
    
    // Verify storage works before trying to save
    if (!testStorage()) {
      console.warn('?? Storage unavailable, state saved only to window.name');
      writeWindowNameState(state);
      return;
    }
    
    console.log('?? Saving state:', { stars: state.stars, gelati: state.gelati, quizTokens: state.quizTokens });
    
    try {
      const serialized = JSON.stringify(state);
      localStorage.setItem(key, serialized);
      try { sessionStorage.setItem(sessionKey(), serialized); } catch {}
      writeWindowNameState(state);
      console.log('? State saved successfully to all stores');
      return;
    } catch (error) {
      console.warn('?? Gamification state not persisted, attempting prune', error);
    }

    try {
      const pruned = pruneStateForStorage(state);
      const serialized = JSON.stringify(pruned);
      localStorage.setItem(key, serialized);
      try { sessionStorage.setItem(sessionKey(), serialized); } catch {}
      writeWindowNameState(pruned);
      state = pruned;
      console.log('? State saved after pruning');
    } catch (error) {
      console.warn('? Gamification state not persisted after pruning', error);
      try { sessionStorage.setItem(sessionKey(), JSON.stringify(state)); } catch {}
      writeWindowNameState(state);
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
    // Test storage and show warning if unavailable
    const hasStorage = testStorage();
    if (!hasStorage) {
      console.error('? localStorage is not available or blocked');
      console.error('?? Please open this site via http://localhost or a web server, not file://');
      showStorageWarning();
    } else {
      console.log('? localStorage is available');
    }
    
    ensureDailyState();
    initStoryOrbitRewards();
    buildHub();
    buildOverlay();
    maybeAutoOpenGameInfoFromUrl();
    updateUI();

    // Listen for external updates (e.g. from Berny Brain)
    document.addEventListener('badiani:gamification-updated', () => {
      console.log('[Gamification] External update received, reloading state...');
      state = loadState();
      updateUI();
      if (state.gelati >= GELATO_GOAL) {
        showVictoryMessage();
      }
    });

    formatStatListLabels();
    initProfileControls();
    ensureWrongLogHandler();
    checkStarMilestones();
    if (state.gelati >= GELATO_GOAL) {
      showVictoryMessage();
    }
  }
  
  function showStorageWarning() {
    try {
      const banner = document.createElement('div');
      banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:999999;background:#b91c1c;color:#fff;padding:12px 16px;text-align:center;font-size:14px;line-height:1.5;';
      banner.innerHTML = `
        <strong>Storage unavailable</strong><br>
        Progress will reset on navigation. Please open via http://localhost or a web server.
        <button onclick="this.parentElement.remove()" style="margin-left:16px;padding:4px 12px;background:#fff;color:#b91c1c;border:none;border-radius:4px;cursor:pointer;font-weight:600;">Dismiss</button>
      `;
      document.body.appendChild(banner);
    } catch {}
  }

  function maybeAutoOpenGameInfoFromUrl() {
    try {
      const params = new URLSearchParams(window.location.search || '');
      const open = String(params.get('open') || '').trim().toLowerCase();
      const wantsInfo = open === 'regolamento'
        || open === 'rules'
        || open === 'info'
        || open === 'game'
        || open === 'gameinfo';
      if (!wantsInfo) return;

      // Only after overlay is built.
      showGameInfo();

      // Clean URL (avoid re-opening on refresh / back-forward cache).
      try {
        params.delete('open');
        const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}${window.location.hash || ''}`;
        window.history.replaceState({}, '', next);
      } catch {}
    } catch {}
  }

  function ensureWrongLogHandler() {
    if (wrongLogHandlerBound) return;
    document.addEventListener('click', (event) => {
      const trigger = event.target.closest('[data-wrong-view-all]');
      if (!trigger) return;
      event.preventDefault();
      event.stopPropagation();
      openAllWrongLogModal();
    });
    wrongLogHandlerBound = true;
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
          <span class="nav-token__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path fill="currentColor" d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
            </svg>
          </span>
          <span class="nav-token__badge">
            <span class="nav-token__label" data-i18n="tokens.stars">${tr('tokens.stars', null, 'Stelline')}</span>
            <span class="nav-token__value reward-value" data-star-value data-current="0">0</span>
          </span>
        </button>
        <div class="reward-popover" data-popover-panel="stars" role="dialog" aria-label="Dettagli stelline" data-i18n-attr="aria-label:tokens.stars.detailsAria" hidden>
          <div class="reward-popover__header">
            <p class="reward-popover__label" data-i18n="tokens.progress">${tr('tokens.progress', null, 'Progressi')}</p>
            <span class="reward-progress" data-star-progress>0/${MAX_STARS}</span>
          </div>
          <p class="reward-popover__text">
            ${tr('tokens.stars.text', { perStar: CRYSTALS_PER_STAR }, `Apri i tab dentro una scheda: ogni tab svela 1 cristallo di zucchero. Ogni ${CRYSTALS_PER_STAR} cristalli (per singola scheda info) si fondono in 1 stellina.`)}
          </p>
          <button class="reward-popover__cta" type="button" data-quiz-launch hidden data-i18n="tokens.testMe">${tr('tokens.testMe', null, 'Test me')}</button>
          <p class="reward-popover__hint" data-i18n="tokens.stars.miniHint">${tr('tokens.stars.miniHint', null, '3 stelline = mini quiz (1 domanda). Se giusto sblocchi "Test me".')}</p>
          <button class="reward-popover__link" type="button" data-info-launch data-i18n="tokens.rulesFull">${tr('tokens.rulesFull', null, 'Regole complete')}</button>
        </div>
      </div>
      <div class="nav-token nav-token--gelato" data-gelato-token>
        <button class="nav-token__btn" type="button" aria-expanded="false" aria-haspopup="dialog" data-popover-toggle="gelato">
          <span class="nav-token__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path fill="currentColor" d="M12 2a5 5 0 0 0-5 5c0 1.1.36 2.12.97 2.95L10.2 22h3.6l2.23-12.05A4.98 4.98 0 0 0 17 7a5 5 0 0 0-5-5zm-2.1 8.2a5.1 5.1 0 0 0 4.2 0L12.9 20h-1.8L9.9 10.2z"/>
            </svg>
          </span>
          <span class="nav-token__badge">
            <span class="nav-token__label" data-i18n="tokens.gelati">${tr('tokens.gelati', null, 'Gelati')}</span>
            <span class="nav-token__value reward-value" data-gelato-value data-current="0">0</span>
          </span>
        </button>
        <div class="reward-popover" data-popover-panel="gelato" role="dialog" aria-label="Dettagli gelati" data-i18n-attr="aria-label:tokens.gelati.detailsAria" hidden>
          <p class="reward-popover__text">
            ${tr('tokens.gelati.text', null, 'Tre quiz perfetti = un gelato reale da riscattare con il trainer. Il timer ti impedisce gli sprint consecutivi.')}
          </p>
          <div class="reward-countdown" data-countdown hidden>
            <span class="countdown-label" data-i18n="tokens.cooldown">${tr('tokens.cooldown', null, 'Cooldown')}</span>
            <span class="countdown-digits" data-countdown-value>24:00:00</span>
          </div>
          <p class="reward-popover__hint reward-hint" data-cooldown-hint hidden></p>
          <button class="reward-popover__link" type="button" data-info-launch data-i18n="tokens.seeRules">${tr('tokens.seeRules', null, 'Vedi regolamento')}</button>
        </div>
      </div>
      <div class="nav-token nav-token--bonus" data-bonus-token>
        <button class="nav-token__btn" type="button" aria-expanded="false" aria-haspopup="dialog" data-popover-toggle="bonus">
          <span class="nav-token__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path fill="currentColor" d="M12 1l1.2 4.8L18 7l-4.8 1.2L12 13l-1.2-4.8L6 7l4.8-1.2L12 1zm7 10l.8 3.2L23 15l-3.2.8L19 19l-.8-3.2L15 15l3.2-.8L19 11zM5 11l.8 3.2L9 15l-3.2.8L5 19l-.8-3.2L1 15l3.2-.8L5 11z"/>
            </svg>
          </span>
          <span class="nav-token__badge">
            <span class="nav-token__label" data-i18n="tokens.bonus">${tr('tokens.bonus', null, 'Bonus')}</span>
            <span class="nav-token__value reward-value" data-bonus-value data-current="0">0</span>
          </span>
        </button>
        <div class="reward-popover" data-popover-panel="bonus" role="dialog" aria-label="Dettagli punti bonus" data-i18n-attr="aria-label:tokens.bonus.detailsAria" hidden>
          <p class="reward-popover__text">
            ${tr('tokens.bonus.text', { points: BONUS_POINTS_PER_FULL_SET }, `65 stelline azzerano il loop e assegnano +${BONUS_POINTS_PER_FULL_SET} punti bonus convertibili in cash o prodotti Badiani.`)}
          </p>
          <button class="reward-popover__link" type="button" data-info-launch data-i18n="tokens.howUnlock">${tr('tokens.howUnlock', null, 'Come si sblocca')}</button>
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
    eyebrow.textContent = tr('challenge.eyebrow', null, 'Sfida continua');

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
    hint.textContent = tr('challenge.hint', null, 'Rispondi subito: errore = -3 stelline.');

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
        applyChallengePenalty(challenge);
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

  function applyChallengePenalty(challenge = null) {
    // Log the mistake so it shows up in the Hub �Revisione � errore recente� list.
    // Also: immediately open the same review modal (like Test me) so the trainee knows exactly what to re-read.
    let lastItem = null;
    try {
      if (!state.history) state.history = { quiz: [] };
      if (!Array.isArray(state.history.quiz)) state.history.quiz = [];
      const review = buildChallengeReview(challenge);
      lastItem = {
        ts: Date.now(),
        correct: false,
        prompt: review.prompt,
        qid: challenge?.id || null,
        qtype: 'challenge',
        correctText: review.correctText,
        explanation: review.explanation,
        suggestion: review.suggestion,
        specHref: review.specHref,
        specLabel: review.specLabel,
        topic: challenge?.topic || null,
      };
      state.history.quiz.push(lastItem);
      if (state.history.quiz.length > 300) state.history.quiz = state.history.quiz.slice(-300);
    } catch (e) {}

    state.stars = Math.max(0, state.stars - CHALLENGE_INTERVAL);
    state.quizTokens = Math.max(0, state.quizTokens - CHALLENGE_INTERVAL);
    state.progress = state.stars;
    state.celebratedSets = Math.min(state.celebratedSets, getAvailableSets());
    saveState();
    updateUI();

    // Close the challenge overlay and show the review right away.
    // If something goes wrong, fall back to the old result flow.
    try {
      unlockOverlayClose();
      closeOverlay({ force: true });
      if (typeof showToast === 'function') showToast(tr('challenge.toast.lost', null, 'Sfida persa: -3 stelline. Rivedi subito la specifica.'));
      if (lastItem) {
        openWrongReviewModal(lastItem);
        return;
      }
    } catch (e) {}

    // Fallback (legacy)
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
    // Keep it font-safe and consistent across devices.
    burst.textContent = passed ? '\u2605' : '\u00D7';
    const title = document.createElement('h3');
    title.className = 'reward-modal__title';
    title.textContent = passed
      ? tr('challenge.result.winTitle', null, 'Sfida superata')
      : tr('challenge.result.loseTitle', null, 'Sfida persa: -3 stelline');
    const text = document.createElement('p');
    text.className = 'reward-modal__text';
    text.textContent = passed
      ? tr('challenge.result.winText', null, 'Ottimo! Conosci il playbook Badiani: continua a collezionare stelline senza perdere ritmo.')
      : tr('challenge.result.loseText', null, 'Niente panico: raccogli nuove schede e rientra subito nel giro delle stelline.');
    const actions = document.createElement('div');
    actions.className = 'reward-modal__actions';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'reward-action primary';
    btn.textContent = passed
      ? tr('challenge.result.winBtn', null, 'Continua')
      : tr('challenge.result.loseBtn', null, 'Ci riprovo');
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
        <button class="reward-overlay__close" type="button" data-overlay-close aria-label="Chiudi">&times;</button>
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

    // Mobile UX: allow dismissing the overlay by pulling down ("forzando lo scroll in basso")
    // when the overlay content is already at the top. Respects `data-lock-close`.
    try {
      let startY = 0;
      let armed = false;
      let scroller = null;
      const THRESHOLD = 72;

      const resolveScroller = (target) => {
        try {
          const content = target && target.closest ? target.closest('[data-overlay-content]') : null;
          if (content && content.scrollHeight > content.clientHeight + 2) return content;
        } catch (e) {}
        return overlayNodes.panel;
      };

      const onTouchStart = (e) => {
        try {
          if (!overlayNodes.overlay?.classList.contains('is-visible')) return;
          if (overlayNodes.panel?.dataset.lockClose === 'true') return;
          if (!e || !e.touches || e.touches.length !== 1) return;
          scroller = resolveScroller(e.target);
          startY = e.touches[0].clientY;
          armed = !!scroller && (scroller.scrollTop <= 0);
        } catch (err) {
          armed = false;
          scroller = null;
        }
      };

      const onTouchMove = (e) => {
        try {
          if (!armed || !scroller) return;
          if (overlayNodes.panel?.dataset.lockClose === 'true') {
            armed = false;
            scroller = null;
            return;
          }
          if (scroller.scrollTop > 0) {
            armed = false;
            scroller = null;
            return;
          }
          if (!e || !e.touches || e.touches.length !== 1) return;
          const dy = e.touches[0].clientY - startY;
          if (dy > THRESHOLD) {
            closeOverlay();
            armed = false;
            scroller = null;
          }
        } catch (err) {}
      };

      const onTouchEnd = () => {
        armed = false;
        scroller = null;
      };

      overlayNodes.panel?.addEventListener('touchstart', onTouchStart, { passive: true });
      overlayNodes.panel?.addEventListener('touchmove', onTouchMove, { passive: true });
      overlayNodes.panel?.addEventListener('touchend', onTouchEnd, { passive: true });
      overlayNodes.panel?.addEventListener('touchcancel', onTouchEnd, { passive: true });
    } catch (e) {}
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
    // Defer DOM updates during modal close to prevent scroll bounce
    if (window.__badianiDeferDOMUpdates) {
      window.__badianiPendingCardChecks = true;
      return;
    }
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
      // - ? once opened
      // - ? + golden button once the 5 crystals have converted to a star
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
            ind.textContent = '\u2605';
          btn.classList.add('is-starred');
          btn.classList.remove('is-opened');
        } else {
            ind.textContent = '\u2713';
          btn.classList.add('is-opened');
          btn.classList.remove('is-starred');
        }
      } catch (e) {}
    });
  }

  function renderSummary() {
    const root = document.querySelector('[data-summary]');
    if (!root) return;

    const uiLang = window.BadianiI18n?.getLang?.() || 'it';
    const uiLocale = ({ it: 'it-IT', en: 'en-GB', es: 'es-ES', fr: 'fr-FR' }[uiLang]) || undefined;
    // Profile info
    try {
      const user = window.BadianiProfile?.getActive?.() || null;
      if (user) {
        const nickNode = root.querySelector('[data-profile-nick]');
        const gelatoNode = root.querySelector('[data-profile-gelato]');
        if (nickNode) nickNode.textContent = user?.nickname || '';
        if (gelatoNode) gelatoNode.textContent = user?.gelato || '';
      }
    } catch {}
    const stars = state.stars || 0;
    const points = state.bonusPoints || 0;
    const gelati = state.gelati || 0;
    const quizHistory = sanitizeQuizHistory(state.history?.quiz);
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
    const wrongCountNode = root.querySelector('[data-wrong-count]');
    if (list) {
      list.innerHTML = '';
      const wrongAll = quizHistory.filter(q => q.correct === false);
      const wrongItems = wrongAll.slice(-10).reverse();
      if (wrongCountNode) {
        const total = wrongAll.length;
        wrongCountNode.textContent = total || '0';
        const viewAllBtn = root.querySelector('[data-wrong-view-all]');
        if (viewAllBtn) viewAllBtn.hidden = total === 0;
      }
      if (!wrongItems.length) {
        const li = document.createElement('li');
        li.className = 'empty';
        li.textContent = tr('cockpit.wrong.empty', null, 'Nessun errore recente - continua cos\u00EC!');
        list.appendChild(li);
      } else {
        wrongItems.forEach(item => {
          const localizedItem = localizeHistoryItem(item) || item;
          const li = document.createElement('li');
          const when = new Date(item.ts || Date.now());
          const date = when.toLocaleDateString(uiLocale);
          const time = when.toLocaleTimeString(uiLocale, { hour: '2-digit', minute: '2-digit' });
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'summary-list__btn';
          const prompt = localizedItem?.prompt || tr('quiz.generic', null, 'Quiz');
          btn.textContent = `${date} ${time} - ${prompt}`;
          btn.setAttribute('aria-label', tr('cockpit.wrong.reviewAria', { title: prompt }, `Apri revisione errore: ${prompt}`));
          btn.addEventListener('click', () => openWrongReviewModal(localizedItem));
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
        li.textContent = tr('cockpit.history.empty', null, 'Nessuna cronologia disponibile ancora.');
        daysRoot.appendChild(li);
      } else {
        days.forEach(d => {
          const li = document.createElement('li');
          li.textContent = `${d.date} | Stars: ${d.stars} | Cards: ${d.cardsOpened} | Correct: ${d.quizzes?.correct || 0} | Wrong: ${d.quizzes?.wrong || 0} | Gelati: ${d.gelati}`;
          daysRoot.appendChild(li);
        });
      }
    }
  }

  function getCorrectAnswerText(question) {
    if (!question) return '';
    if (question.type === 'order' && Array.isArray(question.steps)) {
      return question.steps.filter(Boolean).join(' -> ');
    }
    const correctIdx = getCorrectIndex(question);
    if (Array.isArray(question.options) && Number.isInteger(correctIdx)) {
      return question.options[correctIdx] || '';
    }
    return '';
  }

  function getCorrectIndex(question) {
    if (!question) return null;
    if (Number.isInteger(question.correct)) return question.correct;
    if (!Array.isArray(question.options) || question.options.length === 0) return null;

    // Heuristic fallback for questions that intentionally keep base text empty (e.g. sm-* where i18n provides text)
    // or legacy/experimental questions missing a `correct` index.
    const explain = String(question.explain ?? question.explanation ?? '').trim();
    const prompt = String(question.question ?? '').trim();

    const pick = inferCorrectIndexFromText(question.options, `${prompt} ${explain}`);
    if (Number.isInteger(pick)) {
      // Cache so grading/highlighting/review all stay consistent within the session.
      question.correct = pick;
      return pick;
    }
    return null;
  }

  function inferCorrectIndexFromText(options, blob) {
    if (!Array.isArray(options) || options.length === 0) return null;
    const text = String(blob || '').toLowerCase();
    if (!text) return null;

    // Pull high-signal numeric tokens: integers, decimals, fractions like 1/3, and ranges like 7�8.
    const numbers = new Set();
    const numMatches = text.match(/\b\d+(?:[\.,]\d+)?\b/g) || [];
    numMatches.forEach(n => numbers.add(n.replace(',', '.')));
    const fracMatches = text.match(/\b\d+\s*\/\s*\d+\b/g) || [];
    fracMatches.forEach(f => numbers.add(f.replace(/\s+/g, '')));
    const rangeMatches = text.match(/\b\d+\s*[�-]\s*\d+\b/g) || [];
    rangeMatches.forEach(r => numbers.add(r.replace(/\s+/g, '')));

    const norm = (s) => String(s || '').toLowerCase();
    let bestIdx = null;
    let bestScore = -1;

    options.forEach((opt, idx) => {
      const o = norm(opt);
      if (!o) return;

      let score = 0;

      // Strong signal: option string appears in the blob.
      if (o.length >= 6 && text.includes(o)) score += 6;

      // Numeric overlap
      numbers.forEach((n) => {
        if (!n) return;
        // try direct and a few common unit variants
        if (o.includes(n)) score += 5;
        if (o.includes(`${n}g`) || o.includes(`${n} g`)) score += 2;
        if (o.includes(`${n}ml`) || o.includes(`${n} ml`)) score += 2;
        if (o.includes(`${n}�c`) || o.includes(`${n} �c`)) score += 2;
        if (o.includes(`${n}s`) || o.includes(`${n} s`) || o.includes(`${n}sec`) || o.includes(`${n} sec`)) score += 1;
        if (o.includes(`${n}min`) || o.includes(`${n} min`)) score += 1;
      });

      // Mild signal: shared �standard-ish� keywords.
      const keywords = ['standard', 'min', 'minimum', 'repose', 'repos', 'power', 'ml', 'g', 'scoop', 'sec', 'minutes', 'minute', 'temp', '�c', 'fridge', 'frigo'];
      keywords.forEach((k) => {
        if (text.includes(k) && o.includes(k)) score += 1;
      });

      if (score > bestScore) {
        bestScore = score;
        bestIdx = idx;
      }
    });

    // Require a minimum confidence so we don't guess randomly.
    return bestScore >= 5 ? bestIdx : null;
  }

  function guessSpecFromPrompt(prompt = '') {
    const p = String(prompt || '').toLowerCase();
    const has = (...needles) => needles.some(n => p.includes(String(n).toLowerCase()));

    // Deep links (card + tab) for the most common �spec� questions.
    // These URLs land the trainee directly inside the relevant card modal and section.
    // NOTE: relies on the existing on-page deep-link handler (?card=...) and the new (?tab=...).
    if (
      has('take-me-home', 'take me home', 'gelato boxes', 'box piccolo', 'piccolo box') ||
      (has('box') && has('500', '500ml', '750', '750ml', '1000', '1000ml'))
    ) {
      return { href: 'gelato-lab.html?card=gelato-boxes&tab=parametri&center=1', label: 'Apri Gelato Boxes' };
    }

    // Cones: land directly on the Coni classici specs.
    // (Common prompt: "Coni: quale frase � corretta?")
    if (has('coni', 'cono', 'cone') || (has('choco') && has('cone')) || (has('gluten') && has('cone')) || (has('gf') && has('cone'))) {
      return { href: 'gelato-lab.html?card=coni-classici&tab=parametri&center=1', label: 'Apri Coni classici' };
    }

    if (has('churro', 'churros', 'panettone', 'pandoro', 'vin brulé', 'vin brule', 'vin chaud', 'mulled', 'vino caliente')) {
      if (has('mulled', 'vin brulé', 'vin brule', 'vin chaud', 'vino caliente')) {
        return { href: 'festive.html?q=mulled-wine-vin-brul', label: 'Apri Mulled Wine' };
      }
      if (has('pandoro')) return { href: 'festive.html?q=pandoro-classico', label: 'Apri Pandoro' };
      if (has('panettone')) return { href: 'festive.html?q=panettone-classico', label: 'Apri Panettone' };
      if (has('churro', 'churros')) return { href: 'festive.html?q=churros', label: 'Apri Churros' };
      return { href: 'festive.html', label: 'Apri Festive' };
    }

    if (has('espresso', 'cappuccino', 'americano', 'flat white', 'macchiato', 'shot', 'estrazione', 'grinder', 'steam', 'wand', 'portafiltro', 'tamper', 'latte')) {
      // Prefer stable card ids (no spaces) so deep-link.js can scroll reliably.
      if (has('cappuccino', 'steam', 'wand')) return { href: 'caffe.html?q=cappuccino', label: 'Apri Cappuccino' };
      if (has('macchiato')) return { href: 'caffe.html?q=macchiato-single', label: 'Apri Macchiato' };
      if (has('flat white')) return { href: 'caffe.html?q=flat-white', label: 'Apri Flat White' };
      if (has('americano')) return { href: 'caffe.html?q=americano', label: 'Apri Americano' };
      if (has('latte')) return { href: 'caffe.html?q=iced-latte', label: 'Apri Iced Latte' };
      // Default espresso tooling keywords.
      return { href: 'caffe.html?q=espresso-single', label: 'Apri Espresso Single' };
    }

    if (has('croissant', 'brownie', 'pastry', 'scone', 'loaf', 'cake', 'vetrina pasticceria')) {
      if (has('croissant')) return { href: 'pastries.html?q=croissants', label: 'Apri Croissants' };
      if (has('scone')) return { href: 'pastries.html?q=scones', label: 'Apri Scones' };
      if (has('brownie')) return { href: 'pastries.html?q=brownie', label: 'Apri Brownie' };
      if (has('loaf')) return { href: 'pastries.html?q=loaf', label: 'Apri Loaf' };
      if (has('cake')) return { href: 'pastries.html?q=cakes', label: 'Apri Cakes' };
      return { href: 'pastries.html', label: 'Apri Pastries' };
    }

    if (has('waffle', 'pancake', 'crepe', 'crêpe', 'porridge', 'dessert', 'sweet')) {
      if (has('waffle')) return { href: 'sweet-treats.html?q=waffles', label: 'Apri Waffles' };
      if (has('pancake')) return { href: 'sweet-treats.html?q=pancake', label: 'Apri Pancake' };
      if (has('crepe', 'crêpe')) return { href: 'sweet-treats.html?q=crepe-sauce', label: 'Apri Crepe' };
      return { href: 'sweet-treats.html', label: 'Apri Sweet Treats' };
    }

    if (has('slitti', 'yo-yo', 'yoyo')) {
      return { href: 'slitti-yoyo.html?q=slitti-timeline', label: 'Apri Slitti & Yo-Yo' };
    }
    // Affogati/affogato (es. Dirty Matcha Affogato) vivono in Bar & Drinks, non in Gelato Lab
    if (has('affogato', 'affogati', 'dirty matcha')) {
      return { href: 'caffe.html?q=affogato', label: 'Apri Affogato' };
    }
    if (has('gelato', 'buontalenti', 'vetrina', 'vaschetta', 'cristalli', 'spatol')) {
      if (has('buontalenti')) return { href: 'gelato-lab.html?q=cups', label: 'Apri Gelato Lab' };
      if (has('vaschetta')) return { href: 'gelato-lab.html?q=boxes', label: 'Apri Gelato Boxes' };
      if (has('cristalli')) return { href: 'gelato-lab.html?q=shelf-life-treats-dopo-esposizione', label: 'Apri Shelf Life (treats)' };
      if (has('vetrina', 'spatol')) return { href: 'gelato-lab.html?q=gelato-setup', label: 'Apri Gelato Setup' };
      return { href: 'gelato-lab.html', label: 'Apri Gelato Lab' };
    }
    if (has('story orbit', 'firenze', 'origine')) {
      return { href: 'story-orbit.html?q=story', label: 'Apri Story Orbit' };
    }
    return { href: 'index.html', label: 'Apri Hub' };
  }

  function autoExplainForQuiz(prompt = '', correctText = '') {
    const p = String(prompt || '').toLowerCase();
    const c = String(correctText || '');
    const has = (...needles) => needles.some(n => p.includes(String(n).toLowerCase()));

    if (has('shelf life', 'dopo apertura', 'scadenza', 'brick', 'gonfio', 'cristalli', 'macchia')) {
      return tr('quiz.auto.explain.foodSafety', { answer: c }, `La risposta corretta � "${c}" perché qui conta prima di tutto la sicurezza alimentare: se un prodotto � fuori standard, non si rischia.`);
    }
    if (has('temperatura', '�c') && has('latte', 'cappuccino', 'steam')) {
      return tr('quiz.auto.explain.steam', { answer: c }, `La risposta corretta � "${c}" perché la temperatura e la tecnica di montatura determinano microfoam e gusto (oltre una soglia il latte perde dolcezza e qualit�).`);
    }
    if (has('espresso', 'estrazione', 'channeling', 'grinder', 'portafiltro', 'tamper', 'distribution')) {
      return tr('quiz.auto.explain.espresso', { answer: c }, `La risposta corretta � "${c}" perché la consistenza dell�espresso dipende da distribuzione, tamp e parametri: piccoli errori qui cambiano subito crema e resa.`);
    }
    if (has('cliente', 'prezzo', 'upsell', 'obiezione', 'starbucks', 'influencer')) {
      return tr('quiz.auto.explain.customer', { answer: c }, `La risposta corretta � "${c}" perché in servizio conta guidare con una risposta breve, professionale e orientata al valore (senza essere aggressivi).`);
    }
    if (has('churro', 'olio', 'frigg')) {
      return tr('quiz.auto.explain.fry', { answer: c }, `La risposta corretta � "${c}" perché tempi/temperatura dell�olio impattano croccantezza e sicurezza: lo standard evita churros unti o crudi.`);
    }
    if (has('metti in ordine', 'ordine i passaggi') || has('metti in ordine')) {
      return tr('quiz.auto.explain.order', { answer: c }, 'L�ordine corretto serve a ridurre errori e sprechi: la routine standard rende la qualit� replicabile anche in rush.');
    }
    return tr('quiz.auto.explain.default', { answer: c }, `La risposta corretta � "${c}" perché � lo standard operativo previsto dal training.`);
  }

  function autoSuggestionForQuiz(prompt = '') {
    const p = String(prompt || '').toLowerCase();
    const has = (...needles) => needles.some(n => p.includes(String(n).toLowerCase()));

    if (has('shelf life', 'dopo apertura', 'scadenza')) {
      return tr('quiz.auto.suggest.foodSafety', null, 'Suggerimento: etichetta sempre data/ora apertura e applica FIFO. Se hai dubbi, non servire e chiedi conferma al responsabile.');
    }
    if (has('latte', 'steam', 'wand')) {
      return tr('quiz.auto.suggest.steam', null, 'Suggerimento: fai purge, aria solo 2�3s, poi rolling fino a ~65�C. Microfoam lucida = niente urla e niente bolle grandi.');
    }
    if (has('espresso', 'estrazione', 'grinder', 'channeling')) {
      return tr('quiz.auto.suggest.espresso', null, 'Suggerimento: controlla dose, distribuzione e tamp uniforme. Se la resa/tempo � fuori target, correggi prima la macinatura (un click alla volta).');
    }
    if (has('cliente', 'prezzo', 'starbucks')) {
      return tr('quiz.auto.suggest.customer', null, 'Suggerimento: usa una frase di valore (ingredienti, cura, esperienza) + una domanda chiusa (�Preferisci pi� intenso o pi� cremoso?�) per guidare la scelta.');
    }
    if (has('churro', 'olio', 'frigg')) {
      return tr('quiz.auto.suggest.fry', null, 'Suggerimento: verifica temperatura con termometro, friggi in batch coerenti e scola bene. Servi subito: � l� che si vince la qualit�.');
    }
    return tr('quiz.auto.suggest.default', null, 'Suggerimento: apri la scheda della categoria collegata e ripassa i 3 punti chiave. Poi rifai il quiz a mente in 20 secondi.');
  }

  function localizeQuizQuestion(question) {
    if (!question) return question;
    const prefix = question.id ? `quiz.q.${question.id}` : null;
    const baseQuestion = question.question;
    const localizedQuestion = prefix
      ? tr(`${prefix}.question`, null, baseQuestion || `Quiz ${question.id || ''}`.trim())
      : baseQuestion;
    const localizedOptions = Array.isArray(question.options)
      ? question.options.map((opt, idx) => {
          const baseOpt = opt;
          const fallbackOpt = baseOpt || `Option ${idx + 1}`;
          return prefix ? tr(`${prefix}.option.${idx}`, null, fallbackOpt) : baseOpt;
        })
      : question.options;
    const localizedSteps = Array.isArray(question.steps)
      ? question.steps.map((step, idx) => (prefix ? tr(`${prefix}.step.${idx}`, null, step) : step))
      : question.steps;
    const explainBase = question.explain ?? question.explanation;
    const localizedExplain = prefix ? tr(`${prefix}.explain`, null, explainBase) : explainBase;
    const tipBase = question.tip ?? question.suggestion;
    const localizedTip = prefix ? tr(`${prefix}.tip`, null, tipBase) : tipBase;

    return {
      ...question,
      question: localizedQuestion,
      options: localizedOptions,
      steps: localizedSteps,
      explain: localizedExplain,
      explanation: localizedExplain ?? explainBase,
      tip: localizedTip,
      suggestion: localizedTip ?? tipBase,
    };
  }

  function findQuizById(qid) {
    if (!qid) return null;
    return QUIZ_QUESTIONS.find((q) => q.id === qid) || 
           SUPER_EASY_QUESTIONS.find((q) => q.id === qid) || 
           CHALLENGE_QUESTIONS.find((q) => q.id === qid) || 
           null;
  }

  function localizeHistoryItem(item) {
    if (!item || !item.qid) return item;
    const q = findQuizById(item.qid);
    if (!q) return item;
    const review = buildQuizReview(q);
    return {
      ...item,
      prompt: review.prompt,
      correctText: review.correctText,
      explanation: review.explanation,
      suggestion: review.suggestion,
      // Always prefer freshly derived spec links/labels to avoid stale links after content changes
      specHref: review.specHref || item.specHref,
      specLabel: review.specLabel || item.specLabel,
    };
  }

  function buildQuizReview(question) {
    const localizedQuestion = localizeQuizQuestion(question);
    const prompt = localizedQuestion?.question || '';
    const correctText = getCorrectAnswerText(localizedQuestion);
    const spec = guessSpecFromPrompt(prompt);
    const customExplain = (localizedQuestion && (localizedQuestion.explain ?? localizedQuestion.explanation)) ?? '';
    const customTip = (localizedQuestion && (localizedQuestion.tip ?? localizedQuestion.suggestion)) ?? '';
    return {
      prompt,
      correctText,
      explanation: String(customExplain || '').trim() || autoExplainForQuiz(prompt, correctText),
      suggestion: String(customTip || '').trim() || autoSuggestionForQuiz(prompt),
      specHref: spec?.href || 'index.html',
      specLabel: spec?.label || tr('review.openSpec', null, 'Apri specifiche'),
    };
  }

  function buildChallengeReview(challenge) {
    const localized = localizeQuizQuestion(challenge);
    const topic = String(localized?.topic || challenge?.topic || '').trim();
    const basePrompt = String(localized?.question || localized?.prompt || challenge?.question || '').trim();
    const prompt = topic ? `Sfida continua - ${topic}: ${basePrompt}` : `Sfida continua: ${basePrompt}`;
    const correctText = getCorrectAnswerText(localized);
    return {
      prompt,
      correctText,
      explanation: autoExplainForQuiz(prompt, correctText),
      suggestion: tr('quiz.challenge.suggestion', null, 'Suggerimento: ripassa Operations & Setup (procedure, sicurezza, qualit\u00E0) e rifai mentalmente la sequenza in 20 secondi.'),
      specHref: 'operations.html',
      specLabel: tr('review.operationsCta', null, 'Apri Operations & Setup'),
    };
  }

  // Repair common "paste/encoding" artifacts that ended up stored in localStorage
  // (especially U+FFFD replacement char shown as a diamond/question-mark on some systems).
  const repairStoredText = (value) => {
    const s = String(value ?? '');
    if (!s) return s;
    // Targeted, high-frequency Italian fixes.
    return s
      .replace(/qual è/gi, 'qual è')
      .replace(/quantit�/gi, 'quantità')
      .replace(/pi�/gi, 'più')
      .replace(/cos�/gi, 'così')
      .replace(/gi�/gi, 'giù')
      .replace(/citt�/gi, 'città')
      .replace(/modalit�/gi, 'modalità')
      .replace(/qualit�/gi, 'qualità')
      // Generic: normalize leftover replacement chars in obvious separators.
      .replace(/\s*�\s*/g, ' - ')
      .replace(/\s+-\s+-\s+/g, ' - ')
      .trim();
  };

  function openWrongReviewModal(item) {
    const localizedItem = localizeHistoryItem(item) || item || {};
    const prompt = repairStoredText(localizedItem?.prompt || 'Quiz');
    const correctText = repairStoredText(localizedItem?.correctText || '');
    const explanation = repairStoredText(localizedItem?.explanation || autoExplainForQuiz(prompt, correctText));
    const suggestion = repairStoredText(autoSuggestionForQuiz(prompt) || localizedItem?.suggestion || '');
    const guessedSpec = guessSpecFromPrompt(prompt);
    const isChallengeItem = localizedItem?.qtype === 'challenge' || String(prompt || '').toLowerCase().includes('sfida continua');
    const looksLikeHub = (href, label) => {
      const h = String(href || '').trim();
      const l = String(label || '').trim();
      return !h || h === 'index.html' || /(^|\/|\\)index\.html(\?|#|$)/i.test(h) || l === 'Apri Hub';
    };

    let specHref = localizedItem?.specHref || guessedSpec?.href;
    let specLabel = localizedItem?.specLabel || guessedSpec?.label;

    // If older history items were saved before we had a proper mapping (they often fallback to Hub),
    // upgrade them on the fly *unless* they are continuous-challenge items (which intentionally point to Operations).
    // ALSO UPGRADE: If we have a better guess (with query param) than the stored generic link.
    const isGenericLink = (href) => href && !href.includes('?q=') && !href.includes('?card=');
    const isBetterGuess = guessedSpec?.href && (guessedSpec.href.includes('?q=') || guessedSpec.href.includes('?card='));

    if (!isChallengeItem && (looksLikeHub(specHref, specLabel) || (isGenericLink(specHref) && isBetterGuess)) && guessedSpec?.href && guessedSpec.href !== 'index.html') {
      specHref = guessedSpec.href;
      specLabel = guessedSpec.label;
      try {
        // Persist the improved deep link so future opens show the correct CTA label too.
        item.specHref = specHref;
        item.specLabel = specLabel;
        saveState();
      } catch (e) {}
    }

    const container = document.createElement('div');
    container.className = 'reward-modal';

    const eyebrow = document.createElement('p');
    eyebrow.style.cssText = 'margin:0 0 8px 0; font-size:12px; letter-spacing:0.22em; text-transform:uppercase; color:var(--brand-rose); font-family:var(--font-medium);';
    eyebrow.textContent = tr('review.eyebrow', null, 'Revisione - errore recente');

    const title = document.createElement('h3');
    title.className = 'reward-modal__title';
    title.textContent = tr('review.title', null, 'Rivedi la specifica');

    const q = document.createElement('p');
    q.className = 'reward-modal__text';
    q.style.marginTop = '10px';
    q.textContent = prompt;

    const answer = document.createElement('div');
    answer.style.cssText = 'margin-top:12px; padding:14px 14px; border-radius:14px; background: rgba(236, 65, 140, 0.06); border: 1px solid rgba(236, 65, 140, 0.18); color: var(--ink); line-height:1.55;';
    answer.textContent = correctText
      ? tr('review.correct', { answer: correctText }, `Risposta corretta: ${correctText}`)
      : tr('review.correct.missing', null, 'Risposta corretta: (non disponibile)');

    const expl = document.createElement('p');
    expl.className = 'reward-modal__text';
    expl.style.marginTop = '12px';
    expl.textContent = tr('review.explanation', { text: explanation }, `Spiegazione: ${explanation}`);

    const tip = document.createElement('p');
    tip.className = 'reward-modal__text';
    tip.style.marginTop = '10px';
    // FIX: Avoid double "Suggerimento:" prefix if the variable already contains it.
    const cleanSuggestion = suggestion.replace(/^(Suggerimento|Suggestion|Tip|Consejo|Conseil):\s*/i, '');
    tip.textContent = tr('review.suggestion', { text: cleanSuggestion }, `Suggerimento: ${cleanSuggestion}`);

    const actions = document.createElement('div');
    actions.className = 'reward-modal__actions';

    const openSpec = document.createElement('button');
    openSpec.type = 'button';
    openSpec.className = 'reward-action primary';
    openSpec.textContent = repairStoredText(specLabel) || tr('review.openSpec', null, 'Apri specifiche');
    openSpec.dataset.overlayFocus = 'true';
    openSpec.addEventListener('click', () => {
      closeOverlay();
      if (specHref) window.location.href = specHref;
    });

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'reward-action secondary';
    closeBtn.textContent = tr('common.close', null, 'Chiudi');
    closeBtn.addEventListener('click', closeOverlay);

    actions.append(openSpec, closeBtn);
    container.append(eyebrow, title, q, answer, expl, tip, actions);
    openOverlay(container);
  }

  function openAllWrongLogModal() {
    const quizHistory = sanitizeQuizHistory(state.history?.quiz);
    const allWrong = quizHistory
      .filter((q) => q && q.correct === false)
      .slice()
      .sort((a, b) => (Number(b.ts) || 0) - (Number(a.ts) || 0));
    const localizedAll = allWrong
      .map((item) => localizeHistoryItem(item) || item)
      .map((item) => {
        const next = { ...(item || {}) };
        // Normalize common artifacts so UI + JSON export are clean.
        if (next.prompt) next.prompt = repairStoredText(next.prompt);
        if (next.correctText) next.correctText = repairStoredText(next.correctText);
        if (next.explanation) next.explanation = repairStoredText(next.explanation);
        if (next.suggestion) next.suggestion = repairStoredText(next.suggestion);
        if (next.topic) next.topic = repairStoredText(next.topic);
        if (next.specLabel) next.specLabel = repairStoredText(next.specLabel);
        return next;
      });

    const container = document.createElement('div');
    container.className = 'reward-modal';

    const eyebrow = document.createElement('p');
    eyebrow.style.cssText = 'margin:0 0 8px 0; font-size:12px; letter-spacing:0.22em; text-transform:uppercase; color:var(--brand-rose); font-family:var(--font-medium);';
    eyebrow.textContent = tr('review.hubEyebrow', null, 'Hub - archivio errori');

    const title = document.createElement('h3');
    title.className = 'reward-modal__title';
    title.textContent = tr('review.hubTitle', null, 'Tutti gli errori');

    const meta = document.createElement('p');
    meta.className = 'reward-modal__text';
    meta.style.marginTop = '6px';
    meta.textContent = allWrong.length
      ? tr('review.hub.meta', { count: allWrong.length }, `Totale errori salvati: ${allWrong.length}. Tocca un item per aprire la revisione.`)
      : tr('review.hub.empty', null, 'Nessun errore salvato al momento.');

    const toolbar = document.createElement('div');
    toolbar.className = 'wrong-log__toolbar';

    const search = document.createElement('input');
    search.type = 'search';
    search.className = 'wrong-log__search';
    search.placeholder = tr('wrongLog.searchPlaceholder', null, 'Cerca negli errori (es. coni, box, latte, churros...)');
    search.setAttribute('aria-label', tr('wrongLog.searchAria', null, 'Cerca negli errori'));

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'btn btn-ghost btn--sm';
    copyBtn.textContent = tr('wrongLog.copyJson', null, 'Copia JSON');

    const listWrap = document.createElement('div');
    listWrap.className = 'wrong-log__list';
    const list = document.createElement('ul');
    list.className = 'summary-list';
    listWrap.appendChild(list);

    const hint = document.createElement('p');
    hint.className = 'wrong-log__hint';
    hint.textContent = tr(
      'wrongLog.tip',
      null,
      'Tip: se la lista è lunghissima, usa la ricerca. Gli errori più vecchi oltre il limite (300 eventi) vengono scartati automaticamente.'
    );

    const actions = document.createElement('div');
    actions.className = 'reward-modal__actions';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'reward-action secondary';
    closeBtn.textContent = tr('common.close', null, 'Chiudi');
    closeBtn.addEventListener('click', closeOverlay);

    actions.appendChild(closeBtn);

    const safeString = (v) => String(v || '').toLowerCase();
    const formatWhen = (ts) => {
      try {
        const uiLang = window.BadianiI18n?.getLang?.() || 'it';
        const uiLocale = ({ it: 'it-IT', en: 'en-GB', es: 'es-ES', fr: 'fr-FR' }[uiLang]) || undefined;
        const when = new Date(ts || Date.now());
        const date = when.toLocaleDateString(uiLocale);
        const time = when.toLocaleTimeString(uiLocale, { hour: '2-digit', minute: '2-digit' });
        return `${date} ${time}`;
      } catch {
        return '';
      }
    };

    const renderList = (query = '') => {
      const q = safeString(query).trim();
      list.innerHTML = '';

      const filtered = !q
        ? localizedAll
        : localizedAll.filter((item) => {
            const blob = `${repairStoredText(item.prompt || '')} ${repairStoredText(item.correctText || '')} ${repairStoredText(item.explanation || '')} ${repairStoredText(item.topic || '')}`;
            return safeString(blob).includes(q);
          });

      if (!filtered.length) {
        const li = document.createElement('li');
        li.className = 'empty';
        li.textContent = tr('wrongLog.searchNoResults', null, 'Nessun risultato per questa ricerca.');
        list.appendChild(li);
        return;
      }

      filtered.forEach((item) => {
        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'summary-list__btn';
        const prompt = repairStoredText(item.prompt || tr('quiz.generic', null, 'Quiz'));
        btn.textContent = `${formatWhen(item.ts)} - ${prompt}`;
        btn.setAttribute('aria-label', tr('cockpit.wrong.reviewAria', { title: prompt }, `Apri revisione errore: ${prompt}`));
        btn.addEventListener('click', () => openWrongReviewModal(item));
        li.appendChild(btn);
        list.appendChild(li);
      });
    };

    const copyJson = async () => {
      try {
        const payload = JSON.stringify(localizedAll, null, 2);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(payload);
          showToast(tr('toast.copied', null, 'Copiato negli appunti.'));
          return;
        }
      } catch (e) {}
      // Fallback
      try {
        const ta = document.createElement('textarea');
        ta.value = JSON.stringify(allWrong, null, 2);
        ta.setAttribute('readonly', 'true');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        showToast(tr('toast.copied', null, 'Copiato negli appunti.'));
      } catch (e) {
        showToast('Impossibile copiare (browser).');
      }
    };

    search.addEventListener('input', () => renderList(search.value));
    copyBtn.addEventListener('click', copyJson);

    toolbar.append(search, copyBtn);
    container.append(eyebrow, title, meta, toolbar, listWrap, hint, actions);

    openOverlay(container, { fullScreen: true });
    requestAnimationFrame(() => search.focus({ preventScroll: true }));
    renderList('');
  }

  function showChangeGelatoModal() {
    console.log('showChangeGelatoModal called');
    const getUser = () => window.BadianiProfile?.getActive?.() || null;
    const saveUserGelato = (gelato) => {
      // Prefer the stability layer (keeps profiles list in sync + emits update event).
      if (window.BadianiProfile?.updateActive) {
        return window.BadianiProfile.updateActive({ gelato: gelato.trim() });
      }
      // Fallback: legacy behavior (best-effort).
      const current = getUser() || {};
      const profile = {
        id: current.id,
        nickname: current.nickname,
        gelato: gelato.trim(),
        createdAt: current.createdAt || Date.now(),
      };
      try {
        const key = window.BadianiProfile?.KEY_ACTIVE || 'badianiUser.profile.v1';
        if (window.BadianiStorage?.setJSON) window.BadianiStorage.setJSON(key, profile);
        else localStorage.setItem(key, JSON.stringify(profile));
      } catch {}
      return profile;
    };

    const container = document.createElement('div');
    container.className = 'reward-modal';
    container.innerHTML = `
      <div style="text-align:center; margin-bottom:12px;">
        <p style="font-size:28px; margin:0; line-height:1;">🍦</p>
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
      showToast('Gusto aggiornato!');
    });
    const cancelBtn = container.querySelector('[data-cancel-gelato]');
    if (cancelBtn) cancelBtn.addEventListener('click', closeOverlay);

    openOverlay(container);
    setTimeout(() => input?.focus({ preventScroll: true }), 0);
  }

  function showChangeProfileModal() {
    console.log('showChangeProfileModal called');
    const container = document.createElement('div');
    container.className = 'reward-modal';
    // Make it wider for the avatar creator
    container.style.maxWidth = '400px';
    
    // Check if AvatarLab is available
    let avatarHtml = '<p>Avatar Creator non disponibile.</p>';
    try {
      if (typeof AvatarLab !== 'undefined' && AvatarLab && typeof AvatarLab.getHTML === 'function') {
        avatarHtml = AvatarLab.getHTML();
      }
    } catch (e) {
      console.warn('AvatarLab.getHTML failed', e);
      avatarHtml = '<p>Avatar Creator non disponibile.</p>';
    }
    
    container.innerHTML = `
      <div style="text-align:center; margin-bottom:12px;">
        <p style="font-size:28px; margin:0; line-height:1;">👤</p>
      </div>
      <h3 style="margin:0 0 8px 0; font-size:20px;">Il tuo Avatar</h3>
      <p style="margin:0 0 16px 0; color:var(--brand-gray-soft, #6b7280); font-size:14px;">Personalizza il tuo look per l'Hub.</p>
      
      ${avatarHtml}
      
      <hr style="margin: 20px 0; border: 0; border-top: 1px solid #eee;">
      
      <div style="display:flex; gap:8px; justify-content: center;">
        <button type="button" data-confirm-switch style="padding:10px 20px; border-radius:10px; background:#fff; color:#e11d48; border:1px solid #e11d48; font-weight:600; font-size:13px;">Esci / Cambia Profilo</button>
        <button type="button" data-cancel-switch style="padding:10px 20px; border-radius:10px; background:#e5e7eb; color:#0f2154; border:none; font-weight:600; font-size:13px;">Chiudi</button>
      </div>
    `;
    
    const confirmBtn = container.querySelector('[data-confirm-switch]');
    const cancelBtn = container.querySelector('[data-cancel-switch]');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', (event) => {
        // Some environments (mobile webviews / strict settings) can block native confirm() dialogs.
        // We keep this action reliable: exit immediately and let the signup gate re-open on reload.
        try {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
        } catch {}

        try { if (typeof showToast === 'function') showToast('Uscita dal profilo…'); } catch {}

        try {
          if (window.BadianiProfile?.logout) window.BadianiProfile.logout();
          else localStorage.removeItem('badianiUser.profile.v1');
        } catch {}

        try { closeOverlay({ force: true }); } catch { try { closeOverlay(); } catch {} }
        try { bodyScrollLock.forceUnlock(); } catch {}

        setTimeout(() => {
          try { window.location.reload(); } catch {}
        }, 50);
      });
    }
    if (cancelBtn) cancelBtn.addEventListener('click', closeOverlay);

    // Mount first, then init AvatarLab so its render() can find DOM nodes.
    openOverlay(container);
    if (typeof AvatarLab !== 'undefined' && AvatarLab && typeof AvatarLab.init === 'function') {
      setTimeout(() => {
        try {
          AvatarLab.init(container);
          // Ensure an initial render after mount (some AvatarLab versions render via document.getElementById).
          if (typeof AvatarLab.render === 'function') AvatarLab.render();
        } catch (e) {
          console.warn('AvatarLab.init failed', e);
          try { if (window.showToast) window.showToast('Avatar Creator non disponibile (errore).'); } catch {}
        }
      }, 0);
    }
  }

  // Allow external UI entrypoints (e.g. drawer "Profilo") to open the same modal.
  try {
    if (typeof window.openAvatarProfileModal !== 'function') {
      window.openAvatarProfileModal = () => showChangeProfileModal();
    }
  } catch {}

  function initProfileControls() {
    console.log('Initializing profile controls...');
    
    // Usa delegazione eventi sul document per catturare tutti i click sui pulsanti profilo
    // Questo funziona anche se i pulsanti vengono creati dinamicamente o sono dentro carousel
    
    // Rimuovi vecchi listener se esistono
    if (window.__badianiProfileHandlersAttached) {
      console.log('Profile handlers already attached, skipping...');
      return;
    }
    
    // Handler per "Cambia gusto"
    document.addEventListener('click', (event) => {
      const editBtn = event.target.closest('[data-profile-edit]');
      if (editBtn) {
        console.log('Cambia gusto clicked');
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        showChangeGelatoModal();
      }
    }, true); // useCapture = true per catturare prima del carousel

    // Handler per "Cambia profilo"
    document.addEventListener('click', (event) => {
      const switchBtn = event.target.closest('[data-profile-switch]');
      if (switchBtn) {
        console.log('Cambia profilo clicked');
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        showChangeProfileModal();
      }
    }, true); // useCapture = true per catturare prima del carousel

    window.__badianiProfileHandlersAttached = true;
    console.log('Profile controls initialized successfully');
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

  // NOTE: Must be hoisted.
  // `init()` can run before reaching this part of the file, and Story Orbit rewards
  // call `slugify()` during init. A `const` here would be in the TDZ and crash.
  function slugify(value = '') {
    return (value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '') || 'tab';
  }

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
      awardStoryCrystalOnce(id, id, source || node || storyNodes[0], `Story � ${pretty}`, evt);
    };

    // Fifth crystal: granted on page open (once per day).
    awardStoryCrystalOnce('page-open', 'welcome', document.querySelector('.hero') || storyNodes[0], 'Apertura pagina');

    // Prereq: clicking the left media (fullscreen trigger) counts as �photo seen� for the current chapter.
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

    const label = tabTitle ? ` ◆ ${tabTitle}` : '';
    // Force toast to top-center as requested to avoid distraction
    const anchor = { x: window.innerWidth / 2, y: 60 };
    showToast(`💎 +${amount} cristall${amount > 1 ? 'i' : 'o'}${label} (${crystalsAfter}/${CRYSTALS_PER_STAR})`, { anchor });
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

    // Prefer a stable DOM id when present (most cards have id="card-..." in HTML).
    // This keeps tracking consistent across reloads and language changes.
    const domIdRaw = String(card.getAttribute('id') || '').trim();
    if (domIdRaw) {
      const domId = domIdRaw.toLowerCase();
      const uid = `${pageSlug}-${domId}`;
      card.dataset.rewardId = uid;
      return uid;
    }

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
        const raw = String(id || '');
        // New stable format uses "<slug>-card-...". Keep it as-is.
        if (raw.includes(`-${'card-'.toLowerCase()}`)) return raw;
        return raw.replace(/-\d+$/g, '');
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
    // Total rewardable cards per page (redeemable stars).
    // Prefer real DOM counts so it stays correct when we add/remove cards.
    try {
      const slug = getPageSlug();

      // Story Orbit uses a different structure than guide cards.
      if (slug === 'story-orbit') {
        const chapters = document.querySelectorAll('.story-card[data-story-card]').length;
        // Keep legacy behavior: 4 chapters + 1 bonus for opening/engagement.
        return Math.max(0, chapters + 1);
      }

      const cards = document.querySelectorAll('.guide-card[data-carousel-item]');
      return cards.length;
    } catch {
      return 0;
    }
  }

  function updatePageBadges() {
    const count = getPageStarCount();
    const total = getTotalPageCards();
    document.querySelectorAll('[data-page-stars]').forEach((el) => {
      // IMPORTANT: these badges are dynamic; remove static i18n markers so the
      // i18n engine doesn't overwrite them on DOMContentLoaded/language switch.
      try {
        el.removeAttribute('data-i18n');
        el.removeAttribute('data-i18n-html');
      } catch (e) {}
      el.textContent = tr('page.starsBadge', { count, total }, `\u2605 Stelle: ${count}/${total}`);
    });
  }

  // After i18n applies translations (DOMContentLoaded + language switches), refresh the
  // dynamic per-page stars badge so it remains accurate.
  try {
    window.addEventListener('i18nUpdated', () => {
      try { updatePageBadges(); } catch (e) {}
    });
  } catch (e) {}

  try {
    document.addEventListener('badiani:lang-changed', () => {
      try { updatePageBadges(); } catch (e) {}
    });
  } catch (e) {}

  function getAvailableSets() {
    return Math.floor(state.quizTokens / STARS_FOR_QUIZ);
  }

  function showStarMilestone() {
    const waiting = isCooldownActive();
    const container = document.createElement('div');
    container.className = 'reward-modal';
    const burst = document.createElement('div');
    burst.className = 'reward-modal__burst';
    burst.textContent = '\u2605 \u2605 \u2605';
    const title = document.createElement('h3');
    title.className = 'reward-modal__title';
    title.textContent = waiting
      ? tr('game.milestone.title.waiting', null, 'Tre stelline: mini quiz (poi aspetti il cooldown)')
      : tr('game.milestone.title.ready', null, 'Tre stelline: mini quiz sbloccato!');
    const text = document.createElement('p');
    text.className = 'reward-modal__text';
    text.textContent = waiting
      ? tr('game.milestone.text.waiting', null, 'Puoi fare adesso il mini quiz. Se lo passi, sblocchi "Test me", ma potrai farlo solo quando finisce il countdown del gelato.')
      : tr('game.milestone.text.ready', null, 'Fai il mini quiz su ci\u00F2 che hai aperto: se rispondi giusto, sblocchi "Test me" (il quiz pi\u00F9 difficile che assegna il gelato).');
    const actions = document.createElement('div');
    actions.className = 'reward-modal__actions';

    const instruction = document.createElement('p');
    instruction.className = 'reward-modal__hint';
    instruction.style.marginTop = '12px';
    instruction.style.fontSize = '14px';
    instruction.style.color = 'var(--brand-gray-soft)';
    instruction.textContent = tr('game.milestone.hint', null, 'Chiudi questa notifica per avviare il mini quiz.');

    // Start the MINI quiz as soon as this overlay is dismissed.
    container.dataset.triggerMiniQuizOnClose = 'true';

    const start = document.createElement('button');
    start.className = 'reward-action primary';
    start.type = 'button';
    start.textContent = tr('game.milestone.start', null, 'Inizia mini quiz');
    start.dataset.overlayFocus = 'true';
    start.addEventListener('click', () => closeOverlay({ triggerQuiz: true }));

    const later = document.createElement('button');
    later.className = 'reward-action secondary';
    later.type = 'button';
    later.textContent = tr('game.milestone.later', null, 'Pi\u00F9 tardi');
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
    burst.textContent = '\u2139';
    const title = document.createElement('h3');
    title.className = 'reward-modal__title';
    title.textContent = tr('game.mini.title', null, 'Come funziona il mini game');
    const text1 = document.createElement('p');
    text1.className = 'reward-modal__text';
    text1.textContent = tr('game.mini.text1', { perStar: CRYSTALS_PER_STAR }, `Apri i tab dentro una scheda: ogni tab = 1 cristallo di zucchero. ${CRYSTALS_PER_STAR} cristalli si trasformano in 1 stellina (se i tab sono meno di ${CRYSTALS_PER_STAR}, completiamo i cristalli all'ultimo tab). Ogni 3 stelline parte un mini quiz (1 domanda).`);
    const text2 = document.createElement('p');
    text2.className = 'reward-modal__text';
    text2.textContent = tr('game.mini.text2', null, 'Mini quiz giusto = sblocchi "Test me" (quiz pi\u00F9 difficile). "Test me" perfetto = gelato aggiunto al counter e countdown di 24h (riducibile con 12 e 30 stelline). Mini quiz sbagliato = -3 stelline. Reset automatico: domenica a mezzanotte.');
    const text3 = document.createElement('p');
    text3.className = 'reward-modal__text';
    text3.textContent = tr('game.mini.text3', null, 'Completando tutte e 65 le stelline guadagni punti bonus reali da convertire in cash o prodotti Badiani.');
    const actions = document.createElement('div');
    actions.className = 'reward-modal__actions';
    const ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'reward-action primary';
    ok.textContent = tr('game.mini.ok', null, 'Ok, giochiamo');
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
    burst.textContent = '\u2605';
    const title = document.createElement('h3');
    title.className = 'reward-modal__title';
    title.textContent = tr('game.bonus.title', null, '65 stelline completate!');
    const text = document.createElement('p');
    text.className = 'reward-modal__text';
    text.textContent = `Hai sbloccato il loop completo: stelline azzerate e +${BONUS_POINTS_PER_FULL_SET} punti bonus da spendere in premi cash o prodotti.`;
    const actions = document.createElement('div');
    actions.className = 'reward-modal__actions';
    const ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'reward-action primary';
    ok.textContent = tr('game.bonus.ok', null, 'Riparto da capo');
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
    if (/(slitti|praline|drag[ée]e|crema slitti|yo-yo|yoyo)/i.test(blob)) slugs.add('slitti-yoyo');
    if (/(gelato|buontalenti|vetrina|spatolatura|vaschetta|coni\b|coppette|affogato premium|stracciatella|nocciola|pistachio)/i.test(blob)) slugs.add('gelato-lab');
    if (/(churros|mulled|Vin Brulée�]|panettone|pandoro|natale|festiv)/i.test(blob)) slugs.add('festive');
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
    { id: 'f1', question: 'Qual � la priorit� in caso di cliente con reazione allergica?', options: ['Chiamo 118', 'Aspetto che passi', 'Offro acqua', 'Cambio argomento'], correct: 0 },
    { id: 'f2', question: 'Temperatura ideale del latte per un cappuccino equilibrato?', options: ['65�C circa', '80�C', '45�C', '100�C'], correct: 0 },
    { id: 'f3', question: 'Cosa fai se noti fumo dalla macchina espresso?', options: ['Spegni e attivi procedura sicurezza', 'Continui a servire', 'Aumenti la pressione', 'Ignori e speri'], correct: 0 },
    { id: 'f4', question: 'Per evitare channeling nell\'espresso la cosa pi� importante �', options: ['Distribuzione e tamp uniforme', 'Tampare fortissimo', 'Bagnare il caffè', 'Usare tazza fredda'], correct: 0 },
    { id: 'f5', question: 'Come fai upsell senza pressione con uno studente budget-limitato?', options: ['Proponi una combo risparmio', 'Insisti finch� dice s�', 'Non dici nulla mai', 'Sminuisci la scelta'], correct: 0 },
    { id: 'f6', question: 'Churros: olio a 160�C. Cosa fai?', options: ['Porti a 180�C', 'Continui cos�', 'Aggiungi zucchero in olio', 'Raffreddi l\'olio'], correct: 0 },
    { id: 'f7', question: 'Se il frigo non raffredda correttamente, qual è l\'azione corretta?', options: ['Metti al sicuro i prodotti deperibili e segnali', 'Lasci tutto com\'�', 'Aumenti la temperatura', 'Servi pi� veloce'], correct: 0 },
    { id: 'f8', question: 'Perch� esiste il cooldown gelato?', options: ['Limitare spam premi', 'Per far sembrare il sito lento', 'Serve per i font', '� un errore'], correct: 0 },
    { id: 'f9', question: 'Cliente indeciso tra cappuccino e latte: come guidi?', options: ['Chiedi preferenza di foam/morbidezza', 'Decidi tu senza domande', 'Ignori e fai espresso', 'Dici che � uguale'], correct: 0 },
    { id: 'f10', question: 'Gelato con cristalli di ghiaccio: cosa indica?', options: ['� stato scongelato/ricongelato', '� perfetto', '� pi� fresco', '� pi� dolce'], correct: 0 },
  ];

  function getAskedByMode() {
    if (!state.askedQuestionsByMode || typeof state.askedQuestionsByMode !== 'object') {
      state.askedQuestionsByMode = {};
    }
    return state.askedQuestionsByMode;
  }

  function getQuestionBagByMode() {
    if (!state.questionBagByMode || typeof state.questionBagByMode !== 'object') {
      state.questionBagByMode = {};
    }
    return state.questionBagByMode;
  }

  // Get questions pool based on visited tabs in current week
  // Filters QUIZ_QUESTIONS to only include questions from topics the user visited
  function getQuestionsForVisitedTabs() {
    const visitedTopics = new Set();
    
    // Extract unique page slugs from opened tabs today
    const tabContextToday = state.openedTabContextToday || {};
    const pageSlugsSeen = new Set();
    
    Object.values(tabContextToday).forEach(entry => {
      if (entry?.pageSlug) pageSlugsSeen.add(entry.pageSlug);
    });
    
    // Map page slugs to quiz topics
    const pageToTopic = {
      'caffe': 'caffe',
      'sweet-treats': 'sweet-treats',
      'pastries': 'pastries',
      'slitti-yoyo': 'slitti-yoyo',
      'gelato-lab': 'gelato-lab',
      'festive': 'pastries',  // Festive maps to pastries (panettone/mulled wine)
    };
    
    // Collect topics from visited pages
    pageSlugsSeen.forEach(slug => {
      const topic = pageToTopic[slug];
      if (topic) visitedTopics.add(topic);
    });
    
    // If no tabs visited, return all questions (safety fallback)
    if (visitedTopics.size === 0) {
      console.log('?? No visited tabs today; returning all questions for mini quiz');
      return QUIZ_QUESTIONS;
    }
    
    // Filter questions by visited topics
    const questionIds = new Set();
    visitedTopics.forEach(topic => {
      (QUIZ_TOPIC_MAPPING[topic] || []).forEach(id => questionIds.add(id));
    });
    
    const poolForTopics = QUIZ_QUESTIONS.filter(q => questionIds.has(q.id));
    console.log(`?? Mini quiz: found ${poolForTopics.length} questions from visited topics: ${Array.from(visitedTopics).join(', ')}`);
    
    return poolForTopics.length > 0 ? poolForTopics : QUIZ_QUESTIONS;  // Fallback if empty
  }

  // Super-easy variant: same visited topics logic but uses SUPER_EASY_QUESTIONS and mapping.
  function getSuperEasyQuestionsForVisitedTabs() {
    const visitedTopics = new Set();

    const tabContextToday = state.openedTabContextToday || {};
    const pageSlugsSeen = new Set();

    Object.values(tabContextToday).forEach(entry => {
      if (entry?.pageSlug) pageSlugsSeen.add(entry.pageSlug);
    });

    const pageToTopic = {
      'caffe': 'caffe',
      'sweet-treats': 'sweet-treats',
      'pastries': 'pastries',
      'slitti-yoyo': 'slitti-yoyo',
      'gelato-lab': 'gelato-lab',
      'festive': 'pastries',
    };

    pageSlugsSeen.forEach(slug => {
      const topic = pageToTopic[slug];
      if (topic) visitedTopics.add(topic);
    });

    if (visitedTopics.size === 0) {
      console.log('?? No visited tabs today; returning all super-easy questions for mini quiz');
      return SUPER_EASY_QUESTIONS;
    }

    const questionIds = new Set();
    visitedTopics.forEach(topic => {
      (SUPER_EASY_QUESTIONS_MAPPING[topic] || []).forEach(id => questionIds.add(id));
    });

    const poolForTopics = SUPER_EASY_QUESTIONS.filter(q => questionIds.has(q.id));
    console.log(`?? Mini quiz (super-easy): found ${poolForTopics.length} questions from visited topics: ${Array.from(visitedTopics).join(', ')}`);

    return poolForTopics.length > 0 ? poolForTopics : SUPER_EASY_QUESTIONS;
  }

  function buildShuffledIdBag(pool) {
    return (Array.isArray(pool) ? pool : [])
      .map((q) => q?.id)
      .filter(Boolean)
      .sort(() => Math.random() - 0.5);
  }

  // Draw questions from a per-mode shuffle bag.
  // Guarantees: no repeats until the pool is exhausted (bag empty), and no skipped leftovers
  // when count > remaining (it wraps to a new shuffled bag).
  function pickQuestionsFromBag(modeKey, pool, count) {
    if (!modeKey) modeKey = 'classic';
    const bagByMode = getQuestionBagByMode();

    const poolById = new Map(
      (Array.isArray(pool) ? pool : [])
        .filter((q) => q && q.id)
        .map((q) => [q.id, q])
    );

    if (!poolById.size) return [];

    const sanitizeBag = (bag) => {
      if (!Array.isArray(bag)) return [];
      return bag.filter((id) => poolById.has(id));
    };

    let bag = sanitizeBag(bagByMode[modeKey]);
    if (bag.length === 0) {
      bag = buildShuffledIdBag(Array.from(poolById.values()));
    }

    const selected = [];
    const usedThisPick = new Set();

    while (selected.length < count) {
      if (bag.length === 0) {
        bag = buildShuffledIdBag(Array.from(poolById.values()));
      }

      const id = bag.shift();
      if (!id) continue;
      if (usedThisPick.has(id)) continue;
      const q = poolById.get(id);
      if (!q) continue;
      selected.push(q);
      usedThisPick.add(id);

      // Safety: if someone calls with count > pool size, avoid infinite loops.
      if (usedThisPick.size >= poolById.size) break;
    }

    bagByMode[modeKey] = bag;
    saveState();
    return selected;
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
        question: tr('quiz.productGuess.prompt', null, 'Indovina il prodotto dalla foto:'),
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
        // Keep entries even if content is short: we can still quiz on �which tab did you open�.
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
        return `${page} � ${card} � ${tab}`;
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
        return `${cleaned.slice(0, 120).trim()}�`;
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

          // If we don't have enough text to ask a description-based question, fall back to a �which tab� question
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
              const label = `${page} � ${fakeProduct} � Tab`;
              if (label === correctLabel) continue;
              optionsSet.add(label);
            }
            const options = Array.from(optionsSet).slice(0, 3).sort(() => Math.random() - 0.5);
            const correct = options.indexOf(correctLabel);
            if (correct < 0 || options.length < 2) return null;
            return {
              id: tpl.id,
              question: productName
                ? `Quale tab hai aperto nella scheda �${productName}�?`
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
            question: `Quale prodotto corrisponde a questa descrizione? �${snippet}�`,
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
      stepLabel.textContent = `${tr('quiz.question')} ${currentIndex + 1}/${questions.length}`;

      const prompt = document.createElement('p');
      prompt.className = 'quiz-prompt';
      prompt.textContent = question.question;

      const hint = document.createElement('p');
      hint.className = 'quiz-hint';
      hint.textContent = tr('quiz.orderHint');

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
          up.textContent = '\u2191';
          up.setAttribute('aria-label', 'Sposta su');
          up.disabled = idx === 0;

          const down = document.createElement('button');
          down.type = 'button';
          down.className = 'quiz-order__btn';
          down.textContent = '\u2193';
          down.setAttribute('aria-label', 'Sposta gi\u00F9');
          down.disabled = idx === selected.length - 1;

          const remove = document.createElement('button');
          remove.type = 'button';
          remove.className = 'quiz-order__btn quiz-order__btn--remove';
          remove.textContent = '\u00D7';
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

      // Ensure we have a correct index even for i18n-driven pools (e.g. sm-*).
      const correctIndex = getCorrectIndex(question);

      if (question && question.type === 'order') {
        renderOrderStep(question);
        return;
      }

      stage.innerHTML = '';
      const card = document.createElement('div');
      card.className = 'quiz-card';
      const stepLabel = document.createElement('p');
      stepLabel.className = 'quiz-step';
      stepLabel.textContent = `${tr('quiz.question')} ${currentIndex + 1}/${questions.length}`;
      const prompt = document.createElement('p');
      prompt.className = 'quiz-prompt';
      prompt.textContent = question.question;

      if (question.image) {
        const media = document.createElement('div');
        media.className = 'quiz-media';
        const img = document.createElement('img');
        img.loading = 'lazy';
        img.alt = tr('quiz.productImageAlt');
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
          const isCorrect = Number.isInteger(correctIndex) && optionIndex === correctIndex;
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
      const correctIndex = getCorrectIndex(question);
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
        const hitCorrect = Number.isInteger(correctIndex) && picks.includes(correctIndex);
        if (hitCorrect || picks.length !== 2) {
          // mark picks
          picks.forEach((idx) => {
            const btn = options.querySelector(`[data-option-index="${idx}"]`);
            if (btn) btn.classList.add('is-wrong');
          });
          const correctBtn = Number.isInteger(correctIndex)
            ? options.querySelector(`[data-option-index="${correctIndex}"]`)
            : null;
          if (correctBtn) correctBtn.classList.add('is-correct');
          setTimeout(() => fail(question), 450);
          return;
        }
        // success: show selected as correct (they were wrong options)
        picks.forEach((idx) => {
          const btn = options.querySelector(`[data-option-index="${idx}"]`);
          if (btn) btn.classList.add('is-correct');
        });
        const correctBtn = Number.isInteger(correctIndex)
          ? options.querySelector(`[data-option-index="${correctIndex}"]`)
          : null;
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

    // Get super-easy questions filtered by visited tabs (adaptive mini quiz)
    const topicQuestions = getSuperEasyQuestionsForVisitedTabs();
    const questions = pickQuestionsFromBag('mini-sm', topicQuestions, 1).map(localizeQuizQuestion);
    if (!questions.length) return;

    const handleMiniSuccess = () => {
      state.testMeCredits = Math.max(0, (state.testMeCredits || 0) + 1);
      saveState();
      updateUI();

      const container = document.createElement('div');
      container.className = 'reward-modal';
      const title = document.createElement('h3');
      title.className = 'reward-modal__title';
      title.textContent = tr('quiz.mini.success.title', null, 'Mini quiz superato!');
      const text = document.createElement('p');
      text.className = 'reward-modal__text';
      text.textContent = isCooldownActive()
        ? tr('quiz.mini.success.text.cooldown', { time: formatDuration(getCooldownRemaining()) }, `Hai sbloccato �Test me�, ma hai gi� un gelato in cooldown. Torna tra ${formatDuration(getCooldownRemaining())} per provarci.`)
        : tr('quiz.mini.success.text.ready', null, 'Hai sbloccato �Test me�: � il quiz pi� difficile che assegna il gelato.');
      const actions = document.createElement('div');
      actions.className = 'reward-modal__actions';

      const later = document.createElement('button');
      later.type = 'button';
      later.className = 'reward-action secondary';
      later.textContent = tr('quiz.mini.success.cta.later', null, 'Pi� tardi');
      later.addEventListener('click', closeOverlay);
      actions.appendChild(later);

      if (!isCooldownActive()) {
        const go = document.createElement('button');
        go.type = 'button';
        go.className = 'reward-action primary';
        go.textContent = tr('quiz.mini.success.cta.start', null, 'Inizia Test me');
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
        ok.textContent = tr('quiz.mini.success.cta.ok', null, 'Ok');
        ok.dataset.overlayFocus = 'true';
        ok.addEventListener('click', closeOverlay);
        actions.appendChild(ok);
      }

      container.append(title, text, actions);
      openOverlay(container);
    };

    const handleMiniFail = (question) => {
      // Apply the penalty
      applyMiniQuizPenalty();

      // Log the mistake so it appears under �Errori recenti� in the Hub.
      // Then open the same review modal used elsewhere (with direct CTA to the right card).
      try {
        if (!state.history) state.history = { quiz: [] };
        if (!Array.isArray(state.history.quiz)) state.history.quiz = [];
        const review = buildQuizReview(question);
        const lastItem = {
          ts: Date.now(),
          correct: false,
          prompt: review.prompt,
          qid: question?.id || null,
          qtype: 'mini',
          correctText: review.correctText,
          explanation: review.explanation,
          suggestion: review.suggestion,
          specHref: review.specHref,
          specLabel: review.specLabel,
        };
        state.history.quiz.push(lastItem);
        if (state.history.quiz.length > 300) state.history.quiz = state.history.quiz.slice(-300);
        saveState();
        updateUI();

        // Swap the overlay content to the review (fast learning loop).
        openWrongReviewModal(lastItem);
        return;
      } catch (e) {}

      // Fallback (legacy)
      const container = document.createElement('div');
      container.className = 'reward-modal';
      const title = document.createElement('h3');
      title.className = 'reward-modal__title';
      title.textContent = tr('quiz.mini.fail.title', null, 'Mini quiz perso: -3 stelline');
      const text = document.createElement('p');
      text.className = 'reward-modal__text';
      text.textContent = tr('quiz.mini.fail.text', null, 'Niente panico: riparti e ritenta. Al prossimo set di 3 stelline rifai il mini quiz.');
      const actions = document.createElement('div');
      actions.className = 'reward-modal__actions';
      const ok = document.createElement('button');
      ok.type = 'button';
      ok.className = 'reward-action primary';
      ok.textContent = tr('quiz.mini.fail.cta', null, 'Ok');
      ok.dataset.overlayFocus = 'true';
      ok.addEventListener('click', closeOverlay);
      actions.appendChild(ok);
      container.append(title, text, actions);
      openOverlay(container);
    };

    startQuizSession({
      modeKey: 'mini',
      title: tr('quiz.mini.title', null, 'Mini quiz � 1 domanda'),
      introText: tr('quiz.mini.intro', null, '1 domanda rapida. Sbagli = -3 stelline. Giusto = sblocchi "Test me".'),
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

    // Get pools filtered by visited tabs (adaptive hard quiz)
    const easyPool = getQuestionsForVisitedTabs();
    const superEasyPool = getSuperEasyQuestionsForVisitedTabs();

    const superEasyPicked = pickQuestionsFromBag('test-me-sm', superEasyPool, 2).map(localizeQuizQuestion);
    const easyPicked = pickQuestionsFromBag('test-me', easyPool, 1).map(localizeQuizQuestion);
    const picked = [...superEasyPicked, ...easyPicked];
    startQuizSession({
      modeKey: 'test-me',
      title: tr('quiz.testme.title', null, 'Test me � quiz avanzato'),
      introText: tr('quiz.testme.intro', null, '3 domande. Perfetto = gelato. Sbagli = vai alla soluzione e riparti.'),
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
    const specLabel = encodeURIComponent(review.specLabel || '');
    const target = `quiz-solution.html?prompt=${prompt}&answer=${answer}&explain=${explain}&tip=${tip}&spec=${spec}&specLabel=${specLabel}`;
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
    title.textContent = tr('quiz.failure.title', null, 'Stelline perse!');
    const text = document.createElement('p');
    text.className = 'reward-modal__text';
    text.textContent = tr('quiz.failure.text', null, 'Il quiz ha trollato: le stelline sono tornate a zero. Apri nuove specifiche oppure aspetta il reset automatico (domenica a mezzanotte).');
    const actions = document.createElement('div');
    actions.className = 'reward-modal__actions';
    const ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'reward-action primary';
    ok.textContent = tr('quiz.failure.cta', null, 'Ci riprovo');
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
    burst.textContent = '\uD83C\uDF66';
    const title = document.createElement('h3');
    title.className = 'reward-modal__title';
    title.textContent = tr('quiz.gelato.title', null, 'Bravo! Hai vinto un gelato');
    const text = document.createElement('p');
    text.className = 'reward-modal__text';
    text.textContent = tr('quiz.gelato.text', null, 'Il gelato vola verso il counter e parte il timer di 24 ore. Conserva il mood vincente!');
    const actions = document.createElement('div');
    actions.className = 'reward-modal__actions';
    const ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'reward-action primary';
    ok.textContent = tr('quiz.gelato.cta', null, 'Grande!');
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
    title.textContent = tr('quiz.victory.title', null, 'Complimenti hai vinto un gelato!');
    const text = document.createElement('p');
    text.className = 'reward-modal__text';
    text.textContent = tr('quiz.victory.text', null, 'Tre quiz perfetti di fila. Avvisa il trainer e ricomincia la corsa al prossimo cono.');
    const actions = document.createElement('div');
    actions.className = 'reward-modal__actions';
    const ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'reward-action primary';
    ok.textContent = tr('quiz.victory.cta', null, 'Ok');
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
    crystal.textContent = '\u25C6';
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
    const icon = options.icon || (celebrateSet ? '🌟' : '⭐');
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
        sparkle.textContent = '\u2726';
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
      particle.textContent = ['\u2726', '\u2727', '\u2605'][Math.floor(Math.random() * 3)];
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
    gelato.textContent = '\uD83C\uDF66';
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
    title.textContent = afterQuiz ? 'Gelato gi� riscattato' : 'Frena la gola!';
    const text = document.createElement('p');
    text.className = 'reward-modal__text';
    text.textContent = `Hai gi� ottenuto un gelato virtuale: non essere ingordo! Aspetta ancora ${formatDuration(
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

  const publicApi = {
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

  // === SCROLL BOUNCE FIX ===
  // Listen for safe modal close event and run deferred updateCardChecks
  try {
    document.addEventListener('badiani:modal-closed-safe', () => {
      try { updateCardChecks(); } catch (e) {}
    });
  } catch (e) {}

  return publicApi;
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

// Deep-link to a specific guide card (used by menu search results):
// - ?card=<slug> opens the card modal
// - ?tab=<slug> opens a specific accordion tab inside the modal
// - ?center=1 centers the tab in the modal body (helps learners land exactly where to read)
(() => {
  let cardKey = '';
  let tabKey = '';
  let wantsCenter = false;
  try {
    const params = new URLSearchParams(window.location.search);
    cardKey = (params.get('card') || '').trim().toLowerCase();
    tabKey = (params.get('tab') || params.get('openTab') || '').trim().toLowerCase();
    wantsCenter = ['1', 'true', 'yes', 'y'].includes(String(params.get('center') || '').trim().toLowerCase());
  } catch {
    cardKey = '';
    tabKey = '';
    wantsCenter = false;
  }

  if (!cardKey) return;

  const slugify = (value = '') => {
    return (value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '') || '';
  };

  const prefersReducedMotion = (() => {
    try {
      return !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  })();

  const centerElementInContainer = (container, element) => {
    try {
      if (!container || !element) return;
      const cRect = container.getBoundingClientRect();
      const eRect = element.getBoundingClientRect();
      const currentTop = container.scrollTop;
      const delta = (eRect.top - cRect.top) - (cRect.height / 2 - eRect.height / 2);
      const maxTop = Math.max(0, container.scrollHeight - container.clientHeight);
      const nextTop = Math.max(0, Math.min(maxTop, currentTop + delta));
      container.scrollTo({ top: nextTop, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    } catch {
      /* ignore */
    }
  };

  const openTabInLatestModal = () => {
    if (!tabKey) return;
    let tries = 0;
    const maxTries = 90; // ~1.5s at 60fps

    const tick = () => {
      tries += 1;
      const overlay = document.querySelector('.card-modal-overlay.is-visible') || document.querySelector('.card-modal-overlay');
      const modal = overlay ? overlay.querySelector('.card-modal') : null;
      const accordion = modal ? modal.querySelector('.modal-accordion') : null;
      if (!modal || !accordion) {
        if (tries < maxTries) return requestAnimationFrame(tick);
        return;
      }

      const headers = Array.from(accordion.querySelectorAll('.accordion-header'));
      if (!headers.length) return;
      const targetHeader = headers.find((h) => {
        const titleText = h.querySelector('.accordion-title')?.textContent?.trim() || h.textContent?.trim() || '';
        return slugify(titleText) === tabKey;
      }) || null;

      if (!targetHeader) return;

      try { targetHeader.click(); } catch { /* ignore */ }

      // After opening, center the tab header inside the scrollable modal body.
      if (wantsCenter) {
        const body = modal.querySelector('.card-modal-body') || modal;
        requestAnimationFrame(() => {
          requestAnimationFrame(() => centerElementInContainer(body, targetHeader));
        });
        setTimeout(() => centerElementInContainer(body, targetHeader), 180);
      }
    };

    requestAnimationFrame(tick);
  };

  const focusCard = () => {
    const cards = Array.from(document.querySelectorAll('.guide-card'));
    if (!cards.length) return;

    const candidateKeysForCard = (card) => {
      const keys = new Set();

      // 1) Current title slug (works for non-translated pages)
      try {
        const title = card?.querySelector?.('h3')?.textContent?.trim() || '';
        const k = slugify(title);
        if (k) keys.add(k);
      } catch {
        /* ignore */
      }

      // 2) Stable key from id="card-..." (works across translations)
      try {
        const rawId = String(card?.getAttribute?.('id') || '').trim().toLowerCase();
        if (rawId) keys.add(rawId);
        if (rawId.startsWith('card-') && rawId.length > 5) keys.add(rawId.slice(5));
      } catch {
        /* ignore */
      }

      // 3) If the title is i18n-driven, also accept slugs for *all* supported languages.
      // This keeps existing links (often authored in Italian) working when UI language is EN/ES/FR.
      try {
        const titleEl = card?.querySelector?.('h3');
        const i18nKey = titleEl?.getAttribute?.('data-i18n') || '';
        const dict = window.BadianiI18n?.dict;
        if (i18nKey && dict && typeof dict === 'object') {
          ['it', 'en', 'es', 'fr'].forEach((lang) => {
            const t = dict?.[lang]?.[i18nKey];
            if (t) {
              const k = slugify(String(t));
              if (k) keys.add(k);
            }
          });
        }
      } catch {
        /* ignore */
      }

      return keys;
    };

    const normalizedTargetKey = String(cardKey || '').trim().toLowerCase();

    // Priority 1: Exact ID match (most reliable)
    let target = document.getElementById('card-' + normalizedTargetKey) || 
                 document.getElementById(normalizedTargetKey);

    // Priority 2: Search by keys (titles, translations, etc.)
    if (!target) {
      target = cards.find((card) => {
        const keys = candidateKeysForCard(card);
        return keys.has(normalizedTargetKey);
      });
    }

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

    // Optionally open details, so the user lands �inside� the right card.
    const toggle = target.querySelector('[data-toggle-card]');
    if (toggle) {
      // DISABLED per user request: "non aprirla" (do not open it)
      // try { toggle.click(); } catch {}
      
      // If requested, open a specific tab inside the modal for clarity.
      openTabInLatestModal();
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
      const p = window.BadianiProfile?.getActive?.();
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
      const raw = window.BadianiStorage?.getRaw?.(storageKey()) || localStorage.getItem(storageKey());
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
      if (window.BadianiStorage?.setJSON) {
        window.BadianiStorage.setJSON(storageKey(), value);
        return;
      }
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
    // IMPORTANT: completion should be monotonic within the same day.
    // Do NOT delete a completion flag here; this avoids flicker / cross-page counting differences.

    // Congrats toast (once per day per category), only when it becomes completed.
    const next = !!completion.completed[pageKey];
    const alreadyCelebrated = !!completion.celebrated?.[pageKey];
    if (!prev && next && !alreadyCelebrated) {
      completion.celebrated[pageKey] = true;
      const categoryName = document.querySelector('h1')?.textContent?.trim() || 'la categoria';
      showToastLite(`🎉 Complimenti! Hai completato “${categoryName}”.`);
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
    if (/^[��\-��.]+$/.test(t)) return true;
    if (t === 'life') return true;
    if (t === 'niente' || t === 'nulla' || t === 'nessuno') return true;
    if (t === 'da definire') return true;
    return false;
  };
  const normalizeBulletNoise = (value) => {
    const text = specTidy(value);
    if (!text) return '';
    return text
      // Clean odd paste artifacts like "�. �" or "+.".
      .replace(/\s*\+\s*\./g, ' +')
      .replace(/\s*�\s*\./g, ' �')
      .replace(/\s*\.\s*�\s*/g, ' � ')
      .replace(/\s*�\s*/g, ' � ')
      // Collapse repeated separators and punctuation noise.
      .replace(/(\s*�\s*){2,}/g, ' � ')
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
    const keys = ['Shelf life mix', 'Cup', 'Tazza', 'Milk', 'Latte', 'Pulizia', 'Servizio', 'Temperatura', 'Target', 'Mix', 'Warm-up', 'Riposo', 'Shelf life', 'Conservazione', 'Porzioni'];
    const keyAlternation = keys
      .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .sort((a, b) => b.length - a.length)
      .join('|');
    const re = new RegExp(`\\b(${keyAlternation})\\b`, 'gi');
    const matches = [];
    let m;
    let lastEnd = -1;
    while ((m = re.exec(text))) {
      const start = m.index;
      const len = (m[0] || '').length;
      const end = start + len;
      // Skip matches that sit inside a longer match (e.g. "Mix" inside "Shelf life mix").
      if (lastEnd >= 0 && start < lastEnd) continue;
      matches.push({ index: start });
      lastEnd = end;
    }
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
    const tokenMatch = text.match(/^([A-Za-z�-�0-9�]{2,14})\s+(.+)$/);
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
      if (d.includes('�c') || d.includes('target')) return 'Temperatura';
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
    if (l === 'shelf life') {
      const cleaned = d.replace(/^life\b\s*/i, '').trim();
      if (!cleaned || cleaned.toLowerCase() === 'life') return 'Da definire';
      return cleaned;
    }
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
      return { label: entry.label, detail: Array.from(entry.details).join(' • ') };
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
  // Esegui subito (script spesso � in fondo pagina) e anche a DOM pronto.
  normalizeGuideCardStatLists();
  window.addEventListener('DOMContentLoaded', normalizeGuideCardStatLists);
} catch {}

// Fix common emoji/encoding paste artifacts across pages (e.g. "?? Upselling", "??? Pro tip", broken search button).
const normalizePasteArtifactsInUI = () => {
  try {
    const fixText = (node) => {
      if (!node) return;
      const t = (node.textContent || '').trim();
      if (!t) return;
      if (t === '?? Upselling') node.textContent = 'Upselling';
      if (t === '?? Tecniche di Vendita' || t === '?? Tecniche di vendita') node.textContent = 'Tecniche di vendita';
      if (t === '??? Pro tip:' || t === '??? Pro tip') node.textContent = 'Pro tip:';
      if (t === '??? Qualit\u00E0 check:' || t === '??? Qualita check:' || t === '??? Qualit\u00E0 check') node.textContent = 'Qualit\u00E0 check:';
    };

    document
      .querySelectorAll('.details strong, .tips strong, .steps strong')
      .forEach((el) => fixText(el));

    const searchBtn = document.querySelector('[data-menu-search-btn]');
    if (searchBtn && (searchBtn.textContent || '').trim() === '??') {
      searchBtn.textContent = 'Cerca';
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

  // Mark cards that have an interactive modal.
  // (Avoid relying on CSS :has(), which isn't supported on some mobile browsers.)
  try {
    const card = button.closest('.guide-card');
    if (card) card.classList.add('has-modal');
  } catch (e) {}

  button.addEventListener('click', (event) => {
    // Prevent default navigation/scroll jumps (e.g. <a href="#"> or implicit form submit).
    try { event.preventDefault(); } catch (e) {}
    try { event.stopPropagation(); } catch (e) {}

    const card = button.closest('.guide-card');
    if (!card) return;
    const details = card.querySelector('.details');
    if (!details) return;
    const cardTitle = card.querySelector('h3')?.textContent || '';
    const cardId = (gamification?.getCardIdFor ? gamification.getCardIdFor(card) : '') || card.dataset.rewardId || cardTitle;

    // Remember where the user was, so closing the modal does not jump the page.
    // Also keep the carousel horizontal position stable.
    const openerRestore = (() => {
      try {
        const getEffectiveScrollY = () => {
          try {
            const y = window.pageYOffset;
            if (typeof y === 'number' && y > 0) return y;
          } catch (e) {}
          try {
            const y2 = document.documentElement ? document.documentElement.scrollTop : 0;
            if (typeof y2 === 'number' && y2 > 0) return y2;
          } catch (e) {}
          try {
            const y3 = document.body ? document.body.scrollTop : 0;
            if (typeof y3 === 'number' && y3 > 0) return y3;
          } catch (e) {}
          try {
            const top = String(document.body?.style?.top || '').trim();
            if (!top) return 0;
            const n = parseInt(top, 10);
            if (!Number.isFinite(n)) return 0;
            return Math.abs(n);
          } catch (e) {
            return 0;
          }
        };
        const track = card.closest('[data-carousel-track]');
        return {
          scrollY: getEffectiveScrollY(),
          track,
          trackScrollLeft: track ? track.scrollLeft : 0,
          focusEl: button,
          cardId: card && card.id ? card.id : null
        };
      } catch (e) {
        return { scrollY: window.pageYOffset, track: null, trackScrollLeft: 0, focusEl: button, cardId: null };
      }
    })();

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

    const CRYSTAL_ICON_SVG = `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path fill="currentColor" d="M12 2l7 7-7 13L5 9l7-7zm0 3.2L7.9 9H16.1L12 5.2z"/>
      </svg>
    `;
    const STAR_ICON_SVG = `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path fill="currentColor" d="M12 2.5l2.9 6.1 6.7.6-5.1 4.4 1.6 6.6L12 16.9 5.9 20.2l1.6-6.6-5.1-4.4 6.7-.6L12 2.5z"/>
      </svg>
    `;
    crystalChip.innerHTML = `
      <span class="card-modal-crystals__icon" aria-hidden="true">
        ${CRYSTAL_ICON_SVG}
      </span>
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

    // Post-star UX: allow trainees to reveal ALL tab contents at once.
    // Hidden until the card is converted to a star.
    let allowMultiOpenTabs = false;
    // Guidance toast for the icon-only �study mode� toggle.
    const allTabsControl = {
      wrapper: null,
      button: null,
      hint: null,
      accordion: null,
      apis: [],
      starred: false
    };

    const syncAllTabsControlUI = () => {
      const btn = allTabsControl.button;
      const wrap = allTabsControl.wrapper;
      if (!btn || !wrap) return;
      const unlocked = !!allTabsControl.starred;

      wrap.hidden = !unlocked;
      btn.hidden = !unlocked;
      btn.disabled = !unlocked;

      btn.setAttribute('aria-pressed', allowMultiOpenTabs ? 'true' : 'false');
      const label = allowMultiOpenTabs ? 'Vista singola' : 'Mostra tutto';
      btn.setAttribute('aria-label', label);
      try { btn.title = label; } catch (e) {}
      try {
        const sr = btn.querySelector('.sr-only');
        if (sr) sr.textContent = label;
        else btn.textContent = label;
      } catch (e) {
        btn.textContent = label;
      }

      if (allTabsControl.hint) {
        allTabsControl.hint.textContent = allowMultiOpenTabs
          ? 'Modalit� studio: tutti i tab sono aperti.'
          : 'Modalit� studio: apri tutti i tab insieme.';
      }
    };

    const openAllTabsSilently = () => {
      try {
        (allTabsControl.apis || []).forEach((api) => {
          try { api.openSilently(); } catch (e) {}
        });
      } catch (e) {}
    };

    const collapseToSingleTab = () => {
      try {
        const apis = (allTabsControl.apis || []).filter(Boolean);
        if (!apis.length) return;
        const openOnes = apis.filter((api) => api.item && api.item.classList.contains('is-open'));
        const keep = openOnes[0] || apis[0];
        apis.forEach((api) => {
          if (!api || api === keep) return;
          try { api.closeSilently(); } catch (e) {}
        });
        try { keep.openSilently(); } catch (e) {}
      } catch (e) {}
    };

    const toggleAllTabsMode = () => {
      if (!allTabsControl.starred) return;
      allowMultiOpenTabs = !allowMultiOpenTabs;
      if (allowMultiOpenTabs) openAllTabsSilently();
      else collapseToSingleTab();
      syncAllTabsControlUI();

      try {
        // Use the standard (non-anchored) toast for maximum reliability inside modals.
        if (allowMultiOpenTabs) {
          showToast('Modalit\u00E0 studio attiva: scorri per leggere tutta la scheda (tutti i tab sono aperti).');
        } else {
          showToast('Vista singola: apri una sezione alla volta toccando il titolo del tab.');
        }
      } catch (e) {}
    };

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

      // Unlock the �open all tabs� control once the star is obtained.
      try {
        allTabsControl.starred = converted;
        if (!converted && allowMultiOpenTabs) allowMultiOpenTabs = false;
        syncAllTabsControlUI();
      } catch (e) {}

      const icon = crystalChip.querySelector('.card-modal-crystals__icon');
      const suffix = crystalChip.querySelector('.card-modal-crystals__suffix');
      if (converted) {
        crystalChip.classList.add('is-starred');
        if (icon) icon.innerHTML = STAR_ICON_SVG;
        modalCrystalValue.textContent = '';
        modalCrystalValue.hidden = true;
        if (suffix) {
          suffix.textContent = '';
          suffix.hidden = true;
        }
        crystalChip.setAttribute('aria-label', 'Stella ottenuta');
      } else {
        crystalChip.classList.remove('is-starred');
        if (icon) icon.innerHTML = CRYSTAL_ICON_SVG;
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
      // NOTE: Escape '?' or the regex becomes invalid ("Nothing to repeat").
      if (/(stella|cristall|\?)/i.test(msg)) {
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
    const isProductCard = !!card.classList?.contains('guide-card--product');
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
    const tidyInline = (value) => String(value || '').replace(/\s+/g, ' ').trim();

    // --- Panoramica (extended in modal, short on card) ---
    // Prefer a dedicated i18n key: replace trailing `.desc` with `.overview`.
    // Fallback: auto-generate a longer product/ops description (no meta sections like
    // “Focus / cosa troverai / perché conta / come usarlo”).
    let introClone = null;
    let overviewTabContent = null;
    const introI18nKey = intro
      ? (intro.getAttribute('data-i18n-html') || intro.getAttribute('data-i18n') || '')
      : '';
    const overviewI18nKey = (introI18nKey && /\.desc$/i.test(introI18nKey))
      ? introI18nKey.replace(/\.desc$/i, '.overview')
      : '';

    const titleTextForOverview = tidyInline(card.querySelector('h3')?.textContent || '');
    const descTextForOverview = tidyInline(intro?.textContent || '');
    const buildExtendedFromStats = () => {
      try {
        if (!statList) return '';
        const items = Array.from(statList.querySelectorAll('li'))
          .map((li) => tidyInline(li.textContent || ''))
          .filter(Boolean);
        if (!items.length) return '';

        // Take a few key points and turn them into a readable paragraph.
        const chosen = items.slice(0, 3).map((t) => t.replace(/[.\s]+$/g, '').trim());
        const sentence = chosen.join('. ') + '.';
        return sentence;
      } catch (e) {
        return '';
      }
    };

    const extendedFromStats = buildExtendedFromStats();

    if (overviewI18nKey) {
      const custom = tr(overviewI18nKey, null, null);
      if (custom && custom !== overviewI18nKey) {
        try {
          const wrap = document.createElement('div');
          wrap.className = 'card-modal-overview';

          const inner = document.createElement('div');
          inner.className = 'card-modal-intro';
          inner.innerHTML = String(custom);

          wrap.appendChild(inner);
          overviewTabContent = wrap;
        } catch (e) {
          overviewTabContent = null;
        }
      }
    }

    if (!overviewTabContent && (descTextForOverview || titleTextForOverview || extendedFromStats)) {
      try {
        const wrap = document.createElement('div');
        wrap.className = 'card-modal-overview';

        const inner = document.createElement('div');
        inner.className = 'card-modal-intro';

        const parts = [];
        if (titleTextForOverview || descTextForOverview) {
          parts.push(`<p><strong>${titleTextForOverview}</strong>${descTextForOverview ? ` — ${descTextForOverview}` : ''}</p>`);
        }
        if (extendedFromStats) {
          parts.push(`<p>${extendedFromStats}</p>`);
        }

        inner.innerHTML = parts.filter(Boolean).join('');
        wrap.appendChild(inner);
        overviewTabContent = wrap;
      } catch (e) {
        overviewTabContent = null;
      }
    }

    // Keep a clone of the short intro paragraph available as a last-resort fallback.
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
      if (/^[��\-��.]+$/.test(t)) return false;
      // Discard explicit placeholders.
      if (t === 'life') return false;
      if (t === 'niente' || t === 'nulla' || t === 'nessuno') return false;
      if (t === 'da definire') return false;
      return true;
    };

    const normalizeBulletNoise = (value) => {
      const text = tidy(value);
      if (!text) return '';
      return text
        // Clean odd paste artifacts like "�. �" or "+.".
        .replace(/\s*\+\s*\./g, ' +')
        .replace(/\s*�\s*\./g, ' �')
        .replace(/\s*\.\s*�\s*/g, ' � ')
        .replace(/\s*�\s*/g, ' � ')
        // Collapse repeated separators and punctuation noise.
        .replace(/(\s*�\s*){2,}/g, ' � ')
        .replace(/,{2,}/g, ',')
        .replace(/\s*\+\s*$/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    };

    const splitDetailPoints = (detail) => {
      const text = normalizeBulletNoise(detail);
      if (!text) return [];
      const parts = text
        .split(' � ')
        .map((p) => tidy(p).replace(/^[\-�]+\s*/g, '').trim())
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
        'Shelf life mix',
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
      let lastEnd = -1;
      while ((m = re.exec(text))) {
        const start = m.index;
        const len = (m[0] || '').length;
        const end = start + len;
        // Skip matches that sit inside a longer match (e.g. "Mix" inside "Shelf life mix").
        if (lastEnd >= 0 && start < lastEnd) continue;
        matches.push({ index: start });
        lastEnd = end;
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
      if (l.includes('stop') && d.includes('�c')) return 'Temperatura';
      if (l.includes('shelf') || l.includes('durata')) return 'Shelf life';
      if (l.includes('riposo')) return 'Riposo';
      if (l.includes('mix')) return 'Mix';
      if (l.includes('warm')) return 'Warm-up';
      if (l.includes('ladle') || l.includes('mestolo')) return 'Dosaggio';
      if (l.includes('vaso') || l.includes('bicchiere')) return 'Tazza';
      if (l.includes('shot')) return 'Espresso';
      if (l.includes('foam') || l.includes('schium')) return 'Schiuma';

      if (rawLabel === 'Dettaglio' || !rawLabel) {
        if (d.includes('�c') || d.includes('target')) return 'Temperatura';
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
        if (/^\d+(?:[.,]\d+)?\s*�c$/i.test(cleaned)) {
          return `Target: ${cleaned} (temperatura di servizio).`;
        }
        const withColon = cleaned.replace(/^target\s+/i, 'Target: ');
        if (/^stop\s+a\s+\d+(?:[.,]\d+)?\s*�c$/i.test(withColon)) {
          return `${withColon} (fermati a questa temperatura).`;
        }
        return /[.!?]$/.test(withColon) ? withColon : `${withColon}.`;
      }
      if (l === 'shelf life') {
        const cleaned = d.replace(/^life\b\s*/i, '').trim();
        // If the parser captured only the placeholder token "life", drop it.
        if (!cleaned || cleaned.toLowerCase() === 'life') return '';
        // Add a short, learner-friendly explanation without changing the factual value.
        const base = cleaned.replace(/[.\s]+$/g, '').trim();
        if (!base) return '';
        return `${base}. Indica fino a quando puoi usarlo mantenendo qualit� e sicurezza, se conservato correttamente.`;
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
        if (/\+\s*?\s*volume/i.test(cleaned) || /\+\s*1\/3\s*volume/i.test(cleaned)) {
          return 'Obiettivo: aumentare il volume di circa 1/3 (incorporando aria all�inizio).';
        }
        return /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`;
      }
      if (l === 'warm-up') {
        const cleaned = d.replace(/[.\s]+$/g, '').trim();
        if (!cleaned || cleaned.toLowerCase() === 'warm-up' || cleaned.toLowerCase() === 'warm up') {
          return 'Preriscaldamento: completa la fase di avvio dell�attrezzatura prima del servizio (segui le indicazioni della postazione).';
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
      const stopTemp = text.match(/^\s*stop\s+a\s*(\d+(?:[.,]\d+)?)\s*�c\b/i);
      if (stopTemp) {
        return { label: 'Temperatura', detail: `Stop a ${stopTemp[1]}�C` };
      }
      const targetTemp = text.match(/^\s*target\s*(\d+(?:[.,]\d+)?)\s*�c\b/i);
      if (targetTemp) {
        return { label: 'Temperatura', detail: `Target: ${targetTemp[1]}�C` };
      }

      if (text.includes(':')) {
        const [labelPart, ...rest] = text.split(':');
        const detail = tidy(rest.join(':'));
        const labelText = tidy(labelPart) || 'Dettaglio';
        return { label: labelText, detail: detail || 'Da definire' };
      }

      // Heuristic: "Key value" (e.g., Milk stretch...).
      const tokenMatch = text.match(/^([A-Za-z�-�0-9�]{2,14})\s+(.+)$/);
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
            detail: details.join(' ◆ ')
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
      // The accordion tab already provides the section title (e.g. "Specifiche").
      // Avoid repeating headings/subtitles inside the panel.

      const grid = document.createElement('div');
      grid.className = 'modal-specs__grid';

      const isPlaceholderDetail = (value) => {
        const v = tidy(value).toLowerCase();
        if (!v) return true;
        if (v === '-' || v === '�' || v === '�') return true;
        if (v === 'n/a' || v === 'na') return true;
        if (v.includes('da definire')) return true;
        return false;
      };

      const safeItems = (items || [])
        .filter((i) => i?.label && i?.detail && !isPlaceholderDetail(i?.detail))
        .slice(0, 8);

      safeItems.forEach((item) => {
        const parts = splitDetailPoints(item.detail);
        const hasBullets = parts.length > 1;
        const hasSingle = parts.length === 1;
        const valueText = hasSingle ? parts[0] : '';

        // If everything is junk/noise, skip the entire row (no empty tiles).
        if (!hasBullets && !tidy(valueText)) return;

        const row = document.createElement('div');
        row.className = 'modal-specs__item';

        const k = document.createElement('span');
        k.className = 'modal-specs__key';
        k.textContent = displayLabel(item.label, item.detail);

        const v = document.createElement('div');
        v.className = 'modal-specs__value';

        if (hasBullets) {
          const ul = document.createElement('ul');
          ul.className = 'modal-specs__bullets';
          parts.slice(0, 6).forEach((p) => {
            const li = document.createElement('li');
            li.textContent = p;
            ul.appendChild(li);
          });
          v.appendChild(ul);
        } else {
          v.textContent = valueText;
        }

        row.appendChild(k);
        row.appendChild(v);
        grid.appendChild(row);
      });

      // If nothing meaningful remains, do not render the specs panel.
      if (!grid.children.length) return null;

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
        if (/\bprima\s+(dell'?|di\s+)apertura\b|\bapertura\b/.test(t)) return 'Prima dell�apertura';
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
        ...(tagsForCard.length ? [{ label: 'Focus', detail: tagsForCard.join(' ◆ ') }] : []),
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

    let specsPanelForTab = null;

    // IMPORTANT: never fallback to a duplicated list.
    // New rule: "Specifiche" lives inside the accordion (counts as a tab) across all cards.
    if (specsWithoutEssentials.length) {
      specsPanelForTab = createSpecsPanel(specsWithoutEssentials, {
        // keep opts for future use; no generic subtitle text.
      });
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

    // Intro is now rendered in the "Panoramica" accordion tab (across all cards).

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
        const isTakeAwayBlock =
          strongText.includes('take away') ||
          strongText.includes('takeaway') ||
          strongText.includes('tw') ||
          strongText.includes('??');
        if (isTakeAwayBlock) return 'Take Away';
        const isSalesBlock = strongText.includes('upsell') || strongText.includes('upselling') || strongText.includes('??') || strongText.includes('vendita');
        if (isSalesBlock) {
          if (strongText.includes('vendita')) return 'Tecniche di vendita';
          return isSafetyCard ? 'Comunicazione al cliente' : 'Upselling';
        }
        return 'Procedura';
      }
      if (strongText.includes('troubleshoot') || strongText.includes('troubleshooting') || strongText.includes('problemi') || strongText.includes('errori')) {
        return 'Troubleshooting';
      }
      if (strongText.includes('pro tip') || strongText.includes('??')) return 'Pro tip';
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
      if (text.includes('??') || text.includes('??')) {
        heading.remove();
      }
    });

    if (blocks.length) {
      const accordion = document.createElement('div');
      accordion.className = 'modal-accordion';
      try { allTabsControl.accordion = accordion; } catch (e) {}
      const openers = [];
      const createdTabTitles = new Set();
      const seenTabContent = new Set();
      const MAX_MODAL_TABS = 5;
      const MIN_MODAL_TABS = 4;
      const maxTabs = MAX_MODAL_TABS;
      const minTabs = MIN_MODAL_TABS;
      let overflowSection = null;

      // Topic hook (styling-only): expose a stable, low-cardinality topic key so CSS
      // can color-code tabs by argument without changing any copy.
      const inferTabTopic = (title) => {
        const t = tidy(title).toLowerCase();
        if (!t) return '';

        if (t.includes('panoramica')) return 'panoramica';
        if (t.includes('ricetta')) return 'ricetta';
        if (t.includes('procedura') || t.includes('preparazione')) return 'procedura';
        if (t.includes('parametri')) return 'parametri';
        if (t.includes('servizio')) return 'servizio';
        if (t.includes('conserv')) return 'conservazione';
        if (t.includes('pulizia')) return 'pulizia';
        if (t.includes('note')) return 'note';
        if (t.includes('checklist')) return 'checklist';
        if (t.includes('focus')) return 'focus';

        if (t.includes('take away') || t.includes('takeaway')) return 'takeaway';
        if (t.includes('troubleshoot')) return 'troubleshooting';
        if (t.includes('upsell')) return 'upselling';
        if (t.includes('vendita')) return 'vendita';
        if (t.includes('approfond')) return 'approfondimenti';
        if (t.includes('dettagli')) return 'dettagli';

        return 'altro';
      };

      const ensureOverflowSection = () => {
        if (overflowSection) return overflowSection;
        overflowSection = document.createElement('div');
        overflowSection.className = 'card-modal-overflow';
        return overflowSection;
      };

      const getModalTitleI18nKey = (rawTitle) => {
        const t = tidy(rawTitle).toLowerCase();
        if (!t) return '';
        if (t.includes('panoramica')) return 'modal.tab.overview';
        if (t.includes('specifiche')) return 'modal.tab.specs';
        if (t.includes('ricetta')) return 'modal.tab.recipe';
        if (t.includes('preparaz')) return 'modal.tab.preparation';
        if (t.includes('procedura')) return 'modal.tab.procedure';
        if (t.includes('parametri')) return 'modal.tab.parameters';
        if (t.includes('servizio')) return 'modal.tab.service';
        if (t.includes('conserv')) return 'modal.tab.storage';
        if (t.includes('pulizia')) return 'modal.tab.cleaning';
        if (t.includes('take away') || t.includes('takeaway')) return 'modal.tab.takeAway';
        if (t.includes('troubleshoot')) return 'modal.tab.troubleshooting';
        if (t.includes('upsell')) return 'modal.tab.upselling';
        if (t.includes('tecniche di vendita') || t.includes('vendita')) return 'modal.tab.salesTechniques';
        if (t.includes('pro tip')) return 'modal.tab.proTip';
        if (t.includes('sugger')) return 'modal.tab.tips';
        if (t.includes('approfond')) return 'modal.tab.insights';
        if (t.includes('checklist')) return 'modal.tab.checklist';
        if (t.includes('focus')) return 'modal.tab.focus';
        if (t.includes('altri dettagli')) return 'modal.section.moreDetails';
        if (t.includes('dettagli')) return 'modal.label.details';
        if (t.includes('note')) return 'modal.tab.notes';
        return '';
      };

      const pushOverflowGroup = (title, contentEl) => {
        // Skip duplicated content (common when the same text was pasted into multiple blocks).
        try {
          const snap = tidy(contentEl?.textContent).toLowerCase().replace(/\s+/g, ' ').trim();
          const key = snap ? snap.slice(0, 1400) : '';
          if (key && key.length > 120) {
            if (seenTabContent.has(key)) return;
            seenTabContent.add(key);
          }
        } catch (e) {}

        // Keep extra content reachable without adding more tabs.
        const wrap = ensureOverflowSection();
        try {
          const label = document.createElement('p');
          label.className = 'card-modal-section__title';
          const raw = String(title || 'Dettagli');
          const k = getModalTitleI18nKey(raw);
          if (k) label.setAttribute('data-i18n', k);
          label.textContent = k ? tr(k, null, raw) : raw;
          wrap.appendChild(label);
        } catch (e) {}
        wrap.appendChild(contentEl);
      };

      const createAccordionItem = (title, contentEl, expandByDefault = false) => {
        if (!contentEl) return;

        const hasMeaningfulTabContent = (el) => {
          try {
            // Specs-only tabs are considered "meaningful" only if they have enough rows.
            const specRows = el.querySelectorAll ? el.querySelectorAll('.modal-specs__item') : [];
            if (specRows && specRows.length >= 2) return true;

            // Bullet lists: require at least 2 bullets to justify a standalone tab.
            const bullets = el.querySelectorAll ? el.querySelectorAll('li') : [];
            if (bullets && bullets.length >= 2) return true;

            const text = tidy(el.textContent).replace(/\s+/g, ' ').trim();
            // Avoid tabs with just a couple of words.
            if (text.length >= 60) return true;
            return false;
          } catch (e) {
            const text = tidy(el?.textContent).replace(/\s+/g, ' ').trim();
            return text.length >= 60;
          }
        };

        // User requirement: never show tabs with no/too little information.
        if (!hasMeaningfulTabContent(contentEl)) return;

        // Avoid creating tabs that repeat the same information.
        // (This can happen if a card has duplicated `.steps/.tips` content or if multiple
        // sources resolve to the same text once normalized.)
        try {
          const snap = tidy(contentEl?.textContent).toLowerCase().replace(/\s+/g, ' ').trim();
          const key = snap ? snap.slice(0, 1400) : '';
          if (key && key.length > 120) {
            if (seenTabContent.has(key)) return;
            seenTabContent.add(key);
          }
        } catch (e) {}

        if (totalTabsCount >= maxTabs) {
          pushOverflowGroup(title, contentEl);
          return;
        }
        totalTabsCount += 1;
        createdTabTitles.add(String(title || '').trim());
        const item = document.createElement('article');
        item.className = 'accordion-item';
        try {
          const topic = inferTabTopic(title);
          if (topic) item.dataset.topic = topic;
        } catch (e) {}
        const header = document.createElement('button');
        header.type = 'button';
        header.className = 'accordion-header';
        header.setAttribute('aria-expanded', 'false');
        header.innerHTML = `<span class="accordion-title"></span><span class="accordion-chevron" aria-hidden="true"></span>`;
        try {
          const titleSpan = header.querySelector('.accordion-title');
          const raw = String(title || '').trim();
          const k = getModalTitleI18nKey(raw);
          if (titleSpan) {
            if (k) titleSpan.setAttribute('data-i18n', k);
            titleSpan.textContent = k ? tr(k, null, raw) : raw;
          }
        } catch (e) {}
        try {
          const topic = item.dataset.topic;
          if (topic) header.dataset.topic = topic;
        } catch (e) {}
        const body = document.createElement('div');
        body.className = 'accordion-body';
        body.appendChild(contentEl);

        // Add per-tab indicator: pending (?) if not opened today, completed (?) if already opened.
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
            ind.textContent = '';
            header.classList.add('tab-starred');
          } else if (alreadyOpened) {
            ind.classList.add('is-opened');
            ind.textContent = '';
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

        // Register for �open all tabs� mode (silent open/close, no gamification triggers).
        try {
          allTabsControl.apis.push({
            item,
            header,
            body,
            openSilently: () => setOpen(true),
            closeSilently: () => setOpen(false)
          });
        } catch (e) {}

        header.addEventListener('click', (event) => {
          const willExpand = !item.classList.contains('is-open');

          // Accordion behavior: only one tab open at a time.
          if (willExpand && !allowMultiOpenTabs) {
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
                  ind.textContent = '';
                } else {
                  ind.classList.add('is-opened');
                  ind.textContent = '';
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

      const createMiniSpecTab = (tabTitle, items) => {
        const wrap = document.createElement('div');
        wrap.className = 'card-modal-mini-specs';

        const ul = document.createElement('ul');
        ul.className = 'modal-specs__bullets';

        (items || []).slice(0, 10).forEach((item) => {
          const li = document.createElement('li');
          const label = tidy(item?.label);
          const detail = tidy(item?.detail);
          if (!detail) return;
          if (label && label.toLowerCase() !== 'dettaglio') {
            const strong = document.createElement('strong');
            strong.textContent = `${label}:`;
            li.appendChild(strong);
            li.appendChild(document.createTextNode(` ${detail}`));
          } else {
            li.textContent = detail;
          }
          ul.appendChild(li);
        });

        wrap.appendChild(ul);
        return wrap;
      };

      const buildSpecGroupsFromItems = (items) => {
        const groups = new Map();
        const addTo = (key, item) => {
          if (!key || !item) return;
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key).push(item);
        };

        (items || []).forEach((item) => {
          const label = tidy(item?.label).toLowerCase();
          const detail = tidy(item?.detail).toLowerCase();
          const blob = `${label} ${detail}`;

          if (/\b(shelf\s*life|conserv|frigo|freez|defrost|riposo|abbatt)\b/.test(blob)) {
            addTo('Conservazione', item);
            return;
          }
          if (/\b(servizio|tazza|cup|piatto|posat|vassoio|take\s*away|takeaway|\boz\b|pack)\b/.test(blob)) {
            addTo('Servizio', item);
            return;
          }
          if (/\b(pulizia|clean|flush|sanific|igiene|haccp)\b/.test(blob)) {
            addTo('Pulizia', item);
            return;
          }
          if (/\b(temperatura|�c|sec|min|dose|shot|g\b|gr\b|kg\b|ml\b|porzion|cottura|estrazion|foam|schium|target|stop)\b/.test(blob)) {
            addTo('Parametri', item);
            return;
          }
          addTo('Note', item);
        });

        const ordered = ['Parametri', 'Servizio', 'Conservazione', 'Pulizia', 'Note'];
        return ordered
          .map((title) => ({ title, items: groups.get(title) || [] }))
          // User requirement: don't create tabs with too little info.
          // Only keep groups with at least 2 meaningful items.
          .filter((entry) => entry.items && entry.items.length >= 2);
      };

      // Panoramica (extended in modal, short on card).
      if (overviewTabContent) {
        createAccordionItem('Panoramica', overviewTabContent, false);
      } else if (introClone) {
        const overview = document.createElement('div');
        overview.className = 'card-modal-overview';
        overview.appendChild(introClone);
        createAccordionItem('Panoramica', overview, false);
      }

      // Specs: group into distinct training tabs to avoid repeating the same list in multiple places.
      // We use the already filtered `specsWithoutEssentials` so we don't duplicate highlights/recipe/prep.
      const specGroups = buildSpecGroupsFromItems(specsWithoutEssentials);

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

      // Product-only: ensure "Ricetta" exists first.
      if (!isSafetyCard && recipeSummary) {
        createAccordionItem('Ricetta', recipeSummary, false);
      }

      // Parametri: keep numeric/technical bits separate from step-by-step instructions.
      // If we have both a preparation meta summary AND a Parametri spec group, merge them into one tab.
      const parametriGroup = specGroups.find((g) => g.title === 'Parametri');
      if (!isSafetyCard && preparationMetaSummary) {
        const paramWrap = document.createElement('div');
        paramWrap.className = 'accordion-group';
        paramWrap.appendChild(preparationMetaSummary);
        if (parametriGroup && parametriGroup.items && parametriGroup.items.length) {
          try {
            const panel = createSpecsPanel(parametriGroup.items, {});
            if (panel) paramWrap.appendChild(panel);
          } catch (e) {}
        }
        createAccordionItem('Parametri', paramWrap, false);
      } else if (parametriGroup && parametriGroup.items && parametriGroup.items.length) {
        const panel = createSpecsPanel(parametriGroup.items, {});
        if (panel) createAccordionItem('Parametri', panel, false);
      }

      // Remaining spec groups become their own tabs (excluding Parametri which is handled above).
      specGroups
        .filter((g) => g.title !== 'Parametri')
        .forEach((g) => {
          try {
            const panel = createSpecsPanel(g.items, {});
            if (panel) createAccordionItem(g.title, panel, false);
          } catch (e) {}
        });

      // Priority rules (global):
      // - Keep the most operational tabs inside the 5-tab cap.
      // - Merge low-priority sections into a single "Approfondimenti" tab when needed.
      // - Anything beyond the cap is rendered under "Altri dettagli" (outside tabs).
      const buildGroupWrapper = (group) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'accordion-group';
        group.items.forEach((el) => wrapper.appendChild(el));
        return wrapper;
      };

      const groupByTitle = new Map(grouped.map((g) => [g.title, g]));
      const titlesPresent = new Set(grouped.map((g) => g.title));

      const HIGH = ['Procedura', 'Ricetta', 'Parametri', 'Take Away', 'Troubleshooting'];
      const MID = ['Upselling', 'Tecniche di vendita'];
      const LOW = ['Pro tip', 'Suggerimenti'];

      const allTitlesInPriority = [...HIGH, ...MID, ...LOW];
      const otherTitles = Array.from(titlesPresent).filter((t) => !allTitlesInPriority.includes(t));

      const slotsLeftForGroups = () => {
        // Panoramica/Specifiche/others already incremented totalTabsCount.
        // We only care about what's left for group blocks.
        return Math.max(0, 5 - totalTabsCount);
      };

      const selected = [];
      const lowBucket = [];
      const overflow = [];

      const takeGroup = (title) => {
        const g = groupByTitle.get(title);
        if (!g) return;
        if (LOW.includes(title) || otherTitles.includes(title)) {
          lowBucket.push(g);
        } else {
          selected.push(g);
        }
      };

      // Always try to include high + mid as individual tabs first.
      HIGH.forEach(takeGroup);
      MID.forEach(takeGroup);

      // Any remaining groups not explicitly categorized go to low bucket.
      otherTitles.forEach(takeGroup);
      // Explicit low groups last.
      LOW.forEach(takeGroup);

      // Add selected groups as individual tabs as long as we have slots.
      selected.forEach((group) => {
        if (slotsLeftForGroups() <= 0) {
          overflow.push(group);
          return;
        }
        createAccordionItem(group.title, buildGroupWrapper(group), false);
      });

      // Handle low priority groups: either separate, merged, or overflow.
      if (lowBucket.length) {
        const free = slotsLeftForGroups();
        if (free <= 0) {
          overflow.push(...lowBucket);
        } else if (lowBucket.length <= free) {
          lowBucket.forEach((group) => {
            if (slotsLeftForGroups() <= 0) {
              overflow.push(group);
              return;
            }
            createAccordionItem(group.title, buildGroupWrapper(group), false);
          });
        } else {
          // Only one slot (or not enough): merge into one tab.
          if (slotsLeftForGroups() > 0) {
            const merged = document.createElement('div');
            merged.className = 'accordion-group';
            lowBucket.forEach((group) => {
              try {
                const label = document.createElement('p');
                label.className = 'card-modal-section__title';
                const raw = String(group.title || '').trim();
                const k = getModalTitleI18nKey(raw);
                if (k) label.setAttribute('data-i18n', k);
                label.textContent = k ? tr(k, null, raw) : raw;
                merged.appendChild(label);
              } catch (e) {}
              merged.appendChild(buildGroupWrapper(group));
            });
            createAccordionItem('Approfondimenti', merged, false);
          } else {
            overflow.push(...lowBucket);
          }
        }
      }

      // Anything that didn't make it becomes overflow content (outside accordion).
      if (overflow.length) {
        overflow.forEach((group) => {
          try {
            pushOverflowGroup(group.title, buildGroupWrapper(group));
          } catch (e) {}
        });
      }

      // Ensure enough useful, non-duplicated tabs for progression.
      // Instead of generating more tabs from the same specs (which duplicates content),
      // add a lightweight Checklist tab derived from existing tags/intro.
      const targetTabs = Math.min(maxTabs, Math.max(minTabs, 4));
      if (totalTabsCount < targetTabs && !createdTabTitles.has('Checklist')) {
        try {
          const checklist = document.createElement('div');
          checklist.className = 'card-modal-mini-specs';
          const ul = document.createElement('ul');
          ul.className = 'modal-specs__bullets';

          const tagsText = Array.from(card.querySelectorAll('.tag-row .tag'))
            .map((t) => tidy(t.textContent))
            .filter(Boolean);

          const introText = tidy(intro?.textContent);
          const firstSentence = (() => {
            if (!introText) return '';
            const m = introText.match(/[^.!?]+[.!?]+/);
            const first = (m && m[0]) ? m[0] : introText;
            const cleaned = tidy(first).replace(/[\s.]+$/g, '').trim();
            return cleaned.length >= 18 ? cleaned : '';
          })();

          const mkLi = (labelKey, fallbackLabel, value) => {
            if (!value) return;
            const li = document.createElement('li');
            const strong = document.createElement('strong');
            const span = document.createElement('span');
            if (labelKey) span.setAttribute('data-i18n', labelKey);
            span.textContent = labelKey ? tr(labelKey, null, fallbackLabel) : String(fallbackLabel || '');
            strong.appendChild(span);
            strong.appendChild(document.createTextNode(':'));
            li.appendChild(strong);
            li.appendChild(document.createTextNode(` ${value}`));
            ul.appendChild(li);
          };

          mkLi('modal.checklist.goal', 'Obiettivo', firstSentence);
          mkLi('modal.checklist.focus', 'Focus', tagsText.length ? tagsText.join(' ◆ ') : '');
          if (ul.childElementCount) {
            checklist.appendChild(ul);
            createAccordionItem('Checklist', checklist, false);
          }
        } catch (e) {}
      }

      // If we still miss tabs, add a "Focus" tab using existing tags.
      if (totalTabsCount < targetTabs && tags) {
        try {
          const focus = document.createElement('div');
          focus.className = 'card-modal-focus';
          focus.appendChild(tags.cloneNode(true));
          createAccordionItem('Focus', focus, false);
        } catch (e) {}
      }

      // If we had to cap tabs, keep remaining info visible *after* the accordion.
      if (overflowSection && overflowSection.childElementCount) {
        try {
          const title = document.createElement('p');
          title.className = 'card-modal-section__title';
          title.setAttribute('data-i18n', 'modal.section.moreDetails');
          title.textContent = tr('modal.section.moreDetails', null, 'Altri dettagli');
          if (!overflowSection.querySelector(':scope > .card-modal-section__title')) {
            overflowSection.prepend(title);
          }
        } catch (e) {}
      }

      // Post-star: toolbar to toggle �open all tabs� mode
      try {
        const toolbar = document.createElement('div');
        toolbar.className = 'modal-tabs-toolbar';
        toolbar.hidden = true;

        const hint = document.createElement('p');
        hint.className = 'modal-tabs-toolbar__hint';
        hint.setAttribute('data-i18n', 'modal.studyMode.hint');
        hint.textContent = tr('modal.studyMode.hint', null, 'Modalit� studio: apri tutti i tab insieme.');

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn-ghost modal-tabs-toolbar__btn';
        btn.setAttribute('aria-pressed', 'false');
        btn.setAttribute('data-i18n-attr', 'aria-label:modal.studyMode.showAllAria');
        btn.setAttribute('aria-label', tr('modal.studyMode.showAllAria', null, 'Mostra tutto'));
        btn.innerHTML = '<span class="sr-only" data-i18n="modal.studyMode.showAll">Mostra tutto</span>';
        btn.hidden = true;
        btn.addEventListener('click', (e) => {
          try { e.preventDefault(); e.stopPropagation(); } catch (err) {}
          toggleAllTabsMode();
        });

        toolbar.appendChild(hint);
        toolbar.appendChild(btn);

        allTabsControl.wrapper = toolbar;
        allTabsControl.button = btn;
        allTabsControl.hint = hint;
        syncAllTabsControlUI();

        sectionWrap.appendChild(toolbar);
      } catch (e) {}

      sectionWrap.appendChild(accordion);
      if (overflowSection && overflowSection.childElementCount) {
        sectionWrap.appendChild(overflowSection);
      }
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
      const wantsFallbackAccordion = true;

      if (wantsFallbackAccordion) {
        const accordion = document.createElement('div');
        accordion.className = 'modal-accordion';
        try { allTabsControl.accordion = accordion; } catch (e) {}
        const createdTabTitles = new Set();
        const MAX_MODAL_TABS = 5;
        const MIN_MODAL_TABS = 4;
        const maxTabs = MAX_MODAL_TABS;
        const minTabs = MIN_MODAL_TABS;
        let overflowSection = null;

        // Topic hook (styling-only) for fallback tabs.
        const inferTabTopic = (title) => {
          const t = tidy(title).toLowerCase();
          if (!t) return '';
          if (t.includes('panoramica')) return 'panoramica';
          if (t.includes('ricetta')) return 'ricetta';
          if (t.includes('procedura') || t.includes('preparazione')) return 'procedura';
          if (t.includes('parametri')) return 'parametri';
          if (t.includes('servizio')) return 'servizio';
          if (t.includes('conserv')) return 'conservazione';
          if (t.includes('pulizia')) return 'pulizia';
          if (t.includes('note')) return 'note';
          if (t.includes('checklist')) return 'checklist';
          if (t.includes('focus')) return 'focus';
          if (t.includes('take away') || t.includes('takeaway')) return 'takeaway';
          if (t.includes('troubleshoot')) return 'troubleshooting';
          if (t.includes('upsell')) return 'upselling';
          if (t.includes('vendita')) return 'vendita';
          if (t.includes('approfond')) return 'approfondimenti';
          if (t.includes('dettagli')) return 'dettagli';
          return 'altro';
        };

        const ensureOverflowSection = () => {
          if (overflowSection) return overflowSection;
          overflowSection = document.createElement('div');
          overflowSection.className = 'card-modal-overflow';
          return overflowSection;
        };

        const getModalTitleI18nKey = (rawTitle) => {
          const t = tidy(rawTitle).toLowerCase();
          if (!t) return '';
          if (t.includes('panoramica')) return 'modal.tab.overview';
          if (t.includes('specifiche')) return 'modal.tab.specs';
          if (t.includes('ricetta')) return 'modal.tab.recipe';
          if (t.includes('preparaz')) return 'modal.tab.preparation';
          if (t.includes('procedura')) return 'modal.tab.procedure';
          if (t.includes('parametri')) return 'modal.tab.parameters';
          if (t.includes('servizio')) return 'modal.tab.service';
          if (t.includes('conserv')) return 'modal.tab.storage';
          if (t.includes('pulizia')) return 'modal.tab.cleaning';
          if (t.includes('take away') || t.includes('takeaway') || t.includes('tw')) return 'modal.tab.takeAway';
          if (t.includes('troubleshoot')) return 'modal.tab.troubleshooting';
          if (t.includes('upsell')) return 'modal.tab.upselling';
          if (t.includes('tecniche di vendita') || t.includes('vendita')) return 'modal.tab.salesTechniques';
          if (t.includes('pro tip')) return 'modal.tab.proTip';
          if (t.includes('sugger')) return 'modal.tab.tips';
          if (t.includes('approfond')) return 'modal.tab.insights';
          if (t.includes('checklist')) return 'modal.tab.checklist';
          if (t.includes('focus')) return 'modal.tab.focus';
          if (t.includes('altri dettagli')) return 'modal.section.moreDetails';
          if (t.includes('dettagli')) return 'modal.label.details';
          if (t.includes('note')) return 'modal.tab.notes';
          return '';
        };

        const pushOverflowGroup = (title, contentEl) => {
          // Keep extra content reachable without adding more tabs.
          const wrap = ensureOverflowSection();
          try {
            const label = document.createElement('p');
            label.className = 'card-modal-section__title';
            const raw = String(title || 'Dettagli');
            const k = getModalTitleI18nKey(raw);
            if (k) label.setAttribute('data-i18n', k);
            label.textContent = k ? tr(k, null, raw) : raw;
            wrap.appendChild(label);
          } catch (e) {}
          wrap.appendChild(contentEl);
        };

        const createMiniSpecTab = (items) => {
          const wrap = document.createElement('div');
          wrap.className = 'card-modal-mini-specs';
          const ul = document.createElement('ul');
          ul.className = 'modal-specs__bullets';
          (items || []).slice(0, 10).forEach((item) => {
            const li = document.createElement('li');
            const label = tidy(item?.label);
            const detail = tidy(item?.detail);
            if (!detail) return;
            if (label && label.toLowerCase() !== 'dettaglio') {
              const strong = document.createElement('strong');
              strong.textContent = `${label}:`;
              li.appendChild(strong);
              li.appendChild(document.createTextNode(` ${detail}`));
            } else {
              li.textContent = detail;
            }
            ul.appendChild(li);
          });
          wrap.appendChild(ul);
          return wrap;
        };

        const buildAutoTabsFromStatItems = () => {
          const groups = new Map();
          const addTo = (key, item) => {
            if (!key || !item) return;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(item);
          };

          (statItemsData || []).forEach((item) => {
            const label = tidy(item?.label).toLowerCase();
            const detail = tidy(item?.detail).toLowerCase();
            const blob = `${label} ${detail}`;

            if (/\b(shelf\s*life|conserv|frigo|defrost|riposo)\b/.test(blob)) {
              addTo('Conservazione', item);
              return;
            }
            if (/\b(servizio|tazza|cup|piatto|posat|vassoio|tw|take\s*away|takeaway|\boz\b)\b/.test(blob)) {
              addTo('Servizio', item);
              return;
            }
            if (/\b(pulizia|clean|flush|sanific)\b/.test(blob)) {
              addTo('Pulizia', item);
              return;
            }
            if (/\b(temperatura|�c|sec|min|dose|shot|g\b|gr\b|kg\b|ml\b|porzion|cottura|estrazion|foam|schium)\b/.test(blob)) {
              addTo('Parametri', item);
              return;
            }
            addTo('Note', item);
          });

          const ordered = ['Parametri', 'Servizio', 'Conservazione', 'Pulizia', 'Note'];
          return ordered
            .map((title) => ({ title, items: groups.get(title) || [] }))
            .filter((entry) => entry.items && entry.items.length);
        };

        const addFallbackAccordionItem = (titleText, contentEl, openByDefault) => {
          if (totalTabsCount >= maxTabs) {
            pushOverflowGroup(titleText, contentEl);
            return;
          }
          totalTabsCount += 1;
          createdTabTitles.add(String(titleText || '').trim());
          const item = document.createElement('article');
          item.className = 'accordion-item';
          try {
            const topic = inferTabTopic(titleText);
            if (topic) item.dataset.topic = topic;
          } catch (e) {}
          const header = document.createElement('button');
          header.type = 'button';
          header.className = 'accordion-header';
          header.setAttribute('aria-expanded', 'false');
          header.innerHTML = `<span class="accordion-title"></span><span class="accordion-chevron" aria-hidden="true"></span>`;
          try {
            const titleSpan = header.querySelector('.accordion-title');
            const raw = String(titleText || '').trim();
            const k = getModalTitleI18nKey(raw);
            if (titleSpan) {
              if (k) titleSpan.setAttribute('data-i18n', k);
              titleSpan.textContent = k ? tr(k, null, raw) : raw;
            }
          } catch (e) {}
          try {
            const topic = item.dataset.topic;
            if (topic) header.dataset.topic = topic;
          } catch (e) {}
          const body = document.createElement('div');
          body.className = 'accordion-body';
          body.appendChild(contentEl);

          // Add per-tab indicator: pending (?) if not opened today, completed (?) if already opened.
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
              ind.textContent = '';
              header.classList.add('tab-starred');
            } else if (alreadyOpened) {
              ind.classList.add('is-opened');
              ind.textContent = '';
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

          // Register for �open all tabs� mode (silent open/close, no gamification triggers).
          try {
            allTabsControl.apis.push({
              item,
              header,
              body,
              openSilently: () => setOpen(true),
              closeSilently: () => setOpen(false)
            });
          } catch (e) {}
          header.addEventListener('click', (event) => {
            const willExpand = !item.classList.contains('is-open');

            // Accordion behavior: only one tab open at a time.
            if (willExpand && !allowMultiOpenTabs) {
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
                    ind.textContent = '';
                  } else {
                    ind.classList.add('is-opened');
                    ind.textContent = '';
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

        if (overviewTabContent) {
          addFallbackAccordionItem('Panoramica', overviewTabContent, false);
        } else if (introClone) {
          const overview = document.createElement('div');
          overview.className = 'card-modal-overview';
          overview.appendChild(introClone);
          addFallbackAccordionItem('Panoramica', overview, false);
        }

        if (specsPanelForTab) {
          addFallbackAccordionItem('Specifiche', specsPanelForTab, false);
        }

        if (!isSafetyCard && recipeSummary) addFallbackAccordionItem('Ricetta', recipeSummary, false);
        if (!isSafetyCard && preparationMetaSummary) addFallbackAccordionItem('Preparazione', preparationMetaSummary, false);

        // Preserve remaining details as its own tab when we don't have structured blocks.
        addFallbackAccordionItem('Dettagli', detailsClone, false);

        const targetTabs = Math.min(maxTabs, Math.max(minTabs, 4));
        if (totalTabsCount < targetTabs) {
          const candidates = buildAutoTabsFromStatItems();
          candidates.forEach((entry) => {
            if (totalTabsCount >= targetTabs) return;
            if (totalTabsCount >= maxTabs) return;
            const title = String(entry.title || '').trim();
            if (!title) return;
            if (createdTabTitles.has(title)) return;
            addFallbackAccordionItem(title, createMiniSpecTab(entry.items), false);
          });
        }

        if (totalTabsCount < targetTabs && tags) {
          try {
            const focus = document.createElement('div');
            focus.className = 'card-modal-focus';
            focus.appendChild(tags.cloneNode(true));
            addFallbackAccordionItem('Focus', focus, false);
          } catch (e) {}
        }

        if (overflowSection && overflowSection.childElementCount) {
          try {
            const title = document.createElement('p');
            title.className = 'card-modal-section__title';
            title.setAttribute('data-i18n', 'modal.section.moreDetails');
            title.textContent = tr('modal.section.moreDetails', null, 'Altri dettagli');
            if (!overflowSection.querySelector(':scope > .card-modal-section__title')) {
              overflowSection.prepend(title);
            }
          } catch (e) {}
        }

        // Post-star: toolbar to toggle �open all tabs� mode
        try {
          const toolbar = document.createElement('div');
          toolbar.className = 'modal-tabs-toolbar';
          toolbar.hidden = true;

          const hint = document.createElement('p');
          hint.className = 'modal-tabs-toolbar__hint';
          hint.setAttribute('data-i18n', 'modal.studyMode.hint');
          hint.textContent = tr('modal.studyMode.hint', null, 'Modalit� studio: apri tutti i tab insieme.');

          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'btn-ghost modal-tabs-toolbar__btn';
          btn.setAttribute('aria-pressed', 'false');
          btn.setAttribute('data-i18n-attr', 'aria-label:modal.studyMode.showAllAria');
          btn.setAttribute('aria-label', tr('modal.studyMode.showAllAria', null, 'Mostra tutto'));
          btn.innerHTML = '<span class="sr-only" data-i18n="modal.studyMode.showAll">Mostra tutto</span>';
          btn.hidden = true;
          btn.addEventListener('click', (e) => {
            try { e.preventDefault(); e.stopPropagation(); } catch (err) {}
            toggleAllTabsMode();
          });

          toolbar.appendChild(hint);
          toolbar.appendChild(btn);

          allTabsControl.wrapper = toolbar;
          allTabsControl.button = btn;
          allTabsControl.hint = hint;
          syncAllTabsControlUI();

          sectionWrap.appendChild(toolbar);
        } catch (e) {}

        sectionWrap.appendChild(accordion);
        if (overflowSection && overflowSection.childElementCount) {
          sectionWrap.appendChild(overflowSection);
        }
        bodyFragment.appendChild(sectionWrap);
      }
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

    // Make the overlay renderable (but still invisible) so transform transitions
    // can start from the "from card" position even on browsers that don't animate
    // from visibility:hidden.
    try { overlay.classList.add('is-prepared'); } catch (e) {}

    // Animate modal from the originating card position (so it opens "in front of"
    // the carousel/card instead of feeling like it appears from the top).
    try {
      const prefersReducedMotion = (() => {
        try {
          return !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        } catch (e) {
          return false;
        }
      })();

      if (!prefersReducedMotion) {
        const rect = card.getBoundingClientRect();
        const cardCx = rect.left + rect.width / 2;
        const cardCy = rect.top + rect.height / 2;
        const viewCx = (window.innerWidth || document.documentElement.clientWidth || 0) / 2;
        const viewCy = (window.innerHeight || document.documentElement.clientHeight || 0) / 2;
        const dx = cardCx - viewCx;
        const dy = cardCy - viewCy;

        overlay.dataset.animateFromCard = 'true';
        overlay.style.setProperty('--card-from-x', `${Math.round(dx)}px`);
        overlay.style.setProperty('--card-from-y', `${Math.round(dy)}px`);
        overlay.style.setProperty('--card-from-scale', '0.92');
      }
    } catch (e) {}

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
      requestAnimationFrame(() => {
        overlay.classList.add('is-visible');
      });
    });

    // Mobile: start from the top so the sidebar image is immediately visible.
    // (On small screens users can otherwise land in the body scroll area and
    // interpret the image as �missing�.)
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
    // Mobile UX: consenti di chiudere la scheda "forzando lo scroll in basso" (pull-down) quando sei in cima.
    // Nota: su mobile il contenitore scrollabile spesso è `.card-modal` (non `.card-modal-body`).
    let modalClosed = false;
    let swipeStartY = 0;
    let swipeArmed = false;
    let swipeScroller = null;
    let swipeMode = null; // 'down' (top) | 'up' (bottom) | 'both' (non-scrollable)
    const SWIPE_CLOSE_THRESHOLD_PX = 72;

    const isAtTop = (el) => {
      try {
        return !!el && el.scrollTop <= 0;
      } catch (e) {
        return false;
      }
    };

    const isAtBottom = (el) => {
      try {
        if (!el) return false;
        const slack = 2;
        return el.scrollTop + el.clientHeight >= el.scrollHeight - slack;
      } catch (e) {
        return false;
      }
    };

    const resolveSwipeScroller = (target) => {
      try {
        // Prefer the inner body if it is actually scrollable.
        const body = target && target.closest ? target.closest('.card-modal-body') : null;
        if (body && body.scrollHeight > body.clientHeight + 2) return body;
      } catch (e) {}
      return modal;
    };

    const onModalTouchStart = (e) => {
      try {
        if (modalClosed) return;
        if (!e || !e.touches || e.touches.length !== 1) return;
        swipeScroller = resolveSwipeScroller(e.target);
        swipeStartY = e.touches[0].clientY;
        swipeMode = null;

        if (!swipeScroller) {
          swipeArmed = false;
          return;
        }

        // Arm close when user tries to scroll past the edges:
        // - at the top: pull down
        // - at the bottom: push up
        const atTop = isAtTop(swipeScroller);
        const atBottom = isAtBottom(swipeScroller);

        if (atTop && atBottom) {
          swipeMode = 'both';
          swipeArmed = true;
        } else if (atTop) {
          swipeMode = 'down';
          swipeArmed = true;
        } else if (atBottom) {
          swipeMode = 'up';
          swipeArmed = true;
        } else {
          swipeArmed = false;
        }
      } catch (err) {
        swipeArmed = false;
        swipeScroller = null;
        swipeMode = null;
      }
    };

    const onModalTouchMove = (e) => {
      try {
        if (modalClosed) return;
        if (!swipeArmed || !swipeScroller) return;
        // If the user started scrolling away from the edge, do not treat it as a dismiss.
        if (swipeMode === 'down' && !isAtTop(swipeScroller)) {
          swipeArmed = false;
          swipeScroller = null;
          swipeMode = null;
          return;
        }
        if (swipeMode === 'up' && !isAtBottom(swipeScroller)) {
          swipeArmed = false;
          swipeScroller = null;
          swipeMode = null;
          return;
        }
        if (!e || !e.touches || e.touches.length !== 1) return;
        const dy = e.touches[0].clientY - swipeStartY;

        if ((swipeMode === 'down' || swipeMode === 'both') && dy > SWIPE_CLOSE_THRESHOLD_PX) {
          closeModal();
          swipeArmed = false;
          swipeScroller = null;
          swipeMode = null;
          return;
        }

        if ((swipeMode === 'up' || swipeMode === 'both') && dy < -SWIPE_CLOSE_THRESHOLD_PX) {
          closeModal();
          swipeArmed = false;
          swipeScroller = null;
          swipeMode = null;
        }
      } catch (err) {}
    };

    const onModalTouchEnd = () => {
      swipeArmed = false;
      swipeScroller = null;
      swipeMode = null;
    };

    const handleEsc = (e) => {
      if (e && e.key === 'Escape') closeModal();
    };

    const closeModal = () => {
      if (modalClosed) return;
      modalClosed = true;

      // === SCROLL BOUNCE FIX ===
      // Defer all DOM updates (especially updateCardChecks) during close to prevent layout shifts
      window.__badianiDeferDOMUpdates = true;
      window.__badianiPendingCardChecks = false;

      // Cleanup listeners (important: ESC listener would otherwise accumulate).
      try { document.removeEventListener('keydown', handleEsc); } catch (e) {}
      try { modal.removeEventListener('touchstart', onModalTouchStart); } catch (e) {}
      try { modal.removeEventListener('touchmove', onModalTouchMove); } catch (e) {}
      try { modal.removeEventListener('touchend', onModalTouchEnd); } catch (e) {}
      try { modal.removeEventListener('touchcancel', onModalTouchEnd); } catch (e) {}

      // Suppress any guide-card auto-scroll that could be triggered immediately after
      // the modal is removed (mouseenter/click quirks, layout shifts, etc.).
      try { window.__badianiSuppressCardAutoScrollUntil = Date.now() + 900; } catch (e) {}

      // === Phase 1: Start 3D close animation (modal stays visible, overlay stays opaque) ===
      // Add the 3D closing class to trigger the CSS animation on the modal card.
      try { overlay.classList.add('is-closing-3d'); } catch (e) {}
      // If the modal was opened from a card position, return to it visually.
      try {
        if (overlay && overlay.dataset && overlay.dataset.animateFromCard === 'true') {
          overlay.classList.add('is-returning');
        }
      } catch (e) {}

      // Duration of the 3D close animation (matches CSS transition).
      const CLOSE_ANIM_DURATION_MS = 350;

      // === Phase 2: After 3D animation completes, unlock scroll and restore focus ===
      setTimeout(() => {
        // Keep overlay covering the page while we unlock scroll to hide any transient snap.
        try { overlay.classList.add('is-hiding'); } catch (e) {}

        // Unlock scroll and restore exact scroll position.
        try {
          bodyScrollLock.unlock(openerRestore && typeof openerRestore.scrollY === 'number' ? openerRestore.scrollY : undefined);
        } catch (e) {
          try { bodyScrollLock.unlock(); } catch (err) {}
        }

        // Restore carousel horizontal alignment (no extra vertical scroll).
        try {
          const restore = openerRestore || null;
          if (restore && restore.track && typeof restore.trackScrollLeft === 'number') {
            restore.track.scrollLeft = restore.trackScrollLeft;
          }
        } catch (e) {}

        // Restore exact scroll position again (double-check).
        try {
          if (openerRestore && typeof openerRestore.scrollY === 'number') {
            window.scrollTo(0, openerRestore.scrollY);
          }
        } catch (e) {}

        // === Phase 3: Fade out overlay ===
        requestAnimationFrame(() => {
          try { overlay.classList.add('is-closing'); } catch (e) {}
          try { overlay.classList.remove('is-visible'); } catch (e) {}
          try { overlay.classList.remove('is-hiding'); } catch (e) {}
        });

        // === Phase 4: Remove overlay and restore focus WITHOUT scrolling ===
        setTimeout(() => {
          try { document.removeEventListener('badiani:crystals-updated', handleCrystalUpdate); } catch (e) {}
          try { document.removeEventListener('badiani:toast-shown', handleToastShown); } catch (e) {}
          try { overlay.remove(); } catch (e) {}

          // Restore focus to the trigger element WITHOUT triggering scroll.
          try {
            const focusTarget = openerRestore && openerRestore.focusEl;
            if (focusTarget && typeof focusTarget.focus === 'function') {
              focusTarget.focus({ preventScroll: true });
            }
          } catch (e) {}

          // Final scroll position safety net.
          try {
            if (openerRestore && typeof openerRestore.scrollY === 'number') {
              window.scrollTo(0, openerRestore.scrollY);
            }
          } catch (e) {}

          // === SCROLL BOUNCE FIX ===
          // Clear defer flag and run any pending DOM updates AFTER scroll is restored.
          // Use a short delay to ensure scroll is stable before allowing DOM changes.
          setTimeout(() => {
            window.__badianiDeferDOMUpdates = false;
            if (window.__badianiPendingCardChecks) {
              window.__badianiPendingCardChecks = false;
              try {
                // Re-run updateCardChecks now that scroll is stable
                if (typeof gamification !== 'undefined' && gamification) {
                  // Trigger a lightweight UI refresh
                  const evt = new CustomEvent('badiani:modal-closed-safe');
                  document.dispatchEvent(evt);
                }
              } catch (e) {}
            }
          }, 100);
        }, 320);
      }, CLOSE_ANIM_DURATION_MS);
    };
    
    // Click su overlay (fuori dal modal)
    overlay.addEventListener('click', (e) => {
      try { e.preventDefault(); } catch (err) {}
      try { e.stopPropagation(); } catch (err) {}
      if (e.target === overlay) {
        closeModal();
      }
    });
    
    // Click su bottone close
    closeBtn.addEventListener('click', (e) => {
      try { e.preventDefault(); } catch (err) {}
      try { e.stopPropagation(); } catch (err) {}
      closeModal();
    });

    // Swipe down (pull) to close on touch devices.
    try {
      modal.addEventListener('touchstart', onModalTouchStart, { passive: true });
      modal.addEventListener('touchmove', onModalTouchMove, { passive: true });
      modal.addEventListener('touchend', onModalTouchEnd, { passive: true });
      modal.addEventListener('touchcancel', onModalTouchEnd, { passive: true });
    } catch (e) {}

    // ESC key
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
    // CONSERVAZIONE & QUALIT� (40 domande)
    "Il latte fresco ha un odore leggermente acido - cosa fai?",
    "Un cliente dice che il cappuccino sa di 'cartone'. Qual � il primo check da fare?",
    "Hai aperto un brick di latte d'avena 6 giorni fa. � ancora utilizzabile?",
    "Un sacchetto di caffè in grani � stato aperto 3 settimane fa. Come procedi?",
    "La crema dell'espresso � bianca/chiara invece che nocciola. Quali sono le 3 possibili cause?",
    "Il cliente chiede: 'Questo gelato � prodotto oggi?' Come rispondi?",
    "Noti cristalli nello sciroppo caramel. Cosa fai?",
    "Il latte monta male anche se freddo. Cosa controlli?",
    "Un brownie ha una macchia verde. Azione immediata?",
    "Il caffè ha un gusto bruciato/amaro eccessivo. Da cosa dipende?",
    
    "Temperatura ideale del latte nel frigo?",
    "Dopo quanti giorni scade un croissant farcito?",
    "Shelf life massima per alternative milk post-apertura?",
    "Come si verifica la freschezza di un caffè in grani?",
    "Un gelato presenta cristalli di ghiaccio sulla superficie. Cosa significa?",
    "Il panettone tagliato ieri � ancora vendibile oggi?",
    "Come conservi i prodotti Slitti (praline e tavolette)?",
    "La macchina espresso mostra 95�C invece di 90�C. � un problema?",
    "Il cliente dice: 'Questo latte sa di cipolla'. Possibile causa?",
    "Quanti shot puoi estrarre con 1kg di caffè?",
    
    "Come implementi il sistema FIFO per i sacchi di caffè?",
    "Un brick di latte � gonfio. Cosa fai?",
    "I churros avanzati dalla sera prima - riutilizzabili?",
    "Come si conserva la panna montata avanzata?",
    "Il gelato Buontalenti ha una texture granulosa. Causa?",
    "Crema spalmabile Slitti: shelf life post-apertura?",
    "Un cliente chiede se il caffè � biologico. Come verifichi?",
    "Noti condensa dentro la vetrina gelato. Azione?",
    "Come conservi i muffin/loaf dopo l'apertura della confezione?",
    "Il foam del cappuccino si sgonfia dopo 30 secondi. Perch�?",
    
    "Tempo massimo tra estrazione espresso e servizio?",
    "Come capire se il latte � stato scaldato oltre 70�C?",
    "Un croissant ha l'interno crudo. Procedura?",
    "Affogato: il gelato si scioglie troppo velocemente. Cosa cambi?",
    "Come testi la freschezza dei chicchi di caffè al tatto?",
    "Il cliente dice: 'Il cappuccino � tiepido'. Range temperatura corretto?",
    "Mulled wine: come conservi il mix preparato?",
    "Quanto dura una crepe preparata ma non servita?",
    "Come riconosci un espresso sotto-estratto vs sovra-estratto?",
    "Il grinder fa rumore strano. Primo check?",
    
    // TECNICHE & PROCEDURE (50 domande)
    "Cliente chiede cappuccino 'extra hot' (80�C). Come rispondi?",
    "Preparare 3 cappuccini insieme: ordine operativo corretto?",
    "Un bambino chiede 'cioccolata senza lattosio'. Opzioni?",
    "Cliente celiaco chiede un dolce. Come procedi?",
    "Rush hour (20 persone in fila). Priorit� operativa?",
    "La macchina espresso perde acqua dal portafiltro. Primo check?",
    "Cliente dice: 'Il mio latte � bruciato'. Come lo riconosci?",
    "Devi preparare 10 americani per asporto. Workflow ottimale?",
    "Un cliente chiede latte art a forma di orso. Come gestisci?",
    "Il steam wand fischia/stride. Problema?",
    
    "Cliente allergico alle noci chiede un brownie. Procedura?",
    "Devi cambiare il tipo di latte (intero ? avena) durante servizio. Step?",
    "Un espresso esce in 18 secondi invece di 28. Correttivo immediato?",
    "Come pulisci il group head tra un servizio e l'altro?",
    "Cliente chiede flat white 'ben caldo ma non bruciato'. Strategia?",
    "Devi servire 5 affogati simultaneamente. Organizzazione?",
    "Il portafiltro � freddo. Impatto sull'estrazione?",
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
    "La brocca latte � sporca di residui secchi. Impatto?",
    "Come servi un espresso doppio in tazza piccola (demitasse)?",
    "Cliente chiede latte 'extra cremoso'. Quale alternativa milk suggerisci?",
    "Devi fare latte art ma il foam � troppo denso. Fix veloce?",
    "Qual � la sequenza corretta per uno shutdown macchina a fine giornata?",
    
    // VENDITA & CUSTOMER SERVICE (60 domande)
    "Cliente indeciso tra cappuccino e latte. Come guidi la scelta?",
    "Un cliente abituale ordina sempre 'il solito'. Oggi � finito. Come comunichi?",
    "Cliente si lamenta del prezzo (�4 per cappuccino). Response?",
    "Famiglia con 2 bambini. Strategia upsell per aumentare scontrino?",
    "Cliente chiede sconto perché '� la terza volta oggi'. Come gestisci?",
    "Turista chiede: 'What's buontalenti?' Come lo descrivi in inglese?",
    "Cliente dice: 'L'ultima volta era pi� buono'. Come rispondi?",
    "Coppia in appuntamento romantico. Suggerimenti per massimizzare esperienza?",
    "Cliente vegano chiede opzioni. Quali prodotti proponi?",
    "Un cliente fotografa il drink e chiede di rifarlo 'pi� instagrammabile'. Come procedi?",
    
    "Studente con budget limitato. Come proponi upsell senza pressione?",
    "Cliente chiede: 'Qual � il vostro best seller?' Come rispondi?",
    "Un bambino vuole 'caffè come pap�'. Alternative adatte?",
    "Cliente torna dopo 5 minuti: 'Il cappuccino � freddo'. Procedura?",
    "Gruppo di 8 persone ordina tutto insieme. Come organizzi?",
    "Cliente chiede consiglio per regalo aziendale. Proposte?",
    "Un cliente dice: 'Non mi piace il caffè'. Come lo conquisti?",
    "Pendolare mattutino di fretta. Upsell veloce (<10 secondi)?",
    "Cliente con intolleranza al lattosio. Full menu alternativo?",
    "Come presenti il programma loyalty a un nuovo cliente?",
    
    "Un cliente chiede: 'Posso avere lo sconto studenti?' (non esistente). Response?",
    "Cliente dice: 'Da Starbucks costa meno'. Come gestisci?",
    "Devi spiegare perché l'alternative milk costa di pi�. Argomentazione?",
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
    "Cliente chiede: '� tutto artigianale vero?' Come confermi?",
    "Un cliente ha fretta ma c'� fila. Come gestisci aspettativa?",
    "Cliente chiede 'qualcosa di nuovo da provare'. Suggerimenti strategici?",
    "Un cliente dice: 'Ho fame ma non so cosa'. Menu guidance?",
    "Come upselli un pairing caffè+dolce senza essere invadente?",
    "Cliente chiede: 'Avete promozioni oggi?' (no). Come rispondi positivamente?",
    "Un cliente ordina per 6 persone ma dice nomi confusi. Come organizzi?",
    
    "Cliente chiede croissant 'appena sfornato' ma � di ieri. Onest� vs vendita?",
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
    "Cade corrente durante servizio mattutino (20 clienti in attesa). Priorit�?",
    "Un cliente ha reazione allergica dopo aver consumato un dolce. Primo step?",
    "Noti un bambino che corre verso vetrina calda. Azione immediata?",
    "Finisci il latte intero durante rush hour. Piano B?",
    "La macchina espresso smette di funzionare. Workflow alternativo?",
    "Un cliente rovescia caffè bollente addosso. Procedura?",
    "Noti una perdita d'acqua sotto il bancone. Cosa fai?",
    "Grinder bloccato con chicchi dentro. Come lo sblocchi?",
    "Un cliente dice: 'C'� un capello nel mio croissant'. Gestione?",
    "Il POS non funziona e cliente ha solo carta. Opzioni?",
    
    "Fumo dalla macchina espresso. Azioni nei primi 30 secondi?",
    "Un cliente sviene nel locale. Step by step?",
    "Finisci i coni per gelato durante pomeriggio affollato. Alternative creative?",
    "Vetrina gelato mostra temperatura -8�C invece di -14�C. Procedura?",
    "Un cliente dice: 'Questo sa di detersivo'. Possibili contaminazioni?",
    "Coworker si scotta gravemente con steam wand. First aid?",
    "Cade un barattolo di Nutella: vetri nel prodotto. Area control?",
    "Cliente chiede rimborso perché 'non gli � piaciuto' dopo aver finito. Response?",
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
    "Perch� il Flat White ha meno foam del cappuccino?",
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

  const questionsByLang = {
    it: questions,
    en: [
      "Milk smells slightly sour - what's your move?",
      "Customer says cappuccino tastes like cardboard. First check?",
      "Opened oat milk 6 days ago - still OK?",
      "Coffee bag opened 3 weeks ago - how to proceed?",
      "Espresso crema is pale. Three possible causes?",
      "Customer asks: 'Is this gelato made today?' How do you answer?",
      "Crystals in caramel syrup. What now?",
      "Milk won't foam even when cold. What do you inspect?",
      "Brownie has a green spot. Immediate action?",
      "Espresso tastes burnt/bitter. Likely reasons?",
      "Ideal fridge temperature for milk?",
      "After how many days is a filled croissant expired?",
      "Shelf life for alt-milk after opening?",
      "How do you check coffee bean freshness?",
      "Gelato shows ice crystals on top. Meaning?",
      "Panettone cut yesterday - sellable today?",
      "How do you store Slitti pralines/tablets?",
      "Espresso machine reads 95\u00B0C instead of 90\u00B0C. Problem?",
      "Customer says milk tastes like onion. Possible cause?",
      "How many shots from 1kg of coffee?",
    ],
  };

  const resolveLang = () => {
    const normalize = (value) => {
      const v = String(value || '').trim().toLowerCase();
      if (v.startsWith('it')) return 'it';
      if (v.startsWith('en')) return 'en';
      if (v.startsWith('es')) return 'es';
      if (v.startsWith('fr')) return 'fr';
      return '';
    };

    const fromI18n = normalize(window.BadianiI18n?.getLang?.());
    if (fromI18n) return fromI18n;

    const fromHtml = normalize(document.documentElement?.getAttribute?.('lang'));
    if (fromHtml) return fromHtml;

    const fromNav = normalize(navigator.language || navigator.userLanguage);
    if (fromNav) return fromNav;

    return 'it';
  };

  const getLangQuestions = () => {
    const lang = resolveLang();
    const list = questionsByLang[lang] || questionsByLang.it || [];
    return { lang: questionsByLang[lang] ? lang : 'it', list };
  };

  const usedStorageKey = (lang = 'it') => `badiani_used_questions:${lang}`;

  const getUsedQuestions = (lang = 'it') => {
    try {
      return JSON.parse(localStorage.getItem(usedStorageKey(lang)) || '[]');
    } catch {
      return [];
    }
  };

  const saveUsedQuestions = (lang = 'it', used = []) => {
    localStorage.setItem(usedStorageKey(lang), JSON.stringify(used));
  };

  const getNextQuestion = () => {
    const { lang, list } = getLangQuestions();
    if (!list || !list.length) return '';
    // Generate a new question each time (no "same all day" cache).
    let usedQuestions = getUsedQuestions(lang);
    
    // Reset if all used
    if (usedQuestions.length >= list.length) {
      usedQuestions = [];
      saveUsedQuestions(lang, []);
    }

    // Find unused question
    const availableQuestions = list.filter(q => !usedQuestions.includes(q));
    const randomQuestion = availableQuestions[Math.floor(Math.random() * availableQuestions.length)];

    // Mark as used
    usedQuestions.push(randomQuestion);
    saveUsedQuestions(lang, usedQuestions);
    return randomQuestion;
  };

  const displayQuestion = () => {
    const questionElements = document.querySelectorAll('[data-daily-question]');
    if (!questionElements.length) return;

    const question = getNextQuestion();
    questionElements.forEach(el => {
      el.textContent = `Q: ${question}`;
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
    carouselHeader.setAttribute(
      'aria-label',
      tr(
        'carousel.headerAria',
        null,
        'Scorri il carosello: swipe sinistra/destra oppure clic (sinistra=precedente, destra=successivo)'
      )
    );

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
        if (!target || !target.closest) return false;
        // IMPORTANT (Hub cockpit): the profile card uses a large `[data-profile]` wrapper.
        // Treating that wrapper as "interactive" blocks drag-to-scroll when the user tries
        // to swipe/drag from inside the profile card.
        if (isCockpit) {
          return !!target.closest('button, a, input, select, textarea, [role="button"]');
        }
        return !!target.closest('button, a, input, select, textarea, [role="button"], [data-profile]');
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

    // Touch swipe on the sticky header (counter/indicators area):
    // - swipe left  => next
    // - swipe right => previous
    // Keep vertical page scroll natural via CSS `touch-action: pan-y`.
    let lastHeaderSwipeAt = 0;
    const headerSwipe = {
      active: false,
      pointerId: null,
      startX: 0,
      startY: 0,
      dx: 0,
      dy: 0,
      isSwiping: false,
    };
    const HEADER_SWIPE_LOCK_PX = 12;
    const HEADER_SWIPE_TRIGGER_PX = 34;
    const HEADER_SWIPE_AXIS_RATIO = 1.15;

    const resetHeaderSwipe = () => {
      headerSwipe.active = false;
      headerSwipe.pointerId = null;
      headerSwipe.startX = 0;
      headerSwipe.startY = 0;
      headerSwipe.dx = 0;
      headerSwipe.dy = 0;
      headerSwipe.isSwiping = false;
      carouselHeader.classList.remove('is-swiping');
    };

    const onHeaderPointerDownForSwipe = (event) => {
      if (event.pointerType !== 'touch') return;
      // If the header ever contains interactive controls, don't hijack them.
      if (event.target && event.target.closest && event.target.closest('a, button, input, select, textarea')) return;

      headerSwipe.active = true;
      headerSwipe.pointerId = event.pointerId;
      headerSwipe.startX = event.clientX;
      headerSwipe.startY = event.clientY;
      headerSwipe.dx = 0;
      headerSwipe.dy = 0;
      headerSwipe.isSwiping = false;

      try {
        carouselHeader.setPointerCapture(event.pointerId);
      } catch (e) {
        /* ignore */
      }
    };

    const onHeaderPointerMoveForSwipe = (event) => {
      if (!headerSwipe.active) return;
      if (event.pointerType !== 'touch') return;
      if (headerSwipe.pointerId !== event.pointerId) return;

      headerSwipe.dx = event.clientX - headerSwipe.startX;
      headerSwipe.dy = event.clientY - headerSwipe.startY;

      if (!headerSwipe.isSwiping) {
        if (Math.abs(headerSwipe.dx) < HEADER_SWIPE_LOCK_PX) return;
        if (Math.abs(headerSwipe.dx) <= Math.abs(headerSwipe.dy) * HEADER_SWIPE_AXIS_RATIO) return;
        headerSwipe.isSwiping = true;
        carouselHeader.classList.add('is-swiping');
      }

      // With `touch-action: pan-y` this is mostly redundant, but it helps in some browsers.
      event.preventDefault();
    };

    const onHeaderPointerEndForSwipe = (event) => {
      if (!headerSwipe.active) return;
      if (event.pointerType !== 'touch') return;
      if (headerSwipe.pointerId !== event.pointerId) return;

      const dx = headerSwipe.dx;
      const isSwipe = headerSwipe.isSwiping && Math.abs(dx) >= HEADER_SWIPE_TRIGGER_PX;
      if (isSwipe) {
        lastHeaderSwipeAt = performance.now();
        // Swipe left => next (dx negative), swipe right => previous.
        headerNavigate(dx < 0 ? 1 : -1);
      }

      resetHeaderSwipe();
    };

    carouselHeader.addEventListener('pointerdown', onHeaderPointerDownForSwipe, { passive: true });
    carouselHeader.addEventListener('pointermove', onHeaderPointerMoveForSwipe, { passive: false });
    carouselHeader.addEventListener('pointerup', onHeaderPointerEndForSwipe);
    carouselHeader.addEventListener('pointercancel', onHeaderPointerEndForSwipe);

    carouselHeader.addEventListener('click', (event) => {
      // Suppress the synthetic click that often follows a touch swipe.
      try {
        const now = performance.now();
        if (now - lastHeaderSwipeAt < 450) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
      } catch {}
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

    // Resize handling: when the window/container changes size, the track geometry
    // changes (item centers, scrollLeft clamp, snap points). Without recalculating,
    // some browsers can end up with a "stuck"/mis-centered carousel after resize.
    // We re-apply focus state + re-center the current card using fresh rects.
    let resizeRaf = 0;
    let resizeTimer = 0;
    const recenterAfterResize = () => {
      const idx = (currentIndex >= 0) ? currentIndex : initialIndex;
      // Don't keep the initial focus lock once the layout changed.
      focusLock = false;
      applyState(idx, { preserveTitle });
      goToIndex(idx, { behavior: 'auto' });
    };

    const scheduleResizeRecenter = () => {
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = 0;
        if (resizeTimer) window.clearTimeout(resizeTimer);
        // Small debounce: lets fonts/layout settle before reading rects.
        resizeTimer = window.setTimeout(recenterAfterResize, 140);
      });
    };

    let ro = null;
    if ('ResizeObserver' in window) {
      try {
        ro = new ResizeObserver(() => scheduleResizeRecenter());
        ro.observe(carouselTrack);
      } catch (e) {
        ro = null;
      }
    }
    if (!ro) {
      window.addEventListener('resize', scheduleResizeRecenter, { passive: true });
      window.addEventListener('orientationchange', scheduleResizeRecenter);
    }

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
          try {
            if (window.__badianiSuppressCardAutoScrollUntil && Date.now() < window.__badianiSuppressCardAutoScrollUntil) return;
          } catch (e) {}
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
            try {
              if (window.__badianiSuppressCardAutoScrollUntil && Date.now() < window.__badianiSuppressCardAutoScrollUntil) return;
            } catch (e) {}
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

// ============================================================
// MODERN MENU DRAWER CONTROLLER (Global)
// Integrates with existing markup and bodyScrollLock helper.
// ============================================================

// Funzione Aggiornata Toggle Menu
window.toggleMenu = function() {
  const drawer = document.querySelector('.menu-drawer');
  if (!drawer) return;
  
  const isOpen = drawer.getAttribute('aria-hidden') === 'false';
  const nextState = !isOpen;
  
  drawer.setAttribute('aria-hidden', String(nextState));
  
  // Use the global bodyScrollLock helper if available, otherwise fallback
  if (typeof bodyScrollLock !== 'undefined') {
    if (nextState) { // closing (aria-hidden=true) -> unlock
      bodyScrollLock.unlock();
    } else { // opening (aria-hidden=false) -> lock
      bodyScrollLock.lock();
    }
  } else {
    document.body.style.overflow = nextState ? '' : 'hidden';
  }
};

// Event Listeners (using robust delegation or direct attachment)
document.addEventListener('DOMContentLoaded', () => {
  // Backdrop click
  const backdrop = document.querySelector('.menu-drawer__overlay');
  if (backdrop) {
    backdrop.addEventListener('click', (e) => {
      // Only close if it's currently open
      const drawer = document.querySelector('.menu-drawer');
      if (drawer && drawer.getAttribute('aria-hidden') === 'false') {
        window.toggleMenu();
      }
    });
  }

  // Close button click
  const closeBtn = document.querySelector('.menu-drawer__close');
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.toggleMenu();
    });
  }
});

// Gestione Profilo (Placeholder)
window.openProfileSettings = function() {
  // Chiudi il menu drawer per mostrare la scheda sotto.
  try {
    const drawer = document.querySelector('[data-menu-drawer]') || document.querySelector('.menu-drawer');
    if (drawer && drawer.getAttribute('aria-hidden') === 'false') {
      drawer.setAttribute('aria-hidden', 'true');
      try { if (typeof bodyScrollLock !== 'undefined') bodyScrollLock.unlock(); } catch {}
    }
  } catch {}

  // Preferred: open the Avatar/Profile modal used in the cockpit.
  if (typeof window.openAvatarProfileModal === 'function') {
    // Small delay to let the drawer close/unlock before opening overlay.
    setTimeout(() => {
      try { window.openAvatarProfileModal(); } catch (e) { console.warn('openAvatarProfileModal failed', e); }
    }, 120);
    return;
  }
    
    // Apri il pannello impostazioni (quello che c'era prima)
    const settingsPanel = document.getElementById('settings-panel');
    if (settingsPanel) {
        settingsPanel.classList.add('open');
        // Ensure body scroll is locked if needed for settings panel
        if (typeof bodyScrollLock !== 'undefined') bodyScrollLock.lock();
    } else {
        console.warn("Pannello impostazioni non trovato (ID: settings-panel)");
        // Fallback: try to find the old profile overlay if it exists
        const oldProfileOverlay = document.getElementById('profile-overlay');
        if (oldProfileOverlay) {
             oldProfileOverlay.hidden = false;
             if (typeof bodyScrollLock !== 'undefined') bodyScrollLock.lock();
        }
    }
};

// Gestione Lingua (Funzionante)
window.toggleLanguage = function() {
   const api = window.BadianiI18n;
   if (!api) return;
   
   const current = api.getLang();
   const langs = ['it', 'en', 'es', 'fr'];
   const idx = langs.indexOf(current);
   const next = langs[(idx + 1) % langs.length];
   
   api.setLang(next);
   
   const label = document.getElementById('current-lang-label');
   if (label) label.textContent = next.toUpperCase();
};

// Inizializza etichetta lingua nel drawer
document.addEventListener('DOMContentLoaded', () => {
  const label = document.getElementById('current-lang-label');
  if (label && window.BadianiI18n) {
    label.textContent = window.BadianiI18n.getLang().toUpperCase();
  }
});

// ============================================================
// GLOBAL GAMIFICATION HELPER
// Allows external scripts (like Berny Brain) to update the main gamification state.
// ============================================================
window.BadianiGamificationHelper = {
  addGelato: function() {
    try {
      // 1. Determine Profile ID
      const profileId = window.BadianiProfile?.getActive?.()?.id || 'guest';

      // 2. Load State (localStorage -> sessionStorage -> window.name)
      const key = `badianiGamification.v3:${profileId}`;
      const sessionKey = `badianiGamification.session.v1:${profileId}`;
      const windowNamePrefix = '__badianiGam__:';

      let rawState = '';
      try { rawState = localStorage.getItem(key) || ''; } catch {}
      if (!rawState) {
        try { rawState = sessionStorage.getItem(sessionKey) || ''; } catch {}
      }
      if (!rawState) {
        try {
          const wn = String(window.name || '');
          if (wn.startsWith(windowNamePrefix)) rawState = wn.slice(windowNamePrefix.length);
        } catch {}
      }

      let state = {};
      if (rawState) {
        try { state = JSON.parse(rawState); } catch (e) { console.warn('Error parsing state:', e); }
      }

      // 3. Update State
      state.gelati = (typeof state.gelati === 'number' ? state.gelati : 0) + 1;
      state.lastGelatoTs = Date.now();
      
      // Update history if possible (simplified)
      if (!state.history) state.history = {};
      if (!state.history.totals) state.history.totals = { stars: 0, gelati: 0, bonusPoints: 0 };
      state.history.totals.gelati = (state.history.totals.gelati || 0) + 1;

      // 4. Save State (best-effort to all stores used by core gamification)
      const serialized = JSON.stringify(state);
      try { localStorage.setItem(key, serialized); } catch {}
      try { sessionStorage.setItem(sessionKey, serialized); } catch {}
      try { window.name = `${windowNamePrefix}${serialized}`; } catch {}
      console.log(`[GamificationHelper] Added gelato for ${profileId}. New total: ${state.gelati}`);

      // 5. Notify UI
      document.dispatchEvent(new CustomEvent('badiani:gamification-updated'));
      
      return true;
    } catch (err) {
      console.error('[GamificationHelper] Failed to add gelato:', err);
      return false;
    }
  }
};

// ============================================================
// SOUND FX ENGINE (AudioContext - No External Files)
// ============================================================
const BadianiSound = {
    ctx: null,
    // Restore the file-based audio for the scroll tick as requested
    clickAudio: new Audio("https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3"),

    init: function() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }
        // Configure the click audio settings
        this.clickAudio.volume = 0.2;
        this.clickAudio.playbackRate = 1.5;
    },
    playTick: function() {
        // Use the MP3 file logic for the scroll tick
        this.clickAudio.currentTime = 0;
        this.clickAudio.play().catch(() => {});
    },
    playBlup: function() {
        this.init();
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        // Bubble pop (Rising sine wave)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, t);
        osc.frequency.linearRampToValueAtTime(600, t + 0.08);
        
        // Reduced volume from 0.3 to 0.1
        gain.gain.setValueAtTime(0.1, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
        
        osc.start(t);
        osc.stop(t + 0.08);
    }
};

document.addEventListener("DOMContentLoaded", () => {
    // Initialize audio context on first interaction to unlock it
    const unlockAudio = () => {
        BadianiSound.init();
        document.removeEventListener('click', unlockAudio);
        document.removeEventListener('touchstart', unlockAudio);
    };
    document.addEventListener('click', unlockAudio);
    document.addEventListener('touchstart', unlockAudio);

    // --- ⚙️ LOGICA DI SCATTO (CAROUSEL) ---
    const carousels = document.querySelectorAll('.carousel--cockpit-grid, .carousel-track');

    carousels.forEach(carousel => {
        let lastCardIndex = 0;
        let isScrolling = false;

        carousel.addEventListener('scroll', () => {
            if (!isScrolling) {
                window.requestAnimationFrame(() => {
                    handleScrollTick(carousel);
                    isScrolling = false;
                });
                isScrolling = true;
            }
        }, { passive: true });

        function handleScrollTick(element) {
            const firstCard = element.firstElementChild;
            if (!firstCard) return;

            const style = window.getComputedStyle(element);
            const gap = parseFloat(style.gap) || 16;
            const cardWidth = firstCard.offsetWidth + gap; 
            const scrollPos = element.scrollLeft;
            const currentIndex = Math.round(scrollPos / cardWidth);

            if (currentIndex !== lastCardIndex) {
                BadianiSound.playTick();
                if (navigator.vibrate) navigator.vibrate(5);
                lastCardIndex = currentIndex;
            }
        }
    });

    // --- 🎯 LOGICA MENU (BLUP) ---
    const menuButtons = document.querySelectorAll('[data-menu-toggle]');
    const closeButtons = document.querySelectorAll('[data-menu-close]');

    const triggerBlup = () => {
        BadianiSound.playBlup();
        if (navigator.vibrate) navigator.vibrate(8);
    };

    menuButtons.forEach(btn => btn.addEventListener('click', triggerBlup));
    closeButtons.forEach(btn => btn.addEventListener('click', triggerBlup));
});

// ============================================================
// BERNY - VIDEO GUIDA FULLSCREEN
// - Auto: una sola volta per profilo (dopo login/signup, grazie al reload del gate)
// - Manuale: triplo click sull'avatar tondo di Berny (chat) o sul FAB del widget
// ============================================================
(() => {
  // Avoid double-init
  if (window.__badianiBernyGuideVideoInit) return;
  window.__badianiBernyGuideVideoInit = true;

  const VIDEO_SRC = (() => {
    // Keep it simple: the file is inside the repo at "berny video/berny video.mp4"
    try { return encodeURI('berny video/berny video.mp4'); } catch { return 'berny%20video/berny%20video.mp4'; }
  })();

  const KEY_SEEN_PREFIX = 'badianiBerny.guideVideo.seen.v1';

  const getActiveProfile = () => {
    try {
      const p = window.BadianiProfile?.getActive?.();
      if (p && typeof p === 'object') return p;
    } catch {}

    try {
      const raw = localStorage.getItem(typeof STORAGE_KEY_USER === 'string' ? STORAGE_KEY_USER : 'badianiUser.profile.v1');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.id) return parsed;
    } catch {}

    return null;
  };

  const decodeTokenPayload = (token) => {
    try {
      const t = String(token || '').trim();
      const part = t.split('.')[0] || '';
      if (!part) return null;
      const b64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
      const json = atob(b64);
      return JSON.parse(json);
    } catch {
      return null;
    }
  };

  const isVerifiedOrBeta = () => {
    try {
      const beta = String(localStorage.getItem('badianiAuth.betaSkip.v1') || '') === '1';
      if (beta) return true;
    } catch {}

    try {
      const token = String(localStorage.getItem('badianiAuth.token.v1') || '').trim();
      if (!token) return false;
      const payload = decodeTokenPayload(token);
      const exp = payload?.exp;
      if (typeof exp !== 'number' || !Number.isFinite(exp)) return false;
      return (exp * 1000) > Date.now();
    } catch {
      return false;
    }
  };

  const makeSeenKey = (profileId) => {
    const id = String(profileId || '').trim() || 'anon';
    return `${KEY_SEEN_PREFIX}:${id}`;
  };

  const hasSeen = (profileId) => {
    try {
      return String(localStorage.getItem(makeSeenKey(profileId)) || '') === '1';
    } catch {
      return false;
    }
  };

  const markSeen = (profileId) => {
    try { localStorage.setItem(makeSeenKey(profileId), '1'); } catch {}
  };

  let overlay = null;
  let panel = null;
  let video = null;
  let lastFocus = null;

  const buildOverlay = () => {
    if (overlay) return;

    overlay = document.createElement('div');
    overlay.className = 'berny-guide-overlay';
    overlay.setAttribute('aria-hidden', 'true');

    overlay.innerHTML = `
      <div class="berny-guide-panel" role="dialog" aria-modal="true" aria-label="Video guida BERNY">
        <button type="button" class="berny-guide-close" aria-label="Chiudi video guida" data-berny-guide-close>
          <span aria-hidden="true">×</span>
        </button>
        <div class="berny-guide-body">
          <div class="berny-guide-audio-hint" data-berny-guide-audio-hint>Tocca per attivare audio</div>
          <video
            class="berny-guide-video"
            playsinline
            preload="metadata"
            muted
            autoplay
            data-berny-guide-video
            disablepictureinpicture
            controlslist="nodownload noplaybackrate noremoteplayback"
          >
            <source src="${VIDEO_SRC}" type="video/mp4" />
          </video>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    panel = overlay.querySelector('.berny-guide-panel');
    video = overlay.querySelector('[data-berny-guide-video]');

    const closeBtn = overlay.querySelector('[data-berny-guide-close]');
    if (closeBtn) closeBtn.addEventListener('click', () => close());

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay?.classList?.contains('is-visible')) {
        close();
      }
    });

    // Note: ended behavior is handled per-open (we repeat once then close).
  };

  let endedHandler = null;
  let playCycles = 0;
  let audioUnlockHandler = null;

  const setAudioState = (isOn) => {
    try {
      if (!overlay) return;
      overlay.dataset.audio = isOn ? 'on' : 'off';
    } catch {}
  };

  const tryEnableAudio = () => {
    if (!video) return false;
    try {
      video.muted = false;
      video.volume = 1;
      const p = video.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {});
      }
      setAudioState(true);
      return true;
    } catch {
      return false;
    }
  };

  const open = async (opts = {}) => {
    const { reason = '' } = opts;
    const profile = getActiveProfile();

    // Do not open on top of the signup gate.
    if (document.querySelector('.signup-gate')) return;

    buildOverlay();
    if (!overlay || !panel) return;

    // Manual open should always work; auto open should be gated.
    if (reason === 'auto') {
      if (!profile?.id) return;
      if (!isVerifiedOrBeta()) return;
      if (hasSeen(profile.id)) return;
      // Mark seen immediately so it doesn't pop up again if the user reloads mid-video.
      markSeen(profile.id);
    }

    lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    overlay.classList.add('is-visible');
    overlay.setAttribute('aria-hidden', 'false');

    try { bodyScrollLock?.lock?.(); } catch {}

    // Focus close button for accessibility
    try {
      const closeBtn = overlay.querySelector('[data-berny-guide-close]');
      closeBtn?.focus?.({ preventScroll: true });
    } catch {}

    // (Re)bind ended behavior: play twice (repeat once) then close.
    if (video) {
      try {
        if (endedHandler) video.removeEventListener('ended', endedHandler);
      } catch {}
      playCycles = 0;
      endedHandler = () => {
        // First end -> replay once. Second end -> close.
        if (playCycles === 0) {
          playCycles = 1;
          try {
            video.currentTime = 0;
            const p = video.play();
            if (p && typeof p.catch === 'function') p.catch(() => {});
          } catch {}
          return;
        }
        close();
      };
      try { video.addEventListener('ended', endedHandler); } catch {}

      // Hard reset + autoplay
      try {
        video.pause();
        video.currentTime = 0;
        // Make sure native controls are not shown
        video.controls = false;

        // Audio policy:
        // - auto open: must start muted; user can tap to enable audio
        // - manual open (triple click): user gesture exists, so start with audio
        const wantsSound = reason !== 'auto';
        if (wantsSound) {
          setAudioState(true);
          video.muted = false;
          video.volume = 1;
        } else {
          setAudioState(false);
          video.muted = true;
          video.volume = 1;
        }

        const p = video.play();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } catch {}

      // Tap-to-unmute only when auto-opened.
      try {
        if (audioUnlockHandler) {
          panel?.removeEventListener?.('pointerdown', audioUnlockHandler);
          panel?.removeEventListener?.('click', audioUnlockHandler);
        }
      } catch {}
      audioUnlockHandler = null;

      if (reason === 'auto') {
        audioUnlockHandler = () => {
          // Try enabling audio. If it works, remove handler.
          const ok = tryEnableAudio();
          if (!ok) return;
          try {
            panel?.removeEventListener?.('pointerdown', audioUnlockHandler);
            panel?.removeEventListener?.('click', audioUnlockHandler);
          } catch {}
          audioUnlockHandler = null;
        };
        // pointerdown covers touch, click is fallback.
        try { panel?.addEventListener?.('pointerdown', audioUnlockHandler, { passive: true }); } catch {}
        try { panel?.addEventListener?.('click', audioUnlockHandler, { passive: true }); } catch {}
      }
    }
  };

  const close = () => {
    if (!overlay) return;
    overlay.classList.remove('is-visible');
    overlay.setAttribute('aria-hidden', 'true');

    try {
      if (video && !video.paused) video.pause();
    } catch {}

    // Remove ended handler so it doesn't leak across opens.
    try {
      if (video && endedHandler) video.removeEventListener('ended', endedHandler);
    } catch {}
    endedHandler = null;
    playCycles = 0;

    // Remove audio unlock handler
    try {
      if (panel && audioUnlockHandler) {
        panel.removeEventListener('pointerdown', audioUnlockHandler);
        panel.removeEventListener('click', audioUnlockHandler);
      }
    } catch {}
    audioUnlockHandler = null;
    setAudioState(false);

    try { bodyScrollLock?.unlock?.(); } catch {}

    if (lastFocus) {
      try { lastFocus.focus({ preventScroll: true }); } catch { try { lastFocus.focus(); } catch {} }
      lastFocus = null;
    }
  };

  const attachTripleClick = (el) => {
    if (!el || el.__badianiTripleClickAttached) return;
    el.__badianiTripleClickAttached = true;

    let count = 0;
    let timer = 0;
    const reset = () => {
      count = 0;
      if (timer) {
        window.clearTimeout(timer);
        timer = 0;
      }
    };

    el.addEventListener('click', () => {
      count += 1;
      if (count === 1) {
        timer = window.setTimeout(reset, 850);
      }
      if (count >= 3) {
        reset();
        open({ reason: 'triple' });
      }
    }, { passive: true });
  };

  const attachTriggers = () => {
    try {
      attachTripleClick(document.querySelector('[data-chat-avatar]'));
    } catch {}
    try {
      attachTripleClick(document.querySelector('.berny-fab'));
    } catch {}
  };

  // Auto-show once the app is ready (post-gate reload)
  const autoShow = () => {
    try { open({ reason: 'auto' }); } catch {}
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      attachTriggers();
      autoShow();
      // In some pages the widget FAB is injected late.
      let tries = 0;
      const tick = () => {
        tries += 1;
        attachTriggers();
        if (tries >= 10) window.clearInterval(id);
      };
      const id = window.setInterval(tick, 500);
    }, { once: true });
  } else {
    attachTriggers();
    autoShow();
  }

  // If the active profile changes while the app is open, auto-show once for that profile.
  document.addEventListener('badiani:profile-updated', () => {
    // Delay a bit so other UI can settle.
    window.setTimeout(() => {
      try { open({ reason: 'auto' }); } catch {}
    }, 250);
  });

  // Expose a tiny hook for debugging/manual triggers (optional).
  try {
    window.BadianiBernyGuideVideo = {
      open: () => open({ reason: 'manual' }),
      close,
      _src: VIDEO_SRC,
    };
  } catch {}
})();
