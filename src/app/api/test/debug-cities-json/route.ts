import { NextRequest, NextResponse } from 'next/server';

/**
 * Debug the cities.json data structure
 */
export async function GET() {
  try {
    const citiesData = require('cities.json');
    
    // Sample first 5 entries to understand structure
    const sampleEntries = citiesData.slice(0, 5);
    
    // Count US entries
    const usEntries = citiesData.filter((city: any) => city.country === 'US' || city.country === 'United States').slice(0, 10);
    
    // Show different country values
    const countries = [...new Set(citiesData.map((city: any) => city.country))].slice(0, 10);
    
    // Show first few Atlanta entries
    const atlantaEntries = citiesData.filter((city: any) => 
      city.name && city.name.toLowerCase().includes('atlanta')
    ).slice(0, 5);
    
    return NextResponse.json({
      totalCities: citiesData.length,
      sampleEntries: sampleEntries,
      countries: countries,
      usEntriesCount: citiesData.filter((city: any) => city.country === 'US' || city.country === 'United States').length,
      usEntriesSample: usEntries,
      atlantaEntries: atlantaEntries,
      dataStructure: {
        fields: sampleEntries.length > 0 ? Object.keys(sampleEntries[0]) : [],
        hasLatLng: sampleEntries.some((city: any) => city.lat && city.lng),
        hasCoordinates: sampleEntries.some((city: any) => city.latitude && city.longitude)
      }
    });
    
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to load cities.json',
      details: (error as Error).message
    });
  }
}