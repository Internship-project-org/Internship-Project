const queryService = require("../services/queryService");

// Controller for query CRUD endpoints.
// Ref: Story 5.1, sub-task 132.
// Keeps HTTP handling thin and delegates business logic to queryService.

/**
 * Handles creation of a new saved query.
 * Route: POST /api/queries
 */
async function createQuery(req, res, next) {
  try {
    const username = req.user ? req.user.username : "admin";
    const savedQuery = await queryService.createQuery(req.body, username);
    res.status(201).json({
      ok: true,
      data: savedQuery
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Handles fetching all saved queries.
 * Route: GET /api/queries
 */
async function getAllQueries(req, res, next) {
  try {
    const queries = await queryService.getAllQueries();
    res.status(200).json({
      ok: true,
      count: queries.length,
      data: queries
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Handles fetching a single saved query by its ID.
 * Route: GET /api/queries/:id
 */
async function getQueryById(req, res, next) {
  try {
    const query = await queryService.getQueryById(req.params.id);
    res.status(200).json({
      ok: true,
      data: query
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Handles updating an existing saved query.
 * Route: PUT /api/queries/:id
 */
async function updateQuery(req, res, next) {
  try {
    const updated = await queryService.updateQuery(req.params.id, req.body);
    res.status(200).json({
      ok: true,
      data: updated
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Handles deleting a saved query.
 * Route: DELETE /api/queries/:id
 */
async function deleteQuery(req, res, next) {
  try {
    const result = await queryService.deleteQuery(req.params.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createQuery,
  getAllQueries,
  getQueryById,
  updateQuery,
  deleteQuery
};

