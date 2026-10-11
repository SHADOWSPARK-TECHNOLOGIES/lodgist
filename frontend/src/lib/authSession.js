// Turns a login/register API body into { token, user } or null.
// /api/auth/login and /register return token and user at the top level
// (backend/src/routes/auth.js); a { data: { token, user } } wrapper is also
// accepted so either shape works. Contract: backend/__tests__/authContract.test.js.
function authSessionFromResponse(body) {
  if (!body || typeof body !== "object" || body.success !== true) return null;
  const source = body.data && typeof body.data === "object" ? body.data : body;
  const { token, user } = source;
  if (typeof token !== "string" || token === "" || !user || typeof user !== "object") return null;
  return { token, user };
}

const LOGIN_FAILED = "We could not sign you in. Check your email and password, or create an account.";

/**
 * The body of AuthContext.loginFn: call the API, parse the session, then hand
 * it to `signIn` (which stores the token and user). The server's message is not
 * used for the error: with the old shape mismatch it was "Login successful".
 * refreshToken is deliberately ignored; no refresh flow uses it yet.
 */
async function completeLogin(callLogin, signIn) {
  const session = authSessionFromResponse(await callLogin());
  if (!session) throw new Error(LOGIN_FAILED);
  signIn(session);
  return session;
}

module.exports = { authSessionFromResponse, completeLogin, LOGIN_FAILED };
