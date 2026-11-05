/**
 * executeQuery — Internal query execution engine
 * Story 6.2 | Owner: Swarnalakshmi Perumal | Sprint 1
 * Ref: FR-17, FR-18, sub-tasks #182, #184, #185, #186
 *
 * Orchestrates the full pipeline for one query execution:
 *   1. Load the saved query document
 *   2. Load its connection and decrypt the password
 *   3. Validate the query (shared validator)
 *   4. Pick the right connector (HANA / SQL Server / Service Layer)
 *   5. Run the query
 *   6. Format the result into the common shape
 *
 * Used internally by runQuery() and by the Test Query API (Rohit, Story 5.2).
 */

const { decryptPassword }     = require("../security/crypto");
const { validateQuerySafety } = require("../security/validator");
const { sanitizeError }       = require("../security/sanitiser");
const { formatResult }        = require("./formatter");
const Connection              = require("../models/Connection");
const Query                   = require("../models/Query");

// ── Connector registry ────────────────────────────────────────────────────────
// Each connector is loaded lazily so the server starts even if one is missing.
function getConnector(type) {
  const connectorMap = {
    "SAP HANA":    () => require("../connectors/hana"),
    "SQL Server":  () => require("../connectors/sqlserver"),
    "Service Layer": () => require("../connectors/serviceLayerClient"),
  };

  const loader = connectorMap[type];
  if (!loader) {
    throw new Error(`Unknown connection type: '${type}'.`);
  }
  return loader();
}

// ── Source name used in meta ──────────────────────────────────────────────────
const SOURCE_NAMES = {
  "SAP HANA":      "HANA",
  "SQL Server":    "SQLServer",
  "Service Layer": "ServiceLayer",
};

/**
 * Merges saved query params with runtime params passed by Batch 1.
 * Runtime values override saved defaults for the same key.
 *
 * @param {Array}  savedParams   - Saved param definitions: [{ name, defaultValue }]
 * @param {object} runtimeParams - Params from the caller: { paramName: value }
 * @returns {object} Merged params object
 */
function mergeParams(savedParams = [], runtimeParams = {}) {
  const merged = {};

  // Start with saved defaults
  for (const p of savedParams) {
    if (p && p.name) {
      merged[p.name] = p.defaultValue !== undefined ? p.defaultValue : null;
    }
  }

  // Runtime values override defaults (Ref: sub-task #184)
  for (const [key, value] of Object.entries(runtimeParams)) {
    merged[key] = value;
  }

  return merged;
}

/**
 * Core execution function. Called by runQuery() and the Test Query API.
 *
 * @param {object} queryDoc     - Mongoose Query document (or plain object for stubs)
 * @param {object} runtimeParams - Runtime params from Batch 1 or test caller
 * @param {object} options       - { limit: number } — override row limit (used by Test Query: 10 rows)
 * @returns {Promise<{ columns, rows, meta }>}
 */
async function executeQuery(queryDoc, runtimeParams = {}, options = {}) {
  let connectionDoc;

  try {
    // ── Step 1: Load the connection ─────────────────────────────────────────
    connectionDoc = await Connection.findById(queryDoc.connectionId).lean();
    if (!connectionDoc) {
      throw new Error(`Connection not found for query '${queryDoc.name}'.`);
    }

    // ── Step 2: Decrypt the password ────────────────────────────────────────
    // Uses the ONE shared decrypt — never decrypted anywhere else (sub-task #77)
    const plainPassword = decryptPassword(connectionDoc.passwordEncrypted);
    const connectionDetails = {
      ...connectionDoc,
      password: plainPassword,
    };

    // ── Step 3: Validate the query (shared validator — Joice's module) ───────
    const validation = validateQuerySafety({
      kind:        queryDoc.kind,
      queryText:   queryDoc.queryText,
      entity:      queryDoc.entity,
      filter:      queryDoc.filter,
      select:      queryDoc.select,
      params:      queryDoc.params,
      execApproved: queryDoc.execApproved,
    });

    if (!validation.valid) {
      throw new Error(`Query blocked: ${validation.error}`);
    }

    // ── Step 4: Merge runtime params with saved defaults ────────────────────
    const mergedParams = mergeParams(queryDoc.params, runtimeParams);

    // ── Step 5: Apply row limit ──────────────────────────────────────────────
    // options.limit overrides query's rowLimit (Test Query uses 10)
    const effectiveLimit = options.limit !== undefined
      ? options.limit
      : (queryDoc.rowLimit || parseInt(process.env.MAX_ROW_LIMIT) || 1000);

    // ── Step 6: Pick connector and execute ───────────────────────────────────
    const connector = getConnector(connectionDoc.type);
    const raw = await connector.executeQuery(
      connectionDetails,
      queryDoc,
      mergedParams,
      { limit: effectiveLimit }
    );

    // ── Step 7: Format into the common shape ─────────────────────────────────
    const sourceName = SOURCE_NAMES[connectionDoc.type] || connectionDoc.type;
    const formatted = formatResult(raw, sourceName, queryDoc.columnMapping || {});

    return formatted;

  } catch (err) {
    // Sanitise before returning — no passwords or hostnames leak (FR-18)
    const safe = sanitizeError(err);
    throw new Error(safe.message);
  }
}

module.exports = { executeQuery, mergeParams };

