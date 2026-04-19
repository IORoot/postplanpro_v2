#!/usr/bin/env python3
"""One-off: plot usage CSV token columns vs time."""
import csv
from datetime import datetime
from pathlib import Path

import matplotlib.pyplot as plt
import matplotlib.dates as mdates

CSV_PATH = Path("/Users/andypearson/Downloads/usage-events-2026-04-19.csv")
OUT_PATH = Path(__file__).resolve().parent.parent / "usage-events-chart-2026-04-19.png"

COLS = [
    "Input (w/ Cache Write)",
    "Input (w/o Cache Write)",
    "Cache Read",
    "Output Tokens",
    "Total Tokens",
]


def main() -> None:
    rows: list[tuple[datetime, list[int]]] = []
    with CSV_PATH.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            raw = (r.get("Date") or "").strip().strip('"')
            if not raw:
                continue
            try:
                # ISO8601 with Z
                ts = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            except ValueError:
                continue
            nums = []
            ok = True
            for c in COLS:
                v = (r.get(c) or "0").strip().strip('"')
                try:
                    nums.append(int(v))
                except ValueError:
                    ok = False
                    break
            if ok:
                rows.append((ts, nums))

    rows.sort(key=lambda x: x[0])
    if not rows:
        raise SystemExit("No parseable rows")

    dates = [r[0] for r in rows]
    series = list(zip(*[r[1] for r in rows]))

    fig, ax = plt.subplots(figsize=(14, 7))
    for i, name in enumerate(COLS):
        ax.plot(dates, series[i], marker="o", markersize=2, linewidth=1.2, label=name, alpha=0.85)

    ax.set_xlabel("Date / time (UTC)")
    ax.set_ylabel("Tokens")
    ax.set_title("Usage events — token breakdown over time")
    ax.legend(loc="upper left", fontsize=9)
    ax.grid(True, alpha=0.3)
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%m-%d %H:%M"))
    fig.autofmt_xdate(rotation=35)
    fig.tight_layout()
    fig.savefig(OUT_PATH, dpi=160)
    print(f"Wrote {OUT_PATH}")


if __name__ == "__main__":
    main()
