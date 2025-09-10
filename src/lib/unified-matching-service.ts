import { 
  collection, 
  query, 
  where, 
  getDocs
} from 'firebase/firestore';
import { db } from './firebase';
import { BuyerProfile, RealtorProfile, Property } from './firebase-models';

interface RealtorLocation {
  centerCity: string;
  centerState: string;
  searchRadius: number;
  serviceCities: string[];
}

interface BuyerLocation {
  centerCity: string;
  centerState: string;
  searchRadius: number;
  serviceCities: string[];
}

interface BuyerCriteria {
  maxMonthlyPayment: number;
  maxDownPayment: number;
}

interface PropertyCriteria {
  minBedrooms?: number;
  minBathrooms?: number;
}

class UnifiedMatchingService {
  
  // Find buyers that match a realtor's service area
  static async findBuyersForRealtor(realtorLocation: RealtorLocation) {
    try {
      // Get all buyers - filter by state in JavaScript due to nested field limitations
      const buyersQuery = query(collection(db, 'buyerProfiles'));
      
      const buyerDocs = await getDocs(buyersQuery);
      const matchedBuyers = [];
      
      for (const buyerDoc of buyerDocs.docs) {
        const buyerData = { id: buyerDoc.id, ...buyerDoc.data() } as BuyerProfile & { id: string };
        
        // Filter by state first
        if (buyerData.searchCriteria?.state !== realtorLocation.centerState) continue;
        
        // Filter by isActive - treat undefined as active for backward compatibility
        if (buyerData.isActive === false) continue;
        
        // Get buyer's cities from nested structure
        const buyerCities = buyerData.searchCriteria?.cities || [];
        const primaryCity = Array.isArray(buyerCities) ? buyerCities[0] : buyerCities;
        
        // Check if buyer's preferred city is in realtor's service cities
        const cityMatch = realtorLocation.serviceCities.some(serviceCity =>
          buyerCities.some((buyerCity: string) =>
            buyerCity?.toLowerCase() === serviceCity.toLowerCase()
          )
        );
        
        if (cityMatch || primaryCity?.toLowerCase() === realtorLocation.centerCity.toLowerCase()) {
          // Calculate real-time property matches instead of using broken propertyBuyerMatches table
          const matchedPropertyCount = await this.calculateRealTimePropertyMatches(buyerData);
          
          matchedBuyers.push({
            ...buyerData,
            matchedProperties: matchedPropertyCount,
            exactCityMatches: cityMatch ? matchedPropertyCount : 0,
            nearbyMatches: cityMatch ? 0 : matchedPropertyCount
          });
        }
      }
      
      return matchedBuyers;
      
    } catch (error) {
      console.error('Error finding buyers for realtor:', error);
      throw new Error(`Failed to find buyers: ${error}`);
    }
  }

  // Calculate real-time property matches for a buyer
  private static async calculateRealTimePropertyMatches(buyerData: BuyerProfile & { id: string }): Promise<number> {
    try {
      const buyerCities = buyerData.searchCriteria?.cities || [];
      const buyerState = buyerData.searchCriteria?.state;
      const maxMonthly = buyerData.searchCriteria?.maxMonthlyPayment || 0;
      const maxDown = buyerData.searchCriteria?.maxDownPayment || 0;
      
      if (!buyerState || buyerCities.length === 0) return 0;
      
      // Query properties in buyer's state
      const propertiesQuery = query(
        collection(db, 'properties'),
        where('state', '==', buyerState)
      );
      const propertyDocs = await getDocs(propertiesQuery);
      
      let matchCount = 0;
      for (const doc of propertyDocs.docs) {
        const property = doc.data() as Property;
        
        // Check if property matches buyer criteria
        const cityMatch = buyerCities.some(city => 
          property.city?.toLowerCase() === city.toLowerCase()
        );
        
        const budgetMatch = 
          property.monthlyPayment <= maxMonthly &&
          property.downPaymentAmount <= maxDown;
        
        if (cityMatch && budgetMatch && property.isActive !== false) {
          matchCount++;
        }
      }
      
      return matchCount;
    } catch (error) {
      console.error('Error calculating real-time property matches:', error);
      return 0;
    }
  }
  
  // Find properties that match a buyer's criteria
  static async findPropertiesForBuyer(
    buyerLocation: BuyerLocation, 
    buyerCriteria: BuyerCriteria,
    propertyCriteria: PropertyListingCriteria = {}
  ) {
    try {
      // Query properties in the buyer's state  
      const propertiesQuery = query(
        collection(db, 'properties'),
        where('state', '==', buyerLocation.centerState)
      );
      
      const propertyDocs = await getDocs(propertiesQuery);
      const matchedProperties = [];
      
      for (const propertyDoc of propertyDocs.docs) {
        const propertyData = { id: propertyDoc.id, ...propertyDoc.data() } as PropertyListing & { id: string };
        
        // Filter by isActive in JavaScript instead of query
        if (!propertyData.isActive) continue;
        
        // Location match - check if property city is in buyer's service cities or preferred city
        const locationMatch = 
          buyerLocation.serviceCities.some(serviceCity =>
            propertyData.city?.toLowerCase() === serviceCity.toLowerCase()
          ) || propertyData.city?.toLowerCase() === buyerLocation.centerCity.toLowerCase();
        
        if (!locationMatch) continue;
        
        // Budget criteria
        const budgetMatch = 
          propertyData.monthlyPayment <= buyerCriteria.maxMonthlyPayment &&
          propertyData.downPaymentAmount <= buyerCriteria.maxDownPayment;
        
        if (!budgetMatch) continue;
        
        // Property criteria
        const propertyMatch = 
          (!propertyCriteria.minBedrooms || propertyData.bedrooms >= propertyCriteria.minBedrooms) &&
          (!propertyCriteria.minBathrooms || propertyData.bathrooms >= propertyCriteria.minBathrooms);
        
        if (!propertyMatch) continue;
        
        matchedProperties.push(propertyData);
      }
      
      return matchedProperties;
      
    } catch (error) {
      console.error('Error finding properties for buyer:', error);
      throw new Error(`Failed to find properties: ${error}`);
    }
  }
  
  // Find potential realtor matches for a buyer
  static async findRealtorsForBuyer(buyerLocation: BuyerLocation) {
    try {
      // Query realtors in the same state
      const realtorsQuery = query(
        collection(db, 'realtors'),
        where('primaryState', '==', buyerLocation.centerState)
      );
      
      const realtorDocs = await getDocs(realtorsQuery);
      const matchedRealtors = [];
      
      for (const realtorDoc of realtorDocs.docs) {
        const realtorData = { id: realtorDoc.id, ...realtorDoc.data() } as RealtorProfile & { id: string };
        
        // Filter by isActive in JavaScript instead of query
        if (!realtorData.isActive) continue;
        
        // Check if realtor serves buyer's preferred city
        const serviceCities = realtorData.serviceCities || [realtorData.primaryCity];
        const cityMatch = serviceCities.some((serviceCity: string) =>
          serviceCity.toLowerCase() === buyerLocation.centerCity.toLowerCase()
        );
        
        if (cityMatch || realtorData.primaryCity?.toLowerCase() === buyerLocation.centerCity.toLowerCase()) {
          matchedRealtors.push({
            ...realtorData,
            matchReason: cityMatch ? 'serves_your_city' : 'primary_city_match'
          });
        }
      }
      
      return matchedRealtors;
      
    } catch (error) {
      console.error('Error finding realtors for buyer:', error);
      throw new Error(`Failed to find realtors: ${error}`);
    }
  }
}

export default UnifiedMatchingService;