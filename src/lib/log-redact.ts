/**
 * Small redaction helpers for log statements that previously echoed
 * full PII (phone / email / address) into Vercel's persistent log stream.
 * Cheap to call; return short, unambiguous identifiers that are useful
 * for debugging but don't let anyone reconstruct the original value.
 */

export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '<none>';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length < 4) return '***';
  return `***${digits.slice(-4)}`;
}

export function maskEmail(email: string | null | undefined): string {
  if (!email) return '<none>';
  const s = String(email);
  const at = s.indexOf('@');
  if (at <= 0) return '***';
  const local = s.slice(0, at);
  const domain = s.slice(at + 1);
  const shownLocal = local.length <= 2
    ? local[0] + '*'
    : local[0] + '***' + local[local.length - 1];
  return `${shownLocal}@${domain}`;
}

export function maskAddress(address: string | null | undefined): string {
  if (!address) return '<none>';
  // Keep street-suffix words and city/state if present; drop exact number.
  return String(address).replace(/^\d+\s+/, '### ');
}
