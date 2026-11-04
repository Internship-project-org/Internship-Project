const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

// Load environment variables
require("dotenv").config({
  path: path.join(__dirname, "..", ".env")
});

const mongoose = require("mongoose");

const Connection = require("../models/Connection");

const {
  encryptPassword,
  decryptPassword
} = require("../security/crypto");

// Run the database test only when explicitly enabled.
const runIntegrationTest =
  process.env.RUN_MONGO_INTEGRATION_TEST === "true";

test("Save and retrieve an encrypted connection from MongoDB", {
  timeout: 30000,
  skip: runIntegrationTest
    ? false
    : "Set RUN_MONGO_INTEGRATION_TEST=true to enable database testing"
}, async () => {

  // Verify required environment configuration.
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is not configured");
  }

  if (!/^[0-9a-fA-F]{64}$/.test(process.env.ENCRYPTION_KEY || "")) {
    throw new Error(
      "ENCRYPTION_KEY must be 64 hexadecimal characters"
    );
  }

  // Prevent running this test in production mode.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Integration test must not run in production"
    );
  }

  let createdId;

  try {
    // Connect to development MongoDB.
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000
    });

    console.log("Connected to development MongoDB");

    const plainPassword = "dummy-test-password";

    // Create a temporary connection.
    const connection = await Connection.create({
      name: `TEST-ONLY-${Date.now()}`,
      type: "SQLServer",
      host: "localhost",
      port: 1433,
      database: "TestDB",
      username: "dummy_user",
      passwordEncrypted: encryptPassword(plainPassword),
      createdBy: new mongoose.Types.ObjectId()
    });

    createdId = connection._id;

    console.log("Temporary connection saved");

    // Retrieve the encrypted password explicitly.
    const storedConnection = await Connection.findById(createdId)
      .select("+passwordEncrypted")
      .lean();

    // Verify that the connection exists.
    assert.ok(storedConnection);

    // Verify that the stored password is encrypted.
    assert.notEqual(
      storedConnection.passwordEncrypted,
      plainPassword
    );

    // Verify that decryption returns the original password.
    assert.equal(
      decryptPassword(storedConnection.passwordEncrypted),
      plainPassword
    );

    // Verify that ordinary queries exclude the password.
    const safeConnection = await Connection.findById(createdId)
      .lean();

    assert.ok(safeConnection);

    assert.equal(
      safeConnection.passwordEncrypted,
      undefined
    );

    console.log("Encryption and retrieval verified");

  } finally {
    try {
      // Remove only the temporary record created by this test.
      if (createdId && mongoose.connection.readyState === 1) {
        await Connection.deleteOne({
          _id: createdId
        });

        console.log("Temporary test connection removed");
      }
    } finally {
      // Close MongoDB connection.
      await mongoose.disconnect();
    }
  }
});