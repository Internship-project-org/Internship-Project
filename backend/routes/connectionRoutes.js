const express = require("express");

const adminOnly = require("../middleware/adminOnly");

const {
  createConnection
} = require("../controllers/connectionController");

const router = express.Router();

// Require administrator access for all connection routes.
router.use(adminOnly);

// POST /api/connections
// Create and save a new connection.
router.post("/", createConnection);

module.exports = router;