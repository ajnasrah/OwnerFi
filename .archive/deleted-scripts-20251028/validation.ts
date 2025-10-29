/**
 * Input Validation Library
 */

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validatePhone(phone: string): boolean {
  const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
  return phoneRegex.test(phone);
}

export function sanitizeString(input: string): string {
  return input.trim().replace(/[<>\"'&]/g, '');
}

export function sanitizeEmail(email: string): string {
  return email.toLowerCase().trim();
}