#!/usr/bin/env python3
"""i18n_diff.py - Permanent consistency check for scripts/i18n.js.

Extracts the translation keys of each language block (it/en/es/fr) from
scripts/i18n.js and prints a cross-language diff:
  - per-language key counts (total / quiz / UI)
  - keys missing in each language vs the union of all languages,
    split into QUIZ keys (quiz.q.sm-* / quiz.q.tm-*) and UI keys.

NOTE: Italian quiz keys (quiz.q.sm-*/tm-*) are NOT stored inline in i18n.js:
they are loaded at runtime from the Italian quiz source files
("q&a very-easy mode -italiano.txt" / "q-a-easy-mode-italiano.txt") by
loadItalianQuizTranslations(). Missing IT quiz keys are therefore expected
and reported separately, not as errors.

Usage:  python build-tools/i18n_diff.py [--verbose]
        --verbose also lists every missing key name.
Exit code 1 if any UI key is missing in any language (quiz gaps excluded
for IT only).
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
I18N = ROOT / "scripts" / "i18n.js"
LANGS = ["it", "en", "es", "fr"]

QUIZ_RE = re.compile(r"^quiz\.q\.(sm|tm)-\d{3}\.")
# A dictionary entry key at the start of a line: 'key': or "key":
KEY_RE = re.compile(r"""^\s*(['"])((?:\\.|(?!\1).)*)\1\s*:""")
# Top-level language block opener, e.g. "    it: {"
LANG_RE = re.compile(r"^\s{1,6}(it|en|es|fr)\s*:\s*\{\s*$")


def extract_keys(text):
    keys = {lang: [] for lang in LANGS}
    current = None
    depth_at_lang = None
    depth = 0
    for lineno, line in enumerate(text.splitlines(), 1):
        if current is None:
            m = LANG_RE.match(line)
            if m:
                current = m.group(1)
                depth_at_lang = depth
                depth += line.count("{") - line.count("}")
                continue
        else:
            m = KEY_RE.match(line)
            if m:
                key = m.group(2).replace("\\'", "'").replace('\\"', '"')
                keys[current].append((key, lineno))
        depth += line.count("{") - line.count("}")
        if current is not None and depth <= depth_at_lang:
            current = None
    return keys


def is_quiz(key):
    return bool(QUIZ_RE.match(key))


def main():
    verbose = "--verbose" in sys.argv
    text = I18N.read_text(encoding="utf-8")
    raw = extract_keys(text)

    keysets = {}
    print("=== Key counts per language ===")
    for lang in LANGS:
        pairs = raw[lang]
        names = [k for k, _ in pairs]
        dupes = {k for k in names if names.count(k) > 1}
        keyset = set(names)
        keysets[lang] = keyset
        quiz = sum(1 for k in keyset if is_quiz(k))
        print(f"  {lang}: {len(keyset)} unique keys "
              f"({quiz} quiz, {len(keyset) - quiz} UI)"
              + (f"  [WARN {len(dupes)} duplicated key names]" if dupes else ""))
        if dupes and verbose:
            for d in sorted(dupes):
                print(f"      dup: {d}")

    union = set().union(*keysets.values())
    quiz_union = {k for k in union if is_quiz(k)}
    ui_union = union - quiz_union
    print(f"\n  union: {len(union)} keys ({len(quiz_union)} quiz, {len(ui_union)} UI)")

    print("\n=== Missing keys vs union ===")
    failed = False
    for lang in LANGS:
        missing = union - keysets[lang]
        miss_quiz = sorted(k for k in missing if is_quiz(k))
        miss_ui = sorted(k for k in missing if not is_quiz(k))
        note = ""
        if lang == "it" and miss_quiz:
            note = "  (IT quiz keys load at runtime from txt files: by design)"
        else:
            failed = failed or bool(miss_quiz)
        failed = failed or bool(miss_ui)
        print(f"  {lang}: missing {len(missing)} "
              f"({len(miss_quiz)} quiz, {len(miss_ui)} UI){note}")
        if miss_ui:
            shown = miss_ui if verbose else miss_ui[:40]
            for k in shown:
                print(f"      UI : {k}")
            if len(miss_ui) > len(shown):
                print(f"      ... and {len(miss_ui) - len(shown)} more UI keys")
        if miss_quiz and (verbose or lang != "it"):
            # Summarise quiz gaps by question id prefix
            qids = sorted({re.match(r"quiz\.q\.((?:sm|tm)-\d{3})\.", k).group(1)
                           for k in miss_quiz})
            print(f"      quiz question ids ({len(qids)}): "
                  + ", ".join(qids[:20])
                  + (" ..." if len(qids) > 20 else ""))

    # Suspicious keys: keys that exist in some language but look like prose
    print("\n=== Suspicious keys (look like prose, possible corruption) ===")
    susp = sorted(k for k in union
                  if (" " in k and len(k) > 60) or k.count(" ") > 8)
    if susp:
        for k in susp:
            present = [l for l in LANGS if k in keysets[l]]
            print(f"  [{','.join(present)}] {k[:100]}...")
    else:
        print("  none")

    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
