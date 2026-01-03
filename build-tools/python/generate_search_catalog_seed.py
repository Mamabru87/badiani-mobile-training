"""Generate `scripts/search-catalog-seed.js` from real HTML pages.

This repo is a static site (no build step). The Hub (index.html) runs Berny before
`site.js` has a chance to hydrate `badianiSearchCatalog.v2` from visited pages.

This script extracts all `.guide-card` titles from the key category pages and
creates a small JS seed that pre-populates localStorage with the full catalog.

Run from repo root:
  .venv/Scripts/python.exe build-tools/python/generate_search_catalog_seed.py

It will write:
  scripts/search-catalog-seed.js
"""

from __future__ import annotations

import argparse
import html
import json
import re
from pathlib import Path


DEFAULT_PAGES = [
    "caffe.html",
    "gelato-lab.html",
    "operations.html",
    "pastries.html",
    "sweet-treats.html",
    "festive.html",
    "slitti-yoyo.html",
    "story-orbit.html",
]


def slugify(value: str) -> str:
    """Match the `scripts/site.js` slugify() behaviour."""
    v = (value or "").lower()
    v = re.sub(r"[^a-z0-9]+", "-", v)
    v = re.sub(r"^-+|-+$", "", v)
    return v


def strip_tags(s: str) -> str:
    # Remove HTML tags and normalize whitespace
    s = re.sub(r"<[^>]+>", "", s or "")
    s = html.unescape(s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def extract_first_h1(html_text: str) -> str:
    m = re.search(r"<h1\b[^>]*>(.*?)</h1>", html_text, flags=re.IGNORECASE | re.DOTALL)
    if not m:
        return ""
    return strip_tags(m.group(1))


def extract_guide_card_titles(html_text: str) -> list[str]:
    """Extract the first <h3> title inside each <article class="... guide-card ...">."""
    titles: list[str] = []

    # capture <article ... class="...guide-card..."> ... </article>
    for m in re.finditer(
        r"<article\b[^>]*class=\"[^\"]*\bguide-card\b[^\"]*\"[^>]*>(.*?)</article>",
        html_text,
        flags=re.IGNORECASE | re.DOTALL,
    ):
        block = m.group(1)
        h = re.search(r"<h3\b[^>]*>(.*?)</h3>", block, flags=re.IGNORECASE | re.DOTALL)
        if not h:
            continue
        title = strip_tags(h.group(1))
        if title:
            titles.append(title)

    # Keep page order but de-dupe accidental duplicates
    out: list[str] = []
    seen: set[str] = set()
    for t in titles:
        if t in seen:
            continue
        seen.add(t)
        out.append(t)
    return out


def js_string(value: str) -> str:
    """Escape a string for a JS double-quoted literal."""
    s = value or ""
    return (
        s.replace("\\", "\\\\")
        .replace('"', "\\\"")
        .replace("\r", " ")
        .replace("\n", " ")
    )


def build_seed(repo_root: Path, pages: list[str]) -> dict:
    seed_pages: dict[str, dict] = {}

    for page in pages:
        p = repo_root / page
        if not p.exists():
            raise FileNotFoundError(f"Missing page: {page}")

        html_text = p.read_text(encoding="utf-8", errors="replace")
        category = extract_first_h1(html_text) or page.replace(".html", "")
        titles = extract_guide_card_titles(html_text)

        cards = []
        for t in titles:
            ck = slugify(t)
            if not ck:
                continue
            cards.append(
                {
                    "title": t,
                    "cardKey": ck,
                    "signals": {"sicurezza": False, "chiusura": False, "upselling": False},
                }
            )

        seed_pages[page] = {
            "href": page,
            "category": category,
            "cards": cards,
        }

    return {"pages": seed_pages}


def render_seed_js(seed: dict) -> str:
    # Render as a JS file that sets runtime timestamps and merges safely.

    # We don't embed ISO timestamps in the JSON so the seed always feels "fresh".
    pages = seed.get("pages") or {}

    pages_js_parts: list[str] = []
    for page_key, page in pages.items():
        href = str(page.get("href") or page_key)
        category = str(page.get("category") or page_key)
        cards = page.get("cards") or []

        cards_js = []
        for c in cards:
            title = str(c.get("title") or "").strip()
            card_key = str(c.get("cardKey") or slugify(title)).strip()
            if not title or not card_key:
                continue
            cards_js.append(
                '{title:"%s",cardKey:"%s",signals:{sicurezza:false,chiusura:false,upselling:false}}'
                % (js_string(title), js_string(card_key))
            )

        pages_js_parts.append(
            '"%s":{href:"%s",category:"%s",updatedAt:nowIso,cards:[%s]}'
            % (js_string(page_key), js_string(href), js_string(category), ",".join(cards_js))
        )

    pages_js = ",".join(pages_js_parts)

    return (
        "(function(){\n"
        "  'use strict';\n"
        "  var KEY = 'badianiSearchCatalog.v2';\n"
        "  var nowIso = new Date().toISOString();\n"
        f"  var SEED = {{ updatedAt: nowIso, pages: {{{pages_js}}} }};\n"
        "\n"
        "  try { window.__BADIANI_SEARCH_CATALOG_SEED__ = SEED; } catch (e) {}\n"
        "\n"
        "  function safeParse(raw) {\n"
        "    try { return JSON.parse(raw); } catch (e) { return null; }\n"
        "  }\n"
        "\n"
        "  try {\n"
        "    var catalog = safeParse(localStorage.getItem(KEY));\n"
        "    if (!catalog || typeof catalog !== 'object') catalog = {};\n"
        "    if (!catalog.pages || typeof catalog.pages !== 'object') catalog.pages = {};\n"
        "\n"
        "    var seedPages = SEED.pages || {};\n"
        "    Object.keys(seedPages).forEach(function(pageKey) {\n"
        "      var sp = seedPages[pageKey];\n"
        "      var ep = catalog.pages[pageKey];\n"
        "      if (!ep || typeof ep !== 'object') {\n"
        "        catalog.pages[pageKey] = sp;\n"
        "        return;\n"
        "      }\n"
        "\n"
        "      if (!ep.href) ep.href = sp.href;\n"
        "      if (!ep.category) ep.category = sp.category;\n"
        "      if (!ep.updatedAt) ep.updatedAt = sp.updatedAt;\n"
        "\n"
        "      var ec = Array.isArray(ep.cards) ? ep.cards : [];\n"
        "      var sc = Array.isArray(sp.cards) ? sp.cards : [];\n"
        "      var byKey = {};\n"
        "      ec.forEach(function(c) { if (c && c.cardKey) byKey[String(c.cardKey)] = true; });\n"
        "      sc.forEach(function(c) {\n"
        "        if (c && c.cardKey && !byKey[String(c.cardKey)]) {\n"
        "          ec.push(c);\n"
        "          byKey[String(c.cardKey)] = true;\n"
        "        }\n"
        "      });\n"
        "      ep.cards = ec;\n"
        "      catalog.pages[pageKey] = ep;\n"
        "    });\n"
        "\n"
        "    catalog.updatedAt = nowIso;\n"
        "    localStorage.setItem(KEY, JSON.stringify(catalog));\n"
        "  } catch (e) {\n"
        "    /* ignore */\n"
        "  }\n"
        "})();\n"
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--root",
        default=str(Path(__file__).resolve().parents[2]),
        help="Repo root (defaults to two levels up from this script)",
    )
    parser.add_argument(
        "--pages",
        nargs="*",
        default=DEFAULT_PAGES,
        help="HTML pages to include in the seed",
    )
    parser.add_argument(
        "--out",
        default="scripts/search-catalog-seed.js",
        help="Output JS path (relative to repo root)",
    )
    parser.add_argument(
        "--debug-json",
        default="",
        help="Optional: also write the extracted catalog as JSON to this path (relative to repo root)",
    )
    args = parser.parse_args()

    repo_root = Path(args.root).resolve()
    out_path = (repo_root / args.out).resolve()

    seed = build_seed(repo_root, list(args.pages))

    # Quick stats for sanity
    page_count = len(seed.get("pages") or {})
    card_count = sum(len((p.get("cards") or [])) for p in (seed.get("pages") or {}).values())
    print(f"Pages: {page_count} | Cards: {card_count}")

    js_text = render_seed_js(seed)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(js_text, encoding="utf-8")

    print(f"Wrote: {out_path}")

    # Optional debug JSON (not shipped/loaded by the site)
    if args.debug_json:
        debug_json_path = (repo_root / args.debug_json).resolve()
        debug_json_path.parent.mkdir(parents=True, exist_ok=True)
        debug_json_path.write_text(json.dumps(seed, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"Wrote: {debug_json_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
