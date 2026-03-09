#!/bin/bash
set -e # Exit on error

echo "== Badiani legacy JS cleanup: start =="

# Safety: must run from repo root
if [ ! -f "index.html" ]; then
  echo "❌ ERRORE: esegui lo script dalla root del progetto (dove c'è index.html)"
  exit 1
fi

TS="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="backup_${TS}"

echo "STEP 1: BACKUP (dir: ${BACKUP_DIR})"
mkdir -p "${BACKUP_DIR}"
echo "✅ Creato backup dir: ${BACKUP_DIR}"

backup_file () {
  SRC="$1"
  if [ ! -f "${SRC}" ]; then
    echo "⚠️ Backup skip (file non trovato): ${SRC}"
    return 0
  fi
  mkdir -p "${BACKUP_DIR}/$(dirname "${SRC}")"
  cp -p "${SRC}" "${BACKUP_DIR}/${SRC}"
  echo "✅ Backup: ${SRC} -> ${BACKUP_DIR}/${SRC}"
}

is_referenced_in_html () {
  # Checks only root HTML pages (not notes/). Adjust if needed.
  TARGET="$1"
  if grep -Rqs -- "${TARGET}" ./*.html 2>/dev/null; then
    return 0
  fi
  return 1
}

move_legacy_js () {
  SRC="$1"
  DST="$2"

  if [ ! -f "${SRC}" ]; then
    echo "⚠️ Move skip (file non trovato): ${SRC}"
    return 0
  fi

  if [ -f "${DST}" ]; then
    echo "⚠️ Move skip (dest già esiste): ${DST}"
    return 0
  fi

  # Guard: do not move if referenced by any root HTML
  if is_referenced_in_html "${SRC}"; then
    echo "❌ BLOCCATO: trovato riferimento HTML a ${SRC}. Non sposto per sicurezza."
    echo "   Suggerimento: cerca in *.html e aggiorna i path prima di riprovare."
    exit 1
  fi

  backup_file "${SRC}"
  mkdir -p "$(dirname "${DST}")"
  mv "${SRC}" "${DST}"
  echo "✅ Spostato: ${SRC} -> ${DST}"
}

echo "STEP 2: CREA DIRECTORY TARGET"
mkdir -p "scripts/legacy"
echo "✅ Directory pronta: scripts/legacy"

echo "STEP 3: SPOSTA JS NON USATI (legacy)"
# Berny modules (not imported by HTML currently)
move_legacy_js "scripts/berny-brain-local.js" "scripts/legacy/berny-brain-local.js"
move_legacy_js "scripts/berny-brain.js" "scripts/legacy/berny-brain.js"
move_legacy_js "scripts/berny-knowledge.js" "scripts/legacy/berny-knowledge.js"
move_legacy_js "scripts/berny-nlp.js" "scripts/legacy/berny-nlp.js"
move_legacy_js "scripts/berny-ui.js" "scripts/legacy/berny-ui.js"
move_legacy_js "scripts/berny-widget-controller.js" "scripts/legacy/berny-widget-controller.js"

# Other unused JS (not imported by HTML currently)
move_legacy_js "scripts/dashboard-animations.js" "scripts/legacy/dashboard-animations.js"
move_legacy_js "scripts/learn-bubbles.js" "scripts/legacy/learn-bubbles.js"
move_legacy_js "scripts/settings-panel.js" "scripts/legacy/settings-panel.js"
move_legacy_js "scripts/storage-manager.js" "scripts/legacy/storage-manager.js"

# Translation JS artifacts (not imported by HTML currently)
move_legacy_js "scripts/quiz_translations_en.js" "scripts/legacy/quiz_translations_en.js"
move_legacy_js "scripts/quiz_translations_en_output.js" "scripts/legacy/quiz_translations_en_output.js"

echo "STEP 4: VERIFICA FINALE (runtime invariato)"
# Ensure runtime files still exist
if [ -f "scripts/i18n.js" ]; then echo "✅ OK: scripts/i18n.js"; else echo "❌ Manca: scripts/i18n.js"; exit 1; fi
if [ -f "scripts/i18n-manager.js" ]; then echo "✅ OK: scripts/i18n-manager.js"; else echo "❌ Manca: scripts/i18n-manager.js"; exit 1; fi
if [ -f "scripts/site.js" ]; then echo "✅ OK: scripts/site.js"; else echo "❌ Manca: scripts/site.js"; exit 1; fi
if [ -f "scripts/gelato-effects.js" ]; then echo "✅ OK: scripts/gelato-effects.js"; else echo "❌ Manca: scripts/gelato-effects.js"; exit 1; fi

echo "✅ Legacy JS cleanup completato."
echo "ℹ️ Rollback: ripristina i file da ${BACKUP_DIR}/ (o inverti gli mv)."
echo "== Badiani legacy JS cleanup: end =="
