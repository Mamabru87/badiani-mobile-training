# Image collisions (asset riusati)

Alcune schede condividono **lo stesso file immagine** in `assets/`.
Se vuoi davvero **un'immagine diversa per ogni scheda**, questi file vanno **sdoppiati** (nuovo filename) e poi va aggiornato l’HTML della card che deve usare la nuova immagine.

Per ora ho lasciato i filename invariati nel pack, quindi **per questi casi devi scegliere**:
- Opzione A (più veloce): tieni la stessa immagine per entrambe le schede (un solo prompt “di compromesso”).
- Opzione B (migliore): crei **due immagini diverse** con **due filename diversi** (e poi aggiorniamo l’HTML).

## Duplicati individuati

### `assets/churro-cover.jpg` (+ `assets/churro-cover.webp`)
- `festive.html` — HERO: **Seasonal**
- `festive.html` — CARD: **Impiattamento & upsell**

Suggerimento (Opzione B):
- lascia `churro-cover.*` per la cover
- crea una nuova immagine per la card, es. `assets/festive-churro-plate.*`

---

### `assets/gelato-box.jpg` (+ `assets/gelato-box.webp`)
- `gelato-lab.html` — CARD: **Gelato Boxes**
- `gelato-lab.html` — CARD: **Manutenzione**

Suggerimento (Opzione B):
- `assets/gelato-boxes.*` per “Gelato Boxes”
- `assets/gelato-maintenance-tools.*` per “Manutenzione”

---

### `assets/pandoro.jpg` (+ `assets/pandoro.webp`)
- `festive.html` — CARD: **Piatto classico**
- `festive.html` — CARD: **Opzione calda**

Suggerimento (Opzione B):
- `assets/festive-pandoro-classic.*`
- `assets/festive-pandoro-warm.*`

---

### `assets/panettone.jpg` (+ `assets/panettone.webp`)
- `festive.html` — CARD: **Taglio & presentazione**
- `festive.html` — CARD: **Slice calda**

Suggerimento (Opzione B):
- `assets/festive-panettone-cut.*`
- `assets/festive-panettone-warm-slice.*`

---

### `assets/slitti-cover.jpg` (+ `assets/slitti-cover.webp`)
- `slitti-yoyo.html` — HERO: **Slitti & Yo-Yo**
- `slitti-yoyo.html` — CARD: **Timeline essenziale**

Suggerimento (Opzione B):
- lascia `slitti-cover.*` per la cover
- crea una nuova immagine per la card, es. `assets/slitti-timeline.*`

---

### `assets/story/story-gelato.webp`
- `story-orbit.html` — STORY: **Pagina cultura del Buontalenti**
- `story-orbit.html` — STORY: **Pagina cultura del gelato Buontalenti**

Suggerimento (Opzione B):
- `assets/story/story-gelato-buontalenti.webp`
- `assets/story/story-gelato-cultura.webp`

---

### `assets/story/story-tradizione.webp`
- `story-orbit.html` — STORY: **Timeline brand history**
- `story-orbit.html` — STORY: **Pagina tradizione Badiani**

Suggerimento (Opzione B):
- `assets/story/story-timeline.webp`
- `assets/story/story-tradizione-page.webp`

---

### `assets/sweet-afternoon-tea-a.jpg` (+ `assets/sweet-afternoon-tea-a.webp`)
- `sweet-treats.html` — CARD: **Afternoon Tea Signature**
- `sweet-treats.html` — CARD: **Lab Secrets & Storage**

Suggerimento (Opzione B):
- `assets/sweet-afternoon-tea-stand.*`
- `assets/sweet-storage.*`
