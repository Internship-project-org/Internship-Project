/**
 * Manual Test Script — Sprint 1 (Stories 3.1, 6.1, 6.2, 6.3, 6.4)
 * Owner: Swarnalakshmi Perumal
 *
 * Run from backend/ folder:
 *   node tests/manual/sprint1_manual_test.js
 *
 * What it tests:
 *  1. HANA Mock Engine — testConnection, all 4 tables, LIMIT, params, CURRENT_DATE, DAYS_BETWEEN
 *  2. Formatter        — formatResult with and without column mapping
 *  3. buildReport      — CSV file + Excel file generation
 *  4. Full pipeline    — mock query → format → build CSV report (end-to-end)
 */

const path = require("path");
const fs   = require("fs");

(async () => {  // ← wrap everything in async IIFE (project uses CommonJS, not ESM)

// ─── Colour helpers (no external deps) ───────────────────────────────────────
const G  = (s) => `\x1b[32m✅ ${s}\x1b[0m`;
const R  = (s) => `\x1b[31m❌ ${s}\x1b[0m`;
const Y  = (s) => `\x1b[33m⚠️  ${s}\x1b[0m`;
const H  = (s) => `\n\x1b[1m\x1b[36m━━━ ${s} ━━━\x1b[0m`;

let passed = 0, failed = 0;

function ok(label) { console.log(G(label)); passed++; }
function fail(label, err) { console.log(R(`${label} — ${err?.message || err}`)); failed++; }

// ─── 1. HANA MOCK ENGINE ─────────────────────────────────────────────────────
console.log(H("1. HANA Mock Engine (Story 3.1)"));

const hana = require("../../connectors/hana");
const CONN = {}; // unused by mock

try {
  const r = await hana.testConnection(CONN);
  if (r.ok) ok(`testConnection → ok:true, message: "${r.message}"`);
  else       fail("testConnection", `ok:false, message: ${r.message}`);
} catch(e) { fail("testConnection", e); }

// Helper
async function runSQL(sql, params = {}) {
  return hana.executeQuery(CONN, { queryText: sql, params: [] }, params, { limit: 1000 });
}

// All 4 tables
for (const [name, sql] of [
  ["INVOICES",       `SELECT * FROM "DEMO"."INVOICES" LIMIT 3`],
  ["PURCHASEORDERS", `SELECT * FROM "DEMO"."PURCHASEORDERS" LIMIT 3`],
  ["ITEMS",          `SELECT * FROM "DEMO"."ITEMS" LIMIT 3`],
  ["SALESSUMMARY",   `SELECT * FROM "DEMO"."SALESSUMMARY" LIMIT 3`],
]) {
  try {
    const r = await runSQL(sql);
    console.log(`   ${name}: ${r.columns.length} cols, ${r.rows.length} rows  → cols: [${r.columns.join(", ")}]`);
    ok(`SELECT ${name}`);
  } catch(e) { fail(`SELECT ${name}`, e); }
}

// LIMIT
try {
  const r = await runSQL(`SELECT * FROM "DEMO"."INVOICES" LIMIT 2`);
  if (r.rows.length === 2) ok("LIMIT 2 → exactly 2 rows returned");
  else fail("LIMIT 2", `got ${r.rows.length} rows`);
} catch(e) { fail("LIMIT 2", e); }

// ? param binding
try {
  const all   = await runSQL(`SELECT CustomerCode FROM "DEMO"."INVOICES" LIMIT 1`);
  const code  = all.rows[0][0];
  const r     = await hana.executeQuery(
    CONN,
    { queryText: `SELECT * FROM "DEMO"."INVOICES" WHERE CustomerCode = ? LIMIT 5`, params: [] },
    { code },
    { limit: 5 }
  );
  const idx = r.columns.indexOf("CustomerCode");
  const allMatch = r.rows.every(row => row[idx] === code);
  if (allMatch) ok(`? param binding → filtered to CustomerCode=${code}`);
  else fail("? param binding", `some rows have wrong code`);
} catch(e) { fail("? param binding", e); }

// CURRENT_DATE()
try {
  const r = await runSQL(`SELECT CURRENT_DATE() AS today`);
  const d = r.rows[0][0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) ok(`CURRENT_DATE() → "${d}"`);
  else fail("CURRENT_DATE()", `got "${d}"`);
} catch(e) { fail("CURRENT_DATE()", e); }

// DAYS_BETWEEN
try {
  const r = await runSQL(`SELECT DAYS_BETWEEN('2026-01-01', '2026-01-11') AS diff`);
  const d = r.rows[0][0];
  if (d === 10) ok(`DAYS_BETWEEN('2026-01-01','2026-01-11') → 10`);
  else fail("DAYS_BETWEEN", `got ${d}`);
} catch(e) { fail("DAYS_BETWEEN", e); }

// Read-only safety
try {
  await runSQL(`INSERT INTO "DEMO"."INVOICES" VALUES ('X','X','X','X','X',0,0)`);
  fail("INSERT blocked?", "should have thrown but did not");
} catch(e) {
  if (/blocked/i.test(e.message)) ok(`INSERT correctly blocked by validator`);
  else fail("INSERT blocked", `threw but wrong message: ${e.message}`);
}

// ─── 2. FORMATTER ────────────────────────────────────────────────────────────
console.log(H("2. Common Data Formatter (Story 6.1)"));

const { formatResult, applyColumnMapping, isValidRaw } = require("../../core/formatter");

try {
  const raw = { columns: ["InvoiceNo","Amount"], rows: [["INV-001",5000]] };
  const r   = formatResult(raw, "HANA");
  const ok_ = r.columns.length === 2 && r.rows[0][1] === 5000 &&
              r.meta.source === "HANA" && r.meta.rowCount === 1;
  if (ok_) ok(`formatResult basic → columns:${JSON.stringify(r.columns)}, rowCount:${r.meta.rowCount}`);
  else     fail("formatResult basic", "shape mismatch");
} catch(e) { fail("formatResult basic", e); }

try {
  const raw = { columns: ["InvoiceNo","Amount"], rows: [["INV-001",5000]] };
  const r   = formatResult(raw, "HANA", { Amount: "TotalAmount" });
  if (r.columns[1] === "TotalAmount") ok(`Column mapping: Amount → TotalAmount`);
  else fail("Column mapping", `got ${r.columns[1]}`);
} catch(e) { fail("Column mapping", e); }

try {
  const raw = { columns: ["A","B","C"], rows: [["x"]] };
  const r   = formatResult(raw, "HANA");
  if (JSON.stringify(r.rows[0]) === JSON.stringify(["x",null,null]))
    ok(`Short row padded → ["x", null, null]`);
  else fail("Row padding", `got ${JSON.stringify(r.rows[0])}`);
} catch(e) { fail("Row padding", e); }

try {
  formatResult({ columns:[], rows:[] }, null);
  fail("Missing source should throw", "did not throw");
} catch(e) {
  if (/source/i.test(e.message)) ok(`Missing source correctly throws`);
  else fail("Missing source", `wrong error: ${e.message}`);
}

// ─── 3. REPORT GENERATION (CSV + Excel) ──────────────────────────────────────
console.log(H("3. Report Generation — CSV & Excel (Stories 6.3 & 6.4)"));

const { buildReport } = require("../../reports/buildReport");

const sampleResult = {
  columns: ["InvoiceNo","CustomerName","Amount","Paid"],
  rows: [
    ["INV-001","Acme Corp",85000,0],
    ["INV-002","Beta Ltd",32000,1],
    ["INV-003","Gamma GmbH",47000,0],
  ],
  meta: { source: "HANA", rowCount: 3 },
};

let csvPath, xlsxPath;

try {
  csvPath = await buildReport(sampleResult, "csv");
  const exists  = fs.existsSync(csvPath);
  const content = fs.readFileSync(csvPath, "utf8").replace(/^\uFEFF/,"");
  const lines   = content.trim().split("\n");
  console.log(`   CSV saved: ${csvPath}`);
  console.log(`   Header row: ${lines[0].trim()}`);
  console.log(`   Data rows:  ${lines.length - 1}`);
  if (exists && lines[0].includes("InvoiceNo") && lines.length === 4)
    ok("CSV report created with correct header + 3 data rows");
  else fail("CSV report", `lines=${lines.length}, header=${lines[0]}`);
} catch(e) { fail("CSV report", e); }

try {
  xlsxPath = await buildReport(sampleResult, "xlsx");
  const stats = fs.statSync(xlsxPath);
  const buf   = Buffer.alloc(2);
  const fd    = fs.openSync(xlsxPath, "r");
  fs.readSync(fd, buf, 0, 2, 0); fs.closeSync(fd);
  const isPK  = buf[0] === 0x50 && buf[1] === 0x4B;
  console.log(`   XLSX saved: ${xlsxPath}`);
  console.log(`   File size:  ${stats.size} bytes`);
  if (isPK) ok("XLSX report created — valid ZIP/XLSX magic bytes (PK)");
  else fail("XLSX report", "file does not start with PK bytes");
} catch(e) { fail("XLSX report", e); }

// Formula injection
try {
  const injResult = {
    columns: ["Name","Cmd"],
    rows: [["=EVIL","=CMD|' /C calc'!A0"]],
    meta: { source:"HANA", rowCount:1 },
  };
  const p = await buildReport(injResult, "csv");
  const content = fs.readFileSync(p, "utf8").replace(/^\uFEFF/,"");
  const hasRaw  = /^=EVIL/m.test(content) || /^=CMD/m.test(content);
  if (!hasRaw) ok("Formula injection neutralised in CSV");
  else fail("Formula injection", "raw formula found in CSV!");
  fs.unlinkSync(p);
} catch(e) { fail("Formula injection CSV", e); }

// ─── 4. END-TO-END PIPELINE ──────────────────────────────────────────────────
console.log(H("4. End-to-End Pipeline: HANA Query → Format → CSV Report"));

try {
  // Step 1: run a HANA query
  const raw = await runSQL(`SELECT * FROM "DEMO"."INVOICES" WHERE Paid = 0 LIMIT 5`);
  console.log(`   Step 1 ✓  Got ${raw.rows.length} unpaid invoices from mock`);

  // Step 2: format
  const formatted = formatResult(raw, "HANA");
  console.log(`   Step 2 ✓  Formatted → ${formatted.meta.rowCount} rows, source: ${formatted.meta.source}`);

  // Step 3: build CSV
  const fp = await buildReport(formatted, "csv");
  const lines = fs.readFileSync(fp, "utf8").replace(/^\uFEFF/,"").trim().split("\n");
  console.log(`   Step 3 ✓  CSV written: ${fp}`);
  console.log(`             Preview of header: ${lines[0].trim()}`);
  console.log(`             Preview of row 1:  ${lines[1]?.trim()}`);

  ok("Full pipeline: HANA query → format → CSV");
  console.log(`\n   📄 Open this file to see the report:\n   ${fp}\n`);
} catch(e) { fail("End-to-end pipeline", e); }

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${"═".repeat(55)}`);
console.log(`  Sprint 1 Manual Test Summary`);
console.log(`${"═".repeat(55)}`);
console.log(G(`PASSED: ${passed}`));
if (failed > 0) console.log(R(`FAILED: ${failed}`));
else console.log(`\x1b[32m  All tests passed! 🎉\x1b[0m`);
console.log(`${"═".repeat(55)}\n`);

// Cleanup generated report files
if (csvPath  && fs.existsSync(csvPath))  fs.unlinkSync(csvPath);
if (xlsxPath && fs.existsSync(xlsxPath)) fs.unlinkSync(xlsxPath);

})(); // end async IIFE
