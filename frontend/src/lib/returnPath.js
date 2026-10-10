// Only send people back to a listing detail path after login.
function safeNextPath(value) {
  if (typeof value !== "string") return null;
  if (!/^\/listings\/[1-9][0-9]*$/.test(value)) return null;
  return value;
}

module.exports = { safeNextPath };
