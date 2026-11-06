const { sanitizeError } = require("../security/sanitiser");

// Central Express error handling middleware.
// Uses the security error sanitizer to ensure driver traces, passwords, or customer data
// are never exposed in error responses (Ref: FR-18, NFR-07).

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || (res.statusCode !== 200 ? res.statusCode : 500);

  // Sanitize the error message to remove any sensitive details
  const sanitized = sanitizeError(err);

  res.status(statusCode).json({
    ok: false,
    message: sanitized.message
  });
}

module.exports = errorHandler;

