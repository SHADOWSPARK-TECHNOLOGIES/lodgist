/**
 * Read a fetch Response body as text while enforcing a hard byte cap.
 *
 * Adapted from God's Eye View, file server/providers/common/http.js
 * (function readCappedResponseText), commit 6be25595b16491ce01ffd8d81e66921f321ee200.
 * https://github.com/bilawalsidhu/gods-eye-view
 *
 * Modification: converted from ESM to CommonJS. The GEV re-exports of
 * src/sources/httpBody.js are not included. Lodgist calls this only after
 * an allowlisted provider response has already been accepted.
 *
 * Copyright (c) 2026 Bilawal Sidhu
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

async function readCappedResponseText(upstream, maxBytes) {
  const declared = Number(upstream.headers && typeof upstream.headers.get === "function"
    ? upstream.headers.get("content-length")
    : upstream.headers && upstream.headers["content-length"]);
  if (Number.isFinite(declared) && declared > maxBytes) {
    try {
      await upstream.body?.cancel();
    } catch {
      /* no-op */
    }
    return { tooLarge: true, text: "" };
  }
  if (
    !upstream.body
    || typeof upstream.body[Symbol.asyncIterator] !== "function"
  ) {
    const text = typeof upstream.text === "function"
      ? await upstream.text()
      : JSON.stringify(await upstream.json());
    return text.length > maxBytes
      ? { tooLarge: true, text: "" }
      : { tooLarge: false, text };
  }
  const decoder = new TextDecoder();
  let text = "";
  let total = 0;
  for await (const chunk of upstream.body) {
    total += chunk.length;
    if (total > maxBytes) {
      try {
        await upstream.body.cancel();
      } catch {
        /* no-op */
      }
      return { tooLarge: true, text: "" };
    }
    text += decoder.decode(chunk, { stream: true });
  }
  text += decoder.decode();
  return { tooLarge: false, text };
}

module.exports = { readCappedResponseText };
