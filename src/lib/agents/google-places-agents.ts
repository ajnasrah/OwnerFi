import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';

/**
 * Use Google Places API to automatically populate agents
 * Much simpler and more reliable than scraping
 */
export class GooglePlacesAgentService {
  private apiKey: string;
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }
  
  /**
   * Search for real estate agents in a city
   */
  async searchAgents(city: string, state: string): Promise<any[]> {
    try {
      // Text search for real estate agents
      const searchUrl = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
      searchUrl.searchParams.set('query', `real estate agents in ${city} ${state}`);
      searchUrl.searchParams.set('key', this.apiKey);
      searchUrl.searchParams.set('type', 'real_estate_agency');
      
      const response = await fetch(searchUrl.toString());
      const data = await response.json();
      
      if (data.status !== 'OK') {
        console.error('Google Places error:', data.status);
        return [];
      }
      
      // Get details for each place
      const agents = [];
      
      for (const place of data.results.slice(0, 20)) { // Limit to 20 to control costs
        const details = await this.getPlaceDetails(place.place_id);
        if (details) {
          agents.push({
            ...place,
            ...details,
          });
        }
      }
      
      return agents;
    } catch (error) {
      console.error('Error searching agents:', error);
      return [];
    }
  }
  
  /**
   * Get detailed info for a place
   */
  async getPlaceDetails(placeId: string): Promise<any> {
    try {
      const detailsUrl = new URL('https://maps.googleapis.com/maps/api/place/details/json');
      detailsUrl.searchParams.set('place_id', placeId);
      detailsUrl.searchParams.set('fields', 'name,formatted_phone_number,website,rating,user_ratings_total,reviews,address_components,url,business_status');
      detailsUrl.searchParams.set('key', this.apiKey);
      
      const response = await fetch(detailsUrl.toString());
      const data = await response.json();
      
      if (data.status === 'OK' && data.result) {
        return data.result;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting place details:', error);
      return null;
    }
  }
  
  /**
   * Import agents to Firestore
   */
  async importAgentsToFirestore(city: string, state: string): Promise<number> {
    const agents = await this.searchAgents(city, state);
    let imported = 0;
    let skipped = 0;
    
    console.log(`\n📍 Importing agents for ${city}, ${state}...`);
    
    for (const agent of agents) {
      try {
        // Create agent ID from place_id
        const agentId = `google_${agent.place_id}`;
        
        // Check if agent already exists
        const existingAgent = await this.checkAgentExists(agentId);
        if (existingAgent) {
          console.log(`⏭️  Skipped: ${agent.name} (already exists)`);
          skipped++;
          continue;
        }
        
        // Extract ZIP from address components
        const zipComponent = agent.address_components?.find((c: any) => 
          c.types.includes('postal_code')
        );
        const zipCode = zipComponent?.long_name;
        
        // Extract city from address if not provided
        const cityComponent = agent.address_components?.find((c: any) => 
          c.types.includes('locality')
        );
        const extractedCity = cityComponent?.long_name || city;
        
        // Prepare agent profile
        const agentProfile = {
          id: agentId,
          
          // Basic Info
          name: agent.name,
          phone: agent.formatted_phone_number || '',
          email: '', // Not available from Google Places
          website: agent.website || '',
          googleMapsUrl: agent.url,
          photo: agent.photos?.[0]?.photo_reference ? 
            `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${agent.photos[0].photo_reference}&key=${this.apiKey}` : '',
          
          // Location
          city: extractedCity,
          state: state,
          zipCode: zipCode || '',
          address: agent.formatted_address || '',
          serviceAreas: zipCode ? [zipCode] : [],
          location: agent.geometry?.location ? {
            lat: agent.geometry.location.lat,
            lng: agent.geometry.location.lng
          } : null,
          
          // Ratings from Google
          googleRating: agent.rating || 0,
          googleReviews: agent.user_ratings_total || 0,
          averageRating: agent.rating || 0,
          totalReviews: agent.user_ratings_total || 0,
          
          // Rating breakdown (estimated from Google rating)
          ratingsBreakdown: this.estimateRatingBreakdown(agent.rating, agent.user_ratings_total),
          
          // Extract sample reviews
          recentReviews: (agent.reviews || []).slice(0, 5).map((r: any) => ({
            id: `google_${r.time}`,
            author: r.author_name,
            rating: r.rating,
            text: r.text,
            time: new Date(r.time * 1000),
            source: 'google'
          })),
          
          // Business info
          businessTypes: agent.types || [],
          businessStatus: agent.business_status || 'OPERATIONAL',
          priceLevel: agent.price_level || null,
          
          // Default values for real estate specific data
          specializations: this.inferSpecializations(agent.types, agent.name),
          languages: ['English'],
          yearsExperience: 0,
          licenseNumber: '',
          licenseState: state,
          brokerageName: agent.name.includes('Realty') || agent.name.includes('Real Estate') ? agent.name : '',
          
          // Platform metrics
          responseTimeHours: 24,
          successRate: 0,
          leadsReceived: 0,
          dealsCompleted: 0,
          totalEarnings: 0,
          
          // Status
          isActive: agent.business_status === 'OPERATIONAL',
          isVerified: false, // Not verified via license
          isPremium: false,
          isFeatured: agent.rating >= 4.5 && agent.user_ratings_total >= 10,
          source: 'google_places',
          
          // Timestamps
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastScrapedAt: serverTimestamp(),
        };
        
        // Save to Firestore
        await setDoc(
          doc(db, 'agentProfiles', agentId),
          agentProfile,
          { merge: true }
        );
        
        imported++;
        const rating = agent.rating || 0;
        const reviews = agent.user_ratings_total || 0;
        console.log(`✅ ${imported}. ${agent.name}`);
        console.log(`   📍 ${agent.formatted_address}`);
        console.log(`   ⭐ ${rating}/5 (${reviews} reviews)`);
        if (agent.formatted_phone_number) {
          console.log(`   📞 ${agent.formatted_phone_number}`);
        }
        console.log('');
        
      } catch (error) {
        console.error(`❌ Failed to import ${agent.name}:`, error);
      }
    }
    
    console.log(`\n📊 Import Summary:`);
    console.log(`   ✅ Imported: ${imported} agents`);
    console.log(`   ⏭️  Skipped: ${skipped} (already exist)`);
    console.log(`   📍 Total found: ${agents.length} agents in ${city}, ${state}`);
    
    return imported;
  }
  
  /**
   * Check if agent already exists
   */
  private async checkAgentExists(agentId: string): Promise<boolean> {
    try {
      const q = query(
        collection(db, 'agentProfiles'),
        where('id', '==', agentId)
      );
      const snapshot = await getDocs(q);
      return !snapshot.empty;
    } catch (error) {
      console.error('Error checking agent existence:', error);
      return false;
    }
  }
  
  /**
   * Estimate rating breakdown from overall rating
   */
  private estimateRatingBreakdown(rating: number, totalReviews: number): { 5: number; 4: number; 3: number; 2: number; 1: number; } {
    if (!rating || !totalReviews) {
      return { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    }
    
    // Simple estimation based on rating
    const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    
    if (rating >= 4.5) {
      breakdown[5] = Math.floor(totalReviews * 0.7);
      breakdown[4] = Math.floor(totalReviews * 0.25);
      breakdown[3] = totalReviews - breakdown[5] - breakdown[4];
    } else if (rating >= 4.0) {
      breakdown[4] = Math.floor(totalReviews * 0.6);
      breakdown[5] = Math.floor(totalReviews * 0.3);
      breakdown[3] = totalReviews - breakdown[4] - breakdown[5];
    } else if (rating >= 3.5) {
      breakdown[4] = Math.floor(totalReviews * 0.4);
      breakdown[3] = Math.floor(totalReviews * 0.4);
      breakdown[5] = totalReviews - breakdown[4] - breakdown[3];
    } else {
      breakdown[3] = Math.floor(totalReviews * 0.5);
      breakdown[2] = Math.floor(totalReviews * 0.3);
      breakdown[4] = totalReviews - breakdown[3] - breakdown[2];
    }
    
    return breakdown;
  }
  
  /**
   * Infer specializations from business types and name
   */
  private inferSpecializations(types: string[], name: string): string[] {
    const specializations: string[] = [];
    const nameLower = name.toLowerCase();
    
    // Check for luxury indicators
    if (nameLower.includes('luxury') || nameLower.includes('estate') || nameLower.includes('premier')) {
      specializations.push('luxury');
    }
    
    // Check for residential indicators
    if (types.includes('real_estate_agency') || nameLower.includes('residential')) {
      specializations.push('residential');
    }
    
    // Check for commercial indicators
    if (nameLower.includes('commercial') || nameLower.includes('office')) {
      specializations.push('commercial');
    }
    
    // Default to residential if no specific type found
    if (specializations.length === 0) {
      specializations.push('residential');
    }
    
    return specializations;
  }
}

/**
 * Simple function to populate agents for a city
 */
export async function populateAgentsFromGoogle(
  city: string,
  state: string,
  apiKey?: string
): Promise<void> {
  const key = apiKey || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY;
  
  if (!key) {
    throw new Error('Google API key not configured');
  }
  
  const service = new GooglePlacesAgentService(key);
  const count = await service.importAgentsToFirestore(city, state);
  
  console.log(`\n✅ Successfully imported ${count} agents from ${city}, ${state}`);
}