/**
 * Tests for Story 5.4 - Query Timeout and Row Limits (shared config).
 * Ref: Backlog ID 156, Sub-tasks 157, 158, 159, 160, 161, 162.
 */

const {
  DEFAULT_QUERY_TIMEOUT_MS,
  MAX_ROW_LIMIT_CAP,
  DEFAULT_ROW_LIMIT,
  QueryTimeoutError,
  RowLimitExceededError,
  getLimitsConfig,
  getEffectiveRowLimit,
  getEffectiveTimeout,
  enforceRowLimit,
  withQueryTimeout
} = require("../config/limits");

const {
  createSqlServerQueryFixture,
  createHanaQueryFixture,
  createServiceLayerQueryFixture
} = require("./fixtures/slowQueryFixtures");

const { sanitizeError } = require("../security/sanitiser");

describe("Story 5.4 - Query Timeout and Row Limits (Shared Config)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  // =========================================================================
  // Sub-task 157: Configuration File and Defaults
  // =========================================================================
  describe("Sub-task 157: Configuration Values & Overrides", () => {
    test("provides correct defaults (30s timeout, 1000 max row cap)", () => {
      delete process.env.QUERY_TIMEOUT_MS;
      delete process.env.MAX_ROW_LIMIT_CAP;
      delete process.env.DEFAULT_ROW_LIMIT;

      const config = getLimitsConfig();
      expect(config.timeoutMs).toBe(30000);
      expect(config.maxRowLimitCap).toBe(1000);
      expect(config.defaultRowLimit).toBe(1000);
      expect(config.mentorClarificationA5).toBeDefined();
    });

    test("allows overriding timeout and max row cap via environment variables", () => {
      process.env.QUERY_TIMEOUT_MS = "45000";
      process.env.MAX_ROW_LIMIT_CAP = "2500";
      process.env.DEFAULT_ROW_LIMIT = "500";

      const config = getLimitsConfig();
      expect(config.timeoutMs).toBe(45000);
      expect(config.maxRowLimitCap).toBe(2500);
      expect(config.defaultRowLimit).toBe(500);
    });

    test("falls back safely if environment variables contain invalid or negative values", () => {
      process.env.QUERY_TIMEOUT_MS = "invalid_string";
      process.env.MAX_ROW_LIMIT_CAP = "-50";

      const config = getLimitsConfig();
      expect(config.timeoutMs).toBe(30000);
      expect(config.maxRowLimitCap).toBe(1000);
    });
  });

  // =========================================================================
  // Sub-task 158: Effective Limit Calculation (Ref: FR-16)
  // =========================================================================
  describe("Sub-task 158: Effective Limit Helpers", () => {
    describe("getEffectiveRowLimit(queryRowLimit)", () => {
      test("returns requested limit when it is smaller than global cap (e.g. 50 -> 50)", () => {
        expect(getEffectiveRowLimit(50)).toBe(50);
        expect(getEffectiveRowLimit(250)).toBe(250);
        expect(getEffectiveRowLimit(999)).toBe(999);
      });

      test("caps at global maximum (1000) when query requests more (Ref: FR-16)", () => {
        expect(getEffectiveRowLimit(1001)).toBe(1000);
        expect(getEffectiveRowLimit(5000)).toBe(1000);
        expect(getEffectiveRowLimit(100000)).toBe(1000);
      });

      test("handles string integers correctly", () => {
        expect(getEffectiveRowLimit("150")).toBe(150);
        expect(getEffectiveRowLimit("3500")).toBe(1000);
      });

      test("falls back to default limit when query limit is omitted, negative, or invalid", () => {
        expect(getEffectiveRowLimit(undefined)).toBe(1000);
        expect(getEffectiveRowLimit(null)).toBe(1000);
        expect(getEffectiveRowLimit(-10)).toBe(1000);
        expect(getEffectiveRowLimit(0)).toBe(1000);
        expect(getEffectiveRowLimit("not-a-number")).toBe(1000);
      });
    });

    describe("getEffectiveTimeout(queryTimeoutMs)", () => {
      test("returns global timeout when not provided", () => {
        expect(getEffectiveTimeout()).toBe(30000);
      });

      test("allows custom timeout smaller than global cap", () => {
        expect(getEffectiveTimeout(5000)).toBe(5000);
      });

      test("caps custom timeout at global ceiling (30s)", () => {
        expect(getEffectiveTimeout(60000)).toBe(30000);
      });
    });

    describe("enforceRowLimit(rows, effectiveLimit)", () => {
      test("keeps rows as-is when within effective limit", () => {
        const rows = [{ id: 1 }, { id: 2 }, { id: 3 }];
        const result = enforceRowLimit(rows, 10);
        expect(result.rows).toHaveLength(3);
        expect(result.totalCount).toBe(3);
        expect(result.truncated).toBe(false);
      });

      test("truncates rows and flags truncated=true when rows exceed limit", () => {
        const rows = Array.from({ length: 15 }, (_, i) => ({ id: i + 1 }));
        const result = enforceRowLimit(rows, 10);
        expect(result.rows).toHaveLength(10);
        expect(result.totalCount).toBe(15);
        expect(result.truncated).toBe(true);
        expect(result.rows[0].id).toBe(1);
        expect(result.rows[9].id).toBe(10);
      });

      test("throws RowLimitExceededError in strict mode when exceeding limit", () => {
        const rows = Array.from({ length: 5 }, (_, i) => ({ id: i + 1 }));
        expect(() => {
          enforceRowLimit(rows, 3, { strict: true });
        }).toThrow(RowLimitExceededError);
      });

      test("safely handles non-array inputs", () => {
        const result = enforceRowLimit(null, 10);
        expect(result.rows).toEqual([]);
        expect(result.totalCount).toBe(0);
        expect(result.truncated).toBe(false);
      });
    });
  });

  // =========================================================================
  // Sub-task 159: Clear Timeout and Row-limit Errors
  // =========================================================================
  describe("Sub-task 159: Clear Errors and Sanitization", () => {
    test("QueryTimeoutError contains clear code, statusCode, and message", () => {
      const err = new QueryTimeoutError(30000, "SQL Server");
      expect(err.name).toBe("QueryTimeoutError");
      expect(err.code).toBe("QUERY_TIMEOUT");
      expect(err.statusCode).toBe(504);
      expect(err.message).toContain("30000ms");
      expect(err.message).toContain("SQL Server");
      expect(err.message).toContain("Story 5.4 / A5");
    });

    test("RowLimitExceededError contains clear code, statusCode, and details", () => {
      const err = new RowLimitExceededError(1000, 2500);
      expect(err.name).toBe("RowLimitExceededError");
      expect(err.code).toBe("ROW_LIMIT_EXCEEDED");
      expect(err.statusCode).toBe(400);
      expect(err.message).toContain("1000 rows");
      expect(err.message).toContain("2500");
      expect(err.message).toContain("FR-16");
    });

    test("QueryTimeoutError and RowLimitExceededError integrate safely with error sanitizer", () => {
      const timeoutErr = new QueryTimeoutError(30000, "SAP HANA");
      const sanitized = sanitizeError(timeoutErr);
      expect(sanitized.ok).toBe(false);
      expect(sanitized.message).toContain("SAP HANA");
      expect(sanitized.message).toContain("30000ms");
    });
  });

  // =========================================================================
  // Sub-tasks 160 & 161: Fixtures and Connector Timeout Tests
  // =========================================================================
  describe("Sub-tasks 160 & 161: Timeout & Row Limits Across All 3 Connectors", () => {
    describe("1. SQL Server Connector Fixture", () => {
      test("executes successfully when query finishes within timeout", async () => {
        const fastQuery = createSqlServerQueryFixture(20, [{ id: 1, name: "Fast SQL" }]);
        const result = await withQueryTimeout(fastQuery, 100, "SQL Server");
        expect(result.columns).toContain("name");
        expect(result.rows).toHaveLength(1);
      });

      test("aborts and returns QueryTimeoutError when query exceeds timeout (simulated WAITFOR DELAY)", async () => {
        const slowQuery = createSqlServerQueryFixture(120);
        await expect(withQueryTimeout(slowQuery, 40, "SQL Server")).rejects.toThrow(QueryTimeoutError);
      });

      test("enforces row limit on SQL Server result set", async () => {
        const largeSet = Array.from({ length: 1200 }, (_, i) => ({ id: i + 1, name: `Record ${i + 1}` }));
        const query = createSqlServerQueryFixture(10, largeSet);
        const rawResult = await withQueryTimeout(query, 200, "SQL Server");

        const effectiveLimit = getEffectiveRowLimit(1500); // capped at 1000
        const limited = enforceRowLimit(rawResult.rows, effectiveLimit);

        expect(effectiveLimit).toBe(1000);
        expect(limited.rows).toHaveLength(1000);
        expect(limited.truncated).toBe(true);
      });
    });

    describe("2. SAP HANA Connector Fixture", () => {
      test("executes successfully when query finishes within timeout", async () => {
        const fastQuery = createHanaQueryFixture(20, [{ ID: 101, ITEM: "Widget A" }]);
        const result = await withQueryTimeout(fastQuery, 100, "SAP HANA");
        expect(result.columns).toContain("ITEM");
        expect(result.rows).toHaveLength(1);
      });

      test("aborts and returns QueryTimeoutError when HANA query exceeds timeout", async () => {
        const slowQuery = createHanaQueryFixture(120);
        await expect(withQueryTimeout(slowQuery, 40, "SAP HANA")).rejects.toThrow(QueryTimeoutError);
      });

      test("enforces row limit on SAP HANA result set", async () => {
        const largeSet = Array.from({ length: 500 }, (_, i) => ({ ID: i + 1, ITEM: `Item ${i + 1}` }));
        const query = createHanaQueryFixture(10, largeSet);
        const rawResult = await withQueryTimeout(query, 200, "SAP HANA");

        const effectiveLimit = getEffectiveRowLimit(200); // query requested 200 (< 1000)
        const limited = enforceRowLimit(rawResult.rows, effectiveLimit);

        expect(effectiveLimit).toBe(200);
        expect(limited.rows).toHaveLength(200);
        expect(limited.truncated).toBe(true);
      });
    });

    describe("3. SAP Service Layer Connector Fixture", () => {
      test("executes successfully when OData request finishes within timeout", async () => {
        const fastQuery = createServiceLayerQueryFixture(20, [{ DocEntry: 1, CardCode: "C100" }]);
        const result = await withQueryTimeout(fastQuery, 100, "SAP Service Layer");
        expect(result.columns).toContain("CardCode");
        expect(result.rows).toHaveLength(1);
      });

      test("aborts and returns QueryTimeoutError when Service Layer request exceeds timeout", async () => {
        const slowQuery = createServiceLayerQueryFixture(120);
        await expect(withQueryTimeout(slowQuery, 40, "SAP Service Layer")).rejects.toThrow(QueryTimeoutError);
      });

      test("enforces row limit on SAP Service Layer paginated records", async () => {
        const records = Array.from({ length: 1500 }, (_, i) => ({ DocEntry: i + 1, CardCode: `C${i + 1}` }));
        const query = createServiceLayerQueryFixture(10, records);
        const rawResult = await withQueryTimeout(query, 200, "SAP Service Layer");

        const effectiveLimit = getEffectiveRowLimit(); // default 1000
        const limited = enforceRowLimit(rawResult.rows, effectiveLimit);

        expect(effectiveLimit).toBe(1000);
        expect(limited.rows).toHaveLength(1000);
        expect(limited.truncated).toBe(true);
      });
    });
  });
});

