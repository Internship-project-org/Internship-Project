/**
 * HANA Mock Engine — in-memory HANA-style SQL using pure JavaScript (alasql)
 * Story 3.1, sub-tasks #79–#82 | Owner: Swarnalakshmi Perumal | Sprint 1
 *
 * Simulates SAP HANA SQL behaviour so the app works without a real HANA instance.
 * Built using alasql (100% pure JavaScript - zero C++ compiler / python requirements).
 *
 * Supports:
 *   - CURRENT_DATE / CURRENT_DATE() (sub-task #81)
 *   - DAYS_BETWEEN(a, b)            (sub-task #81)
 *   - Quoted "SCHEMA"."TABLE"       (sub-task #82)
 *   - LIMIT n                       (sub-task #82)
 *   - ? parameters                  (sub-task #82)
 *
 * Data is loaded from the shared mock-data/demo/ folder (sub-task #80).
 */

const alasql = require("alasql");
const path   = require("path");
const fs     = require("fs");

const MOCK_DATA_DIR = path.resolve(__dirname, "../../../mock-data/demo");

let initialised = false;

/**
 * Initialises the mock database and loads the JSON datasets.
 */
function initDb() {
  if (initialised) return;

  // ── Register custom HANA functions ──────────────────────────────────────────

  // CURRENT_DATE / CURRENT_DATE() → YYYY-MM-DD
  alasql.fn.CURRENT_DATE = () => new Date().toISOString().slice(0, 10);
  alasql.fn.HANA_CURRENT_DATE = () => new Date().toISOString().slice(0, 10);

  // DAYS_BETWEEN(start, end) → integer difference in days
  alasql.fn.DAYS_BETWEEN = (start, end) => {
    if (!start || !end) return null;
    const msPerDay = 86400000;
    return Math.floor((new Date(end) - new Date(start)) / msPerDay);
  };

  // ── Create in-memory tables ───────────────────────────────────────────────
  alasql(`
    CREATE TABLE IF NOT EXISTS INVOICES (
      InvoiceNo STRING,
      CustomerCode STRING,
      CustomerName STRING,
      Email STRING,
      DueDate STRING,
      Amount FLOAT,
      Paid INT
    );

    CREATE TABLE IF NOT EXISTS PURCHASEORDERS (
      PONumber STRING,
      SupplierName STRING,
      Email STRING,
      PromisedDate STRING,
      Status STRING
    );

    CREATE TABLE IF NOT EXISTS ITEMS (
      ItemCode STRING,
      ItemName STRING,
      QtyAvailable FLOAT,
      ReorderLevel FLOAT
    );

    CREATE TABLE IF NOT EXISTS SALESSUMMARY (
      Date STRING,
      Branch STRING,
      TotalSales FLOAT,
      Orders INT
    );
  `);

  // ── Seed data from mock-data/demo/ ─────────────────────────────────────────
  _loadTable("INVOICES", "invoices.json");
  _loadTable("PURCHASEORDERS", "purchaseOrders.json");
  _loadTable("ITEMS", "items.json");
  _loadTable("SALESSUMMARY", "salesSummary.json");

  initialised = true;
}

/**
 * Loads a JSON file from mock-data/demo/ into an alasql table.
 */
function _loadTable(tableName, fileName) {
  const filePath = path.join(MOCK_DATA_DIR, fileName);

  if (!fs.existsSync(filePath)) {
    console.warn(`[HANA Mock] Warning: mock data file not found: ${filePath}`);
    return;
  }

  const rows = JSON.parse(fs.readFileSync(filePath, "utf8"));
  // Convert boolean fields to integers if any
  const sanitized = rows.map((row) => {
    const copy = { ...row };
    for (const [key, val] of Object.entries(copy)) {
      if (typeof val === "boolean") copy[key] = val ? 1 : 0;
    }
    return copy;
  });

  alasql.tables[tableName].data = sanitized;
  console.log(`[HANA Mock] Loaded ${sanitized.length} rows into ${tableName}`);
}

/**
 * Translates HANA-style SQL to alasql-compatible SQL.
 */
function normaliseQuery(sql) {
  if (!sql) return "";
  let result = sql;

  // 1. Strip "DEMO". or DEMO. schema prefix: "DEMO"."INVOICES" -> INVOICES
  result = result.replace(/"DEMO"\."([^"]+)"/gi, "$1");
  result = result.replace(/\bDEMO\."([^"]+)"/gi, "$1");
  result = result.replace(/"DEMO"\.([a-zA-Z0-9_]+)/gi, "$1");
  result = result.replace(/\bDEMO\.([a-zA-Z0-9_]+)/gi, "$1");

  // 2. Unquote double quoted identifiers: "INVOICES" -> INVOICES
  result = result.replace(/"([a-zA-Z0-9_]+)"/g, "$1");

  // 3. Normalise CURRENT_DATE / CURRENT_DATE() to function call
  result = result.replace(/\bCURRENT_DATE\s*\(\s*\)/gi, "CURRENT_DATE()");
  result = result.replace(/\bCURRENT_DATE\b(?!\s*\()/gi, "CURRENT_DATE()");

  return result;
}

/**
 * Executes a query on the in-memory mock database.
 *
 * @param {string} sql - SQL string
 * @param {any[]} params - Parameter values
 * @param {number} limit - Row limit
 * @returns {{ columns: string[], rows: any[][] }}
 */
function query(sql, params = [], limit = 1000) {
  initDb();
  let normalisedSql = normaliseQuery(sql);

  // Apply LIMIT if not present
  if (!/\bLIMIT\b/i.test(normalisedSql)) {
    normalisedSql = `${normalisedSql} LIMIT ${limit}`;
  }

  let rawRows;
  try {
    rawRows = alasql(normalisedSql, params);
  } catch (err) {
    throw new Error(`HANA Mock SQL error: ${err.message}`);
  }

  if (!rawRows || !Array.isArray(rawRows) || rawRows.length === 0) {
    return { columns: [], rows: [] };
  }

  const columns = Object.keys(rawRows[0]);
  const rows = rawRows.map((row) => columns.map((col) => (row[col] !== undefined ? row[col] : null)));

  return { columns, rows };
}

/**
 * Tests whether the mock engine is reachable.
 * @returns {{ ok: boolean, message: string }}
 */
function testConnection() {
  try {
    initDb();
    return { ok: true, message: "HANA mock engine is running." };
  } catch (err) {
    return { ok: false, message: `HANA mock error: ${err.message}` };
  }
}

module.exports = { query, testConnection, initDb };
