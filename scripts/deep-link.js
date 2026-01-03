
// ============================================================
// DEEP LINKING (Berny Smart Links)
// Handles ?q=keyword to scroll to specific cards
// ============================================================
(() => {
  const handleDeepLink = () => {
    const params = new URLSearchParams(window.location.search);
    const query = params.get('q');
    if (!query) return;

    const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const target = normalize(query);

    // Find all cards
    const cards = Array.from(document.querySelectorAll('.guide-card'));
    
    // Find best match (Title or content)
    const match = cards.find(card => {
      const title = card.querySelector('h3')?.textContent || '';
      // Also check data attributes if present
      const type = card.dataset.type || ''; 
      return normalize(title).includes(target) || normalize(type).includes(target);
    });

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
      match.style.transition = 'transform 0.5s ease, box-shadow 0.5s ease';
      const originalTransform = match.style.transform;
      match.style.transform = 'scale(1.02)';
      match.style.boxShadow = '0 0 0 4px var(--color-gold, #D4AF37)';
      
      setTimeout(() => {
        match.style.transform = originalTransform;
        match.style.boxShadow = '';
      }, 2000);

      // 4. Open details if available
      const toggle = match.querySelector('[data-toggle-card]');
      const details = match.querySelector('.details');
      // Only open if currently closed
      if (toggle && details && (details.hidden || details.style.display === 'none')) {
        setTimeout(() => toggle.click(), 800);
      }
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
