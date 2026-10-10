/** Rejected test number. Never a payment destination. */
const REJECTED_SUPPORT_DIGITS = "2349045770572";

function supportDigits(raw) {
  if (raw == null || String(raw).trim() === "") return null;
  const digits = String(raw).replace(/\D/g, "");
  if (!digits || digits === REJECTED_SUPPORT_DIGITS) return null;
  return digits;
}

function whatsappArrangementRef(id) {
  const value = String(id == null ? "" : id).trim();
  return `WHATSAPP ${value}`;
}

function formatPaymentAmount(amount, currency) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "";
  if (!currency || currency === "NGN") return `\u20a6${n.toLocaleString("en-NG")}`;
  return `${currency} ${n.toLocaleString("en-NG")}`;
}

/**
 * Prefilled WhatsApp text. Staff match `reference`. This is not a receipt.
 */
function paymentWhatsAppText({ what, amountNgn, currency = "NGN", reference, listing = "", name = "" }) {
  const lines = [
    "Hi Lodgist. I want to arrange this payment on WhatsApp.",
    "The Lodgist team confirms payment. This message is not a receipt.",
    "",
    `What: ${what}`,
    `Amount: ${formatPaymentAmount(amountNgn, currency)}`,
    `Reference: ${reference}`,
  ];
  if (listing) lines.push(`Listing: ${listing}`);
  if (name) lines.push(`Name: ${name}`);
  return lines.join("\n");
}

module.exports = {
  REJECTED_SUPPORT_DIGITS,
  supportDigits,
  whatsappArrangementRef,
  paymentWhatsAppText,
};
