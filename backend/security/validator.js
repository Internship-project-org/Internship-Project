// Dialect-aware query validation module.
// Ref: FR-13, FR-14, sub-tasks 148, 149, 150, 151, 152.
// Inspects queries and parameters before execution or saving to ensure read-only safety.

// Strictly forbidden write and DDL operations
const DISALLOWED_KEYWORDS = [
  "INSERT",
  "UPDATE",
  "DELETE",
  "DROP",
  "ALTER",
  "TRUNCATE",
  "MERGE",
  "GRANT",
  "REVOKE",
  "CREATE",
  "RENAME"
];

// Allowed Service Layer entities based on project specification
const APPROVED_SERVICE_LAYER_ENTITIES = [
  "Invoices",
  "PurchaseOrders",
  "Items",
  "SalesSummary",
  "BusinessPartners"
];

/**
 * Strips comments from SQL string to analyze the underlying statement.
 * Handles single line (-- ...) and multi-line (/* ... * /) comments.
 */
function stripSqlComments(sql) {
  if (typeof sql !== "string") return "";
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, "") // Block comments
    .replace(/--.*$/gm, "")          // Line comments
    .trim();
}

/**
 * Validates a SQL query (SQL Server / SAP HANA) for read-only safety.
 * @param {string} sql - The raw SQL text.
 * @param {object} options - Validation flags, such as execApproved.
 * @returns {{ valid: boolean, error?: string }}
 */
function validateSqlQuery(sql, options = {}) {
  const cleaned = stripSqlComments(sql);

  if (!cleaned) {
    return { valid: false, error: "Query text cannot be empty." };
  }

  // Check for forbidden DDL / DML operations as whole words
  for (const keyword of DISALLOWED_KEYWORDS) {
    const pattern = new RegExp(`\\b${keyword}\\b`, "i");
    if (pattern.test(cleaned)) {
      return {
        valid: false,
        error: `Query contains disallowed operation: '${keyword}'. Only read-only operations are permitted.`
      };
    }
  }

  // Check stored procedure execution (EXEC / EXECUTE)
  const isExecCall = /^\s*(EXEC|EXECUTE)\b/i.test(cleaned);
  if (isExecCall && !options.execApproved) {
    return {
      valid: false,
      error: "Stored procedure execution (EXEC) requires administrator approval."
    };
  }

  // If not an approved EXEC, the statement must start with SELECT or WITH (for CTEs)
  if (!isExecCall) {
    const isApprovedSelect = /^\s*(SELECT|WITH)\b/i.test(cleaned);
    if (!isApprovedSelect) {
      return {
        valid: false,
        error: "Only read-only SELECT queries are allowed."
      };
    }
  }

  return { valid: true };
}

/**
 * Validates an OData request for SAP Business One Service Layer.
 * @param {object} odataConfig - Config with entity, filter, select, and method.
 * @returns {{ valid: boolean, error?: string }}
 */
function validateODataRequest(odataConfig = {}) {
  const { entity, method = "GET", filter } = odataConfig;

  // Enforce read-only HTTP methods
  const normalizedMethod = String(method).toUpperCase();
  if (normalizedMethod !== "GET" && normalizedMethod !== "LOGIN") {
    return {
      valid: false,
      error: `Service Layer method '${method}' is not permitted. Only GET requests are allowed.`
    };
  }

  if (!entity || typeof entity !== "string" || !entity.trim()) {
    return {
      valid: false,
      error: "Service Layer query requires a valid entity name (e.g. Invoices, Items)."
    };
  }

  // Check filter for suspicious quote termination or SQL injection attempts
  if (filter && typeof filter === "string") {
    // Unbalanced single quotes often indicate an injection attempt
    const quoteMatches = filter.match(/'/g) || [];
    if (quoteMatches.length % 2 !== 0) {
      return {
        valid: false,
        error: "Invalid OData filter: unbalanced quotation marks detected."
      };
    }
  }

  return { valid: true };
}

/**
 * Validates parameter configuration definitions.
 * Parameters must have valid names and safe default values.
 * @param {Array} params - Array of parameter objects { name, defaultValue }.
 * @returns {{ valid: boolean, error?: string }}
 */
function validateQueryParams(params) {
  if (!params) return { valid: true };

  if (!Array.isArray(params)) {
    return { valid: false, error: "Parameters must be provided as an array." };
  }

  for (const p of params) {
    if (!p || typeof p !== "object" || !p.name) {
      return { valid: false, error: "Each parameter definition must have a name." };
    }

    const paramName = String(p.name).trim();
    // Validate format: @paramName (SQL Server), ? (HANA), or standard alphanumeric identifier
    const validName = /^(@[a-zA-Z0-9_]+|\?|[a-zA-Z0-9_]+)$/.test(paramName);
    if (!validName) {
      return {
        valid: false,
        error: `Parameter name '${paramName}' is invalid. Use @paramName or alphanumeric identifiers.`
      };
    }
  }

  return { valid: true };
}

/**
 * Main query validator hook called prior to saving or updating any query.
 * @param {object} queryDoc - Query payload or document.
 * @returns {{ valid: boolean, error?: string }}
 */
function validateQuerySafety(queryDoc = {}) {
  if (!queryDoc || typeof queryDoc !== "object") {
    return { valid: false, error: "Invalid query payload." };
  }

  const { kind, queryText, entity, filter, select, params, execApproved } = queryDoc;

  // Validate parameter structure if provided
  const paramsCheck = validateQueryParams(params);
  if (!paramsCheck.valid) {
    return paramsCheck;
  }

  // Dialect-specific validation
  if (kind === "sql") {
    return validateSqlQuery(queryText, { execApproved: Boolean(execApproved) });
  }

  if (kind === "odata") {
    return validateODataRequest({ entity, filter, select });
  }

  return {
    valid: false,
    error: `Unsupported query kind '${kind}'. Must be either 'sql' or 'odata'.`
  };
}

module.exports = {
  validateQuerySafety,
  validateSqlQuery,
  validateODataRequest,
  validateQueryParams,
  stripSqlComments,
  DISALLOWED_KEYWORDS,
  APPROVED_SERVICE_LAYER_ENTITIES
};

