
const express = require("express");

const app = express();

// Parse JSON request bodies
app.use(express.json());

// Existing root route
app.get("/", (req, res) => {
  res.send("Backend running");
});

// Health check
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Notification Engine API is running"
  });
});

module.exports = app;
