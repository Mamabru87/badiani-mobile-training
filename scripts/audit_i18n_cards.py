"""Audit i18n coverage for guide cards.

Static site: cards are <article class="guide-card ..."> blocks.
We expect translatable content inside cards to be marked with:
- data-i18n (text)
- data-i18n-html (trusted HTML)

This script flags cards that contain likely-visible text blocks without i18n markers.

Run:
  python scripts/audit_i18n_cards.py

Notes:
- This is a heuristic audit (regex-based) to help find gaps fast.
- It does not attempt to translate automatically.
"""

from __future__ import annotations

import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

ARTICLE_RE = re.compile(
    r"<article\b(?P<open>[^>]*)class=\"(?P<class>[^\"]*\bguide-card\b[^\"]*)\"(?P<open2>[^>]*)>(?P<body>.*?)</article>",
    re.IGNORECASE | re.DOTALL,
)

H3_RE = re.compile(r"<h3[^>]*>(?P<t>.*?)</h3>", re.IGNORECASE | re.DOTALL)


def strip_tags(s: str) -> str:
    s = re.sub(r"<[^>]+>", "", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def first_h3_text(article_body: str) -> str:
    m = H3_RE.search(article_body)
    if not m:
        return "(no h3)"
    return strip_tags(m.group("t")) or "(empty h3)"


def has_marker(tag_fragment: str, marker: str) -> bool:
    return marker in tag_fragment


def audit_article(article_body: str) -> list[str]:
    issues: list[str] = []

    # Description paragraph: any <p> that is not inside details and is likely the summary.
    # We simply check if there's at least one <p ... data-i18n...> before the first <div class="details">.
    split = article_body.split('class="details"', 1)
    pre_details = split[0]

    has_desc = bool(re.search(r"<p\b[^>]*data-i18n(?:-html)?=\"", pre_details, re.IGNORECASE))
    if re.search(r"<p\b", pre_details, re.IGNORECASE) and not has_desc:
        issues.append("missing desc i18n")

    # Stats list
    for ul in re.finditer(r"<ul\b[^>]*class=\"[^\"]*\bstat-list\b[^\"]*\"[^>]*>", article_body, re.IGNORECASE):
        frag = ul.group(0)
        if not has_marker(frag.lower(), "data-i18n-html="):
            issues.append("missing stats i18n-html")
            break

    # Details block
    for div in re.finditer(r"<div\b[^>]*class=\"[^\"]*\bdetails\b[^\"]*\"[^>]*>", article_body, re.IGNORECASE):
        frag = div.group(0)
        if not has_marker(frag.lower(), "data-i18n-html="):
            issues.append("missing details i18n-html")
            break

    # Toggle button label
    for btn in re.finditer(r"<button\b[^>]*data-toggle-card[^>]*>", article_body, re.IGNORECASE):
        frag = btn.group(0)
        if not has_marker(frag.lower(), "data-i18n="):
            issues.append("missing toggle button i18n")
            break

    return issues


def main() -> int:
    html_files = sorted(p for p in ROOT.glob("*.html") if p.is_file())
    if not html_files:
        print("No HTML files found in", ROOT)
        return 1

    total_cards = 0
    total_flags = 0

    for fp in html_files:
        text = fp.read_text(encoding="utf-8", errors="replace")
        matches = list(ARTICLE_RE.finditer(text))
        if not matches:
            continue

        file_flags = 0
        out_lines: list[str] = []
        for m in matches:
            total_cards += 1
            body = m.group("body")
            title = first_h3_text(body)
            issues = audit_article(body)
            if issues:
                file_flags += 1
                total_flags += 1
                out_lines.append(f"  - {title}: {', '.join(issues)}")

        if file_flags:
            print(f"{fp.name}: {file_flags}/{len(matches)} cards flagged")
            print("\n".join(out_lines))
            print()

    print(f"Summary: {total_flags} cards flagged across {total_cards} cards")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
