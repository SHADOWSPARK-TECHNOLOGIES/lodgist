/** WhatsApp text for a tenant who already has a booking. Not a payment receipt. */
function invoiceRequestMessage({ bookingId, listing, amount }) {
  const id = bookingId == null || bookingId === "" ? "" : String(bookingId);
  const home = listing == null || listing === "" ? "" : String(listing);
  const money = typeof amount === "number" && Number.isFinite(amount)
    ? `NGN ${amount.toLocaleString("en-NG")}`
    : "";
  return [
    "Please send an invoice for this booking.",
    "This is not a completed payment.",
    id ? `Booking ID: ${id}` : null,
    home ? `Listing: ${home}` : null,
    money ? `Amount: ${money}` : null,
  ].filter(Boolean).join("\n");
}

module.exports = { invoiceRequestMessage };
