import { ApifyClient } from 'apify-client';

interface AgentData {
  // Basic Info
  id: string;
  name: string;
  photo?: string;
  licenseNumber?: string;
  brokerageName?: string;
  
  // Contact
  phone?: string;
  email?: string;
  website?: string;
  
  // Location
  city?: string;
  state: string;
  zipCode?: string;
  serviceAreas?: string[];
  
  // Ratings & Performance
  averageRating?: number;
  totalReviews?: number;
  recentSales?: number;
  yearsExperience?: number;
  
  // Source
  source: 'zillow' | 'realtor' | 'remax';
  sourceUrl?: string;
  lastUpdated: Date;
}

interface AgentReview {
  id: string;
  agentId: string;
  rating: number;
  text: string;
  reviewerName?: string;
  date: Date;
  propertyType?: string;
  transactionType?: 'bought' | 'sold';
}

export class AgentDataService {
  private apifyClient: ApifyClient;
  
  constructor() {
    this.apifyClient = new ApifyClient({
      token: process.env.APIFY_API_KEY!,
    });
  }
  
  /**
   * Fetch agent data from multiple sources
   */
  async fetchAgentsByLocation(
    city: string, 
    state: string, 
    radius: number = 10
  ): Promise<AgentData[]> {
    const agents: AgentData[] = [];
    
    // 1. Fetch from Zillow via Apify
    try {
      const zillowAgents = await this.fetchZillowAgents(city, state);
      agents.push(...zillowAgents);
    } catch (error) {
      console.error('Error fetching Zillow agents:', error);
    }
    
    // 2. Fetch from Realtor.com via Apify
    try {
      const realtorAgents = await this.fetchRealtorAgents(city, state);
      agents.push(...realtorAgents);
    } catch (error) {
      console.error('Error fetching Realtor agents:', error);
    }
    
    // 3. Deduplicate by license number or name+city
    return this.deduplicateAgents(agents);
  }
  
  /**
   * Fetch agents from Zillow using Apify scraper
   */
  private async fetchZillowAgents(city: string, state: string): Promise<AgentData[]> {
    const input = {
      searchLocation: `${city}, ${state}`,
      maxItems: 100,
      includeReviews: true,
    };
    
    const run = await this.apifyClient.actor('pocesar/zillow-agent-scraper').call(input);
    const { items } = await this.apifyClient.dataset(run.defaultDatasetId).listItems();
    
    return items.map((item: any) => ({
      id: `zillow_${item.profileUrl?.split('/').pop()}`,
      name: item.name,
      photo: item.photoUrl,
      licenseNumber: item.licenseNumber,
      brokerageName: item.brokerageName,
      phone: item.phone,
      email: item.email,
      website: item.website,
      city: item.city,
      state: item.state,
      zipCode: item.zipCode,
      serviceAreas: item.serviceAreas || [],
      averageRating: item.rating,
      totalReviews: item.reviewCount,
      recentSales: item.recentSalesCount,
      yearsExperience: item.yearsExperience,
      source: 'zillow' as const,
      sourceUrl: item.profileUrl,
      lastUpdated: new Date(),
    }));
  }
  
  /**
   * Fetch agents from Realtor.com using Apify scraper
   */
  private async fetchRealtorAgents(city: string, state: string): Promise<AgentData[]> {
    const input = {
      location: `${city}, ${state}`,
      maxAgents: 100,
    };
    
    const run = await this.apifyClient.actor('misceres/realtor-com-agents-scraper').call(input);
    const { items } = await this.apifyClient.dataset(run.defaultDatasetId).listItems();
    
    return items.map((item: any) => ({
      id: `realtor_${item.id}`,
      name: item.fullName,
      photo: item.photo,
      licenseNumber: item.licenseNumber,
      brokerageName: item.officeName,
      phone: item.phone,
      email: item.email,
      website: item.webUrl,
      city: item.city,
      state: item.state,
      zipCode: item.zip,
      serviceAreas: item.serviceAreas || [],
      averageRating: item.rating,
      totalReviews: item.reviewCount,
      recentSales: item.recentSalesCount,
      yearsExperience: item.experienceYears,
      source: 'realtor' as const,
      sourceUrl: item.webUrl,
      lastUpdated: new Date(),
    }));
  }
  
  /**
   * Fetch agent reviews from Zillow Bridge API
   */
  async fetchAgentReviews(agentZillowId: string): Promise<AgentReview[]> {
    // This would use the Zillow Bridge API once you have access
    // For now, returning mock structure
    const bridgeApiKey = process.env.ZILLOW_BRIDGE_API_KEY;
    
    if (!bridgeApiKey) {
      console.warn('Zillow Bridge API key not configured');
      return [];
    }
    
    try {
      const response = await fetch(
        `https://api.bridgedataoutput.com/api/v2/zillow/agents/${agentZillowId}/reviews`,
        {
          headers: {
            'Authorization': `Bearer ${bridgeApiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (!response.ok) {
        throw new Error(`Bridge API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      return data.reviews.map((review: any) => ({
        id: review.id,
        agentId: agentZillowId,
        rating: review.rating,
        text: review.comment,
        reviewerName: review.reviewerName,
        date: new Date(review.createdDate),
        propertyType: review.propertyType,
        transactionType: review.transactionType,
      }));
    } catch (error) {
      console.error('Error fetching reviews from Bridge API:', error);
      return [];
    }
  }
  
  /**
   * Deduplicate agents from multiple sources
   */
  private deduplicateAgents(agents: AgentData[]): AgentData[] {
    const seen = new Map<string, AgentData>();
    
    for (const agent of agents) {
      // Try to match by license number first
      const key = agent.licenseNumber || `${agent.name}_${agent.city}`.toLowerCase();
      
      if (!seen.has(key)) {
        seen.set(key, agent);
      } else {
        // Merge data from multiple sources
        const existing = seen.get(key)!;
        seen.set(key, {
          ...existing,
          // Prefer Zillow ratings if available
          averageRating: agent.source === 'zillow' && agent.averageRating 
            ? agent.averageRating 
            : existing.averageRating,
          totalReviews: Math.max(
            agent.totalReviews || 0, 
            existing.totalReviews || 0
          ),
          // Merge service areas
          serviceAreas: [
            ...new Set([
              ...(existing.serviceAreas || []),
              ...(agent.serviceAreas || []),
            ])
          ],
        });
      }
    }
    
    return Array.from(seen.values());
  }
  
  /**
   * Calculate composite rating from multiple sources
   */
  calculateCompositeRating(agents: AgentData[]): number {
    const ratings = agents
      .filter(a => a.averageRating)
      .map(a => a.averageRating!);
    
    if (ratings.length === 0) return 0;
    
    return ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
  }
}