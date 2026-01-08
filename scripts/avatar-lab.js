/**
 * Badiani Avatar Lab v4.0 (Whiteboard Studio)
 * Features: Square Capture Frame, Floating "Dock" UI, collapsible asset drawer.
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

  const CATEGORY_NAMES = { body: 'Outfit', face_skin_tone: 'Skin', expressions: 'Mood', hair: 'Hair', hats: 'Hats' };
  const CATEGORY_ICONS = { body: '👕', face_skin_tone: '🎨', expressions: '😀', hair: '💇', hats: '🧢' };

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
  let isDrawerOpen = true;

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

  function initDefaultState() {
     if (!state.offsets) state.offsets = {};
     if (!state.scales) state.scales = {};
     if (!state.layerOrder || state.layerOrder.length === 0) state.layerOrder = [...DEFAULT_LAYER_ORDER];

     CATEGORIES.forEach(cat => {
         if (!state.offsets[cat]) state.offsets[cat] = {x:0, y:0};
         if (typeof state.scales[cat] === 'undefined') state.scales[cat] = DEFAULT_SCALES[cat];
         
         // REMOVED: Do not auto-equip items. Start empty.
         /*
         if (!state[cat] && manifest[cat] && manifest[cat].length > 0) {
             if (['body', 'face_skin_tone', 'expressions'].includes(cat)) {
                 state[cat] = manifest[cat][0];
             }
         }
         */
     });
  }

  // --- UI Construction (New "Floating Studio" Design) ---
  function getHTML() {
    return `
      <div id="avatar-lab-root" class="avatar-studio-root">
        <style>
          .avatar-studio-root {
            position: relative;
            width: 100%;
            height: clamp(500px, 85vh, 600px);
            background: #fff;
            border-radius: 24px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            font-family: var(--font-regular, sans-serif);
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
          }

          /* STAGE & GRID */
          .studio-stage {
            flex: 1; /* Takes available space */
            min-height: 0; /* Allow shrinking */
            position: relative;
            overflow: hidden;
            background-image: 
              linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px);
            background-size: 20px 20px;
            cursor: grab;
            display: flex;
            align-items: center; /* Center Vertically */
            justify-content: center; /* Center Horizontally */
            z-index: 1;
          }
          .studio-stage:active { cursor: grabbing; }

          /* CAPTURE FRAME (The Square) */
          .capture-frame {
            width: min(300px, 75vw); /* Slightly smaller to be safe */
            height: min(300px, 75vw);
            border: 2px dashed rgba(33, 64, 152, 0.3);
            border-radius: 4px;
            position: relative;
            pointer-events: none; 
            box-shadow: 0 0 0 9999px rgba(255,255,255,0.5); 
            flex-shrink: 0; /* Prevent squashing */
          }
          .capture-frame::after {
            content: 'AREA FOTO (SQUARE)';
            position: absolute;
            top: -20px; left: 50%; transform: translateX(-50%);
            font-size: 10px; font-weight: bold; color: var(--brand-blue, #222);
            opacity: 0.5;
            white-space: nowrap;
          }
          /* Corner markers */
          .capture-marker {
            position: absolute; width: 10px; height: 10px;
            border: 2px solid var(--brand-blue, #000);
            border-radius: 1px;
          }
          .tl { top: -1px; left: -1px; border-right: 0; border-bottom: 0; }
          .tr { top: -1px; right: -1px; border-left: 0; border-bottom: 0; }
          .bl { bottom: -1px; left: -1px; border-right: 0; border-top: 0; }
          .br { bottom: -1px; right: -1px; border-left: 0; border-top: 0; }

          /* COMPOSITE CONTAINER */
          /* Placed exactly inside the frame */
          .avatar-composite {
            width: 100%; height: 100%;
            position: relative;
          }
          
          .avatar-layer {
            position: absolute;
            top: 0; left: 0; width: 100%; height: 100%;
            transform-origin: center center;
            pointer-events: none;
            transition: opacity 0.2s;
          }
          .avatar-layer.is-active {
            filter: drop-shadow(0 0 5px var(--brand-blue, #00BCD4));
            z-index: 1000 !important; /* Temporarily bring to front visually only? No, confusing. keep z-index but glow */
          }

          /* FLOATING TOOLS (Moved to Top Left) */
          .floating-tools {
            position: absolute;
            top: 16px; left: 16px; /* Moved Left */
            display: flex;
            flex-direction: column;
            gap: 8px;
            z-index: 50;
            pointer-events: auto; /* Ensure clickable */
          }
          .tool-pill.compact {
            background: rgba(255,255,255,0.9);
            backdrop-filter: blur(4px);
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            border-radius: 8px;
            padding: 4px;
            display: flex;
            align-items: center;
            gap: 6px;
            transform: none; /* remove old scale */
          }
          .tool-icon { font-size: 14px; opacity: 0.7; padding-left: 4px; }
          .tool-actions { display: flex; gap: 2px; }
          .tool-btn.mini {
            width: 28px; height: 28px;
            background: #f0f0f0;
            border-radius: 6px;
            display: flex; align-items: center; justify-content: center;
            font-weight: bold; font-size: 14px;
            cursor: pointer;
          }
          .tool-btn.mini:active { background: #ddd; transform: scale(0.95); }

          /* EXIT BUTTON (Top Right) */
          .exit-btn-corner {
             position: absolute; top: 16px; right: 16px;
             width: 40px; height: 40px;
             background: #fff;
             border-radius: 12px;
             box-shadow: 0 4px 12px rgba(0,0,0,0.1);
             display: flex; align-items: center; justify-content: center;
             color: #333;
             cursor: pointer;
             z-index: 100;
             transition: transform 0.2s;
          }
          .exit-btn-corner:active { transform: scale(0.95); }

          /* DOCK (Bottom) */
          .studio-dock {
            position: relative; /* Part of flex flow */
            width: 100%;
            padding: 12px 0;
            background: #fff;
            z-index: 60;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
            box-shadow: 0 -10px 30px rgba(0,0,0,0.05);
          }

          /* ASSET DRAWER (Pop-up) */
          .asset-drawer {
            position: absolute;
            bottom: 100%; /* Sits on top of dock */
            left: 0; right: 0;
            background: rgba(255,255,255,0.98);
            backdrop-filter: blur(10px);
            border-top: 1px solid rgba(0,0,0,0.05);
            padding: 12px;
            box-shadow: 0 -4px 20px rgba(0,0,0,0.1);
            max-height: 0;
            opacity: 0;
            overflow: hidden;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            transform: translateY(10px);
            z-index: -1; 
          }
          .asset-drawer.open {
            max-height: 220px; 
            opacity: 1;
            transform: translateY(0);
          }

          .items-grid {
            display: flex;
            overflow-x: auto;
            gap: 12px;
            padding: 8px 12px;
            /* ...existing scroll code... */
            scrollbar-width: none; 
            scroll-snap-type: x mandatory;
            scroll-behavior: smooth;
            -webkit-overflow-scrolling: touch;
          }
          .items-grid::-webkit-scrollbar { display: none; }

          .item-thumb {
            width: 60px; height: 60px;
            border-radius: 12px;
            background: #f0f0f0;
            flex-shrink: 0;
            border: 2px solid transparent;
            cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            scroll-snap-align: start;
            box-shadow: 0 2px 5px rgba(0,0,0,0.05);
          }
          .item-thumb.selected { border-color: var(--brand-blue, #000); background: #fff; }
          .item-thumb img { width: 80%; height: 80%; object-fit: contain; }

          /* CATEGORY BAR */
          .category-bar {
            background: #222;
            border-radius: 40px;
            padding: 6px 8px;
            display: flex;
            gap: 4px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.2);
            pointer-events: auto;
            max-width: 95%; /* Fit on screen */
            overflow-x: auto; /* Scroll if needed */
          }
          
          .cat-pill {
            width: 44px; height: 44px;
            border-radius: 50%;
            color: #888;
            display: flex; align-items: center; justify-content: center;
            font-size: 20px;
            flex-shrink: 0;
            cursor: pointer;
            transition: all 0.2s;
            position: relative;
          }
          .cat-pill:hover { background: rgba(255,255,255,0.1); color: #fff; }
          .cat-pill.active { background: var(--brand-blue, #4455bb); color: #fff; transform: translateY(-4px); }
          .cat-pill.active::after {
            content: ''; position: absolute; bottom: -8px; left: 50%; transform: translateX(-50%);
            width: 4px; height: 4px; background: inherit; border-radius: 50%;
          }

          .dock-divider { width: 1px; background: #444; margin: 0 4px; flex-shrink:0; }
          
          .save-btn-round {
            background: var(--brand-rose, #e91e63);
            color: white;
            border-radius: 30px;
            padding: 0 16px;
            display: flex; align-items: center; justify-content: center;
            font-weight: bold; font-size: 14px;
            cursor: pointer;
            border: none;
            transition: transform 0.2s;
            white-space: nowrap;
          }
          .save-btn-round:active { transform: scale(0.95); }
          
          .icon-btn-round {
             background: #333;
             color: #fff;
             width: 44px; height: 44px; border-radius: 50%;
             display: flex; align-items: center; justify-content: center;
             cursor: pointer;
             font-size: 18px;
             border: none;
             flex-shrink: 0;
          }

          /* TOP INFO */
          .current-info {
            position: absolute; top: 16px; left: 16px;
            background: rgba(255,255,255,0.8);
            padding: 4px 10px; border-radius: 20px;
            font-size: 12px; font-weight: 600; color: #555;
            pointer-events: none;
            z-index: 50;
          }
          
          /* EMPTY STATE OVERLAY */
          .empty-state-msg {
            position: absolute;
            top: 40%; left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(255,255,255,0.95);
            padding: 12px 20px;
            border-radius: 20px;
            color: #555;
            font-size: 14px;
            font-weight: 600;
            text-align: center;
            pointer-events: none;
            box-shadow: 0 5px 15px rgba(0,0,0,0.15);
            white-space: nowrap;
            animation: fadeIn 0.5s ease-out;
            z-index: 2000;
            line-height: 1.4;
            border: 1px solid rgba(0,0,0,0.05);
          }
          @keyframes fadeIn { from { opacity:0; transform:translate(-50%,-40%); } to { opacity:1; transform:translate(-50%,-50%); } }
        </style>
        
        <!-- Exit Button (Top Right) -->
        <div class="exit-btn-corner" onclick="window.dispatchEvent(new CustomEvent('avatar-logout-request'))">
           <!-- Icon: Square with arrow out -->
           <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
             <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
             <polyline points="16 17 21 12 16 7"></polyline>
             <line x1="21" y1="12" x2="9" y2="12"></line>
           </svg>
        </div>

        <!-- Floating Tools (Moved to Top Left) -->
        <div class="floating-tools">
          <!-- Size Control -->
          <div class="tool-pill compact">
             <div class="tool-icon">📏</div>
             <div class="tool-actions">
               <div class="tool-btn mini" onclick="AvatarLab.adjustLayerScale(-0.05)">-</div>
               <div class="tool-btn mini" onclick="AvatarLab.adjustLayerScale(0.05)">+</div>
             </div>
          </div>
          
          <!-- Layer Control -->
          <div class="tool-pill compact">
             <div class="tool-icon">📚</div>
             <div class="tool-actions">
               <div class="tool-btn mini" onclick="AvatarLab.moveLayerOrder(-1)">⬇</div>
               <div class="tool-btn mini" onclick="AvatarLab.moveLayerOrder(1)">⬆</div>
             </div>
          </div>
        </div>

        <!-- STAGE -->
        <div class="studio-stage" id="lab-stage">
           <!-- The capture frame is the viewport for the avatar -->
           <div class="capture-frame">
              <div class="capture-marker tl"></div>
              <div class="capture-marker tr"></div>
              <div class="capture-marker bl"></div>
              <div class="capture-marker br"></div>
              
              <div class="avatar-composite" id="avatar-composite">
                 <!-- Layers go here -->
              </div>
           </div>
        </div>

        <!-- DOCK -->
        <div class="studio-dock">
           <!-- Pop-up Drawer -->
           <div class="asset-drawer open" id="asset-drawer">
              <div class="items-grid" id="items-grid"></div>
           </div>
           
           <!-- Tab Bar -->
           <div class="category-bar" id="category-bar">
              <!-- Icons Injected Here -->
              <div class="dock-divider"></div>
              <button class="save-btn-round" onclick="AvatarLab.save()">SALVA</button>
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

  function renderUI(container) {
    const bar = document.getElementById('category-bar');
    if (bar) {
      // Just the SAVE button, as requested. Removed the profile switch button.
      const actionsHTML = `
        <div class="dock-divider"></div>
        <button class="save-btn-round" onclick="AvatarLab.save()">SALVA</button>
      `;
      
      const buttons = CATEGORIES.map(cat => `
        <div class="cat-pill ${cat === activeCategory ? 'active' : ''}" 
             onclick="AvatarLab.setCategory('${cat}')">
          ${CATEGORY_ICONS[cat]}
        </div>
      `).join('');
      
      bar.innerHTML = buttons + actionsHTML;
    }

    renderItemsGrid();
    renderAvatar();
    setupInteractions();
    updateLabel();
  }

  function setCategory(cat) {
    if (activeCategory === cat) {
        // Toggle drawer if clicking same category
        const d = document.getElementById('asset-drawer');
        if(d) d.classList.toggle('open');
    } else {
        activeCategory = cat;
        // Ensure open
        const d = document.getElementById('asset-drawer');
        if(d && !d.classList.contains('open')) d.classList.add('open');
    }
    
    // UI Updates
    document.querySelectorAll('.cat-pill').forEach((btn, i) => {
       if (CATEGORIES[i] === activeCategory) btn.classList.add('active');
       else btn.classList.remove('active');
    });

    renderItemsGrid();
    renderAvatar(); // To update visual highlight
    updateLabel();
  }
  
  function updateLabel() {
     const lbl = document.getElementById('lab-info-text');
     if(lbl) lbl.textContent = `Modifica: ${CATEGORY_NAMES[activeCategory]}`;
  }

  function renderItemsGrid() {
    const grid = document.getElementById('items-grid');
    if (!grid || !manifest || !manifest[activeCategory]) return;

    const items = manifest[activeCategory];
    const html = [
      ...( ['hair', 'hats', 'expressions'].includes(activeCategory) ? [{ name: 'none', label: '🚫' }] : [] ),
      ...items.map(name => ({ name }))
    ].map(item => {
      const isNone = item.name === 'none';
      const isSelected = state[activeCategory] === (isNone ? null : item.name);
      const src = isNone ? '' : `${ASSET_PATH}${activeCategory}/${item.name}`;
      
      return `
        <div class="item-thumb ${isSelected ? 'selected' : ''}" 
             onclick="AvatarLab.equip('${activeCategory}', '${item.name}')">
             ${isNone ? '<span style="font-size:18px;">🚫</span>' : `<img src="${src}" loading="lazy">`}
        </div>
      `;
    }).join('');
    
    grid.innerHTML = html;
  }

  function renderAvatar() {
    const comp = document.getElementById('avatar-composite');
    if (!comp) return;

    let html = '';
    // Shadow
    html += `<div style="position:absolute; bottom:30px; left:50%; transform:translateX(-50%) scale(0.6); width:140px; height:12px; background:rgba(0,0,0,0.1); border-radius:50%;"></div>`;

    let activeLayersCount = 0;
    state.layerOrder.forEach((cat, idx) => {
       const item = state[cat];
       if (item) {
          activeLayersCount++;
          const offset = state.offsets[cat] || {x:0, y:0};
          const scale = state.scales[cat] || DEFAULT_SCALES[cat];
          const isActive = cat === activeCategory;
          
          const style = `z-index:${idx*10}; transform: translate(${offset.x}px, ${offset.y}px) scale(${scale});`;
          html += `<img class="avatar-layer ${isActive ? 'is-active' : ''}" 
                        src="${ASSET_PATH}${cat}/${item}" 
                        style="${style}">`;
       }
    });
    
    if (activeLayersCount === 0) {
       html += `<div class="empty-state-msg">Tocca le icone in basso 👇<br>per creare il tuo avatar!</div>`;
    }
    
    comp.innerHTML = html;
  }

  function equip(cat, val) {
    state[cat] = (val === 'none') ? null : val;
    renderItemsGrid();
    renderAvatar();
  }

  // --- Interactions ---
  function adjustLayerScale(d) {
     if(!state.scales[activeCategory]) state.scales[activeCategory] = DEFAULT_SCALES[activeCategory];
     state.scales[activeCategory] = Math.max(0.1, state.scales[activeCategory] + d);
     renderAvatar();
  }

  function moveLayerOrder(dir) {
     const idx = state.layerOrder.indexOf(activeCategory);
     if (idx === -1) return;
     const newIdx = idx + dir;
     if (newIdx >= 0 && newIdx < state.layerOrder.length) {
        const t = state.layerOrder[newIdx];
        state.layerOrder[newIdx] = activeCategory;
        state.layerOrder[idx] = t;
        renderAvatar();
     }
  }

  function randomize() {
    CATEGORIES.forEach(cat => {
       if (manifest[cat]?.length) {
          if(['hair', 'hats'].includes(cat) && Math.random()>0.7) state[cat]=null;
          else state[cat] = manifest[cat][Math.floor(Math.random()*manifest[cat].length)];
          state.scales[cat] = DEFAULT_SCALES[cat];
          state.offsets[cat] = {x:0, y:0};
       }
    });
    renderAvatar();
    renderItemsGrid();
  }

  function save() {
    localStorage.setItem('badiani_user_avatar_v2_state', JSON.stringify(state));
    exportToCanvas((base64) => {
        localStorage.setItem('badiani_user_avatar', base64);
        window.dispatchEvent(new CustomEvent('avatar-updated', { detail: base64 }));
        if(window.showToast) window.showToast('Foto scattata e salvata!');
        
        // Visual feedback on button
        const btn = document.querySelector('.save-btn-round');
        if(btn) { btn.innerText = 'OK!'; setTimeout(()=>btn.innerText='SALVA', 1500); }
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
     ctx.fillRect(0,0,size,size);

     const layers = state.layerOrder.map(cat => state[cat] ? {
        src: `${ASSET_PATH}${cat}/${state[cat]}`,
        offset: state.offsets[cat] || {x:0,y:0},
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
           if(loaded === layers.length) {
              layers.forEach(layer => {
                 ctx.save();
                 ctx.translate(layer.offset.x, layer.offset.y);
                 ctx.translate(size/2, size/2);
                 ctx.scale(layer.scale, layer.scale);
                 ctx.translate(-size/2, -size/2);
                 ctx.drawImage(layer.img, 0, 0, size, size); // Draw stretched to fill? No, assume sprite is large enough
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
     if(!el) return;
     
     let isDown=false;
     let lastX=0, lastY=0;
     
     const start = (x,y) => {
        if(!state[activeCategory]) return;
        isDown=true; lastX=x; lastY=y;
        el.style.cursor='grabbing';
        // Auto close drawer on drag to see better?
        // document.getElementById('asset-drawer').classList.remove('open');
     };
     const move = (x,y) => {
        if(!isDown) return;
        const dx=x-lastX; const dy=y-lastY;
        lastX=x; lastY=y;
        state.offsets[activeCategory].x += dx;
        state.offsets[activeCategory].y += dy;
        requestAnimationFrame(renderAvatar);
     };
     const end = () => { isDown=false; el.style.cursor='grab'; };

     el.addEventListener('mousedown', e => { e.preventDefault(); start(e.clientX, e.clientY); });
     window.addEventListener('mousemove', e => move(e.clientX, e.clientY));
     window.addEventListener('mouseup', end);

     el.addEventListener('touchstart', e => { e.preventDefault(); start(e.touches[0].clientX, e.touches[0].clientY); }, {passive:false});
     el.addEventListener('touchmove', e => { e.preventDefault(); move(e.touches[0].clientX, e.touches[0].clientY); }, {passive:false});
     window.addEventListener('touchend', end);
  }

  function loadState() {
     const s = localStorage.getItem('badiani_user_avatar_v2_state');
     if(s) {
       try { 
         const p = JSON.parse(s);
         state = { ...state, ...p };
         if(p.sales) state.scales = p.scales; // typo fix from old versions
       } catch {}
     }
  }

  return { init, getHTML, render: renderAvatar, setCategory, equip, randomize, save, adjustLayerScale, moveLayerOrder };
})();

