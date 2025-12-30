// FILE: scripts/berny-widget-controller.js
// Welcome + badge helper for the floating widget.
//
// IMPORTANT:
// - The actual open/close logic is handled by scripts/berny-ui.js.
// - This controller intentionally avoids attaching click handlers to avoid double-toggling.

(() => {
  if (window.BernyWidgetController || window.bernyWidgetController) return;

  class BernyWidgetController {
    constructor() {
      this.widget = document.querySelector('[data-berny-widget]');
      this.fabButton = this.widget?.querySelector?.('.berny-fab') || document.querySelector('.berny-fab');

      this.init();
    }

    init() {
      if (!this.widget || !this.fabButton) return;

      // First visit: after 3 seconds pulse the FAB and show an unread badge.
      try {
        const visitedKey = 'berny-visited';
        const hasVisited = !!localStorage.getItem(visitedKey);
        if (!hasVisited) {
          window.setTimeout(() => {
            this.showWelcome();
            try {
              localStorage.setItem(visitedKey, 'true');
            } catch {}
          }, 3000);
        }
      } catch {
        // localStorage may be blocked; ignore.
      }
    }

    showWelcome() {
      // Pulse the FAB to attract attention.
      try {
        // Restart animation reliably.
        this.fabButton.style.animation = 'none';
        // Force reflow.
        // eslint-disable-next-line no-unused-expressions
        this.fabButton.offsetHeight;
        this.fabButton.style.animation = 'welcomePulse 1s ease 3';
      } catch {}

      // Show an unread badge without opening the widget.
      try {
        if (window.bernyUI && typeof window.bernyUI.isOpen === 'function' && window.bernyUI.isOpen()) {
          return;
        }
        if (window.bernyUI && typeof window.bernyUI.bumpUnread === 'function') {
          window.bernyUI.bumpUnread();
        }
      } catch {}
    }
  }

  window.BernyWidgetController = BernyWidgetController;

  const boot = () => {
    if (window.bernyWidgetController) return;
    window.bernyWidgetController = new BernyWidgetController();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
