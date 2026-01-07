(function() {
    // Gelato Effects: Fluid Animation & Sound
    // Adds a "creamy" feel to the cockpit carousel

    // Sound: Soft "Pop" (Bubble)
    function playGelatoPop() {
        // Silenziato per evitare suoni involontari
        return;
    }

    // Sound: Soft "Whoosh" (Slide)
    function playGelatoSlide() {
        // Silenziato
        return;
    }

    // IMPORTANT:
    // The main carousel system in `scripts/site.js` already handles focus and transforms.
    // On mobile, an additional IntersectionObserver that sets inline transforms/opacity
    // causes visible flicker (two systems fight each other). Keep gelato-effects
    // lightweight: sounds only.
    function initGelatoObserver() {
        const track = document.querySelector('[data-carousel="cockpit"] .carousel-track');
        if (!track) return;

        // Scroll Interaction for Sound
        let isScrolling;
        let lastScrollX = track.scrollLeft;

        track.addEventListener('scroll', () => {
            // Nessun suono su scroll (slide/pop disabilitati)
            const currentScrollX = track.scrollLeft;
            lastScrollX = currentScrollX;

            window.clearTimeout(isScrolling);
            isScrolling = setTimeout(() => {
                // silenziato
            }, 120);
        }, { passive: true });

        // Disabilita feedback click sulle card del cockpit
        track.querySelectorAll('.btn, .stat').forEach(btn => {
            btn.addEventListener('click', () => {
                // nessun suono
            });
        });
    }

    // Boot
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initGelatoObserver);
    } else {
        initGelatoObserver();
    }

})();
