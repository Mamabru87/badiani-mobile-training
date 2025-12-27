(function() {
    // Gelato Effects: Fluid Animation & Sound
    // Adds a "creamy" feel to the cockpit carousel

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    let audioCtx;

    // Initialize Audio Context on first interaction
    function initAudio() {
        if (!audioCtx) {
            audioCtx = new AudioContext();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    }

    // Sound: Soft "Pop" (Bubble)
    function playGelatoPop() {
        if (!audioCtx) return;
        
        const t = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        // Bubble sound: Sine wave sweeping up quickly
        osc.type = 'sine';
        osc.frequency.setValueAtTime(200, t);
        osc.frequency.exponentialRampToValueAtTime(400, t + 0.1);
        
        // Envelope: Attack -> Decay
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.15, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

        osc.start(t);
        osc.stop(t + 0.3);
    }

    // Sound: Soft "Whoosh" (Slide)
    function playGelatoSlide() {
        if (!audioCtx) return;

        const t = audioCtx.currentTime;
        const noiseBuffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.2, audioCtx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < noiseBuffer.length; i++) {
            output[i] = Math.random() * 2 - 1;
        }

        const noise = audioCtx.createBufferSource();
        noise.buffer = noiseBuffer;
        
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(400, t);
        filter.frequency.linearRampToValueAtTime(100, t + 0.2);

        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.05, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);

        noise.start(t);
    }

    // IMPORTANT:
    // The main carousel system in `scripts/site.js` already handles focus and transforms.
    // On mobile, an additional IntersectionObserver that sets inline transforms/opacity
    // causes visible flicker (two systems fight each other). Keep gelato-effects
    // lightweight: sounds only.
    function initGelatoObserver() {
        const track = document.querySelector('.cockpit-track');
        if (!track) return;

        // On touch devices, avoid extra work and avoid any risk of scroll jank.
        const isCoarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
        if (isCoarse) return;

        // Scroll Interaction for Sound
        let isScrolling;
        let lastScrollX = track.scrollLeft;

        track.addEventListener('scroll', () => {
            initAudio();

            // Detect significant movement for optional "slide" sound
            const currentScrollX = track.scrollLeft;
            if (Math.abs(currentScrollX - lastScrollX) > 50) {
                // playGelatoSlide(); // Optional; keep disabled to avoid noise.
                lastScrollX = currentScrollX;
            }

            window.clearTimeout(isScrolling);
            isScrolling = setTimeout(() => {
                playGelatoPop();
            }, 120);
        }, { passive: true });

        // Add click feedback to buttons inside cards
        track.querySelectorAll('.btn, .stat').forEach(btn => {
            btn.addEventListener('click', () => {
                initAudio();
                playGelatoPop();
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
