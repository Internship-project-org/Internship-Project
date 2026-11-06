const express = require('express');

const DEFAULT_DATA = {
  Invoices: [
    { DocEntry: 1, DocNum: 1001, CardCode: 'C001', CardName: 'Sample Customer A', DocTotal: 25000, DocStatus: 'O', DocDueDate: '2026-10-20' },
    { DocEntry: 2, DocNum: 1002, CardCode: 'C002', CardName: 'Sample Customer B', DocTotal: 12000, DocStatus: 'O', DocDueDate: '2026-11-15' },
    { DocEntry: 3, DocNum: 1003, CardCode: 'C003', CardName: 'Sample Customer C', DocTotal: 8000, DocStatus: 'C', DocDueDate: '2026-10-10' },
  ],
  PurchaseOrders: [
    { DocEntry: 11, DocNum: 5001, CardName: 'Sample Supplier A', DocDueDate: '2026-10-25', DocStatus: 'O' },
    { DocEntry: 12, DocNum: 5002, CardName: 'Sample Supplier B', DocDueDate: '2026-11-20', DocStatus: 'O' },
  ],
  Items: [
    { ItemCode: 'ITM001', ItemName: 'Sample Item A', QuantityOnStock: 4, MinLevel: 10 },
    { ItemCode: 'ITM002', ItemName: 'Sample Item B', QuantityOnStock: 25, MinLevel: 5 },
  ],
};

function parseLiteral(value) {
  const trimmed = value.trim();
  if (/^'.*'$/.test(trimmed)) return trimmed.slice(1, -1).replace(/''/g, "'");
  if (/^(true|false)$/i.test(trimmed)) return trimmed.toLowerCase() === 'true';
  if (!Number.isNaN(Number(trimmed))) return Number(trimmed);
  return trimmed;
}

function applyFilter(rows, filter) {
  if (!filter) return rows;
  // Deliberately small OData subset for repeatable training/demo data.
  const match = filter.match(/^([\w.]+)\s+(eq|ne|gt|ge|lt|le)\s+(.+)$/i);
  if (!match) throw new Error('Mock Service Layer supports one simple OData comparison per $filter');
  const [, field, operator, raw] = match;
  const expected = parseLiteral(raw);
  return rows.filter((row) => {
    const actual = row[field];
    switch (operator.toLowerCase()) {
      case 'eq': return String(actual) === String(expected);
      case 'ne': return String(actual) !== String(expected);
      case 'gt': return actual > expected;
      case 'ge': return actual >= expected;
      case 'lt': return actual < expected;
      case 'le': return actual <= expected;
      default: return false;
    }
  });
}

function createServiceLayerMock({ data = DEFAULT_DATA, pageSize = 2, sessionId = 'mock-session', username = 'manager', password = 'secret', companyDB = 'SBODEMO', sessionTtlRequests = Infinity } = {}) {
  const app = express();
  app.use(express.json());
  let requestCount = 0;
  let sessionVersion = 1;
  let activeSession = `${sessionId}-${sessionVersion}`;
  let expireNext = false;

  app.post('/b1s/v1/Login', (req, res) => {
    const body = req.body || {};
    if (body.UserName !== username || body.Password !== password || body.CompanyDB !== companyDB) {
      return res.status(401).json({ error: { message: { value: 'Invalid mock credentials' } } });
    }
    requestCount = 0;
    res.cookie('B1SESSION', activeSession, { httpOnly: true, sameSite: 'lax' });
    res.cookie('ROUTEID', '.node0', { httpOnly: true });
    return res.json({ SessionId: activeSession, Version: '1.0' });
  });

  app.get('/b1s/v1/:entity', (req, res) => {
    const { entity } = req.params;
    if (!Object.prototype.hasOwnProperty.call(data, entity)) return res.status(404).json({ message: 'Entity not found' });
    const cookies = req.headers.cookie || '';
    const cookie = cookies.match(/(?:^|;\s*)B1SESSION=([^;]+)/)?.[1];
    if (!cookie || cookie !== activeSession || expireNext || requestCount >= sessionTtlRequests) {
      expireNext = false;
      return res.status(401).json({ message: 'Session expired' });
    }
    requestCount += 1;
    try {
      let rows = applyFilter(data[entity], req.query.$filter);
      if (req.query.$select) {
        const fields = req.query.$select.split(',').map((field) => field.trim());
        rows = rows.map((row) => Object.fromEntries(fields.filter((field) => field in row).map((field) => [field, row[field]])));
      }
      const skip = Math.max(0, Number(req.query.$skip || 0));
      const top = Math.max(1, Math.min(Number(req.query.$top || pageSize), pageSize));
      const page = rows.slice(skip, skip + top);
      const nextSkip = skip + page.length;
      const next = nextSkip < rows.length ? `/b1s/v1/${entity}?${new URLSearchParams({ ...req.query, '$skip': String(nextSkip) }).toString()}` : undefined;
      return res.json({ value: page, ...(next ? { '@odata.nextLink': next } : {}) });
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }
  });

  return {
    app,
    expireNextSession() { expireNext = true; },
    resetSession() { sessionVersion += 1; activeSession = `${sessionId}-${sessionVersion}`; requestCount = 0; expireNext = false; },
    data,
  };
}

module.exports = { createServiceLayerMock, DEFAULT_DATA };
