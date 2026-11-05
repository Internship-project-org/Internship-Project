# Query Timeout & Row Limits Configuration (Story 5.4)

- **Epic 5**: Query Management, Validation and Data Mapping
- **Story**: Story 5.4 – Implement Query Timeout and Row Limits (shared config)
- **Owner**: Rohit Biju
- **Priority**: Highest | **Points**: 3 | **Sprint**: Sprint 1 (Day 1)
- **References**: SRS Section 2.6, FR-16, A5

---

## 1. Overview & Architecture Rule 2

Per Project Rule 2:
> *"Every shared job has one file: one decrypt, one validator, one limits config, one formatter, mapping applied once."*

All connectors and query execution endpoints read from a single shared configuration file:
`backend/config/limits.js`

### Consumer Mapping
| Connector Module | Story ID | Owner | Usage |
|:---|:---|:---|:---|
| **SQL Server Connector** | Story 2.2 | Joice Mary Ajith | Uses `withQueryTimeout` and `getEffectiveRowLimit` / `enforceRowLimit` |
| **SAP HANA Connector** | Story 3.2 | Swarnalakshmi Perumal | Uses `withQueryTimeout` and `getEffectiveRowLimit` / `enforceRowLimit` |
| **SAP Service Layer Connector** | Story 4.3 | Akshay S P | Uses `withQueryTimeout` and `getEffectiveRowLimit` across OData pages |

---

## 2. Configuration Defaults & Environment Variables

| Setting | Default Value | Environment Variable | Description |
|:---|:---|:---|:---|
| **Query Timeout** | `30000` (30 seconds) | `QUERY_TIMEOUT_MS` | Maximum duration a connector query can execute before aborting. |
| **Max Row Limit Cap** | `1000` rows | `MAX_ROW_LIMIT_CAP` | Hard upper bound on returned rows (Ref: FR-16). |
| **Default Row Limit** | `1000` rows | `DEFAULT_ROW_LIMIT` | Fallback row limit when a query definition specifies none. |

---

## 3. Connector Integration Guide

Connectors import the shared helpers from `../config/limits`:

```javascript
const {
  getEffectiveRowLimit,
  getEffectiveTimeout,
  enforceRowLimit,
  withQueryTimeout
} = require("../config/limits");

// 1. Compute effective row limit (Ref: FR-16: smaller of query limit and global cap)
const effectiveLimit = getEffectiveRowLimit(query.rowLimit);

// 2. Wrap query execution with timeout guard
const rawResult = await withQueryTimeout(
  () => driver.executeQuery(sql, params),
  effectiveTimeout,
  "SQL Server" // Connector name for error messaging
);

// 3. Enforce row limit on returned rows
const { rows, truncated, totalCount } = enforceRowLimit(rawResult.rows, effectiveLimit);
```

---

## 4. Standard Error Specifications

If a query execution exceeds limits, it returns a standardized error code that safely formats through `security/sanitiser.js`:

1. **`QueryTimeoutError`**
   - **Code**: `QUERY_TIMEOUT`
   - **HTTP Status**: `504 Gateway Timeout`
   - **Message Format**: `"Query execution exceeded timeout limit of <timeoutMs>ms (<connector>). Ref: Story 5.4 / A5"`

2. **`RowLimitExceededError`** (Strict validation mode)
   - **Code**: `ROW_LIMIT_EXCEEDED`
   - **HTTP Status**: `400 Bad Request`
   - **Message Format**: `"Query result exceeded row limit cap of <limit> rows (received <count>). Ref: FR-16"`

---

## 5. Open Question for Mentor (Ref: A5)

> **Mentor Clarification Item (A5)**:
> *"The shared limits configuration currently enforces a 30-second query execution timeout and a 1,000-row maximum cap per query across all three connectors (SQL Server, SAP HANA, and Service Layer).
> Could the mentor confirm whether:
> 1. 30 seconds and 1,000 rows are sufficient for all Batch 2 reporting and notification aggregation jobs?
> 2. Specific summary or report generation jobs (e.g., CSV/Excel exports in Epic 6) should allow a higher pagination or export cap, or if 1,000 rows remains a hard ceiling for all queries?"*

