// Test new candidate RSS feeds
import { fetchRSSFeed } from '../src/lib/rss-fetcher';

const candidateFeeds = {
  vassdistro: [
    { name: 'VapingPost', url: 'https://www.vapingpost.com/feed/' },
    { name: 'Tobacco Journal International', url: 'https://www.tobaccojournal.com/feed/' },
    { name: 'Vaping360', url: 'https://vaping360.com/feed/' },
    { name: '2FIRSTS', url: 'https://www.2firsts.com/feed/' },
  ],
  ownerfi: [
    { name: 'Inman News', url: 'https://www.inman.com/feed/' },
    { name: 'Inside Mortgage Finance', url: 'https://www.insidemortgagefinance.com/feed/' },
    { name: 'Mortgage Professional America', url: 'https://www.mpamag.com/us/feed/' },
    { name: 'The Close', url: 'https://theclose.com/feed/' },
    { name: 'Bankrate Real Estate', url: 'https://www.bankrate.com/real-estate/feed/' },
  ],
  carz: [
    { name: 'Green Car Reports', url: 'https://www.greencarreports.com/rss/news' },
    { name: 'Motor Authority', url: 'https://www.motorauthority.com/rss/news' },
    { name: 'ChargedEVs', url: 'https://chargedevs.com/feed/' },
    { name: 'Autoweek', url: 'https://www.autoweek.com/rss/' },
    { name: 'CleanTechnica', url: 'https://cleantechnica.com/feed/' },
  ]
};

async function testFeeds() {
  console.log('🧪 TESTING NEW CANDIDATE RSS FEEDS\n');
  console.log('='.repeat(70));

  for (const [brand, feeds] of Object.entries(candidateFeeds)) {
    console.log(`\n\n📊 ${brand.toUpperCase()}`);
    console.log('-'.repeat(70));

    for (const feed of feeds) {
      console.log(`\n🔍 Testing: ${feed.name}`);
      console.log(`   URL: ${feed.url}`);

      try {
        const rss = await fetchRSSFeed(feed.url);

        console.log(`   ✅ Feed fetched successfully!`);
        console.log(`   Articles: ${rss.items.length}`);

        if (rss.items.length === 0) {
          console.log(`   ❌ EMPTY FEED - Skip`);
          continue;
        }

        // Test first 3 articles
        const samples = rss.items.slice(0, 3);
        let excellent = 0;
        let adequate = 0;
        let poor = 0;

        samples.forEach((item, i) => {
          const content = item.content || item.description || '';
          const length = content.length;

          if (length >= 1000) excellent++;
          else if (length >= 200) adequate++;
          else poor++;

          if (i === 0) {
            console.log(`   Sample article: "${item.title.substring(0, 50)}..."`);
            console.log(`   Content length: ${length} chars`);
          }
        });

        const quality = excellent >= 2 ? 'EXCELLENT ✅' :
                       adequate + excellent >= 2 ? 'ADEQUATE ⚠️' : 'POOR ❌';

        console.log(`   Quality: ${quality} (Excellent: ${excellent}, Adequate: ${adequate}, Poor: ${poor})`);

        if (excellent >= 2 || adequate + excellent >= 2) {
          console.log(`   ✅ RECOMMEND ADDING THIS FEED`);
        } else {
          console.log(`   ❌ Skip - insufficient content`);
        }

      } catch (error) {
        console.log(`   ❌ FAILED: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  console.log('\n\n' + '='.repeat(70));
  console.log('✅ TESTING COMPLETE\n');
}

testFeeds()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
