/**
 * Unit Tests — HANA Connector (mock engine)
 * Story 3.1 & 3.2 | Owner: Swarnalakshmi Perumal | Sprint 1 & 2
 * Ref: FR-05, FR-07, sub-tasks #83, #84, #86-#92, #95
 *
 * Tests the high-level hana.js connector which wraps the hana-mock engine.
 *
 * NOTE: @sap/hana-client is NOT installed — the connector always uses the mock engine.
 *
 * API: hana.executeQuery(connectionDetails, queryDoc, mergedParams, options)
 *   - connectionDetails : {} (unused by mock)
 *   - queryDoc          : { queryText: string, params: [] }
 *   - mergedParams      : {} | { key: value } for ? substitution
 *   - options           : { limit: number }
 */

const hana = require("../connectors/hana");

/** Minimal connection details (ignored by mock engine) */
const CONN = { host: "mock", port: 30015, username: "u", password: "p", database: "HDB" };

/** Helper — build a queryDoc from a plain SQL string */
function qd(sql) {
  return { queryText: sql, params: [] };
}

/** Helper — run a SQL string through the connector */
async function run(sql, params = {}, limit = 100) {
  return hana.executeQuery(CONN, qd(sql), params, { limit });
}

// ─── testConnection ──────────────────────────────────────────────────────────

describe("hana.testConnection (sub-tasks #83, #84)", () => {
  test("returns { ok: true } with a message", async () => {
    const result = await hana.testConnection(CONN);
    expect(result.ok).toBe(true);
    expect(typeof result.message).toBe("string");
    expect(result.message.length).toBeGreaterThan(0);
  });
});

// ─── executeQuery — basic SELECT ─────────────────────────────────────────────

describe("hana.executeQuery — basic SELECT (sub-task #86)", () => {
  test("returns { columns, rows } for a simple SELECT on INVOICES", async () => {
    const result = await run(`SELECT * FROM "DEMO"."INVOICES" LIMIT 5`);
    expect(Array.isArray(result.columns)).toBe(true);
    expect(Array.isArray(result.rows)).toBe(true);
    expect(result.rows.length).toBeLessThanOrEqual(5);
    result.rows.forEach((row) => {
      expect(row.length).toBe(result.columns.length);
    });
  });

  test("returns all expected FR-23 column names for INVOICES", async () => {
    const result = await run(`SELECT * FROM "DEMO"."INVOICES" LIMIT 1`);
    const cols   = result.columns;
    expect(cols).toContain("InvoiceNo");
    expect(cols).toContain("CustomerCode");
    expect(cols).toContain("CustomerName");
    expect(cols).toContain("Email");
    expect(cols).toContain("DueDate");
    expect(cols).toContain("Amount");
    expect(cols).toContain("Paid");
  });

  test("returns rows for PURCHASEORDERS (sub-task #87)", async () => {
    const result = await run(`SELECT * FROM "DEMO"."PURCHASEORDERS" LIMIT 3`);
    expect(result.rows.length).toBeLessThanOrEqual(3);
    expect(result.columns).toContain("PONumber");
  });

  test("returns rows for ITEMS table", async () => {
    const result = await run(`SELECT * FROM "DEMO"."ITEMS" LIMIT 3`);
    expect(result.columns).toContain("ItemCode");
  });

  test("returns rows for SALESSUMMARY table (sub-task #95)", async () => {
    const result = await run(`SELECT * FROM "DEMO"."SALESSUMMARY" LIMIT 3`);
    expect(result.columns).toContain("TotalSales");
    expect(result.columns).toContain("Branch");
  });
});

// ─── executeQuery — LIMIT clause (sub-task #89) ──────────────────────────────

describe("hana.executeQuery — LIMIT (sub-task #89)", () => {
  test("respects LIMIT 1 — only 1 row returned", async () => {
    const result = await run(`SELECT * FROM "DEMO"."INVOICES" LIMIT 1`);
    expect(result.rows.length).toBe(1);
  });

  test("respects LIMIT 10 — at most 10 rows returned", async () => {
    const result = await run(`SELECT * FROM "DEMO"."INVOICES" LIMIT 10`);
    expect(result.rows.length).toBeLessThanOrEqual(10);
  });
});

// ─── executeQuery — parameterised query with ? (sub-task #88) ────────────────

describe("hana.executeQuery — parameterised queries (sub-task #88)", () => {
  test("substitutes ? with a string param (CustomerCode lookup)", async () => {
    // First get a valid code from the table
    const all    = await run(`SELECT CustomerCode FROM "DEMO"."INVOICES" LIMIT 1`);
    const code   = all.rows[0][0];
    // mergedParams: object values in insertion order → positional ? binding
    const result = await hana.executeQuery(
      CONN,
      { queryText: `SELECT * FROM "DEMO"."INVOICES" WHERE CustomerCode = ? LIMIT 5`, params: [] },
      { code },
      { limit: 5 }
    );
    expect(Array.isArray(result.rows)).toBe(true);
    const codeIdx = result.columns.indexOf("CustomerCode");
    result.rows.forEach((row) => {
      expect(row[codeIdx]).toBe(code);
    });
  });

  test("substitutes ? with a numeric param (Amount filter)", async () => {
    const result = await hana.executeQuery(
      CONN,
      { queryText: `SELECT * FROM "DEMO"."INVOICES" WHERE Amount > ? LIMIT 5`, params: [] },
      { minAmount: 0 },
      { limit: 5 }
    );
    expect(Array.isArray(result.rows)).toBe(true);
  });
});

// ─── executeQuery — CURRENT_DATE() function (sub-task #90) ───────────────────

describe("hana.executeQuery — CURRENT_DATE() (sub-task #90)", () => {
  test("SELECT CURRENT_DATE() returns today's date string", async () => {
    const result = await run(`SELECT CURRENT_DATE() AS today`);
    expect(result.rows.length).toBe(1);
    const today  = result.rows[0][0];
    // Should be a valid YYYY-MM-DD string
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ─── executeQuery — DAYS_BETWEEN() function (sub-task #91) ───────────────────

describe("hana.executeQuery — DAYS_BETWEEN() (sub-task #91)", () => {
  test("DAYS_BETWEEN two static dates returns correct count", async () => {
    const result = await run(`SELECT DAYS_BETWEEN('2026-01-01', '2026-01-11') AS diff`);
    expect(result.rows.length).toBe(1);
    expect(result.rows[0][0]).toBe(10);
  });

  test("DAYS_BETWEEN with CURRENT_DATE() returns a non-negative number", async () => {
    const result = await run(`SELECT DAYS_BETWEEN('2020-01-01', CURRENT_DATE()) AS diff`);
    expect(result.rows[0][0]).toBeGreaterThan(0);
  });
});

// ─── executeQuery — WHERE + overdue filter (sub-task #92) ────────────────────

describe("hana.executeQuery — WHERE filter (sub-task #92)", () => {
  test("WHERE Paid = 0 filters only unpaid invoices", async () => {
    const result = await run(`SELECT * FROM "DEMO"."INVOICES" WHERE Paid = 0 LIMIT 20`);
    const paidIdx = result.columns.indexOf("Paid");
    result.rows.forEach((row) => {
      expect(row[paidIdx]).toBe(0);
    });
  });
});

// ─── executeQuery — read-only safety (sub-task #89 / validator) ──────────────

describe("hana.executeQuery — read-only safety (sub-task #89)", () => {
  test("blocks INSERT statements", async () => {
    await expect(
      run(`INSERT INTO "DEMO"."INVOICES" VALUES ('X','X','X','X','X',0,0)`)
    ).rejects.toThrow(/blocked/i);
  });

  test("blocks DROP statements", async () => {
    await expect(
      run(`DROP TABLE "INVOICES"`)
    ).rejects.toThrow(/blocked/i);
  });

  test("throws or rejects on syntactically invalid SQL", async () => {
    await expect(
      run("SELECT FROM WHERE LIMIT 1")
    ).rejects.toThrow();
  });

  test("throws or rejects on unknown table", async () => {
    await expect(
      run(`SELECT * FROM "DEMO"."NONEXISTENT" LIMIT 1`)
    ).rejects.toThrow();
  });
});
