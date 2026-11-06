const ALLOWED_ENTITIES = new Set(['Invoices', 'PurchaseOrders', 'Items']);

function buildEntityPath(entity, options = {}) {
  if (!ALLOWED_ENTITIES.has(entity)) throw new Error(`Service Layer entity is not allowed: ${entity}`);
  const params = new URLSearchParams();
  if (options.filter) params.set('$filter', options.filter);
  if (options.select) {
    const fields = Array.isArray(options.select) ? options.select.join(',') : options.select;
    if (fields.trim()) params.set('$select', fields);
  }
  if (Number.isInteger(options.top) && options.top > 0) params.set('$top', String(options.top));
  if (Number.isInteger(options.skip) && options.skip >= 0) params.set('$skip', String(options.skip));
  const query = params.toString();
  return `/b1s/v1/${entity}${query ? `?${query}` : ''}`;
}

module.exports = { ALLOWED_ENTITIES, buildEntityPath };
