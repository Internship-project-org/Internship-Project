/**
 * runQuery — Public interface for Batch 1
 * Story 6.2 | Owner: Swarnalakshmi Perumal | Sprint 1
 * Ref: FR-17, sub-tasks #183, #187
 *
 * This is the ONE function Batch 1 calls to get data.
 * It is a thin wrapper over executeQuery.
 *
 * Usage (from Batch 1 / notification engine):
 *   const { runQuery } = require("./core/runQuery");
 *   const result = await runQuery(queryId, { asOfDate: "2026-11-01" });
 *   // result → { columns, rows, meta }
 *
 * Contract (agreed with Batch 1 — do NOT change without telling them):
 *   runQuery(queryId, params) → { columns: string[], rows: any[][], meta: { source, rowCount } }
 */

const Query           = require("../models/Query");
const { executeQuery } = require("./executeQuery");
const { sanitizeError } = require("../security/sanitiser");

/**
 * Loads a saved query by ID and executes it against its data source.
 *
 * @param {string} queryId      - MongoDB ObjectId of the saved query
 * @param {object} runtimeParams - Runtime params from Batch 1: { paramName: value }
 * @returns {Promise<{ columns: string[], rows: any[][], meta: { source: string, rowCount: number } }>}
 *
 * @example
 * const result = await runQuery("672abc123def456", { asOfDate: "2026-11-01" });
 * // → { columns: ["InvoiceNo", "CustomerName", "DaysOverdue"], rows: [...], meta: { source: "HANA", rowCount: 42 } }
 */
async function runQuery(queryId, runtimeParams = {}) {
  // ── Validate queryId ───────────────────────────────────────────────────────
  if (!queryId) {
    throw new Error("runQuery: queryId is required.");
  }

  let queryDoc;

  try {
    // ── Load the saved query ──────────────────────────────────────────────────
    queryDoc = await Query.findById(queryId).lean();

    if (!queryDoc) {
      throw new Error(`Query not found: '${queryId}'.`);
    }

    // ── Delegate to executeQuery ──────────────────────────────────────────────
    // No row-limit override here — uses the query's saved rowLimit (or global cap)
    const result = await executeQuery(queryDoc, runtimeParams);

    return result;

  } catch (err) {
    // Always sanitise errors before they leave this module (FR-18)
    const safe = sanitizeError(err);
    throw new Error(safe.message);
  }
}

module.exports = { runQuery };

