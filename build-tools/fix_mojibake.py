"""Fix mojibake (U+FFFD) in root HTML files via context-aware regex rules."""
from __future__ import annotations

import argparse
import re
from pathlib import Path

R = "\ufffd"
IC = re.IGNORECASE

RULES: list[tuple[str, str, str, int]] = [
    # Language labels
    (rf"Espa{R}ol", "Español", "Espa<?>ol -> Español", 0),
    (rf"Fran{R}ais", "Français", "Fran<?>ais -> Français", 0),

    # -ità nouns
    (rf"qualit{R}", "qualità", "qualit<?> -> qualità", IC),
    (rf"quantit{R}", "quantità", "quantit<?> -> quantità", IC),
    (rf"umidit{R}", "umidità", "umidit<?> -> umidità", IC),
    (rf"velocit{R}", "velocità", "velocit<?> -> velocità", IC),
    (rf"sommit{R}", "sommità", "sommit<?> -> sommità", IC),
    (rf"stabilit{R}", "stabilità", "stabilit<?> -> stabilità", IC),
    (rf"novit{R}", "novità", "novit<?> -> novità", IC),
    (rf"specialit{R}", "specialità", "specialit<?> -> specialità", IC),
    (rf"variet{R}", "varietà", "variet<?> -> varietà", IC),
    (rf"identit{R}", "identità", "identit<?> -> identità", IC),
    (rf"curiosit{R}", "curiosità", "curiosit<?> -> curiosità", IC),
    (rf"integrit{R}", "integrità", "integrit<?> -> integrità", IC),
    (rf"visibilit{R}", "visibilità", "visibilit<?> -> visibilità", IC),
    (rf"cremosit{R}", "cremosità", "cremosit<?> -> cremosità", IC),
    (rf"realt{R}", "realtà", "realt<?> -> realtà", IC),

    # Common Italian accented words
    (rf"\bpi{R}", "più", "pi<?> -> più", IC),
    (rf"\bCos{R}", "Così", "Cos<?> -> Così", 0),
    (rf"\bcos{R}", "così", "cos<?> -> così", 0),
    (rf"\bfinch{R}", "finché", "finch<?> -> finché", IC),
    (rf"\bperch{R}", "perché", "perch<?> -> perché", IC),
    (rf"\bcaff{R}", "caffè", "caff<?> -> caffè", IC),
    (rf"drag{R}e", "dragée", "drag<?>e -> dragée", IC),
    (rf"\bgi{R}(?=\W|$)", "già", "gi<?> -> già", IC),
    (rf"\bmet{R}(?=\W|$)", "metà", "met<?> -> metà", IC),
    (rf"\bci{R}(?=\W|$)", "ciò", "ci<?> -> ciò", IC),
    (rf"\bverr{R}", "verrà", "verr<?> -> verrà", IC),
    (rf"\bsar{R}", "sarà", "sar<?> -> sarà", IC),
    (rf"\bandr{R}", "andrà", "andrà", IC),
    (rf"\bl{R}\.", "lì.", "l<?>. -> lì.", 0),
    (rf"\bmen{R}(?=\W|$)", "menù", "men<?> -> menù", IC),

    # c'è
    (rf"c'{R}(?=\W|$)", "c'è", "c'<?> -> c'è", 0),

    # è inside parentheses: ( <?> word -> ( è word
    (rf"\({R}\s", "(è ", "(<?>space -> (è ", 0),

    # Apostrophe inside words
    (rf"\b([nlsdNLSD][aeiouAEIOU]?l?l?){R}([aeiouhAEIOUH])", r"\1'\2",
     "n/l/s/d + vowels <?>vowel -> apostrophe", 0),

    # Tè
    (rf"\bT{R}(?=\W|$)", "Tè", "T<?> -> Tè", 0),
    (rf"\bt{R}(?=\W|$)", "tè", "t<?> -> tè", 0),

    # Degrees Celsius
    (rf"(\d)\s?{R}\s?C\b", r"\1°C", "<num><?>C -> <num>°C", 0),

    # Number range
    (rf"(\d){R}(\d)", r"\1-\2", "<num><?><num> -> <num>-<num>", 0),

    # Numbered step bullet
    (rf"(<span>\s*\d{{1,2}})\s{R}\s", r"\1 · ",
     "<span>N <?> -> <span>N · ", 0),

    # Empty placeholder leftover
    (rf">\s*{R}\s*<", r"><", "><?>< -> ><", 0),

    # Ellipsis before closing quote
    (rf"([A-Za-zÀ-ÿ]){R}([\"'])", r"\1…\2", "word<?>quote -> word…quote", 0),

    # Curly quote pair
    (rf"{R}([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\- ]{{1,40}}?){R}", "\u201C\\1\u201D",
     "<?>word<?> -> curly", 0),

    # Bullet between category terms
    (rf"\s{R}\s(?=(Setting|Dati|Storage|Chiusura|Shelf|Colomba|Cioccolata|Pomeriggio|2025|Forms|Monthly|Audit|Temperature|FIFO|Apertura|Setup|Panettoni|Drinks)\b)",
     " · ", "category sep", 0),
    (rf"(Apertura|Setup|Panettoni|Drinks|Coffee & Drinks)\s{R}\s", r"\1 · ",
     "trailing category sep", 0),

    # Generic separator
    (rf"\s{R}\s", " · ", "remaining space <?> space", 0),

    # --- JS extension rules ---
    # French accented words
    (rf"cr{R}pe", "crêpe", "cr<?>pe -> crêpe", IC),
    (rf"r{R}f{R}rence", "référence", "r<?>f<?>rence -> référence", IC),
    (rf"recommand{R}e", "recommandée", "recommand<?>e -> recommandée", IC),
    # Spanish accented words
    (rf"\bm{R}s\b", "más", "m<?>s -> más", 0),
    (rf"{R}(tiempo|potencia|cu[aá]nto|cu[aá]l|qu[eé]|c[oó]mo|d[oó]nde|gramos|grados|temperatura)", r"¿\1", "Spanish opener", IC),
    # Italian leftovers
    (rf"\bL{R}\s", "Lì ", "L<?>space -> Lì ", 0),
    (rf"modalit{R}", "modalità", "modalit<?> -> modalità", IC),
    (rf"\bcose{R}", "cose,", "cose<?> -> cose,", 0),
    (rf"\binvece{R}", "invece,", "invece<?> -> invece,", 0),
    (rf"\bartistiche{R}", "artistiche,", "artistiche<?> -> artistiche,", 0),
    # Smart quotes around ${...} template literals
    (rf"{R}(\$\{{[^}}]+\}}){R}", "\u201C\\1\u201D", "<?>${var}<?> -> curly", 0),
    # Smart-quote leftovers around words (single side, before/after punctuation)
    (rf"{R}(Chiusura|Crêpe|Cr{R}pe|panna|crepe)", "\u201C\\1", "open quote", 0),
    (rf"(rapida|rapide|montata|spegnere|finita){R}", "\\1\u201D", "close quote", 0),
    # Degrees lowercase
    (rf"(?<![A-Za-z]){R}c\b", "°c", "<?>c -> °c", 0),
    (rf"(\d)\s?{R}\s?c\b", r"\1°c", "<num><?>c -> <num>°c", 0),
    # Italian accented regex char-classes: àèéìòù sequence (6 letters)
    (rf"{R}-{R}{R}-{R}{R}", "à-èé-ìòù", "regex it1", 0),
    (rf"{R}{R}-{R}-{R}{R}", "àè-é-ìòù", "regex it2", 0),
    (rf"{R}{R}{R}-{R}-{R}", "àèé-ì-òù", "regex it3", 0),
    # Generic 5-FFFD inside char classes (after specific patterns) -> àèéìòù
    (rf"{R}{R}{R}{R}{R}{R}", "àèéìòù", "regex it generic 6", 0),
    (rf"{R}{R}{R}{R}{R}", "àèéìò", "regex it generic 5", 0),
    # More Italian leftovers
    (rf"\bPriorit{R}", "Priorità", "Priorit<?> -> Priorità", 0),
    (rf"\bOnest{R}", "Onestà", "Onest<?> -> Onestà", 0),
    (rf"\ball{R}(?=[aeiouAEIOU])", "all'", "all<?>vowel -> all'", 0),
    (rf"\}}\s?{R}\s?C\b", "}°C", "}<?>C -> }°C", 0),
    (rf"\(\s?{R}\s?(\d)", r"(€\1", "(<?>num -> (€num", 0),
    (rf"\bC'{R}\s", "C'è ", "C'<?>space -> C'è ", 0),
    (rf"'{R}\s", "'È ", "'<?>space -> 'È ", 0),
    # More Italian
    (rf"\bpriorit{R}", "priorità", "priorit<?> -> priorità", 0),
    (rf"\bcitt{R}", "città", "citt<?> -> città", IC),
    (rf"\bpu{R}(?=\W|$)", "può", "pu<?> -> può", IC),
    (rf"\bun{R}(?=[aeiouAEIOU])", "un'", "un<?>vowel -> un'", 0),
    (rf"\bl{R}(?=[\s\.,;:])", "lì", "l<?> -> lì", 0),
    (rf"com'{R}", "com'è", "com'<?> -> com'è", 0),
    # French
    (rf"\bTrouv{R}\b", "Trouvé", "Trouv<?> -> Trouvé", 0),
    (rf"\bint{R}rieur", "intérieur", "int<?>rieur -> intérieur", IC),
    (rf"\bO{R}\s", "Où ", "O<?>space -> Où ", 0),
    # Spanish
    (rf"\bMu{R}strame", "Muéstrame", "Mu<?>strame -> Muéstrame", 0),
    (rf"{R}D{R}nde", "¿Dónde", "<?>D<?>nde -> ¿Dónde", 0),
    (rf"{R}C{R}mo", "¿Cómo", "<?>C<?>mo -> ¿Cómo", 0),
    # Smart quotes around phrases (broader: allow + ? digits inside)
    (rf"{R}([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9\- +?]{{1,40}}?){R}", "\u201C\\1\u201D", "<?>phrase<?> -> curly broad", 0),
]


def apply_rules(text: str) -> tuple[str, list[tuple[str, int]]]:
    stats: list[tuple[str, int]] = []
    for pat, repl, desc, flags in RULES:
        new_text, n = re.subn(pat, repl, text, flags=flags)
        if n:
            stats.append((desc, n))
            text = new_text
    return text, stats


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--root", default=".")
    args = ap.parse_args()

    root = Path(args.root)
    files = sorted(list(root.glob("*.html")) + [root / 'scripts/site.js', root / 'scripts/berny-super-knowledge.js'])
    files = [f for f in files if f.exists()]
    grand_total = 0
    for p in files:
        original = p.read_text(encoding="utf-8", errors="replace")
        if R not in original:
            continue
        before = original.count(R)
        new_text, stats = apply_rules(original)
        after = new_text.count(R)
        fixed = before - after
        grand_total += fixed
        print(f"\n[{p.name}] before={before} after={after} fixed={fixed}")
        for desc, n in stats:
            print(f"   {n:4d}  {desc}")
        if after:
            for m in re.finditer(R, new_text):
                i = m.start()
                ctx = new_text[max(0, i - 25):i] + "<?>" + new_text[i + 1:i + 25]
                ctx = ctx.replace("\n", " ").replace(R, "<?>")
                print(f"   REMAINING ctx: {ctx!r}")
        if args.apply and fixed > 0:
            p.write_text(new_text, encoding="utf-8")
            print(f"   WROTE {p.name}")

    print(f"\nGRAND TOTAL fixed: {grand_total}")
    if not args.apply:
        print("\n(dry-run -- re-run with --apply to write)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
