const express = require("express");

const {
  createConnection
} = require("../controllers/connectionController");

const router = express.Router();

// POST /api/connections
// Create and save a new connection.
router.post("/", createConnection);

module.exports = router;