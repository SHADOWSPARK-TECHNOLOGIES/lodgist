/**
 * Safely calls `.slice()` on a value that may be null, undefined, or a non-string type.
 *
 * Returns an empty string fallback when the input is not a valid string,
 * preventing runtime crashes from calling `.slice()` on `null` or `undefined`.
 *
 * @example
 * safeSlice(property.description, 0, 120)        // "First 120 chars…"
 * safeSlice(null, 0, 10)                          // ""
 * safeSlice(undefined, 0, 10)                     // ""
 * safeSlice("hello", 0, 2)                        // "he"
 *
 * @param str  - The value to slice (expected to be a string).
 * @param start - The start index for the slice.
 * @param end   - Optional end index for the slice.
 * @returns The sliced string, or an empty string if the input is not a valid string.
 */
export function safeSlice(
  str: unknown,
  start: number,
  end?: number,
): string {
  if (typeof str !== "string") return "";
  return str.slice(start, end);
}
