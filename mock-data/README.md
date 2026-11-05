# Mock Data — Canonical Test Data Folder
**Story 3.4 | Owner: Swarnalakshmi Perumal | Batch 2 — Data Connectors**

---

## ⚠️ Golden Rule
**All three data sources must load from this folder only.**  
No connector or mock server creates its own test data.  
If you need a new column or more rows, update the files here and tell the team.

---

## Folder Structure

```
mock-data/
├── demo/                    ← Small hand-crafted set (20–30 rows each)
│   ├── invoices.json        20 rows
│   ├── purchaseOrders.json  15 rows
│   ├── items.json           20 rows
│   └── salesSummary.json    30 rows (10 days × 3 branches)
│
├── large/                   ← Generated test set for row-limit & paging tests
│   ├── invoices.json        1200 rows
│   ├── purchaseOrders.json  1100 rows
│   ├── items.json           500 rows
│   └── salesSummary.json    1200 rows (400 days × 3 branches)
│
├── generate.js              ← Re-run to regenerate large/ files
└── README.md                ← This file
```

---

## Column Schemas (FR-23)

### Invoices
| Column | Type | Notes |
|--------|------|-------|
| `InvoiceNo` | string | e.g. `INV-1001` |
| `CustomerCode` | string | e.g. `C001` |
| `CustomerName` | string | |
| `Email` | string | Customer accounts email |
| `DueDate` | string | ISO date `YYYY-MM-DD` |
| `Amount` | number | In INR |
| `Paid` | boolean | `false` for all test records |

### PurchaseOrders
| Column | Type | Notes |
|--------|------|-------|
| `PONumber` | string | e.g. `PO-2001` |
| `SupplierName` | string | |
| `Email` | string | Supplier dispatch email |
| `PromisedDate` | string | ISO date `YYYY-MM-DD` |
| `Status` | string | `Open`, `Pending`, or `Delayed` |

### Items
| Column | Type | Notes |
|--------|------|-------|
| `ItemCode` | string | e.g. `ITEM-001` |
| `ItemName` | string | |
| `QtyAvailable` | number | Current stock |
| `ReorderLevel` | number | Alert threshold |

### SalesSummary
| Column | Type | Notes |
|--------|------|-------|
| `Date` | string | ISO date `YYYY-MM-DD` |
| `Branch` | string | `Chennai`, `Bangalore`, or `Mumbai` |
| `TotalSales` | number | In INR |
| `Orders` | number | Count of orders |

---

## How Each Connector Loads This Data

### SQL Server (Joice — Story 2.3)
Load `demo/` or `large/` files into SQL Server test tables via `db/sqlserver/init.sql`.

```sql
-- Tables must match column names exactly as above
-- Use docker-compose to start the test database
docker-compose -f db/sqlserver/docker-compose.yml up
```

### SAP HANA Mock (Swarnalakshmi — Story 3.1)
The HANA mock engine loads from this folder at startup:

```js
const invoices = require('../../mock-data/demo/invoices.json');
const salesSummary = require('../../mock-data/demo/salesSummary.json');
```

### SAP Service Layer Mock (Akshay — Story 4.1)
The mock Express server loads Invoices, PurchaseOrders and Items:

```js
const invoices      = require('../../mock-data/demo/invoices.json');
const purchaseOrders = require('../../mock-data/demo/purchaseOrders.json');
const items         = require('../../mock-data/demo/items.json');
```

---

## Demo Set Design Notes

The **demo/** data is hand-crafted to exercise all five sample queries:

| Sample Query | What to look for in demo data |
|---|---|
| Overdue invoices (>7 days) | INV-1001, INV-1002, INV-1003, INV-1005, INV-1011, INV-1013, INV-1015, INV-1017, INV-1019 have `DueDate` before 2026-10-28 |
| Items below reorder level | ITEM-001, ITEM-002, ITEM-004, ITEM-006, ITEM-007, ITEM-009, ITEM-011, ITEM-013, ITEM-015 have `QtyAvailable` < `ReorderLevel` |
| POs past promised date | PO-2001 to PO-2006, PO-2011, PO-2012, PO-2015 have `PromisedDate` before 2026-11-04 |
| Daily sales summary | 3 branches × 10 days available |
| Open receivables | Several invoices unpaid with `Paid: false` |

The **large/** data has ~40% heavily overdue invoices, ~30% POs past promised date, and ~30% items below reorder level — enough to test row limits and paging.

---

## Regenerating Large Files

If you need to change the large test set:

```bash
node mock-data/generate.js
```

Do not commit generated large files if they are too big for the repo — check with the team lead.

---

## Rules (from project guide)
1. **Never use real customer data** — all names, emails, amounts are fictional
2. **Never hardcode data** in connectors — always load from this folder
3. **Column names are fixed** — do not rename without telling all connector owners
4. All dates use ISO format: `YYYY-MM-DD`

