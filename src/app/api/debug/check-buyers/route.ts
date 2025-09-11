import { NextRequest, NextResponse } from 'next/server';
import { FirebaseDB } from '@/lib/firebase-db';

export async function GET(request: NextRequest) {
  try {
    
    // Get all buyer links
    const allBuyerLinks = await FirebaseDB.queryDocuments('buyerLinks', []);
    
    
    // Filter Dallas buyers specifically
    const dallasBuyers = allBuyerLinks.filter((buyer: any) => 
      buyer.city && buyer.city.toLowerCase().includes('dallas')
    );
    
    
    const summary = allBuyerLinks.map((buyer: any) => ({
      id: buyer.id,
      name: `${buyer.firstName} ${buyer.lastName}`,
      city: buyer.city,
      state: buyer.state,
      budget: `$${buyer.maxMonthlyPayment}/mo`,
      languages: buyer.languages,
      isAvailable: buyer.isAvailable
    }));
    
    return NextResponse.json({
      totalBuyers: allBuyerLinks.length,
      dallasBuyers: dallasBuyers.length,
      buyers: summary
    });

  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}