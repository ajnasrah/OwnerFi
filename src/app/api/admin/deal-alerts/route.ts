/**
 * Deal Alerts API
 *
 * Returns new properties that match alert criteria:
 * - Under 80% of ARV (zestimate)
 * - In Memphis or surrounding cities
 * - Must have a zestimate
 * - Added within the last X minutes
 */

import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { getCitiesWithinRadiusComprehensive } from '@/lib/comprehensive-cities';

// Memphis surrounding cities within 50 miles
const MEMPHIS_CITIES = new Set<string>();
const MEMPHIS_RADIUS = 50; // miles

// Initialize Memphis area cities
function initMemphisCities() {
  if (MEMPHIS_CITIES.size > 0) return;

  MEMPHIS_CITIES.add('memphis');

  // Get all cities within 50 miles of Memphis
  const nearbyCities = getCitiesWithinRadiusComprehensive('Memphis', 'TN', MEMPHIS_RADIUS);
  nearbyCities.forEach(city => {
    MEMPHIS_CITIES.add(city.name.toLowerCase());
  });

  console.log(`[deal-alerts] Initialized ${MEMPHIS_CITIES.size} Memphis area cities`);
}

// Track last check time per client (in-memory, resets on deploy)
const lastCheckTimes = new Map<string, number>();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId') || 'default';
    const lookbackMinutes = parseInt(searchParams.get('lookback') || '5');

    // Initialize Memphis cities if needed
    initMemphisCities();

    const db = await getAdminDb();
    if (!db) {
      return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });
    }

    // Calculate time threshold
    const now = Date.now();
    const lastCheck = lastCheckTimes.get(clientId) || (now - lookbackMinutes * 60 * 1000);
    const threshold = new Date(lastCheck);

    // Update last check time
    lastCheckTimes.set(clientId, now);

    // Query properties collection for recent additions
    const snapshot = await db.collection('properties')
      .where('createdAt', '>', threshold)
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();

    if (snapshot.empty) {
      return NextResponse.json({
        deals: [],
        count: 0,
        lastCheck: threshold.toISOString(),
        memphisCitiesCount: MEMPHIS_CITIES.size
      });
    }

    // Filter for Memphis area + under 80% ARV + has zestimate
    const matchingDeals: Array<{
      id: string;
      address: string;
      city: string;
      state: string;
      price: number;
      zestimate: number;
      percentOfArv: number;
      url: string;
      addedAt: string;
    }> = [];

    snapshot.docs.forEach(doc => {
      const data = doc.data();

      // Skip if not active or not FOR_SALE
      if (data.isActive === false) return;
      const status = (data.homeStatus || '').toString().toUpperCase();
      if (status && status !== 'FOR_SALE') return;

      // Must have zestimate
      const zestimate = data.estimate || data.zestimate || data.arv || 0;
      if (!zestimate || zestimate <= 0) return;

      // Calculate percent of ARV
      const price = data.price || data.listPrice || 0;
      if (!price || price <= 0) return;

      const percentOfArv = Math.round((price / zestimate) * 100 * 10) / 10;

      // Must be under 80% ARV
      if (percentOfArv >= 80) return;

      // Must be in Memphis area
      const city = (data.city || '').toLowerCase();
      if (!MEMPHIS_CITIES.has(city)) return;

      // Build URL
      let url = data.url || data.hdpUrl || '';
      if (url && !url.startsWith('http')) {
        url = `https://www.zillow.com${url.startsWith('/') ? '' : '/'}${url}`;
      }
      if (!url && data.zpid) {
        url = `https://www.zillow.com/homedetails/${data.zpid}_zpid/`;
      }

      matchingDeals.push({
        id: doc.id,
        address: data.streetAddress || data.fullAddress || data.address || '',
        city: data.city || '',
        state: data.state || '',
        price,
        zestimate,
        percentOfArv,
        url,
        addedAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      });
    });

    console.log(`[deal-alerts] Found ${matchingDeals.length} new Memphis deals under 80% ARV since ${threshold.toISOString()}`);

    return NextResponse.json({
      deals: matchingDeals,
      count: matchingDeals.length,
      lastCheck: threshold.toISOString(),
      memphisCitiesCount: MEMPHIS_CITIES.size,
    });

  } catch (error) {
    console.error('[deal-alerts] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
