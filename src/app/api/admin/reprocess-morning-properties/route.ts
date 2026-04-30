import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/scraper-v2/firebase-admin';
import { runDetailScraper } from '@/lib/scraper-v2/apify-client';
import { runUnifiedFilter } from '@/lib/scraper-v2/unified-filter';

/**
 * Re-process properties scraped this morning through the updated system
 * POST /api/admin/reprocess-morning-properties
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const adminSecret = process.env.ADMIN_SECRET_KEY || process.env.CRON_SECRET;

  if (!adminSecret || authHeader !== `Bearer ${adminSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('REPROCESS MORNING: Re-processing properties scraped this morning with full details');

    const { db } = getFirebaseAdmin();
    
    // Get all properties with newZipCodeScrape flag (from this morning)
    const morningProperties = await db.collection('properties')
      .where('newZipCodeScrape', '==', true)
      .get();

    console.log(`Found ${morningProperties.size} properties scraped this morning`);

    if (morningProperties.size === 0) {
      return NextResponse.json({
        success: true,
        message: 'No properties found that were scraped this morning',
        processed: 0
      });
    }

    // Group properties by their existing detail URLs or construct proper ones
    const detailUrls = [];
    const propertyMap = new Map();

    morningProperties.docs.forEach(doc => {
      const data = doc.data();
      if (data.zpid) {
        // Use existing detailUrl if available, otherwise construct it properly
        let detailUrl = data.detailUrl || data.url;
        if (!detailUrl) {
          // Construct proper Zillow URL - need address info for proper URL
          detailUrl = `https://www.zillow.com/homedetails/${data.address?.replace(/[^a-zA-Z0-9]/g, '-') || 'property'}-${data.zpid}_zpid/`;
        }
        
        detailUrls.push(detailUrl);
        propertyMap.set(String(data.zpid), { id: doc.id, data, url: detailUrl });
      }
    });

    console.log(`Processing ${detailUrls.length} properties for detailed scraping`);
    console.log(`Sample URLs:`, detailUrls.slice(0, 3));

    // Run detail scraper to get full property info with agent details
    console.log('Running detail scraper to get agent contact information...');
    const detailedProperties = await runDetailScraper(detailUrls, {
      timeoutSecs: 600
    });

    console.log(`Detail scraper returned ${detailedProperties.length} properties`);

    const batch = db.batch();
    let updated = 0;
    let addedToAgentOutreach = 0;
    let qualifiedOwnerFinance = 0;
    let qualifiedCashDeals = 0;

    // Process each detailed property
    for (const detailedProp of detailedProperties) {
      const zpid = detailedProp.zpid;
      const existingProperty = propertyMap.get(String(zpid));
      
      if (!existingProperty) continue;

      // Run unified filter on the detailed property
      const filterResult = runUnifiedFilter(
        detailedProp.description || '',
        typeof detailedProp.price === 'string' ? parseFloat(detailedProp.price) : detailedProp.price,
        detailedProp.zestimate,
        detailedProp.homeType,
        {
          isAuction: detailedProp.isAuction,
          isForeclosure: detailedProp.isForeclosure,
          isBankOwned: detailedProp.isBankOwned
        }
      );

      // Update property with detailed information
      const updatedProperty = {
        ...existingProperty.data,
        // Add detailed property information
        description: detailedProp.description || existingProperty.data.description,
        agentName: detailedProp.agentName,
        agentPhone: detailedProp.agentPhone,
        agentEmail: detailedProp.agentEmail,
        brokerName: detailedProp.brokerName,
        brokerPhone: detailedProp.brokerPhone,
        
        // Add unified filter results
        isOwnerfinance: filterResult.isOwnerfinance,
        isCashDeal: filterResult.isCashDeal,
        dealTypes: filterResult.dealTypes,
        
        // Metadata from filter
        ownerFinanceKeywords: filterResult.ownerFinanceKeywords,
        primaryOwnerfinanceKeyword: filterResult.primaryOwnerfinanceKeyword,
        financingType: filterResult.financingType,
        cashDealReason: filterResult.cashDealReason,
        discountPercentage: filterResult.discountPercentage,
        eightyPercentOfZestimate: filterResult.eightyPercentOfZestimate,
        needsWork: filterResult.needsWork,
        needsWorkKeywords: filterResult.needsWorkKeywords,
        
        // Processing flags
        reprocessedWithDetails: true,
        reprocessedAt: new Date().toISOString(),
        hasAgentDetails: !!(detailedProp.agentPhone || detailedProp.agentEmail)
      };

      // Count qualified properties
      if (filterResult.isOwnerfinance) qualifiedOwnerFinance++;
      if (filterResult.isCashDeal) qualifiedCashDeals++;

      // Add to agent outreach queue if has agent info and qualifies
      if ((detailedProp.agentPhone || detailedProp.agentEmail) && (filterResult.isOwnerfinance || filterResult.isCashDeal)) {
        const agentOutreachDoc = {
          zpid: zpid,
          address: detailedProp.address || existingProperty.data.address,
          city: detailedProp.city || existingProperty.data.city,
          state: detailedProp.state || existingProperty.data.state,
          price: detailedProp.price || existingProperty.data.price,
          zestimate: detailedProp.zestimate || existingProperty.data.zestimate,
          agentPhone: detailedProp.agentPhone,
          agentEmail: detailedProp.agentEmail,
          agentName: detailedProp.agentName,
          brokerName: detailedProp.brokerName,
          brokerPhone: detailedProp.brokerPhone,
          dealType: filterResult.isOwnerfinance ? 'owner_finance' : 'cash_deal',
          isOwnerfinance: filterResult.isOwnerfinance,
          isCashDeal: filterResult.isCashDeal,
          addedAt: new Date(),
          status: 'pending',
          source: 'morning_reprocess'
        };

        // Clean undefined values
        const cleanAgentDoc = Object.fromEntries(
          Object.entries(agentOutreachDoc).filter(([_, value]) => value !== undefined)
        );

        batch.set(db.collection('agent_outreach_queue').doc(), cleanAgentDoc);
        addedToAgentOutreach++;
      }

      // Clean undefined values and update property
      const cleanProperty = Object.fromEntries(
        Object.entries(updatedProperty).filter(([_, value]) => value !== undefined)
      );

      batch.update(db.collection('properties').doc(existingProperty.id), cleanProperty);
      updated++;

      // Commit every 400 operations
      if (updated % 400 === 0) {
        await batch.commit();
      }
    }

    // Commit remaining updates
    if (updated % 400 !== 0) {
      await batch.commit();
    }

    console.log(`REPROCESS COMPLETE: ${updated} properties updated, ${addedToAgentOutreach} added to agent outreach`);

    return NextResponse.json({
      success: true,
      propertiesFound: morningProperties.size,
      propertiesUpdated: updated,
      qualifiedOwnerFinance,
      qualifiedCashDeals,
      addedToAgentOutreach,
      message: `Successfully reprocessed ${updated} morning properties with full details. ${addedToAgentOutreach} properties with agent info added to outreach queue.`
    });

  } catch (error: any) {
    console.error('Reprocess morning properties error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}