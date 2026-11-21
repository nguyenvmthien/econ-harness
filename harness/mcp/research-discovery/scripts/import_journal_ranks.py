#!/usr/bin/env python3
"""Import user-provided SJR and ABDC workbooks into a compact local rank index.

Usage:
  python scripts/import_journal_ranks.py \
    "C:/path/scimagojr 2025.csv" \
    "C:/path/ABDC-JQL-2025.xlsx"

Requires openpyxl. The output is data/journal-ranks.json and is used locally by the MCP.
"""

import csv
import json
import re
import sys
from datetime import date
from pathlib import Path

from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "journal-ranks.json"


def issn_tokens(value):
    if not value:
        return []
    return sorted({re.sub(r"[^0-9Xx]", "", part).upper() for part in re.split(r"[,;|]", str(value)) if re.sub(r"[^0-9Xx]", "", part)})


def sjr_rows(path):
    rows = []
    with open(path, encoding="utf-8-sig", newline="") as source:
        reader = csv.DictReader(source, delimiter=";")
        required = {"Title", "Type", "Issn", "SJR Best Quartile", "Categories"}
        missing = required - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f"SJR CSV missing columns: {', '.join(sorted(missing))}")
        for row in reader:
            quartile = (row.get("SJR Best Quartile") or "").strip().upper()
            if (row.get("Type") or "").strip().lower() != "journal" or quartile not in {"Q1", "Q2"}:
                continue
            categories = [
                {"name": match.group(1).strip(), "quartile": match.group(2)}
                for match in re.finditer(r"([^;]+?)\s*\((Q[1-4])\)", row.get("Categories") or "")
            ]
            rows.append({
                "source": "SJR",
                "year": 2025,
                "title": (row.get("Title") or "").strip(),
                "issns": issn_tokens(row.get("Issn")),
                "rank": quartile,
                "sjr": (row.get("SJR") or "").strip(),
                "subjectCategories": categories,
                "sourceId": (row.get("Sourceid") or "").strip(),
            })
    return rows


def abdc_rows(path):
    workbook = load_workbook(path, read_only=True, data_only=True)
    sheet = workbook["2025 JQL"] if "2025 JQL" in workbook.sheetnames else workbook.active
    header_row = None
    for row_num, row in enumerate(sheet.iter_rows(values_only=True), start=1):
        normalized = [str(cell).strip() if cell is not None else "" for cell in row]
        if "Journal Title" in normalized and "2025 rating" in normalized:
            header_row = (row_num, {name: normalized.index(name) for name in ("Journal Title", "ISSN", "ISSNOnline", "FoR", "2025 rating")})
            break
    if header_row is None:
        raise ValueError("ABDC workbook has no 2025 JQL header with expected columns")
    start_row, cols = header_row
    rows = []
    for row in sheet.iter_rows(min_row=start_row + 1, values_only=True):
        title = str(row[cols["Journal Title"]] or "").strip()
        rating = str(row[cols["2025 rating"]] or "").strip().upper()
        if not title or rating not in {"A*", "A", "B"}:
            continue
        issns = issn_tokens(row[cols["ISSN"]]) + issn_tokens(row[cols["ISSNOnline"]])
        rows.append({
            "source": "ABDC",
            "year": 2025,
            "title": title,
            "issns": sorted(set(issns)),
            "rank": rating,
            "fieldOfResearch": str(row[cols["FoR"]] or "").strip(),
        })
    workbook.close()
    return rows


def main():
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    sjr_path, abdc_path = map(Path, sys.argv[1:])
    if not sjr_path.is_file() or not abdc_path.is_file():
        raise FileNotFoundError("Both supplied rank files must exist")
    data = {
        "schemaVersion": 1,
        "generatedAt": date.today().isoformat(),
        "sources": {
            "SJR": {
                "year": 2025,
                "title": "SCImago Journal Rank 2025",
                "sourceFile": sjr_path.name,
                "sourceUrl": "https://www.scimagojr.com/journalrank.php?year=2025",
                "attribution": "SCImago Journal & Country Rank",
            },
            "ABDC": {
                "year": 2025,
                "title": "ABDC Journal Quality List 2025",
                "sourceFile": abdc_path.name,
                "sourceUrl": "https://abdc.edu.au/abdc-journal-quality-list/",
                "attribution": "Australian Business Deans Council (ABDC)",
            },
        },
        "journals": sjr_rows(sjr_path) + abdc_rows(abdc_path),
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    sjr_count = sum(row["source"] == "SJR" for row in data["journals"])
    abdc_count = sum(row["source"] == "ABDC" for row in data["journals"])
    print(f"Imported SJR Q1/Q2: {sjr_count}; ABDC A*/A/B: {abdc_count}; total: {len(data['journals'])}")
    print(f"Output: {OUTPUT} ({OUTPUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
