/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { FirebaseDB } from '@/lib/firebase-db';
import { UserWithRealtorData, ValidatedCity } from '@/lib/realtor-models';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    
    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }
    
    // Find realtor by email
    const realtors = await FirebaseDB.queryDocuments('users', [
      { field: 'email', operator: '==', value: email },
      { field: 'role', operator: '==', value: 'realtor' }
    ]);
    
    if (realtors.length === 0) {
      return NextResponse.json({ error: 'Realtor not found' }, { status: 404 });
    }
    
    const realtor = realtors[0] as UserWithRealtorData;
    const realtorData = realtor.realtorData || {};
    
    // Extract service cities like the dashboard does
    const serviceArea = realtorData.serviceArea || {};
    let cities: string[] = [];
    
    // Get primary city and nearby cities from serviceArea
    if (serviceArea.primaryCity?.name) {
      cities = [serviceArea.primaryCity.name];
      
      // Add all nearby cities from service area
      if (serviceArea.nearbyCities && serviceArea.nearbyCities.length > 0) {
        const nearbyCities = serviceArea.nearbyCities.map((c: ValidatedCity) => c.name);
        cities.push(...nearbyCities);
      }
    }
    
    // Also check if cities are saved directly in serviceCities field
    if (realtorData.serviceCities && realtorData.serviceCities.length > 0) {
      cities = realtorData.serviceCities.map((city: string) => city.split(',')[0]?.trim());
    }
    
    const realtorProfile = {
      cities: cities,
      languages: ['English'], // Default - can be extended later
      state: serviceArea.primaryCity?.state || 'Unknown'
    };
    
    return NextResponse.json({
      success: true,
      realtor: {
        name: `${realtorData.firstName} ${realtorData.lastName}`,
        email: realtor.email
      },
      rawServiceArea: serviceArea,
      rawServiceCities: realtorData.serviceCities,
      extractedProfile: realtorProfile,
      fullRealtorData: realtorData
    });
    
  } catch (error) {
    return NextResponse.json({ 
      error: 'Failed', 
      details: (error as Error).message 
    }, { status: 500 });
  }
}