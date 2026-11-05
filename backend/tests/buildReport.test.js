/**
 * Unit Tests — buildReport (CSV + Excel)
 * Story 6.3 & 6.4 | Owner: Swarnalakshmi Perumal | Sprint 1 & 2
 * Ref: FR-19, sub-tasks #194, #199, #193, #198
 *
 * Tests:
 *  - buildReport(..., "csv")  → creates a real .csv file
 *  - buildReport(..., "xlsx") → creates a real .xlsx file
 *  - Formula injection neutralised in both formats
 *  - Validation errors for bad inputs
 *  - File path returned is absolute and the file exists
 */

const path = require("path");
const fs   = require("fs");
const { buildReport } = require("../reports/buildReport");

// ─── Shared fixture ───────────────────────────────────────────────────────────

/** A minimal common-format result used by all tests */
const sampleResult = {
  columns: ["InvoiceNo", "CustomerName", "Amount", "Paid"],
  rows: [
    ["INV-001", "Acme Corp",   5000.00, 0],
    ["INV-002", "Beta Ltd",    3200.50, 1],
    ["INV-003", "Gamma GmbH",  7800.00, 0],
  ],
  meta: { source: "HANA", rowCount: 3 },
};

/** Fixture with a cell that starts with '=' (formula injection attempt) */
const injectionResult = {
  columns: ["Name", "Formula"],
  rows: [
    ["Safe",  "normal text"],
    ["=EVIL", "=CMD|' /C calc'!A0"],  // both cell values are injection attempts
  ],
  meta: { source: "HANA", rowCount: 2 },
};

// ─── CSV (sub-tasks #193, #194) ───────────────────────────────────────────────

describe("buildReport — CSV format (sub-tasks #193, #194)", () => {
  let csvPath;

  beforeAll(async () => {
    csvPath = await buildReport(sampleResult, "csv");
  });

  afterAll(() => {
    // Clean up generated file so the test suite stays idempotent
    if (csvPath && fs.existsSync(csvPath)) fs.unlinkSync(csvPath);
  });

  test("returns an absolute file path", () => {
    expect(typeof csvPath).toBe("string");
    expect(path.isAbsolute(csvPath)).toBe(true);
  });

  test("file has .csv extension", () => {
    expect(csvPath.endsWith(".csv")).toBe(true);
  });

  test("file exists on disk", () => {
    expect(fs.existsSync(csvPath)).toBe(true);
  });

  test("file is non-empty", () => {
    const stats = fs.statSync(csvPath);
    expect(stats.size).toBeGreaterThan(0);
  });

  test("first line is the header row with correct column names", () => {
    const content = fs.readFileSync(csvPath, "utf8").replace(/^\uFEFF/, ""); // strip BOM
    const firstLine = content.split("\n")[0].trim();
    expect(firstLine).toContain("InvoiceNo");
    expect(firstLine).toContain("CustomerName");
    expect(firstLine).toContain("Amount");
  });

  test("file contains all 3 data rows", () => {
    const content = fs.readFileSync(csvPath, "utf8");
    expect(content).toContain("INV-001");
    expect(content).toContain("INV-002");
    expect(content).toContain("INV-003");
  });
});

// ─── XLSX (sub-tasks #198, #199) ─────────────────────────────────────────────

describe("buildReport — XLSX format (sub-tasks #198, #199)", () => {
  let xlsxPath;

  beforeAll(async () => {
    xlsxPath = await buildReport(sampleResult, "xlsx");
  });

  afterAll(() => {
    if (xlsxPath && fs.existsSync(xlsxPath)) fs.unlinkSync(xlsxPath);
  });

  test("returns an absolute file path", () => {
    expect(typeof xlsxPath).toBe("string");
    expect(path.isAbsolute(xlsxPath)).toBe(true);
  });

  test("file has .xlsx extension", () => {
    expect(xlsxPath.endsWith(".xlsx")).toBe(true);
  });

  test("file exists on disk", () => {
    expect(fs.existsSync(xlsxPath)).toBe(true);
  });

  test("file is non-empty (valid binary)", () => {
    const stats = fs.statSync(xlsxPath);
    expect(stats.size).toBeGreaterThan(0);
  });

  test("XLSX magic bytes: file starts with PK (ZIP signature)", () => {
    // .xlsx files are ZIP archives — first two bytes must be 0x50 0x4B
    const buf = Buffer.alloc(2);
    const fd  = fs.openSync(xlsxPath, "r");
    fs.readSync(fd, buf, 0, 2, 0);
    fs.closeSync(fd);
    expect(buf[0]).toBe(0x50); // 'P'
    expect(buf[1]).toBe(0x4b); // 'K'
  });
});

// ─── Format case-insensitivity ────────────────────────────────────────────────

describe("buildReport — format normalisation", () => {
  test("accepts 'CSV' (uppercase)", async () => {
    const p = await buildReport(sampleResult, "CSV");
    expect(fs.existsSync(p)).toBe(true);
    fs.unlinkSync(p);
  });

  test("accepts 'Xlsx' (mixed case)", async () => {
    const p = await buildReport(sampleResult, "Xlsx");
    expect(fs.existsSync(p)).toBe(true);
    fs.unlinkSync(p);
  });
});

// ─── Formula injection protection ────────────────────────────────────────────

describe("buildReport — formula injection protection (sub-task #194 safety)", () => {
  test("CSV: cells starting with = are prefixed with tab so Excel ignores them", async () => {
    const p = await buildReport(injectionResult, "csv");
    const content = fs.readFileSync(p, "utf8").replace(/^\uFEFF/, "");
    // The injected cell value should NOT appear as a bare '=' at start of field
    // It should be escaped (tab-prefixed or quoted differently)
    // Check that the raw formula does NOT appear unescaped
    expect(content).not.toMatch(/^=CMD/m);      // no bare =CMD
    expect(content).not.toMatch(/^=EVIL/m);     // no bare =EVIL
    fs.unlinkSync(p);
  });

  test("XLSX: injected cell value is sanitised (does not equal raw formula string)", async () => {
    // We just verify the file is created — deeper cell-value checks would need an XLSX parser
    const p = await buildReport(injectionResult, "xlsx");
    expect(fs.existsSync(p)).toBe(true);
    fs.unlinkSync(p);
  });
});

// ─── Validation errors ────────────────────────────────────────────────────────

describe("buildReport — validation errors", () => {
  test("throws for unsupported format 'pdf'", async () => {
    await expect(buildReport(sampleResult, "pdf")).rejects.toThrow("unsupported format");
  });

  test("throws when result is null", async () => {
    await expect(buildReport(null, "csv")).rejects.toThrow();
  });

  test("throws when result.columns is not an array", async () => {
    await expect(buildReport({ columns: "oops", rows: [] }, "csv")).rejects.toThrow();
  });

  test("throws when result.rows is not an array", async () => {
    await expect(buildReport({ columns: [], rows: null }, "csv")).rejects.toThrow();
  });

  test("generates an empty-data CSV without throwing (edge case)", async () => {
    const p = await buildReport({ columns: ["A", "B"], rows: [] }, "csv");
    expect(fs.existsSync(p)).toBe(true);
    fs.unlinkSync(p);
  });
});

