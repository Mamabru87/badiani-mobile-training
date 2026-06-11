#!/usr/bin/env python3
"""Genera le 9 pagine HTML in root da template condivisi + contenuti per pagina.

Sorgenti (tutte in build-tools/):
  templates/*.html   partial condivisi (head, nav, drawer, switcher lingue, skip link)
  content/<p>.html   contenuto specifico della pagina, con direttive {{> partial}}
  pages.json         per ogni pagina: file content e variabili ({{PAGE_TITLE}}, ...)

Sintassi:
  {{> nome-partial}}  su riga propria -> sostituita con i byte esatti del partial
  {{NOME_VAR}}        -> sostituita con il valore in pages.json (piu' {{VERSION}})

VERSION (cache busting ?v=YYYYMMDD_NN) viene rilevata automaticamente come la
massima presente negli HTML in root + sw.js (stessa logica di bump_version.py),
quindi `bump_version.py` resta invariato e continua a operare sugli HTML
generati: dopo un bump, una rigenerazione produce la stessa versione.
Override esplicito: --set-version 20260610_21

Uso:
  python build-tools/build_pages.py            # rigenera le 9 pagine in root
  python build-tools/build_pages.py --check    # confronta senza scrivere (exit 1 se divergono)
  python build-tools/build_pages.py --root PATH [--set-version VER]

NB byte-exact: i partial vengono inseriti senza aggiungere/togliere whitespace;
alcuni file root non terminano con newline (stato storico committato): i content
riproducono esattamente quei byte. Non riformattare i partial a mano senza
poi rigenerare e ripassare lo smoke test.
"""

import argparse
import json
import re
import sys
from pathlib import Path

INCLUDE_RE = re.compile(r"^[ \t]*\{\{>\s*([\w-]+)\s*\}\}[ \t]*$", re.MULTILINE)
VAR_RE = re.compile(r"\{\{([A-Z][A-Z0-9_]*)\}\}")
HTML_VERSION_RE = re.compile(r"\?v=(\d{8}_\d{2})")
SW_VERSION_RE = re.compile(r"badiani-v2-(\d{8})-(\d{2})")


def read(path: Path) -> str:
    with open(path, encoding="utf-8", newline="") as fh:
        return fh.read()


def write(path: Path, text: str):
    with open(path, "w", encoding="utf-8", newline="") as fh:
        fh.write(text)


def detect_version(root: Path, page_names) -> str:
    versions = set()
    for name in page_names:
        f = root / name
        if f.exists():
            versions.update(HTML_VERSION_RE.findall(read(f)))
    sw = root / "sw.js"
    if sw.exists():
        for m in SW_VERSION_RE.finditer(read(sw)):
            versions.add(f"{m.group(1)}_{m.group(2)}")
    if not versions:
        raise SystemExit("Impossibile rilevare la versione ?v= dagli HTML/sw.js: usa --set-version")
    return max(versions)


def expand_includes(text: str, partials: dict, page: str) -> str:
    def repl(m):
        name = m.group(1)
        if name not in partials:
            raise SystemExit(f"[{page}] partial sconosciuto: {{{{> {name}}}}} (atteso in build-tools/templates/)")
        # il partial porta con se' newline finale (o la sua assenza): la riga
        # direttiva viene sostituita integralmente, senza newline aggiunto.
        return partials[name]

    # sostituzione manuale per controllare il newline della riga direttiva
    out = []
    pos = 0
    for m in INCLUDE_RE.finditer(text):
        start, end = m.span()
        if end < len(text) and text[end] == "\n":
            end += 1  # consuma il newline della riga direttiva
        out.append(text[pos:start])
        out.append(repl(m))
        pos = end
    out.append(text[pos:])
    return "".join(out)


def render(page: str, cfg: dict, partials: dict, content_dir: Path, version: str) -> str:
    content = read(content_dir / cfg.get("content", page))
    text = expand_includes(content, partials, page)
    variables = dict(cfg.get("vars") or {})
    variables["VERSION"] = version
    def var_repl(m):
        name = m.group(1)
        if name not in variables:
            raise SystemExit(f"[{page}] variabile non definita in pages.json: {{{{{name}}}}}")
        return variables[name]
    text = VAR_RE.sub(var_repl, text)
    leftover = INCLUDE_RE.search(text)
    if leftover:
        raise SystemExit(f"[{page}] direttiva non risolta: {leftover.group(0)!r}")
    return text


def main(argv=None):
    parser = argparse.ArgumentParser(description="Genera le pagine HTML root dai template.")
    parser.add_argument("--check", action="store_true",
                        help="non scrive: confronta con i file in root, exit 1 se divergono")
    parser.add_argument("--root", type=Path, default=None,
                        help="root del progetto (default: cartella padre di build-tools)")
    parser.add_argument("--set-version", default=None, metavar="YYYYMMDD_NN",
                        help="forza la versione cache-busting invece di rilevarla dagli HTML")
    args = parser.parse_args(argv)

    here = Path(__file__).resolve().parent
    root = (args.root or here.parent).resolve()
    tpl_dir = here / "templates"
    content_dir = here / "content"

    config = json.loads(read(here / "pages.json"))
    pages = config["pages"]

    partials = {p.stem: read(p) for p in sorted(tpl_dir.glob("*.html"))}
    version = args.set_version or detect_version(root, pages.keys())
    print(f"Root: {root}")
    print(f"Versione cache-busting: {version}")
    print(f"Partial caricati: {', '.join(sorted(partials))}")

    diverged = []
    for page, cfg in pages.items():
        rendered = render(page, cfg, partials, content_dir, version)
        target = root / page
        current = read(target) if target.exists() else None
        same = (current == rendered)
        if args.check:
            print(f"  [{'OK  ' if same else 'DIFF'}] {page}")
            if not same:
                diverged.append(page)
        else:
            if same:
                print(f"  [=] {page} (invariata)")
            else:
                write(target, rendered)
                print(f"  [W] {page} scritta ({len(rendered)} byte)")

    if args.check and diverged:
        print(f"\nCHECK FALLITO: {len(diverged)} pagina/e divergono: {', '.join(diverged)}")
        print("Rigenera con: python build-tools/build_pages.py")
        return 1
    print("\nFatto." if not args.check else "\nCheck OK: root allineata ai template.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
