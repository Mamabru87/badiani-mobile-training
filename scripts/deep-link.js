
// ============================================================
// DEEP LINKING (Berny Smart Links)
// Handles ?q=keyword to scroll to specific cards
// ============================================================
(() => {
  const handleDeepLink = () => {
    const params = new URLSearchParams(window.location.search);
    const query = params.get('q');
    if (!query) return;

    const normalize = (s) => {
      // Keep deep-linking robust with accented titles (e.g. Crêpe, Caffè).
      return String(s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');
    };
    const rawQuery = String(query || '').trim();
    const target = normalize(rawQuery);

    // Find all cards
    const cards = Array.from(document.querySelectorAll('.guide-card'));
    
    // Strategy 1: Exact ID match (checking both raw query and normalized)
    // e.g. query="smoothie-rosso-berry" -> id="card-smoothie-rosso-berry"
    let match = document.getElementById('card-' + rawQuery) || 
          document.getElementById(rawQuery) ||
                cards.find(c => c.id && normalize(c.id).includes(target) && normalize(c.id).endsWith(target)); // stricter ID check

    // Strategy 2: Exact Title match
    if (!match) {
      match = cards.find(card => {
        const title = card.querySelector('h3')?.textContent || '';
        return normalize(title) === target;
      });
    }

    // Strategy 3: Partial match (fallback) - but prioritize title over type
    if (!match) {
      match = cards.find(card => {
        const title = card.querySelector('h3')?.textContent || '';
        return normalize(title).includes(target);
      });
    }

    // Strategy 4: Data attributes (last resort)
    if (!match) {
      match = cards.find(card => {
        const type = card.dataset.type || ''; 
        return normalize(type).includes(target);
      });
    }

    if (match) {
      console.log(`[DeepLink] Found match for "${query}":`, match);
      
      // 1. Scroll page to card (vertical)
      // We use scrollIntoView on the carousel wrapper if possible to avoid layout shifts
      const carousel = match.closest('[data-carousel]');
      if (carousel) {
        carousel.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        match.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      // 2. Scroll carousel to card (horizontal)
      // Native scrollIntoView with inline: 'center' handles horizontal scrolling in flex containers
      setTimeout(() => {
        match.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }, 500);

      // 3. Highlight effect
      // Prefer CSS-based pulse (works site-wide via site.css) and fall back to inline styles.
      try {
        match.classList.add('berny-highlight-pulse');
        setTimeout(() => {
          try { match.classList.remove('berny-highlight-pulse'); } catch {}
        }, 4500);
      } catch {
        match.style.transition = 'transform 0.5s ease, box-shadow 0.5s ease';
        const originalTransform = match.style.transform;
        match.style.transform = 'scale(1.02)';
        match.style.boxShadow = '0 0 0 4px var(--color-gold, #D4AF37)';
        setTimeout(() => {
          match.style.transform = originalTransform;
          match.style.boxShadow = '';
        }, 2000);
      }

      // 4. Open details if available
      // DISABLED per user request: "non aprirla" (do not open it)
      /*
      const toggle = match.querySelector('[data-toggle-card]');
      const details = match.querySelector('.details');
      // Only open if currently closed
      if (toggle && details && (details.hidden || details.style.display === 'none')) {
        setTimeout(() => toggle.click(), 800);
      }
      */
    } else {
      console.warn(`[DeepLink] No match found for "${query}"`);
    }
  };

  // Run after carousels are likely initialized
  if (document.readyState === 'complete') {
    setTimeout(handleDeepLink, 800);
  } else {
    window.addEventListener('load', () => setTimeout(handleDeepLink, 800));
  }
})();
