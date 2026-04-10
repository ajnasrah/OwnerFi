/**
 * CLEANUP SCRIPT: Remove "Lost/not int" Leads from Referral System
 *
 * Processes the 47 "Lost/not int" leads from the GHL Ownerfi buyers pipeline:
 * 1. Finds buyer profiles by phone/email
 * 2. Marks them as inactive (isAvailableForPurchase: false, isActive: false)
 * 3. Voids any pending/signed referral agreements
 *
 * Usage:
 *   npx tsx scripts/cleanup-not-interested-leads.ts          # Dry run (report only)
 *   npx tsx scripts/cleanup-not-interested-leads.ts --fix     # Apply changes
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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
const DRY_RUN = !process.argv.includes('--fix');

// "Lost/not int" leads from GHL CSV export (2026-04-09)
// Format: [name, phone, email]
const NOT_INTERESTED_LEADS: [string, string, string][] = [
  ['Jane Doe', '+14233312081', 'no1977@gmail.com'],
  ['KELLIANNE HARPER', '+18178910427', 'kelli@kellicoffee.com'],
  ['Wendy Bateman', '+14808098174', 'nyy241999@gmail.com'],
  ['Geoffrey Okema', '+17372963089', 'geoffrey.okema11@gmail.com'],
  ['Nigel Jeffers', '+13368976738', 'carsales650@gmail.com'],
  ['Ibrahim Hasan', '+19018572298', 'ihasan2018@gmail.com'],
  ['William Gallaspy', '+18595591670', 'william.gallaspy@icloud.com'],
  ['TINA WEIDENHEIMER', '+15708095079', 'tmm623@yahoo.com'],
  ['Erik C', '+12395957829', 'erikcorace@gmail.com'],
  ['Maleaha Rakoczy', '+17194922548', 'bizebeezservices1@gmail.com'],
  ['B Bryant', '+15803204169', 'mimmiebon@yahoo.com'],
  ['Tim and Robin Ward', '+18434855503', 'robinward29442@aol.com'],
  ['Ashwini Jordan', '+15304013744', 'hassle.backer-3n@icloud.com'],
  ['nataly abuhalimeh', '+15017497766', 'natalyabu98@gmail.com'],
  ['abdullah abunasrah', '+19898999898', 'ajnasrah20083@gmail.com'],
  ['Jamie Kinz', '+17243331933', 'jkunz692@live.com'],
  ['Natasha Scott', '+12514097987', 'natashacasher00@gmail.com'],
  ['A J', '+14052272935', 'mccloudaj9@gmail.com'],
  ['Rose Chartrand', '+16186235505', 'rschartrand5@gmail.com'],
  ['Myron Waite', '+17158917075', '14beanbug21@gmail.com'],
  ['S M', '+13107294690', 'srmrealestatellc@gmail.com'],
  ['Nixon Traba fontanal', '+15513429127', 'trabafontanalnixon@gmail.com'],
  ['Victor Westbrook', '+12104718603', 'victor.westbrook@gmail.com'],
  ['Rich Leddy', '+17326167984', 'richleddy113@gmail.com'],
  ['Josh Garcia', '+14136685695', 'josh.garcia1982@gmail.com'],
  ['Tessah Corbridge', '+18708264312', 'tessahcorbridge@gmail.com'],
  ['Emily Gallizo', '+17737179726', 'egallizo@luc.edu'],
  ['TJ Austin', '+19514048904', 'tjaustinmedia@gmail.com'],
  ['Amanda Smith', '+19169470907', 'samanda299@yahoo.com'],
  ['Kimberly Tipsword', '+13076404049', 'angelloves1970@yahoo.com'],
  ['Ghena Abunasrah', '+19014687607', 'ghenaabunasrah@gmail.com'],
  ['Jana Abunasrah', '+19016511758', 'abunasrahj@gmail.com'],
  ['Weston James Dowis', '+17195027119', 'weston.dowis@outlook.com'],
  ['William Young', '+16092146102', 'blueloulove@aol.com'],
  ['Abigail Johnson', '+19315051860', 'abigailjay97@gmail.com'],
  ['Jeff Eason', '+19477779997', 'jeffeason1600@gmail.com'],
  ['Joseph Rakidzich', '+12623742888', 'rakpropertygroup@gmail.com'],
  ['Dex Manson', '+14752101191', 'dexmanson08@gmail.com'],
  ['Darren DeBarros', '+14136298843', 'ddbinv4u@gmail.com'],
  ['Tina Izaguirre', '+19013159527', 'tizzielynn@gmail.com'],
  ['Antonio Lowder', '+15672077925', 'halo2wear@yahoo.com'],
  ['s s', '+19014126643', 's@hotmail.com'],
  ['Yanal Elayan', '+19012828846', 'yanalelayan2@gmail.com'],
  ['Thomas Mcknight', '+16614453943', 'thomasmcknight96@hotmail.com'],
  ['Lauren Johns', '+15125478683', 'laurenkristynik@gmail.com'],
  ['A C', '+17733434271', 'midamerica.invest@gmail.com'],
  ['Joshua Dandrea', '+19048019000', 'dandrea.jawshh@gmail.com'],
];

async function findBuyerProfile(phone: string, email: string): Promise<{ id: string; data: Record<string, unknown> } | null> {
  // Try phone first
  const phoneSnapshot = await db.collection('buyerProfiles')
    .where('phone', '==', phone)
    .limit(1)
    .get();

  if (!phoneSnapshot.empty) {
    return { id: phoneSnapshot.docs[0].id, data: phoneSnapshot.docs[0].data() as Record<string, unknown> };
  }

  // Try email
  const emailSnapshot = await db.collection('buyerProfiles')
    .where('email', '==', email.toLowerCase().trim())
    .limit(1)
    .get();

  if (!emailSnapshot.empty) {
    return { id: emailSnapshot.docs[0].id, data: emailSnapshot.docs[0].data() as Record<string, unknown> };
  }

  return null;
}

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  CLEANUP: "Lost/not int" Leads from Referral System`);
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE (applying changes)'}`);
  console.log(`  Leads to process: ${NOT_INTERESTED_LEADS.length}`);
  console.log(`${'='.repeat(60)}\n`);

  let found = 0;
  let alreadyInactive = 0;
  let deactivated = 0;
  let agreementsVoided = 0;
  let notFound = 0;

  for (const [name, phone, email] of NOT_INTERESTED_LEADS) {
    const buyer = await findBuyerProfile(phone, email);

    if (!buyer) {
      console.log(`  [ SKIP ] ${name} (${phone}) — no buyer profile found`);
      notFound++;
      continue;
    }

    found++;
    const isAlreadyInactive = buyer.data.isActive === false || buyer.data.isAvailableForPurchase === false;

    if (isAlreadyInactive) {
      console.log(`  [  OK  ] ${name} (${buyer.id}) — already inactive`);
      alreadyInactive++;
    } else {
      console.log(`  [ FIX  ] ${name} (${buyer.id}) — active, needs deactivation`);
      deactivated++;

      if (!DRY_RUN) {
        await db.collection('buyerProfiles').doc(buyer.id).update({
          isAvailableForPurchase: false,
          isActive: false,
          optedOutAt: new Date(),
          optOutReason: 'not_interested',
          optOutSource: 'ghl_lost_not_int_cleanup',
          updatedAt: new Date(),
        });
      }
    }

    // Check for active referral agreements
    const agreementsSnapshot = await db.collection('referralAgreements')
      .where('buyerId', '==', buyer.id)
      .where('status', 'in', ['pending', 'signed'])
      .get();

    if (!agreementsSnapshot.empty) {
      for (const doc of agreementsSnapshot.docs) {
        const agreement = doc.data();
        console.log(`  [ VOID ] Agreement ${agreement.agreementNumber || doc.id} (status: ${agreement.status}) for ${name}`);
        agreementsVoided++;

        if (!DRY_RUN) {
          await db.collection('referralAgreements').doc(doc.id).update({
            status: 'voided',
            voidedAt: new Date(),
            voidReason: 'Buyer marked as Lost/not interested in GHL',
            voidSource: 'ghl_lost_not_int_cleanup',
            updatedAt: new Date(),
          });
        }
      }
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  RESULTS`);
  console.log(`${'='.repeat(60)}`);
  console.log(`  Total leads:            ${NOT_INTERESTED_LEADS.length}`);
  console.log(`  Found in Firestore:     ${found}`);
  console.log(`  Not found:              ${notFound}`);
  console.log(`  Already inactive:       ${alreadyInactive}`);
  console.log(`  Deactivated:            ${deactivated}`);
  console.log(`  Agreements voided:      ${agreementsVoided}`);
  console.log(`  Mode:                   ${DRY_RUN ? 'DRY RUN (no changes made)' : 'LIVE (changes applied)'}`);

  if (DRY_RUN && (deactivated > 0 || agreementsVoided > 0)) {
    console.log(`\n  Run with --fix to apply changes.`);
  }
  console.log('');
}

main().catch(console.error);
