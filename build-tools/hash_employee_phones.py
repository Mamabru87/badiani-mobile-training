#!/usr/bin/env python3
"""Generate phone hashes for the employee registry.

This script mirrors the Worker normalization + hashing:
  phoneHash = sha256(f"{normalizedPhone}|{PHONE_HASH_PEPPER}")  (hex)

Usage (example):
  python build-tools/hash_employee_phones.py employees.csv --pepper "..." --out hashes.txt

Input:
- CSV/TSV with headers. It will look for a column named one of:
  phone, mobile, cellulare, telefono
- If not found, it will scan all cells and pick values that look like phone numbers.

Output:
- One unique hash per line (hex).

Notes:
- Export your Excel to CSV UTF-8.
- Normalization is intentionally conservative; inspect the "rejected" count.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import re
from pathlib import Path
from typing import Iterable, Optional


PHONE_RE = re.compile(r"^\+\d{8,16}$")


def normalize_phone(raw: str) -> str:
    s = (raw or "").strip()
    if not s:
        return ""
    s = re.sub(r"[\s\-().]", "", s)
    if s.startswith("00"):
        s = "+" + s[2:]

    if not s.startswith("+") and s.isdigit():
        # mirror Worker defaults
        if len(s) == 10 and s.startswith("3"):
            s = "+39" + s
        elif len(s) == 12 and s.startswith("39"):
            s = "+" + s
        else:
            s = "+" + s

    if not PHONE_RE.match(s):
        return ""
    return s


def sha256_hex(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def iter_rows(path: Path) -> Iterable[dict[str, str]]:
    # Try sniffing delimiter (comma vs tab vs semicolon).
    sample = path.read_text(encoding="utf-8", errors="replace")[:4096]
    dialect = csv.Sniffer().sniff(sample, delimiters=",;\t")
    with path.open("r", encoding="utf-8", errors="replace", newline="") as f:
        reader = csv.DictReader(f, dialect=dialect)
        for row in reader:
            yield {k.strip(): (v or "") for k, v in row.items() if k is not None}


def pick_phone_from_row(row: dict[str, str]) -> Optional[str]:
    keys = {k.lower(): k for k in row.keys()}
    for preferred in ("phone", "mobile", "cellulare", "telefono"):
        if preferred in keys:
            v = row.get(keys[preferred], "")
            p = normalize_phone(v)
            if p:
                return p

    # fallback: scan all values
    for v in row.values():
        p = normalize_phone(v)
        if p:
            return p

    return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("input", type=Path, help="CSV/TSV exported from Excel")
    ap.add_argument("--pepper", required=True, help="PHONE_HASH_PEPPER value used by the Worker")
    ap.add_argument("--out", type=Path, default=None, help="Output file (default: stdout)")
    args = ap.parse_args()

    hashes: set[str] = set()
    total = 0
    accepted = 0

    for row in iter_rows(args.input):
        total += 1
        phone = pick_phone_from_row(row)
        if not phone:
            continue
        accepted += 1
        h = sha256_hex(f"{phone}|{args.pepper.strip()}")
        hashes.add(h)

    out_lines = sorted(hashes)

    if args.out:
        args.out.write_text("\n".join(out_lines) + ("\n" if out_lines else ""), encoding="utf-8")
    else:
        print("\n".join(out_lines))

    rejected = total - accepted
    print(
        f"\n# rows={total} accepted={accepted} rejected={rejected} unique_hashes={len(hashes)}",
        flush=True,
    )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
