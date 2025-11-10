/**
 * Check which recovered workflows have generic captions and need fixing
 */

import { db } from '../src/lib/firebase';
import { collection, query, where, getDocs, orderBy, limit as firestoreLimit } from 'firebase/firestore';
import { getBenefitById, generateBenefitCaption, generateBenefitTitle } from '../src/lib/benefit-content';

async function checkRecoveredCaptions() {
  console.log('🔍 Checking recovered workflows with generic captions...\n');

  try {
    // Query recent benefit workflows that were completed or posting
    // Note: Cannot use where + orderBy without index, so just get all completed
    const q = query(
      collection(db, 'benefit_workflow_queue'),
      where('status', 'in', ['completed', 'posting']),
      firestoreLimit(50)
    );

    const snapshot = await getDocs(q);
    console.log(`📦 Found ${snapshot.size} completed workflows\n`);

    const genericCaption = 'Learn about owner financing! 🏡';
    let foundGeneric = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();

      // Check if using generic caption
      if (data.caption === genericCaption) {
        foundGeneric++;

        console.log('━'.repeat(80));
        console.log(`❌ GENERIC CAPTION FOUND`);
        console.log(`ID: ${doc.id}`);
        console.log(`Benefit Title: ${data.benefitTitle || 'MISSING'}`);
        console.log(`Benefit ID: ${data.benefitId || 'MISSING'}`);
        console.log(`Audience: ${data.audience || 'MISSING'}`);
        console.log(`Completed: ${new Date(data.completedAt || 0).toLocaleString()}`);
        console.log(`Late Post ID: ${data.latePostId || 'MISSING'}`);

        console.log(`\nCurrent Caption: "${data.caption}"`);
        console.log(`Current Title: "${data.title || 'MISSING'}"`);

        // Generate what the caption SHOULD be
        if (data.benefitId) {
          const benefit = getBenefitById(data.benefitId);
          if (benefit) {
            const correctCaption = generateBenefitCaption(benefit);
            const correctTitle = generateBenefitTitle(benefit);

            console.log(`\n✅ SHOULD BE:`);
            console.log(`Caption: ${correctCaption.substring(0, 150)}...`);
            console.log(`Title: ${correctTitle}`);
          } else {
            console.log(`\n⚠️  Benefit ID not found in library`);
          }
        } else {
          console.log(`\n⚠️  No benefit ID - cannot generate proper caption`);
        }
        console.log('');
      }
    }

    console.log('━'.repeat(80));
    console.log(`\n📊 SUMMARY`);
    console.log(`Total completed workflows checked: ${snapshot.size}`);
    console.log(`Using generic caption: ${foundGeneric}`);
    console.log(`Using proper captions: ${snapshot.size - foundGeneric}`);

    if (foundGeneric > 0) {
      console.log(`\n⚠️  ${foundGeneric} workflows were posted with generic captions`);
      console.log(`   The videos are already posted on social media and cannot be easily updated.`);
      console.log(`   Future recoveries will now use proper captions.`);
    } else {
      console.log(`\n✅ All workflows have proper captions!`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkRecoveredCaptions().catch(error => {
  console.error('\n❌ Script error:', error);
  process.exit(1);
});
