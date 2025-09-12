/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { FirebaseDB } from '@/lib/firebase-db';

export async function GET() {
  try {
    
    // Get all buyer links
    const allBuyerLinks = await FirebaseDB.queryDocuments('buyerLinks', []);
    
    
    // Filter Dallas buyers specifically
    const dallasBuyers = (allBuyerLinks as Array<{
      city?: string;
      [key: string]: unknown;
    }>).filter((buyer: {
      city?: string;
      [key: string]: unknown;
    }) => 
      buyer.city && buyer.city.toLowerCase().includes('dallas')
    );
    
    
    const summary = (allBuyerLinks as Array<{
      id: string;
      firstName: string;
      lastName: string;
      city?: string;
      state?: string;
      maxMonthlyPayment?: number;
      languages?: string[];
      isAvailable?: boolean;
      [key: string]: unknown;
    }>).map((buyer: {
      id: string;
      firstName: string;
      lastName: string;
      city?: string;
      state?: string;
      maxMonthlyPayment?: number;
      languages?: string[];
      isAvailable?: boolean;
      [key: string]: unknown;
    }) => ({
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