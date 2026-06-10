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

    // ------------------------------------------------------------
    // Celebration: lightweight canvas particle burst (brand colors).
    // Public API: window.GelatoEffects.celebrate(x, y)
    // Used by the Avatar Lab on save; reusable for other celebrations.
    // ------------------------------------------------------------
    const BRAND_COLORS = ['#214098', '#ec418c', '#f2be58', '#F5F0E1', '#9d1f5d'];

    function celebrate(x, y) {
        try {
            if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
            const cx = (typeof x === 'number' && isFinite(x)) ? x : window.innerWidth / 2;
            const cy = (typeof y === 'number' && isFinite(y)) ? y : window.innerHeight / 2;

            const canvas = document.createElement('canvas');
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            canvas.width = window.innerWidth * dpr;
            canvas.height = window.innerHeight * dpr;
            canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:2147483000;';
            canvas.setAttribute('aria-hidden', 'true');
            document.body.appendChild(canvas);
            const ctx = canvas.getContext('2d');
            ctx.scale(dpr, dpr);

            const N = 42;
            const particles = [];
            for (let i = 0; i < N; i++) {
                const angle = (Math.PI * 2 * i) / N + Math.random() * 0.4;
                const speed = 3.2 + Math.random() * 4.6;
                particles.push({
                    x: cx, y: cy,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed - 2.2,
                    size: 3 + Math.random() * 5,
                    color: BRAND_COLORS[i % BRAND_COLORS.length],
                    rot: Math.random() * Math.PI,
                    vr: (Math.random() - 0.5) * 0.3,
                    shape: (i % 3 === 0) ? 'rect' : 'circle',
                    life: 1
                });
            }

            const started = performance.now();
            const DURATION = 950;

            function frame(now) {
                const t = (now - started) / DURATION;
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                if (t >= 1) {
                    canvas.remove();
                    return;
                }
                particles.forEach(p => {
                    p.x += p.vx;
                    p.y += p.vy;
                    p.vy += 0.16; // gravity
                    p.vx *= 0.985;
                    p.rot += p.vr;
                    p.life = 1 - t;
                    ctx.save();
                    ctx.globalAlpha = Math.max(0, p.life);
                    ctx.fillStyle = p.color;
                    ctx.translate(p.x, p.y);
                    ctx.rotate(p.rot);
                    if (p.shape === 'rect') {
                        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
                    } else {
                        ctx.beginPath();
                        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    ctx.restore();
                });
                requestAnimationFrame(frame);
            }
            requestAnimationFrame(frame);
        } catch (e) { /* never break the caller */ }
    }

    window.GelatoEffects = window.GelatoEffects || {};
    window.GelatoEffects.celebrate = celebrate;

    // Boot
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initGelatoObserver);
    } else {
        initGelatoObserver();
    }

})();
