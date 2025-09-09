import { NextRequest, NextResponse } from 'next/server';

/**
 * Debug the cities.json data structure
 */
export async function GET() {
  try {
    const citiesData = await import('cities.json');
    
    // Sample first 5 entries to understand structure
    const sampleEntries = citiesData.slice(0, 5);
    
    // Count US entries
    const usEntries = citiesData.filter((city: Record<string, unknown>) => city.country === 'US' || city.country === 'United States').slice(0, 10);
    
    // Show different country values
    const countries = [...new Set(citiesData.map((city: Record<string, unknown>) => city.country))].slice(0, 10);
    
    // Show first few Atlanta entries
    const atlantaEntries = citiesData.filter((city: Record<string, unknown>) => 
      city.name && city.name.toLowerCase().includes('atlanta')
    ).slice(0, 5);
    
    return NextResponse.json({
      totalCities: citiesData.length,
      sampleEntries: sampleEntries,
      countries: countries,
      usEntriesCount: citiesData.filter((city: Record<string, unknown>) => city.country === 'US' || city.country === 'United States').length,
      usEntriesSample: usEntries,
      atlantaEntries: atlantaEntries,
      dataStructure: {
        fields: sampleEntries.length > 0 ? Object.keys(sampleEntries[0]) : [],
        hasLatLng: sampleEntries.some((city: Record<string, unknown>) => city.lat && city.lng),
        hasCoordinates: sampleEntries.some((city: Record<string, unknown>) => city.latitude && city.longitude)
      }
    });
    
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to load cities.json',
      details: (error as Error).message
    });
  }
}