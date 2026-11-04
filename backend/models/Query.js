const mongoose = require("mongoose");

// Mongoose model for saved queries.
// Ref: SRS Section 2.6 (queries collection), Backlog sub-tasks 130, 131.
// Supports both relational SQL queries (SQL Server, SAP HANA) and OData queries (Service Layer).

const paramSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Parameter name is required"],
      trim: true
    },
    defaultValue: {
      type: String,
      default: ""
    }
  },
  { _id: false }
);

const columnMappingSchema = new mongoose.Schema(
  {
    source: {
      type: String,
      required: [true, "Source column name is required"],
      trim: true
    },
    common: {
      type: String,
      required: [true, "Common-format target column name is required"],
      trim: true
    }
  },
  { _id: false }
);

const querySchema = new mongoose.Schema(
  {
    // Display name of the saved query
    name: {
      type: String,
      required: [true, "Query name is required"],
      trim: true,
      unique: true
    },

    // Reference to the saved data source connection
    connectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Connection",
      required: [true, "Target connection ID is required"]
    },

    // Dialect kind: 'sql' (SQL Server / SAP HANA) or 'odata' (SAP Service Layer)
    kind: {
      type: String,
      enum: {
        values: ["sql", "odata"],
        message: "Kind must be either 'sql' or 'odata'"
      },
      required: [true, "Query kind is required"]
    },

    // SQL query text for relational databases (kind === 'sql')
    queryText: {
      type: String,
      default: "",
      trim: true
    },

    // Target entity for OData queries (e.g. Invoices, PurchaseOrders, Items)
    entity: {
      type: String,
      default: "",
      trim: true
    },

    // OData $filter string for Service Layer queries
    filter: {
      type: String,
      default: "",
      trim: true
    },

    // OData $select string for Service Layer queries
    select: {
      type: String,
      default: "",
      trim: true
    },

    // Parameter definitions accepted by this query
    params: {
      type: [paramSchema],
      default: []
    },

    // Column mapping rules from source to common format
    columnMapping: {
      type: [columnMappingSchema],
      default: []
    },

    // Row limit cap for this query (defaults to 1000 per SRS FR-16)
    rowLimit: {
      type: Number,
      default: 1000,
      min: [1, "Row limit must be at least 1"]
    },

    // Whether stored procedure EXEC is approved for this query (defaults to false)
    execApproved: {
      type: Boolean,
      default: false
    },

    // User identifier who saved the query (stub role until auth integration)
    createdBy: {
      type: String,
      default: "admin",
      trim: true
    }
  },
  {
    timestamps: true
  }
);

const Query = mongoose.model("Query", querySchema);

module.exports = Query;

