const test = require("node:test");
const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");

// Temporary key used only inside this test process.
process.env.ENCRYPTION_KEY = randomBytes(32).toString("hex");

const Connection = require("../models/Connection");

const {
  createConnection
} = require("../controllers/connectionController");

const {
  decryptPassword
} = require("../security/crypto");

// Simulate an Express response.
function mockResponse() {
  return {
    statusCode: 200,
    body: null,

    status(code) {
      this.statusCode = code;
      return this;
    },

    json(data) {
      this.body = data;
      return this;
    }
  };
}

test("Admin can create a connection with encrypted password", async (t) => {
  const requestBody = {
    name: "Test SQL Server",
    type: "SQLServer",
    host: "localhost",
    port: 1433,
    database: "NotificationDB",
    username: "testuser",
    password: "dummy-test-password"
  };

  const req = {
    user: {
      _id: "507f1f77bcf86cd799439011",
      role: "admin"
    },
    body: requestBody
  };

  const res = mockResponse();

  let savedData;

  // Simulate MongoDB saving without accessing a real database.
  t.mock.method(Connection, "create", async (data) => {
    savedData = data;

    return {
      _id: "507f1f77bcf86cd799439012",
      ...data,
      lastTestStatus: "NOT_TESTED",
      lastTestedAt: null
    };
  });

  await createConnection(req, res, (error) => {
    throw error;
  });

  // Check successful response.
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.success, true);

  // Verify the password was encrypted.
  assert.notEqual(savedData.passwordEncrypted, requestBody.password);

  // Verify that encrypted data can be decrypted correctly.
  assert.equal(
    decryptPassword(savedData.passwordEncrypted),
    requestBody.password
  );

  // Verify credentials are excluded from the API response.
  assert.equal(res.body.connection.passwordEncrypted, undefined);
  assert.equal(res.body.connection.password, undefined);

  console.log("Create Connection API test passed!");
});

// Test 2: Reject unauthenticated users
test("Reject unauthenticated connection creation", async () => {
  const req = {
    body: {}
  };

  const res = mockResponse();

  await createConnection(req, res, (error) => {
    throw error;
  });

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.success, false);
});


// Test 3: Reject non-admin users
test("Reject connection creation by non-admin users", async () => {
  const req = {
    user: {
      _id: "507f1f77bcf86cd799439011",
      role: "user"
    },
    body: {}
  };

  const res = mockResponse();

  await createConnection(req, res, (error) => {
    throw error;
  });

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.success, false);
});


// Test 4: Reject missing connection fields
test("Reject connection with missing fields", async () => {
  const req = {
    user: {
      _id: "507f1f77bcf86cd799439011",
      role: "admin"
    },
    body: {
      name: "Test SQL Server"
    }
  };

  const res = mockResponse();

  await createConnection(req, res, (error) => {
    throw error;
  });

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
});


// Test 5: Reject invalid port
test("Reject connection with invalid port", async () => {
  const req = {
    user: {
      _id: "507f1f77bcf86cd799439011",
      role: "admin"
    },
    body: {
      name: "Test SQL Server",
      type: "SQLServer",
      host: "localhost",
      port: 99999,
      database: "NotificationDB",
      username: "testuser",
      password: "dummy-test-password"
    }
  };

  const res = mockResponse();

  await createConnection(req, res, (error) => {
    throw error;
  });

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
});