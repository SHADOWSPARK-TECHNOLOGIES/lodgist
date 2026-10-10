/** API requests give up after this long so loaders cannot spin forever. */
const REQUEST_TIMEOUT_MS = 15000;
const TIMEOUT_MESSAGE = "The request took too long. Check your connection and try again.";

/**
 * An AbortSignal that fires after `ms`, or when the caller's own signal aborts.
 * Call cleanup() when the request settles. timedOut() tells a timeout apart
 * from a caller abort (for example a newer search replacing an older one).
 */
function timeoutSignal(callerSignal, ms = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  let timedOut = false;
  const onCallerAbort = () => controller.abort();
  if (callerSignal) {
    if (callerSignal.aborted) controller.abort();
    else callerSignal.addEventListener("abort", onCallerAbort, { once: true });
  }
  const timer = controller.signal.aborted
    ? null
    : setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, ms);
  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    cleanup: () => {
      if (timer) clearTimeout(timer);
      if (callerSignal) callerSignal.removeEventListener("abort", onCallerAbort);
    },
  };
}

function isAbortError(err) {
  return Boolean(err && typeof err === "object" && err.name === "AbortError");
}

/** Listing ids in URLs: positive integers, no leading zero, nothing else. */
function isValidListingId(value) {
  return typeof value === "string" && /^[1-9][0-9]*$/.test(value);
}

module.exports = {
  REQUEST_TIMEOUT_MS,
  TIMEOUT_MESSAGE,
  timeoutSignal,
  isAbortError,
  isValidListingId,
};
