// FILE: scripts/dashboard-animations.js
// Micro-animations e data visualization (dashboard hero)
// Note: this project is vanilla JS (no modules). Keep it defensive.

(() => {
  class DashboardAnimations {
    constructor() {
      this.root = document;
      this.progressRing = this.root.querySelector('[data-progress-circle]');
      this.activityBars = Array.from(this.root.querySelectorAll('.activity-bar'));
      this.starsTotalEl = this.root.querySelector('[data-perf-stars-total]');
      this.activityChartEl = this.root.querySelector('[data-activity-chart]');

      this._lastCelebratedMilestone = null;
      this._reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

      this.init();
    }

    init() {
      // Prepare card reveal animations.
      this.setupIntersectionObserver();

      // Prime activity bars animation.
      this.animateActivityBars();

      // Animate progress ring if present.
      if (this.progressRing) {
        this.animateProgressRing({ initial: true });
      }

      // Update progress ring when stars change.
      this.watchStarsUpdate();

      // Re-animate activity bars when the chart is updated.
      this.watchActivityChartUpdates();
    }

    getTotalStars() {
      const raw = this.starsTotalEl?.textContent || '0';
      const n = parseInt(String(raw).replace(/[^0-9-]/g, ''), 10);
      return Number.isFinite(n) ? n : 0;
    }

    animateProgressRing({ initial = false } = {}) {
      if (!this.progressRing) return;

      const totalStars = this.getTotalStars();
      const maxStars = 100; // Obiettivo (visual-only)
      const ratio = maxStars > 0 ? Math.max(0, Math.min(1, totalStars / maxStars)) : 0;

      const r = Number(this.progressRing.getAttribute('r')) || 50;
      const circumference = 2 * Math.PI * r;
      const targetOffset = circumference * (1 - ratio);

      // Ensure dasharray is set so dashoffset works reliably.
      this.progressRing.style.strokeDasharray = String(circumference);

      // Prime a known start state so transition can kick in.
      if (initial) {
        this.progressRing.style.strokeDashoffset = String(circumference);
      }

      const apply = () => {
        this.progressRing.style.strokeDashoffset = String(targetOffset);
      };

      if (this._reducedMotion) {
        apply();
      } else {
        // Small delay helps the browser paint the initial state first.
        window.setTimeout(() => {
          requestAnimationFrame(apply);
        }, initial ? 350 : 0);
      }

      this.celebrateMilestone(totalStars);
    }

    animateActivityBars() {
      if (!this.activityBars.length) return;

      // Read target heights (from inline CSS variable), then animate from 0.
      this.activityBars.forEach((bar, index) => {
        const computed = window.getComputedStyle(bar);
        const target = (computed.getPropertyValue('--height') || bar.style.getPropertyValue('--height') || '0%').trim() || '0%';

        // Store target so later updates can re-run.
        bar.dataset.targetHeight = target;

        // Reset to 0.
        bar.style.setProperty('--height', '0%');

        const apply = () => {
          // Use latest target (might have been updated by site.js).
          const currentTarget = (bar.dataset.targetHeight || target).trim() || '0%';
          bar.style.setProperty('--height', currentTarget);
        };

        if (this._reducedMotion) {
          apply();
        } else {
          window.setTimeout(apply, 90 * index);
        }
      });
    }

    setupIntersectionObserver() {
      const cards = Array.from(this.root.querySelectorAll('.dash-card'));
      if (!cards.length) return;

      // If reduced motion, don’t do reveal transforms.
      if (this._reducedMotion || !('IntersectionObserver' in window)) {
        return;
      }

      // Prime initial hidden state.
      cards.forEach((card) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(18px)';
      });

      const observer = new IntersectionObserver(
        (entries) => {
          entries
            .filter((e) => e.isIntersecting)
            .forEach((entry) => {
              const card = entry.target;

              // Stagger by document order for a nice cascade.
              const idx = cards.indexOf(card);
              const delay = Math.max(0, idx) * 80;

              window.setTimeout(() => {
                card.style.transition = 'opacity 600ms cubic-bezier(0.4, 0, 0.2, 1), transform 600ms cubic-bezier(0.4, 0, 0.2, 1)';
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
              }, delay);

              observer.unobserve(card);
            });
        },
        { threshold: 0.12 }
      );

      cards.forEach((card) => observer.observe(card));
    }

    watchStarsUpdate() {
      if (!this.starsTotalEl || !('MutationObserver' in window)) return;

      const observer = new MutationObserver(() => {
        this.animateProgressRing();
      });

      observer.observe(this.starsTotalEl, {
        childList: true,
        characterData: true,
        subtree: true
      });
    }

    watchActivityChartUpdates() {
      if (!this.activityChartEl || !('MutationObserver' in window)) return;

      const syncTargets = () => {
        this.activityBars = Array.from(this.root.querySelectorAll('.activity-bar'));
        this.activityBars.forEach((bar) => {
          const computed = window.getComputedStyle(bar);
          const target = (computed.getPropertyValue('--height') || bar.style.getPropertyValue('--height') || '0%').trim() || '0%';
          bar.dataset.targetHeight = target;
        });
      };

      const observer = new MutationObserver(() => {
        syncTargets();
        this.animateActivityBars();
      });

      observer.observe(this.activityChartEl, {
        attributes: true,
        attributeFilter: ['style'],
        subtree: true
      });
    }

    // Confetti effect quando raggiungi milestone (ogni 10 stelle totali)
    celebrateMilestone(stars) {
      const value = Number(stars || 0);
      if (!Number.isFinite(value) || value <= 0) return;

      const milestone = Math.floor(value / 10) * 10;
      if (milestone <= 0 || value % 10 !== 0) return;

      // Avoid repeating the same milestone confetti over and over.
      if (this._lastCelebratedMilestone === milestone) return;
      this._lastCelebratedMilestone = milestone;

      this.confettiEffect();
    }

    confettiEffect() {
      const emojis = ['⭐', '🎉', '🍦', '✨', '🎊'];

      for (let i = 0; i < 15; i += 1) {
        const confetti = document.createElement('div');
        confetti.textContent = emojis[Math.floor(Math.random() * emojis.length)];
        confetti.style.cssText = [
          'position: fixed',
          `top: ${Math.random() * 20}%`,
          `left: ${Math.random() * 100}%`,
          `font-size: ${20 + Math.random() * 18}px`,
          'pointer-events: none',
          'z-index: 10000',
          `animation: dashboardConfettiFall ${2 + Math.random()}s ease-out forwards`
        ].join(';');

        document.body.appendChild(confetti);
        window.setTimeout(() => confetti.remove(), 3200);
      }
    }
  }

  // Add confetti keyframes once.
  if (!document.querySelector('[data-dashboard-confetti-style]')) {
    const style = document.createElement('style');
    style.setAttribute('data-dashboard-confetti-style', '');
    style.textContent = `
      @keyframes dashboardConfettiFall {
        0% {
          transform: translateY(-30vh) rotate(0deg);
          opacity: 1;
        }
        100% {
          transform: translateY(110vh) rotate(720deg);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }

  const boot = () => {
    try {
      window.dashboardAnimations = new DashboardAnimations();
    } catch {
      // Never block the app if animations fail.
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
