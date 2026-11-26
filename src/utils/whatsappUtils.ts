/**
 * Normalizes a Brazilian phone/WhatsApp string into E.164 digits without '+',
 * e.g. "(75) 98807-7173" or "075988077173" -> "5575988077173".
 * Returns empty string if there are fewer than 10 local digits.
 */
export function normalizeBrazilWhatsappDigits(rawPhone?: string): string {
  const digitsOnly = (rawPhone || '').replace(/\D/g, '');
  if (!digitsOnly) return '';

  let localDigits = digitsOnly;
  if (localDigits.startsWith('55') && localDigits.length >= 12) {
    localDigits = localDigits.slice(2);
  }
  localDigits = localDigits.replace(/^0+/, '');

  if (localDigits.length < 10) {
    return '';
  }

  return `55${localDigits}`;
}

export function isValidWhatsappPhone(rawPhone?: string): boolean {
  return normalizeBrazilWhatsappDigits(rawPhone).length >= 12;
}

export function buildWhatsappLink(rawPhone?: string, message?: string): string {
  const normalized = normalizeBrazilWhatsappDigits(rawPhone);
  if (!normalized) return '#';
  const baseUrl = `https://wa.me/${normalized}`;
  return message ? `${baseUrl}?text=${encodeURIComponent(message)}` : baseUrl;
}

export function formatWhatsappDisplay(rawPhone?: string): string {
  const normalized = normalizeBrazilWhatsappDigits(rawPhone);
  if (!normalized) return rawPhone?.trim() || 'Não configurado';

  const local = normalized.slice(2);
  if (local.length === 11) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  }
  if (local.length === 10) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  }
  return `+${normalized}`;
}
