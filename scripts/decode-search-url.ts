import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const APIFY_TOKEN = process.env.APIFY_API_KEY!;

async function decodeSearchUrl() {
  const res = await fetch(
    `https://api.apify.com/v2/datasets/9i1qNYmg5zsel8m0W/items?token=${APIFY_TOKEN}&limit=1`
  );
  const items = await res.json();

  const foundFromSearchUrl = items[0]?.foundFromSearchUrl;

  if (!foundFromSearchUrl) {
    console.log('No foundFromSearchUrl found');
    return;
  }

  console.log('Raw URL:', foundFromSearchUrl.substring(0, 100) + '...\n');

  try {
    const url = new URL(foundFromSearchUrl);
    const searchQueryState = url.searchParams.get('searchQueryState');

    if (searchQueryState) {
      const state = JSON.parse(decodeURIComponent(searchQueryState));
      console.log('=== SEARCH FILTERS USED ===\n');
      console.log(JSON.stringify(state.filterState, null, 2));

      // Check for owner finance keywords
      if (state.filterState?.att) {
        console.log('\n✅ HAS OWNER FINANCE KEYWORDS (att):');
        console.log(state.filterState.att.value);
      } else {
        console.log('\n❌ NO OWNER FINANCE KEYWORDS (att) - THIS IS A PROBLEM!');
      }
    }
  } catch (e) {
    console.log('Error parsing URL:', e);
  }
}

decodeSearchUrl();
