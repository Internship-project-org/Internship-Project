/**
 * Excel Builder
 * Story 6.4 | Owner: Swarnalakshmi Perumal | Sprint 2
 * Ref: sub-tasks #196, #197, #198, #199
 *
 * Converts a common-format result { columns, rows } into an XLSX file using ExcelJS.
 * Security:
 *   - Writes all cells as text (type: 'string') to prevent formula execution  (sub-task #197)
 */

const ExcelJS = require("exceljs");
const path    = require("path");

/**
 * Writes an XLSX file and returns its path.
 *
 * @param {{ columns: string[], rows: any[][] }} result - Common-format result
 * @param {string} outputDir - Directory to write the file into
 * @returns {Promise<string>} Absolute path to the generated XLSX file
 */
async function writeExcel(result, outputDir) {
  if (!result || !Array.isArray(result.columns) || !Array.isArray(result.rows)) {
    throw new Error("excelBuilder: invalid result — expected { columns, rows }.");
  }

  const workbook  = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Report");

  // ── Header row ────────────────────────────────────────────────────────────
  worksheet.addRow(result.columns);

  // Style header: bold
  const headerRow = worksheet.getRow(1);
  headerRow.font  = { bold: true };
  headerRow.commit();

  // ── Data rows — write as text to prevent formula execution (sub-task #197) ─
  for (const row of result.rows) {
    const safeRow = row.map((cell) => {
      const str = cell === null || cell === undefined ? "" : String(cell);
      // Neutralise formula injection by prefixing with a space if starts with = + - @
      return /^[=+\-@]/.test(str) ? ` ${str}` : str;
    });
    worksheet.addRow(safeRow);
  }

  // ── Unique filename with timestamp ────────────────────────────────────────
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename  = `report_${timestamp}.xlsx`;
  const filePath  = path.join(outputDir, filename);

  // ── Save file and return path (sub-task #198) ─────────────────────────────
  await workbook.xlsx.writeFile(filePath);

  return filePath;
}

module.exports = { writeExcel };

