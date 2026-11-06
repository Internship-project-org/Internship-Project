const express = require("express");
const queryController = require("../controllers/queryController");

// Express router for query management endpoints.
// Ref: Story 5.1, sub-task 132.

const router = express.Router();

// Story 5.1 CRUD Routes
router.post("/", queryController.createQuery);
router.get("/", queryController.getAllQueries);
router.get("/:id", queryController.getQueryById);
router.put("/:id", queryController.updateQuery);
router.delete("/:id", queryController.deleteQuery);

module.exports = router;

