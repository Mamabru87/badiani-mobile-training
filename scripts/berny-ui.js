// FILE: scripts/berny-ui.js
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
      this.addMessage(
        tr(
          'assistant.greeting',
          null,
          'Ciao! Sono BERNY 👋🍦 Il tuo assistente per il training Badiani. Chiedimi qualsiasi cosa!'
        ),
        'berny',
        false
      );

      // Suggestions
      this.showSuggestions();

      // Event listeners
      this.sendButton.addEventListener('click', () => this.handleSend());
      this.chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.handleSend();
        }
      });

      // Input feedback (keep compatible with <input type=text>)
      this.chatInput.addEventListener('input', () => this.autoResizeInput());
    }

    handleSend() {
      const message = sanitize(this.chatInput.value);
      if (!message || this.isTyping) return;

      // If user tries to send while collapsed, open.
      if (!this.isOpen()) {
        this.setOpen(true);
      }

      const brain = window.bernyBrain;
      if (!brain || typeof brain.sendMessage !== 'function') {
        // Fallback: behave like a simple static assistant
        this.addMessage(message, 'user');
        this.chatInput.value = '';
        this.autoResizeInput();
        this.addMessage(
          tr('assistant.offlineFallback', null, 'Posso aiutarti su coni, Buontalenti, procedure e quiz. Prova a chiedermi una di queste!'),
          'berny'
        );
        return;
      }

      // Add user message
      this.addMessage(message, 'user');
      this.chatInput.value = '';
      this.autoResizeInput();

      // Typing indicator + avatar
      this.showTypingIndicator();
      this.animateAvatar('thinking');

      // Call the brain (streaming-friendly)
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

      // First chunk: remove typing indicator and create streaming bubble
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
      this.currentStreamingBubble.textContent = this.currentStreamingText;
      this.scrollToBottom(false);
    }

    handleComplete(fullResponse, source) {
      const brain = window.bernyBrain;

      // If we streamed, finalize that bubble; else show fullResponse.
      if (this.currentStreamingBubble) {
        const finalText = sanitize(fullResponse || this.currentStreamingText);
        this.currentStreamingBubble.textContent = finalText || this.currentStreamingText;
        try {
          this.currentStreamingBubble
            ?.closest?.('.berny-message')
            ?.setAttribute?.('data-berny-source', String(source || 'unknown'));
        } catch {}

        this.currentStreamingBubble = null;
        this.currentStreamingText = '';
      } else {
        this.hideTypingIndicator();
        this.addMessage(fullResponse, 'berny');
      }

      // Reset avatar
      this.animateAvatar('idle');

      // If collapsed, show unread badge
      if (!this.isOpen()) {
        this.bumpUnread();
      }

      // Suggestions
      this.showSuggestions();

      // Save conversation (best effort)
      try {
        if (brain && typeof brain.saveConversation === 'function') {
          brain.saveConversation();
        }
      } catch {}

      // Haptic feedback on mobile
      try {
        if ('vibrate' in navigator) navigator.vibrate(50);
      } catch {}
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
      if (scroll) this.scrollToBottom();

      // small fade-in hook (optional if CSS exists)
      try {
        requestAnimationFrame(() => messageEl.classList.add('is-visible'));
      } catch {}
    }

    showSuggestions() {
      const target = this.suggestionsArea || this.messagesArea;
      if (!target) return;

      // Remove old suggestions (safe for both dedicated area and inline fallback)
      try {
        if (target === this.messagesArea) {
          const oldInline = this.messagesArea.querySelector('.chat-suggestions');
          if (oldInline) oldInline.remove();
        } else {
          target.innerHTML = '';
        }
      } catch {}

      const brain = window.bernyBrain;
      const suggestions =
        brain && typeof brain.getSuggestions === 'function'
          ? brain.getSuggestions()
          : [
              tr('assistant.suggest.buontalenti', null, 'Dimmi qualcosa sul Buontalenti 🍦'),
              tr('assistant.suggest.opening', null, 'Procedura apertura negozio'),
              tr('assistant.suggest.quiz', null, 'Come funzionano i quiz?'),
            ];

      if (!Array.isArray(suggestions) || !suggestions.length) return;

      const wrap = document.createElement('div');
      wrap.className = 'chat-suggestions';

      suggestions
        .filter((s) => sanitize(s))
        .slice(0, 6)
        .forEach((s) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'suggestion-chip';
          btn.textContent = String(s);
          btn.addEventListener('click', () => {
            try {
              this.chatInput.value = String(s);
              this.chatInput.focus();
            } catch {}
            this.handleSend();
          });
          wrap.appendChild(btn);
        });

      target.appendChild(wrap);

      // Only auto-scroll when suggestions are inside the message stream.
      if (target === this.messagesArea) {
        this.scrollToBottom(false);
      }
    }

    animateAvatar(state) {
      if (!this.widget) return;
      const speed = state === 'thinking' ? 1.5 : 1;
      try {
        const players = Array.from(this.widget.querySelectorAll('lottie-player'));
        players.forEach((p) => {
          try {
            if (typeof p.setSpeed === 'function') p.setSpeed(speed);
            else p.setAttribute('speed', String(speed));
          } catch {}
        });
      } catch {}
    }

    scrollToBottom(smooth = true) {
      const scroller = this.messagesArea;
      if (!scroller) return;
      try {
        if (typeof scroller.scrollTo === 'function') {
          scroller.scrollTo({
            top: scroller.scrollHeight,
            behavior: smooth ? 'smooth' : 'auto',
          });
        } else {
          scroller.scrollTop = scroller.scrollHeight;
        }
      } catch {}
    }

    isOpen() {
      if (!this.chatWindow) return true;
      try {
        return !this.chatWindow.hasAttribute('hidden') && this.chatWindow.hidden !== true;
      } catch {
        return true;
      }
    }

    toggleWindow() {
      this.setOpen(!this.isOpen());
    }

    setOpen(open) {
      if (!this.chatWindow) return;
      try {
        if (open) this.chatWindow.removeAttribute('hidden');
        else this.chatWindow.setAttribute('hidden', '');
      } catch {}

      this.syncChrome();

      if (open) {
        try {
          this.clearUnread();
          this.chatInput?.focus?.();
        } catch {}
      }
    }

    syncChrome() {
      const open = this.isOpen();

      // Swap FAB icon / close glyph
      try {
        if (this.fabIcon) this.fabIcon.hidden = !!open;
        if (this.fabClose) this.fabClose.hidden = !open;
      } catch {}

      // ARIA
      try {
        if (this.fabButton) this.fabButton.setAttribute('aria-expanded', String(open));
      } catch {}
    }

    clearUnread() {
      if (!this.unreadBadge) return;
      try {
        this.unreadBadge.hidden = true;
        this.unreadBadge.textContent = '0';
      } catch {}
    }

    bumpUnread() {
      if (!this.unreadBadge) return;
      try {
        const current = parseInt(String(this.unreadBadge.textContent || '0'), 10);
        const next = Number.isFinite(current) ? current + 1 : 1;
        this.unreadBadge.textContent = String(Math.min(99, Math.max(1, next)));
        this.unreadBadge.hidden = false;
      } catch {}
    }

    autoResizeInput() {
      // Current markup uses <input>, so this is effectively a no-op.
      // If the input is later upgraded to <textarea>, this will just work.
      try {
        const el = this.chatInput;
        if (!el) return;
        if (String(el.tagName || '').toLowerCase() !== 'textarea') return;
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 120) + 'px';
      } catch {}
    }
  }

  window.BernyUI = BernyUI;

  const boot = () => {
    // Avoid double instances
    if (window.bernyUI) return;
    window.bernyUI = new BernyUI();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
