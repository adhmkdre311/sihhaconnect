#!/usr/bin/env bun
/**
 * Generate a styled HTML acceptance report from acceptance-summary.json.
 *
 *   bun run acceptance:report
 *   bun run acceptance:report -- --input summary.json --output report.html
 *
 * This is intended to run after `bun run acceptance -- --json` in CI.
 */
import { readFileSync, writeFileSync } from "node:fs";

const argv = process.argv.slice(2);
const value = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};

const input = value("input") ?? "acceptance-summary.json";
const output = value("output") ?? "acceptance-report.html";

let data: {
  ok?: boolean;
  passed?: number;
  failed?: number;
  skipped?: number;
  results?: { name: string; status: "pass" | "fail" | "skip"; detail?: string; ms: number }[];
};

try {
  data = JSON.parse(readFileSync(input, "utf8"));
} catch (err) {
  console.error(`Failed to read ${input}: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}

const results = data.results ?? [];
const passed = data.passed ?? results.filter((r) => r.status === "pass").length;
const failed = data.failed ?? results.filter((r) => r.status === "fail").length;
const skipped = data.skipped ?? results.filter((r) => r.status === "skip").length;
const overall = data.ok ? "PASS" : "FAIL";

const statusClass = {
  pass: "pass",
  fail: "fail",
  skip: "skip",
} as const;

const statusLabel = {
  pass: "PASS",
  fail: "FAIL",
  skip: "SKIP",
} as const;

const rows = results
  .map(
    (r) => `
    <tr class="${statusClass[r.status]}">
      <td class="status">${statusLabel[r.status]}</td>
      <td class="name">${escapeHtml(r.name)}</td>
      <td class="detail">${escapeHtml(r.detail ?? "—")}</td>
      <td class="time">${r.ms}ms</td>
    </tr>
  `,
  )
  .join("");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Sihha §9.4 Acceptance Report</title>
  <style>
    :root {
      --bg: #f8f8f6;
      --surface: #ffffff;
      --text: #1a1a1a;
      --muted: #6b7280;
      --border: #e5e5e0;
      --pass: #0d9488;
      --pass-bg: #ecfdf5;
      --fail: #dc2626;
      --fail-bg: #fef2f2;
      --skip: #d97706;
      --skip-bg: #fffbeb;
      --accent: #0d9488;
    }
    * { box-sizing: border-box; }
    body {
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: var(--bg);
      color: var(--text);
      margin: 0;
      padding: 2rem;
    }
    .container {
      max-width: 1100px;
      margin: 0 auto;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 2rem;
      flex-wrap: wrap;
    }
    h1 { font-size: 1.5rem; font-weight: 600; margin: 0; }
    .overall {
      font-size: 0.875rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 0.5rem 1rem;
      border-radius: 9999px;
      color: #fff;
    }
    .overall.pass { background: var(--pass); }
    .overall.fail { background: var(--fail); }
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 0.75rem;
      padding: 1rem;
      text-align: center;
    }
    .card .number { font-size: 2rem; font-weight: 700; line-height: 1; }
    .card .label { font-size: 0.75rem; color: var(--muted); margin-top: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em; }
    .card.pass .number { color: var(--pass); }
    .card.fail .number { color: var(--fail); }
    .card.skip .number { color: var(--skip); }
    table {
      width: 100%;
      border-collapse: collapse;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 0.75rem;
      overflow: hidden;
    }
    th, td { padding: 0.75rem 1rem; text-align: left; font-size: 0.875rem; }
    th { background: #fafaf9; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.03em; font-size: 0.75rem; }
    tr:not(:last-child) td { border-bottom: 1px solid var(--border); }
    td.status { font-weight: 700; width: 80px; }
    td.time { width: 80px; color: var(--muted); text-align: right; }
    tr.pass td.status { color: var(--pass); }
    tr.fail td.status { color: var(--fail); }
    tr.skip td.status { color: var(--skip); }
    tr.pass { background: var(--pass-bg); }
    tr.fail { background: var(--fail-bg); }
    tr.skip { background: var(--skip-bg); }
    td.detail { color: var(--muted); word-break: break-word; }
    footer { margin-top: 2rem; color: var(--muted); font-size: 0.75rem; text-align: center; }
    @media (max-width: 640px) {
      body { padding: 1rem; }
      .detail { display: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Sihha §9.4 Acceptance Report</h1>
      <div class="overall ${overall.toLowerCase()}">${overall}</div>
    </header>
    <div class="cards">
      <div class="card pass"><div class="number">${passed}</div><div class="label">Passed</div></div>
      <div class="card fail"><div class="number">${failed}</div><div class="label">Failed</div></div>
      <div class="card skip"><div class="number">${skipped}</div><div class="label">Skipped</div></div>
      <div class="card"><div class="number">${results.length}</div><div class="label">Total</div></div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Status</th>
          <th>Check</th>
          <th>Detail</th>
          <th>Time</th>
        </tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="4" style="text-align:center;color:var(--muted)">No results</td></tr>'}
      </tbody>
    </table>
    <footer>Generated ${new Date().toUTCString()} · Sihha Connect</footer>
  </div>
</body>
</html>`;

writeFileSync(output, html, "utf8");
console.log(`Wrote ${output} (${overall}: ${passed} passed, ${failed} failed, ${skipped} skipped)`);

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
