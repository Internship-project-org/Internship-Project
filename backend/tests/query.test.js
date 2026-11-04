const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../app");
const Query = require("../models/Query");

// Story 5.1 - Query Management Tests (CRUD & Validation)
// Ref: sub-tasks 132, 133, 140

describe("Story 5.1 - Query Management API (/api/queries)", () => {
  const fakeConnectionId = new mongoose.Types.ObjectId().toString();

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("POST /api/queries (Create Query)", () => {
    test("rejects query creation when name is missing", async () => {
      const response = await request(app)
        .post("/api/queries")
        .send({
          connectionId: fakeConnectionId,
          kind: "sql",
          queryText: "SELECT * FROM Invoices"
        });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.message).toContain("Query name is required");
    });

    test("rejects query creation when connectionId is missing", async () => {
      const response = await request(app)
        .post("/api/queries")
        .send({
          name: "All Invoices",
          kind: "sql",
          queryText: "SELECT * FROM Invoices"
        });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.message).toContain("Connection ID is required");
    });

    test("rejects query creation when kind is invalid", async () => {
      const response = await request(app)
        .post("/api/queries")
        .send({
          name: "Invalid Kind Query",
          connectionId: fakeConnectionId,
          kind: "graphql",
          queryText: "SELECT * FROM Invoices"
        });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.message).toContain("must be either 'sql' or 'odata'");
    });

    test("blocks query creation if SQL contains disallowed operations (Story 5.3 integration)", async () => {
      const response = await request(app)
        .post("/api/queries")
        .send({
          name: "Dangerous Drop Query",
          connectionId: fakeConnectionId,
          kind: "sql",
          queryText: "DROP TABLE Invoices"
        });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.message).toContain("disallowed operation: 'DROP'");
    });

    test("successfully creates a valid SQL query", async () => {
      const validQuery = {
        name: "Overdue Invoices",
        connectionId: fakeConnectionId,
        kind: "sql",
        queryText: "SELECT InvoiceNo, CustomerName, DueDate, Amount FROM Invoices WHERE Paid = 0",
        params: [{ name: "@asOfDate", defaultValue: "2026-10-29" }],
        columnMapping: [{ source: "CustomerName", common: "ClientName" }],
        rowLimit: 500,
        execApproved: false
      };

      // Mock Query save
      jest.spyOn(Query.prototype, "save").mockResolvedValue({
        _id: new mongoose.Types.ObjectId().toString(),
        ...validQuery,
        createdBy: "admin",
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const response = await request(app)
        .post("/api/queries")
        .send(validQuery);

      expect(response.status).toBe(201);
      expect(response.body.ok).toBe(true);
      expect(response.body.data.name).toBe("Overdue Invoices");
      expect(response.body.data.kind).toBe("sql");
    });

    test("successfully creates a valid OData Service Layer query", async () => {
      const validOData = {
        name: "Open Purchase Orders",
        connectionId: fakeConnectionId,
        kind: "odata",
        entity: "PurchaseOrders",
        filter: "Status eq 'Open'",
        select: "PONumber,SupplierName,PromisedDate",
        rowLimit: 200
      };

      jest.spyOn(Query.prototype, "save").mockResolvedValue({
        _id: new mongoose.Types.ObjectId().toString(),
        ...validOData,
        createdBy: "admin",
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const response = await request(app)
        .post("/api/queries")
        .send(validOData);

      expect(response.status).toBe(201);
      expect(response.body.ok).toBe(true);
      expect(response.body.data.entity).toBe("PurchaseOrders");
    });
  });

  describe("GET /api/queries (List Queries)", () => {
    test("returns all saved queries", async () => {
      const mockList = [
        { _id: "1", name: "Query 1", kind: "sql" },
        { _id: "2", name: "Query 2", kind: "odata" }
      ];

      jest.spyOn(Query, "find").mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockResolvedValue(mockList)
        })
      });

      const response = await request(app).get("/api/queries");

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.count).toBe(2);
      expect(response.body.data).toHaveLength(2);
    });
  });

  describe("GET /api/queries/:id (Get One Query)", () => {
    test("returns a query by its ID", async () => {
      const mockQuery = {
        _id: "672877a56138402cbca09999",
        name: "Test Query",
        kind: "sql",
        queryText: "SELECT * FROM Items"
      };

      jest.spyOn(Query, "findById").mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockQuery)
      });

      const response = await request(app).get(`/api/queries/${mockQuery._id}`);

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data.name).toBe("Test Query");
    });

    test("returns 404 when query is not found", async () => {
      jest.spyOn(Query, "findById").mockReturnValue({
        populate: jest.fn().mockResolvedValue(null)
      });

      const response = await request(app).get("/api/queries/nonexistent_id");

      expect(response.status).toBe(404);
      expect(response.body.ok).toBe(false);
      expect(response.body.message).toContain("not found");
    });
  });

  describe("PUT /api/queries/:id (Update Query)", () => {
    test("rejects unsafe update that introduces destructive SQL", async () => {
      const existingQuery = {
        _id: "query123",
        name: "Safe Query",
        kind: "sql",
        queryText: "SELECT * FROM Invoices"
      };

      jest.spyOn(Query, "findById").mockResolvedValue(existingQuery);

      const response = await request(app)
        .put("/api/queries/query123")
        .send({ queryText: "DELETE FROM Invoices" });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.message).toContain("disallowed operation: 'DELETE'");
    });

    test("successfully updates safe query fields", async () => {
      const mockDoc = {
        _id: "query123",
        name: "Old Name",
        kind: "sql",
        queryText: "SELECT * FROM Invoices",
        save: jest.fn().mockResolvedValue({
          _id: "query123",
          name: "Updated Name",
          kind: "sql",
          queryText: "SELECT InvoiceNo, Amount FROM Invoices"
        })
      };

      jest.spyOn(Query, "findById").mockResolvedValue(mockDoc);

      const response = await request(app)
        .put("/api/queries/query123")
        .send({
          name: "Updated Name",
          queryText: "SELECT InvoiceNo, Amount FROM Invoices"
        });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data.name).toBe("Updated Name");
    });
  });

  describe("DELETE /api/queries/:id (Delete Query)", () => {
    test("successfully deletes an existing query", async () => {
      jest.spyOn(Query, "findByIdAndDelete").mockResolvedValue({
        _id: "query123",
        name: "Deprecated Query"
      });

      const response = await request(app).delete("/api/queries/query123");

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.message).toContain("successfully deleted");
    });

    test("returns 404 when deleting a non-existent query", async () => {
      jest.spyOn(Query, "findByIdAndDelete").mockResolvedValue(null);

      const response = await request(app).delete("/api/queries/missing_id");

      expect(response.status).toBe(404);
      expect(response.body.ok).toBe(false);
      expect(response.body.message).toContain("not found");
    });
  });
});

