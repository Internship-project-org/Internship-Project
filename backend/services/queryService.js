const Query = require("../models/Query");
const { validateQuerySafety } = require("../security/validator");

// Business logic service for saved queries.
// Ref: Story 5.1, sub-tasks 132, 133, and safety rule BR-03 (saving never calls the source).

/**
 * Creates and persists a new query definition after running security validation.
 * @param {object} queryData - Query fields from client request.
 * @param {string} [username] - Creating user identifier.
 * @returns {Promise<object>} The newly saved query document.
 */
async function createQuery(queryData, username = "admin") {
  const { name, connectionId, kind, queryText, entity, filter, select, params, columnMapping, rowLimit, execApproved } = queryData;

  // Basic required fields check
  if (!name || !name.trim()) {
    const error = new Error("Query name is required.");
    error.statusCode = 400;
    throw error;
  }

  if (!connectionId) {
    const error = new Error("Connection ID is required.");
    error.statusCode = 400;
    throw error;
  }

  if (!kind || !["sql", "odata"].includes(kind)) {
    const error = new Error("Query kind must be either 'sql' or 'odata'.");
    error.statusCode = 400;
    throw error;
  }

  // Kind-specific content check
  if (kind === "sql" && (!queryText || !queryText.trim())) {
    const error = new Error("SQL query text is required when kind is 'sql'.");
    error.statusCode = 400;
    throw error;
  }

  if (kind === "odata" && (!entity || !entity.trim())) {
    const error = new Error("Service Layer entity is required when kind is 'odata'.");
    error.statusCode = 400;
    throw error;
  }

  // Run the dialect-aware safety validation (Story 5.3)
  const validationResult = validateQuerySafety({
    kind,
    queryText,
    entity,
    filter,
    select,
    params,
    execApproved
  });

  if (!validationResult.valid) {
    const error = new Error(validationResult.error);
    error.statusCode = 400;
    throw error;
  }

  // Persist query into MongoDB (source system is never contacted per BR-03)
  const newQuery = new Query({
    name: name.trim(),
    connectionId,
    kind,
    queryText: queryText ? queryText.trim() : "",
    entity: entity ? entity.trim() : "",
    filter: filter ? filter.trim() : "",
    select: select ? select.trim() : "",
    params: params || [],
    columnMapping: columnMapping || [],
    rowLimit: rowLimit ? Number(rowLimit) : 1000,
    execApproved: Boolean(execApproved),
    createdBy: username
  });

  return await newQuery.save();
}

/**
 * Retrieves all saved queries.
 * @returns {Promise<Array>} List of saved query documents.
 */
async function getAllQueries() {
  // Exclude passwordEncrypted if connection reference is populated (Ref: FR-02)
  return await Query.find()
    .populate({
      path: "connectionId",
      select: "-passwordEncrypted"
    })
    .sort({ createdAt: -1 });
}

/**
 * Retrieves a single query by its database ID.
 * @param {string} queryId - MongoDB ObjectId string.
 * @returns {Promise<object>} Query document.
 */
async function getQueryById(queryId) {
  const query = await Query.findById(queryId).populate({
    path: "connectionId",
    select: "-passwordEncrypted"
  });

  if (!query) {
    const error = new Error(`Query with ID '${queryId}' not found.`);
    error.statusCode = 404;
    throw error;
  }

  return query;
}

/**
 * Updates an existing saved query after re-running safety validation.
 * @param {string} queryId - MongoDB ObjectId string.
 * @param {object} updateData - Updated query fields.
 * @returns {Promise<object>} The updated query document.
 */
async function updateQuery(queryId, updateData) {
  const existing = await Query.findById(queryId);
  if (!existing) {
    const error = new Error(`Query with ID '${queryId}' not found.`);
    error.statusCode = 404;
    throw error;
  }

  // Merge existing fields with incoming updates for validation check
  const mergedKind = updateData.kind || existing.kind;
  const mergedQueryText = updateData.queryText !== undefined ? updateData.queryText : existing.queryText;
  const mergedEntity = updateData.entity !== undefined ? updateData.entity : existing.entity;
  const mergedFilter = updateData.filter !== undefined ? updateData.filter : existing.filter;
  const mergedSelect = updateData.select !== undefined ? updateData.select : existing.select;
  const mergedParams = updateData.params !== undefined ? updateData.params : existing.params;
  const mergedExecApproved = updateData.execApproved !== undefined ? updateData.execApproved : existing.execApproved;

  // Re-run safety validation on updated content (Story 5.3)
  const validationResult = validateQuerySafety({
    kind: mergedKind,
    queryText: mergedQueryText,
    entity: mergedEntity,
    filter: mergedFilter,
    select: mergedSelect,
    params: mergedParams,
    execApproved: mergedExecApproved
  });

  if (!validationResult.valid) {
    const error = new Error(validationResult.error);
    error.statusCode = 400;
    throw error;
  }

  // Apply updates
  if (updateData.name !== undefined) existing.name = updateData.name.trim();
  if (updateData.connectionId !== undefined) existing.connectionId = updateData.connectionId;
  if (updateData.kind !== undefined) existing.kind = updateData.kind;
  if (updateData.queryText !== undefined) existing.queryText = updateData.queryText.trim();
  if (updateData.entity !== undefined) existing.entity = updateData.entity.trim();
  if (updateData.filter !== undefined) existing.filter = updateData.filter.trim();
  if (updateData.select !== undefined) existing.select = updateData.select.trim();
  if (updateData.params !== undefined) existing.params = updateData.params;
  if (updateData.columnMapping !== undefined) existing.columnMapping = updateData.columnMapping;
  if (updateData.rowLimit !== undefined) existing.rowLimit = Number(updateData.rowLimit);
  if (updateData.execApproved !== undefined) existing.execApproved = Boolean(updateData.execApproved);

  return await existing.save();
}

/**
 * Deletes a saved query by ID.
 * @param {string} queryId - MongoDB ObjectId string.
 * @returns {Promise<object>} Deletion confirmation.
 */
async function deleteQuery(queryId) {
  const query = await Query.findByIdAndDelete(queryId);
  if (!query) {
    const error = new Error(`Query with ID '${queryId}' not found.`);
    error.statusCode = 404;
    throw error;
  }

  return { ok: true, message: `Query '${query.name}' successfully deleted.` };
}

module.exports = {
  createQuery,
  getAllQueries,
  getQueryById,
  updateQuery,
  deleteQuery
};

