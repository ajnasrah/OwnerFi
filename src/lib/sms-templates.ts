/**
 * SMS Message Templates
 *
 * Centralized templates for all SMS notifications.
 * This prevents duplicate message formatting across the codebase.
 */

export interface PropertyMatchSMSData {
  buyerFirstName: string;
  propertyAddress: string;
  propertyCity: string;
  propertyState: string;
  bedrooms: number;
  bathrooms: number;
  listPrice: number;
  monthlyPayment: number;
  downPaymentAmount: number;
  dashboardUrl?: string;
}

/**
 * Format SMS message for property match notification
 */
export function formatPropertyMatchSMS(data: PropertyMatchSMSData): string {
  const dashboardUrl = data.dashboardUrl || 'https://ownerfi.com/dashboard';

  // Ensure numbers are valid for display
  const bedrooms = Math.max(0, data.bedrooms || 0);
  const bathrooms = Math.max(0, data.bathrooms || 0);
  const listPrice = Math.max(0, data.listPrice || 0);
  const monthlyPayment = Math.max(0, data.monthlyPayment || 0);
  const downPaymentAmount = Math.max(0, data.downPaymentAmount || 0);

  return `🏠 New Property Match!

Hi ${data.buyerFirstName}! We found a home for you in ${data.propertyCity}, ${data.propertyState}:

📍 ${data.propertyAddress}
🛏️ ${bedrooms} bed, ${bathrooms} bath
💰 $${listPrice.toLocaleString('en-US')} list price
💵 $${monthlyPayment.toLocaleString('en-US')}/mo, $${downPaymentAmount.toLocaleString('en-US')} down

View it now: ${dashboardUrl}

Reply STOP to unsubscribe`;
}
