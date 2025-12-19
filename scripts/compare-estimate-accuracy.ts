/**
 * Compare alternative estimate sources against Zestimate
 * to determine which can be used as reliable fallbacks
 */

import { getAdminDb } from '../src/lib/firebase-admin';

interface EstimateComparison {
  zpid: string;
  address: string;
  price: number;
  zestimate: number;
  taxAssessedValue: number | null;
  lastSoldPrice: number | null;
  lastSoldDate: string | null;
  rentEstimate: number | null;
  annualTax: number | null;
  // Calculated
  taxToZestRatio: number | null;
  soldToZestRatio: number | null;
  priceToRentRatio: number | null;
}

async function main() {
  const db = await getAdminDb();
  if (!db) {
    console.error('Failed to get database');
    return;
  }

  // Get 50 properties WITH zestimate for comparison
  const withZestimate = await db.collection('cash_houses')
    .where('zestimate', '>', 0)
    .limit(50)
    .get();

  console.log(`=== ANALYZING ${withZestimate.docs.length} PROPERTIES WITH ZESTIMATE ===\n`);

  const comparisons: EstimateComparison[] = [];

  for (const doc of withZestimate.docs) {
    const data = doc.data();

    // Extract tax assessed value from taxHistory if available
    let taxAssessedValue: number | null = null;
    if (data.taxHistory && Array.isArray(data.taxHistory) && data.taxHistory.length > 0) {
      const latestTax = data.taxHistory[0];
      taxAssessedValue = latestTax.value || latestTax.taxAssessedValue || null;
    }

    // Try to calculate from annual tax (typical effective rate is 1-2%)
    // If annualTax = $3000 and rate = 1.5%, then assessed value ≈ $200,000
    let estimatedFromTax: number | null = null;
    const annualTax = data.annualTaxAmount || data.taxAmount || null;
    if (annualTax && annualTax > 0) {
      // Use 1.2% as typical effective tax rate (US average)
      estimatedFromTax = Math.round(annualTax / 0.012);
    }

    // Extract last sold price from priceHistory if available
    let lastSoldPrice: number | null = null;
    let lastSoldDate: string | null = null;
    if (data.priceHistory && Array.isArray(data.priceHistory)) {
      const soldEntries = data.priceHistory.filter((p: any) =>
        p.event === 'Sold' || p.event === 'Listed for sale'
      );
      if (soldEntries.length > 0) {
        lastSoldPrice = soldEntries[0].price || null;
        lastSoldDate = soldEntries[0].date || null;
      }
    }

    const comparison: EstimateComparison = {
      zpid: data.zpid?.toString() || doc.id,
      address: `${data.streetAddress || data.address || 'Unknown'}, ${data.city} ${data.state}`,
      price: data.price || data.listPrice || 0,
      zestimate: data.zestimate || data.estimate || 0,
      taxAssessedValue: taxAssessedValue || estimatedFromTax,
      lastSoldPrice,
      lastSoldDate,
      rentEstimate: data.rentEstimate || data.rentZestimate || null,
      annualTax,
      // Calculate ratios
      taxToZestRatio: null,
      soldToZestRatio: null,
      priceToRentRatio: null,
    };

    // Calculate ratios for accuracy assessment
    if (comparison.taxAssessedValue && comparison.zestimate > 0) {
      comparison.taxToZestRatio = Math.round((comparison.taxAssessedValue / comparison.zestimate) * 100);
    }
    if (comparison.lastSoldPrice && comparison.zestimate > 0) {
      comparison.soldToZestRatio = Math.round((comparison.lastSoldPrice / comparison.zestimate) * 100);
    }
    if (comparison.rentEstimate && comparison.price > 0) {
      comparison.priceToRentRatio = Math.round((comparison.price / (comparison.rentEstimate * 12)) * 10) / 10;
    }

    comparisons.push(comparison);
  }

  // Analyze results
  console.log('=== FIELD AVAILABILITY ===');
  const withTaxValue = comparisons.filter(c => c.taxAssessedValue !== null);
  const withSoldPrice = comparisons.filter(c => c.lastSoldPrice !== null);
  const withRentEstimate = comparisons.filter(c => c.rentEstimate !== null);

  console.log(`Tax-based estimate available: ${withTaxValue.length}/${comparisons.length}`);
  console.log(`Last sold price available: ${withSoldPrice.length}/${comparisons.length}`);
  console.log(`Rent estimate available: ${withRentEstimate.length}/${comparisons.length}`);

  // Analyze tax-based estimate accuracy
  if (withTaxValue.length > 0) {
    console.log('\n=== TAX-BASED ESTIMATE VS ZESTIMATE ===');
    const taxRatios = withTaxValue.map(c => c.taxToZestRatio!);
    const avgTaxRatio = Math.round(taxRatios.reduce((a, b) => a + b, 0) / taxRatios.length);
    const minTaxRatio = Math.min(...taxRatios);
    const maxTaxRatio = Math.max(...taxRatios);

    console.log(`Average tax/zestimate ratio: ${avgTaxRatio}%`);
    console.log(`Range: ${minTaxRatio}% - ${maxTaxRatio}%`);

    // Distribution
    const within10 = taxRatios.filter(r => r >= 90 && r <= 110).length;
    const within20 = taxRatios.filter(r => r >= 80 && r <= 120).length;
    const within30 = taxRatios.filter(r => r >= 70 && r <= 130).length;

    console.log(`Within 10% of zestimate: ${within10}/${withTaxValue.length} (${Math.round(within10 / withTaxValue.length * 100)}%)`);
    console.log(`Within 20% of zestimate: ${within20}/${withTaxValue.length} (${Math.round(within20 / withTaxValue.length * 100)}%)`);
    console.log(`Within 30% of zestimate: ${within30}/${withTaxValue.length} (${Math.round(within30 / withTaxValue.length * 100)}%)`);

    // Show some examples
    console.log('\nSample comparisons:');
    withTaxValue.slice(0, 10).forEach(c => {
      console.log(`  ${c.address.slice(0, 35).padEnd(35)} | Zest: $${c.zestimate.toLocaleString().padStart(8)} | Tax-based: $${c.taxAssessedValue!.toLocaleString().padStart(8)} | Ratio: ${c.taxToZestRatio}%`);
    });
  }

  // Analyze price/rent ratio (GRM - Gross Rent Multiplier)
  if (withRentEstimate.length > 0) {
    console.log('\n=== PRICE TO RENT ANALYSIS (GRM) ===');
    const grms = withRentEstimate.map(c => c.priceToRentRatio!);
    const avgGRM = Math.round(grms.reduce((a, b) => a + b, 0) / grms.length * 10) / 10;

    console.log(`Average GRM (price / annual rent): ${avgGRM}`);
    console.log('(GRM of 8-12 is typical for investment properties)');
    console.log('(If GRM < 8, property may be undervalued; if > 15, may be overvalued)');
  }

  // Summary recommendation
  console.log('\n=== RECOMMENDATIONS ===');

  if (withTaxValue.length > 0) {
    const taxRatios = withTaxValue.map(c => c.taxToZestRatio!);
    const avgTaxRatio = Math.round(taxRatios.reduce((a, b) => a + b, 0) / taxRatios.length);

    if (avgTaxRatio >= 70 && avgTaxRatio <= 130) {
      console.log(`✓ Tax-based estimate can be used as fallback (avg ${avgTaxRatio}% of zestimate)`);
      console.log(`  Adjustment factor: multiply by ${Math.round(100 / avgTaxRatio * 100) / 100} to approximate zestimate`);
    } else {
      console.log(`✗ Tax-based estimate too far from zestimate (avg ${avgTaxRatio}%)`);
    }
  }
}

main().catch(console.error);
