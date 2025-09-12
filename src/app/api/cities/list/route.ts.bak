import { NextResponse } from 'next/server';
import { cities } from '@/lib/cities';

export async function GET() {
  return NextResponse.json({ 
    totalCities: cities.length,
    cities: cities.slice(0, 20) // First 20 cities for testing
  });
}