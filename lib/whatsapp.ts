/**
 * Normalize an Indian phone number to E.164 digits (no +) and build a wa.me link.
 * Handles common formats: "+91 98765 43210", "098765-43210", "9876543210".
 * Returns null when the input can't be resolved to a plausible 10-digit Indian mobile.
 */
export function toIndianE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/[^\d]/g, "");

  // Strip leading 0 (STD prefix) or 00 international prefix.
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);

  // Already has country code.
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits;
  }
  // Bare 10-digit mobile (Indian mobiles start 6-9).
  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    return "91" + digits;
  }
  // 11 digits starting with 91 won't be valid; fall through.
  if (digits.length === 12 && digits.startsWith("91")) return digits;

  return null;
}

export function whatsappLink(
  phoneOrWhatsapp: string | null | undefined,
  prefilled?: string
): string | null {
  const e164 = toIndianE164(phoneOrWhatsapp);
  if (!e164) return null;
  const base = `https://wa.me/${e164}`;
  return prefilled ? `${base}?text=${encodeURIComponent(prefilled)}` : base;
}
