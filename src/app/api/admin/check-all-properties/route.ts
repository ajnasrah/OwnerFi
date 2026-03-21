import { NextRequest, NextResponse } from 'next/server';
import { ApifyClient } from 'apify-client';
import { getFirebaseAdmin } from '@/lib/scraper-v2/firebase-admin';
import { sanitizeDescription } from '@/lib/description-sanitizer';
import { hasStrictOwnerfinancing } from '@/lib/owner-financing-filter-strict';

/**
 * Admin endpoint to check ALL properties against Zillow.
 * No freshness skip, no cron lock — processes a batch and returns remaining count.
 * Call repeatedly until remaining === 0.
 *
 * Query params:
 *   batchSize: number of properties per call (default 50, max 100)
 *
 * Usage:
 *   curl -X POST "https://ownerfi.com/api/admin/check-all-properties?batchSize=50" \
 *     -H "Authorization: Bearer $CRON_SECRET"
 */

interface ZillowApifyItem {
  zpid?: string | number;
  id?: string | number;
  homeStatus?: string;
  price?: number;
  listPrice?: number;
  daysOnZillow?: number;
  description?: string;
  bedrooms?: number;
  bathrooms?: number;
  livingArea?: number;
  livingAreaValue?: number;
  squareFoot?: number;
  lotAreaValue?: number;
  lotSize?: number;
  lotSquareFoot?: number;
  yearBuilt?: number;
  homeType?: string;
  propertyType?: string;
  latitude?: number;
  longitude?: number;
  zestimate?: number;
  estimate?: number;
  rentZestimate?: number;
  rentEstimate?: number;
  monthlyHoaFee?: number;
  hoaFee?: number;
  hoa?: number;
  annualTaxAmount?: number;
  hiResImageLink?: string;
  propertyImages?: string[];
  attributionInfo?: {
    agentName?: string;
    agentPhoneNumber?: string;
    agentEmail?: string;
    brokerName?: string;
    brokerPhoneNumber?: string;
  };
  agentName?: string;
  agentPhoneNumber?: string;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const { db } = getFirebaseAdmin();

  // Auth
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const batchSize = Math.min(100, Math.max(10, Number(searchParams.get('batchSize') || '50')));

  try {
    // Get ALL active properties, sorted by lastStatusCheck (oldest first)
    const snapshot = await db.collection('properties').where('isActive', '==', true).get();

    if (snapshot.empty) {
      return NextResponse.json({ success: true, message: 'No active properties', remaining: 0 });
    }

    // Build list with check timestamps
    const allProps: Array<{
      id: string;
      url: string;
      zpid: string;
      address: string;
      currentStatus: string;
      lastCheck: Date | null;
      isOwnerfinance: boolean;
      agentConfirmedOwnerfinance?: boolean;
      source?: string;
    }> = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (!data.url) continue;
      allProps.push({
        id: doc.id,
        url: data.url,
        zpid: String(data.zpid || ''),
        address: data.fullAddress || data.streetAddress || data.address || 'Unknown',
        currentStatus: data.homeStatus || 'UNKNOWN',
        lastCheck: data.lastStatusCheck?.toDate?.() || null,
        isOwnerfinance: data.isOwnerfinance || false,
        agentConfirmedOwnerfinance: data.agentConfirmedOwnerfinance,
        source: data.source,
      });
    }

    // Sort: never checked first, then oldest checked
    allProps.sort((a, b) => {
      if (!a.lastCheck && !b.lastCheck) return 0;
      if (!a.lastCheck) return -1;
      if (!b.lastCheck) return 1;
      return a.lastCheck.getTime() - b.lastCheck.getTime();
    });

    // Count how many were checked in the last hour (by this endpoint)
    const ONE_HOUR = 60 * 60 * 1000;
    const now = Date.now();
    const checkedRecently = allProps.filter(p => p.lastCheck && (now - p.lastCheck.getTime()) < ONE_HOUR).length;
    const unchecked = allProps.length - checkedRecently;

    // Take the oldest batch
    const toProcess = allProps.slice(0, batchSize);

    console.log(`[check-all] Total: ${allProps.length}, Unchecked: ${unchecked}, Processing: ${toProcess.length}`);

    // Normalize URLs
    const normalizeUrl = (url: string): string => {
      if (!url) return '';
      if (url.startsWith('http')) return url;
      return `https://www.zillow.com${url.startsWith('/') ? '' : '/'}${url}`;
    };

    // Call Apify
    const client = new ApifyClient({ token: process.env.APIFY_API_KEY! });
    const run = await client.actor('maxcopell/zillow-detail-scraper').call({
      startUrls: toProcess.map(p => ({ url: normalizeUrl(p.url) })),
    });

    const { items } = await client.dataset(run.defaultDatasetId).listItems({ clean: false, limit: 1000 });
    const results = items as ZillowApifyItem[];

    // Map results by zpid
    const zpidToResult = new Map<string, ZillowApifyItem>();
    results.forEach(item => {
      const zpid = String(item.zpid || item.id || '');
      if (zpid) zpidToResult.set(zpid, item);
    });

    let updated = 0;
    let deactivated = 0;
    let noResult = 0;
    let statusChanged = 0;
    const changes: Array<{ address: string; action: string; detail: string }> = [];

    const batch = db.batch();
    let batchCount = 0;

    for (const prop of toProcess) {
      if (Date.now() - startTime > 270000) break; // 4.5 min safety

      const result = zpidToResult.get(prop.zpid);
      const docRef = db.collection('properties').doc(prop.id);

      if (!result) {
        noResult++;
        batch.update(docRef, {
          isActive: false,
          offMarketReason: 'No Apify result (likely off-market)',
          lastStatusCheck: new Date(),
        });
        deactivated++;
        changes.push({ address: prop.address, action: 'deactivated', detail: 'No Apify result' });
        batchCount++;
        continue;
      }

      const newStatus = result.homeStatus || 'UNKNOWN';
      if (prop.currentStatus !== newStatus) statusChanged++;

      // Check inactive statuses
      const inactiveStatuses = ['PENDING', 'SOLD', 'RECENTLY_SOLD', 'OFF_MARKET', 'FOR_RENT', 'CONTINGENT', 'OTHER', 'UNKNOWN'];
      const isInactive = inactiveStatuses.includes(newStatus);
      const hasNoPrice = !result.price && !result.listPrice;

      if (isInactive || hasNoPrice) {
        const reason = isInactive ? `Status: ${newStatus}` : 'No price';
        batch.update(docRef, {
          isActive: false,
          homeStatus: newStatus,
          offMarketReason: reason,
          lastStatusCheck: new Date(),
        });
        deactivated++;
        changes.push({ address: prop.address, action: 'deactivated', detail: reason });
        batchCount++;
        continue;
      }

      // Check owner financing
      if (prop.isOwnerfinance) {
        const manualSources = ['manual-add-v2', 'manual-add', 'admin-upload', 'manual', 'bookmarklet'];
        const isTrusted = manualSources.includes(prop.source || '') || prop.agentConfirmedOwnerfinance || prop.source === 'agent_outreach';

        if (!hasStrictOwnerfinancing(result.description).passes && !isTrusted) {
          batch.update(docRef, {
            isOwnerfinance: false,
            isActive: false,
            offMarketReason: 'Owner financing removed from listing',
            lastStatusCheck: new Date(),
          });
          deactivated++;
          changes.push({ address: prop.address, action: 'deactivated', detail: 'Owner financing removed' });
          batchCount++;
          continue;
        }
      }

      // Active — update with fresh data
      const updateData: Record<string, unknown> = {
        homeStatus: newStatus,
        price: result.listPrice || result.price || 0,
        listPrice: result.listPrice || result.price || 0,
        daysOnZillow: result.daysOnZillow || 0,
        description: sanitizeDescription(result.description),
        lastStatusCheck: new Date(),
        lastScrapedAt: new Date(),
        consecutiveNoResults: 0,
        bedrooms: result.bedrooms ?? null,
        bathrooms: result.bathrooms ?? null,
        squareFoot: result.livingArea || result.livingAreaValue || result.squareFoot || null,
        lotSquareFoot: result.lotAreaValue || result.lotSize || result.lotSquareFoot || null,
        yearBuilt: result.yearBuilt ?? null,
        homeType: result.homeType || result.propertyType || null,
        latitude: result.latitude ?? null,
        longitude: result.longitude ?? null,
        estimate: result.zestimate || result.estimate || null,
        rentEstimate: result.rentZestimate || result.rentEstimate || null,
        hoa: result.monthlyHoaFee || result.hoaFee || result.hoa || 0,
        annualTaxAmount: result.annualTaxAmount || null,
        ...(result.attributionInfo?.agentName && { agentName: result.attributionInfo.agentName }),
        ...(result.attributionInfo?.agentPhoneNumber && { agentPhoneNumber: result.attributionInfo.agentPhoneNumber }),
        ...(result.agentName && { agentName: result.agentName }),
        ...(result.hiResImageLink && { firstPropertyImage: result.hiResImageLink }),
        ...(result.propertyImages?.length && {
          propertyImages: result.propertyImages,
          photoCount: result.propertyImages.length,
          firstPropertyImage: result.propertyImages[0],
        }),
      };

      const cleanedData = Object.fromEntries(
        Object.entries(updateData).filter(([_, v]) => v !== null && v !== undefined)
      );

      batch.update(docRef, cleanedData);
      updated++;
      batchCount++;
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    const duration = Date.now() - startTime;
    const remaining = Math.max(0, unchecked - toProcess.length);

    const result = {
      success: true,
      processed: toProcess.length,
      updated,
      deactivated,
      noResult,
      statusChanged,
      remaining,
      totalActive: allProps.length,
      durationMs: duration,
      changes: changes.slice(0, 30),
    };

    console.log(`[check-all] Done in ${(duration/1000).toFixed(1)}s: ${updated} updated, ${deactivated} deactivated, ${remaining} remaining`);

    return NextResponse.json(result);

  } catch (error) {
    console.error('[check-all] Error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
