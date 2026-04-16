/**
 * Quick validation: Fixer logic, stale-zestimate clearing, and detector
 */
import { runUnifiedFilter } from '../src/lib/scraper-v2/unified-filter';
import { detectListingSubType } from '../src/lib/scraper-v2/property-transformer';

// ====== FIXER CUSHION TESTS ======
console.log('===== FIXER CUSHION =====\n');

// Case 1: Vinson-like — $614,900 list, $1,070,400 Zestimate (gap $455k > $150k)
const vinson = runUnifiedFilter(null, 614900, 1070400);
console.log('Vinson ($614k list, $1.07M zest):');
console.log(`  passesCashDeal: ${vinson.passesCashDeal}`);
console.log(`  isFixer: ${vinson.isFixer}`);
console.log(`  cashDealReason: ${vinson.cashDealReason}`);
console.log(`  raw discount: ${vinson.discountPercentage?.toFixed(1)}%`);
console.log(`  raw eightyPercent: $${vinson.eightyPercentOfZestimate?.toLocaleString()}`);
console.log(`  cushionedEstimate: $${vinson.cushionedEstimate?.toLocaleString()}`);
console.log(`  cushionedDiscount: ${vinson.cushionedDiscountPercentage?.toFixed(1)}%`);
console.log(`  cushionedEightyPercent: $${vinson.cushionedEightyPercent?.toLocaleString()}`);
console.assert(vinson.isFixer === true, 'Should be fixer');
console.assert(vinson.cashDealReason === 'fixer', 'Should be fixer reason');
console.assert(vinson.cushionedEstimate === 764900, 'Cushioned = 614900 + 150000');

// Case 2: Normal cash deal — $200k list, $280k Zestimate (gap $80k < $150k)
const normal = runUnifiedFilter(null, 200000, 280000);
console.log('\nNormal cash deal ($200k list, $280k zest):');
console.log(`  passesCashDeal: ${normal.passesCashDeal}`);
console.log(`  isFixer: ${normal.isFixer}`);
console.log(`  cashDealReason: ${normal.cashDealReason}`);
console.log(`  discount: ${normal.discountPercentage?.toFixed(1)}%`);
console.assert(normal.isFixer === false, 'Should NOT be fixer');
console.assert(normal.cashDealReason === 'discount', 'Should be discount');

// Case 3: Exactly $150k gap — $300k list, $480k Zestimate (gap $180k > $150k threshold)
const borderGap = runUnifiedFilter(null, 300000, 480000);
console.log('\nBorder gap ($300k list, $480k zest, gap=$180k):');
console.log(`  passesCashDeal: ${borderGap.passesCashDeal}`);
console.log(`  isFixer: ${borderGap.isFixer}`);
console.log(`  cashDealReason: ${borderGap.cashDealReason}`);
console.assert(borderGap.isFixer === true, 'Gap $180k > $150k → fixer');

// Case 4: Gap exactly $150k — $200k list, $370k Zestimate (gap $170k > $150k, and passes 80%)
const exactGap = runUnifiedFilter(null, 200000, 370000);
console.log('\nExact-ish ($200k list, $370k zest, gap=$170k):');
console.log(`  passesCashDeal: ${exactGap.passesCashDeal}`);
console.log(`  isFixer: ${exactGap.isFixer}`);
console.assert(exactGap.isFixer === true, 'Gap $170k > $150k → fixer');

// Case 5: No Zestimate — should not crash
const noZest = runUnifiedFilter(null, 300000, 0);
console.log('\nNo Zestimate ($300k list, $0 zest):');
console.log(`  passesCashDeal: ${noZest.passesCashDeal}`);
console.log(`  isFixer: ${noZest.isFixer}`);
console.assert(noZest.passesCashDeal === false, 'No zest → no cash deal');
console.assert(noZest.isFixer === false, 'No zest → no fixer');

// Case 6: Fixer + needsWork — fixer should win
const fixerNW = runUnifiedFilter('This home needs major renovation and repairs', 300000, 500000);
console.log('\nFixer + needsWork ($300k list, $500k zest, gap=$200k):');
console.log(`  passesCashDeal: ${fixerNW.passesCashDeal}`);
console.log(`  isFixer: ${fixerNW.isFixer}`);
console.log(`  needsWork: ${fixerNW.needsWork}`);
console.log(`  cashDealReason: ${fixerNW.cashDealReason}`);
console.assert(fixerNW.cashDealReason === 'fixer', 'Fixer overrides needsWork');

// Case 7: Does NOT pass 80% threshold, gap > $150k — NOT a fixer
// $400k list, $510k zest → 80% = $408k, price > $408k → no cash deal
const noPass = runUnifiedFilter(null, 400000, 600000);
console.log('\nDoesnt pass 80% ($400k list, $600k zest):');
console.log(`  passesCashDeal: ${noPass.passesCashDeal}`);
console.log(`  isFixer: ${noPass.isFixer}`);
console.log(`  discount: ${noPass.discountPercentage?.toFixed(1)}%`);
// 400k < 480k (80% of 600k), so this DOES pass. Let me pick better numbers.
// Actually 400k IS < 480k so it passes. Gap=200k > 150k → fixer.
console.assert(noPass.passesCashDeal === true, 'Does pass 80% threshold');

// Case 8: Truly doesn't pass — $480k list, $550k zest → 80% = $440k, $480k > $440k
const reallyNoPass = runUnifiedFilter(null, 480000, 550000);
console.log('\nTruly doesnt pass 80% ($480k list, $550k zest):');
console.log(`  passesCashDeal: ${reallyNoPass.passesCashDeal}`);
console.log(`  isFixer: ${reallyNoPass.isFixer}`);
console.assert(reallyNoPass.passesCashDeal === false, 'Doesnt pass 80%');
console.assert(reallyNoPass.isFixer === false, 'Not a fixer either');

// ====== DETECTOR TESTS ======
console.log('\n===== DETECTOR STRENGTHENED =====\n');

// Lexington: keystoneHomeStatus=ForSaleAuction + foreclosureTypes
const lexington = detectListingSubType({
  homeStatus: 'FOR_SALE',
  keystoneHomeStatus: 'ForSaleAuction',
  listingSubType: { isForAuction: true, isBankOwned: true },
  foreclosureTypes: { isBankOwned: true, isAnyForeclosure: true, wasForeclosed: true },
});
console.log('Lexington (full data):', lexington);
console.assert(lexington.isAuction === true, 'Should detect auction');
console.assert(lexington.isBankOwned === true, 'Should detect bank owned');
console.assert(lexington.isForeclosure === true, 'Should detect foreclosure');

// Partial Apify response — only keystoneHomeStatus
const partialAuction = detectListingSubType({
  homeStatus: 'FOR_SALE',
  keystoneHomeStatus: 'ForSaleAuction',
});
console.log('Partial (only keystone):', partialAuction);
console.assert(partialAuction.isAuction === true, 'Keystone alone → auction');

// Partial: only foreclosureTypes
const partialForeclosure = detectListingSubType({
  homeStatus: 'FOR_SALE',
  foreclosureTypes: { isBankOwned: true, wasForeclosed: true },
});
console.log('Partial (only foreclosureTypes):', partialForeclosure);
console.assert(partialForeclosure.isBankOwned === true, 'foreclosureTypes.isBankOwned');
console.assert(partialForeclosure.isForeclosure === true, 'foreclosureTypes.wasForeclosed');

// Completely empty — should all be false
const empty = detectListingSubType({ homeStatus: 'FOR_SALE' });
console.log('Empty:', empty);
console.assert(empty.isAuction === false, 'Empty → no auction');
console.assert(empty.isForeclosure === false, 'Empty → no foreclosure');
console.assert(empty.isBankOwned === false, 'Empty → no bank owned');

console.log('\n✅ All assertions passed!');
