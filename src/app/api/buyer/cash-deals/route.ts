import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { ExtendedSession } from '@/types/session';
import { getAdminDb } from '@/lib/firebase-admin';

/**
 * Cash Deals API for Investors
 *
 * Returns properties from cash_houses that:
 * - Are under 80% of ARV
 * - Are NOT owner finance verified
 * - Match the buyer's city/state/radius
 * - Are under $300K (global cap)
 */

const GLOBAL_MAX_PRICE = 300000;
const MAX_ARV_PERCENT = 80;

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions as any) as ExtendedSession | null;

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getAdminDb();
    if (!db) {
      return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });
    }

    // Get query params
    const { searchParams } = new URL(request.url);
    const city = searchParams.get('city') || '';
    const state = searchParams.get('state') || '';
    const radius = parseInt(searchParams.get('radius') || '50');

    console.log(`[buyer/cash-deals] Fetching for ${city}, ${state} (radius: ${radius}mi)`);

    // Fetch from cash_houses collection
    let query = db.collection('cash_houses')
      .where('price', '<=', GLOBAL_MAX_PRICE)
      .limit(200);

    // Add state filter if provided
    if (state) {
      query = db.collection('cash_houses')
        .where('state', '==', state)
        .where('price', '<=', GLOBAL_MAX_PRICE)
        .limit(200);
    }

    const snapshot = await query.get();

    let deals = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        address: data.address || '',
        city: data.city || '',
        state: data.state || '',
        zipcode: data.zipcode || '',
        price: data.price || 0,
        arv: data.arv || 0,
        percentOfArv: data.percentOfArv || 0,
        discount: data.arv && data.price ? data.arv - data.price : 0,
        beds: data.beds || data.bedrooms || 0,
        baths: data.baths || data.bathrooms || 0,
        sqft: data.sqft || data.squareFeet || 0,
        imgSrc: data.imgSrc || data.imageUrl || '',
        url: data.url || '',
        ownerFinanceVerified: data.ownerFinanceVerified || false,
      };
    });

    // Filter: under 80% ARV, NOT owner finance, has valid ARV
    deals = deals.filter(d =>
      d.arv > 0 &&
      d.percentOfArv > 0 &&
      d.percentOfArv <= MAX_ARV_PERCENT &&
      !d.ownerFinanceVerified
    );

    // Filter by city if provided (case-insensitive partial match)
    if (city) {
      const cityLower = city.toLowerCase();
      deals = deals.filter(d =>
        d.city.toLowerCase().includes(cityLower)
      );
    }

    // Sort by best discount (lowest % of ARV first)
    deals.sort((a, b) => a.percentOfArv - b.percentOfArv);

    console.log(`[buyer/cash-deals] Found ${deals.length} deals`);

    return NextResponse.json({
      deals,
      total: deals.length,
      filters: {
        city,
        state,
        radius,
        maxPrice: GLOBAL_MAX_PRICE,
        maxArvPercent: MAX_ARV_PERCENT
      }
    });

  } catch (error: any) {
    console.error('[buyer/cash-deals] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
