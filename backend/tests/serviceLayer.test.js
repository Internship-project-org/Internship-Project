const request = require('supertest');
const { createServiceLayerMock } = require('../mockServers/serviceLayerMock');
const { createServiceLayerClient } = require('../connectors/serviceLayer/serviceLayerClient');

describe('Service Layer mock and client', () => {
  let mock;
  let server;
  let baseUrl;
  beforeEach(async () => {
    mock = createServiceLayerMock({ pageSize: 1 });
    server = mock.app.listen(0);
    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;
  });
  afterEach(async () => new Promise((resolve) => server.close(resolve)));

  test('logs in and reads an entity through multiple pages', async () => {
    const client = createServiceLayerClient({ baseUrl, username: 'manager', password: 'secret', companyDB: 'SBODEMO', rowLimit: 10 });
    const result = await client.getEntity({ entity: 'Invoices', select: 'DocNum,DocTotal', rowLimit: 10 });
    expect(result.rows).toHaveLength(3);
    expect(result.rows[0]).toEqual({ DocNum: 1001, DocTotal: 25000 });
    expect(result.meta.rowCount).toBe(3);
  });

  test('rejects unsupported entities', async () => {
    const client = createServiceLayerClient({ baseUrl, username: 'manager', password: 'secret', companyDB: 'SBODEMO' });
    await expect(client.getEntity({ entity: 'BusinessPartners' })).rejects.toThrow('not allowed');
  });

  test('re-authenticates once after session expiry', async () => {
    const client = createServiceLayerClient({ baseUrl, username: 'manager', password: 'secret', companyDB: 'SBODEMO', rowLimit: 10 });
    await client.auth.login();
    mock.expireNextSession();
    const result = await client.getEntity({ entity: 'Items', rowLimit: 10 });
    expect(result.rows).toHaveLength(2);
    expect(client.auth.isLoggedIn()).toBe(true);
  });

  test('mock rejects invalid credentials', async () => {
    const response = await request(mock.app).post('/b1s/v1/Login').send({ CompanyDB: 'SBODEMO', UserName: 'wrong', Password: 'wrong' });
    expect(response.status).toBe(401);
  });
});
