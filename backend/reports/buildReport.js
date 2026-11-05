/**
 * buildReport — Report generation entry point
 * Story 6.3 & 6.4 | Owner: Swarnalakshmi Perumal | Sprint 1 & 2
 * Ref: FR-19, sub-tasks #193, #198
 *
 * Usage (from Batch 1 / notification engine):
 *   const { buildReport } = require("./reports/buildReport");
 *   const filePath = await buildReport(result, "csv");   // → "/path/to/report.csv"
 *   const filePath = await buildReport(result, "xlsx");  // → "/path/to/report.xlsx"
 *
 * Contract with Batch 1 (do NOT change without telling them):
 *   buildReport(result, format) → string (absolute file path)
 *   - result  : { columns: string[], rows: any[][], meta: { source, rowCount } }
 *   - format  : "csv" | "xlsx"
 */

const path   = require("path");
const fs     = require("fs");
const { writeCsv }   = require("./csvBuilder");
const { writeExcel } = require("./excelBuilder");

// Reports are written to backend/reports/output/ — this folder is git-ignored
const OUTPUT_DIR = path.resolve(__dirname, "output");

// Ensure output directory exists on startup
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Builds a CSV or Excel report file from a common-format result.
 *
 * @param {{ columns: string[], rows: any[][], meta?: object }} result
 * @param {"csv"|"xlsx"} format
 * @returns {Promise<string>} Absolute file path of the generated report
 */
async function buildReport(result, format) {
  // ── Validate inputs (sub-task #193) ───────────────────────────────────────
  if (!result || typeof result !== "object") {
    throw new Error("buildReport: result must be a valid common-format object.");
  }

  if (!Array.isArray(result.columns)) {
    throw new Error("buildReport: result.columns must be an array.");
  }

  if (!Array.isArray(result.rows)) {
    throw new Error("buildReport: result.rows must be an array.");
  }

  const normalizedFormat = String(format || "").toLowerCase();

  if (!["csv", "xlsx"].includes(normalizedFormat)) {
    throw new Error(`buildReport: unsupported format '${format}'. Use "csv" or "xlsx".`);
  }

  // ── Route to the correct builder ──────────────────────────────────────────
  if (normalizedFormat === "csv") {
    const filePath = writeCsv(result, OUTPUT_DIR);
    return filePath;
  }

  if (normalizedFormat === "xlsx") {
    const filePath = await writeExcel(result, OUTPUT_DIR);
    return filePath;
  }
}

module.exports = { buildReport };

