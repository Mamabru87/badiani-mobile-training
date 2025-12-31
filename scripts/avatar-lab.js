
/**
 * Badiani Avatar Creator (Mini-App)
 * Gestisce la creazione, modifica e salvataggio dell'avatar utente.
 */

const AvatarLab = (() => {
  // --- Assets & Configuration ---
  const ASSETS = {
    skin: {
      vanilla: '#f3e5ab',
      hazelnut: '#d2a679',
      cacao: '#8b5a2b',
      pink: '#ffc0cb'
    },
    body: {
      tshirt: '<path d="M20 80 Q50 90 80 80 L80 100 L20 100 Z" fill="var(--brand-blue)" /><path d="M20 80 L10 90 L15 95 L25 82 Z" fill="var(--brand-blue)" /><path d="M80 80 L90 90 L85 95 L75 82 Z" fill="var(--brand-blue)" />',
      suit: '<path d="M20 80 Q50 90 80 80 L80 100 L20 100 Z" fill="#333" /><path d="M50 80 L50 100" stroke="#fff" stroke-width="2" /><path d="M45 80 L50 90 L55 80 Z" fill="#e30613" />',
      apron: '<path d="M25 80 L75 80 L80 100 L20 100 Z" fill="#fff" stroke="#ccc" /><path d="M30 80 L30 60 L70 60 L70 80" fill="none" stroke="#ccc" stroke-width="2" />'
    },
    head: {
      base: '<circle cx="50" cy="50" r="30" fill="CURRENT_SKIN" />'
    },
    eyes: {
      normal: '<circle cx="40" cy="45" r="3" fill="#333" /><circle cx="60" cy="45" r="3" fill="#333" />',
      wink: '<circle cx="40" cy="45" r="3" fill="#333" /><path d="M57 45 Q60 42 63 45" stroke="#333" stroke-width="2" fill="none" />',
      surprised: '<circle cx="40" cy="45" r="4" fill="#333" /><circle cx="60" cy="45" r="4" fill="#333" />',
      sunglasses: '<path d="M35 42 L65 42 L65 50 Q60 55 55 50 L45 50 Q40 55 35 50 Z" fill="#111" /><line x1="35" y1="42" x2="30" y2="40" stroke="#111" stroke-width="1"/><line x1="65" y1="42" x2="70" y2="40" stroke="#111" stroke-width="1"/>'
    },
    mouth: {
      smile: '<path d="M40 60 Q50 70 60 60" stroke="#333" stroke-width="2" fill="none" stroke-linecap="round" />',
      laugh: '<path d="M40 60 Q50 75 60 60 Z" fill="#a00" />',
      neutral: '<line x1="42" y1="62" x2="58" y2="62" stroke="#333" stroke-width="2" stroke-linecap="round" />'
    },
    hat: {
      none: '',
      cap: '<path d="M30 35 Q50 10 70 35 L75 35 L75 38 L25 38 L25 35 Z" fill="var(--brand-blue)" />',
      beanie: '<path d="M30 35 Q50 15 70 35 L70 40 L30 40 Z" fill="var(--brand-rose)" />',
      chef: '<path d="M30 30 L30 20 Q50 5 70 20 L70 30 Z" fill="#fff" stroke="#eee" />'
    },
    accessory: {
      none: '',
      blush: '<circle cx="35" cy="55" r="3" fill="#ffaaaa" opacity="0.5" /><circle cx="65" cy="55" r="3" fill="#ffaaaa" opacity="0.5" />',
      mustache: '<path d="M40 58 Q50 50 60 58" stroke="#333" stroke-width="3" fill="none" />'
    }
  };

  // --- Expressions (Combos) ---
  const EXPRESSIONS = {
    surprised: {
      eyes: '<path d="M 30,35 A 5,5 0 1,1 40,35 A 5,5 0 1,1 30,35 M 60,35 A 5,5 0 1,1 70,35 A 5,5 0 1,1 60,35" fill="#333" />',
      mouth: '<path d="M 45,65 A 5,5 0 1,1 55,65 A 5,5 0 1,1 45,65" fill="#333" />'
    },
    proud: {
      eyes: '<path d="M 30,40 Q 35,30 40,40 M 60,40 Q 65,30 70,40" fill="none" stroke="#333" stroke-width="2" stroke-linecap="round" />',
      mouth: '<path d="M 35,60 Q 50,80 65,60 Z" fill="#a00" />'
    }
  };

  // --- State ---
  let state = {
    skin: 'vanilla',
    body: 'tshirt',
    eyes: 'normal',
    mouth: 'smile',
    hat: 'none',
    accessory: 'none'
  };
  
  let currentMood = null;
  let moodTimeout = null;

  // --- Logic ---
  function getRandomItem(obj) {
    const keys = Object.keys(obj);
    return keys[Math.floor(Math.random() * keys.length)];
  }

  function playExpression(moodName) {
    if (!EXPRESSIONS[moodName]) return;
    
    currentMood = moodName;
    render();
    
    if (moodTimeout) clearTimeout(moodTimeout);
    moodTimeout = setTimeout(() => {
      currentMood = null;
      render();
    }, 1500);
  }

  function randomize() {
    const btn = document.getElementById('btn-randomize');
    if (btn) {
      btn.classList.add('spin');
      setTimeout(() => btn.classList.remove('spin'), 600);
    }

    // Slot machine effect
    let count = 0;
    const max = 10;
    const interval = setInterval(() => {
      state.skin = getRandomItem(ASSETS.skin);
      state.body = getRandomItem(ASSETS.body);
      state.eyes = getRandomItem(ASSETS.eyes);
      state.mouth = getRandomItem(ASSETS.mouth);
      state.hat = getRandomItem(ASSETS.hat);
      state.accessory = getRandomItem(ASSETS.accessory);
      render();
      count++;
      if (count >= max) {
        clearInterval(interval);
        playSound('tick');
        // Final render with bounce
        const container = document.getElementById('avatar-preview-container');
        if (container) {
          container.classList.remove('bounce');
          void container.offsetWidth;
          container.classList.add('bounce');
        }
        playExpression('surprised');
      }
    }, 50);
  }

  function getSVG() {
    const skinColor = ASSETS.skin[state.skin] || ASSETS.skin.vanilla;
    const head = ASSETS.head.base.replace('CURRENT_SKIN', skinColor);
    
    // Determine eyes and mouth based on mood or state
    let eyesSvg = ASSETS.eyes[state.eyes];
    let mouthSvg = ASSETS.mouth[state.mouth];
    
    if (currentMood && EXPRESSIONS[currentMood]) {
      eyesSvg = EXPRESSIONS[currentMood].eyes;
      mouthSvg = EXPRESSIONS[currentMood].mouth;
    }
    
    return `
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" class="avatar-svg" style="width:100%; height:100%; overflow:visible;">
        <defs>
          <filter id="dropShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
            <feOffset dx="0" dy="2" result="offsetblur"/>
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.2"/>
            </feComponentTransfer>
            <feMerge> 
              <feMergeNode/>
              <feMergeNode in="SourceGraphic"/> 
            </feMerge>
          </filter>
        </defs>
        <g filter="url(#dropShadow)">
          ${ASSETS.body[state.body]}
          ${head}
          ${eyesSvg}
          ${mouthSvg}
          ${ASSETS.accessory[state.accessory]}
          ${ASSETS.hat[state.hat]}
        </g>
      </svg>
    `;
  }

  function render() {
    const container = document.getElementById('avatar-preview-container');
    if (container) {
      container.innerHTML = getSVG();
    }
  }

  function playSound(type) {
    // Placeholder for sound effects
    // const audio = new Audio('assets/sounds/' + type + '.mp3');
    // audio.play().catch(() => {});
  }

  function save() {
    const svg = getSVG();
    const base64 = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
    
    localStorage.setItem('badiani_user_avatar', base64);
    localStorage.setItem('badiani_user_avatar_state', JSON.stringify(state));
    
    window.dispatchEvent(new CustomEvent('avatar-updated', { detail: base64 }));
    
    const btn = document.getElementById('btn-save-avatar');
    if (btn) {
      const originalText = btn.innerHTML;
      btn.innerHTML = '✅ Indossato!';
      btn.style.background = '#10b981'; // Green
      setTimeout(() => {
        btn.innerHTML = originalText;
        btn.style.background = '';
      }, 2000);
    }

    // Flight animation
    const container = document.getElementById('avatar-preview-container');
    if (container) {
      container.classList.add('fly-away');
      setTimeout(() => {
        container.classList.remove('fly-away');
        // Close modal after flight
        const closeBtn = document.querySelector('[data-cancel-switch]');
        if (closeBtn) closeBtn.click();
      }, 800);
    }
    
    if (window.showToast) window.showToast('Nuovo look salvato!');
  }

  function loadState() {
    try {
      const savedState = localStorage.getItem('badiani_user_avatar_state');
      if (savedState) {
        state = { ...state, ...JSON.parse(savedState) };
      }
    } catch (e) {
      console.warn('Failed to load avatar state', e);
    }
  }

  // --- UI Generation ---
  function getHTML() {
    return `
      <style>
        .avatar-lab {
          display: flex;
          flex-direction: column;
          gap: 20px;
          padding: 10px;
          background: #fff;
          border-radius: 16px;
          overflow: hidden;
        }

        /* --- 1. Avatar Stage --- */
        .avatar-stage {
          position: relative;
          height: 180px;
          display: flex;
          justify-content: center;
          align-items: center;
          background: radial-gradient(circle at center, rgba(255,255,255,1) 0%, rgba(240,240,240,0) 70%);
        }
        .spotlight {
          position: absolute;
          width: 200px;
          height: 200px;
          background: radial-gradient(circle, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0) 70%);
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          z-index: 0;
          animation: pulseSpotlight 3s infinite ease-in-out;
        }
        @keyframes pulseSpotlight {
          0%, 100% { opacity: 0.6; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
        }
        .avatar-float-container {
          width: 140px;
          height: 140px;
          z-index: 1;
          animation: floatAvatar 3s ease-in-out infinite;
          cursor: pointer;
        }
        @keyframes floatAvatar {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        .platform-shadow {
          position: absolute;
          bottom: 20px;
          width: 80px;
          height: 10px;
          background: rgba(0,0,0,0.1);
          border-radius: 50%;
          z-index: 0;
          animation: shadowScale 3s ease-in-out infinite;
        }
        @keyframes shadowScale {
          0%, 100% { transform: scale(1); opacity: 0.1; }
          50% { transform: scale(0.8); opacity: 0.05; }
        }

        /* Flight Animation */
        .fly-away {
          animation: flyAway 0.8s cubic-bezier(0.55, 0.055, 0.675, 0.19) forwards !important;
        }
        @keyframes flyAway {
          0% { transform: scale(1) translate(0, 0); opacity: 1; }
          40% { transform: scale(0.8) translate(0, 20px); opacity: 1; }
          100% { transform: scale(0.1) translate(-200px, -400px); opacity: 0; }
        }

        /* --- 2. Category Scoops --- */
        .category-scoops {
          display: flex;
          justify-content: center;
          gap: 12px;
          padding-bottom: 8px;
          overflow-x: auto;
          scrollbar-width: none; /* Firefox */
        }
        .category-scoops::-webkit-scrollbar { display: none; }
        
        .scoop-btn {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          border: 2px solid transparent;
          background: #f3f4f6;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          flex-shrink: 0;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        .scoop-btn:hover {
          transform: translateY(-2px);
        }
        .scoop-btn.active {
          transform: scale(1.15);
          border-color: var(--brand-gold, #f2be58);
          box-shadow: 0 4px 12px rgba(242, 190, 88, 0.3);
          background: #fff;
          z-index: 1;
        }

        /* --- 3. Option Conveyor --- */
        .option-conveyor-belt {
          background: #f9fafb;
          border-radius: 16px;
          padding: 12px 0;
          border: 1px solid #e5e7eb;
          position: relative;
          overflow: hidden;
        }
        /* Decorative "glass" shine */
        .option-conveyor-belt::after {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0; height: 40%;
          background: linear-gradient(to bottom, rgba(255,255,255,0.8), rgba(255,255,255,0));
          pointer-events: none;
        }
        
        .conveyor-track {
          display: flex;
          gap: 16px;
          overflow-x: auto;
          padding: 0 50%; /* Center first item */
          scroll-snap-type: x mandatory;
          scrollbar-width: none;
        }
        .conveyor-track::-webkit-scrollbar { display: none; }

        .option-card {
          flex: 0 0 60px;
          height: 60px;
          scroll-snap-align: center;
          background: #fff;
          border: 2px solid #e5e7eb;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
          color: var(--brand-gray);
          cursor: pointer;
          transition: all 0.3s ease;
          opacity: 0.6;
          transform: scale(0.9);
        }
        .option-card.selected {
          border-color: var(--brand-blue);
          opacity: 1;
          transform: scale(1.1);
          box-shadow: 0 4px 10px rgba(0,0,0,0.1);
          z-index: 2;
        }
        
        /* --- 4. Color Palette (Flavor Drops) --- */
        .flavor-palette {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 12px;
          padding: 8px;
        }
        .flavor-drop {
          width: 32px;
          height: 32px;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          cursor: pointer;
          border: 2px solid rgba(0,0,0,0.05);
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          position: relative;
        }
        .flavor-drop:hover {
          transform: rotate(-45deg) scale(1.1);
        }
        .flavor-drop.selected {
          transform: rotate(-45deg) scale(1.2);
          border-color: #fff;
          box-shadow: 0 0 0 2px var(--brand-blue);
          z-index: 2;
        }
        /* Dripping animation on select */
        .flavor-drop.selected::after {
          content: '';
          position: absolute;
          bottom: -4px;
          left: 50%;
          width: 6px;
          height: 6px;
          background: inherit;
          border-radius: 50%;
          animation: drip 0.6s ease-in;
          opacity: 0;
        }
        @keyframes drip {
          0% { transform: translate(-50%, 0); opacity: 1; }
          100% { transform: translate(-50%, 15px); opacity: 0; }
        }

        /* --- 5. Actions --- */
        .avatar-actions {
          display: flex;
          gap: 12px;
          margin-top: 8px;
        }
        .magic-dice {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: #f3f4f6;
          border: none;
          font-size: 24px;
          cursor: pointer;
          transition: transform 0.5s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .magic-dice:hover {
          background: #e5e7eb;
        }
        .magic-dice.spin {
          transform: rotate(360deg);
        }

        .save-wear-btn {
          flex: 1;
          border: none;
          border-radius: 24px;
          background: linear-gradient(135deg, var(--brand-blue) 0%, var(--brand-rose) 100%);
          color: #fff;
          font-weight: 700;
          font-size: 15px;
          cursor: pointer;
          box-shadow: 0 4px 15px rgba(33, 64, 152, 0.3);
          transition: transform 0.2s, box-shadow 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .save-wear-btn:active {
          transform: scale(0.98);
        }
      </style>
      
      <div class="avatar-lab">
        <!-- 1. Stage -->
        <div class="avatar-stage">
          <div class="spotlight"></div>
          <div class="avatar-float-container" id="avatar-preview-container" title="Clicca per cambiare espressione!">
            <!-- SVG injected here -->
          </div>
          <div class="platform-shadow"></div>
        </div>
        
        <!-- 2. Category Scoops -->
        <div class="category-scoops">
          <button class="scoop-btn active" data-tab="skin" title="Pelle">🎨</button>
          <button class="scoop-btn" data-tab="hat" title="Cappelli">🧢</button>
          <button class="scoop-btn" data-tab="eyes" title="Occhi">👀</button>
          <button class="scoop-btn" data-tab="mouth" title="Bocca">👄</button>
          <button class="scoop-btn" data-tab="body" title="Vestiti">👕</button>
          <button class="scoop-btn" data-tab="accessory" title="Accessori">👓</button>
        </div>
        
        <!-- 3. Option Conveyor / Palette -->
        <div class="option-conveyor-belt" id="control-options-container">
           <!-- Injected via JS -->
        </div>

        <!-- 5. Actions -->
        <div class="avatar-actions">
          <button id="btn-randomize" class="magic-dice" title="Randomize">🎲</button>
          <button id="btn-save-avatar" class="save-wear-btn">
            <span>Indossa Divisa</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </button>
        </div>
      </div>
    `;
  }

  function renderOptions(category) {
    const container = document.getElementById('control-options-container');
    if (!container) return;
    
    container.innerHTML = '';
    const items = ASSETS[category];
    
    // Use Flavor Palette for Skin
    if (category === 'skin') {
      const palette = document.createElement('div');
      palette.className = 'flavor-palette';
      
      Object.keys(items).forEach(key => {
        const drop = document.createElement('div');
        drop.className = `flavor-drop ${state[category] === key ? 'selected' : ''}`;
        drop.style.backgroundColor = items[key];
        drop.title = key.charAt(0).toUpperCase() + key.slice(1); // Simple tooltip
        
        drop.onclick = () => {
          state[category] = key;
          render();
          renderOptions(category);
          playSound('tick');
          playExpression('proud');
        };
        palette.appendChild(drop);
      });
      container.appendChild(palette);
    } else {
      // Use Conveyor Belt for others
      const track = document.createElement('div');
      track.className = 'conveyor-track';
      
      Object.keys(items).forEach(key => {
        const card = document.createElement('button');
        card.className = `option-card ${state[category] === key ? 'selected' : ''}`;
        
        // Content logic
        card.textContent = key.charAt(0).toUpperCase() + key.slice(1);
        
        card.onclick = () => {
          state[category] = key;
          render();
          renderOptions(category);
          playSound('tick');
          
          // Trigger expressions based on category
          if (category === 'hat' || category === 'accessory') {
             playExpression('surprised');
          } else if (category === 'body') {
             playExpression('proud');
          }

          // Scroll into view logic could go here
          card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        };
        track.appendChild(card);
      });
      container.appendChild(track);
      
      // Auto-scroll to selected
      setTimeout(() => {
        const selected = track.querySelector('.selected');
        if (selected) selected.scrollIntoView({ block: 'nearest', inline: 'center' });
      }, 10);
    }
  }

  function attachListeners(container) {
    // Tabs
    container.querySelectorAll('[data-tab]').forEach(btn => {
      btn.onclick = (e) => {
        const target = e.target.closest('button');
        container.querySelectorAll('[data-tab]').forEach(b => b.classList.remove('active'));
        target.classList.add('active');
        renderOptions(target.dataset.tab);
      };
    });

    // Randomize
    const randBtn = container.querySelector('#btn-randomize');
    if (randBtn) randBtn.onclick = randomize;

    // Save
    const saveBtn = container.querySelector('#btn-save-avatar');
    if (saveBtn) saveBtn.onclick = save;
    
    // Mood click on avatar
    const preview = container.querySelector('#avatar-preview-container');
    if (preview) {
      preview.onclick = () => {
        const moods = ['smile', 'laugh', 'neutral'];
        const currentIdx = moods.indexOf(state.mouth);
        const nextIdx = (currentIdx + 1) % moods.length;
        state.mouth = moods[nextIdx];
        
        if (state.mouth === 'laugh') state.eyes = 'wink';
        else state.eyes = 'normal';
        
        render();
        playSound('squeak');
      };
    }

    // Initial options render
    renderOptions('skin');
  }

  // --- Public API ---
  return {
    init: (container) => {
      loadState();
      render();
      attachListeners(container);
    },
    getHTML,
    render
  };
})();

// --- Global Integration ---

// Listen for avatar updates to update the Hub
window.addEventListener('avatar-updated', (e) => {
  const img = document.getElementById('hub-profile-img');
  if (img) {
    img.src = e.detail;
    // Ensure it's visible and placeholder is hidden
    img.style.display = 'block';
    const parent = img.closest('.summary-profile__avatar');
    if (parent) {
      parent.classList.remove('summary-profile__avatar--placeholder');
      const placeholder = parent.querySelector('.avatar-placeholder');
      if (placeholder) placeholder.style.display = 'none';
    }
  }
});

// Check on load
document.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('badiani_user_avatar');
  if (saved) {
    // Dispatch event to update UI
    window.dispatchEvent(new CustomEvent('avatar-updated', { detail: saved }));
  }
});
