/**
 * Twilio SMS Client for Agent Outreach
 *
 * Sends SMS via Twilio REST API using raw fetch (same pattern as send-otp).
 * DRY_RUN mode is ON by default — messages are logged, not sent.
 * Set AGENT_OUTREACH_LIVE=true to enable real SMS sending.
 */

import { normalizePhone, isValidPhone } from '@/lib/phone-utils';
import { isWithinBusinessHours, getBusinessHoursStatus } from './business-hours';

const TWILIO_API = 'https://api.twilio.com/2010-04-01/Accounts';

function getTwilioConfig() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const fromNumber = process.env.TWILIO_OUTREACH_NUMBER?.trim();

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error('Missing Twilio config: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or TWILIO_OUTREACH_NUMBER');
  }

  return { accountSid, authToken, fromNumber };
}

function isDryRun(): boolean {
  return process.env.AGENT_OUTREACH_LIVE !== 'true';
}

export interface SMSResult {
  sid: string;
  status: string;
  dryRun: boolean;
}

export interface SendSMSOptions {
  /** If true, bypass business hours check (for replies to inbound messages / opt-out confirmations) */
  isResponse?: boolean;
}

/**
 * Send an SMS via Twilio.
 * In DRY_RUN mode (default), logs the message and returns a fake SID.
 *
 * Safety guards:
 * - Validates phone number format before sending
 * - Blocks OUTBOUND-initiated sends outside business hours (9 AM – 8 PM Central)
 * - Responses to inbound messages bypass the hours check (opt-out confirmations, replies)
 */
export async function sendSMS(to: string, body: string, options?: SendSMSOptions): Promise<SMSResult> {
  const normalizedTo = normalizePhone(to);

  // Guard: validate phone number is a real US number
  if (!isValidPhone(normalizedTo)) {
    throw new Error(`Invalid phone number: ${to} (normalized: ${normalizedTo})`);
  }

  // Guard: block outbound-initiated sends outside business hours (TCPA compliance)
  // Responses to inbound messages (opt-out confirmations, replies) are always allowed
  if (!isDryRun() && !options?.isResponse && !isWithinBusinessHours()) {
    const status = getBusinessHoursStatus();
    console.log(`🚫 [SMS BLOCKED] Outside business hours: ${status.reason}`);
    throw new Error(`SMS blocked: outside business hours. ${status.reason}`);
  }

  if (isDryRun()) {
    console.log(`📱 [DRY RUN] SMS to ${normalizedTo}:`);
    console.log(`   "${body}"`);
    return {
      sid: `dry_run_${Date.now()}`,
      status: 'dry_run',
      dryRun: true,
    };
  }

  const { accountSid, authToken, fromNumber } = getTwilioConfig();

  const response = await fetch(
    `${TWILIO_API}/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: normalizedTo,
        From: fromNumber,
        Body: body,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    const errorMsg = data.message || data.error_message || JSON.stringify(data);
    throw new Error(`Twilio SMS failed (${response.status}): ${errorMsg}`);
  }

  console.log(`📱 [SMS SENT] To: ${normalizedTo} | SID: ${data.sid} | Status: ${data.status}`);

  return {
    sid: data.sid,
    status: data.status,
    dryRun: false,
  };
}
