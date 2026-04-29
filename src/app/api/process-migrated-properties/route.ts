import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/scraper-v2/firebase-admin';
import { runUnifiedFilter } from '@/lib/scraper-v2/unified-filter';
import { transformPropertyForTypesense } from '@/lib/typesense/sync';

export async function POST(request: NextRequest) {
  console.log('PROCESSING MIGRATED: Running unified filter on migrated snapshot properties');
  
  try {
    const { db } = getFirebaseAdmin();
    
    // Find all migrated properties that haven't been processed
    const migratedDocs = await db.collection('properties')
      .where('migratedFromSnapshot', '==', true)
      .get();
    
    console.log(`Found ${migratedDocs.size} migrated properties to process`);
    
    const batch = db.batch();
    let processed = 0;
    let ownerFinance = 0;
    let cashDeals = 0;
    let qualified = 0;
    
    migratedDocs.forEach(doc => {
      const data = doc.data();
      
      // Skip if already processed
      if (data.processedThroughUnifiedFilter === true) {
        return;
      }
      
      // Run unified filter on the property
      const filterResult = runUnifiedFilter(
        data.description,
        data.price,
        data.zestimate,
        data.homeType,
        {
          isAuction: data.isAuction,
          isForeclosure: data.isForeclosure, 
          isBankOwned: data.isBankOwned
        }
      );
      
      // Only update properties that pass at least one filter
      if (filterResult.shouldSave) {
        const updateData = {
          // Unified filter results
          isOwnerfinance: filterResult.isOwnerfinance,
          isCashDeal: filterResult.isCashDeal,
          dealTypes: filterResult.dealTypes,
          
          // Additional filter metadata
          ownerFinanceKeywords: filterResult.ownerFinanceKeywords,
          primaryOwnerfinanceKeyword: filterResult.primaryOwnerfinanceKeyword,
          financingType: filterResult.financingType,
          
          cashDealReason: filterResult.cashDealReason,
          discountPercentage: filterResult.discountPercentage,
          eightyPercentOfZestimate: filterResult.eightyPercentOfZestimate,
          needsWork: filterResult.needsWork,
          needsWorkKeywords: filterResult.needsWorkKeywords,
          
          isFixer: filterResult.isFixer,
          isLand: filterResult.isLand,
          suspiciousDiscount: filterResult.suspiciousDiscount,
          
          // Processing flags
          processedThroughUnifiedFilter: true,
          processedAt: new Date().toISOString(),
          isActive: true // Make properties visible on website
        };
        
        // Apply clean filter for undefined values
        const cleanUpdateData = Object.fromEntries(
          Object.entries(updateData).filter(([_, value]) => value !== undefined)
        );
        
        batch.update(doc.ref, cleanUpdateData);
        qualified++;
        
        if (filterResult.isOwnerfinance) ownerFinance++;
        if (filterResult.isCashDeal) cashDeals++;
      } else {
        // Property doesn't qualify - mark as processed but inactive
        batch.update(doc.ref, {
          processedThroughUnifiedFilter: true,
          processedAt: new Date().toISOString(),
          isActive: false,
          noQualifyingDeals: true
        });
      }
      
      processed++;
      
      // Commit in batches of 400
      if (processed % 400 === 0) {
        // Note: Need to await this in a real implementation
        batch.commit();
      }
    });
    
    // Commit remaining
    if (processed % 400 !== 0) {
      await batch.commit();
    }
    
    console.log(`Processing complete:
      - Processed: ${processed}
      - Qualified: ${qualified}
      - Owner Finance: ${ownerFinance}
      - Cash Deals: ${cashDeals}
      - Active on website: ${qualified}
    `);
    
    return NextResponse.json({
      success: true,
      processed,
      qualified,
      ownerFinance,
      cashDeals,
      message: `Successfully processed ${processed} migrated properties. ${qualified} are now active on the website.`
    });
    
  } catch (error: any) {
    console.error('Processing error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}