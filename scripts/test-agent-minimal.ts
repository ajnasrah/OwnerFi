import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function testMinimalAgentScrape() {
  const apifyClient = new ApifyClient({
    token: process.env.APIFY_API_KEY!,
  });

  console.log('🔍 Testing minimal agent scraping (3 agents max)...\n');
  
  try {
    // Use the generic web scraper with VERY limited scope
    const input = {
      startUrls: [
        { url: 'https://www.zillow.com/professionals/real-estate-agent-reviews/memphis-tn/' }
      ],
      maxPagesPerCrawl: 1, // Only scrape 1 page
      maxRequestsPerCrawl: 3, // Limit total requests
      maxRequestRetries: 1,
      proxyConfiguration: {
        useApifyProxy: true,
        apifyProxyGroups: ['RESIDENTIAL'],
      },
      pageFunction: `async function pageFunction(context) {
        const { page, request } = context;
        const agents = [];
        
        // Wait for content
        await page.waitForSelector('body', { timeout: 5000 });
        
        // Get page title to verify we're on the right page
        const title = await page.title();
        console.log('Page title:', title);
        
        // Try to find agent elements (various possible selectors)
        const selectors = [
          '.professional-card',
          '[data-test="agent-card"]',
          '.agent-card',
          '.StyledCard-c11n-8-99-0__sc-1w6p5d4-0',
          'article[data-test-id="agent-card"]'
        ];
        
        for (const selector of selectors) {
          const elements = await page.$$(selector);
          if (elements.length > 0) {
            console.log(\`Found \${elements.length} elements with selector: \${selector}\`);
            
            // Only process first 3 agents
            for (let i = 0; i < Math.min(3, elements.length); i++) {
              const element = elements[i];
              const agent = await element.evaluate(el => {
                const getText = (selector) => el.querySelector(selector)?.textContent?.trim() || '';
                const getHref = (selector) => el.querySelector(selector)?.href || '';
                
                return {
                  name: getText('h3, .agent-name, [data-test="agent-name"]'),
                  phone: getText('a[href^="tel:"], .agent-phone'),
                  rating: getText('.rating, [aria-label*="rating"]'),
                  reviewCount: getText('.review-count, [data-test="review-count"]'),
                  profileUrl: getHref('a[href*="/profile/"]'),
                  brokerage: getText('.brokerage-name, [data-test="brokerage"]'),
                };
              });
              
              if (agent.name) {
                agents.push(agent);
              }
            }
            break; // Found agents, stop looking
          }
        }
        
        // If no specific selectors work, try generic approach
        if (agents.length === 0) {
          const links = await page.$$eval('a[href*="professionals"]', links => 
            links.slice(0, 3).map(link => ({
              name: link.textContent?.trim() || 'Unknown',
              profileUrl: link.href
            }))
          );
          agents.push(...links);
        }
        
        return {
          url: request.url,
          agents,
          agentCount: agents.length
        };
      }`.replace(/\n\s+/g, '\n'),
    };
    
    console.log('Running web scraper with minimal settings...');
    console.log('Max pages: 1, Max requests: 3\n');
    
    const run = await apifyClient.actor('apify/web-scraper').call(input);
    console.log('✅ Scraper started, run ID:', run.id);
    
    // Wait for completion
    await apifyClient.run(run.id).waitForFinish();
    
    const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
    
    console.log(`\n📊 Results:`);
    console.log(`Total items returned: ${items.length}`);
    
    if (items.length > 0) {
      const data = items[0];
      console.log(`\nPage URL: ${data.url}`);
      console.log(`Agents found: ${data.agentCount || 0}`);
      
      if (data.agents && data.agents.length > 0) {
        console.log('\n👥 Agent Details:');
        data.agents.forEach((agent: any, index: number) => {
          console.log(`\n${index + 1}. ${agent.name || 'Unknown'}`);
          if (agent.phone) console.log(`   📞 ${agent.phone}`);
          if (agent.rating) console.log(`   ⭐ ${agent.rating}`);
          if (agent.reviewCount) console.log(`   💬 ${agent.reviewCount} reviews`);
          if (agent.brokerage) console.log(`   🏢 ${agent.brokerage}`);
        });
      }
    }
    
    // Check run statistics
    const runInfo = await apifyClient.run(run.id).get();
    console.log('\n📈 Usage Statistics:');
    console.log(`   Compute units: ${runInfo?.stats?.computeUnits || 0}`);
    console.log(`   Dataset items: ${runInfo?.stats?.datasetItemCount || 0}`);
    console.log(`   Request count: ${runInfo?.stats?.requestsFinished || 0}`);
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error('Details:', error);
  }
}

// Run the test
testMinimalAgentScrape().catch(console.error);