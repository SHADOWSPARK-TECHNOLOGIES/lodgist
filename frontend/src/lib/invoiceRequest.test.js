const { test } = require("node:test");
const assert = require("node:assert/strict");
const { invoiceRequestMessage } = require("./invoiceRequest");

test("invoice request names the booking, listing, and amount", () => {
  const text = invoiceRequestMessage({
    bookingId: "bk_1",
    listing: "Two bedroom in Owerri",
    amount: 500000,
  });
  assert.match(text, /Booking ID: bk_1/);
  assert.match(text, /Listing: Two bedroom in Owerri/);
  assert.match(text, /Amount: NGN /);
  assert.equal(/payment completed/i.test(text), false);
  assert.equal(/\bpaid\b/i.test(text), false);
});
