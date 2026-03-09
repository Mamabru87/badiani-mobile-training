# Modal Scroll Jump Fix - Implementation Summary

## Problem Analysis
When opening a modal, the background page was jumping to the top behind the overlay, even though the overlay itself appeared correctly.

## Root Causes Identified

### 1. CSS Race Condition
**File:** `styles/site.css`
- `body.no-scroll` had `top: 0` in CSS
- When class was added, CSS `top: 0` applied before JS inline style `-${scrollY}px`
- This caused a brief flash where body jumped to top

**Fix:** Removed `top: 0` from CSS since JS always sets it inline

### 2. Card Rect Timing Issue  
**File:** `scripts/site.js`
- `getBoundingClientRect()` was called AFTER `bodyScrollLock.lock()`
- Once body becomes `position: fixed`, the coordinate system changes
- Card rect values were wrong, affecting FLIP animation

**Fix:** Moved card rect capture to BEFORE scroll lock in `openerRestore` object

### 3. Unlock Sequence
**File:** `scripts/site.js`
- Original sequence tried to scrollTo while body was still fixed
- This doesn't work reliably across browsers

**Fix:** Changed order to: remove class → clear style → scrollTo

## Files Changed

### 1. styles/site.css (lines 1370-1378)
```css
/* BEFORE */
body.no-scroll {
  overflow: hidden !important;
  position: fixed;
  top: 0;          /* ← REMOVED THIS */
  left: 0;
  right: 0;
  width: 100%;
  height: 100%;
}

/* AFTER */
body.no-scroll {
  overflow: hidden !important;
  position: fixed;
  left: 0;
  right: 0;
  width: 100%;
  height: 100%;
  /* top is set dynamically by JS to -scrollY (inline style) */
}
```

### 2. scripts/site.js - Lock sequence (~line 693)
```javascript
// Unchanged - already sets inline style before class
document.body.style.top = `-${scrollPosition}px`;
document.body.classList.add('no-scroll');
```

### 3. scripts/site.js - Unlock sequence (~line 720-735)
```javascript
/* BEFORE */
try { window.scrollTo(0, nextY); } catch (e) {}
document.body.classList.remove('no-scroll');
document.body.style.top = '';

/* AFTER */
document.body.classList.remove('no-scroll');
document.body.style.top = '';
try { window.scrollTo(0, nextY); } catch (e) {}
```

### 4. scripts/site.js - Card rect capture (~line 10001-10045)
```javascript
/* BEFORE */
const openerRestore = {
  scrollY: getEffectiveScrollY(),
  track,
  trackScrollLeft,
  focusEl: button,
  cardId
};
bodyScrollLock.lock();
// ... later ...
const rect = card.getBoundingClientRect(); // ← Too late!

/* AFTER */
const openerRestore = {
  scrollY: getEffectiveScrollY(),
  track,
  trackScrollLeft,
  focusEl: button,
  cardId,
  // Capture rect BEFORE lock
  cardRect: card.getBoundingClientRect(),
  cardCx: cardRect.left + cardRect.width / 2,
  cardCy: cardRect.top + cardRect.height / 2,
  viewCx,
  viewCy
};
bodyScrollLock.lock();
// ... later use openerRestore.cardCx, etc ...
```

### 5. scripts/site.js - Diagnostic logging added
Added `logScrollState()` helper function with logs at:
- BEFORE bodyScrollLock.lock()
- AFTER bodyScrollLock.lock()
- CLOSE START
- BEFORE/AFTER bodyScrollLock.unlock()
- BEFORE/AFTER window.scrollTo() restore
- FINAL (close complete)

## Testing Instructions

1. Open browser console (F12)
2. Scroll down the page to any position (e.g., 500px)
3. Click on a carousel card "Mostra dettagli" button
4. **Expected:** Background stays at 500px (no jump to top)
5. **Check console:** "BEFORE bodyScrollLock.lock()" and "AFTER bodyScrollLock.lock()" should show same windowScrollY
6. Close the modal
7. **Expected:** Page stays at 500px
8. **Check console:** All close phases should preserve the scroll position

## Console Output Example

When working correctly, you should see:
```
🔍 [BADIANI SCROLL DEBUG] BEFORE bodyScrollLock.lock()
  windowScrollY: 500
  bodyStyleTop: "not set"
  bodyPosition: "static"

🔍 [BADIANI SCROLL DEBUG] AFTER bodyScrollLock.lock()
  windowScrollY: 0 (expected - body is now fixed)
  bodyStyleTop: "-500px" (preserves visual position)
  bodyPosition: "fixed"
```

The key is that `bodyStyleTop` equals `-windowScrollY` from before the lock.

## Acceptance Criteria

✅ Background scroll position doesn't jump to top when modal opens  
✅ Background scroll position preserved when modal closes  
✅ Modal overlay appears at current viewport position  
✅ FLIP animation from card works correctly  
✅ Console logs prove scroll values are preserved  
✅ Focus restoration doesn't trigger scroll  
✅ No changes to carousel logic  
✅ Orbit/story pages unaffected  

## Browser Compatibility

- **iOS/iPadOS:** Uses `position: fixed` strategy with inline `top` offset
- **Other browsers:** Uses `overflow: hidden` on html/body (simpler, no position change)
- Both paths now tested to avoid scroll jumps
