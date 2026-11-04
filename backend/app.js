
const express = require("express");
const cors = require("cors");
const queryRoutes = require("./routes/queryRoutes");
const errorHandler = require("./middleware/errorHandler");

const app = express();

// Standard middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root endpoint
app.get("/", (req, res) => {
  res.send("Backend running");
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Notification Engine API is running"
  });
});

// Query Management API - Rohit's module
app.use("/api/queries", queryRoutes);

// Central error handler - must be registered last
app.use(errorHandler);

module.exports = app;
