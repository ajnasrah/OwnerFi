import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

// Normalize data from different collections to a common format
function normalizeProperty(doc: FirebaseFirestore.DocumentSnapshot, source: string): any {
  const data = doc.data() || {};

  // Calculate percentOfArv if not present
  const price = data.price || data.listPrice || 0;
  const arv = data.arv || data.estimate || data.zestimate || 0;
  const percentOfArv = data.percentOfArv || (arv > 0 ? Math.round((price / arv) * 100 * 10) / 10 : 100);
  const discount = data.discount || (arv > 0 ? Math.round((1 - price / arv) * 100 * 10) / 10 : 0);

  return {
    id: doc.id,
    // Address fields
    address: data.address || data.fullAddress || `${data.streetAddress}, ${data.city}, ${data.state} ${data.zipCode || data.zipcode}`,
    streetAddress: data.streetAddress || data.address?.split(',')[0],
    city: data.city,
    state: data.state,
    zipcode: data.zipCode || data.zipcode,
    // Price fields
    price,
    arv,
    percentOfArv,
    discount,
    // Property details
    beds: data.beds || data.bedrooms,
    baths: data.baths || data.bathrooms,
    sqft: data.sqft || data.squareFoot,
    // Images
    imgSrc: data.imgSrc || data.firstPropertyImage || data.imageUrl || (data.imageUrls?.[0]),
    // Metadata
    url: data.url || data.hdpUrl,
    zpid: data.zpid,
    source: data.source || source,
    status: data.status || data.homeStatus,
    addedAt: data.addedAt || data.importedAt || data.scrapedAt,
    // Owner finance fields (from zillow_imports)
    ownerFinanceVerified: data.ownerFinanceVerified,
    matchedKeywords: data.matchedKeywords,
    financingType: data.financingType,
    description: data.description,
  };
}

export async function GET(request: Request) {
  try {
    const db = await getAdminDb();
    if (!db) {
      return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const city = searchParams.get('city')?.toLowerCase();
    const state = searchParams.get('state')?.toUpperCase();
    const sortBy = searchParams.get('sortBy') || 'percentOfArv';
    const sortOrder = searchParams.get('sortOrder') || 'asc';
    const limit = parseInt(searchParams.get('limit') || '200');
    const collection = searchParams.get('collection'); // 'cash_houses', 'zillow_imports', or null for both

    let allDeals: any[] = [];
    const allStates = new Set<string>();

    // Fetch from cash_houses (discount deals)
    if (!collection || collection === 'cash_houses') {
      let cashQuery: FirebaseFirestore.Query = db.collection('cash_houses');
      if (state) cashQuery = cashQuery.where('state', '==', state);
      const cashSnapshot = await cashQuery.get();

      cashSnapshot.docs.forEach(doc => {
        const normalized = normalizeProperty(doc, 'cash_houses');
        allDeals.push(normalized);
        if (normalized.state) allStates.add(normalized.state);
      });
    }

    // Fetch from zillow_imports (owner finance deals)
    if (!collection || collection === 'zillow_imports') {
      let zillowQuery: FirebaseFirestore.Query = db.collection('zillow_imports');
      if (state) zillowQuery = zillowQuery.where('state', '==', state);
      const zillowSnapshot = await zillowQuery.get();

      zillowSnapshot.docs.forEach(doc => {
        const normalized = normalizeProperty(doc, 'zillow_imports');
        allDeals.push(normalized);
        if (normalized.state) allStates.add(normalized.state);
      });
    }

    // Filter by city (case-insensitive partial match)
    if (city) {
      allDeals = allDeals.filter((deal: any) =>
        deal.city?.toLowerCase().includes(city)
      );
    }

    // Sort
    allDeals.sort((a: any, b: any) => {
      const aVal = a[sortBy] ?? (sortOrder === 'asc' ? Infinity : -Infinity);
      const bVal = b[sortBy] ?? (sortOrder === 'asc' ? Infinity : -Infinity);
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

    const total = allDeals.length;

    // Limit results
    allDeals = allDeals.slice(0, limit);

    return NextResponse.json({
      deals: allDeals,
      total,
      states: [...allStates].sort()
    });
  } catch (error: any) {
    console.error('Error fetching cash deals:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
