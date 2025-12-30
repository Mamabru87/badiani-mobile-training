#!/usr/bin/env python
"""Generate an image inventory + AI prompt pack for all guide cards.

This repo is a static site: images are referenced directly from HTML.
We can't generate real photos here, but we can generate a consistent prompt pack
and an inventory of which assets are used by which cards.

Usage:
  python scripts/generate_image_pack.py

Outputs:
  notes/image-pack.md
  notes/image-pack.json
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NOTES_DIR = ROOT / "notes"

HTML_PAGES = [
    "caffe.html",
    "sweet-treats.html",
    "pastries.html",
    "slitti-yoyo.html",
    "gelato-lab.html",
    "festive.html",
    "story-orbit.html",
    "index.html",
]


@dataclass
class ImageItem:
    page: str
    section: str  # hero | card | story | cockpit
    title: str
    tags: list[str]
    asset_webp: str | None
    asset_img: str | None
    alt: str | None
    prompt: str
    negative_prompt: str
    size: str
    style_notes: str


ASSET_RE = re.compile(r"\bassets/[^\s\"\'>]+\.(?:webp|jpg|jpeg|png)\b", re.IGNORECASE)


def _sanitize_for_midjourney(text: str) -> str:
    """Remove/soften brand words that can cause MJ moderation or unwanted logos."""
    t = _clean_text(text)
    # Avoid explicit brand names in the Midjourney variant.
    t = re.sub(r"\bBadiani\b", "boutique gelateria", t, flags=re.IGNORECASE)
    t = re.sub(r"\bSlitti\b", "artisan chocolate", t, flags=re.IGNORECASE)
    t = re.sub(r"\bBuontalenti\b", "signature gelato", t, flags=re.IGNORECASE)
    return t


def _size_to_aspect_ratio(size: str) -> str:
    """Convert '1152x768' -> '3:2' (or fallback to '3:2')."""
    m = re.match(r"^(\d+)x(\d+)$", (size or "").strip())
    if not m:
        return "3:2"
    w = int(m.group(1))
    h = int(m.group(2))
    if w <= 0 or h <= 0:
        return "3:2"

    def gcd(a: int, b: int) -> int:
        while b:
            a, b = b, a % b
        return a

    g = gcd(w, h)
    w0, h0 = w // g, h // g
    # MJ accepts many ratios; keep simple if numbers get huge.
    if w0 > 30 or h0 > 30:
        # approximate to common ratios
        ratio = w / h
        if abs(ratio - 1.5) < 0.08:
            return "3:2"
        if abs(ratio - (4 / 3)) < 0.08:
            return "4:3"
        if abs(ratio - (16 / 9)) < 0.08:
            return "16:9"
        return "3:2"
    return f"{w0}:{h0}"


def _mj_no_list(negative_prompt: str) -> str:
    """Turn our negative prompt string into a Midjourney --no list."""
    raw = _clean_text(negative_prompt)
    if not raw:
        return ""
    parts = [p.strip() for p in raw.split(",")]
    parts = [p for p in parts if p]

    # MJ dislikes some meta-words; keep it practical.
    normalized: list[str] = []
    for p in parts:
        p2 = p
        p2 = p2.replace("logo visibile", "logo")
        p2 = p2.replace("volti riconoscibili", "people")
        p2 = p2.replace("mani deformi", "deformed hands")
        p2 = p2.replace("dita extra", "extra fingers")
        normalized.append(p2)
    # Add a couple of very common MJ killers
    extras = ["text", "watermark", "signature", "brand logos"]
    for e in extras:
        if e not in normalized:
            normalized.append(e)
    return ", ".join(normalized)


def _make_midjourney_prompt(*, item: ImageItem) -> str:
    """Build a Midjourney-ready /imagine line for an item."""
    ar = _size_to_aspect_ratio(item.size)

    title = _sanitize_for_midjourney(item.title)
    tags = [_sanitize_for_midjourney(t) for t in (item.tags or [])]
    alt = _sanitize_for_midjourney(item.alt or "")

    # English prompt tends to be more predictable in MJ.
    base_style = (
        "premium editorial food photography, Florence boutique cafe aesthetic, "
        "soft natural light, clean warm color grading, marble and brushed steel surfaces, "
        "minimal background, shallow depth of field, high detail, tidy composition"
    )

    if item.section in ("cockpit",):
        subject = (
            f"abstract premium background inspired by {title}, soft gradients and subtle texture, "
            "blue/rose/gold palette, no text"
        )
        # Cockpit: allow a wider ratio
        stylize = "--stylize 150"
    else:
        subject = f"hero shot of {title}" if item.section == "hero" else f"product shot of {title}"
        if tags:
            subject += ", subtle details hinting at: " + ", ".join(tags[:5])
        if alt:
            subject += f" (accessibility hint: {alt})"
        subject += ", no recognizable people"
        stylize = "--stylize 75"

    no_list = _mj_no_list(item.negative_prompt)
    no_part = f" --no {no_list}" if no_list else ""

    # v6.1 is current stable for MJ v6 series.
    # Keep quality modest for speed; user can bump it on selected winners.
    params = f"--ar {ar} --v 6.1 {stylize} --quality 1"
    return f"/imagine prompt: {base_style}, {subject} {params}{no_part}"


def _clean_text(s: str) -> str:
    s = re.sub(r"\s+", " ", s or "").strip()
    return s


def _strip_tags(html: str) -> str:
    # minimal stripper (good enough for our controlled markup)
    html = re.sub(r"<br\s*/?>", " ", html, flags=re.IGNORECASE)
    html = re.sub(r"<[^>]+>", " ", html)
    return _clean_text(html)


def _find_first(pattern: str, text: str, flags=0) -> str | None:
    m = re.search(pattern, text, flags)
    return m.group(1) if m else None


def _extract_article_blocks(html: str) -> list[str]:
    # Non-greedy match for guide cards.
    # Assumes articles are not nested.
    blocks = re.findall(
        r"<article\s+class=\"guide-card[^\"]*\"[^>]*>.*?</article>",
        html,
        flags=re.IGNORECASE | re.DOTALL,
    )
    return blocks


def _extract_story_images(html: str) -> list[tuple[str, str]]:
    # (src, alt)
    out: list[tuple[str, str]] = []
    for m in re.finditer(r"<img\s+[^>]*src=\"(assets/[^\"]+)\"[^>]*>", html, flags=re.IGNORECASE):
        src = m.group(1)
        # backtrack within tag for alt
        tag = m.group(0)
        alt = _find_first(r'alt=\"([^\"]*)\"', tag, flags=re.IGNORECASE)
        out.append((src, alt or ""))
    return out


def _make_prompt(
    *,
    page: str,
    section: str,
    title: str,
    tags: list[str],
    alt: str | None,
) -> tuple[str, str, str, str]:
    """Return (prompt, negative_prompt, size, style_notes)."""

    # One consistent art direction across the whole site.
    style = (
        "Foto editoriale premium, stile boutique fiorentina, luce morbida naturale, "
        "color grading caldo ma pulito, materiali reali (marmo chiaro, acciaio, ceramica), "
        "sfondo minimale, profondità di campo leggera, alta nitidezza, composizione ordinata."
    )

    subject_bits = [title]
    if tags:
        subject_bits.append("dettagli: " + ", ".join(tags[:4]))

    # Context per pagina (solo per guidare il soggetto)
    page_hint = {
        "caffe.html": "contesto bar caffetteria Badiani",
        "sweet-treats.html": "contesto dessert e sweet counter Badiani",
        "pastries.html": "contesto pastry e vetrina dolci",
        "slitti-yoyo.html": "contesto prodotti Slitti + device Yo-Yo",
        "gelato-lab.html": "contesto gelato artigianale e vetrina",
        "festive.html": "contesto stagionale/festivo (churros, panettone, vin brulè)",
        "story-orbit.html": "contesto storytelling brand, moodbook",
        "index.html": "contesto dashboard/cockpit (grafica astratta, non numeri)",
    }.get(page, "contesto Badiani")

    # Sezione cockpit: immagini più astratte (background, texture) se mai le vorrai.
    if page == "index.html":
        prompt = (
            f"{style} "
            f"Immagine astratta ispirata a '{title}' per una card UI, {page_hint}. "
            "Usa forme morbide e dettagli light (non testo), palette coerente con blu/rosa/oro. "
            "Sembra una foto/illustrazione fotografica, non un'icona piatta."
        )
        size = "1344x768"  # wide-ish
        style_notes = "Cockpit: preferire astratto/texture, senza testo." 
    else:
        prompt = (
            f"{style} "
            f"Soggetto principale: {subject_bits[0]}. {page_hint}. "
            "Scatto inquadratura 3/4 o top-down a seconda del prodotto, "
            "nessuna persona riconoscibile, focus sul prodotto/strumento, "
            "ambientazione pulita e professionale."
        )
        if tags:
            prompt += " Includi micro-dettagli coerenti con: " + ", ".join(tags[:5]) + "."

        # Standard card image ratio in this site tends to look good around 4:3 / 5:3.
        size = "1152x768"
        style_notes = "Card: fotografia realistica, pulita, senza loghi." 

    negative = (
        "testo, watermark, firma, logo visibile, mani deformi, dita extra, volti riconoscibili, "
        "brand concorrenti, sfondo disordinato, bassa qualità, blur eccessivo, artefatti, "
        "oversaturated, pixelated, cartoon, illustrazione piatta"
    )

    # If alt exists, preserve intent by nudging subject.
    if alt:
        alt_clean = _clean_text(alt)
        if alt_clean and alt_clean.lower() not in prompt.lower():
            prompt += f" Nota: descrizione accessibilità: '{alt_clean}'."

    return prompt, negative, size, style_notes


def _extract_tags(article_html: str) -> list[str]:
    tag_row = _find_first(r"<div\s+class=\"tag-row\"[^>]*>(.*?)</div>", article_html, flags=re.IGNORECASE | re.DOTALL)
    if not tag_row:
        return []
    tags = re.findall(r"<span\s+class=\"tag[^\"]*\"[^>]*>(.*?)</span>", tag_row, flags=re.IGNORECASE | re.DOTALL)
    return [
        _strip_tags(t)
        for t in tags
        if _strip_tags(t)
    ]


def _extract_picture_assets(article_html: str) -> tuple[str | None, str | None, str | None]:
    # Prefer the image within guide-media.
    media_block = _find_first(r"<figure\s+class=\"guide-media\"[^>]*>(.*?)</figure>", article_html, flags=re.IGNORECASE | re.DOTALL)
    block = media_block if media_block else article_html

    webp = _find_first(r"<source\s+[^>]*srcset=\"(assets/[^\"]+\.webp)\"", block, flags=re.IGNORECASE)
    img = _find_first(r"<img\s+[^>]*src=\"(assets/[^\"]+\.(?:jpg|jpeg|png))\"", block, flags=re.IGNORECASE)
    alt = None
    if img:
        # Grab the <img ...> tag that contains this src.
        tag = _find_first(r"(<img\s+[^>]*src=\"" + re.escape(img) + r"\"[^>]*>)", block, flags=re.IGNORECASE)
        if tag:
            alt = _find_first(r'alt=\"([^\"]*)\"', tag, flags=re.IGNORECASE)
    return webp, img, alt


def build_pack() -> list[ImageItem]:
    items: list[ImageItem] = []

    for page in HTML_PAGES:
        fp = ROOT / page
        if not fp.exists():
            continue
        html = fp.read_text(encoding="utf-8", errors="ignore")

        # Hero image
        hero_block = _find_first(r"<section\s+class=\"hero\"[^>]*>(.*?)</section>", html, flags=re.IGNORECASE | re.DOTALL)
        if hero_block:
            webp = _find_first(r"<source\s+[^>]*srcset=\"(assets/[^\"]+\.webp)\"", hero_block, flags=re.IGNORECASE)
            img = _find_first(r"<img\s+[^>]*src=\"(assets/[^\"]+\.(?:jpg|jpeg|png))\"", hero_block, flags=re.IGNORECASE)
            alt = None
            if img:
                tag = _find_first(r"(<img\s+[^>]*src=\"" + re.escape(img) + r"\"[^>]*>)", hero_block, flags=re.IGNORECASE)
                if tag:
                    alt = _find_first(r'alt=\"([^\"]*)\"', tag, flags=re.IGNORECASE)

            title = _find_first(r"<h1>(.*?)</h1>", hero_block, flags=re.IGNORECASE | re.DOTALL)
            hero_title = _strip_tags(title) if title else page

            if webp or img:
                prompt, neg, size, notes = _make_prompt(
                    page=page,
                    section="hero",
                    title=f"Cover: {hero_title}",
                    tags=[],
                    alt=alt,
                )
                items.append(
                    ImageItem(
                        page=page,
                        section="hero",
                        title=hero_title,
                        tags=[],
                        asset_webp=webp,
                        asset_img=img,
                        alt=alt,
                        prompt=prompt,
                        negative_prompt=neg,
                        size=size,
                        style_notes=notes,
                    )
                )

        # Cockpit (index) has no photos in cards currently; keep as future-ready (optional).
        if page == "index.html":
            for m in re.finditer(r"<article\s+class=\"summary-card[^\"]*\"[^>]*data-carousel-item[^>]*>(.*?)</article>", html, flags=re.IGNORECASE | re.DOTALL):
                block = m.group(0)
                title = _find_first(r"<h3[^>]*>(.*?)</h3>", block, flags=re.IGNORECASE | re.DOTALL)
                t = _strip_tags(title) if title else "Cockpit card"
                prompt, neg, size, notes = _make_prompt(
                    page=page,
                    section="cockpit",
                    title=t,
                    tags=[],
                    alt=None,
                )
                items.append(
                    ImageItem(
                        page=page,
                        section="cockpit",
                        title=t,
                        tags=[],
                        asset_webp=None,
                        asset_img=None,
                        alt=None,
                        prompt=prompt,
                        negative_prompt=neg,
                        size=size,
                        style_notes=notes,
                    )
                )

        # Guide cards
        for block in _extract_article_blocks(html):
            title = _find_first(r"<h3[^>]*>(.*?)</h3>", block, flags=re.IGNORECASE | re.DOTALL)
            card_title = _strip_tags(title) if title else "(senza titolo)"
            tags = _extract_tags(block)
            webp, img, alt = _extract_picture_assets(block)

            # Only include cards that actually reference an asset.
            if not (webp or img):
                continue

            prompt, neg, size, notes = _make_prompt(
                page=page,
                section="card",
                title=card_title,
                tags=tags,
                alt=alt,
            )

            items.append(
                ImageItem(
                    page=page,
                    section="card",
                    title=card_title,
                    tags=tags,
                    asset_webp=webp,
                    asset_img=img,
                    alt=alt,
                    prompt=prompt,
                    negative_prompt=neg,
                    size=size,
                    style_notes=notes,
                )
            )

        # Story images (explicit <img> tags)
        if page == "story-orbit.html":
            for src, alt in _extract_story_images(html):
                if not src.lower().startswith("assets/"):
                    continue
                # Avoid duplicates with existing story extractions
                if not src.lower().endswith(".webp"):
                    continue

                prompt, neg, size, notes = _make_prompt(
                    page=page,
                    section="story",
                    title=f"Story panel: {alt or Path(src).stem}",
                    tags=[],
                    alt=alt,
                )

                items.append(
                    ImageItem(
                        page=page,
                        section="story",
                        title=alt or Path(src).stem,
                        tags=[],
                        asset_webp=src,
                        asset_img=None,
                        alt=alt,
                        prompt=prompt,
                        negative_prompt=neg,
                        size=size,
                        style_notes=notes,
                    )
                )

    return items


def write_outputs(items: list[ImageItem]) -> None:
    NOTES_DIR.mkdir(parents=True, exist_ok=True)

    now = datetime.now().strftime("%Y-%m-%d %H:%M")

    # JSON
    json_path = NOTES_DIR / "image-pack.json"
    json_payload = {
        "generated_at": now,
        "count": len(items),
        "items": [asdict(i) for i in items],
    }
    json_path.write_text(json.dumps(json_payload, ensure_ascii=False, indent=2), encoding="utf-8")

    # Markdown
    md_path = NOTES_DIR / "image-pack.md"
    mj_path = NOTES_DIR / "image-pack-midjourney.md"

    lines: list[str] = []
    lines.append(f"# Image pack (prompts)\n")
    lines.append(f"Generato: **{now}**\n")
    lines.append(
        "Questo file elenca ogni immagine usata nelle schede (cover + card) e un prompt pronto per generare una nuova immagine coerente.\n\n"
        "## Come usarlo\n"
        "- Genera immagini **originali** (no copia da foto esistenti).\n"
        "- Esporta **JPG + WEBP** usando **gli stessi nomi file** in `assets/` (così non serve cambiare HTML).\n"
        "- Consiglio: mantieni lo stesso soggetto ma con look & feel più uniforme (luce, palette, pulizia).\n\n"
        "## Linee guida stile (global)\n"
        "- Foto premium, pulite, senza testo o watermark.\n"
        "- Nessun logo visibile (evita problemi di brand/copyright).\n"
        "- Sfondo minimale; focus sul prodotto/strumento.\n\n"
    )

    # Group by page
    by_page: dict[str, list[ImageItem]] = {}
    for i in items:
        by_page.setdefault(i.page, []).append(i)

    for page in sorted(by_page.keys()):
        lines.append(f"## {page}\n")
        for i, it in enumerate(by_page[page], start=1):
            lines.append(f"### {i}. {it.section.upper()} — {it.title}\n")
            if it.tags:
                lines.append(f"- Tag: {', '.join(it.tags)}\n")
            if it.asset_img or it.asset_webp:
                lines.append(f"- Asset: {it.asset_img or ''} {it.asset_webp or ''}\n")
            if it.alt:
                lines.append(f"- Alt attuale: {it.alt}\n")
            lines.append(f"- Size consigliata: **{it.size}**\n")
            lines.append(f"- Note: {it.style_notes}\n")
            lines.append("\n**Prompt**\n")
            lines.append(f"{it.prompt}\n")
            lines.append("\n**Negative prompt**\n")
            lines.append(f"{it.negative_prompt}\n\n")

    md_path.write_text("\n".join(lines), encoding="utf-8")

    # Midjourney Markdown (copy/paste ready)
    mj_lines: list[str] = []
    mj_lines.append("# Image pack (Midjourney)\n")
    mj_lines.append(f"Generato: **{now}**\n")
    mj_lines.append(
        "Questo file è pensato per Midjourney: ogni riga è un `/imagine prompt:` pronto da incollare.\n\n"
        "Note:\n"
        "- Midjourney usa `--ar` (aspect ratio), non dimensioni pixel.\n"
        "- Le parole di brand sono state ammorbidite (per evitare loghi/filtri).\n"
        "- Se vuoi più varietà: aggiungi `--chaos 10` o cambia seed.\n\n"
    )

    # Group by page
    by_page_mj: dict[str, list[ImageItem]] = {}
    for i in items:
        by_page_mj.setdefault(i.page, []).append(i)

    for page in sorted(by_page_mj.keys()):
        mj_lines.append(f"## {page}\n")
        for idx, it in enumerate(by_page_mj[page], start=1):
            mj_lines.append(f"### {idx}. {it.section.upper()} — {it.title}\n")
            if it.asset_img or it.asset_webp:
                mj_lines.append(f"- Asset attuale: {it.asset_img or ''} {it.asset_webp or ''}\n")
            mj_lines.append("\n")
            mj_lines.append(_make_midjourney_prompt(item=it) + "\n")
            mj_lines.append("\n")

    mj_path.write_text("\n".join(mj_lines), encoding="utf-8")


def main() -> None:
    items = build_pack()

    # De-duplicate exact same asset refs (e.g. repeated img tags) keeping the first.
    seen: set[tuple[str | None, str | None, str]] = set()
    unique: list[ImageItem] = []
    for it in items:
        key = (it.asset_webp, it.asset_img, it.title)
        if key in seen:
            continue
        seen.add(key)
        unique.append(it)

    write_outputs(unique)
    print(f"Generated {len(unique)} items -> notes/image-pack.md + notes/image-pack.json")


if __name__ == "__main__":
    main()
