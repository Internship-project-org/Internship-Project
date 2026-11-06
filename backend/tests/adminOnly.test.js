const test = require("node:test");
const assert = require("node:assert/strict");

const adminOnly = require("../middleware/adminOnly");

// Simulate an Express response.
function mockResponse() {
  return {
    statusCode: null,
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


// Test 1: Reject unauthenticated requests
test("Reject unauthenticated users with 401", () => {
  const req = {};
  const res = mockResponse();

  let nextCalled = false;

  adminOnly(req, res, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.success, false);
  assert.equal(nextCalled, false);
});


// Test 2: Reject authenticated non-admin users
test("Reject non-admin users with 403", () => {
  const req = {
    user: {
      _id: "507f1f77bcf86cd799439011",
      role: "user"
    }
  };

  const res = mockResponse();

  let nextCalled = false;

  adminOnly(req, res, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.success, false);
  assert.equal(nextCalled, false);
});


// Test 3: Allow authenticated administrators
test("Allow administrators to proceed", () => {
  const req = {
    user: {
      _id: "507f1f77bcf86cd799439011",
      role: "admin"
    }
  };

  const res = mockResponse();

  let nextCalled = false;

  adminOnly(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, null);
});


// Test 4: Reject admin role without an authenticated user ID
test("Reject admin role without user ID", () => {
  const req = {
    user: {
      role: "admin"
    }
  };

  const res = mockResponse();

  let nextCalled = false;

  adminOnly(req, res, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
});


// Test 5: Ignore admin role supplied in request body
test("Reject fake admin role from request body", () => {
  const req = {
    body: {
      role: "admin"
    },
    headers: {
      "x-role": "admin"
    }
  };

  const res = mockResponse();

  let nextCalled = false;

  adminOnly(req, res, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
});