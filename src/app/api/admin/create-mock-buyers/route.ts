import { NextRequest, NextResponse } from 'next/server';
import { unifiedDb } from '@/lib/unified-db';

interface MockBuyer {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  maxMonthlyPayment: number;
  maxDownPayment: number;
  preferredCity: string;
  preferredState: string;
  searchRadius: number;
  minBedrooms: number;
  minBathrooms: number;
  matchedProperties: number;
}

const mockBuyers: MockBuyer[] = [
  {
    firstName: 'Sarah',
    lastName: 'Johnson',
    phone: '(555) 234-7890',
    email: 'sarah.johnson@example.com',
    maxMonthlyPayment: 1800,
    maxDownPayment: 35000,
    preferredCity: 'Nashville',
    preferredState: 'TN',
    searchRadius: 30,
    minBedrooms: 3,
    minBathrooms: 2,
    matchedProperties: 12
  },
  {
    firstName: 'Michael',
    lastName: 'Rodriguez',
    phone: '(555) 345-8901',
    email: 'michael.rodriguez@example.com',
    maxMonthlyPayment: 2200,
    maxDownPayment: 50000,
    preferredCity: 'Austin',
    preferredState: 'TX',
    searchRadius: 25,
    minBedrooms: 4,
    minBathrooms: 2.5,
    matchedProperties: 8
  },
  {
    firstName: 'Jennifer',
    lastName: 'Williams',
    phone: '(555) 456-9012',
    email: 'jennifer.williams@example.com',
    maxMonthlyPayment: 1400,
    maxDownPayment: 25000,
    preferredCity: 'Tampa',
    preferredState: 'FL',
    searchRadius: 35,
    minBedrooms: 2,
    minBathrooms: 2,
    matchedProperties: 15
  },
  {
    firstName: 'David',
    lastName: 'Chen',
    phone: '(555) 567-0123',
    email: 'david.chen@example.com',
    maxMonthlyPayment: 2500,
    maxDownPayment: 75000,
    preferredCity: 'Atlanta',
    preferredState: 'GA',
    searchRadius: 20,
    minBedrooms: 3,
    minBathrooms: 2,
    matchedProperties: 6
  },
  {
    firstName: 'Lisa',
    lastName: 'Thompson',
    phone: '(555) 678-1234',
    email: 'lisa.thompson@example.com',
    maxMonthlyPayment: 1600,
    maxDownPayment: 30000,
    preferredCity: 'Jacksonville',
    preferredState: 'FL',
    searchRadius: 40,
    minBedrooms: 3,
    minBathrooms: 2,
    matchedProperties: 10
  }
];

export async function POST(request: NextRequest) {
  try {
    const createdLeads = [];

    for (const buyer of mockBuyers) {
      // Create a user account for each buyer
      const user = await unifiedDb.users.create({
        name: `${buyer.firstName} ${buyer.lastName}`,
        email: buyer.email,
        role: 'buyer',
        languages: ['English']
      });

      // Create buyer profile
      const buyerProfile = await unifiedDb.buyerProfiles.create({
        userId: user.id,
        firstName: buyer.firstName,
        lastName: buyer.lastName,
        phone: buyer.phone,
        maxMonthlyPayment: buyer.maxMonthlyPayment,
        maxDownPayment: buyer.maxDownPayment,
        preferredCity: buyer.preferredCity,
        preferredState: buyer.preferredState,
        searchRadius: buyer.searchRadius,
        minBedrooms: buyer.minBedrooms,
        minBathrooms: buyer.minBathrooms,
        matchedProperties: buyer.matchedProperties,
        emailNotifications: true,
        smsNotifications: false,
        profileComplete: true,
        isActive: true
      });

      createdLeads.push({
        ...buyerProfile,
        user: user
      });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully created ${createdLeads.length} mock buyer leads`,
      leads: createdLeads
    });

  } catch (error) {
    console.error('Failed to create mock buyers:', error);
    return NextResponse.json(
      { error: 'Failed to create mock buyers' },
      { status: 500 }
    );
  }
}