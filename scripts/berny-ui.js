// FILE: scripts/berny-ui.js
// Copia compatibile della UI legacy per BERNY.
// Interfaccia utente reattiva per BERNY
// NOTE: This project already has a Berny chat implementation in scripts/site.js.
// This UI intentionally takes over that chat when enabled.

(() => {
  // Signal to site.js that BernyUI will handle the chat.
  window.__badianiBernyUIEnabled = true;

  if (window.BernyUI || window.bernyUI) {
    return;
  }

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

  const BERNY_GREETINGS = {
    it: "Ciao! Sono BERNY 👋🍦 Il tuo assistente per il training Badiani. Chiedimi qualsiasi cosa!",
    en: "Hi! I'm BERNY 👋🍦 Your Badiani training assistant. Ask me anything!",
    es: "¡Hola! Soy BERNY 👋🍦 Tu asistente de formación Badiani. ¡Pregúntame lo que quieras!",
    fr: "Salut! Je suis BERNY 👋🍦 Ton assistant de formation Badiani. Demande-moi n'importe quoi!"
  };

  const sanitize = (value) => String(value ?? '').trim();

  class BernyUI {
    constructor() {
      this.widget = document.querySelector('[data-berny-widget]');
      this.chatWindow = this.widget?.querySelector?.('[data-chat-window]') || document.querySelector('[data-chat-window]');
      this.toggles = Array.from(this.widget?.querySelectorAll?.('[data-berny-toggle]') || document.querySelectorAll('[data-berny-toggle]'));

      this.fabButton = this.widget?.querySelector?.('.berny-fab') || null;
      this.fabIcon = this.widget?.querySelector?.('[data-fab-icon]') || null;
      this.fabClose = this.widget?.querySelector?.('[data-fab-close]') || null;
      this.unreadBadge = this.widget?.querySelector?.('[data-unread-badge]') || null;

      this.messagesArea = this.widget?.querySelector?.('[data-messages-area]') || document.querySelector('[data-messages-area]');
      this.suggestionsArea = this.widget?.querySelector?.('[data-suggestions-area]') || document.querySelector('[data-suggestions-area]');
      this.chatInput = this.widget?.querySelector?.('[data-chat-input]') || document.querySelector('[data-chat-input]');
      this.sendButton = this.widget?.querySelector?.('[data-chat-send]') || document.querySelector('[data-chat-send]');

      this.isTyping = false;
      this.currentStreamingBubble = null;
      this.currentStreamingText = '';

      this.init();
    }

    init() {
      if (!this.messagesArea || !this.chatInput || !this.sendButton) return;

      // Bind widget toggles (open/close)
      this.toggles.forEach((btn) => {
        try {
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            this.toggleWindow();
          });
        } catch {}
      });

      // Close on Escape
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isOpen()) {
          this.setOpen(false);
        }
      });

      // Ensure initial UI state
      this.syncChrome();

      // Clear placeholder
      try {
        this.messagesArea.innerHTML = '';
      } catch {}

      // Welcome message
      const currentLang = (window.BadianiI18n?.getLang?.() || 'it').toLowerCase();
      const fallbackGreeting = BERNY_GREETINGS[currentLang] || BERNY_GREETINGS['it'];

      const greetingEl = this.addMessage(
        tr(
          'assistant.greeting',
          null,
          fallbackGreeting
        ),
        'berny',
        false
      );
      if (greetingEl) greetingEl.setAttribute('data-greeting', 'true');

      // Listen for language changes
      window.addEventListener('i18nUpdated', () => {
         const el = this.messagesArea.querySelector('[data-greeting="true"] .message-bubble');
         if (el) {
             const newLang = (window.BadianiI18n?.getLang?.() || 'it').toLowerCase();
             const newFallback = BERNY_GREETINGS[newLang] || BERNY_GREETINGS['it'];
             
             el.textContent = tr(
                'assistant.greeting',
                null,
                newFallback
             );
         }
      });

      // Event listeners
      this.sendButton.addEventListener('click', () => this.handleSend());
      this.chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.handleSend();
        }
      });

      this.chatInput.addEventListener('input', () => this.autoResizeInput());
    }

    handleSend() {
      const message = sanitize(this.chatInput.value);
      if (!message) return;

      // Broadcast raw user message so other components can react (e.g. /apikey secret command).
      try {
        window.dispatchEvent(new CustomEvent('berny-user-message', { detail: { message } }));
      } catch {}

      if (this.isTyping) return;

      const brain = window.bernyBrain;
      if (!brain || typeof brain.sendMessage !== 'function') {
        this.addMessage(message, 'user');
        this.chatInput.value = '';
        this.autoResizeInput();
        this.addMessage(
          tr('assistant.offlineFallback', null, 'Posso aiutarti su coni, Buontalenti, procedure e quiz. Prova a chiedermi una di queste!'),
          'berny'
        );
        return;
      }

      this.addMessage(message, 'user');
      this.chatInput.value = '';
      this.autoResizeInput();
      this.playSynthSound('sent');

      this.showTypingIndicator();
      this.animateAvatar('thinking');

      try {
        brain.sendMessage(
          message,
          (chunk) => this.handleStreamChunk(chunk),
          (fullResponse, source) => this.handleComplete(fullResponse, source)
        );
      } catch (e) {
        console.error('BernyUI send error:', e);
        this.hideTypingIndicator();
        this.addMessage(tr('assistant.error', null, 'Oops! Ho avuto un problema tecnico 😅'), 'berny');
        this.animateAvatar('idle');
      }
    }

    showTypingIndicator() {
      this.isTyping = true;
      try {
        this.sendButton.disabled = true;
        this.chatInput.disabled = true;
      } catch {}

      const indicator = document.createElement('div');
      indicator.className = 'berny-message berny-message--typing';
      indicator.setAttribute('data-typing-indicator', '');

      const bubble = document.createElement('div');
      bubble.className = 'message-bubble message-bubble--typing';
      bubble.innerHTML = '<span class="typing-dots" aria-hidden="true"><span></span><span></span><span></span></span>';

      indicator.appendChild(bubble);
      this.messagesArea.appendChild(indicator);
      this.scrollToBottom(false);
    }

    hideTypingIndicator() {
      const indicator = this.messagesArea.querySelector('[data-typing-indicator]');
      if (indicator) indicator.remove();

      this.isTyping = false;
      try {
        this.sendButton.disabled = false;
        this.chatInput.disabled = false;
        this.chatInput.focus();
      } catch {}
    }

    handleStreamChunk(chunk) {
      const c = String(chunk ?? '');
      if (!c) return;

      if (!this.currentStreamingBubble) {
        this.hideTypingIndicator();

        const wrapper = document.createElement('div');
        wrapper.className = 'berny-message berny-message--streaming';

        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        bubble.textContent = '';

        wrapper.appendChild(bubble);
        this.messagesArea.appendChild(wrapper);

        this.currentStreamingBubble = bubble;
        this.currentStreamingText = '';
      }

      this.currentStreamingText += c;
      
      // Nascondi i tag [[LINK:...]] durante lo streaming per non mostrare codice grezzo
      const displayText = this.currentStreamingText.replace(/\[\[LINK:.*?\]\]/g, '');
      
      this.currentStreamingBubble.textContent = displayText;
      this.scrollToBottom(false);
    }

    handleComplete(fullResponse, source) {
      const brain = window.bernyBrain;

      if (this.currentStreamingBubble) {
        const finalText = sanitize(fullResponse || this.currentStreamingText);
        
        // Apply Markdown parsing and Smart Links to the final result
        this.currentStreamingBubble.innerHTML = this.parseMarkdown(finalText);
        this.detectAndAddLink(finalText, this.currentStreamingBubble);

        try {
          this.currentStreamingBubble
            ?.closest?.('.berny-message')
            ?.setAttribute?.('data-berny-source', String(source || 'unknown'));
        } catch {}

        this.currentStreamingBubble = null;
        this.currentStreamingText = '';
        this.playSynthSound('received');
      } else {
        this.hideTypingIndicator();
        // Use typeWriterEffect for non-streamed responses (e.g. fallback)
        this.typeWriterEffect(fullResponse);
        this.playSynthSound('received');
      }

      this.animateAvatar('idle');

      try {
        if (brain && typeof brain.saveConversation === 'function') {
          brain.saveConversation();
        }
      } catch {}

      try {
        if ('vibrate' in navigator) navigator.vibrate(50);
      } catch {}
    }

    // --- EFFETTO MACCHINA DA SCRIVERE (Adapted) ---
    typeWriterEffect(fullText) {
      // 1. Cerca il tag [[LINK:...]]
      let linkUrl = null;
      let cleanText = fullText;
      
      const linkMatch = fullText.match(/\[\[LINK:(.*?)\]\]/);
      if (linkMatch) {
        linkUrl = linkMatch[1]; 
        cleanText = fullText.replace(linkMatch[0], '').trim(); // Rimuovi il tag dal testo visibile
      }

      this.playSynthSound('received');

      const msgDiv = document.createElement('div');
      msgDiv.className = 'berny-message';
      const bubble = document.createElement('div');
      bubble.className = 'message-bubble';
      msgDiv.appendChild(bubble);
      this.messagesArea.appendChild(msgDiv);
      
      let i = 0;
      const speed = 90; 

      const type = () => {
        if (i < cleanText.length) {
          bubble.textContent += cleanText.charAt(i);
          i++;
          this.scrollToBottom(false);
          setTimeout(type, speed);
        } else {
          bubble.innerHTML = this.parseMarkdown(cleanText);
          
          if (linkUrl) {
            this.createLinkButton(linkUrl, bubble);
          } else {
            // Fallback se nessun link esplicito è stato trovato
            this.detectAndAddLink(cleanText, bubble);
          }
        }
      };
      
      type();
    }

    createLinkButton(url, container) {
      const btn = document.createElement('a');
      btn.href = url;
      btn.className = 'berny-link-btn';
      
      // Usa la traduzione se disponibile, altrimenti fallback
      const label = tr('assistant.openCard', null, '📖 Apri Scheda Correlata');
      btn.innerHTML = `<b>${label}</b>`;
      
      // Inline styles (preserved for compatibility)
      btn.style.display = 'inline-block';
      btn.style.marginTop = '10px';
      btn.style.padding = '5px 10px';
      btn.style.backgroundColor = '#002B5C';
      btn.style.color = 'white';
      btn.style.borderRadius = '15px';
      btn.style.textDecoration = 'none';
      btn.style.fontSize = '0.8rem';
      
      container.appendChild(document.createElement('br'));
      container.appendChild(btn);
    }

    // --- FORMATTAZIONE MARKDOWN ---
    parseMarkdown(text) {
      let html = text
        // Grassetto **text** -> <b>text</b>
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
        // Liste * item -> <br>• item
        .replace(/^\* (.*$)/gm, '<br>• $1')
        // Newlines -> <br>
        .replace(/\n/g, '<br>');
        
      return html;
    }

    // --- PULSANTE LINK INTELLIGENTE ---
    detectAndAddLink(text, container) {
      let link = null;
      let cleanText = text;

      // 1. Cerca tag esplicito [[LINK:url]] (per casi non-typewriter)
      const tagMatch = text.match(/\[\[LINK:(.*?)\]\]/);
      if (tagMatch) {
        link = tagMatch[1];
        cleanText = text.replace(tagMatch[0], '').trim();
        container.innerHTML = this.parseMarkdown(cleanText);
      } 
      // 2. Fallback: Mappa argomenti -> link
      else {
        const lower = text.toLowerCase();
        if (lower.includes('churro')) link = 'pastries.html';
        else if (lower.includes('gelato') || lower.includes('gusti')) link = 'gelato-lab.html';
        else if (lower.includes('caffè') || lower.includes('espresso')) link = 'caffe.html';
        else if (lower.includes('crepes') || lower.includes('waffle')) link = 'sweet-treats.html';
      }

      if (link) {
        this.createLinkButton(link, container);
      }
    }

    addMessage(text, sender, scroll = true) {
      const cleaned = sanitize(text);
      if (!cleaned) return;

      let messageEl;
      if (sender === 'user') {
        messageEl = document.createElement('div');
        messageEl.className = 'user-message';
        const bubble = document.createElement('div');
        bubble.className = 'user-bubble';
        bubble.textContent = cleaned;
        messageEl.appendChild(bubble);
      } else {
        messageEl = document.createElement('div');
        messageEl.className = 'berny-message';
        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        bubble.textContent = cleaned;
        messageEl.appendChild(bubble);
      }

      this.messagesArea.appendChild(messageEl);
      if (scroll) this.scrollToBottom(false);
      return messageEl;
    }

    scrollToBottom(smooth) {
      try {
        const scroller = this.messagesArea.closest('.chat-body');
        if (!scroller) return;
        if (smooth) scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' });
        else scroller.scrollTop = scroller.scrollHeight;
      } catch {}
    }

    autoResizeInput() {
      // Keep compatible with <input>; noop.
    }

    // The widget chrome is optional on pages that just embed the chat.
    syncChrome() {}

    isOpen() {
      try {
        return this.chatWindow?.classList?.contains('is-open');
      } catch {
        return false;
      }
    }

    setOpen(_open) {}

    toggleWindow() {
      this.playSynthSound('open');
    }

    bumpUnread() {}

    playSynthSound(type) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;

      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;

      if (type === 'open') {
        // Suono "POP" (Frequenza che sale veloce)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
      } 
      else if (type === 'sent') {
        // Suono "SWOOSH/CLICK" (Rumore bianco breve o tono basso)
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.linearRampToValueAtTime(100, now + 0.1);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
      } 
      else if (type === 'received') {
        // Suono "DING" (Campanella armonica)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now); // La5
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
        
        // Armonica (opzionale, per renderlo più dolce)
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.frequency.setValueAtTime(1760, now);
        gain2.gain.setValueAtTime(0.05, now);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc2.start(now);
        osc2.stop(now + 0.4);
      }
    }

    animateAvatar(_state) {
      // site.js avatar handles its own thinking state; noop here.
    }
  }

  window.BernyUI = BernyUI;

  // Auto-init (Wait for DOM & i18n)
  const startBerny = () => {
    try {
      if (window.bernyUI) return;
      window.bernyUI = new BernyUI();
    } catch (e) {
      console.error("BernyUI init failed:", e);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startBerny);
  } else {
    startBerny();
  }
})();
