/**
 * SAP HANA Connector
 * Story 3.1 & 3.2 | Owner: Swarnalakshmi Perumal | Sprint 1 & 2
 * Ref: FR-06, sub-tasks #75–#84, #86–#92
 *
 * Provides:
 *   - executeQuery(connectionDetails, queryDoc, params, options) → { columns, rows }
 *   - testConnection(connectionDetails) → { ok, message }
 *
 * Strategy:
 *   If @sap/hana-client is available → use real HANA.
 *   Otherwise → fall back to the in-memory HANA mock (better-sqlite3).
 *
 * Rules:
 *   - Accepts DECRYPTED connection details from executeQuery.js (never decrypts itself).
 *   - Calls the shared validator BEFORE execution (sub-task #89).
 *   - Applies timeout and row limit from shared config (sub-task #90).
 *   - Returns raw { columns, rows } — formatting happens in formatter.js (sub-task #91).
 */

const { validateQuerySafety } = require("../security/validator");
const { sanitizeError }       = require("../security/sanitiser");

// ── Attempt to load real HANA client, fall back to mock ──────────────────────
let hanaClient = null;
let usingMock  = false;

try {
  hanaClient = require("@sap/hana-client");
  usingMock  = false;
  console.log("[HANA Connector] Using real @sap/hana-client");
} catch {
  hanaClient = require("./hana-mock");
  usingMock  = true;
  console.log("[HANA Connector] @sap/hana-client not available — using HANA mock engine");
}

// ── Timeout helper ────────────────────────────────────────────────────────────
const DEFAULT_TIMEOUT_MS = parseInt(process.env.QUERY_TIMEOUT_MS) || 30000;

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Query timed out after ${ms / 1000} seconds.`)),
      ms
    );
    promise
      .then((val) => { clearTimeout(timer); resolve(val); })
      .catch((err) => { clearTimeout(timer); reject(err); });
  });
}

// ── Mock execution ────────────────────────────────────────────────────────────
/**
 * Runs the query on the HANA mock engine (better-sqlite3).
 * sub-tasks #79–#82, #86–#88
 */
async function runOnMock(queryDoc, params, limit) {
  const sql = queryDoc.queryText;

  // Build ordered ? values from the params object
  const paramValues = _buildParamValues(sql, params);

  const raw = hanaClient.query(sql, paramValues, limit);
  return raw; // { columns, rows }
}

// ── Real HANA execution ───────────────────────────────────────────────────────
/**
 * Runs the query on a real SAP HANA instance via @sap/hana-client.
 * sub-tasks #75–#78, #86–#88
 */
async function runOnRealHana(connectionDetails, queryDoc, params, limit) {
  return new Promise((resolve, reject) => {
    const conn = hanaClient.createConnection();

    const connParams = {
      host:         connectionDetails.host,
      port:         connectionDetails.port || 30015,
      uid:          connectionDetails.username,
      pwd:          connectionDetails.password,   // already decrypted
      databaseName: connectionDetails.database,
    };

    conn.connect(connParams, (connectErr) => {
      if (connectErr) return reject(connectErr);

      let sql = queryDoc.queryText;

      // Apply LIMIT if not in query (HANA uses LIMIT n, sub-task #87)
      if (!/\bLIMIT\b/i.test(sql)) {
        sql = `${sql} LIMIT ${limit}`;
      }

      const paramValues = _buildParamValues(sql, params);

      conn.exec(sql, paramValues, (execErr, rows) => {
        conn.disconnect();

        if (execErr) return reject(execErr);

        if (!rows || rows.length === 0) {
          return resolve({ columns: [], rows: [] });
        }

        const columns = Object.keys(rows[0]);
        const rawRows = rows.map((row) => columns.map((col) => row[col]));
        resolve({ columns, rows: rawRows });
      });
    });
  });
}

// ── Param builder ─────────────────────────────────────────────────────────────
/**
 * Extracts ordered values for ? placeholders from the params object.
 * HANA uses positional ? parameters (sub-task #88).
 *
 * @param {string} sql    - SQL text
 * @param {object} params - Merged params: { paramName: value }
 * @returns {any[]} Ordered values
 */
function _buildParamValues(sql, params) {
  if (!params || typeof params !== "object") return [];
  const questionMarks = (sql.match(/\?/g) || []).length;
  if (questionMarks === 0) return [];
  // Return values in insertion order (the caller is responsible for order)
  return Object.values(params).slice(0, questionMarks);
}

// ── Public: executeQuery ──────────────────────────────────────────────────────
/**
 * Executes a HANA SQL query. Called by core/executeQuery.js.
 *
 * @param {object} connectionDetails - Decrypted connection { host, port, username, password, database }
 * @param {object} queryDoc          - Saved query { queryText, params, ... }
 * @param {object} mergedParams      - Runtime + saved params merged
 * @param {object} options           - { limit: number }
 * @returns {Promise<{ columns: string[], rows: any[][] }>}
 */
async function executeQuery(connectionDetails, queryDoc, mergedParams, options = {}) {
  const limit = options.limit || 1000;

  // ── Validate before execution (sub-task #89) ─────────────────────────────
  const validation = validateQuerySafety({
    kind:      "sql",
    queryText: queryDoc.queryText,
    params:    queryDoc.params,
  });

  if (!validation.valid) {
    throw new Error(`HANA query blocked: ${validation.error}`);
  }

  try {
    let raw;

    if (usingMock) {
      raw = await withTimeout(
        runOnMock(queryDoc, mergedParams, limit),
        DEFAULT_TIMEOUT_MS
      );
    } else {
      raw = await withTimeout(
        runOnRealHana(connectionDetails, queryDoc, mergedParams, limit),
        DEFAULT_TIMEOUT_MS
      );
    }

    // ── Enforce row limit (sub-task #90) ─────────────────────────────────
    if (raw.rows.length > limit) {
      raw.rows = raw.rows.slice(0, limit);
    }

    return raw; // { columns, rows } — formatter handles the rest

  } catch (err) {
    const safe = sanitizeError(err);
    throw new Error(`HANA execution failed: ${safe.message}`);
  }
}

// ── Public: testConnection ────────────────────────────────────────────────────
/**
 * Tests whether the HANA connection (real or mock) is reachable.
 * sub-task #83
 *
 * @param {object} connectionDetails - Decrypted connection details
 * @returns {Promise<{ ok: boolean, message: string }>}
 */
async function testConnection(connectionDetails) {
  if (usingMock) {
    return hanaClient.testConnection();
  }

  // Real HANA test
  return new Promise((resolve) => {
    const conn = hanaClient.createConnection();

    const connParams = {
      host:         connectionDetails.host,
      port:         connectionDetails.port || 30015,
      uid:          connectionDetails.username,
      pwd:          connectionDetails.password,
      databaseName: connectionDetails.database,
    };

    conn.connect(connParams, (err) => {
      conn.disconnect();
      if (err) {
        const safe = sanitizeError(err);
        resolve({ ok: false, message: safe.message });
      } else {
        resolve({ ok: true, message: "SAP HANA connection successful." });
      }
    });
  });
}

module.exports = { executeQuery, testConnection };

