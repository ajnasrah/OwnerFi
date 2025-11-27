import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const city = searchParams.get('city')?.toLowerCase();
    const state = searchParams.get('state')?.toUpperCase();
    const sortBy = searchParams.get('sortBy') || 'percentOfArv';
    const sortOrder = searchParams.get('sortOrder') || 'asc';
    const limit = parseInt(searchParams.get('limit') || '100');

    let query: FirebaseFirestore.Query = db.collection('cash_houses');

    // Filter by state if provided
    if (state) {
      query = query.where('state', '==', state);
    }

    // Get all matching documents
    const snapshot = await query.get();

    let deals = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Filter by city (case-insensitive partial match)
    if (city) {
      deals = deals.filter((deal: any) =>
        deal.city?.toLowerCase().includes(city)
      );
    }

    // Sort
    deals.sort((a: any, b: any) => {
      const aVal = a[sortBy] || 0;
      const bVal = b[sortBy] || 0;
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

    // Limit results
    deals = deals.slice(0, limit);

    // Get unique states for filter dropdown
    const allDocs = await db.collection('cash_houses').get();
    const states = [...new Set(allDocs.docs.map(d => d.data().state).filter(Boolean))].sort();

    return NextResponse.json({
      deals,
      total: snapshot.size,
      states
    });
  } catch (error: any) {
    console.error('Error fetching cash deals:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
