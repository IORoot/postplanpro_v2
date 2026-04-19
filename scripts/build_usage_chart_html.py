#!/usr/bin/env python3
"""Emit usage-events-chart.html with embedded rows JSON (works from file://)."""
import csv
import json
from datetime import datetime
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
CSV_DEFAULT = Path.home() / "Downloads" / "usage-events-2026-04-19.csv"
OUT = REPO / "usage-events-chart.html"

COLS = [
    "Input (w/ Cache Write)",
    "Input (w/o Cache Write)",
    "Cache Read",
    "Output Tokens",
    "Total Tokens",
]

HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Usage events — token chart</title>
  <style>
    :root { color-scheme: light dark; }
    body { font-family: system-ui, sans-serif; margin: 0; padding: 1rem 1.25rem 2rem; }
    h1 { font-size: 1.15rem; font-weight: 600; margin: 0 0 0.5rem; }
    p.hint { font-size: 0.85rem; opacity: 0.85; margin: 0 0 1rem; max-width: 52rem; }
    .wrap { max-width: min(1200px, 100%); margin: 0 auto; }
    .chart-box { position: relative; height: min(70vh, 560px); width: 100%; }
    label.file { display: inline-block; margin-bottom: 0.75rem; font-size: 0.85rem; }
    input[type="file"] { font-size: 0.8rem; }
    .toolbar { display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; align-items: center; margin-bottom: 0.75rem; }
    .toolbar button {
      font: inherit; font-size: 0.85rem; padding: 0.35rem 0.75rem; border-radius: 6px;
      border: 1px solid color-mix(in srgb, CanvasText 25%, transparent); background: Canvas; cursor: pointer;
    }
    .toolbar button:hover { background: color-mix(in srgb, CanvasText 8%, Canvas); }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Usage events — tokens over time (UTC)</h1>
    <p class="hint">Hover for a tooltip (all series at that time). Click legend to toggle lines. <strong>Zoom:</strong> drag a rectangle on the plot; scroll wheel while pointer is over the chart; or pinch on a trackpad. <strong>Pan:</strong> hold Shift and drag. <strong>Reset:</strong> button below or double-click the chart. Load another export via the file control.</p>
    <div class="toolbar">
      <button type="button" id="resetZoom">Reset zoom</button>
    </div>
    <label class="file">Load CSV: <input type="file" id="csvFile" accept=".csv,text/csv" /></label>
    <div class="chart-box"><canvas id="chart"></canvas></div>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns@3.0.0/dist/chartjs-adapter-date-fns.bundle.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/hammerjs@2.0.8/hammer.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom@2.2.0/dist/chartjs-plugin-zoom.min.js"></script>
  <script>
  const COLS = __COLS_JSON__;
  const EMBEDDED_ROWS = __ROWS_JSON__;

  function parseCsvText(text) {
    const lines = text.trim().split(/\\r?\\n/);
    if (lines.length < 2) return [];
    const header = splitCsvLine(lines[0]);
    const idx = (name) => header.indexOf(name);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = splitCsvLine(lines[i]);
      if (!cols.length) continue;
      const dateRaw = (cols[idx("Date")] || "").replace(/^"|"$/g, "").trim();
      if (!dateRaw) continue;
      const t = Date.parse(dateRaw);
      if (Number.isNaN(t)) continue;
      const rec = { t, label: dateRaw };
      let ok = true;
      for (const c of COLS) {
        const j = idx(c);
        let v = j < 0 ? "0" : (cols[j] || "0");
        v = v.replace(/^"|"$/g, "").trim();
        const n = parseInt(v, 10);
        if (!Number.isFinite(n)) { ok = false; break; }
        rec[c] = n;
      }
      if (ok) rows.push(rec);
    }
    rows.sort((a, b) => a.t - b.t);
    return rows;
  }

  function splitCsvLine(line) {
    const out = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === "," && !inQ) {
        out.push(cur);
        cur = "";
      } else cur += ch;
    }
    out.push(cur);
    return out;
  }

  function rowsToDatasets(rows) {
    const palette = [
      "rgb(54, 162, 235)",
      "rgb(255, 159, 64)",
      "rgb(75, 192, 192)",
      "rgb(255, 99, 132)",
      "rgb(153, 102, 255)",
    ];
    return COLS.map((label, i) => ({
      label,
      data: rows.map((r) => ({ x: r.t, y: r[label] })),
      borderColor: palette[i % palette.length],
      backgroundColor: palette[i % palette.length],
      pointRadius: 2,
      pointHoverRadius: 5,
      borderWidth: 1.5,
      tension: 0.05,
    }));
  }

  let chart;
  function onCanvasDblClick(ev) {
    ev.preventDefault();
    if (chart) chart.resetZoom();
  }

  function render(rows) {
    const canvas = document.getElementById("chart");
    const ctx = canvas.getContext("2d");
    if (chart) {
      canvas.removeEventListener("dblclick", onCanvasDblClick);
      chart.destroy();
    }
    chart = new Chart(ctx, {
      type: "line",
      data: { datasets: rowsToDatasets(rows) },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { position: "top" },
          zoom: {
            limits: {
              x: { min: "original", max: "original" },
              y: { min: "original", max: "original", minRange: 500 },
            },
            pan: {
              enabled: true,
              mode: "xy",
              modifierKey: "shift",
            },
            zoom: {
              wheel: { enabled: true, speed: 0.12 },
              pinch: { enabled: true },
              drag: {
                enabled: true,
                backgroundColor: "rgba(59, 130, 246, 0.12)",
                borderColor: "rgba(59, 130, 246, 0.55)",
                borderWidth: 1,
              },
              mode: "xy",
            },
          },
          tooltip: {
            callbacks: {
              title(items) {
                if (!items.length) return "";
                const x = items[0].parsed.x;
                return new Date(x).toISOString().replace("T", " ").replace(/\\.\\d{3}Z$/, " Z");
              },
              label(ctx) {
                const v = ctx.parsed.y;
                return ctx.dataset.label + ": " + (v == null ? "—" : v.toLocaleString());
              },
            },
          },
        },
        scales: {
          x: {
            type: "time",
            time: {
              displayFormats: {
                millisecond: "MMM d HH:mm:ss",
                second: "MMM d HH:mm:ss",
                minute: "MMM d HH:mm",
                hour: "MMM d HH:mm",
                day: "MMM d",
              },
            },
            title: { display: true, text: "Date / time (UTC)" },
          },
          y: {
            title: { display: true, text: "Tokens" },
            ticks: { callback: (v) => Number(v).toLocaleString() },
          },
        },
      },
    });
    canvas.addEventListener("dblclick", onCanvasDblClick);
  }

  document.getElementById("resetZoom").addEventListener("click", () => {
    if (chart) chart.resetZoom();
  });

  document.getElementById("csvFile").addEventListener("change", (ev) => {
    const f = ev.target.files && ev.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      const rows = parseCsvText(String(r.result || ""));
      render(rows);
    };
    r.readAsText(f);
  });

  render(EMBEDDED_ROWS.length ? EMBEDDED_ROWS : []);
  </script>
</body>
</html>
"""


def load_rows(csv_path: Path) -> list[dict]:
    rows: list[dict] = []
    with csv_path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            raw = (r.get("Date") or "").strip().strip('"')
            if not raw:
                continue
            try:
                ts = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            except ValueError:
                continue
            t_ms = int(ts.timestamp() * 1000)
            rec: dict = {"t": t_ms, "label": raw}
            ok = True
            for c in COLS:
                v = (r.get(c) or "0").strip().strip('"')
                try:
                    rec[c] = int(v)
                except ValueError:
                    ok = False
                    break
            if ok:
                rows.append(rec)
    rows.sort(key=lambda x: x["t"])
    return rows


def main() -> None:
    csv_path = CSV_DEFAULT
    if not csv_path.is_file():
        raise SystemExit(f"CSV not found: {csv_path}")
    rows = load_rows(csv_path)
    embedded = json.dumps(rows, separators=(",", ":"))
    html = (
        HTML_TEMPLATE.replace("__COLS_JSON__", json.dumps(COLS))
        .replace("__ROWS_JSON__", embedded)
    )
    OUT.write_text(html, encoding="utf-8")
    print(f"Wrote {OUT} ({len(rows)} points)")


if __name__ == "__main__":
    main()
