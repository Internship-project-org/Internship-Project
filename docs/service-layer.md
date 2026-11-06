# SAP Business One Service Layer (Batch 2)

## Scope

This implementation provides a read-only Service Layer client and an Express mock for the training/demo environment. It supports the SRS entities `Invoices`, `PurchaseOrders`, and `Items`; login; `B1SESSION` cookie authentication; `$filter`; `$select`; paging; and one automatic re-login/retry after HTTP 401 or 403.

## Configuration

A saved Service Layer connection should provide:

- `host`: host name or URL. Include `http://` for a local mock, or `https://` for an approved non-production SAP system.
- `port`: optional port when it is not already included in `host`.
- `database`: SAP Business One company database name.
- `username`: read-only Service Layer user.
- `passwordEncrypted`: encrypted password; decrypt it server-side immediately before creating the client.

Never disable TLS certificate validation. Do not put real credentials in source control, test fixtures, logs, or screenshots.

## Client usage

```js
const { createServiceLayerClient } = require('../connectors/serviceLayer/serviceLayerClient');

const client = createServiceLayerClient({
  baseUrl: 'http://localhost:5001',
  username: 'manager',
  password: 'secret',
  companyDB: 'SBODEMO',
  rowLimit: 1000,
});

const result = await client.getEntity({
  entity: 'Invoices',
  filter: "DocStatus eq 'O'",
  select: 'DocNum,CardCode,CardName,DocTotal',
  rowLimit: 1000,
});
// { columns, rows, meta }
```

Only `GET` is used for entity reads. The login request is the only `POST`, as permitted by the SRS. Entity names are allow-listed. Paging follows same-origin `@odata.nextLink` links and stops at the configured row limit. A 401/403 clears the current session, logs in once, and retries the failed GET once.

## Mock server

Start the mock from the backend folder:

```bash
node -e "const {createServiceLayerMock}=require('./mockServers/serviceLayerMock'); createServiceLayerMock().app.listen(5001,()=>console.log('Mock Service Layer on 5001'))"
```

Default mock credentials are `manager` / `secret`, company DB `SBODEMO`. These are synthetic local-only demo credentials. The mock dataset is intentionally small and contains sample data only. The mock implements a deliberately limited OData filter subset (one comparison using `eq`, `ne`, `gt`, `ge`, `lt`, or `le`), projection with `$select`, and paging with `@odata.nextLink`; it is not a full OData implementation.

## Query preview route

`createQueryPreviewRouter({ Query, Connection, decryptPassword, executeSqlPreview, authenticate })` returns an Express router. Mount it at `/api/query-preview` after supplying the team's saved-query and connection models, the existing password decryption utility, and authentication middleware. The route is `POST /:queryId/preview`; it executes only when the user explicitly requests preview and returns at most 10 rows.

The current repository ZIP does not yet contain the Query and Connection models, authentication middleware, encryption utility, or SQL/HANA connector. The route is dependency-injected so it does not duplicate or conflict with the teammates' implementations. SQL/HANA preview returns 501 until `executeSqlPreview` is wired.

## Integration items to agree with the team

1. Confirm whether `connection.host` includes a scheme and whether the mock uses HTTP or HTTPS. Set `host` accordingly; never turn off certificate checks.
2. Confirm exact `queryId` representation and query model fields (`kind`, `entity`, `filter`, `select`, `rowLimit`, `connectionId`).
3. Connect the shared auth middleware and password decryption helper when their files are available.
4. Agree the common error response shape with Batch 1 before exposing this route to the notification engine.
