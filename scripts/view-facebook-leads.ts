/**
 * View Facebook Buyer Leads
 *
 * Usage:
 *   npx tsx scripts/view-facebook-leads.ts              - View recent leads
 *   npx tsx scripts/view-facebook-leads.ts stats        - View stats only
 *   npx tsx scripts/view-facebook-leads.ts export       - Export to CSV
 *   npx tsx scripts/view-facebook-leads.ts resync-ghl   - Resync failed GHL leads
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';

// Initialize Firebase Admin
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    }),
  });
}

const db = getFirestore();

const GHL_API_BASE = 'https://services.leadconnectorhq.com';

async function syncLeadToGHL(lead: any): Promise<{ success: boolean; contactId?: string }> {
  const GHL_API_KEY = process.env.GHL_API_KEY;
  const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;

  if (!GHL_API_KEY || !GHL_LOCATION_ID) {
    return { success: false };
  }

  try {
    const contactPayload = {
      locationId: GHL_LOCATION_ID,
      email: lead.email,
      name: lead.commenterName || '',
      tags: ['facebook-lead', 'creative-financing-buyer'],
      source: 'Facebook Group',
      customFields: [
        { id: 'lead_source_group', value: lead.groupName },
        { id: 'lead_source_post', value: lead.postUrl },
      ],
    };

    const response = await fetch(`${GHL_API_BASE}/contacts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GHL_API_KEY}`,
        'Content-Type': 'application/json',
        'Version': '2021-07-28',
      },
      body: JSON.stringify(contactPayload),
    });

    if (response.ok) {
      const data = await response.json();
      return { success: true, contactId: data.contact?.id };
    }
    return { success: false };
  } catch {
    return { success: false };
  }
}

async function viewLeads(limit: number = 50) {
  const snapshot = await db
    .collection('facebook_buyer_leads')
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();

  if (snapshot.empty) {
    console.log('\n📭 No leads found yet.\n');
    return;
  }

  console.log(`\n📧 Recent Facebook Leads (${snapshot.size}):\n`);
  console.log('─'.repeat(80));

  snapshot.forEach((doc, index) => {
    const lead = doc.data();
    const ghlStatus = lead.ghlSynced ? '✅ GHL' : '⏳ Pending';

    console.log(`\n${index + 1}. ${lead.email}`);
    console.log(`   Name: ${lead.commenterName || 'Unknown'}`);
    console.log(`   Group: ${lead.groupName}`);
    console.log(`   Status: ${ghlStatus}`);
    console.log(`   Added: ${lead.createdAt?.toDate?.()?.toLocaleDateString() || 'Unknown'}`);
  });

  console.log('\n' + '─'.repeat(80));
}

async function viewStats() {
  const allLeads = await db.collection('facebook_buyer_leads').get();

  const stats = {
    total: allLeads.size,
    ghlSynced: 0,
    pendingSync: 0,
    byGroup: {} as Record<string, number>,
  };

  allLeads.forEach(doc => {
    const lead = doc.data();

    if (lead.ghlSynced) {
      stats.ghlSynced++;
    } else {
      stats.pendingSync++;
    }

    const group = lead.groupName || 'Unknown';
    stats.byGroup[group] = (stats.byGroup[group] || 0) + 1;
  });

  console.log('\n📊 Facebook Leads Statistics\n');
  console.log('─'.repeat(40));
  console.log(`Total Leads: ${stats.total}`);
  console.log(`GHL Synced: ${stats.ghlSynced}`);
  console.log(`Pending Sync: ${stats.pendingSync}`);
  console.log('\nBy Group:');

  Object.entries(stats.byGroup)
    .sort((a, b) => b[1] - a[1])
    .forEach(([group, count]) => {
      console.log(`  ${group}: ${count}`);
    });

  console.log('─'.repeat(40));
}

async function exportToCsv() {
  const allLeads = await db
    .collection('facebook_buyer_leads')
    .orderBy('createdAt', 'desc')
    .get();

  if (allLeads.empty) {
    console.log('No leads to export');
    return;
  }

  const headers = ['Email', 'Name', 'Group', 'Post URL', 'GHL Synced', 'Created At'];
  const rows = [headers.join(',')];

  allLeads.forEach(doc => {
    const lead = doc.data();
    const row = [
      `"${lead.email || ''}"`,
      `"${lead.commenterName || ''}"`,
      `"${lead.groupName || ''}"`,
      `"${lead.postUrl || ''}"`,
      lead.ghlSynced ? 'Yes' : 'No',
      lead.createdAt?.toDate?.()?.toISOString() || '',
    ];
    rows.push(row.join(','));
  });

  const filename = `facebook-leads-${new Date().toISOString().split('T')[0]}.csv`;
  fs.writeFileSync(filename, rows.join('\n'));

  console.log(`\n✅ Exported ${allLeads.size} leads to ${filename}\n`);
}

async function resyncGHL() {
  const pendingLeads = await db
    .collection('facebook_buyer_leads')
    .where('ghlSynced', '==', false)
    .get();

  if (pendingLeads.empty) {
    console.log('\n✅ All leads already synced to GHL\n');
    return;
  }

  console.log(`\n🔄 Resyncing ${pendingLeads.size} leads to GHL...\n`);

  let synced = 0;
  let failed = 0;

  for (const doc of pendingLeads.docs) {
    const lead = doc.data();

    const result = await syncLeadToGHL(lead);

    if (result.success) {
      await doc.ref.update({
        ghlSynced: true,
        ghlContactId: result.contactId,
        ghlSyncedAt: new Date(),
      });
      synced++;
      console.log(`  ✅ ${lead.email}`);
    } else {
      failed++;
      console.log(`  ❌ ${lead.email}`);
    }

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log(`\n📊 Results: ${synced} synced, ${failed} failed\n`);
}

async function main() {
  const command = process.argv[2] || 'list';

  switch (command) {
    case 'list':
      await viewLeads();
      break;
    case 'stats':
      await viewStats();
      break;
    case 'export':
      await exportToCsv();
      break;
    case 'resync-ghl':
      await resyncGHL();
      break;
    default:
      console.log(`
📧 Facebook Leads Viewer

Commands:
  list        - View recent leads (default)
  stats       - View statistics
  export      - Export to CSV
  resync-ghl  - Resync failed GHL leads

Examples:
  npx tsx scripts/view-facebook-leads.ts
  npx tsx scripts/view-facebook-leads.ts stats
  npx tsx scripts/view-facebook-leads.ts export
`);
  }

  process.exit(0);
}

main().catch(console.error);
