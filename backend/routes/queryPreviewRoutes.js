const express = require('express');
const { createServiceLayerClient } = require('../connectors/serviceLayer/serviceLayerClient');

function connectionBaseUrl(connection) {
  if (connection.baseUrl) return connection.baseUrl.replace(/\/$/, '');
  const host = String(connection.host || '').replace(/\/$/, '');
  const protocol = /^https?:\/\//i.test(host) ? '' : (connection.protocol || 'https://');
  const port = connection.port ? `:${connection.port}` : '';
  return `${protocol}${host}${port}`;
}

function createQueryPreviewRouter({ Query, Connection, decryptPassword = async (value) => value, executeSqlPreview, authenticate = (req, res, next) => next() }) {
  if (!Query || !Connection) throw new Error('Query and Connection models are required');
  const router = express.Router();
  router.post('/:queryId/preview', authenticate, async (req, res, next) => {
    try {
      const query = await Query.findById(req.params.queryId);
      if (!query) return res.status(404).json({ message: 'Saved query not found' });
      const connection = await Connection.findById(query.connectionId);
      if (!connection) return res.status(404).json({ message: 'Connection for this query was not found' });
      const rowLimit = Math.min(Number(query.rowLimit) || 1000, 1000);
      let result;
      if (query.kind === 'odata' || connection.type === 'Service Layer') {
        const password = await decryptPassword(connection.passwordEncrypted);
        const client = createServiceLayerClient({
          baseUrl: connectionBaseUrl(connection),
          username: connection.username,
          password,
          companyDB: connection.database,
          rowLimit,
        });
        result = await client.getEntity({
          entity: query.entity || query.queryText,
          filter: query.filter,
          select: query.select,
          rowLimit: Math.min(rowLimit, 10),
        });
      } else {
        if (typeof executeSqlPreview !== 'function') {
          return res.status(501).json({ message: 'SQL preview connector has not been configured' });
        }
        result = await executeSqlPreview({ query, connection, params: req.body?.params || {}, rowLimit: Math.min(rowLimit, 10) });
      }
      return res.json({ ...result, rows: (result.rows || []).slice(0, 10), meta: { ...(result.meta || {}), preview: true, rowCount: Math.min((result.rows || []).length, 10) } });
    } catch (error) {
      return next(error);
    }
  });
  return router;
}

module.exports = { createQueryPreviewRouter, connectionBaseUrl };
