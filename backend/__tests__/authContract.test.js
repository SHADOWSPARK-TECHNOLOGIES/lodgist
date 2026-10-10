// Contract: the frontend's session parser must accept the REAL login and
// register responses from the backend routes (frontend/src/lib/authSession.js).
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const bcrypt = require("bcryptjs");
const authRouter = require("../src/routes/auth");
const { authSessionFromResponse, completeLogin } = require("../../frontend/src/lib/authSession");

function app(prisma) {
  const a = express();
  a.use(express.json());
  a.use("/api/auth", authRouter(prisma));
  return a;
}

async function post(server, path, body) {
  const { port } = server.address();
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

function listen(a) {
  return new Promise((resolve) => { const s = a.listen(0, "127.0.0.1", () => resolve(s)); });
}

test("real /api/auth/login response is accepted by the frontend parser", async () => {
  const passwordHash = await bcrypt.hash("correct-horse", 4);
  const stored = { id: 7, email: "user@example.test", name: "U", role: "TENANT", isHNW: false, passwordHash };
  const prisma = { user: { findUnique: async ({ where }) => (where.email === stored.email ? stored : null) } };
  const server = await listen(app(prisma));
  try {
    const ok = await post(server, "/api/auth/login", { email: stored.email, password: "correct-horse" });
    assert.equal(ok.status, 200);
    const session = authSessionFromResponse(ok.body);
    assert.ok(session, `parser rejected the real login body (keys: ${Object.keys(ok.body).join(",")})`);
    assert.equal(session.user.id, 7);
    assert.equal(typeof session.token, "string");
    assert.equal(session.user.passwordHash, undefined);

    // loginFn path: the real body signs the user in.
    let signedIn = null;
    await completeLogin(async () => ok.body, (s) => { signedIn = s; });
    assert.equal(signedIn.user.email, stored.email);
    assert.equal(signedIn.token, ok.body.token);

    const bad = await post(server, "/api/auth/login", { email: stored.email, password: "wrong" });
    assert.equal(bad.status, 401);
    assert.equal(authSessionFromResponse(bad.body), null);
  } finally {
    server.close();
  }
});

test("real /api/auth/register response is accepted by the frontend parser", async () => {
  let created;
  const prisma = {
    user: {
      findUnique: async () => null,
      create: async ({ data }) => (created = { id: 9, role: "TENANT", isHNW: false, ...data }),
    },
  };
  const server = await listen(app(prisma));
  try {
    const res = await post(server, "/api/auth/register", { email: "new@example.test", password: "long-enough", name: "N" });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const session = authSessionFromResponse(res.body);
    assert.ok(session);
    assert.equal(session.user.id, 9);
    assert.ok(created);
  } finally {
    server.close();
  }
});
