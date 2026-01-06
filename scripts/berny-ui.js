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
      this.messageCompleted = false; // Flag per prevenire doppi puntini

      // Track last user message so fallback link inference can use real intent.
      this.lastUserMessage = '';

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

      // Reset the completion flag for the new message
      this.messageCompleted = false;

      // Keep the latest user intent for coherent link inference.
      this.lastUserMessage = message;

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

      // Non chiamiamo più showTypingIndicator() qui perché handleStreamChunk()
      // creerà la bolla con puntini quando arriva il primo chunk
      this.animateAvatar('thinking');

      try {
        brain.sendMessage(
          message,
          (chunk) => this.handleStreamChunk(chunk),
          (fullResponse, source) => this.handleComplete(fullResponse, source)
        );
      } catch (e) {
        console.error('BernyUI send error:', e);
        this.addMessage(tr('assistant.error', null, 'Oops! Ho avuto un problema tecnico 😅'), 'berny');
        this.animateAvatar('idle');
      }
    }

    showTypingIndicator() {
      console.log('🔵 showTypingIndicator() chiamato');
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

      // Se il messaggio è già stato completato, ignora chunk aggiuntivi
      if (this.messageCompleted) {
        console.log('ℹ️ Chunk ricevuto dopo completamento, ignorato');
        return;
      }

      // Se non c'è ancora una bolla, crea il contenitore per i puntini di caricamento
      if (!this.currentStreamingBubble) {
        console.log('🆕 Creazione nuova bolla in handleStreamChunk');
        this.hideTypingIndicator();

        const wrapper = document.createElement('div');
        wrapper.className = 'berny-message berny-message--streaming';

        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        bubble.textContent = ''; // Inizialmente vuoto

        wrapper.appendChild(bubble);
        this.messagesArea.appendChild(wrapper);

        this.currentStreamingBubble = bubble;
        this.currentStreamingText = '';
        
        // Mostra puntini di caricamento mentre accumula il testo
        this.showTypingIndicatorInBubble(bubble);
      }

      // Accumula il testo e mostra progressivamente per effetto "typing"
      this.currentStreamingText += c;
      if (this.currentStreamingBubble) {
        this.currentStreamingBubble.textContent = this.currentStreamingText;
      }
      this.scrollToBottom(false);
    }

    // Helper: mostra puntini nella bolla per indicare che sta elaborando
    showTypingIndicatorInBubble(bubble) {
      console.log('🟢 showTypingIndicatorInBubble() chiamato');
      if (!bubble) return;
      const dots = document.createElement('span');
      dots.className = 'typing-dots';
      // Span vuoti senza contenuto testuale, il CSS crea i pallini visivi
      dots.innerHTML = '<span></span><span></span><span></span>';
      bubble.innerHTML = '';
      bubble.appendChild(dots);
    }

    async handleComplete(fullResponse, source) {
      const brain = window.bernyBrain;

      if (this.currentStreamingBubble) {
        // Usa SEMPRE fullResponse perché contiene il testo completo dal brain
        // currentStreamingText potrebbe essere incompleto a causa dei setTimeout asincroni
        let finalText = sanitize(fullResponse);
        console.log('📝 handleComplete - Full response:', finalText);
        console.log('📏 Lunghezza testo ricevuto:', finalText.length, 'caratteri');

        // Se sembra troncato, chiedi al brain di completare la risposta prima di renderizzarla
        if (brain && typeof brain.looksTruncatedAnswer === 'function' && typeof brain.continueFromPartial === 'function') {
          try {
            if (brain.looksTruncatedAnswer(finalText)) {
              const continued = await brain.continueFromPartial(this.lastUserMessage || '', finalText);
              if (continued && continued !== finalText) {
                console.log('✅ Continuation ottenuta, nuova lunghezza:', continued.length);
                finalText = sanitize(continued);
              }
            }
          } catch (e) {
            console.warn('⚠️ Continuation fallback failed', e);
          }
        }

        // Estrai link e testo pulito
        const { cleanText: rawClean, link, links, suppressLink } = this.resolveLinkData(finalText);
        console.log('🔗 Resolved links:', { link, links, suppressLink });
        console.log('📄 Clean text dopo resolveLinkData:', rawClean);
        console.log('📏 Lunghezza clean text:', rawClean.length, 'caratteri');

        // Deduplica frasi consecutive identiche e rimuovi ellissi iniziali
        const dedupeSentences = (text) => {
          if (!text) return text;
          const sentences = text.split(/(?<=[.!?])\s+/);
          const cleaned = [];
          sentences.forEach((s) => {
            const t = s.replace(/^\.{2,}\s*/, '').trim();
            if (!t) return;
            if (cleaned.length === 0 || cleaned[cleaned.length - 1].toLowerCase() !== t.toLowerCase()) {
              cleaned.push(t);
            }
          });
          return cleaned.join(' ');
        };

        let cleanText = dedupeSentences(rawClean);

        // Se dopo la pulizia sembra ancora troncato, prova un secondo tentativo di continuation
        if (brain && typeof brain.looksTruncatedAnswer === 'function' && typeof brain.continueFromPartial === 'function') {
          try {
            if (brain.looksTruncatedAnswer(cleanText)) {
              const continued2 = await brain.continueFromPartial(this.lastUserMessage || '', cleanText);
              if (continued2 && continued2 !== cleanText) {
                console.log('✅ Continuation (post-clean) ottenuta, nuova lunghezza:', continued2.length);
                cleanText = dedupeSentences(continued2);
              }
            }
          } catch (e) {
            console.warn('⚠️ Continuation fallback (post-clean) failed', e);
          }
        }

        // Svuota la bolla e riconstruisci con testo formattato + link
        this.currentStreamingBubble.innerHTML = '';
        
        // Applica markdown al testo principale
        const parsedHtml = this.parseMarkdown(cleanText);
        console.log('🎨 HTML dopo parseMarkdown:', parsedHtml);
        console.log('📏 Lunghezza HTML:', parsedHtml.length, 'caratteri');
        this.currentStreamingBubble.innerHTML = parsedHtml;

        // Comandi speciali
        this.detectAndRunCommand(finalText);

        // Aggiungi i link direttamente nella stessa bolla (non in messaggio separato)
        if (!suppressLink) {
          if (links && Array.isArray(links) && links.length > 0) {
            // Link multipli
            console.log('🎨 Creating multiple links:', links);
            links.forEach((linkObj) => {
              if (linkObj && linkObj.url) {
                const label = linkObj.label || tr('assistant.openCard', null, '📖 Apri Scheda Correlata');
                console.log('➕ Adding link:', { url: linkObj.url, label });
                this.createLinkButton(linkObj.url, this.currentStreamingBubble, label);
              }
            });
          } else if (link) {
            // Link singolo
            this.createLinkButton(link, this.currentStreamingBubble);
          } else {
            // Inferenza link
            const inferred = this.inferLinkFromContext(cleanText);
            if (inferred) this.createLinkButton(inferred, this.currentStreamingBubble);
          }
        }

        try {
          this.currentStreamingBubble
            ?.closest?.('.berny-message')
            ?.setAttribute?.('data-berny-source', String(source || 'unknown'));
        } catch {}

        this.currentStreamingBubble = null;
        this.currentStreamingText = '';
        this.messageCompleted = true; // Marca il messaggio come completato
        this.playSynthSound('received');
        this.scrollToBottom(true);
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
      const { cleanText, link, suppressLink, command } = this.resolveLinkData(fullText);

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

          if (!suppressLink) {
            const finalLink = link || this.inferLinkFromContext(cleanText);
            if (finalLink) this.enqueueLinkMessage(finalLink);
          }

          if (command) {
            this.runCommand(command);
          }
        }
      };
      
      type();
    }

    createLinkButton(url, container, customLabel = null) {
      // FIX: Prevent links to Hub (index.html) as requested by user
      // "non deve mai collegarti allo hub tramite il pulsante"
      if (!url || url === 'index.html' || url === './index.html' || url === '/') {
          return;
      }

      const btn = document.createElement('a');
      btn.href = url;
      btn.className = 'berny-link-btn';

      // Force reload if same page to trigger site.js deep-link logic
      btn.addEventListener('click', (e) => {
        try {
          const targetUrl = new URL(url, window.location.origin);
          if (targetUrl.pathname === window.location.pathname || 
             (targetUrl.pathname.endsWith('index.html') && window.location.pathname.endsWith('/')) ||
             (targetUrl.pathname === '/' && window.location.pathname.endsWith('index.html'))) {
            e.preventDefault();
            window.location.href = url;
            // Small delay then reload if href change didn't trigger it
            setTimeout(() => window.location.reload(), 100);
          }
        } catch (err) {
          console.error("Berny link error:", err);
        }
      });
      
      // Usa il label personalizzato, altrimenti la traduzione predefinita
      const label = customLabel || tr('assistant.openCard', null, '📖 Apri Scheda Correlata');
      btn.textContent = label;
      
      // Inline styles (preserved for compatibility)
      btn.style.display = 'inline-block';
      btn.style.marginTop = '10px';
      btn.style.padding = '8px 14px'; // Slightly larger
      btn.style.backgroundColor = '#ec418c'; // Brand Rose (Brighter)
      btn.style.color = 'white';
      btn.style.borderRadius = '20px'; // More rounded
      btn.style.textDecoration = 'none';
      btn.style.fontSize = '0.9rem'; // Slightly larger
      btn.style.fontWeight = '600'; // Bold via style instead of tag
      btn.style.boxShadow = '0 4px 10px rgba(236, 65, 140, 0.3)'; // Soft shadow
      
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

    // --- COMANDI SPECIALI ---
    detectAndRunCommand(text) {
      const cmdMatch = text.match(/\[\[CMD:(.*?)\]\]/);
      if (cmdMatch) {
        this.runCommand(cmdMatch[1]);
      }
    }

    runCommand(commandName) {
      console.log("🤖 Berny Command:", commandName);
      const brain = window.bernyBrain;
      
      if (commandName === 'trigger_gelato_reward') {
        if (brain && typeof brain.triggerGelatoReward === 'function') {
          brain.triggerGelatoReward();
        } else {
          console.warn("Function triggerGelatoReward not found on bernyBrain");
        }
      }
    }

    // --- PULSANTE LINK INTELLIGENTE ---
    detectAndAddLink(text, container) {
      const { cleanText, link, links, suppressLink } = this.resolveLinkData(text, true);
      if (cleanText !== text) {
        container.innerHTML = this.parseMarkdown(cleanText);
      }
      
      // Se ci sono link multipli, creali tutti
      if (!suppressLink && links && Array.isArray(links) && links.length > 0) {
        links.forEach((linkObj) => {
          if (linkObj && linkObj.url) {
            const label = linkObj.label || tr('assistant.openCard', null, '📖 Apri Scheda Correlata');
            this.createLinkButton(linkObj.url, container, label);
          }
        });
      } else if (!suppressLink && link) {
        // Link singolo
        this.createLinkButton(link, container);
      } else if (!suppressLink && !link && !links) {
        // Inferenza
        const inferred = this.inferLinkFromContext(cleanText);
        if (inferred) this.createLinkButton(inferred, container);
      }
    }

    // Nuovo helper: estrae testo pulito, link/links (esplicito o nulla) e flag NOLINK. Se `forSameBubble` è true, rimuove CMD e LINK dal testo visibile.
    resolveLinkData(rawText, forSameBubble = false) {
      let cleanText = rawText || '';
      let link = null;
      let links = null; // Nuovo: array di link multipli
      let command = null;
      let suppressLink = false;

      if (cleanText.includes('[[NOLINK]]')) {
        suppressLink = true;
        cleanText = cleanText.replace('[[NOLINK]]', '').trim();
      }

      // Controlla prima per link multipli [[LINKS:[...]]], robust anche con virgole e spazi
      const multiMatch = cleanText.match(/\[\[LINKS:([\s\S]*?)\]\]/);
      if (multiMatch) {
        const rawPayload = (multiMatch[1] || '').trim();
        try {
          const normalized = rawPayload.replace(/\s+/g, ' ');
          const jsonStr = normalized.startsWith('[') ? normalized : `[${normalized}]`;
          console.log('🔗 Parsing LINKS JSON:', jsonStr);
          links = JSON.parse(jsonStr);
          console.log('✅ Parsed links:', links);
        } catch (e) {
          // Non bloccare il rendering: se il JSON è sporco, ignora i link e prosegui
          links = null;
          console.warn('⚠️ LINKS tag ignorato per parse fallita');
        }
        // Rimuovi SEMPRE il tag dal testo per non troncare le frasi
        cleanText = cleanText.replace(multiMatch[0], '').trim();
      }

      // Se non ci sono link multipli, controlla per link singolo
      if (!links) {
        const singleMatch = cleanText.match(/\[\[LINK:([\s\S]*?)\]\]/);
        if (singleMatch) {
          link = (singleMatch[1] || '').trim();
          // Rimuovi comunque il tag dal testo
          cleanText = cleanText.replace(singleMatch[0], '').trim();
        }
      }

      // Fallback: rimuovi eventuali tag residui malformati e parentesi vaganti
      cleanText = cleanText
        .replace(/\[\[LINKS:[^\]]*\]\]/g, '')
        .replace(/\[\[LINK:[^\]]*\]\]/g, '')
        .replace(/\s*\]\s*/g, ' ') // parentesi quadre residue
        .replace(/\s*\[\s*/g, ' ') // parentesi quadre residue
        .replace(/\s{2,}/g, ' ')    // spazi doppi
        .trim();

      const cmdMatch = cleanText.match(/\[\[CMD:(.*?)\]\]/);
      if (cmdMatch) {
        command = cmdMatch[1];
        if (forSameBubble) {
          cleanText = cleanText.replace(cmdMatch[0], '').trim();
        }
      }

      // Se non c'è link esplicito, nessun comando da togliere e non è soppresso, ci pensa l'inferenza dopo
      return { cleanText, link, links, suppressLink, command };
    }

    // Inferenza link coerente con la logica del brain, senza mutare il testo
    inferLinkFromContext(cleanText) {
      let link = null;
      try {
        const brain = window.bernyBrain;
        if (brain && typeof brain.inferRecommendationFromContext === 'function') {
          const reco = brain.inferRecommendationFromContext(this.lastUserMessage || '', cleanText || '', { allowWeak: false });
          if (reco && reco.href) link = reco.href;
        } else if (brain && typeof brain.inferRecommendationFromMessage === 'function') {
          const reco = brain.inferRecommendationFromMessage(this.lastUserMessage || cleanText || '');
          if (reco && reco.href) link = reco.href;
        }
      } catch {}

      if (!link) {
        const lower = (cleanText || '').toLowerCase();
        if (lower.includes('story orbit') || lower.includes('story-orbit') || (lower.includes('firenze') && lower.includes('origine'))) {
          link = 'story-orbit.html?q=story';
        } else if (lower.includes('churro')) link = 'festive.html?q=churro';
        else if (lower.includes('waffle')) link = 'sweet-treats.html?q=waffle';
        else if (lower.includes('pancake')) link = 'sweet-treats.html?q=pancake';
        else if (lower.includes('gelato')) link = 'gelato-lab.html?q=gusti';
        else if (lower.includes('espresso')) link = 'caffe.html?q=espresso';
      }

      return link;
    }

    // Mostra i puntini, aspetta un attimo, poi crea un messaggio dedicato con il link
    enqueueLinkMessage(linkUrl) {
      if (!linkUrl) return;
      // NON mostriamo più l'indicatore qui per evitare puntini doppi
      // this.showTypingIndicator();
      setTimeout(() => {
        // this.hideTypingIndicator();
        const msgDiv = document.createElement('div');
        msgDiv.className = 'berny-message';
        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        msgDiv.appendChild(bubble);
        this.messagesArea.appendChild(msgDiv);
        this.createLinkButton(linkUrl, bubble);
        this.scrollToBottom(false);
      }, 650); // leggero ritardo per dare l'idea che "sta pensando al link"
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
