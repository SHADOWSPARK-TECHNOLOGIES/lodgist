function supportWhatsAppDigits(envValue) {
  if (typeof envValue !== "string") return null;
  const digits = envValue.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}

function supportWhatsAppUrl(envValue, text) {
  const digits = supportWhatsAppDigits(envValue);
  if (!digits) return null;
  const base = `https://wa.me/${digits}`;
  if (text == null || text === "") return base;
  return `${base}?text=${encodeURIComponent(String(text))}`;
}

module.exports = { supportWhatsAppDigits, supportWhatsAppUrl };
