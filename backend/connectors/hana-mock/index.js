/**
 * HANA Mock Engine — in-memory HANA-style SQL using better-sqlite3
 * Story 3.1, sub-tasks #79–#82 | Owner: Swarnalakshmi Perumal | Sprint 1
 *
 * Simulates SAP HANA SQL behaviour so the app works without a real HANA instance.
 * Supports:
 *   - CURRENT_DATE  (sub-task #81)
 *   - DAYS_BETWEEN(a, b)  (sub-task #81)
 *   - Quoted "SCHEMA"."TABLE" names  (sub-task #82)
 *   - LIMIT n  (sub-task #82)
 *   - ? parameters  (sub-task #82)
 *
 * Data is loaded from the shared mock-data/demo/ folder (sub-task #80).
 */

const Database = require("better-sqlite3");
const path     = require("path");
const fs       = require("fs");

const MOCK_DATA_DIR = path.resolve(__dirname, "../../../mock-data/demo");

let db; // singleton in-memory DB

/**
 * Returns the singleton in-memory SQLite DB, creating and seeding it on first call.
 */
function getDb() {
  if (db) return db;

  // ── Create in-memory DB ───────────────────────────────────────────────────
  db = new Database(":memory:");

  // ── Register HANA-compatible custom functions ─────────────────────────────

  // CURRENT_DATE() → today's date as YYYY-MM-DD string (sub-task #81)
  // SQLite has a built-in CURRENT_DATE keyword (no parentheses) that returns
  // the same value. We register HANA_CURRENT_DATE as the actual UDF and rewrite
  // CURRENT_DATE() calls in normaliseQuery() so they hit this function.
  db.function("HANA_CURRENT_DATE", () => new Date().toISOString().slice(0, 10));

  // DAYS_BETWEEN(start, end) → integer day difference (sub-task #81)
  db.function("DAYS_BETWEEN", (start, end) => {
    if (!start || !end) return null;
    const msPerDay = 86400000;
    return Math.floor((new Date(end) - new Date(start)) / msPerDay);
  });

  // ── Create tables matching FR-23 schema ──────────────────────────────────
  // NOTE: SQLite does not support "SCHEMA"."TABLE" syntax (no attached database).
  // We create plain tables and strip the "DEMO". prefix in normaliseQuery() at
  // query time, so HANA SQL like SELECT * FROM "DEMO"."INVOICES" works transparently.
  db.exec(`
    CREATE TABLE IF NOT EXISTS "INVOICES" (
      InvoiceNo     TEXT,
      CustomerCode  TEXT,
      CustomerName  TEXT,
      Email         TEXT,
      DueDate       TEXT,
      Amount        REAL,
      Paid          INTEGER
    );

    CREATE TABLE IF NOT EXISTS "PURCHASEORDERS" (
      PONumber      TEXT,
      SupplierName  TEXT,
      Email         TEXT,
      PromisedDate  TEXT,
      Status        TEXT
    );

    CREATE TABLE IF NOT EXISTS "ITEMS" (
      ItemCode      TEXT,
      ItemName      TEXT,
      QtyAvailable  REAL,
      ReorderLevel  REAL
    );

    CREATE TABLE IF NOT EXISTS "SALESSUMMARY" (
      Date          TEXT,
      Branch        TEXT,
      TotalSales    REAL,
      Orders        INTEGER
    );
  `);

  // ── Load from shared mock-data folder (sub-task #80) ─────────────────────
  _loadTable("INVOICES",       "invoices.json",       [
    "InvoiceNo","CustomerCode","CustomerName","Email","DueDate","Amount","Paid"
  ]);
  _loadTable("PURCHASEORDERS", "purchaseOrders.json",  [
    "PONumber","SupplierName","Email","PromisedDate","Status"
  ]);
  _loadTable("ITEMS",          "items.json",           [
    "ItemCode","ItemName","QtyAvailable","ReorderLevel"
  ]);
  _loadTable("SALESSUMMARY",   "salesSummary.json",    [
    "Date","Branch","TotalSales","Orders"
  ]);

  return db;
}

/**
 * Loads a JSON file from mock-data/demo/ and inserts rows into the in-memory table.
 */
function _loadTable(tableName, fileName, columns) {
  const filePath = path.join(MOCK_DATA_DIR, fileName);

  if (!fs.existsSync(filePath)) {
    console.warn(`[HANA Mock] Warning: mock data file not found: ${filePath}`);
    return;
  }

  const rows = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const placeholders = columns.map(() => "?").join(", ");
  const insert = db.prepare(
    `INSERT INTO "${tableName}" (${columns.join(", ")}) VALUES (${placeholders})`
  );

  const insertMany = db.transaction((data) => {
    for (const row of data) {
      const values = columns.map((col) => {
        const val = row[col];
        // SQLite stores booleans as integers
        if (typeof val === "boolean") return val ? 1 : 0;
        return val !== undefined ? val : null;
      });
      insert.run(values);
    }
  });

  insertMany(rows);
  console.log(`[HANA Mock] Loaded ${rows.length} rows into ${tableName}`);
}

/**
 * Translates HANA-style SQL to SQLite-compatible SQL.
 *
 * Transformations applied (sub-task #82):
 *  1. Strip "DEMO". schema prefix — SQLite has no schema concept; tables are plain.
 *     "DEMO"."INVOICES" → "INVOICES"
 *  2. Rewrite CURRENT_DATE / CURRENT_DATE() → HANA_CURRENT_DATE() so the registered
 *     SQLite UDF is called correctly (SQLite's built-in CURRENT_DATE keyword cannot
 *     be overridden as a user function).
 *
 * sub-task #82
 */
function normaliseQuery(sql) {
  // 1. Remove schema prefix: "DEMO"."TABLE" → "TABLE"  (or DEMO."TABLE" → "TABLE")
  let result = sql.replace(/"DEMO"\."([^"]+)"/g, '"$1"');
  result     = result.replace(/\bDEMO\."([^"]+)"/g, '"$1"');
  // 2. CURRENT_DATE() or bare CURRENT_DATE → HANA_CURRENT_DATE()
  result = result.replace(/\bCURRENT_DATE\s*\(\s*\)/g, "HANA_CURRENT_DATE()");
  result = result.replace(/\bCURRENT_DATE\b/g, "HANA_CURRENT_DATE()");
  return result;
}

/**
 * Executes a HANA-style SQL query on the in-memory mock database.
 *
 * @param {string}   sql    - SQL text (may contain ?, CURRENT_DATE, DAYS_BETWEEN, quoted names)
 * @param {any[]}    params - Values for ? placeholders (sub-task #82)
 * @param {number}   limit  - Max rows to return
 * @returns {{ columns: string[], rows: any[][] }}
 */
function query(sql, params = [], limit = 1000) {
  const engine = getDb();
  const normalisedSql = normaliseQuery(sql);

  // Apply LIMIT if not already in query (sub-task #82)
  const hasLimit = /\bLIMIT\b/i.test(normalisedSql);
  const finalSql = hasLimit ? normalisedSql : `${normalisedSql} LIMIT ${limit}`;

  const stmt = engine.prepare(finalSql);
  const rawRows = stmt.all(...params);

  if (rawRows.length === 0) {
    // Return empty result with correct column names
    const cols = stmt.columns ? stmt.columns().map((c) => c.name) : [];
    return { columns: cols, rows: [] };
  }

  const columns = Object.keys(rawRows[0]);
  const rows    = rawRows.map((row) => columns.map((col) => row[col]));

  return { columns, rows };
}

/**
 * Tests whether the mock engine is reachable (always true for in-memory DB).
 * @returns {{ ok: boolean, message: string }}
 */
function testConnection() {
  try {
    getDb(); // triggers seeding if not done yet
    return { ok: true, message: "HANA mock engine is running." };
  } catch (err) {
    return { ok: false, message: `HANA mock error: ${err.message}` };
  }
}

module.exports = { query, testConnection, getDb };
