/**
 * Slow-query fixtures for testing query timeouts across all three connectors.
 * Story 5.4, Sub-task 160.
 *
 * Provides simulated execution fixtures for:
 * 1. SQL Server (simulating T-SQL WAITFOR DELAY / long running query)
 * 2. SAP HANA (simulating long-running columnar calculation / aggregation)
 * 3. SAP Service Layer (simulating delayed OData HTTP response via delay parameter / network latency)
 */

/**
 * Creates a SQL Server slow-query simulator.
 * In a real SQL Server instance, this mimics executing: WAITFOR DELAY '00:00:35'
 *
 * @param {number} delayMs - Artificial delay before responding
 * @param {Array} [mockRows=[]] - Rows returned if the query finishes before timeout
 * @returns {Function} Async function returning promise
 */
function createSqlServerQueryFixture(delayMs = 0, mockRows = [{ id: 1, name: "SQLServerRecord" }]) {
  return function executeQuery() {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          columns: ["id", "name"],
          rows: mockRows
        });
      }, delayMs);
    });
  }
}

/**
 * Creates an SAP HANA slow-query simulator.
 * Mimics executing a complex HANA calculation view or long aggregation.
 *
 * @param {number} delayMs - Artificial delay before responding
 * @param {Array} [mockRows=[]] - Rows returned if the query finishes before timeout
 * @returns {Function} Async function returning promise
 */
function createHanaQueryFixture(delayMs = 0, mockRows = [{ ID: 101, ITEM: "HanaItem" }]) {
  return function executeQuery() {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          columns: ["ID", "ITEM"],
          rows: mockRows
        });
      }, delayMs);
    });
  }
}

/**
 * Creates an SAP Service Layer slow OData request simulator.
 * Mimics calling Service Layer with a slow-response hook / network latency (Ref: Sub-task 111).
 *
 * @param {number} delayMs - Artificial delay before responding
 * @param {Array} [mockRows=[]] - Rows returned if the query finishes before timeout
 * @returns {Function} Async function returning promise
 */
function createServiceLayerQueryFixture(delayMs = 0, mockRows = [{ DocEntry: 5001, CardCode: "C20000" }]) {
  return function executeQuery() {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          columns: ["DocEntry", "CardCode"],
          rows: mockRows
        });
      }, delayMs);
    });
  }
}

module.exports = {
  createSqlServerQueryFixture,
  createHanaQueryFixture,
  createServiceLayerQueryFixture
};

