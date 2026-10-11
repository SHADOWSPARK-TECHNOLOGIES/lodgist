// Maps login/register failures to messages people can act on.
// Copy here is pending Web Lead review. Register must never reveal whether an
// email already has an account (Sec Review ruling), so 409 gets the generic text.
const { TIMEOUT_MESSAGE } = require("./requestTimeout");

const AUTH_ERRORS = {
  loginFailed: "We could not sign you in. Check your email and password, or create an account.",
  registerFailed: "We couldn't create that account. If you already have one, sign in instead.",
  tooMany: "Too many attempts. Wait a minute, then try again.",
  network: "We could not reach Lodgist. Check your connection and try again.",
};

/** @returns {{ message: string, signInLink: boolean }} */
function authErrorMessage(err, kind) {
  const fallback = kind === "register" ? AUTH_ERRORS.registerFailed : AUTH_ERRORS.loginFailed;
  const signInLink = kind === "register";
  const status = err && typeof err.status === "number" ? err.status : null;
  if (status === null && err && err.name === "TypeError") return { message: AUTH_ERRORS.network, signInLink: false };
  if (status === 408) return { message: TIMEOUT_MESSAGE, signInLink: false };
  if (status === 429) return { message: AUTH_ERRORS.tooMany, signInLink: false };
  if (status === 400 && typeof err.message === "string" && err.message.trim() !== "") {
    return { message: err.message, signInLink: false };
  }
  return { message: fallback, signInLink };
}

module.exports = { AUTH_ERRORS, authErrorMessage };
