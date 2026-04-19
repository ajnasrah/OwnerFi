/**
 * Backfill latitude/longitude on properties that passed through the
 * agent-outreach YES flow before the lat/lng fix. Without coords Typesense
 * has no `location` and the property is invisible to buyer geo-radius
 * searches.
 *
 * Usage:
 *   npx tsx scripts/backfill-agent-yes-latlng.ts --dry-run
 *   npx tsx scripts/backfill-agent-yes-latlng.ts --confirm
 *   npx tsx scripts/backfill-agent-yes-latlng.ts --confirm --only zpid_459631503
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

import { getFirebaseAdmin } from '../src/lib/scraper-v2/firebase-admin';
import { geocodeAddress } from '../src/lib/geocode';

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const confirm = argv.includes('--confirm');
  const onlyIdx = argv.indexOf('--only');
  const onlyId = onlyIdx >= 0 ? argv[onlyIdx + 1] : null;

  if (!dryRun && !confirm) {
    console.error('Pass --dry-run to preview or --confirm to write.');
    process.exit(1);
  }

  const { db } = getFirebaseAdmin();
  const snap = await db.collection('agent_outreach_queue')
    .where('status', '==', 'agent_yes')
    .get();
  console.log(`agent_yes queue docs: ${snap.size}`);

  let checked = 0, hasCoords = 0, missing = 0, backfilled = 0, failed = 0, skipped = 0;

  for (const d of snap.docs) {
    const qdata = d.data();
    const propId = qdata.routedToDocId || 'zpid_' + qdata.zpid;
    if (onlyId && propId !== onlyId) continue;

    const propRef = db.collection('properties').doc(propId);
    const propSnap = await propRef.get();
    if (!propSnap.exists) { skipped++; continue; }
    checked++;
    const p = propSnap.data()!;
    if (p.latitude && p.longitude) { hasCoords++; continue; }

    missing++;
    const coords = await geocodeAddress({
      street: p.streetAddress || p.address || qdata.address,
      city: p.city || qdata.city,
      state: p.state || qdata.state,
      zip: p.zipCode || qdata.zipCode,
    });

    if (!coords) {
      console.log(`  ❌ geocode failed: ${propId} ${qdata.address}`);
      failed++;
      continue;
    }

    if (dryRun) {
      console.log(`  [DRY] ${propId} ${qdata.address} → (${coords.lat}, ${coords.lng})`);
    } else {
      await propRef.update({
        latitude: coords.lat,
        longitude: coords.lng,
        updatedAt: new Date(),
      });
      console.log(`  ✅ ${propId} ${qdata.address} → (${coords.lat}, ${coords.lng})`);
    }
    backfilled++;
  }

  console.log('\n=== DONE ===');
  console.log('checked    :', checked);
  console.log('had coords :', hasCoords);
  console.log('missing    :', missing);
  console.log(dryRun ? 'would backfill:' : 'backfilled    :', backfilled);
  console.log('geocode failed:', failed);
  console.log('skipped (no property doc):', skipped);
  process.exit(0);
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
