/**
 * Common Data Formatter
 * Story 6.1 | Owner: Swarnalakshmi Perumal | Sprint 1
 * Ref: FR-17, sub-tasks #177, #178, #179, #180
 *
 * Takes raw { columns, rows } from any connector and returns
 * the agreed common format { columns, rows, meta } that Batch 1 consumes.
 *
 * Rules (from backlog):
 *  - Mapping is applied ONCE, here, and nowhere else.
 *  - Every connector returns raw { columns, rows } — formatting happens here.
 *  - meta always includes source and rowCount.
 */

/**
 * Applies column mapping to rename raw column names to common-format names.
 * columnMapping is stored per query: { "RawColName": "CommonColName", ... }
 *
 * @param {string[]} columns      - Raw column names from the connector
 * @param {object}   columnMapping - Map of rawName → commonName
 * @returns {string[]} Renamed column array
 */
function applyColumnMapping(columns, columnMapping) {
  if (!columnMapping || typeof columnMapping !== "object") return columns;
  return columns.map((col) => columnMapping[col] || col);
}

/**
 * Formats raw connector output into the agreed common shape.
 *
 * @param {object} raw            - Raw result from connector: { columns, rows }
 * @param {string} source         - Connector name: "SQLServer" | "HANA" | "ServiceLayer"
 * @param {object} [columnMapping] - Optional column rename map from the saved query
 * @returns {{ columns: string[], rows: any[][], meta: { source: string, rowCount: number } }}
 *
 * @example
 * const result = formatResult(
 *   { columns: ["InvoiceNo", "Amount"], rows: [["INV-001", 5000]] },
 *   "HANA",
 *   { "Amount": "TotalAmount" }
 * );
 * // → { columns: ["InvoiceNo", "TotalAmount"], rows: [["INV-001", 5000]], meta: { source: "HANA", rowCount: 1 } }
 */
function formatResult(raw, source, columnMapping = {}) {
  // ── Input validation ──────────────────────────────────────────────────────
  if (!raw || typeof raw !== "object") {
    throw new Error("Formatter: raw result must be an object.");
  }

  if (!Array.isArray(raw.columns)) {
    throw new Error("Formatter: raw.columns must be an array.");
  }

  if (!Array.isArray(raw.rows)) {
    throw new Error("Formatter: raw.rows must be an array.");
  }

  if (!source || typeof source !== "string") {
    throw new Error("Formatter: source name is required.");
  }

  // ── Apply column mapping once ─────────────────────────────────────────────
  const mappedColumns = applyColumnMapping(raw.columns, columnMapping);

  // ── Ensure all rows have the same number of values as columns ─────────────
  const numCols = mappedColumns.length;
  const safeRows = raw.rows.map((row) => {
    if (!Array.isArray(row)) return new Array(numCols).fill(null);
    // Pad or trim to match column count
    if (row.length === numCols) return row;
    const adjusted = [...row];
    while (adjusted.length < numCols) adjusted.push(null);
    return adjusted.slice(0, numCols);
  });

  // ── Build and return the common format ────────────────────────────────────
  return {
    columns: mappedColumns,
    rows:    safeRows,
    meta: {
      source:   source,
      rowCount: safeRows.length,
    },
  };
}

/**
 * Checks whether a value is a valid raw connector result.
 * Used by runQuery and buildReport to validate inputs early.
 *
 * @param {any} raw
 * @returns {boolean}
 */
function isValidRaw(raw) {
  return (
    raw !== null &&
    typeof raw === "object" &&
    Array.isArray(raw.columns) &&
    Array.isArray(raw.rows)
  );
}

module.exports = {
  formatResult,
  applyColumnMapping,
  isValidRaw,
};

