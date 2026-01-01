import { ApifyClient } from 'apify-client';

const client = new ApifyClient({ token: process.env.APIFY_API_KEY! });

async function checkProperties() {
  // Use full URLs from the database
  const urls = [
    { url: 'https://www.zillow.com/homedetails/171-Flintlock-Trl-Pocono-Pines-PA-18350/9841251_zpid/' },
    { url: 'https://www.zillow.com/homedetails/256-Yellow-Snapdragon-Dr-Davenport-FL-33837/98499953_zpid/' },
    { url: 'https://www.zillow.com/homedetails/222-N-El-Paso-Ave-Tulia-TX-79088/97203513_zpid/' },
    { url: 'https://www.zillow.com/homedetails/2709-Robert-Hiram-Dr-Gautier-MS-39553/91623657_zpid/' },
  ];

  console.log('Running Apify scraper for properties...\n');

  const run = await client.actor('maxcopell/zillow-detail-scraper').call({
    startUrls: urls,
  });

  const { items } = await client.dataset(run.defaultDatasetId).listItems({
    clean: false,
    limit: 10,
  });

  console.log(`Got ${items.length} results:\n`);

  items.forEach((item: any) => {
    console.log(`ZPID: ${item.zpid || item.id}`);
    console.log(`  Address: ${item.address?.streetAddress || 'N/A'}`);
    console.log(`  homeStatus: ${item.homeStatus || 'N/A'}`);
    console.log(`  keystoneHomeStatus: ${item.keystoneHomeStatus || 'N/A'}`);
    console.log(`  price: ${item.price || item.listPrice || 'N/A'}`);
    console.log(`  daysOnZillow: ${item.daysOnZillow || 'N/A'}`);
    console.log(`  homeType: ${item.homeType || item.propertyType || 'N/A'}`);
    console.log(`  listingSubType: ${JSON.stringify(item.listingSubType) || 'N/A'}`);
    console.log(`  listing_sub_type: ${JSON.stringify(item.listing_sub_type) || 'N/A'}`);
    console.log(`  listingTypeDimension: ${item.listingTypeDimension || 'N/A'}`);
    console.log(`  foreclosureTypes: ${JSON.stringify(item.foreclosureTypes) || 'N/A'}`);
    console.log(`  dateSold: ${item.dateSold || 'N/A'}`);
    console.log(`  dateSoldString: ${item.dateSoldString || 'N/A'}`);
    console.log(`  isRentalListingOffMarket: ${item.isRentalListingOffMarket || 'N/A'}`);
    console.log(`  description snippet: ${(item.description || '').slice(0, 200)}...`);
    console.log('');
  });
}

checkProperties().catch(console.error);
