const express = require("express");
const cors = require("cors");
const queryRoutes = require("./routes/queryRoutes");
const errorHandler = require("./middleware/errorHandler");

const app = express();

// Standard middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root health check endpoint
app.get("/", (req, res) => {
  res.send("Backend running");
});

// Query Management API (Story 5.1)
app.use("/api/queries", queryRoutes);

// Central error handler (Story 5.3 sanitization)
app.use(errorHandler);

module.exports = app;

