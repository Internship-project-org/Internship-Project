/**
 * CSV Builder
 * Story 6.3 | Owner: Swarnalakshmi Perumal | Sprint 1
 * Ref: NFR-05, sub-tasks #189, #190, #191, #192, #194
 *
 * Converts a common-format result { columns, rows } into a CSV file.
 * Security:
 *   - Escapes commas, quotes and line breaks  (sub-task #190)
 *   - Neutralises formula-injection cells (=, +, -, @)  (sub-task #191)
 *   - Adds UTF-8 BOM so Excel opens it correctly  (sub-task #190)
 */

const fs   = require("fs");
const path = require("path");

// UTF-8 BOM — makes Excel recognise the encoding correctly
const BOM = "\uFEFF";

/**
 * Escapes a single cell value for CSV:
 *   - Wraps in quotes if it contains comma, quote, or newline
 *   - Doubles any internal quote characters
 *   - Neutralises formula injection (=, +, -, @) by prefixing a tab  (sub-task #191)
 *
 * @param {any} value
 * @returns {string}
 */
function escapeCell(value) {
  if (value === null || value === undefined) return "";

  let str = String(value);

  // Neutralise formula injection — cells starting with dangerous chars
  if (/^[=+\-@]/.test(str)) {
    str = `\t${str}`;
  }

  // Wrap in quotes if the cell contains a comma, double-quote, or newline
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    str = `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Builds a CSV string from a common-format result.
 *
 * @param {{ columns: string[], rows: any[][] }} result
 * @returns {string} Full CSV content including BOM and header row
 */
function buildCsvString(result) {
  const lines = [];

  // Header row
  lines.push(result.columns.map(escapeCell).join(","));

  // Data rows
  for (const row of result.rows) {
    lines.push(row.map(escapeCell).join(","));
  }

  return BOM + lines.join("\r\n");
}

/**
 * Writes a CSV file and returns its path.
 *
 * @param {{ columns: string[], rows: any[][] }} result - Common-format result
 * @param {string} outputDir - Directory to write the file into
 * @returns {string} Absolute path to the generated CSV file
 */
function writeCsv(result, outputDir) {
  if (!result || !Array.isArray(result.columns) || !Array.isArray(result.rows)) {
    throw new Error("csvBuilder: invalid result — expected { columns, rows }.");
  }

  // Unique filename with timestamp (sub-task #192)
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename  = `report_${timestamp}.csv`;
  const filePath  = path.join(outputDir, filename);

  const csvContent = buildCsvString(result);
  fs.writeFileSync(filePath, csvContent, "utf8");

  return filePath;
}

module.exports = { writeCsv, buildCsvString, escapeCell };

