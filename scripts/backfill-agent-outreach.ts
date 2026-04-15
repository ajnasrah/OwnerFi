/**
 * One-time backfill: sends every existing realtor (users.role='realtor')
 * that hasn't been outreached yet to the agent outreach webhook.
 *
 * Skips:
 *   - users with agentOutreachSentAt already set
 *   - users with missing or invalid phone numbers
 *
 * Dry-run by default. Pass --live to actually POST.
 *
 * Usage:
 *   npx tsx scripts/backfill-agent-outreach.ts            # dry run
 *   npx tsx scripts/backfill-agent-outreach.ts --live     # execute
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const admin = require('firebase-admin');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs');

dotenv.config({ path: '.env.local' });

const LIVE = process.argv.includes('--live');

const WEBHOOK_URL =
  process.env.AGENT_OUTREACH_WEBHOOK_URL ||
  'https://services.leadconnectorhq.com/hooks/U2B5lSlWrVBgVxHNq5AH/webhook-trigger/52511b61-8384-4c96-90b0-a0e026b1c266';

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  }),
});

const db = admin.firestore();

function isValidPhone(phone: string): boolean {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, '');
  return digits.length === 10 || digits.length === 11;
}

function formatPhoneE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('1') && digits.length === 11) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (phone.startsWith('+')) return `+${digits}`;
  return `+1${digits}`;
}

type Result = { id: string; first_name: string; last_name: string; phone: string; target_city: string; target_state: string; status: 'sent' | 'failed' | 'skipped'; reason?: string };

async function main() {
  console.log(`\nAGENT OUTREACH BACKFILL — ${LIVE ? '🔴 LIVE' : '🟡 DRY RUN'}\n`);

  const snap = await db.collection('users').where('role', '==', 'realtor').get();
  console.log(`Found ${snap.size} realtor user records\n`);

  const results: Result[] = [];
  let sent = 0;
  let failed = 0;
  let skippedAlreadySent = 0;
  let skippedBadPhone = 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const doc of snap.docs) {
    const data = doc.data();
    const id = doc.id;
    // Prefer explicit first/last from realtorData; fall back to splitting `name`
    let first_name = data.realtorData?.firstName || '';
    let last_name = data.realtorData?.lastName || '';
    if (!first_name && !last_name && data.name) {
      const parts = String(data.name).trim().split(/\s+/);
      first_name = parts[0] || '';
      last_name = parts.slice(1).join(' ') || '';
    }
    const phone = data.phone || data.realtorData?.phone || '';
    const target_city = data.realtorData?.serviceArea?.primaryCity?.name || '';
    const target_state = data.realtorData?.serviceArea?.primaryCity?.state || '';

    if (data.agentOutreachSentAt) {
      skippedAlreadySent++;
      results.push({ id, first_name, last_name, phone, target_city, target_state, status: 'skipped', reason: 'already_sent' });
      continue;
    }

    if (!isValidPhone(phone)) {
      skippedBadPhone++;
      results.push({ id, first_name, last_name, phone, target_city, target_state, status: 'skipped', reason: `invalid_phone: "${phone}"` });
      continue;
    }

    const normalized = formatPhoneE164(phone);

    if (!LIVE) {
      results.push({ id, first_name, last_name, phone: normalized, target_city, target_state, status: 'sent', reason: 'dry-run' });
      sent++;
      continue;
    }

    try {
      const res = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, phone: normalized, first_name, last_name, target_city, target_state }),
      });

      if (res.ok) {
        await db.collection('users').doc(id).update({
          agentOutreachSentAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        sent++;
        results.push({ id, first_name, last_name, phone: normalized, target_city, target_state, status: 'sent' });
      } else {
        failed++;
        results.push({ id, first_name, last_name, phone: normalized, target_city, target_state, status: 'failed', reason: `http_${res.status}` });
      }
    } catch (err) {
      failed++;
      results.push({ id, first_name, last_name, phone: normalized, target_city, target_state, status: 'failed', reason: (err as Error).message });
    }

    // Polite throttle — 100 ms between calls to avoid hammering GHL
    await new Promise(r => setTimeout(r, 100));
  }

  const reportPath = 'scripts/_agent-outreach-backfill-report.json';
  fs.writeFileSync(reportPath, JSON.stringify({ live: LIVE, summary: { total: snap.size, sent, failed, skippedAlreadySent, skippedBadPhone }, results }, null, 2));

  console.log('━━━ SUMMARY ━━━');
  console.log(`  Total realtors:           ${snap.size}`);
  console.log(`  Sent:                     ${sent}`);
  console.log(`  Failed:                   ${failed}`);
  console.log(`  Skipped (already sent):   ${skippedAlreadySent}`);
  console.log(`  Skipped (bad phone):      ${skippedBadPhone}`);
  console.log(`\nFull report: ${reportPath}`);
  if (!LIVE) console.log('\n⚠️  DRY RUN — re-run with --live to actually send.\n');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
