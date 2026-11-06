const { createServiceLayerAuth } = require('./serviceLayerAuth');
const { buildEntityPath, ALLOWED_ENTITIES } = require('./serviceLayerQueries');

class ServiceLayerError extends Error {
  constructor(message, statusCode, payload) {
    super(message);
    this.name = 'ServiceLayerError';
    this.statusCode = statusCode;
    this.payload = payload;
  }
}

function extractRows(payload) {
  if (Array.isArray(payload?.value)) return payload.value;
  if (Array.isArray(payload?.d?.results)) return payload.d.results;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

function nextLink(payload) {
  return payload?.['@odata.nextLink'] || payload?.odata?.nextLink || payload?.d?.__next || null;
}

function createServiceLayerClient({
  baseUrl,
  username,
  password,
  companyDB,
  fetchImpl = globalThis.fetch,
  rowLimit = 1000,
  timeoutMs = 30000,
  auth: suppliedAuth,
}) {
  if (!Number.isInteger(rowLimit) || rowLimit < 1) throw new Error('rowLimit must be a positive integer');
  const auth = suppliedAuth || createServiceLayerAuth({ baseUrl, username, password, companyDB, fetchImpl });
  const origin = new URL(baseUrl).origin;

  async function request(urlOrPath, { retry = true } = {}) {
    if (!auth.isLoggedIn()) await auth.login();
    const url = new URL(urlOrPath, baseUrl);
    if (url.origin !== origin) throw new ServiceLayerError('Refusing to follow a Service Layer link to another host');
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: { Accept: 'application/json', Cookie: auth.getCookie() },
      signal: typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(timeoutMs) : undefined,
    });
    if ((response.status === 401 || response.status === 403) && retry) {
      auth.clear();
      await auth.login();
      return request(url.href, { retry: false });
    }
    const text = await response.text();
    let payload = {};
    try { payload = text ? JSON.parse(text) : {}; } catch { payload = { message: text }; }
    if (!response.ok) {
      throw new ServiceLayerError(payload?.error?.message?.value || payload?.message || `Service Layer request failed (${response.status})`, response.status, payload);
    }
    return payload;
  }

  async function getEntity({ entity, filter, select, top, skip = 0, rowLimit: requestedLimit = rowLimit }) {
    if (!ALLOWED_ENTITIES.has(entity)) throw new ServiceLayerError(`Service Layer entity is not allowed: ${entity}`);
    const limit = Math.min(Number(requestedLimit) || rowLimit, rowLimit);
    if (limit < 1) throw new ServiceLayerError('rowLimit must be positive');
    let url = buildEntityPath(entity, { filter, select, top: Number.isInteger(top) ? Math.min(top, limit) : Math.min(100, limit), skip });
    const rows = [];
    let firstPayload;
    while (url && rows.length < limit) {
      const payload = await request(url);
      if (!firstPayload) firstPayload = payload;
      rows.push(...extractRows(payload).slice(0, limit - rows.length));
      const link = nextLink(payload);
      if (link && rows.length < limit) url = link;
      else if (!link && rows.length < limit && extractRows(payload).length > 0) {
        const pageRows = extractRows(payload);
        const pageSize = pageRows.length;
        if (pageSize < (Number.isInteger(top) ? top : Math.min(100, limit))) url = null;
        else {
          const current = new URL(url, baseUrl);
          const currentSkip = Number(current.searchParams.get('$skip') || skip || 0);
          current.searchParams.set('$skip', String(currentSkip + pageSize));
          url = current.href;
        }
      } else url = null;
    }
    const columns = rows.length ? Object.keys(rows[0]) : [];
    return { columns, rows, meta: { source: 'Service Layer', rowCount: rows.length, entity } };
  }

  return { request, getEntity, auth };
}

module.exports = { createServiceLayerClient, ServiceLayerError, extractRows };
