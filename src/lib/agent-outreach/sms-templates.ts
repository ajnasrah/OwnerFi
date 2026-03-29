/**
 * SMS Message Templates for Agent Outreach
 *
 * All templates include STOP opt-out language for TCPA compliance.
 */

export interface OutreachData {
  agentName: string;
  address: string;
  city: string;
  state?: string;
}

/**
 * Initial outreach SMS asking about owner financing.
 */
export function formatInitialOutreach(data: OutreachData): string {
  const name = data.agentName.split(' ')[0]; // First name only
  return (
    `Hi ${name}, this is OwnerFi. We help buyers find owner-financed homes. ` +
    `Does the property at ${data.address}, ${data.city} offer owner financing or flexible terms? ` +
    `Reply YES or NO. Reply STOP to opt out.`
  );
}

/**
 * Follow-up SMS (day 3 or day 6).
 */
export function formatFollowUp(data: OutreachData, followUpNumber: 1 | 2): string {
  const name = data.agentName.split(' ')[0];

  if (followUpNumber === 1) {
    return (
      `Hi ${name}, just following up about ${data.address} in ${data.city}. ` +
      `Does the seller offer owner financing? We have qualified buyers looking. ` +
      `Reply YES, NO, or STOP to opt out.`
    );
  }

  return (
    `Last check on ${data.address}, ${data.city} - any owner financing available? ` +
    `Reply YES or NO. We won't reach out again about this property. ` +
    `Reply STOP to opt out.`
  );
}

/**
 * Confirmation when agent opts out.
 */
export function formatOptOutConfirmation(): string {
  return `You've been unsubscribed from OwnerFi messages. You will not receive further texts from us.`;
}

/**
 * Confirmation when agent says YES.
 */
export function formatYesConfirmation(address: string): string {
  return (
    `Thanks for confirming! We've listed ${address} as owner-finance available ` +
    `on OwnerFi. We'll send qualified buyers your way.`
  );
}

/**
 * Acknowledgment when agent says NO.
 */
export function formatNoAcknowledgment(_address: string): string {
  return `Ok thanks for the response, keep me in mind if anything changes please`;
}

/**
 * Acknowledgment when agent says they'll ask the seller.
 */
export function formatAskingSellerAcknowledgment(address: string): string {
  return (
    `No rush! Take your time checking on ${address}. ` +
    `We'll follow up in a few days. Thanks!`
  );
}

/**
 * Follow-up specifically for "asking seller" items (after 3 days).
 */
export function formatAskingSellerFollowUp(data: OutreachData): string {
  const name = data.agentName.split(' ')[0];
  return (
    `Hi ${name}, just circling back on ${data.address} in ${data.city}. ` +
    `Were you able to check with the seller about owner financing? ` +
    `Reply YES, NO, or STOP to opt out.`
  );
}
