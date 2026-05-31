import { runSearchScraper } from '../src/lib/scraper-v2/apify-client';

async function testSearch() {
  // Try a simpler search - just US with owner finance keywords
  const url = 'https://www.zillow.com/homes/for_sale/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22north%22%3A49.00244%2C%22south%22%3A24.39631%2C%22east%22%3A-66.93457%2C%22west%22%3A-125.00011%7D%2C%22mapZoom%22%3A4%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22keywords%22%3A%7B%22value%22%3A%22owner%20finance%20OR%20owner%20financing%20OR%20seller%20finance%20OR%20seller%20financing%20OR%20rent%20to%20own%22%7D%7D%2C%22isListVisible%22%3Atrue%7D';
  
  console.log('Testing simpler owner finance search (US only, no date filters)...');
  const results = await runSearchScraper([url], { maxResults: 500, mode: 'pagination' });
  console.log('Found:', results.length, 'properties');
  
  if (results.length > 0) {
    console.log('\nFirst few properties:');
    results.slice(0, 3).forEach((p: any) => {
      console.log(`- ${p.streetAddress}, ${p.city}, ${p.state} - $${p.price}`);
    });
  }
}

testSearch().catch(console.error);