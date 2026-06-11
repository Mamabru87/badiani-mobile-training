#!/usr/bin/env python3
"""Smoke + regression test for Badiani Training Orbit (Playwright, headless Chromium).

For each of the 9 root pages, in each UI language (it/en/es/fr — set via
localStorage key `badianiUILang.v1` BEFORE page load) it verifies:
  - no console errors (file:// fetch/CORS/missing-resource noise is ignored)
  - a skip-link (`a.skip-link` / `a[href="#main"]`) is present
  - `<main id="main">` is present
  - document title is non-empty
  - `<html lang>` matches the requested language

Interaction tests (run once, in Italian):
  - caffe.html: bypass the beta login gate, open the first product-card modal,
    assert a visible `role="dialog"`, close it with Escape.
  - index.html: bypass the gate, assert the daily-mission section and the
    BERNY entry point (FAB widget or inline chat) are in the DOM.

Usage:
    python build-tools/smoke_test.py [BASE]
    python build-tools/smoke_test.py --base http://127.0.0.1:4173
    python build-tools/smoke_test.py --base /path/to/project

BASE can be an http(s) URL (e.g. http://localhost:8000) or a directory
(served via file://). Default: the project root (parent of this script).
The positional BASE form is kept for backwards compatibility.

Exit code: 0 = all green, 1 = at least one failure, 2 = setup error.

Requires: pip install playwright && python -m playwright install chromium
"""

import argparse
import sys
from pathlib import Path

PAGES = [
    "index.html",
    "gelato-lab.html",
    "caffe.html",
    "pastries.html",
    "sweet-treats.html",
    "festive.html",
    "operations.html",
    "story-orbit.html",
    "quiz-solution.html",
]

LANGS = ["it", "en", "es", "fr"]
LANG_STORAGE_KEY = "badianiUILang.v1"

NAV_TIMEOUT_MS = 30000
SETTLE_MS = 1200
INTERACTION_TIMEOUT_MS = 8000

# Console error fragments that are expected noise when running from file://
# (fetch of JSON/data files, SW registration, CORS, missing optional assets).
IGNORED_ERROR_FRAGMENTS = (
    "Failed to fetch",
    "Fetch API cannot load",
    "Failed to load resource",
    "net::ERR_FILE_NOT_FOUND",
    "net::ERR_FAILED",
    "Access to fetch",
    "Access to XMLHttpRequest",
    "CORS",
    "ServiceWorker",
    "serviceworker",
    "NetworkError",
    "Failed to register a ServiceWorker",
)


# Resources the app fetches opportunistically but that are intentionally NOT
# in the public repo (gitignored: internal notes / BERNY KB). The app handles
# their absence gracefully (try/catch), so their 404s are expected in CI and
# on GitHub Pages and must not fail the smoke run — in ANY base mode.
OPTIONAL_RESOURCE_FRAGMENTS = (
    "/notes/",
    "notes/kb/",
)


def is_ignorable(text: str, base_is_file: bool) -> bool:
    lowered = text.lower()
    if any(frag.lower() in lowered for frag in OPTIONAL_RESOURCE_FRAGMENTS):
        return True
    if not base_is_file:
        return False
    return any(frag.lower() in lowered for frag in IGNORED_ERROR_FRAGMENTS)


def resolve_base(base):
    """Return (base_url, base_is_file) or raise SystemExit(2)."""
    if base and base.startswith(("http://", "https://", "file://")):
        base_url = base.rstrip("/")
    else:
        root = Path(base).resolve() if base else Path(__file__).resolve().parent.parent
        if not root.is_dir():
            print(f"Directory not found: {root}", file=sys.stderr)
            raise SystemExit(2)
        base_url = root.as_uri()
    return base_url, base_url.startswith("file://")


def attach_error_collectors(page, errors):
    # Console "Failed to load resource" messages don't include the URL in
    # msg.text — append msg.location's URL so ignore-filters can match paths.
    def _on_console(msg, errs=errors):
        if msg.type != "error":
            return
        loc = ""
        try:
            loc = (msg.location or {}).get("url", "") or ""
        except Exception:
            loc = ""
        errs.append(f"{msg.text} [{loc}]" if loc else msg.text)

    page.on("console", _on_console)
    page.on(
        "pageerror",
        lambda exc, errs=errors: errs.append(f"pageerror: {exc}"),
    )


def new_page_with_lang(context, lang):
    page = context.new_page()
    page.set_default_timeout(INTERACTION_TIMEOUT_MS)
    page.add_init_script(
        f"try {{ localStorage.setItem('{LANG_STORAGE_KEY}', '{lang}'); }} catch (e) {{}}"
    )
    return page


def check_page(context, base_url, page_name, lang, base_is_file):
    """Static checks for one page in one language. Returns list of problems."""
    page = new_page_with_lang(context, lang)
    errors = []
    attach_error_collectors(page, errors)
    problems = []
    try:
        page.goto(f"{base_url}/{page_name}", wait_until="load",
                  timeout=NAV_TIMEOUT_MS)
        page.wait_for_timeout(SETTLE_MS)

        real_errors = [e for e in errors if not is_ignorable(e, base_is_file)]
        if real_errors:
            problems.append("console errors: " + " | ".join(real_errors[:5]))

        if not page.locator('a.skip-link, a[href="#main"]').count():
            problems.append("skip-link missing")

        if not page.locator("main#main").count():
            problems.append('<main id="main"> missing')

        if not (page.title() or "").strip():
            problems.append("empty <title>")

        # <html lang> must follow the persisted UI language.
        try:
            page.wait_for_function(
                f"() => (document.documentElement.lang || '').toLowerCase()"
                f".startsWith('{lang}')",
                timeout=5000,
            )
        except Exception:
            actual = page.evaluate("document.documentElement.lang") or "(empty)"
            problems.append(f"<html lang> is '{actual}', expected '{lang}'")
    except Exception as exc:  # navigation/timeout failures
        problems.append(f"load failed: {exc}")
    finally:
        page.close()
    return problems


def bypass_gate(page):
    """Click the beta-preview button if the login gate is shown, then dismiss
    the BERNY guide-video overlay that may auto-open afterwards."""
    try:
        gate = page.locator('[data-action="beta-preview"]')
        if gate.count() and gate.first.is_visible():
            gate.first.click()
            page.wait_for_timeout(1500)
    except Exception:
        pass
    # Close the auto-shown video overlay (close button, fallback: Escape).
    try:
        close_btn = page.locator(".berny-guide-close")
        if close_btn.count() and close_btn.first.is_visible():
            close_btn.first.click()
        else:
            page.keyboard.press("Escape")
        page.wait_for_timeout(600)
    except Exception:
        try:
            page.keyboard.press("Escape")
            page.wait_for_timeout(400)
        except Exception:
            pass


def test_caffe_modal(browser, base_url, base_is_file):
    """Gate bypass + first product-card modal open/close on caffe.html."""
    context = browser.new_context()
    page = new_page_with_lang(context, "it")
    problems = []
    try:
        page.goto(f"{base_url}/caffe.html", wait_until="load",
                  timeout=NAV_TIMEOUT_MS)
        page.wait_for_timeout(SETTLE_MS)
        bypass_gate(page)

        trigger = page.locator(".guide-card--product [data-toggle-card]")
        if not trigger.count():
            trigger = page.locator(".guide-card [data-toggle-card]")
        if not trigger.count():
            problems.append("no product card with [data-toggle-card] found")
        else:
            trigger.first.click(timeout=INTERACTION_TIMEOUT_MS)
            dialog = page.locator('.card-modal[role="dialog"]')
            try:
                dialog.first.wait_for(state="visible",
                                      timeout=INTERACTION_TIMEOUT_MS)
            except Exception:
                problems.append(
                    'card modal with role="dialog" not visible after click')
            if not problems:
                page.keyboard.press("Escape")
                try:
                    page.wait_for_function(
                        "() => { const ov = document.querySelector("
                        "'.card-modal-overlay'); if (!ov) return true;"
                        " const r = ov.getBoundingClientRect();"
                        " return !ov.classList.contains('is-visible')"
                        " || (r.width === 0 && r.height === 0); }",
                        timeout=INTERACTION_TIMEOUT_MS,
                    )
                except Exception:
                    problems.append("card modal did not close on Escape")
    except Exception as exc:
        problems.append(f"interaction failed: {exc}")
    finally:
        context.close()
    return problems


def test_home(browser, base_url, base_is_file):
    """Gate bypass + mission section + BERNY entry point on index.html."""
    context = browser.new_context()
    page = new_page_with_lang(context, "it")
    problems = []
    try:
        page.goto(f"{base_url}/index.html", wait_until="load",
                  timeout=NAV_TIMEOUT_MS)
        page.wait_for_timeout(SETTLE_MS)
        bypass_gate(page)

        if not page.locator("[data-daily-mission], section.daily-mission").count():
            problems.append("daily-mission section missing")

        # BERNY entry point: lazy FAB widget or the inline chat section.
        berny = page.locator(".berny-fab, [data-berny-widget], #berny, .chat-berny")
        if not berny.count():
            problems.append("BERNY entry point (FAB/chat) missing from DOM")
    except Exception as exc:
        problems.append(f"interaction failed: {exc}")
    finally:
        context.close()
    return problems


def print_matrix(results):
    """results: dict[page][lang] -> list of problems."""
    name_w = max(len(p) for p in PAGES) + 2
    header = "Page".ljust(name_w) + "".join(l.upper().center(6) for l in LANGS)
    print(header)
    print("-" * len(header))
    for page_name in PAGES:
        row = page_name.ljust(name_w)
        for lang in LANGS:
            row += ("PASS" if not results[page_name][lang] else "FAIL").center(6)
        print(row)


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="Badiani Training Orbit smoke/regression test")
    parser.add_argument("base_pos", nargs="?", default=None, metavar="BASE",
                        help="base URL or project directory (legacy positional)")
    parser.add_argument("--base", dest="base_opt", default=None,
                        help="base URL (http://...) or project directory")
    args = parser.parse_args(sys.argv[1:] if argv is None else argv)

    try:
        base_url, base_is_file = resolve_base(args.base_opt or args.base_pos)
    except SystemExit as exc:
        return exc.code

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("playwright is not installed: pip install playwright",
              file=sys.stderr)
        return 2

    print(f"Base: {base_url}\n")
    failures = 0
    results = {p: {} for p in PAGES}
    interaction_results = {}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        # --- Page × language matrix ---------------------------------------
        context = browser.new_context()
        for page_name in PAGES:
            for lang in LANGS:
                problems = check_page(context, base_url, page_name, lang,
                                      base_is_file)
                results[page_name][lang] = problems
                if problems:
                    failures += 1
                    print(f"[FAIL] {page_name} [{lang}]")
                    for prob in problems:
                        print(f"       - {prob}")
                else:
                    print(f"[PASS] {page_name} [{lang}]")
        context.close()

        # --- Interaction tests ---------------------------------------------
        print()
        for label, fn in (
            ("caffe.html: gate bypass + card modal (open/dialog/Escape)",
             test_caffe_modal),
            ("index.html: gate bypass + mission section + BERNY", test_home),
        ):
            problems = fn(browser, base_url, base_is_file)
            interaction_results[label] = problems
            if problems:
                failures += 1
                print(f"[FAIL] {label}")
                for prob in problems:
                    print(f"       - {prob}")
            else:
                print(f"[PASS] {label}")

        browser.close()

    # --- Summary table ------------------------------------------------------
    print("\n=== Summary (pages x languages) ===")
    print_matrix(results)
    print("\n=== Interactions ===")
    for label, problems in interaction_results.items():
        print(f"  {'PASS' if not problems else 'FAIL'}  {label}")

    total = len(PAGES) * len(LANGS) + len(interaction_results)
    print(f"\n{total - failures}/{total} checks passed.")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
