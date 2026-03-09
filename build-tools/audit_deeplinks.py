#!/usr/bin/env python3
"""Audit deep-linkability of guide cards across pages.

Why this exists
- Deep-link logic uses ?q=... to find a card by id (card-<q>) or by (normalized) title.
- Berny should generate stable links that resolve to real cards.

This script scans all *.html pages in the repo root and checks:
- Each .guide-card has a discoverable title (<h3> text)
- Each card has a stable cardKey (prefers id="card-<cardKey>")
- cardKeys are unique within a page
- scripts/site.js loads before scripts/deep-link.js (important if ids are auto-generated)

Run
  python audit_deeplinks.py

Exit code
  0: no errors
  1: errors found
"""

from __future__ import annotations

import glob
import html
import os
import re
import sys
from dataclasses import dataclass


ARTICLE_RE = re.compile(
    r"<article\b(?P<attrs>[^>]*\bclass=\"[^\"]*\bguide-card\b[^\"]*\"[^>]*)>(?P<body>.*?)</article>",
    re.IGNORECASE | re.DOTALL,
)
ID_RE = re.compile(r"(?:^|\s)id=\"(?P<id>[^\"]+)\"", re.IGNORECASE)
H3_RE = re.compile(r"<h3\b[^>]*>(?P<title>.*?)</h3>", re.IGNORECASE | re.DOTALL)
TAG_RE = re.compile(r"<[^>]+>")


def slugify(value: str) -> str:
    s = value.strip().lower()
    # NFD-ish diacritic strip (covers most latin accents)
    s = (
        s.replace("à", "a")
        .replace("á", "a")
        .replace("â", "a")
        .replace("ä", "a")
        .replace("è", "e")
        .replace("é", "e")
        .replace("ê", "e")
        .replace("ë", "e")
        .replace("ì", "i")
        .replace("í", "i")
        .replace("î", "i")
        .replace("ï", "i")
        .replace("ò", "o")
        .replace("ó", "o")
        .replace("ô", "o")
        .replace("ö", "o")
        .replace("ù", "u")
        .replace("ú", "u")
        .replace("û", "u")
        .replace("ü", "u")
        .replace("ç", "c")
    )
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"^-+|-+$", "", s)
    return s


@dataclass
class Card:
    page: str
    idx: int
    id_attr: str | None
    title: str | None
    card_key: str


def extract_cards(page_path: str, content: str) -> list[Card]:
    cards: list[Card] = []
    for idx, m in enumerate(ARTICLE_RE.finditer(content), start=1):
        attrs = m.group("attrs") or ""
        body = m.group("body") or ""

        id_match = ID_RE.search(attrs)
        id_attr = id_match.group("id").strip() if id_match else None

        h3_match = H3_RE.search(body)
        title_raw = h3_match.group("title") if h3_match else ""
        title_txt = html.unescape(TAG_RE.sub("", title_raw)).strip() or None

        if id_attr and id_attr.startswith("card-"):
            card_key = id_attr[len("card-") :].strip()
        else:
            card_key = slugify(title_txt or "")

        cards.append(Card(page=os.path.basename(page_path), idx=idx, id_attr=id_attr, title=title_txt, card_key=card_key))

    return cards


def check_script_order(page: str, content: str) -> list[str]:
    issues: list[str] = []

    # Only matters if both exist.
    site_pos = content.find("scripts/site.js")
    deep_pos = content.find("scripts/deep-link.js")

    if deep_pos != -1 and site_pos == -1:
        issues.append("ERROR: deep-link.js is included but site.js is missing (auto-id + catalog hydration won't run).")
    elif deep_pos != -1 and site_pos != -1 and deep_pos < site_pos:
        issues.append("ERROR: deep-link.js appears before site.js (with defer, execution order follows source order).")

    return issues


def main() -> int:
    root = os.path.dirname(os.path.abspath(__file__))
    pages = sorted(glob.glob(os.path.join(root, "*.html")))

    # Exclude utility/test pages
    exclude = {
        "debug-carousel.html",
        "quiz-solution.html",
    }
    pages = [p for p in pages if os.path.basename(p) not in exclude]

    if not pages:
        print("No HTML pages found in repo root.")
        return 1

    total_cards = 0
    any_errors = False

    for p in pages:
        page = os.path.basename(p)
        with open(p, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()

        print(f"\n=== {page} ===")

        issues = []
        issues.extend(check_script_order(page, content))

        cards = extract_cards(p, content)
        total_cards += len(cards)
        print(f"Cards found: {len(cards)}")

        seen_keys: dict[str, int] = {}
        seen_titles: dict[str, int] = {}

        for c in cards:
            if not c.title:
                issues.append(f"ERROR: card #{c.idx} has no <h3> title (id={c.id_attr!r}).")
            if not c.card_key:
                issues.append(f"ERROR: card #{c.idx} could not derive a cardKey (id={c.id_attr!r}, title={c.title!r}).")

            if c.card_key:
                prev = seen_keys.get(c.card_key)
                if prev is not None:
                    issues.append(f"ERROR: duplicate cardKey '{c.card_key}' (cards #{prev} and #{c.idx}).")
                else:
                    seen_keys[c.card_key] = c.idx

                # Canonicality checks when id is present.
                if c.id_attr:
                    if c.id_attr.startswith("card-"):
                        if slugify(c.card_key) != c.card_key:
                            issues.append(
                                f"WARN: non-canonical cardKey '{c.card_key}' in id '{c.id_attr}' (suggest: 'card-{slugify(c.card_key)}')."
                            )
                    else:
                        issues.append(f"WARN: card #{c.idx} id '{c.id_attr}' does not start with 'card-' (deep-link prefers 'card-<q>').")
                else:
                    issues.append(
                        f"WARN: card #{c.idx} is missing an id. It should be id='card-{c.card_key}' for stable deep-linking."
                    )

            if c.title:
                t_norm = slugify(c.title)
                prevt = seen_titles.get(t_norm)
                if prevt is not None:
                    issues.append(f"WARN: duplicate (slugified) title '{t_norm}' (cards #{prevt} and #{c.idx}).")
                else:
                    seen_titles[t_norm] = c.idx

        if not issues:
            print("OK: no issues.")
            continue

        for msg in issues:
            print(msg)
            if msg.startswith("ERROR"):
                any_errors = True

    print(f"\nScanned pages: {len(pages)}")
    print(f"Total cards: {total_cards}")
    if any_errors:
        print("\nResult: FAIL (errors found)")
        return 1

    print("\nResult: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
