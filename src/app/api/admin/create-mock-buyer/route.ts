import { NextRequest, NextResponse } from 'next/server';
import { createMockBuyer } from '@/lib/create-mock-buyer';
import { logInfo } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const result = await createMockBuyer();
    
    await logInfo('Mock buyer created', {
      action: 'create_mock_buyer',
      userId: result.userId,
      buyerId: result.buyerId,
      userType: 'buyer'
    });

    return NextResponse.json({
      success: true,
      message: 'Mock buyer "Sarah Johnson" created successfully',
      buyer: {
        name: 'Sarah Johnson',
        phone: '(555) 234-7890',
        budget: '$1,800/month, $35,000 down',
        location: 'Nashville, TN (30 mile radius)',
        preferences: '3+ bedrooms, 2+ bathrooms',
        languages: 'English, Spanish'
      }
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create mock buyer', details: (error as Error).message },
      { status: 500 }
    );
  }
}