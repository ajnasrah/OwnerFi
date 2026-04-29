import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/scraper-v2/firebase-admin';
import { hasStrictOwnerfinancing } from '@/lib/owner-financing-filter-strict';
import { hasNegativeKeywords } from '@/lib/negative-keywords';
import { normalizePhone, isValidPhone } from '@/lib/phone-utils';
import { logger } from '@/lib/structured-logger';

export async function POST(request: NextRequest) {
  logger.info('Starting property queuing for agent outreach', {
    operation: 'queue-properties-for-outreach',
    target: 'GoHighLevel'
  });
  
  try {
    const { db } = getFirebaseAdmin();
    
    // Read all properties that were migrated from snapshot
    const propsCollection = db.collection('properties');
    const migratedProps = await propsCollection
      .where('migratedFromSnapshot', '==', true)
      .where('addedToAgentOutreach', '==', false)
      .get();
    
    logger.info('Found migrated properties for outreach queuing', {
      operation: 'queue-properties-for-outreach',
      propertyCount: migratedProps.size
    });
    
    if (migratedProps.empty) {
      return NextResponse.json({
        success: true,
        message: 'No properties found to queue for agent outreach',
        queued: 0
      });
    }
    
    let batch = db.batch();
    let batchCount = 0;
    const stats = {
      queued: 0,
      skipped: {
        noAgent: 0,
        hasOwnerfinance: 0,
        negativeKeywords: 0,
        invalidPhone: 0,
        alreadyQueued: 0
      }
    };
    
    for (const propDoc of migratedProps.docs) {
      const property = propDoc.data();
      
      // Check if already in agent outreach queue
      const existingQueue = await db.collection('agent_outreach_queue')
        .where('zpid', '==', property.zpid)
        .limit(1)
        .get();
        
      if (!existingQueue.empty) {
        stats.skipped.alreadyQueued++;
        continue;
      }
      
      // Need to extract agent info from rawData if available
      const rawData = property.rawData || property;
      
      // FILTER 1: Check for agent phone
      const agentPhone = rawData.attributionInfo?.agentPhoneNumber
        || rawData.agentPhoneNumber
        || rawData.contactRecipients?.[0]?.phoneNumber
        || rawData.attributionInfo?.brokerPhoneNumber
        || rawData.brokerPhoneNumber;

      if (!agentPhone) {
        stats.skipped.noAgent++;
        continue;
      }

      // FILTER 1b: Validate phone number format
      if (!isValidPhone(agentPhone)) {
        stats.skipped.invalidPhone++;
        continue;
      }

      // FILTER 2: Check keywords
      const description = property.description || rawData.description || '';

      const ownerFinanceResult = hasStrictOwnerfinancing(description);
      const negativeResult = hasNegativeKeywords(description);

      if (ownerFinanceResult.passes) {
        stats.skipped.hasOwnerfinance++;
        continue;
      }

      if (negativeResult.hasNegative) {
        stats.skipped.negativeKeywords++;
        continue;
      }
      
      // Classify deal type
      const price = property.price || rawData.price || 0;
      const zestimate = property.zestimate || rawData.zestimate || 0;
      
      let dealType: 'cash_deal' | 'potential_owner_finance' = 'potential_owner_finance';
      if (zestimate > 0 && price > 0 && (price / zestimate) < 0.80) {
        dealType = 'cash_deal';
      }

      const agentName = rawData.attributionInfo?.agentName
        || rawData.agentName
        || rawData.contactRecipients?.[0]?.displayName
        || 'Agent';
        
      const streetAddr = property.address || rawData.streetAddress || rawData.address?.streetAddress || '';
      const city = property.city || rawData.city || rawData.address?.city || '';
      const state = property.state || rawData.state || rawData.address?.state || '';
      const zipCode = property.zipCode || rawData.zipcode || rawData.address?.zipcode || '';

      const phoneNormalized = normalizePhone(agentPhone);
      const addressNormalized = streetAddr.toLowerCase().trim()
        .replace(/[#,\.]/g, '').replace(/\s+/g, ' ');

      // Build gallery
      const gallery = property.propertyImages || property.imageUrls || rawData.propertyImages || rawData.imageUrls || [];
      const primaryImage = property.imgSrc || property.primaryImage || rawData.imgSrc || rawData.primaryImage || gallery[0] || '';

      // Add to agent outreach queue
      const docRef = db.collection('agent_outreach_queue').doc();
      batch.set(docRef, {
        zpid: property.zpid,
        url: property.url || rawData.url,
        hdpUrl: property.hdpUrl || rawData.hdpUrl || null,
        virtualTourUrl: property.virtualTourUrl || rawData.virtualTourUrl || rawData.thirdPartyVirtualTour?.externalUrl || null,

        // Address
        address: streetAddr,
        city,
        state,
        zipCode,
        county: property.county || rawData.county || null,
        parcelId: property.parcelId || rawData.parcelId || rawData.resoFacts?.parcelNumber || null,
        mlsId: property.mlsId || rawData.attributionInfo?.mlsId || rawData.mlsid || null,

        // Pricing + estimates
        price,
        zestimate,
        rentZestimate: property.rentZestimate || rawData.rentZestimate || rawData.rentEstimate || null,
        priceToZestimateRatio: zestimate > 0 ? price / zestimate : null,

        // Structural details
        beds: property.beds || rawData.bedrooms || 0,
        baths: property.baths || rawData.bathrooms || 0,
        squareFeet: property.squareFeet || rawData.livingArea || rawData.livingAreaValue || rawData.squareFoot || 0,
        lotSize: property.lotSize || rawData.lotAreaValue || rawData.lotSize || rawData.lotSquareFoot || null,
        yearBuilt: property.yearBuilt || rawData.yearBuilt || null,
        propertyType: property.propertyType || rawData.homeType || rawData.propertyType || 'SINGLE_FAMILY',
        daysOnZillow: property.daysOnZillow || rawData.daysOnZillow || null,
        homeStatus: property.homeStatus || rawData.homeStatus || null,
        keystoneHomeStatus: property.keystoneHomeStatus || rawData.keystoneHomeStatus || null,

        // Location
        latitude: property.latitude || rawData.latitude || null,
        longitude: property.longitude || rawData.longitude || null,

        // Costs
        hoa: property.hoa || rawData.monthlyHoaFee || rawData.hoaFee || rawData.hoa || 0,
        annualTaxAmount: property.annualTaxAmount || rawData.annualTaxAmount || null,
        propertyTaxRate: property.propertyTaxRate || rawData.propertyTaxRate || null,
        annualHomeownersInsurance: property.annualHomeownersInsurance || rawData.annualHomeownersInsurance || null,

        // Description
        description: description || '',

        // Agent / broker
        agentName,
        agentPhone,
        agentEmail: rawData.attributionInfo?.agentEmail || rawData.agentEmail || null,
        brokerName: rawData.attributionInfo?.brokerName || rawData.brokerName || null,
        brokerPhone: rawData.attributionInfo?.brokerPhoneNumber || rawData.brokerPhoneNumber || rawData.brokerPhone || null,

        // Images
        imgSrc: primaryImage || null,
        firstPropertyImage: primaryImage || null,
        primaryImage: primaryImage || null,
        hiResImageLink: property.hiResImageLink || rawData.hiResImageLink || null,
        mediumImageLink: property.mediumImageLink || rawData.mediumImageLink || null,
        desktopWebHdpImageLink: property.desktopWebHdpImageLink || rawData.desktopWebHdpImageLink || null,
        propertyImages: Array.isArray(gallery) && gallery.length > 0 ? gallery : null,
        imageUrls: Array.isArray(gallery) && gallery.length > 0 ? gallery : null,
        photoCount: property.photoCount || rawData.photoCount || (Array.isArray(gallery) ? gallery.length : null) || null,

        // Dedupe + routing
        phoneNormalized,
        addressNormalized,
        dealType,
        status: 'pending',
        source: 'migrated_snapshot_properties',
        addedAt: new Date(),

        // Store original property doc ID for reference
        originalPropertyId: propDoc.id,
        rawData: rawData,
      });
      
      // Mark original property as added to agent outreach
      batch.update(propDoc.ref, {
        addedToAgentOutreach: true,
        addedToAgentOutreachAt: new Date()
      });

      batchCount += 2; // Two operations per property
      stats.queued++;

      if (batchCount >= 48) { // Leave room for 2 operations per property
        await batch.commit();
        logger.info('Committed batch during outreach queuing', {
          operation: 'queue-properties-for-outreach',
          queuedSoFar: stats.queued
        });
        batch = db.batch();
        batchCount = 0;
      }
    }

    // Commit remaining
    if (batchCount > 0) {
      await batch.commit();
    }

    logger.info('Completed property queuing for agent outreach', {
      operation: 'queue-properties-for-outreach',
      status: 'completed',
      stats: {
        queued: stats.queued,
        skipped: {
          noAgent: stats.skipped.noAgent,
          invalidPhone: stats.skipped.invalidPhone,
          hasOwnerfinance: stats.skipped.hasOwnerfinance,
          negativeKeywords: stats.skipped.negativeKeywords,
          alreadyQueued: stats.skipped.alreadyQueued
        }
      }
    });

    return NextResponse.json({
      success: true,
      queued: stats.queued,
      skipped: stats.skipped,
      message: `Successfully queued ${stats.queued} properties for agent outreach`
    });
    
  } catch (error: any) {
    logger.error('Failed to queue properties for agent outreach', {
      operation: 'queue-properties-for-outreach',
      error: error.message,
      stack: error.stack
    });
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}