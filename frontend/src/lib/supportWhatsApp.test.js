const { test } = require("node:test");
const assert = require("node:assert/strict");
const { supportWhatsAppDigits, supportWhatsAppUrl } = require("./supportWhatsApp");

test("missing or junk WhatsApp env does not invent a number", () => {
  assert.equal(supportWhatsAppDigits(undefined), null);
  assert.equal(supportWhatsAppDigits(""), null);
  assert.equal(supportWhatsAppDigits("not-a-number"), null);
  assert.equal(supportWhatsAppUrl(undefined, "hello"), null);
});

test("a configured number becomes a wa.me link", () => {
  assert.equal(supportWhatsAppDigits("+234 800 000 0000"), "2348000000000");
  assert.equal(
    supportWhatsAppUrl("2348000000000", "I need a home"),
    "https://wa.me/2348000000000?text=I%20need%20a%20home",
  );
});
