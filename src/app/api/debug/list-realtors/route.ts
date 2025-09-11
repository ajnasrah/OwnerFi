import { NextRequest, NextResponse } from 'next/server';
import { FirebaseDB } from '@/lib/firebase-db';

export async function GET() {
  try {
    // Get all realtors
    const realtors = await FirebaseDB.queryDocuments('users', [
      { field: 'role', operator: '==', value: 'realtor' }
    ]);
    
    const realtorList = realtors.map((realtor: any) => {
      const realtorData = realtor.realtorData || {};
      const serviceArea = realtorData.serviceArea || {};
      
      return {
        id: realtor.id,
        email: realtor.email,
        name: `${realtorData.firstName || ''} ${realtorData.lastName || ''}`.trim(),
        primaryCity: serviceArea.primaryCity?.name || 'Unknown',
        primaryState: serviceArea.primaryCity?.state || 'Unknown',
        serviceCities: realtorData.serviceCities || [],
        createdAt: realtor.createdAt || realtorData.createdAt
      };
    });
    
    // Sort by creation date (most recent first)
    realtorList.sort((a, b) => {
      const aTime = a.createdAt?.seconds || 0;
      const bTime = b.createdAt?.seconds || 0;
      return bTime - aTime;
    });
    
    return NextResponse.json({
      success: true,
      totalRealtors: realtors.length,
      realtors: realtorList
    });
    
  } catch (error) {
    return NextResponse.json({ 
      error: 'Failed', 
      details: (error as Error).message 
    }, { status: 500 });
  }
}