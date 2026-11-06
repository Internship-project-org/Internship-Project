const express = require('express');
const request = require('supertest');
const { createQueryPreviewRouter } = require('../routes/queryPreviewRoutes');

describe('query preview route', () => {
  test('returns at most the first 10 rows for a Service Layer query', async () => {
    const query = { kind: 'odata', connectionId: 'c1', entity: 'Invoices', rowLimit: 1000 };
    const connection = { type: 'Service Layer', host: 'https://example.test', port: 50000, username: 'user', database: 'SBODEMO', passwordEncrypted: 'encrypted' };
    const Query = { findById: jest.fn().mockResolvedValue(query) };
    const Connection = { findById: jest.fn().mockResolvedValue(connection) };
    // Inject a deterministic fetch-compatible mock through the global for this test.
    const originalFetch = global.fetch;
    let calls = 0;
    global.fetch = jest.fn(async (url) => {
      if (String(url).endsWith('/Login')) return new Response('{}', { status: 200, headers: { 'set-cookie': 'B1SESSION=test; Path=/' } });
      calls += 1;
      return new Response(JSON.stringify({ value: Array.from({ length: 12 }, (_, i) => ({ DocNum: i + 1 })) }), { status: 200 });
    });
    try {
      const app = express();
      app.use(express.json());
      app.use('/api/query-preview', createQueryPreviewRouter({ Query, Connection, decryptPassword: async () => 'secret' }));
      const response = await request(app).post('/api/query-preview/q1/preview').send({});
      expect(response.status).toBe(200);
      expect(response.body.rows).toHaveLength(10);
      expect(response.body.meta.preview).toBe(true);
      expect(calls).toBeGreaterThan(0);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('returns 404 when query does not exist', async () => {
    const app = express();
    app.use('/api/query-preview', createQueryPreviewRouter({
      Query: { findById: async () => null },
      Connection: { findById: async () => null },
    }));
    const response = await request(app).post('/api/query-preview/missing/preview');
    expect(response.status).toBe(404);
  });
});
