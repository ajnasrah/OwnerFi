import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { unifiedDb } from '@/lib/unified-db';
import { 
  collection, 
  query,
  getDocs,
  doc
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { faker } from '@faker-js/faker';

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

const _mockBuyers: MockBuyer[] = [
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
    // Admin access control
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as { role?: string }).role !== 'admin') {
      return NextResponse.json(
        { error: 'Access denied. Admin access required.' },
        { status: 403 }
      );
    }

    const { count } = await request.json();
    const buyersToCreate = count || 50;

    // Get existing properties to create realistic buyers
    const propertiesSnapshot = await getDocs(query(collection(db, 'properties')));
    const properties = propertiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (properties.length === 0) {
      return NextResponse.json({ error: 'No properties found. Upload properties first.' }, { status: 400 });
    }

    const locations = [...new Set(properties.map(p => `${p.city}, ${p.state}`))];
    const priceRanges = properties.map(p => p.monthlyPayment).filter(p => p > 0).sort((a, b) => a - b);
    
    console.log(`Creating ${buyersToCreate} buyers across ${locations.length} cities`);
    
    const createdLeads = [];

    // Create realistic buyers based on actual property data
    for (let i = 0; i < buyersToCreate; i++) {
      const [city, state] = faker.helpers.arrayElement(locations).split(', ');
      const targetMonthly = faker.number.int({ min: Math.max(priceRanges[0] - 500, 500), max: priceRanges[priceRanges.length-1] + 1000 });
      
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@${faker.helpers.arrayElement(['gmail.com', 'yahoo.com', 'outlook.com'])}`;
      
      // Create user account
      const user = await unifiedDb.users.create({
        name: `${firstName} ${lastName}`,
        email: email,
        role: 'buyer',
        languages: faker.helpers.arrayElements(['English', 'Spanish'], { min: 1, max: 2 })
      });

      // Create buyer profile  
      const buyerProfile = await unifiedDb.buyerProfiles.create({
        userId: user.id,
        firstName,
        lastName, 
        phone: faker.phone.number('(###) ###-####'),
        maxMonthlyPayment: targetMonthly,
        maxDownPayment: faker.number.int({ min: 5000, max: 100000 }),
        preferredCity: city,
        preferredState: state,
        searchRadius: faker.number.int({ min: 15, max: 50 }),
        minBedrooms: faker.helpers.weighted([{ weight: 30, value: 1 }, { weight: 50, value: 2 }, { weight: 20, value: 3 }]),
        minBathrooms: faker.helpers.weighted([{ weight: 60, value: 1 }, { weight: 40, value: 2 }]),
        emailNotifications: true,
        smsNotifications: faker.datatype.boolean({ probability: 0.6 }),
        profileComplete: true,
        creditScore: faker.number.int({ min: 580, max: 750 }),
        monthlyIncome: faker.number.int({ min: 3000, max: 12000 }),
        currentlyRenting: faker.datatype.boolean({ probability: 0.7 }),
        hasChildren: faker.datatype.boolean({ probability: 0.4 }),
        notes: faker.helpers.arrayElement([
          'First-time buyer, excited about homeownership',
          'Young family looking for good schools',
          'Self-employed, flexible on timing',
          'Relocating for new job opportunity',
          'Credit recovery journey, motivated buyer',
          'Growing family needs more space',
          'Recent divorce, fresh start needed',
          'Investment property interest',
          'Military family, used to moves',
          'Empty nesters looking to downsize'
        ])
      });

      createdLeads.push({
        id: buyerProfile.id,
        name: `${firstName} ${lastName}`,
        email,
        city: `${city}, ${state}`,
        budget: `$${targetMonthly}/mo`
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