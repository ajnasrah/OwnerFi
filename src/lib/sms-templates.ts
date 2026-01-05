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
  const dashboardUrl = data.dashboardUrl || 'https://ownerfi.ai/dashboard';

  return `🏠 New Property Match!

Hi ${data.buyerFirstName}! We found a home for you in ${data.propertyCity}, ${data.propertyState}:

📍 ${data.propertyAddress}
🛏️ ${data.bedrooms} bed, ${data.bathrooms} bath
💰 $${data.listPrice.toLocaleString()} list price
💵 $${data.monthlyPayment}/mo, $${data.downPaymentAmount.toLocaleString()} down

View it now: ${dashboardUrl}

Reply STOP to unsubscribe`;
}
