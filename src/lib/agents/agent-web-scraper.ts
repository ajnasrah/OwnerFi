import { ApifyClient } from 'apify-client';

export interface ScrapedAgent {
  name: string;
  phone?: string;
  email?: string;
  profileUrl?: string;
  imageUrl?: string;
  rating?: number;
  reviewCount?: number;
  recentSales?: number;
  yearsExperience?: number;
  brokerageName?: string;
  licenseNumber?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  bio?: string;
  specialties?: string[];
  languages?: string[];
  source: 'zillow' | 'realtor' | 'redfin' | 'other';
}

export class AgentWebScraper {
  private apifyClient: ApifyClient;
  
  constructor(apiKey: string) {
    this.apifyClient = new ApifyClient({ token: apiKey });
  }
  
  /**
   * Scrape agents using a general web scraper
   */
  async scrapeAgentsFromWeb(
    city: string, 
    state: string, 
    options: {
      maxAgents?: number;
      sources?: ('zillow' | 'realtor' | 'redfin')[];
    } = {}
  ): Promise<ScrapedAgent[]> {
    const maxAgents = options.maxAgents || 50;
    const sources = options.sources || ['zillow', 'realtor'];
    const allAgents: ScrapedAgent[] = [];
    
    for (const source of sources) {
      try {
        const agents = await this.scrapeBySource(source, city, state, maxAgents);
        allAgents.push(...agents);
      } catch (error) {
        console.error(`Error scraping ${source}:`, error);
      }
    }
    
    return this.deduplicateAgents(allAgents);
  }
  
  private async scrapeBySource(
    source: 'zillow' | 'realtor' | 'redfin',
    city: string,
    state: string,
    maxAgents: number
  ): Promise<ScrapedAgent[]> {
    const urls = this.buildSearchUrls(source, city, state);
    
    // Use a generic web scraper
    const input = {
      startUrls: urls.map(url => ({ url })),
      maxPagesPerCrawl: Math.ceil(maxAgents / 10), // Estimate 10 agents per page
      proxyConfiguration: {
        useApifyProxy: true,
      },
      pageFunction: this.getPageFunction(source),
    };
    
    try {
      // Use the generic web scraper actor
      const run = await this.apifyClient.actor('apify/web-scraper').call(input);
      const { items } = await this.apifyClient.dataset(run.defaultDatasetId).listItems();
      
      return items.map((item: any) => this.normalizeAgent(item, source));
    } catch (error) {
      console.error(`Failed to scrape ${source}:`, error);
      return [];
    }
  }
  
  private buildSearchUrls(source: string, city: string, state: string): string[] {
    const citySlug = city.toLowerCase().replace(/\s+/g, '-');
    const stateCode = state.toUpperCase();
    
    switch (source) {
      case 'zillow':
        return [
          `https://www.zillow.com/professionals/real-estate-agent-reviews/${citySlug}-${stateCode.toLowerCase()}/`,
          `https://www.zillow.com/${citySlug}-${stateCode.toLowerCase()}/real-estate-agents/`,
        ];
        
      case 'realtor':
        return [
          `https://www.realtor.com/realestateagents/${citySlug}_${stateCode}`,
          `https://www.realtor.com/realestateagents/${stateCode}/${citySlug}`,
        ];
        
      case 'redfin':
        return [
          `https://www.redfin.com/real-estate-agents/${citySlug}-${stateCode.toLowerCase()}`,
        ];
        
      default:
        return [];
    }
  }
  
  private getPageFunction(source: string): string {
    // Return JavaScript code that will be executed on each page
    switch (source) {
      case 'zillow':
        return `
          async function pageFunction(context) {
            const agents = [];
            
            // Zillow agent cards selector
            const agentCards = document.querySelectorAll('[data-test="agent-card"], .agent-card, .professional-card');
            
            for (const card of agentCards) {
              const agent = {
                name: card.querySelector('.agent-name, [data-test="agent-name"], h3')?.textContent?.trim(),
                phone: card.querySelector('.agent-phone, [data-test="phone"], a[href^="tel:"]')?.textContent?.trim(),
                rating: parseFloat(card.querySelector('.rating, [data-test="rating"], .stars')?.getAttribute('data-rating') || '0'),
                reviewCount: parseInt(card.querySelector('.review-count, [data-test="review-count"]')?.textContent?.match(/\\d+/)?.[0] || '0'),
                profileUrl: card.querySelector('a[href*="/profile/"], a[href*="/professionals/"]')?.href,
                imageUrl: card.querySelector('img.agent-photo, img[data-test="agent-photo"]')?.src,
                brokerageName: card.querySelector('.brokerage-name, [data-test="brokerage"]')?.textContent?.trim(),
                recentSales: parseInt(card.querySelector('.recent-sales, [data-test="sales"]')?.textContent?.match(/\\d+/)?.[0] || '0'),
              };
              
              if (agent.name) {
                agents.push(agent);
              }
            }
            
            return agents;
          }
        `;
        
      case 'realtor':
        return `
          async function pageFunction(context) {
            const agents = [];
            
            // Realtor.com agent cards selector
            const agentCards = document.querySelectorAll('.agent-list-card, .jsx-AgentListCard, [data-testid="agent-card"]');
            
            for (const card of agentCards) {
              const agent = {
                name: card.querySelector('.agent-name, .jsx-AgentName, h2')?.textContent?.trim(),
                phone: card.querySelector('.agent-phone, a[href^="tel:"]')?.textContent?.trim(),
                rating: parseFloat(card.querySelector('.rating-average, .agent-rating')?.textContent || '0'),
                reviewCount: parseInt(card.querySelector('.rating-count, .review-count')?.textContent?.match(/\\d+/)?.[0] || '0'),
                profileUrl: card.querySelector('a.agent-name, a[href*="/realestateagents/"]')?.href,
                imageUrl: card.querySelector('.agent-photo img, img.agent-image')?.src,
                brokerageName: card.querySelector('.agent-group, .brokerage-name')?.textContent?.trim(),
                yearsExperience: parseInt(card.querySelector('.experience-years')?.textContent?.match(/\\d+/)?.[0] || '0'),
                specialties: Array.from(card.querySelectorAll('.specialties li, .agent-specialty')).map(el => el.textContent?.trim()),
              };
              
              if (agent.name) {
                agents.push(agent);
              }
            }
            
            return agents;
          }
        `;
        
      default:
        return '{}';
    }
  }
  
  private normalizeAgent(item: any, source: 'zillow' | 'realtor' | 'redfin' | 'other'): ScrapedAgent {
    return {
      name: item.name || 'Unknown',
      phone: item.phone,
      email: item.email,
      profileUrl: item.profileUrl,
      imageUrl: item.imageUrl,
      rating: item.rating || 0,
      reviewCount: item.reviewCount || 0,
      recentSales: item.recentSales || 0,
      yearsExperience: item.yearsExperience || 0,
      brokerageName: item.brokerageName,
      licenseNumber: item.licenseNumber,
      city: item.city,
      state: item.state,
      zipCode: item.zipCode,
      bio: item.bio,
      specialties: item.specialties || [],
      languages: item.languages || ['English'],
      source,
    };
  }
  
  private deduplicateAgents(agents: ScrapedAgent[]): ScrapedAgent[] {
    const seen = new Map<string, ScrapedAgent>();
    
    for (const agent of agents) {
      const key = `${agent.name}_${agent.city}`.toLowerCase();
      
      if (!seen.has(key)) {
        seen.set(key, agent);
      } else {
        // Merge data, prefer agents with more information
        const existing = seen.get(key)!;
        if ((agent.rating || 0) > (existing.rating || 0)) {
          seen.set(key, { ...existing, ...agent });
        }
      }
    }
    
    return Array.from(seen.values());
  }
}