/**
 * Normalize an Indian phone number to E.164 digits (no +) and build a wa.me link.
 * Handles common formats: "+91 98765 43210", "098765-43210", "9876543210".
 * Returns null when the input can't be resolved to a plausible Indian mobile.
 *
 * IMPORTANT: a bare 10-digit number is only assumed Indian; an explicit non-91
 * country code (e.g. "+1…", "+44…") is rejected so we never fabricate a fake
 * Indian WhatsApp number from a foreign one.
 */
export function toIndianE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();

  // Explicit foreign country code (e.g. +1 US, +44 UK) → not an Indian mobile.
  if (/^\+(?!91)\d/.test(trimmed)) return null;

  let digits = trimmed.replace(/[^\d]/g, "");

  // Strip leading 00 international prefix or a single STD 0.
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);

  // 13 digits like 0091XXXXXXXXXX handled above; now match country-coded or bare.
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  // Bare 10-digit mobile (Indian mobiles start 6-9).
  if (digits.length === 10 && /^[6-9]/.test(digits)) return "91" + digits;

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
