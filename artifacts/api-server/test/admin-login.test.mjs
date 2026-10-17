import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";
import test from "node:test";
import { createAdminLoginHandler } from "../src/routes/admin-login.ts";

const TEST_ADMIN_PASSWORD = "isolated-test-admin-password";

function createStore(initialAdmin) {
  let admin = initialAdmin;
  let initializeCalls = 0;
  return {
    findByUsername: async (username) => admin?.username === username ? admin : undefined,
    initializeAdmin: async (username) => {
      initializeCalls += 1;
      admin ??= {
        id: "admin",
        username,
        passwordHash: null,
        mobile: "",
        gameId: "",
        gameType: "BGMI",
        isAdmin: true,
        upiId: null,
      };
      admin.isAdmin = true;
      return admin;
    },
    get admin() { return admin; },
    get initializeCalls() { return initializeCalls; },
  };
}

async function postLogin(dependencies, credentials) {
  const app = express();
  app.use(express.json());
  app.post("/auth/login", createAdminLoginHandler(dependencies));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  try {
    const response = await fetch(`http://127.0.0.1:${port}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(credentials),
    });
    return { status: response.status, body: await response.json() };
  } finally {
    server.close();
    server.closeAllConnections();
  }
}

function dependenciesFor(store, adminPassword) {
  return {
    findByUsername: store.findByUsername,
    initializeAdmin: store.initializeAdmin,
    getAdminUsername: () => "admin",
    getAdminPassword: () => adminPassword,
    issueToken: () => "test-session-token",
    serializeUser: (user) => ({
      id: user.id,
      username: user.username,
      isAdmin: user.isAdmin,
    }),
  };
}

test("missing ADMIN_PASSWORD returns a clear setup error", async () => {
  const store = createStore(undefined);
  const result = await postLogin(dependenciesFor(store, undefined), {
    username: "admin",
    password: "any-password",
  });

  assert.equal(result.status, 503);
  assert.deepEqual(result.body, { error: "Admin sign-in is not configured." });
  assert.equal(store.initializeCalls, 0);
});

test("configured admin credentials use normal invalid-password authentication behavior", async () => {
  const store = createStore(undefined);
  const result = await postLogin(dependenciesFor(store, TEST_ADMIN_PASSWORD), {
    username: "admin",
    password: "incorrect-isolated-test-password",
  });

  assert.equal(result.status, 401);
  assert.deepEqual(result.body, { error: "Incorrect username or password." });
  assert.equal(store.initializeCalls, 0);
});

test("the first successful admin login creates and returns the admin account", async () => {
  const store = createStore(undefined);
  const result = await postLogin(dependenciesFor(store, TEST_ADMIN_PASSWORD), {
    username: "admin",
    password: TEST_ADMIN_PASSWORD,
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.token, "test-session-token");
  assert.deepEqual(result.body.user, { id: "admin", username: "admin", isAdmin: true });
  assert.equal(store.initializeCalls, 1);
  assert.deepEqual(store.admin, {
    id: "admin",
    username: "admin",
    passwordHash: null,
    mobile: "",
    gameId: "",
    gameType: "BGMI",
    isAdmin: true,
    upiId: null,
  });
});
