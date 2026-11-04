const {
  validateQuerySafety,
  validateSqlQuery,
  validateODataRequest,
  validateQueryParams
} = require("../security/validator");
const { isProductionHost } = require("../security/hostCheck");
const { sanitizeMessage, sanitizeError } = require("../security/sanitiser");

describe("Story 5.3 - Query Safety Validator & Security Tests", () => {
  describe("SQL Safety Validation (sub-task 149)", () => {
    test("allows standard SELECT query", () => {
      const sql = "SELECT InvoiceNo, CustomerName, Amount FROM Invoices WHERE Paid = 0";
      const result = validateSqlQuery(sql);
      expect(result.valid).toBe(true);
    });

    test("allows Common Table Expression (WITH ... SELECT)", () => {
      const sql = "WITH OverdueInvoices AS (SELECT * FROM Invoices WHERE Paid = 0) SELECT * FROM OverdueInvoices";
      const result = validateSqlQuery(sql);
      expect(result.valid).toBe(true);
    });

    test("allows query with SQL comments", () => {
      const sql = "-- Fetch pending invoices\nSELECT * FROM Invoices /* active only */ WHERE Paid = 0";
      const result = validateSqlQuery(sql);
      expect(result.valid).toBe(true);
    });

    // Sub-task 149: One test per forbidden keyword
    test("rejects INSERT statement", () => {
      const sql = "INSERT INTO Invoices (InvoiceNo, Amount) VALUES ('INV-999', 500)";
      const result = validateSqlQuery(sql);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("INSERT");
    });

    test("rejects UPDATE statement", () => {
      const sql = "UPDATE Invoices SET Paid = 1 WHERE InvoiceNo = 'INV-101'";
      const result = validateSqlQuery(sql);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("UPDATE");
    });

    test("rejects DELETE statement", () => {
      const sql = "DELETE FROM Invoices WHERE DueDate < '2026-01-01'";
      const result = validateSqlQuery(sql);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("DELETE");
    });

    test("rejects DROP statement", () => {
      const sql = "DROP TABLE Invoices";
      const result = validateSqlQuery(sql);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("DROP");
    });

    test("rejects ALTER statement", () => {
      const sql = "ALTER TABLE Invoices ADD COLUMN TempCol VARCHAR(50)";
      const result = validateSqlQuery(sql);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("ALTER");
    });

    test("rejects TRUNCATE statement", () => {
      const sql = "TRUNCATE TABLE Invoices";
      const result = validateSqlQuery(sql);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("TRUNCATE");
    });
  });

  describe("Stored Procedure EXEC Validation (sub-task 150)", () => {
    test("rejects EXEC when execApproved is false", () => {
      const sql = "EXEC sp_GetOverdueInvoices @days = 30";
      const result = validateSqlQuery(sql, { execApproved: false });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("EXEC");
    });

    test("allows EXEC when execApproved is true", () => {
      const sql = "EXEC sp_GetOverdueInvoices @days = 30";
      const result = validateSqlQuery(sql, { execApproved: true });
      expect(result.valid).toBe(true);
    });
  });

  describe("Parameter Validation (sub-task 151)", () => {
    test("accepts valid SQL Server parameter name (@asOfDate)", () => {
      const params = [{ name: "@asOfDate", defaultValue: "2026-10-29" }];
      const result = validateQueryParams(params);
      expect(result.valid).toBe(true);
    });

    test("accepts valid SAP HANA parameter marker (?)", () => {
      const params = [{ name: "?", defaultValue: "100" }];
      const result = validateQueryParams(params);
      expect(result.valid).toBe(true);
    });

    test("rejects invalid parameter naming with special characters", () => {
      const params = [{ name: "@param; DROP TABLE", defaultValue: "" }];
      const result = validateQueryParams(params);
      expect(result.valid).toBe(false);
    });
  });

  describe("Service Layer OData Validation (sub-task 152)", () => {
    test("allows valid GET request on approved entity", () => {
      const result = validateODataRequest({
        entity: "Invoices",
        method: "GET",
        filter: "Paid eq 0"
      });
      expect(result.valid).toBe(true);
    });

    test("rejects POST write method", () => {
      const result = validateODataRequest({
        entity: "Invoices",
        method: "POST"
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Only GET requests are allowed");
    });

    test("rejects DELETE write method", () => {
      const result = validateODataRequest({
        entity: "Invoices",
        method: "DELETE"
      });
      expect(result.valid).toBe(false);
    });

    test("rejects unbalanced quotation in OData filter", () => {
      const result = validateODataRequest({
        entity: "Invoices",
        filter: "CustomerName eq 'ACME Corp"
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("unbalanced");
    });
  });

  describe("Production Host Guard (sub-task 153)", () => {
    test("blocks connection if hostname contains 'production'", () => {
      const check = isProductionHost("sap-production.company.internal");
      expect(check.ok).toBe(false);
      expect(check.reason).toContain("BR-02");
    });

    test("blocks connection if database name contains 'prod'", () => {
      const check = isProductionHost("192.168.1.50", "Sales_Prod_DB");
      expect(check.ok).toBe(false);
      expect(check.reason).toContain("BR-02");
    });

    test("allows localhost and mock servers", () => {
      const check = isProductionHost("localhost:1433", "SalesTest");
      expect(check.ok).toBe(true);
    });
  });

  describe("Error Sanitizer (sub-task 154)", () => {
    test("masks password in connection string or message", () => {
      const raw = "Connection failed: Server=localhost;User ID=sa;password=SuperSecretPassword123;";
      const clean = sanitizeMessage(raw);
      expect(clean).not.toContain("SuperSecretPassword123");
      expect(clean).toContain("***REDACTED***");
    });

    test("sanitizeError formats error object without leaking secrets", () => {
      const err = new Error("Failed to authenticate with pwd=secret_token_abc");
      const result = sanitizeError(err);
      expect(result.ok).toBe(false);
      expect(result.message).not.toContain("secret_token_abc");
    });
  });
});

