/**
 * Test GRM (Gross Rent Multiplier) as a fallback estimate
 *
 * GRM = Price / Annual Rent
 * Estimated Value = Annual Rent × Average GRM
 */

import { getAdminDb } from '../src/lib/firebase-admin';

async function main() {
  const db = await getAdminDb();
  if (!db) {
    console.error('Failed to get database');
    return;
  }

  // Get 50 properties that have BOTH zestimate AND rentEstimate
  const withBoth = await db.collection('cash_houses')
    .where('zestimate', '>', 0)
    .limit(200)
    .get();

  const propertiesWithBoth = withBoth.docs.filter(doc => {
    const data = doc.data();
    return data.rentEstimate && data.rentEstimate > 0 && data.zestimate && data.zestimate > 0;
  }).slice(0, 50);

  console.log(`=== TESTING GRM-BASED ESTIMATE ON ${propertiesWithBoth.length} PROPERTIES ===\n`);

  if (propertiesWithBoth.length === 0) {
    console.log('No properties found with both zestimate and rentEstimate');
    return;
  }

  const results: Array<{
    address: string;
    price: number;
    zestimate: number;
    rentEstimate: number;
    actualGRM: number;
  }> = [];

  for (const doc of propertiesWithBoth) {
    const data = doc.data();
    const annualRent = data.rentEstimate * 12;
    const actualGRM = data.zestimate / annualRent;

    results.push({
      address: `${data.streetAddress || data.address}, ${data.city} ${data.state}`,
      price: data.price,
      zestimate: data.zestimate,
      rentEstimate: data.rentEstimate,
      actualGRM: Math.round(actualGRM * 10) / 10,
    });
  }

  // Calculate average GRM
  const grms = results.map(r => r.actualGRM);
  const avgGRM = Math.round(grms.reduce((a, b) => a + b, 0) / grms.length * 10) / 10;
  const medianGRM = grms.sort((a, b) => a - b)[Math.floor(grms.length / 2)];
  const minGRM = Math.min(...grms);
  const maxGRM = Math.max(...grms);

  console.log('GRM STATISTICS (Zestimate / Annual Rent):');
  console.log('==========================================');
  console.log(`Average GRM: ${avgGRM}`);
  console.log(`Median GRM: ${medianGRM}`);
  console.log(`Range: ${minGRM} - ${maxGRM}`);

  // Test how accurate GRM-based estimate would be
  console.log('\n\nACCURACY TEST: Using average GRM to estimate value');
  console.log('===================================================');

  let within10 = 0;
  let within20 = 0;
  let within30 = 0;

  const testResults: Array<{
    address: string;
    zestimate: number;
    grmEstimate: number;
    accuracy: number;
  }> = [];

  for (const r of results) {
    const annualRent = r.rentEstimate * 12;
    const grmEstimate = Math.round(annualRent * avgGRM);
    const accuracy = Math.round((grmEstimate / r.zestimate) * 100);

    testResults.push({
      address: r.address,
      zestimate: r.zestimate,
      grmEstimate,
      accuracy,
    });

    if (accuracy >= 90 && accuracy <= 110) within10++;
    if (accuracy >= 80 && accuracy <= 120) within20++;
    if (accuracy >= 70 && accuracy <= 130) within30++;
  }

  console.log(`\nUsing GRM of ${avgGRM}:`);
  console.log(`Within 10% of zestimate: ${within10}/${results.length} (${Math.round(within10 / results.length * 100)}%)`);
  console.log(`Within 20% of zestimate: ${within20}/${results.length} (${Math.round(within20 / results.length * 100)}%)`);
  console.log(`Within 30% of zestimate: ${within30}/${results.length} (${Math.round(within30 / results.length * 100)}%)`);

  // Show sample comparisons
  console.log('\nSample comparisons:');
  testResults.slice(0, 15).forEach(r => {
    const indicator = r.accuracy >= 90 && r.accuracy <= 110 ? '✓' : r.accuracy >= 80 && r.accuracy <= 120 ? '~' : '✗';
    console.log(`${indicator} ${r.address.slice(0, 32).padEnd(32)} | Zest: $${r.zestimate.toLocaleString().padStart(8)} | GRM Est: $${r.grmEstimate.toLocaleString().padStart(8)} | ${r.accuracy}%`);
  });

  // Also test with median GRM
  console.log(`\n\nUsing MEDIAN GRM of ${medianGRM}:`);

  let within10m = 0;
  let within20m = 0;
  let within30m = 0;

  for (const r of results) {
    const annualRent = r.rentEstimate * 12;
    const grmEstimate = Math.round(annualRent * medianGRM);
    const accuracy = Math.round((grmEstimate / r.zestimate) * 100);

    if (accuracy >= 90 && accuracy <= 110) within10m++;
    if (accuracy >= 80 && accuracy <= 120) within20m++;
    if (accuracy >= 70 && accuracy <= 130) within30m++;
  }

  console.log(`Within 10% of zestimate: ${within10m}/${results.length} (${Math.round(within10m / results.length * 100)}%)`);
  console.log(`Within 20% of zestimate: ${within20m}/${results.length} (${Math.round(within20m / results.length * 100)}%)`);
  console.log(`Within 30% of zestimate: ${within30m}/${results.length} (${Math.round(within30m / results.length * 100)}%)`);

  // Recommendation
  console.log('\n\n=== RECOMMENDATION ===');
  const bestWithin20 = Math.max(
    Math.round(within20 / results.length * 100),
    Math.round(within20m / results.length * 100)
  );

  if (bestWithin20 >= 60) {
    console.log(`✓ GRM-based estimate is USABLE as fallback`);
    console.log(`  Formula: estimatedValue = rentEstimate × 12 × ${avgGRM}`);
    console.log(`  Accuracy: ~${bestWithin20}% of properties within 20% of zestimate`);
  } else if (bestWithin20 >= 40) {
    console.log(`~ GRM-based estimate is MARGINAL as fallback`);
    console.log(`  Only ${bestWithin20}% of properties within 20% accuracy`);
    console.log(`  Consider showing as "Estimated" with disclaimer`);
  } else {
    console.log(`✗ GRM-based estimate is NOT reliable enough`);
    console.log(`  Only ${bestWithin20}% accuracy - too variable`);
  }

  // Check how many properties could benefit from GRM fallback
  console.log('\n=== COVERAGE ANALYSIS ===');
  const noZestimate = await db.collection('cash_houses')
    .where('zestimate', '==', 0)
    .limit(200)
    .get();

  const noZestWithRent = noZestimate.docs.filter(doc => {
    const data = doc.data();
    return data.rentEstimate && data.rentEstimate > 0;
  }).length;

  console.log(`Properties without zestimate: ${noZestimate.docs.length} (sample)`);
  console.log(`Of those, have rentEstimate: ${noZestWithRent} (${Math.round(noZestWithRent / noZestimate.docs.length * 100)}%)`);
  console.log(`GRM fallback could cover ~${Math.round(noZestWithRent / noZestimate.docs.length * 100)}% of missing estimates`);
}

main().catch(console.error);
