/**
 * Mock Data Generator — Batch 2 Data Connectors
 * Story 3.4 — Canonical Mock Data (sub-tasks #98, #99, #100)
 *
 * Generates large test sets (1000+ rows) for:
 *   - Invoices       → large/invoices.json
 *   - PurchaseOrders → large/purchaseOrders.json
 *   - Items          → large/items.json
 *   - SalesSummary   → large/salesSummary.json
 *
 * Run: node mock-data/generate.js
 */

const fs   = require("fs");
const path = require("path");

const LARGE_DIR = path.join(__dirname, "large");

// ── helpers ──────────────────────────────────────────────────────────────────

function dateStr(daysFromToday) {
  const d = new Date("2026-11-04");
  d.setDate(d.getDate() + daysFromToday);
  return d.toISOString().slice(0, 10);
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── 1. Invoices (1200 rows) ───────────────────────────────────────────────────
// Mix: ~40% heavily overdue (>7 days), ~20% recently overdue (1–7 days),
//      ~40% not yet due — to exercise the DaysOverdue sample query well.

const CUSTOMERS = [
  { code: "C001", name: "Alpha Traders",     email: "accounts@alphatraders.com"  },
  { code: "C002", name: "Beta Supplies",     email: "finance@betasupplies.com"   },
  { code: "C003", name: "Gamma Exports",     email: "billing@gammaexports.com"   },
  { code: "C004", name: "Delta Solutions",   email: "ap@deltasolutions.com"       },
  { code: "C005", name: "Epsilon Corp",      email: "accounts@epsiloncorp.com"   },
  { code: "C006", name: "Zeta Industries",   email: "finance@zetaindustries.com" },
  { code: "C007", name: "Eta Merchants",     email: "billing@etamerchants.com"   },
  { code: "C008", name: "Theta Retail",      email: "accounts@thetaretail.com"   },
  { code: "C009", name: "Iota Logistics",    email: "ap@iotalogistics.com"       },
  { code: "C010", name: "Kappa Tech",        email: "finance@kappatech.com"      },
  { code: "C011", name: "Lambda Goods",      email: "accounts@lambdagoods.com"   },
  { code: "C012", name: "Mu Trading Co",     email: "finance@mutrading.com"      },
  { code: "C013", name: "Nu Enterprises",    email: "ap@nuenterprise.com"        },
  { code: "C014", name: "Xi Wholesale",      email: "billing@xiwholesale.com"    },
  { code: "C015", name: "Omicron Parts",     email: "accounts@omicronparts.com"  },
  { code: "C016", name: "Pi Components",     email: "finance@picomponents.com"   },
  { code: "C017", name: "Rho Distributors",  email: "ap@rhodist.com"             },
  { code: "C018", name: "Sigma Supplies",    email: "billing@sigmasupplies.com"  },
  { code: "C019", name: "Tau Manufacturing", email: "accounts@taumfg.com"        },
  { code: "C020", name: "Upsilon Exports",   email: "finance@upsilonexp.com"     },
];

const invoices = [];
for (let i = 1; i <= 1200; i++) {
  const cust = pick(CUSTOMERS);
  let dueDaysOffset;
  const bucket = i % 10;
  if (bucket < 4)       dueDaysOffset = rand(-90, -8);   // heavily overdue
  else if (bucket < 6)  dueDaysOffset = rand(-7, -1);    // recently overdue
  else                  dueDaysOffset = rand(1, 60);      // not yet due

  invoices.push({
    InvoiceNo:    `INV-${10000 + i}`,
    CustomerCode: cust.code,
    CustomerName: cust.name,
    Email:        cust.email,
    DueDate:      dateStr(dueDaysOffset),
    Amount:       rand(5000, 1500000),
    Paid:         false,
  });
}

// ── 2. PurchaseOrders (1100 rows) ─────────────────────────────────────────────

const SUPPLIERS = [
  { name: "Apex Raw Materials",   email: "orders@apexraw.com"      },
  { name: "Bluestar Components",  email: "supply@bluestar.com"      },
  { name: "Crest Fabricators",    email: "dispatch@crestfab.com"    },
  { name: "Dawnlight Supplies",   email: "accounts@dawnlight.com"   },
  { name: "Eastwind Trading",     email: "trade@eastwind.com"       },
  { name: "Falcon Industries",    email: "orders@falconind.com"     },
  { name: "Gulf Parts Ltd",       email: "supply@gulfparts.com"     },
  { name: "Horizon Materials",    email: "dispatch@horizonmat.com"  },
  { name: "Iris Wholesale",       email: "accounts@iriswhole.com"   },
  { name: "Jade Suppliers",       email: "orders@jadesupply.com"    },
  { name: "Kestrel Traders",      email: "trade@kestreltr.com"      },
  { name: "Lumen Goods",          email: "orders@lumengoods.com"    },
  { name: "Marble Stone Co",      email: "supply@marblestone.com"   },
  { name: "Nova Spare Parts",     email: "dispatch@novaparts.com"   },
  { name: "Orbit Logistics",      email: "accounts@orbitlog.com"    },
];
const PO_STATUSES = ["Pending", "Open", "Delayed"];

const purchaseOrders = [];
for (let i = 1; i <= 1100; i++) {
  const sup = pick(SUPPLIERS);
  const pastDue = i % 3 === 0;   // ~33% past promised date
  purchaseOrders.push({
    PONumber:      `PO-${20000 + i}`,
    SupplierName:  sup.name,
    Email:         sup.email,
    PromisedDate:  pastDue ? dateStr(rand(-60, -1)) : dateStr(rand(1, 60)),
    Status:        pastDue ? pick(["Pending", "Delayed"]) : pick(PO_STATUSES),
  });
}

// ── 3. Items (500 rows) ───────────────────────────────────────────────────────

const ITEM_PREFIXES = [
  "Hydraulic Pump",   "Steel Bearing",  "Copper Wire",    "Filter Element",
  "Drive Belt",       "Pressure Gauge", "Valve Seat",     "Piston Ring",
  "Oil Seal",         "Gasket Set",     "Coolant Hose",   "Spark Plug",
  "Air Filter",       "Fuel Injector",  "Timing Chain",   "Radiator Cap",
  "Brake Pad",        "Crankshaft Seal","Turbo Charger",  "Engine Mount",
];

const items = [];
for (let i = 1; i <= 500; i++) {
  const reorder = rand(5, 100);
  // ~30% below reorder level
  const qty = i % 10 < 3 ? rand(0, reorder - 1) : rand(reorder, reorder * 5);
  items.push({
    ItemCode:     `ITEM-${String(i).padStart(4, "0")}`,
    ItemName:     `${pick(ITEM_PREFIXES)} ${String.fromCharCode(64 + (i % 26) + 1)}${rand(10, 999)}`,
    QtyAvailable: qty,
    ReorderLevel: reorder,
  });
}

// ── 4. SalesSummary (1200 rows — 400 days × 3 branches) ──────────────────────

const BRANCHES = ["Chennai", "Bangalore", "Mumbai"];

const salesSummary = [];
for (let day = 0; day < 400; day++) {
  const dateOffset = -399 + day;  // last ~400 days
  for (const branch of BRANCHES) {
    const isWeekend = new Date(dateStr(dateOffset)).getDay() % 6 === 0;
    salesSummary.push({
      Date:       dateStr(dateOffset),
      Branch:     branch,
      TotalSales: isWeekend ? rand(100000, 350000) : rand(250000, 800000),
      Orders:     isWeekend ? rand(15, 45)         : rand(35, 90),
    });
  }
}

// ── Write files ───────────────────────────────────────────────────────────────

const files = {
  "invoices.json":       invoices,
  "purchaseOrders.json": purchaseOrders,
  "items.json":          items,
  "salesSummary.json":   salesSummary,
};

for (const [filename, data] of Object.entries(files)) {
  const outPath = path.join(LARGE_DIR, filename);
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2), "utf8");
  console.log(`✅ ${filename.padEnd(25)} → ${data.length} rows → ${outPath}`);
}

console.log("\nDone! All large test sets written to mock-data/large/");

