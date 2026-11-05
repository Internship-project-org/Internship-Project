/**
 * Shared Query Timeout and Row Limits Configuration & Helper Utilities.
 * Story 5.4 (Backlog ID 156), Sub-tasks 157, 158, 159, 162.
 * Owner: Rohit Biju | Ref: FR-16, A5
 *
 * Architecture Rule 2:
 * "Every shared job has one file: one decrypt, one validator, one limits config, one formatter, mapping applied once."
 *
 * Used by all three data connectors:
 * - Joice Mary Ajith (Story 2.2: Execute SQL Server Read-Only Queries)
 * - Swarnalakshmi Perumal (Story 3.2: Execute SAP HANA Queries)
 * - Akshay S P (Story 4.3: Retrieve Data from Service Layer)
 *
 * Mentor Note (Ref: A5):
 * Default query timeout is set to 30 seconds (30,000 ms) and global row limit cap is set to 1,000 rows.
 * Both values are overridable via environment variables (QUERY_TIMEOUT_MS, MAX_ROW_LIMIT_CAP).
 */

// Global default limits per SRS specifications and Backlog Ref: A5
const DEFAULT_QUERY_TIMEOUT_MS = 30000; // 30 seconds
const MAX_ROW_LIMIT_CAP = 1000;         // 1000 rows maximum hard cap (Ref: FR-16)
const DEFAULT_ROW_LIMIT = 1000;         // Default row limit if unspecified

/**
 * Custom error thrown when a connector query execution exceeds the configured timeout.
 * Sub-task 159: Return clear timeout and row-limit errors.
 */
class QueryTimeoutError extends Error {
  constructor(timeoutMs, connector = "connector") {
    super(`Query execution exceeded timeout limit of ${timeoutMs}ms (${connector}). Ref: Story 5.4 / A5`);
    this.name = "QueryTimeoutError";
    this.code = "QUERY_TIMEOUT";
    this.statusCode = 504;
    this.timeoutMs = timeoutMs;
    this.connector = connector;
  }
}

/**
 * Custom error thrown when strict row limit validation fails.
 * Sub-task 159: Return clear timeout and row-limit errors.
 */
class RowLimitExceededError extends Error {
  constructor(rowLimit, receivedCount) {
    super(`Query result exceeded row limit cap of ${rowLimit} rows (received ${receivedCount}). Ref: FR-16`);
    this.name = "RowLimitExceededError";
    this.code = "ROW_LIMIT_EXCEEDED";
    this.statusCode = 400;
    this.rowLimit = rowLimit;
    this.receivedCount = receivedCount;
  }
}

/**
 * Returns the current active global limits configuration, taking environment variable overrides into account.
 * Sub-task 157: Create ONE config file for timeout and row limit (about 30 seconds and 1000 rows; confirm with mentor).
 * @returns {{ timeoutMs: number, maxRowLimitCap: number, defaultRowLimit: number, mentorClarificationA5: string }}
 */
function getLimitsConfig() {
  const envTimeout = parseInt(process.env.QUERY_TIMEOUT_MS, 10);
  const envMaxCap = parseInt(process.env.MAX_ROW_LIMIT_CAP, 10);
  const envDefaultLimit = parseInt(process.env.DEFAULT_ROW_LIMIT, 10);

  const timeoutMs = Number.isInteger(envTimeout) && envTimeout > 0 ? envTimeout : DEFAULT_QUERY_TIMEOUT_MS;
  const maxRowLimitCap = Number.isInteger(envMaxCap) && envMaxCap > 0 ? envMaxCap : MAX_ROW_LIMIT_CAP;
  const defaultRowLimit = Number.isInteger(envDefaultLimit) && envDefaultLimit > 0
    ? Math.min(envDefaultLimit, maxRowLimitCap)
    : Math.min(DEFAULT_ROW_LIMIT, maxRowLimitCap);

  return {
    timeoutMs,
    maxRowLimitCap,
    defaultRowLimit,
    mentorClarificationA5: "Default timeout is 30s and max row cap is 1000 rows. Confirm whether specific batch export reports (e.g. CSV/Excel in Epic 6) require higher caps or pagination."
  };
}

/**
 * Computes the effective row limit for a query execution.
 * Sub-task 158: Effective limit is the smaller of the query rowLimit and the global cap (Ref: FR-16).
 *
 * @param {number|string|null|undefined} queryRowLimit - Limit specified in the query definition or execution request.
 * @returns {number} The effective row limit to apply.
 */
function getEffectiveRowLimit(queryRowLimit) {
  const config = getLimitsConfig();
  const parsed = parseInt(queryRowLimit, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return config.defaultRowLimit;
  }

  // Ref: FR-16 - smaller of the query rowLimit and the global cap
  return Math.min(parsed, config.maxRowLimitCap);
}

/**
 * Computes the effective timeout for a query execution in milliseconds.
 *
 * @param {number|string|null|undefined} queryTimeoutMs - Optional query-specific timeout in milliseconds.
 * @returns {number} The effective timeout in milliseconds.
 */
function getEffectiveTimeout(queryTimeoutMs) {
  const config = getLimitsConfig();
  const parsed = parseInt(queryTimeoutMs, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return config.timeoutMs;
  }

  // Never allow a query to exceed the global timeout ceiling
  return Math.min(parsed, config.timeoutMs);
}

/**
 * Enforces the row limit on a returned array of rows.
 * Slices rows if they exceed the effective limit and marks truncation metadata.
 *
 * @param {Array} rows - Array of result records from connector.
 * @param {number} [effectiveLimit] - Optional precomputed effective limit; if omitted, computed automatically.
 * @param {object} [options] - Options { strict: boolean }. If strict is true, throws RowLimitExceededError instead of slicing.
 * @returns {{ rows: Array, totalCount: number, effectiveLimit: number, truncated: boolean }}
 */
function enforceRowLimit(rows, effectiveLimit, options = {}) {
  const limit = effectiveLimit !== undefined ? effectiveLimit : getEffectiveRowLimit();

  if (!Array.isArray(rows)) {
    return {
      rows: [],
      totalCount: 0,
      effectiveLimit: limit,
      truncated: false
    };
  }

  const totalCount = rows.length;

  if (options.strict && totalCount > limit) {
    throw new RowLimitExceededError(limit, totalCount);
  }

  if (totalCount > limit) {
    return {
      rows: rows.slice(0, limit),
      totalCount,
      effectiveLimit: limit,
      truncated: true
    };
  }

  return {
    rows,
    totalCount,
    effectiveLimit: limit,
    truncated: false
  };
}

/**
 * Wraps a promise or an async connector operation in a timeout guard.
 * If the promise takes longer than timeoutMs, it aborts/rejects with a QueryTimeoutError.
 * Ensures timer cleanup on completion.
 *
 * @param {Promise|Function} promiseOrFn - Promise or async function to execute.
 * @param {number} [timeoutMs] - Timeout in milliseconds; if omitted, effective timeout is used.
 * @param {string} [connectorName="connector"] - Connector identifier for error reporting (e.g. 'SQL Server', 'SAP HANA', 'Service Layer').
 * @returns {Promise<any>} Result of the executed promise.
 */
function withQueryTimeout(promiseOrFn, timeoutMs, connectorName = "connector") {
  const effectiveTimeout = timeoutMs !== undefined ? getEffectiveTimeout(timeoutMs) : getEffectiveTimeout();

  return new Promise((resolve, reject) => {
    let timerId = null;
    let settled = false;

    timerId = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new QueryTimeoutError(effectiveTimeout, connectorName));
      }
    }, effectiveTimeout);

    // Support both direct Promise and function returning a Promise
    const promise = typeof promiseOrFn === "function" ? promiseOrFn() : promiseOrFn;

    Promise.resolve(promise)
      .then((result) => {
        if (!settled) {
          settled = true;
          clearTimeout(timerId);
          resolve(result);
        }
      })
      .catch((err) => {
        if (!settled) {
          settled = true;
          clearTimeout(timerId);
          reject(err);
        }
      });
  });
}

module.exports = {
  // Constants
  DEFAULT_QUERY_TIMEOUT_MS,
  MAX_ROW_LIMIT_CAP,
  DEFAULT_ROW_LIMIT,

  // Custom Error Classes
  QueryTimeoutError,
  RowLimitExceededError,

  // Helpers
  getLimitsConfig,
  getEffectiveRowLimit,
  getEffectiveTimeout,
  enforceRowLimit,
  withQueryTimeout
};

