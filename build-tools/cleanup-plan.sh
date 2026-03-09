#!/bin/bash
set -e # Exit on error

echo "== Badiani cleanup: start =="

# Safety: must run from repo root (where index.html exists)
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

move_file () {
  SRC="$1"
  DST="$2"
  if [ ! -f "${SRC}" ]; then
    echo "⚠️ Move skip (file non trovato): ${SRC}"
    return 0
  fi
  # If already moved, skip
  if [ -f "${DST}" ]; then
    echo "⚠️ Move skip (dest già esiste): ${DST}"
    return 0
  fi
  backup_file "${SRC}"
  mkdir -p "$(dirname "${DST}")"
  mv "${SRC}" "${DST}"
  echo "✅ Spostato: ${SRC} -> ${DST}"
}

echo "STEP 2: CREA DIRECTORY TARGET"
mkdir -p "build-tools/python"
mkdir -p "data/quiz"
mkdir -p "scripts"
echo "✅ Directory pronte: build-tools/python, data/quiz"

echo "STEP 3: RIMOZIONI (solo se 100% sicuro)"
echo "ℹ️ Nessuna rimozione automatica: 0 file marcati '100% sicuri da eliminare'."

echo "STEP 4: SPOSTA BUILD TOOLS (Python) da scripts/ -> build-tools/python/"
move_file "scripts/audit_assets.py" "build-tools/python/audit_assets.py"
move_file "scripts/audit_i18n_cards.py" "build-tools/python/audit_i18n_cards.py"
move_file "scripts/convert_jpg_to_webp.py" "build-tools/python/convert_jpg_to_webp.py"
move_file "scripts/convert_png_to_jpg_webp.py" "build-tools/python/convert_png_to_jpg_webp.py"
move_file "scripts/convert_webp_to_jpg.py" "build-tools/python/convert_webp_to_jpg.py"
move_file "scripts/copy_kb.py" "build-tools/python/copy_kb.py"
move_file "scripts/count_veryeasy.py" "build-tools/python/count_veryeasy.py"
move_file "scripts/extract_all_pdf_text.py" "build-tools/python/extract_all_pdf_text.py"
move_file "scripts/extract_caffe_fixed.py" "build-tools/python/extract_caffe_fixed.py"
move_file "scripts/extract_pdf_text.py" "build-tools/python/extract_pdf_text.py"
move_file "scripts/generate_image_pack.py" "build-tools/python/generate_image_pack.py"
move_file "scripts/generate_placeholder_assets.py" "build-tools/python/generate_placeholder_assets.py"
move_file "scripts/generate_sm_correct.py" "build-tools/python/generate_sm_correct.py"
move_file "scripts/import_generated_images.py" "build-tools/python/import_generated_images.py"
move_file "scripts/infer_sm_correct_from_i18n.py" "build-tools/python/infer_sm_correct_from_i18n.py"
move_file "scripts/insert_french_translations.py" "build-tools/python/insert_french_translations.py"
move_file "scripts/list_pdf_images.py" "build-tools/python/list_pdf_images.py"
move_file "scripts/parse_quiz_translations.py" "build-tools/python/parse_quiz_translations.py"
move_file "scripts/parse_veryeasy_translations.py" "build-tools/python/parse_veryeasy_translations.py"
move_file "scripts/peek_pdf_pages.py" "build-tools/python/peek_pdf_pages.py"
move_file "scripts/render_pdf_images.py" "build-tools/python/render_pdf_images.py"
move_file "scripts/translate_quiz.py" "build-tools/python/translate_quiz.py"

echo "STEP 5: SPOSTA DATA FILES da scripts/ -> data/quiz/"
move_file "scripts/quiz_all_questions.json" "data/quiz/quiz_all_questions.json"
move_file "scripts/quiz_en_partial.txt" "data/quiz/quiz_en_partial.txt"
move_file "scripts/quiz_i18n_en.txt" "data/quiz/quiz_i18n_en.txt"
move_file "scripts/quiz_i18n_es.txt" "data/quiz/quiz_i18n_es.txt"
move_file "scripts/quiz_i18n_fr.txt" "data/quiz/quiz_i18n_fr.txt"
move_file "scripts/quiz_i18n_output.txt" "data/quiz/quiz_i18n_output.txt"
move_file "scripts/quiz_i18n_sm_en.txt" "data/quiz/quiz_i18n_sm_en.txt"
move_file "scripts/quiz_i18n_sm_es.txt" "data/quiz/quiz_i18n_sm_es.txt"
move_file "scripts/quiz_i18n_sm_fr.txt" "data/quiz/quiz_i18n_sm_fr.txt"

echo "STEP 6: FILE JS INCERTI (NON SPOSTO senza conferma)"
echo "⚠️ Skip: scripts/berny-*.js, scripts/storage-manager.js, scripts/settings-panel.js, scripts/quiz_translations_*.js, ecc."

echo "STEP 7: AGGIORNA .gitignore (crea se mancante)"
if [ ! -f ".gitignore" ]; then
  touch ".gitignore"
  echo "✅ Creato .gitignore"
fi

add_gitignore_line () {
  LINE="$1"
  if grep -qxF "${LINE}" ".gitignore"; then
    echo "⚠️ .gitignore già contiene: ${LINE}"
  else
    echo "${LINE}" >> ".gitignore"
    echo "✅ Aggiunto a .gitignore: ${LINE}"
  fi
}

add_gitignore_line "backup_*/"
add_gitignore_line ".venv/"
add_gitignore_line "__pycache__/"
add_gitignore_line "*.pyc"

echo "STEP 8: VERIFICA FINALE (file critici presenti)"
# JS runtime critici
if [ -f "scripts/i18n.js" ]; then echo "✅ OK: scripts/i18n.js"; else echo "❌ Manca: scripts/i18n.js"; exit 1; fi
if [ -f "scripts/i18n-manager.js" ]; then echo "✅ OK: scripts/i18n-manager.js"; else echo "❌ Manca: scripts/i18n-manager.js"; exit 1; fi
if [ -f "scripts/site.js" ]; then echo "✅ OK: scripts/site.js"; else echo "❌ Manca: scripts/site.js"; exit 1; fi
if [ -f "scripts/gelato-effects.js" ]; then echo "✅ OK: scripts/gelato-effects.js"; else echo "❌ Manca: scripts/gelato-effects.js"; exit 1; fi

# CSS critico
if [ -f "styles/site.css" ]; then echo "✅ OK: styles/site.css"; else echo "❌ Manca: styles/site.css"; exit 1; fi

echo "✅ Cleanup completato."
echo "ℹ️ Rollback: ripristina i file da ${BACKUP_DIR}/ (o inverti gli mv)."
echo "== Badiani cleanup: end =="
