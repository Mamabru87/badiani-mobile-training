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

  const BERNY_GREETINGS_WITH_NAME = {
    it: (name) => `Ciao ${name}! Sono BERNY 👋🍦 Il tuo assistente per il training Badiani. Chiedimi qualsiasi cosa!`,
    en: (name) => `Hi ${name}! I'm BERNY 👋🍦 Your Badiani training assistant. Ask me anything!`,
    es: (name) => `¡Hola ${name}! Soy BERNY 👋🍦 Tu asistente de formación Badiani. ¡Pregúntame lo que quieras!`,
    fr: (name) => `Salut ${name}! Je suis BERNY 👋🍦 Ton assistant de formation Badiani. Demande-moi n'importe quoi!`,
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
      this.currentStreamingTextEl = null;
      this.currentStreamingActionsEl = null;
      this.currentStreamingDotsEl = null;
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
      const nickname = String(window.BadianiProfile?.getActive?.()?.nickname || '').trim();
      const fallbackGreeting = nickname
        ? (BERNY_GREETINGS_WITH_NAME[currentLang] ? BERNY_GREETINGS_WITH_NAME[currentLang](nickname) : (BERNY_GREETINGS_WITH_NAME['it'](nickname)))
        : (BERNY_GREETINGS[currentLang] || BERNY_GREETINGS['it']);

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
           const nickname = String(window.BadianiProfile?.getActive?.()?.nickname || '').trim();
           const newFallback = nickname
            ? (BERNY_GREETINGS_WITH_NAME[newLang] ? BERNY_GREETINGS_WITH_NAME[newLang](nickname) : (BERNY_GREETINGS_WITH_NAME['it'](nickname)))
            : (BERNY_GREETINGS[newLang] || BERNY_GREETINGS['it']);
             
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

      // Show the classic 3-dots immediately (as on first question).
      // handleStreamChunk() will replace this indicator with the streaming bubble on first chunk.
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
        // Keep a stable structure to avoid the “refresh” effect.
        const textEl = document.createElement('div');
        textEl.className = 'message-text';
        // While streaming, keep line breaks readable (e.g. story snippets / markdown).
        textEl.style.whiteSpace = 'pre-wrap';

        const actionsEl = document.createElement('div');
        actionsEl.className = 'message-actions';

        const dots = document.createElement('span');
        dots.className = 'typing-dots';
        dots.innerHTML = '<span></span><span></span><span></span>';

        bubble.appendChild(textEl);
        bubble.appendChild(actionsEl);
        bubble.appendChild(dots);

        wrapper.appendChild(bubble);
        this.messagesArea.appendChild(wrapper);

        this.currentStreamingBubble = bubble;
        this.currentStreamingText = '';
        this.currentStreamingTextEl = textEl;
        this.currentStreamingActionsEl = actionsEl;
        this.currentStreamingDotsEl = dots;
      }

      // Accumula il testo e mostra progressivamente per effetto "typing"
      this.currentStreamingText += c;
      if (this.currentStreamingTextEl) {
        this.currentStreamingTextEl.textContent = this.stripControlTagsForStreaming(this.currentStreamingText);
      }
      this.scrollToBottom(false);
    }

    // During streaming, never show raw control tags (they look like “links that disappear”).
    stripControlTagsForStreaming(text) {
      let t = String(text || '');
      // Remove fully-formed tags.
      // Use a closing matcher that won't stop early on "]]]" (LINKS tags include a JSON array that ends with "]").
      t = t.replace(/\[\[(?:LINKS|LINK|CMD):[\s\S]*?\]\](?!\])/g, '');
      t = t.replace(/\[\[NOLINK\]\]/g, '');
      // If an opening tag started but didn't close yet, strip it to the end.
      t = t.replace(/\[\[(?:LINKS|LINK|CMD):[\s\S]*$/g, '');
      return t;
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
        const finalText = sanitize(fullResponse);

        // Estrai link e testo pulito
        const { cleanText: rawClean, link, links, suppressLink } = this.resolveLinkData(finalText);
        // NOTE: La continuazione (anti-troncamento) viene già gestita dal brain (proxy/SDK).
        // Farla anche qui causa lentezza e spesso duplicazioni (es. ripetizioni dopo "...").
        const cleanForDisplay = (text) => {
          let t = String(text || '').trim();
          if (!t) return t;

          // Normalizza puntini di sospensione: evita "..." incollati alle parole.
          t = t.replace(/\s*\.{3,}\s*/g, ' … ');
          t = t.replace(/\s*…\s*/g, ' … ');
          t = t.replace(/\s{2,}/g, ' ').trim();

          // Rimuovi ellissi iniziali e piccoli artefatti.
          t = t.replace(/^(?:…\s*)+/g, '').trim();

          // Deduplica frasi consecutive identiche (case-insensitive).
          const sentences = t.split(/(?<=[.!?])\s+/);
          const cleaned = [];
          for (const s of sentences) {
            const ss = String(s || '').trim();
            if (!ss) continue;
            const key = ss.toLowerCase();
            if (!cleaned.length || cleaned[cleaned.length - 1].toLowerCase() !== key) cleaned.push(ss);
          }
          return cleaned.join(' ').trim();
        };

        const cleanText = cleanForDisplay(rawClean);

        const bubble = this.currentStreamingBubble;
        const textEl = this.currentStreamingTextEl || bubble.querySelector('.message-text');
        const actionsEl = this.currentStreamingActionsEl || bubble.querySelector('.message-actions');

        // Applica markdown al testo principale (without tearing down the bubble)
        const parsedHtml = this.parseMarkdown(cleanText);
        if (textEl) {
          // Final render uses HTML; default white-space is handled by CSS.
          try { textEl.style.whiteSpace = ''; } catch {}
          textEl.innerHTML = parsedHtml;
        }

        // Comandi speciali
        this.detectAndRunCommand(finalText);

        // IMPORTANT UX RULE:
        // - Never reveal link buttons while BERNY is typing.
        // - Keep the main message bubble synthetic.
        // - Reveal buttons in a separate follow-up assistant bubble after a short “thinking” delay.
        let actionLinks = [];
        if (!suppressLink) {
          if (links && Array.isArray(links) && links.length > 0) {
            actionLinks = links
              .map((obj) => {
                const targetUrl = obj && (obj.url || obj.href);
                if (!targetUrl) return null;
                return {
                  url: targetUrl,
                  label: obj.label || tr('assistant.openCard', null, '📖 Apri Scheda Correlata'),
                };
              })
              .filter(Boolean);
          } else if (link) {
            actionLinks = [{ url: link, label: tr('assistant.openCard', null, '📖 Apri Scheda Correlata') }];
          } else {
            const inferred = this.inferLinkFromContext(cleanText);
            if (inferred) actionLinks = [{ url: inferred, label: tr('assistant.openCard', null, '📖 Apri Scheda Correlata') }];
          }
        }

        // Safety cap: max 3 buttons.
        if (actionLinks.length > 3) actionLinks = actionLinks.slice(0, 3);

        // Remove typing dots once final content is rendered.
        try { this.currentStreamingDotsEl?.remove?.(); } catch {}

        // Clear any actions container in the main bubble (we're going to show actions in a separate message).
        try { if (actionsEl) actionsEl.innerHTML = ''; } catch {}

        try {
          this.currentStreamingBubble
            ?.closest?.('.berny-message')
            ?.setAttribute?.('data-berny-source', String(source || 'unknown'));
        } catch {}

        this.currentStreamingBubble = null;
        this.currentStreamingText = '';
        this.currentStreamingTextEl = null;
        this.currentStreamingActionsEl = null;
        this.currentStreamingDotsEl = null;
        this.messageCompleted = true; // Marca il messaggio come completato
        this.playSynthSound('received');
        this.scrollToBottom(true);

        // Reveal actions in a separate follow-up bubble (with a short typing dots phase).
        if (actionLinks && Array.isArray(actionLinks) && actionLinks.length > 0) {
          this.enqueueActionsMessage(actionLinks);
        }
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
      btn.style.marginRight = '8px';
      btn.style.padding = '8px 14px'; // Slightly larger
      btn.style.backgroundColor = '#ec418c'; // Brand Rose (Brighter)
      btn.style.color = 'white';
      btn.style.borderRadius = '20px'; // More rounded
      btn.style.textDecoration = 'none';
      btn.style.fontSize = '0.9rem'; // Slightly larger
      btn.style.fontWeight = '600'; // Bold via style instead of tag
      btn.style.boxShadow = '0 4px 10px rgba(236, 65, 140, 0.3)'; // Soft shadow
      
      const isActions = !!(container && container.classList && container.classList.contains('message-actions'));
      if (!isActions) container.appendChild(document.createElement('br'));
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
          const targetUrl = linkObj && (linkObj.url || linkObj.href);
          if (targetUrl) {
            const label = linkObj.label || tr('assistant.openCard', null, '📖 Apri Scheda Correlata');
            this.createLinkButton(targetUrl, container, label);
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

      // Controlla prima per link multipli [[LINKS:...]]
      // There can be more than one tag (model-provided + our injected). Try all and keep the first parsable one.
      // IMPORTANT: Our LINKS tag often ends with "]]]" (array close "]" + tag close "]]"),
      // so match the closing "]]" that is NOT followed by another "]".
      const linksMatches = Array.from(cleanText.matchAll(/\[\[LINKS:([\s\S]*?)\]\](?!\])/g));
      if (linksMatches.length) {
        for (const m of linksMatches) {
          const rawPayload = (m[1] || '').trim();
          const normalized = rawPayload.replace(/\s+/g, ' ').trim();
          const candidate = normalized.startsWith('[') ? normalized : `[${normalized}]`;
          try {
            console.log('🔗 Parsing LINKS JSON:', candidate);
            links = JSON.parse(candidate);
            console.log('✅ Parsed links:', links);
            break;
          } catch (e1) {
            // Salvage attempt: extract the first JSON array in the payload.
            try {
              const start = candidate.indexOf('[');
              const end = candidate.lastIndexOf(']');
              if (start >= 0 && end > start) {
                const sliced = candidate.slice(start, end + 1);
                console.log('🧩 Salvage LINKS JSON:', sliced);
                links = JSON.parse(sliced);
                console.log('✅ Parsed links (salvaged):', links);
                break;
              }
            } catch (e2) {
              // keep trying next tag
            }
          }
        }

        // Remove ALL LINKS tags from visible text (even if parsing failed).
        cleanText = cleanText.replace(/\[\[LINKS:[\s\S]*?\]\](?!\])/g, '').trim();
        if (!links) {
          console.warn('⚠️ LINKS tag ignorato per parse fallita');
        }
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

      // Fallback: rimuovi eventuali tag residui malformati (ma NON distruggere parentesi quadre normali nel testo).
      cleanText = cleanText
        .replace(/\[\[(?:LINKS|LINK|CMD):[\s\S]*?\]\]/g, '')
        .replace(/\[\[NOLINK\]\]/g, '')
        .replace(/\s{2,}/g, ' ')
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
        } else if (lower.includes('churro')) link = 'festive.html?q=churros';
        else if (lower.includes('waffle')) link = 'sweet-treats.html?q=waffles';
        else if (lower.includes('pancake')) link = 'sweet-treats.html?q=pancake';
        else if (lower.includes('gelato')) link = 'gelato-lab.html?q=cups';
        else if (lower.includes('espresso')) link = 'caffe.html?q=espresso-single';
      }

      return link;
    }

    // Mostra i puntini, aspetta un attimo, poi crea un messaggio dedicato con il link
    enqueueLinkMessage(linkUrl) {
      if (!linkUrl) return;
      this.enqueueActionsMessage([{ url: linkUrl, label: tr('assistant.openCard', null, '📖 Apri Scheda Correlata') }]);
    }

    // Show a dedicated follow-up assistant bubble that first displays typing dots,
    // then reveals one or more action buttons.
    enqueueActionsMessage(actionLinks, delayMs = 650) {
      const links = Array.isArray(actionLinks) ? actionLinks.filter(Boolean) : [];
      if (!links.length) return;

      const msgDiv = document.createElement('div');
      msgDiv.className = 'berny-message berny-message--actions';

      const bubble = document.createElement('div');
      bubble.className = 'message-bubble message-bubble--typing';

      const dots = document.createElement('span');
      dots.className = 'typing-dots';
      dots.innerHTML = '<span></span><span></span><span></span>';
      bubble.appendChild(dots);

      msgDiv.appendChild(bubble);
      this.messagesArea.appendChild(msgDiv);
      this.scrollToBottom(false);

      window.setTimeout(() => {
        try {
          bubble.className = 'message-bubble';
          bubble.innerHTML = '';

          const actions = document.createElement('div');
          actions.className = 'message-actions';
          // Make multiple CTAs clearly visible (wrap + spacing).
          actions.style.display = 'flex';
          actions.style.flexWrap = 'wrap';
          actions.style.gap = '8px';
          actions.style.alignItems = 'flex-start';
          bubble.appendChild(actions);

          links.forEach((l) => {
            const targetUrl = l && (l.url || l.href);
            if (!targetUrl) return;
            const label = l.label || tr('assistant.openCard', null, '📖 Apri Scheda Correlata');
            this.createLinkButton(targetUrl, actions, label);
          });

          this.scrollToBottom(false);
        } catch {}
      }, Math.max(0, Number(delayMs) || 0));
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
      // Reuse the shared audio engine (single AudioContext) to avoid lag/volume issues on mobile.
      if (!window.__badianiUserGesture) return;
      const api = window.BadianiAudio;
      const ctx = api?.getContext?.({ requireGesture: true }) || null;
      if (!ctx) return;
      try { api?.ensureGraph?.(ctx); } catch {}
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const out = api?.getOutput?.(ctx) || ctx.destination;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(out);

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
        gain2.connect(out);
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
