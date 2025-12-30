// FILE: scripts/berny-widget-controller.js
// Minimal controller wrapper (copied from legacy) to avoid missing includes.

(() => {
  if (window.BernyWidgetController || window.bernyWidgetController) return;

  class BernyWidgetController {
    constructor() {
      this.widget = document.querySelector('[data-berny-widget]');
      this.fabButton = this.widget?.querySelector?.('.berny-fab') || document.querySelector('.berny-fab');

      // In pages without the widget chrome, do nothing.
      if (!this.widget && !this.fabButton) return;

      this.init();
    }

    init() {
      try {
        const visitedKey = 'berny-visited';
        if (!localStorage.getItem(visitedKey)) {
          localStorage.setItem(visitedKey, '1');
        }
      } catch {}

      try {
        this.fabButton?.addEventListener?.('click', (e) => {
          e.preventDefault();
          if (window.bernyUI && typeof window.bernyUI.isOpen === 'function' && window.bernyUI.isOpen()) {
            window.bernyUI.setOpen(false);
          } else {
            window.bernyUI?.setOpen?.(true);
          }
        });
      } catch {}

      try {
        if (window.bernyUI && typeof window.bernyUI.bumpUnread === 'function') {
          window.bernyUI.bumpUnread();
        }
      } catch {}
    }
  }

  window.BernyWidgetController = BernyWidgetController;

  try {
    if (window.bernyWidgetController) return;
    window.bernyWidgetController = new BernyWidgetController();
  } catch {}
})();
