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
      const greetingEl = this.addMessage(
        tr(
          'assistant.greeting',
          null,
          'Ciao! Sono BERNY 👋🍦 Il tuo assistente per il training Badiani. Chiedimi qualsiasi cosa!'
        ),
        'berny',
        false
      );
      if (greetingEl) greetingEl.setAttribute('data-greeting', 'true');

      // Listen for language changes
      window.addEventListener('i18nUpdated', () => {
         const el = this.messagesArea.querySelector('[data-greeting="true"] .message-bubble');
         if (el) {
             el.textContent = tr(
                'assistant.greeting',
                null,
                'Ciao! Sono BERNY 👋🍦 Il tuo assistente per il training Badiani. Chiedimi qualsiasi cosa!'
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
      this.currentStreamingBubble.textContent = this.currentStreamingText;
      this.scrollToBottom(false);
    }

    handleComplete(fullResponse, source) {
      const brain = window.bernyBrain;

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

    toggleWindow() {}

    bumpUnread() {}

    animateAvatar(_state) {
      // site.js avatar handles its own thinking state; noop here.
    }
  }

  window.BernyUI = BernyUI;

  // Auto-init
  try {
    if (window.bernyUI) return;
    window.bernyUI = new BernyUI();
  } catch {}
})();
