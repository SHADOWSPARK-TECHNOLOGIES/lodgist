const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  REJECTED_SUPPORT_DIGITS,
  supportDigits,
  whatsappArrangementRef,
  paymentWhatsAppText,
} = require("./whatsappPayment");

test("support digits come from the env value and refuse the rejected test number", () => {
  assert.equal(supportDigits(undefined), null);
  assert.equal(supportDigits(""), null);
  assert.equal(supportDigits("not-a-number"), null);
  assert.equal(supportDigits("+234 904 577 0572"), null);
  assert.equal(supportDigits(REJECTED_SUPPORT_DIGITS), null);
  assert.equal(supportDigits("+234 801 234 5678"), "2348012345678");
});

test("payment text names the item, naira amount, reference, listing, and name", () => {
  const text = paymentWhatsAppText({
    what: "Rental Safety Check",
    amountNgn: 5000,
    reference: "RSC-AB12CD34",
    listing: "Nekede, Owerri",
    name: "Ada Okonkwo",
  });
  assert.match(text, /What: Rental Safety Check/);
  assert.match(text, /Amount: ₦5,000/);
  assert.match(text, /Reference: RSC-AB12CD34/);
  assert.match(text, /Listing: Nekede, Owerri/);
  assert.match(text, /Name: Ada Okonkwo/);
  assert.match(text, /Lodgist team confirms payment/);
  assert.match(text, /not a receipt/);
  assert.equal(/payment is complete|fee is paid|successfully paid/i.test(text), false);
});

test("arrangement reference is the id staff already store on manual payment", () => {
  assert.equal(whatsappArrangementRef("RSC-AB12CD34"), "WHATSAPP RSC-AB12CD34");
  assert.equal(whatsappArrangementRef("  bk_1 "), "WHATSAPP bk_1");
});
