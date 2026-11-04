// Error and log sanitizer to protect sensitive connection and customer information.
// Ref: FR-18, NFR-01, NFR-07, sub-task 154.
// Ensures database driver traces, raw connection strings, passwords, or customer records
// never leak into client responses or server output logs.

const SENSITIVE_PATTERNS = [
  // Password parameters in queries or connection strings
  { regex: /(password|pwd|pass)\s*[:=]\s*['"]?[^'";\s,]+['"]?/gi, replacement: "$1=***REDACTED***" },
  // MongoDB URIs with credentials
  { regex: /mongodb(\+srv)?:\/\/[^:]+:[^@]+@/gi, replacement: "mongodb$1://***:***@" },
  // SQL Server connection string credentials
  { regex: /(User ID|UID)=[^;]+/gi, replacement: "$1=***REDACTED***" },
  // Generic bearer tokens and API keys
  { regex: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, replacement: "Bearer ***REDACTED***" }
];

/**
 * Strips sensitive credentials and masks private data in any string.
 * @param {string} text - Message or log string to sanitize.
 * @returns {string} Sanitized string safe for logs or client responses.
 */
function sanitizeMessage(text) {
  if (typeof text !== "string") {
    text = String(text || "");
  }

  let sanitized = text;
  for (const { regex, replacement } of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(regex, replacement);
  }

  return sanitized;
}

/**
 * Takes an error object or string and formats it safely for the caller.
 * @param {Error|string|object} error - Raw error caught in try/catch block.
 * @returns {{ ok: false, message: string }}
 */
function sanitizeError(error) {
  const rawMessage = error instanceof Error
    ? error.message
    : (typeof error === "string" ? error : JSON.stringify(error));

  const cleanMessage = sanitizeMessage(rawMessage);

  return {
    ok: false,
    message: cleanMessage
  };
}

module.exports = {
  sanitizeMessage,
  sanitizeError
};

