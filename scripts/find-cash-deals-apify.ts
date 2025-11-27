import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const APIFY_TOKEN = process.env.APIFY_API_KEY!;

// The 3 big search datasets
const DATASETS = [
  '9i1qNYmg5zsel8m0W',  // 13,693 items
  'XDYWAO3Jqx5qpeSjp',  // 13,687 items
  'I19aymvYMfvgzj1y5',  // 11,424 items (aborted but has data)
];

interface Property {
  address: string;
  price: number;
  zestimate: number;
  percentOfZestimate: number;
  url: string;
  beds: number;
  baths: number;
  statusType: string;
}

async function findCashDeals() {
  console.log('=== FINDING CASH DEALS FROM 36K APIFY DATA ===\n');
  console.log('Criteria: Price < 70% of Zestimate\n');

  const cashDeals: Property[] = [];
  let totalChecked = 0;
  let withBothPrices = 0;

  for (const datasetId of DATASETS) {
    console.log(`Fetching dataset ${datasetId}...`);

    let offset = 0;
    const limit = 1000;

    while (true) {
      const res = await fetch(
        `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&limit=${limit}&offset=${offset}`
      );
      const items = await res.json();

      if (!items || items.length === 0) break;

      for (const item of items) {
        totalChecked++;

        const price = item.unformattedPrice || item.price;
        const zestimate = item.zestimate;

        if (price && zestimate && price > 0 && zestimate > 0) {
          withBothPrices++;
          const percent = (price / zestimate) * 100;

          if (percent < 70) {
            cashDeals.push({
              address: item.address || `${item.addressStreet}, ${item.addressCity}, ${item.addressState}`,
              price,
              zestimate,
              percentOfZestimate: percent,
              url: item.detailUrl,
              beds: item.beds,
              baths: item.baths,
              statusType: item.statusType
            });
          }
        }
      }

      offset += limit;
      if (items.length < limit) break;
    }
  }

  console.log(`\n=== RESULTS ===`);
  console.log(`Total properties checked: ${totalChecked.toLocaleString()}`);
  console.log(`With both price & zestimate: ${withBothPrices.toLocaleString()}`);
  console.log(`\n💰 CASH DEALS (under 70% of Zestimate): ${cashDeals.length}\n`);

  // Sort by best deal first
  cashDeals.sort((a, b) => a.percentOfZestimate - b.percentOfZestimate);

  // Show all cash deals
  for (const deal of cashDeals) {
    console.log(`Address: ${deal.address}`);
    console.log(`Price: $${deal.price.toLocaleString()}`);
    console.log(`Zestimate: $${deal.zestimate.toLocaleString()}`);
    console.log(`Ratio: ${deal.percentOfZestimate.toFixed(1)}% (${(100 - deal.percentOfZestimate).toFixed(1)}% discount)`);
    console.log(`Beds/Baths: ${deal.beds}bd / ${deal.baths}ba`);
    console.log(`Status: ${deal.statusType}`);
    console.log(`URL: ${deal.url}`);
    console.log('---');
  }
}

findCashDeals().catch(console.error);
