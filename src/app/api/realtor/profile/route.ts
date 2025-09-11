import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { FirebaseDB } from '@/lib/firebase-db';
import { ExtendedSession } from '@/types/session';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as any as ExtendedSession;
    
    if (!session?.user || session.user.role !== 'realtor') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current user data
    const userData = await FirebaseDB.getDocument('users', session.user.id);
    
    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const realtorData = (userData as any).realtorData || {};
    
    return NextResponse.json({
      success: true,
      data: {
        targetCity: realtorData.targetCity || '',
        serviceCities: realtorData.serviceCities || [],
        totalCitiesServed: realtorData.totalCitiesServed || 0,
        serviceArea: realtorData.serviceArea || null
      }
    });

  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch profile data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as any as ExtendedSession;
    
    if (!session?.user || session.user.role !== 'realtor') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { targetCity, serviceCities, totalCitiesServed } = body;


    // Parse target city first
    const cityParts = targetCity.split(',');

    // Get current user data
    const userData = await FirebaseDB.getDocument('users', session.user.id);
    
    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Create service area in the format the dashboard expects
    const serviceArea = {
      primaryCity: {
        name: cityParts[0]?.trim() || 'Dallas',
        state: cityParts[1]?.trim() || 'TX'
      },
      nearbyCities: serviceCities.map((city: string) => ({
        name: city.split(',')[0]?.trim() || city,
        state: city.split(',')[1]?.trim() || 'TX'
      })),
      radiusMiles: 30,
      totalCitiesServed: totalCitiesServed,
      lastUpdated: new Date()
    };

    // Update realtor data in user document
    const updatedRealtorData = {
      ...(userData as any).realtorData || {},
      firstName: (userData as any).name?.split(' ')[0] || '',
      lastName: (userData as any).name?.split(' ').slice(1).join(' ') || '',
      email: (userData as any).email,
      serviceArea: serviceArea,
      // ALSO save in the format dashboard expects
      targetCity: targetCity,
      serviceCities: serviceCities,
      totalCitiesServed: totalCitiesServed,
      profileComplete: true,
      isActive: true,
      credits: (userData as any).realtorData?.credits || 3,
      isOnTrial: (userData as any).realtorData?.isOnTrial ?? true,
      updatedAt: new Date()
    };

    await FirebaseDB.updateDocument('users', session.user.id, {
      realtorData: updatedRealtorData,
      updatedAt: new Date()
    });


    return NextResponse.json({
      success: true,
      message: 'Settings saved successfully'
    });

  } catch {
    return NextResponse.json(
      { error: 'Failed to save settings' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as any as ExtendedSession;
    
    if (!session?.user || session.user.role !== 'realtor') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { cityToRemove } = body;

    if (!cityToRemove) {
      return NextResponse.json({ error: 'City to remove is required' }, { status: 400 });
    }

    // Get current user data
    const userData = await FirebaseDB.getDocument('users', session.user.id);
    
    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const currentRealtorData = (userData as any).realtorData || {};
    const currentServiceCities = currentRealtorData.serviceCities || [];

    // Remove the specified city
    const updatedServiceCities = currentServiceCities.filter((city: string) => city !== cityToRemove);

    // Update the service area structure as well
    const updatedServiceArea = {
      ...currentRealtorData.serviceArea,
      nearbyCities: currentRealtorData.serviceArea?.nearbyCities?.filter((city: any) => 
        `${city.name}, ${city.state}` !== cityToRemove
      ) || [],
      totalCitiesServed: updatedServiceCities.length,
      lastUpdated: new Date()
    };

    // Update realtor data
    const updatedRealtorData = {
      ...currentRealtorData,
      serviceCities: updatedServiceCities,
      totalCitiesServed: updatedServiceCities.length,
      serviceArea: updatedServiceArea,
      updatedAt: new Date()
    };

    await FirebaseDB.updateDocument('users', session.user.id, {
      realtorData: updatedRealtorData,
      updatedAt: new Date()
    });

    return NextResponse.json({
      success: true,
      message: 'City removed successfully',
      updatedServiceCities: updatedServiceCities
    });

  } catch {
    return NextResponse.json(
      { error: 'Failed to remove city' },
      { status: 500 }
    );
  }
}