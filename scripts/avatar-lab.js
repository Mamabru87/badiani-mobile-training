/**
 * Badiani Avatar Lab v5.0 (Playful Studio)
 * - Never opens empty: instant random equip (body+skin+expression+hair, hat 50%).
 * - "Sorprendimi!" full shuffle with bounce/pop preview animation.
 * - Brand text chips (no emoji) + arrows / tap-to-cycle variants.
 * - Fine adjustments (offset/scale/layer order) hidden behind "Regolazioni avanzate".
 * - Save celebration via window.GelatoEffects (scripts/gelato-effects.js).
 */

const AvatarLab = (() => {
  // Config
  const ASSET_PATH = 'assets/avatars/parts/';

  const CATEGORIES = ['body', 'face_skin_tone', 'expressions', 'hair', 'hats'];

  const DEFAULT_LAYER_ORDER = [
    'body',            // Bottom
    'face_skin_tone',
    'expressions',
    'hair',
    'hats'             // Top
  ];

  // Categories whose variants can also be "none"
  const OPTIONAL_NONE = ['expressions', 'hair', 'hats'];

  // i18n helper (graceful fallback to Italian copy)
  const t = (key, fallback) => {
    try {
      const api = window.BadianiI18n;
      if (api && typeof api.t === 'function') {
        const v = api.t(key);
        if (v && v !== key) return String(v);
      }
    } catch {}
    return String(fallback);
  };

  const categoryLabels = () => ({
    body: t('avatarLab.cat.body', 'Outfit'),
    face_skin_tone: t('avatarLab.cat.skin', 'Pelle'),
    expressions: t('avatarLab.cat.mood', 'Mood'),
    hair: t('avatarLab.cat.hair', 'Capelli'),
    hats: t('avatarLab.cat.hats', 'Cappelli')
  });

  // State
  let state = {
    body: null,
    face_skin_tone: null,
    expressions: null,
    hair: null,
    hats: null,
    offsets: {},
    scales: {},
    layerOrder: [...DEFAULT_LAYER_ORDER]
  };

  const DEFAULT_SCALES = {
    body: 0.6,
    face_skin_tone: 0.25,
    expressions: 0.25,
    hair: 0.25,
    hats: 0.25
  };

  let manifest = null;
  let activeCategory = 'body';
  let advancedMode = false;

  // --- Dynamic Loader ---
  function loadManifest(callback) {
    if (typeof AVATAR_MANIFEST !== 'undefined') {
      manifest = AVATAR_MANIFEST;
      initDefaultState();
      callback();
      return;
    }
    const script = document.createElement('script');
    script.src = 'scripts/avatar-manifest.js?v=' + Date.now();
    script.onload = () => {
      if (typeof AVATAR_MANIFEST !== 'undefined') {
        manifest = AVATAR_MANIFEST;
        initDefaultState();
        callback();
      }
    };
    document.body.appendChild(script);
  }

  function randomPick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  // Random full look: body + skin + expression + hair always, hat 50%.
  function randomizeState() {
    if (!manifest) return;
    CATEGORIES.forEach(cat => {
      const items = manifest[cat] || [];
      if (!items.length) { state[cat] = null; return; }
      if (cat === 'hats') {
        state[cat] = (Math.random() < 0.5) ? randomPick(items) : null;
      } else {
        state[cat] = randomPick(items);
      }
      state.scales[cat] = DEFAULT_SCALES[cat];
      state.offsets[cat] = { x: 0, y: 0 };
    });
  }

  function initDefaultState() {
    if (!state.offsets) state.offsets = {};
    if (!state.scales) state.scales = {};
    if (!state.layerOrder || state.layerOrder.length === 0) state.layerOrder = [...DEFAULT_LAYER_ORDER];

    CATEGORIES.forEach(cat => {
      if (!state.offsets[cat]) state.offsets[cat] = { x: 0, y: 0 };
      if (typeof state.scales[cat] === 'undefined') state.scales[cat] = DEFAULT_SCALES[cat];
    });

    // Never start empty: if no part is equipped, dress a random character right away.
    const hasAny = CATEGORIES.some(cat => !!state[cat]);
    if (!hasAny) randomizeState();
  }

  // --- UI Construction (Playful Studio) ---
  function getHTML() {
    return `
      <div id="avatar-lab-root" class="avatar-studio-root" role="group" aria-label="${t('avatarLab.title', 'Avatar Lab')}">
        <style>
          .avatar-studio-root {
            position: relative;
            width: 100%;
            height: clamp(500px, 80vh, 620px);
            background: #fff;
            border: 1px solid rgba(33,64,152,0.12);
            border-radius: 22px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            font-family: var(--font-regular, sans-serif);
            box-shadow: 0 16px 36px rgba(15,33,84,0.12);
          }

          /* STAGE */
          .studio-stage {
            flex: 1;
            min-height: 170px;
            position: relative;
            overflow: hidden;
            background:
              linear-gradient(rgba(33,64,152,0.045) 1px, transparent 1px),
              linear-gradient(90deg, rgba(33,64,152,0.045) 1px, transparent 1px),
              #f9f6ec;
            background-size: 20px 20px, 20px 20px, auto;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1;
            outline: none;
          }
          .studio-stage:focus-visible {
            box-shadow: inset 0 0 0 3px rgba(33,64,152,0.35);
          }
          .avatar-studio-root.is-advanced .studio-stage { cursor: grab; }
          .avatar-studio-root.is-advanced .studio-stage:active { cursor: grabbing; }

          /* CAPTURE FRAME */
          .capture-frame {
            width: min(230px, 58vw);
            height: min(230px, 58vw);
            border: 2px dashed rgba(33, 64, 152, 0.22);
            border-radius: 8px;
            position: relative;
            pointer-events: none;
            flex-shrink: 0;
          }
          .avatar-studio-root.is-advanced .capture-frame { border-color: rgba(33,64,152,0.45); }

          .avatar-composite {
            width: 100%; height: 100%;
            position: relative;
          }
          .avatar-composite.pop { animation: lab-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1); }
          .avatar-composite.swap { animation: lab-swap 0.25s ease-out; }
          @keyframes lab-pop {
            0%   { transform: scale(1) rotate(0deg); }
            35%  { transform: scale(1.12) rotate(-2deg); }
            70%  { transform: scale(0.95) rotate(1.5deg); }
            100% { transform: scale(1) rotate(0deg); }
          }
          @keyframes lab-swap {
            0%   { transform: scale(0.96); opacity: 0.65; }
            100% { transform: scale(1); opacity: 1; }
          }
          @media (prefers-reduced-motion: reduce) {
            .avatar-composite.pop, .avatar-composite.swap { animation: none; }
          }

          .avatar-layer {
            position: absolute;
            top: 0; left: 0; width: 100%; height: 100%;
            transform-origin: center center;
            pointer-events: none;
            transition: opacity 0.2s;
          }
          .avatar-layer.is-active {
            filter: drop-shadow(0 0 5px rgba(33,64,152,0.55));
          }

          /* ARROWS */
          .lab-arrow {
            position: absolute;
            top: 50%;
            transform: translateY(-50%);
            width: 42px; height: 42px;
            border-radius: 50%;
            border: 1px solid rgba(33,64,152,0.22);
            background: #fff;
            color: #214098;
            font-size: 24px;
            line-height: 1;
            font-family: var(--font-medium, inherit);
            display: flex; align-items: center; justify-content: center;
            cursor: pointer;
            box-shadow: 0 6px 16px rgba(15,33,84,0.16);
            z-index: 20;
            padding: 0 0 3px 0;
            transition: transform 0.15s ease;
          }
          .lab-arrow:active { transform: translateY(-50%) scale(0.92); }
          .lab-arrow.prev { left: 10px; }
          .lab-arrow.next { right: 10px; }

          /* HINT */
          .lab-hint {
            margin: 0;
            padding: 7px 12px 0;
            text-align: center;
            font-size: 11.5px;
            color: var(--brand-gray-soft, #6b7280);
          }

          /* DOCK */
          .studio-dock {
            position: relative;
            width: 100%;
            padding: 8px 0 12px;
            background: #fff;
            z-index: 60;
            display: flex;
            flex-direction: column;
            gap: 8px;
            box-shadow: 0 -10px 30px rgba(15,33,84,0.05);
          }

          /* CATEGORY CHIPS */
          .category-chips {
            display: flex;
            gap: 6px;
            padding: 4px 12px 0;
            overflow-x: auto;
            scrollbar-width: none;
            -webkit-overflow-scrolling: touch;
          }
          .category-chips::-webkit-scrollbar { display: none; }
          .cat-chip {
            flex-shrink: 0;
            padding: 8px 13px;
            border-radius: 999px;
            border: 1.5px solid rgba(33,64,152,0.28);
            background: #fff;
            color: #214098;
            font-family: var(--font-medium, inherit);
            font-weight: 500;
            font-size: 12px;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            cursor: pointer;
            transition: background 0.15s, color 0.15s, transform 0.15s;
          }
          .cat-chip:active { transform: scale(0.96); }
          .cat-chip.active {
            background: #214098;
            border-color: #214098;
            color: #fff;
          }

          /* ASSET DRAWER */
          .asset-drawer { padding: 0; }
          .items-grid {
            display: flex;
            overflow-x: auto;
            gap: 10px;
            padding: 6px 12px;
            scrollbar-width: none;
            scroll-snap-type: x mandatory;
            scroll-behavior: smooth;
            -webkit-overflow-scrolling: touch;
          }
          .items-grid::-webkit-scrollbar { display: none; }

          .item-thumb {
            width: 56px; height: 56px;
            border-radius: 14px;
            background: #f6f3ea;
            flex-shrink: 0;
            border: 2px solid transparent;
            cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            scroll-snap-align: start;
            box-shadow: 0 2px 5px rgba(15,33,84,0.06);
            transition: transform 0.15s;
          }
          .item-thumb:active { transform: scale(0.94); }
          .item-thumb.selected { border-color: #214098; background: #fff; }
          .item-thumb img { width: 82%; height: 82%; object-fit: contain; }
          .item-thumb .none-mark {
            font-family: var(--font-medium, inherit);
            font-weight: 500;
            font-size: 18px;
            color: var(--brand-gray-soft, #6b7280);
          }

          /* ACTION ROW */
          .lab-actions {
            display: flex;
            gap: 8px;
            padding: 0 12px;
          }
          .lab-btn {
            flex: 1;
            padding: 12px 10px;
            border-radius: 12px;
            font-family: var(--font-medium, inherit);
            font-weight: 500;
            font-size: 13px;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            cursor: pointer;
            transition: transform 0.15s;
            white-space: nowrap;
          }
          .lab-btn:active { transform: scale(0.97); }
          .lab-btn.surprise {
            background: #fff;
            color: var(--brand-rose-ink, #9d1f5d);
            border: 1.5px solid rgba(236,65,140,0.45);
          }
          .lab-btn.save {
            background: #214098;
            color: #fff;
            border: 1.5px solid #214098;
          }

          /* ADVANCED */
          .advanced-toggle {
            margin: 0 12px;
            padding: 6px 4px;
            background: transparent;
            border: none;
            color: var(--brand-gray-soft, #6b7280);
            font-size: 11.5px;
            font-weight: 500;
            letter-spacing: 0.04em;
            text-decoration: underline;
            cursor: pointer;
            text-align: center;
          }
          .advanced-toggle[aria-expanded="true"] { color: #214098; }
          .advanced-panel {
            display: flex;
            gap: 8px;
            padding: 0 12px;
          }
          .advanced-panel[hidden] { display: none; }
          .adv-row {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 6px;
            background: #f6f3ea;
            border-radius: 12px;
            padding: 6px 8px 6px 12px;
          }
          .adv-row > span {
            font-size: 11px;
            font-weight: 500;
            letter-spacing: 0.05em;
            text-transform: uppercase;
            color: var(--ink, #0f2154);
          }
          .adv-actions { display: flex; gap: 4px; }
          .adv-btn {
            width: 30px; height: 30px;
            background: #fff;
            border: 1px solid rgba(33,64,152,0.2);
            border-radius: 8px;
            display: flex; align-items: center; justify-content: center;
            font-family: var(--font-medium, inherit);
            font-weight: 500; font-size: 14px;
            color: #214098;
            cursor: pointer;
          }
          .adv-btn:active { transform: scale(0.94); }
        </style>

        <!-- STAGE -->
        <div class="studio-stage" id="lab-stage" tabindex="0" aria-label="${t('avatarLab.stageAria', 'Anteprima avatar: tocca per cambiare la variante')}">
          <button type="button" class="lab-arrow prev" aria-label="${t('avatarLab.prevAria', 'Variante precedente')}" onclick="AvatarLab.cycleVariant(-1)">&#8249;</button>
          <div class="capture-frame">
            <div class="avatar-composite" id="avatar-composite"></div>
          </div>
          <button type="button" class="lab-arrow next" aria-label="${t('avatarLab.nextAria', 'Variante successiva')}" onclick="AvatarLab.cycleVariant(1)">&#8250;</button>
        </div>

        <p class="lab-hint" id="lab-hint">${t('avatarLab.tapHint', "Tocca l'avatar o le frecce per cambiare look")}</p>

        <!-- DOCK -->
        <div class="studio-dock">
          <div class="category-chips" id="category-bar" role="tablist" aria-label="${t('avatarLab.title', 'Avatar Lab')}"></div>

          <div class="asset-drawer open" id="asset-drawer">
            <div class="items-grid" id="items-grid"></div>
          </div>

          <div class="lab-actions">
            <button type="button" class="lab-btn surprise" id="lab-surprise" onclick="AvatarLab.surprise()">${t('avatarLab.surprise', 'Sorprendimi!')}</button>
            <button type="button" class="lab-btn save" id="lab-save" onclick="AvatarLab.save()">${t('avatarLab.save', 'Salva')}</button>
          </div>

          <button type="button" class="advanced-toggle" id="advanced-toggle" aria-expanded="false" aria-controls="advanced-panel" onclick="AvatarLab.toggleAdvanced()">${t('avatarLab.advanced', 'Regolazioni avanzate')}</button>

          <div class="advanced-panel" id="advanced-panel" hidden>
            <div class="adv-row">
              <span>${t('avatarLab.size', 'Dimensione')}</span>
              <div class="adv-actions">
                <button type="button" class="adv-btn" aria-label="${t('avatarLab.size', 'Dimensione')} -" onclick="AvatarLab.adjustLayerScale(-0.05)">&minus;</button>
                <button type="button" class="adv-btn" aria-label="${t('avatarLab.size', 'Dimensione')} +" onclick="AvatarLab.adjustLayerScale(0.05)">+</button>
              </div>
            </div>
            <div class="adv-row">
              <span>${t('avatarLab.layer', 'Livello')}</span>
              <div class="adv-actions">
                <button type="button" class="adv-btn" aria-label="${t('avatarLab.layer', 'Livello')} &darr;" onclick="AvatarLab.moveLayerOrder(-1)">&darr;</button>
                <button type="button" class="adv-btn" aria-label="${t('avatarLab.layer', 'Livello')} &uarr;" onclick="AvatarLab.moveLayerOrder(1)">&uarr;</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // --- Core ---

  function init(container) {
    loadState();
    loadManifest(() => {
      renderUI(container);
    });
  }

  function renderUI() {
    renderChips();
    renderItemsGrid();
    renderAvatar();
    setupInteractions();
  }

  function renderChips() {
    const bar = document.getElementById('category-bar');
    if (!bar) return;
    const labels = categoryLabels();
    bar.innerHTML = CATEGORIES.map(cat => `
      <button type="button" class="cat-chip ${cat === activeCategory ? 'active' : ''}"
              role="tab" aria-selected="${cat === activeCategory}"
              data-cat="${cat}"
              onclick="AvatarLab.setCategory('${cat}')">${labels[cat]}</button>
    `).join('');
  }

  function setCategory(cat) {
    if (!CATEGORIES.includes(cat)) return;
    activeCategory = cat;
    renderChips();
    renderItemsGrid();
    renderAvatar(); // Update visual highlight
  }

  function renderItemsGrid() {
    const grid = document.getElementById('items-grid');
    if (!grid || !manifest || !manifest[activeCategory]) return;

    const items = manifest[activeCategory];
    const html = [
      ...(OPTIONAL_NONE.includes(activeCategory) ? [{ name: 'none' }] : []),
      ...items.map(name => ({ name }))
    ].map(item => {
      const isNone = item.name === 'none';
      const isSelected = state[activeCategory] === (isNone ? null : item.name);
      const src = isNone ? '' : `${ASSET_PATH}${activeCategory}/${item.name}`;

      return `
        <div class="item-thumb ${isSelected ? 'selected' : ''}" role="button" tabindex="0"
             aria-label="${isNone ? t('avatarLab.none', 'Nessuno') : item.name.replace(/\.webp$/, '')}"
             onclick="AvatarLab.equip('${activeCategory}', '${item.name}')"
             onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();AvatarLab.equip('${activeCategory}', '${item.name}');}">
             ${isNone ? `<span class="none-mark" aria-hidden="true">&ndash;</span>` : `<img src="${src}" alt="" loading="lazy">`}
        </div>
      `;
    }).join('');

    grid.innerHTML = html;
  }

  function renderAvatar() {
    const comp = document.getElementById('avatar-composite');
    if (!comp) return;

    let html = '';
    // Soft shadow
    html += `<div style="position:absolute; bottom:30px; left:50%; transform:translateX(-50%) scale(0.6); width:140px; height:12px; background:rgba(15,33,84,0.1); border-radius:50%;"></div>`;

    state.layerOrder.forEach((cat, idx) => {
      const item = state[cat];
      if (item) {
        const offset = state.offsets[cat] || { x: 0, y: 0 };
        const scale = state.scales[cat] || DEFAULT_SCALES[cat];
        const isActive = advancedMode && cat === activeCategory;

        const style = `z-index:${idx * 10}; transform: translate(${offset.x}px, ${offset.y}px) scale(${scale});`;
        html += `<img class="avatar-layer ${isActive ? 'is-active' : ''}"
                      src="${ASSET_PATH}${cat}/${item}"
                      style="${style}" alt="">`;
      }
    });

    comp.innerHTML = html;
  }

  function equip(cat, val) {
    state[cat] = (val === 'none') ? null : val;
    renderItemsGrid();
    renderAvatar();
    pulsePreview('swap');
  }

  // Cycle the variants of the active category (arrows / tap on the avatar).
  function cycleVariant(dir) {
    if (!manifest || !manifest[activeCategory]) return;
    const items = manifest[activeCategory];
    const list = OPTIONAL_NONE.includes(activeCategory) ? [null, ...items] : items.slice();
    if (!list.length) return;
    const cur = list.indexOf(state[activeCategory]);
    const next = ((cur < 0 ? 0 : cur) + dir + list.length) % list.length;
    state[activeCategory] = list[next];
    renderItemsGrid();
    renderAvatar();
    pulsePreview('swap');
  }

  // --- Animations ---
  function pulsePreview(kind) {
    const comp = document.getElementById('avatar-composite');
    if (!comp) return;
    comp.classList.remove('pop', 'swap');
    // Force reflow so the animation restarts on rapid taps.
    void comp.offsetWidth;
    comp.classList.add(kind);
    setTimeout(() => comp.classList.remove(kind), kind === 'pop' ? 520 : 270);
  }

  // --- Interactions ---
  function toggleAdvanced() {
    advancedMode = !advancedMode;
    const panel = document.getElementById('advanced-panel');
    const toggle = document.getElementById('advanced-toggle');
    const root = document.getElementById('avatar-lab-root');
    if (panel) panel.hidden = !advancedMode;
    if (toggle) toggle.setAttribute('aria-expanded', advancedMode ? 'true' : 'false');
    if (root) root.classList.toggle('is-advanced', advancedMode);
    renderAvatar();
  }

  function adjustLayerScale(d) {
    if (!state.scales[activeCategory]) state.scales[activeCategory] = DEFAULT_SCALES[activeCategory];
    state.scales[activeCategory] = Math.max(0.1, state.scales[activeCategory] + d);
    renderAvatar();
  }

  function moveLayerOrder(dir) {
    const idx = state.layerOrder.indexOf(activeCategory);
    if (idx === -1) return;
    const newIdx = idx + dir;
    if (newIdx >= 0 && newIdx < state.layerOrder.length) {
      const tmp = state.layerOrder[newIdx];
      state.layerOrder[newIdx] = activeCategory;
      state.layerOrder[idx] = tmp;
      renderAvatar();
    }
  }

  function randomize() {
    if (!manifest) return;
    randomizeState();
    renderAvatar();
    renderItemsGrid();
    pulsePreview('pop');
  }

  // Alias used by the big playful button.
  function surprise() {
    randomize();
  }

  function celebrateSave() {
    try {
      const comp = document.getElementById('avatar-composite');
      const r = comp ? comp.getBoundingClientRect() : null;
      const x = r ? r.left + r.width / 2 : window.innerWidth / 2;
      const y = r ? r.top + r.height / 2 : window.innerHeight / 2;
      if (window.GelatoEffects && typeof window.GelatoEffects.celebrate === 'function') {
        window.GelatoEffects.celebrate(x, y);
      }
    } catch {}
    pulsePreview('pop');
  }

  function save() {
    localStorage.setItem('badiani_user_avatar_v2_state', JSON.stringify(state));
    exportToCanvas((base64) => {
      localStorage.setItem('badiani_user_avatar', base64);
      window.dispatchEvent(new CustomEvent('avatar-updated', { detail: base64 }));
      celebrateSave();
      if (window.showToast) window.showToast(t('avatarLab.saved', 'Avatar salvato! Sei ufficialmente parte della squadra.'));

      // Visual feedback on button
      const btn = document.getElementById('lab-save');
      if (btn) {
        const original = t('avatarLab.save', 'Salva');
        btn.textContent = t('avatarLab.saveDone', 'Fatto!');
        setTimeout(() => { btn.textContent = original; }, 1600);
      }
    });
  }

  // NOTE: Square export (350x350)
  function exportToCanvas(cb) {
    const size = 350;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Background fill (white)
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);

    const layers = state.layerOrder.map(cat => state[cat] ? {
      src: `${ASSET_PATH}${cat}/${state[cat]}`,
      offset: state.offsets[cat] || { x: 0, y: 0 },
      scale: state.scales[cat] || DEFAULT_SCALES[cat]
    } : null).filter(Boolean);

    let loaded = 0;
    if (layers.length === 0) { cb(canvas.toDataURL()); return; }

    layers.forEach(l => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.onload = () => {
        l.img = img;
        loaded++;
        if (loaded === layers.length) {
          layers.forEach(layer => {
            ctx.save();
            ctx.translate(layer.offset.x, layer.offset.y);
            ctx.translate(size / 2, size / 2);
            ctx.scale(layer.scale, layer.scale);
            ctx.translate(-size / 2, -size / 2);
            ctx.drawImage(layer.img, 0, 0, size, size);
            ctx.restore();
          });
          cb(canvas.toDataURL());
        }
      };
      img.src = l.src;
    });
  }

  function setupInteractions() {
    const el = document.getElementById('lab-stage');
    if (!el) return;

    let isDown = false;
    let moved = false;
    let lastX = 0, lastY = 0, startX = 0, startY = 0;

    const start = (x, y, target) => {
      // Ignore presses that begin on the arrows (they have their own click handlers).
      if (target && target.closest && target.closest('.lab-arrow')) return;
      isDown = true; moved = false;
      lastX = x; lastY = y; startX = x; startY = y;
    };
    const move = (x, y) => {
      if (!isDown) return;
      if (Math.abs(x - startX) + Math.abs(y - startY) > 6) moved = true;
      if (advancedMode && state[activeCategory]) {
        const dx = x - lastX; const dy = y - lastY;
        lastX = x; lastY = y;
        state.offsets[activeCategory].x += dx;
        state.offsets[activeCategory].y += dy;
        requestAnimationFrame(renderAvatar);
      } else {
        lastX = x; lastY = y;
      }
    };
    const end = () => {
      if (isDown && !moved && !advancedMode) {
        // Simple mode: a tap on the avatar cycles the active category.
        cycleVariant(1);
      }
      isDown = false;
    };

    el.addEventListener('mousedown', e => { e.preventDefault(); start(e.clientX, e.clientY, e.target); });
    window.addEventListener('mousemove', e => move(e.clientX, e.clientY));
    window.addEventListener('mouseup', end);

    el.addEventListener('touchstart', e => {
      if (e.target && e.target.closest && e.target.closest('.lab-arrow')) return;
      e.preventDefault();
      start(e.touches[0].clientX, e.touches[0].clientY, e.target);
    }, { passive: false });
    el.addEventListener('touchmove', e => { e.preventDefault(); move(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
    window.addEventListener('touchend', end);

    // Keyboard: arrows cycle variants, Enter/Space = next.
    el.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        cycleVariant(1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        cycleVariant(-1);
      }
    });
  }

  function loadState() {
    const s = localStorage.getItem('badiani_user_avatar_v2_state');
    if (s) {
      try {
        const p = JSON.parse(s);
        state = { ...state, ...p };
        if (p.sales) state.scales = p.scales; // typo fix from old versions
      } catch {}
    }
  }

  return { init, getHTML, render: renderAvatar, setCategory, equip, randomize, surprise, cycleVariant, toggleAdvanced, save, adjustLayerScale, moveLayerOrder };
})();
