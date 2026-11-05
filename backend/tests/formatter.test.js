/**
 * Unit Tests — Common Data Formatter
 * Story 6.1 | Owner: Swarnalakshmi Perumal | Sprint 1
 * Ref: FR-17, sub-task #180
 *
 * Coverage:
 *  - formatResult: basic format, column mapping, empty rows,
 *                  missing source (throws), row padding / trimming
 *  - applyColumnMapping: maps known columns, leaves unknown ones unchanged
 *  - isValidRaw: truthy/falsy guards
 */

const { formatResult, applyColumnMapping, isValidRaw } = require("../core/formatter");

// ─── applyColumnMapping ─────────────────────────────────────────────────────

describe("applyColumnMapping", () => {
  test("renames columns that appear in the mapping", () => {
    const result = applyColumnMapping(["InvoiceNo", "Amount"], { Amount: "TotalAmount" });
    expect(result).toEqual(["InvoiceNo", "TotalAmount"]);
  });

  test("leaves columns unchanged when they have no mapping entry", () => {
    const result = applyColumnMapping(["ItemCode", "ItemName"], { Amount: "TotalAmount" });
    expect(result).toEqual(["ItemCode", "ItemName"]);
  });

  test("returns original array when columnMapping is null", () => {
    const cols = ["A", "B"];
    expect(applyColumnMapping(cols, null)).toEqual(cols);
  });

  test("returns original array when columnMapping is not an object", () => {
    expect(applyColumnMapping(["A"], "bad")).toEqual(["A"]);
  });

  test("handles an empty mapping object (no renames)", () => {
    expect(applyColumnMapping(["X", "Y"], {})).toEqual(["X", "Y"]);
  });
});

// ─── isValidRaw ─────────────────────────────────────────────────────────────

describe("isValidRaw", () => {
  test("returns true for a valid raw object", () => {
    expect(isValidRaw({ columns: ["A"], rows: [[1]] })).toBe(true);
  });

  test("returns true for empty columns/rows arrays", () => {
    expect(isValidRaw({ columns: [], rows: [] })).toBe(true);
  });

  test("returns false for null", () => {
    expect(isValidRaw(null)).toBe(false);
  });

  test("returns false when columns is missing", () => {
    expect(isValidRaw({ rows: [] })).toBe(false);
  });

  test("returns false when rows is missing", () => {
    expect(isValidRaw({ columns: [] })).toBe(false);
  });

  test("returns false when columns is not an array", () => {
    expect(isValidRaw({ columns: "oops", rows: [] })).toBe(false);
  });
});

// ─── formatResult ───────────────────────────────────────────────────────────

describe("formatResult", () => {
  const rawInvoices = {
    columns: ["InvoiceNo", "CustomerName", "Amount"],
    rows: [
      ["INV-001", "Acme Corp", 5000],
      ["INV-002", "Beta Ltd",  3200],
    ],
  };

  test("returns the correct common-format shape", () => {
    const result = formatResult(rawInvoices, "HANA");
    expect(result).toMatchObject({
      columns: ["InvoiceNo", "CustomerName", "Amount"],
      rows: [
        ["INV-001", "Acme Corp", 5000],
        ["INV-002", "Beta Ltd",  3200],
      ],
      meta: { source: "HANA", rowCount: 2 },
    });
  });

  test("applies column mapping correctly (sub-task #178)", () => {
    const result = formatResult(rawInvoices, "HANA", { Amount: "TotalAmount" });
    expect(result.columns).toEqual(["InvoiceNo", "CustomerName", "TotalAmount"]);
    // rows are unchanged — only headers are mapped
    expect(result.rows[0][2]).toBe(5000);
  });

  test("handles empty rows array", () => {
    const result = formatResult({ columns: ["A", "B"], rows: [] }, "HANA");
    expect(result.rows).toEqual([]);
    expect(result.meta.rowCount).toBe(0);
  });

  test("pads short rows with null to match column count (sub-task #179)", () => {
    const raw = { columns: ["A", "B", "C"], rows: [["val1"]] };
    const result = formatResult(raw, "HANA");
    expect(result.rows[0]).toEqual(["val1", null, null]);
  });

  test("trims rows that are longer than column count", () => {
    const raw = { columns: ["A", "B"], rows: [["val1", "val2", "EXTRA"]] };
    const result = formatResult(raw, "HANA");
    expect(result.rows[0]).toEqual(["val1", "val2"]);
  });

  test("replaces non-array rows with null-filled arrays", () => {
    const raw = { columns: ["A", "B"], rows: ["bad-row"] };
    const result = formatResult(raw, "HANA");
    expect(result.rows[0]).toEqual([null, null]);
  });

  test("throws when source is missing", () => {
    expect(() => formatResult(rawInvoices, "")).toThrow("source name is required");
    expect(() => formatResult(rawInvoices, null)).toThrow("source name is required");
  });

  test("throws when raw is not an object", () => {
    expect(() => formatResult("bad", "HANA")).toThrow("raw result must be an object");
  });

  test("throws when raw.columns is not an array", () => {
    expect(() => formatResult({ columns: null, rows: [] }, "HANA")).toThrow("columns must be an array");
  });

  test("throws when raw.rows is not an array", () => {
    expect(() => formatResult({ columns: [], rows: null }, "HANA")).toThrow("rows must be an array");
  });

  test("meta.source matches the source argument (sub-task #177)", () => {
    const r = formatResult({ columns: ["X"], rows: [[1]] }, "SQLServer");
    expect(r.meta.source).toBe("SQLServer");
  });

  test("meta.rowCount equals actual number of rows returned", () => {
    const raw = { columns: ["A"], rows: [[1], [2], [3]] };
    const r = formatResult(raw, "HANA");
    expect(r.meta.rowCount).toBe(3);
  });
});

