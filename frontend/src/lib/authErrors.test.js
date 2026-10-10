const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { authErrorMessage, AUTH_ERRORS } = require("./authErrors");
const { TIMEOUT_MESSAGE } = require("./requestTimeout");

const apiError = (status, message) => Object.assign(new Error(message), { name: "ApiError", status });

test("401 on login is the generic sign-in failure", () => {
  assert.deepEqual(authErrorMessage(apiError(401, "Invalid credentials"), "login"), { message: AUTH_ERRORS.loginFailed, signInLink: false });
});

test("409 on register never says the email exists and offers sign in", () => {
  const out = authErrorMessage(apiError(409, "Email already registered"), "register");
  assert.equal(out.message, AUTH_ERRORS.registerFailed);
  assert.equal(out.signInLink, true);
  assert.doesNotMatch(out.message, /already registered|already exists|is taken|in use/i);
  assert.match(out.message, /sign in/i);
});

test("429 asks to wait, for both forms", () => {
  for (const kind of ["login", "register"]) {
    assert.equal(authErrorMessage(apiError(429, "Too many authentication attempts, please try again later."), kind).message, AUTH_ERRORS.tooMany);
  }
});

test("timeout keeps the app timeout message", () => {
  assert.equal(authErrorMessage(apiError(408, TIMEOUT_MESSAGE), "login").message, TIMEOUT_MESSAGE);
});

test("network failure (fetch TypeError) asks to check the connection", () => {
  assert.equal(authErrorMessage(new TypeError("Failed to fetch"), "login").message, AUTH_ERRORS.network);
  assert.equal(authErrorMessage(new TypeError("NetworkError when attempting to fetch resource."), "register").message, AUTH_ERRORS.network);
});

test("400 validation text from the server is shown; anything else is generic", () => {
  assert.equal(authErrorMessage(apiError(400, "Password must be at least 8 characters"), "register").message, "Password must be at least 8 characters");
  assert.equal(authErrorMessage(apiError(500, "Prisma exploded"), "register").message, AUTH_ERRORS.registerFailed);
  assert.equal(authErrorMessage(new Error("Login successful"), "login").message, AUTH_ERRORS.loginFailed);
  assert.equal(authErrorMessage(undefined, "login").message, AUTH_ERRORS.loginFailed);
});

test("pages render an inline alert, focus it, and tie it to the inputs", () => {
  for (const file of ["login/page.tsx", "register/page.tsx"]) {
    const src = fs.readFileSync(path.join(__dirname, "..", "app", file), "utf8");
    assert.match(src, /authErrorMessage\(/, file);
    assert.match(src, /role="alert"/, file);
    assert.match(src, /tabIndex=\{-1\}/, file);
    assert.match(src, /errorRef\.current\?\.focus\(\)/, file);
    const inputs = [...src.matchAll(/<input\b[\s\S]*?\/>/g)].map((m) => m[0]);
    assert.ok(inputs.length >= 2);
    for (const input of inputs) {
      assert.match(input, /aria-invalid=\{/, `${file}: ${input.slice(0, 40)}`);
      assert.match(input, /aria-describedby=\{/, `${file}: ${input.slice(0, 40)}`);
    }
  }
});

test("the toast container is an aria-live region", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "components", "ui", "Toast.tsx"), "utf8");
  assert.match(src, /aria-live="polite"/);
  assert.match(src, /role="status"/);
});
