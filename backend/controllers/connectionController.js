const Connection = require("../models/Connection");
const { encryptPassword } = require("../security/crypto");

// Create and save a new database connection
const createConnection = async (req, res, next) => {
  try {
    // Authentication will be provided by the shared auth middleware.
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    // Only administrators can manage database connections.
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin access required"
      });
    }

    const {
      name,
      type,
      host,
      port,
      database,
      username,
      password
    } = req.body;

    // Validate required fields.
    if (
      typeof name !== "string" ||
      typeof type !== "string" ||
      typeof host !== "string" ||
      typeof database !== "string" ||
      typeof username !== "string" ||
      typeof password !== "string" ||
      !name.trim() ||
      !host.trim() ||
      !database.trim() ||
      !username.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "All connection fields are required"
      });
    }

    const parsedPort = Number(port);

    if (
      !Number.isInteger(parsedPort) ||
      parsedPort < 1 ||
      parsedPort > 65535
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid port number"
      });
    }

    if (!["SQLServer", "HANA", "ServiceLayer"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid connection type"
      });
    }

    // Encrypt the password before saving it.
    const passwordEncrypted = encryptPassword(password);

    const connection = await Connection.create({
      name: name.trim(),
      type,
      host: host.trim(),
      port: parsedPort,
      database: database.trim(),
      username: username.trim(),
      passwordEncrypted,
      createdBy: req.user._id
    });

    // Return only safe fields. Never return credentials.
    return res.status(201).json({
      success: true,
      message: "Connection created successfully",
      connection: {
        id: connection._id,
        name: connection.name,
        type: connection.type,
        host: connection.host,
        port: connection.port,
        database: connection.database,
        username: connection.username,
        lastTestStatus: connection.lastTestStatus,
        lastTestedAt: connection.lastTestedAt
      }
    });
  } catch (error) {
    if (error.name === "ValidationError" || error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid connection details"
      });
    }

    next(error);
  }
};

module.exports = {
  createConnection
};