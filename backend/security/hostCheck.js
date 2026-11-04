// Checks if a host or database name appears to be a production environment.
// Per BR-02, production systems should never be connected; development and testing
// must strictly target local, mock, or approved non-production environments.

const PROD_KEYWORDS = [
  "prod",
  "production",
  "live",
  "prd",
  "primary-db",
  "main-db"
];

/**
 * Checks a target host or database name for production indicators.
 * @param {string} host - The hostname or IP to inspect.
 * @param {string} [database] - Optional database or schema name to inspect.
 * @returns {{ ok: boolean, reason?: string }}
 */
function isProductionHost(host = "", database = "") {
  const targetHost = String(host).toLowerCase();
  const targetDb = String(database).toLowerCase();

  for (const keyword of PROD_KEYWORDS) {
    // Check if hostname contains production terms
    if (targetHost && targetHost.includes(keyword)) {
      return {
        ok: false,
        reason: `Connection blocked by safety rule BR-02: host name '${host}' appears to be a production system.`
      };
    }

    // Check if database name contains production terms
    if (targetDb && targetDb.includes(keyword)) {
      return {
        ok: false,
        reason: `Connection blocked by safety rule BR-02: database name '${database}' appears to be a production system.`
      };
    }
  }

  return { ok: true };
}

module.exports = {
  isProductionHost,
  PROD_KEYWORDS
};

