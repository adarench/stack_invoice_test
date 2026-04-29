#!/usr/bin/env python3
"""
Build src/data/glCodeCatalog.json from the source Excel chart of accounts.

Usage:
    python3 scripts/buildGlCatalog.py [<path-to-xlsx>]

Defaults to the latest ChartofAccounts*.xlsx in the repo root.
"""
import json
import re
import sys
from glob import glob
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUT = ROOT / "src" / "data" / "glCodeCatalog.json"
EDGE_FN_OUT = ROOT / "supabase" / "functions" / "classify-gl-code" / "glExpenseAccounts.json"

CODE_RE = re.compile(r"^\d{4}-\d{2}$")


def find_default_xlsx() -> Path:
    candidates = sorted(glob(str(ROOT / "ChartofAccounts*.xlsx")))
    if not candidates:
        raise SystemExit("No ChartofAccounts*.xlsx found in repo root.")
    return Path(candidates[-1])


def classify_type(code: str) -> str:
    head = int(code.split("-")[0])
    if 1000 <= head < 2000:
        return "Asset"
    if 2000 <= head < 3000:
        return "Liability"
    if 3000 <= head < 4000:
        return "Equity"
    if 4000 <= head < 5000:
        return "Revenue"
    if 5000 <= head < 7000:
        return "Expense"
    return "Other"


def is_recoverable(code: str) -> bool:
    head = int(code.split("-")[0])
    # Convention in this chart: 5xxx = recoverable, 6xxx = non-recoverable.
    return 5000 <= head < 6000


def derive_category(name: str) -> str:
    # "Landscape Maintenance: Contract" -> "Landscape Maintenance"
    if ":" in name:
        return name.split(":", 1)[0].strip()
    return name.strip()


def build(xlsx_path: Path) -> list[dict]:
    wb = openpyxl.load_workbook(xlsx_path, data_only=True)
    ws = wb.active

    rows: list[dict] = []
    for row in ws.iter_rows(values_only=True):
        code = row[0]
        name = row[1]
        acct_type = row[3]  # Reg | Head | Tot

        if acct_type != "Reg":
            continue
        if not isinstance(code, str) or not isinstance(name, str):
            continue

        code = code.strip()
        name = name.strip()
        if not CODE_RE.match(code) or not name:
            continue

        rows.append(
            {
                "gl_code": code,
                "gl_description": name,
                "category": derive_category(name),
                "type": classify_type(code),
                "recoverable": is_recoverable(code),
            }
        )

    rows.sort(key=lambda r: r["gl_code"])
    return rows


def main() -> None:
    xlsx_path = Path(sys.argv[1]) if len(sys.argv) > 1 else find_default_xlsx()
    out_path = DEFAULT_OUT

    catalog = build(xlsx_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(catalog, indent=2) + "\n")

    expense_subset = [r for r in catalog if r["type"] == "Expense"]
    EDGE_FN_OUT.parent.mkdir(parents=True, exist_ok=True)
    EDGE_FN_OUT.write_text(json.dumps(expense_subset, indent=2) + "\n")

    by_type: dict[str, int] = {}
    for r in catalog:
        by_type[r["type"]] = by_type.get(r["type"], 0) + 1

    print(f"Wrote {len(catalog)} accounts to {out_path.relative_to(ROOT)}")
    for t, n in sorted(by_type.items()):
        print(f"  {t:<10} {n}")
    print(f"Wrote {len(expense_subset)} expense accounts to {EDGE_FN_OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
