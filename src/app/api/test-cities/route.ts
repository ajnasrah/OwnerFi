import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ 
    message: 'Cities API is working!',
    testCities: [
      { name: 'Dallas', state: 'TX' },
      { name: 'Houston', state: 'TX' },
      { name: 'Miami', state: 'FL' },
      { name: 'Atlanta', state: 'GA' }
    ]
  });
}