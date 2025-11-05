#!/usr/bin/env tsx
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

async function analyzeFirstComments() {
  const LATE_API_KEY = process.env.LATE_API_KEY;

  console.log('💬 FIRST COMMENT ANALYSIS\n');
  console.log('What first comments do top posts use?\n');
  console.log('═'.repeat(100));

  // Fetch all posts
  let allPosts: any[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(`https://getlate.dev/api/v1/analytics?limit=100&page=${page}`, {
      headers: {
        'Authorization': `Bearer ${LATE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    allPosts = allPosts.concat(data.posts || []);

    if (data.pagination && page < data.pagination.pages) {
      page++;
    } else {
      hasMore = false;
    }
  }

  console.log(`\nTotal posts fetched: ${allPosts.length}\n`);

  // Check if posts have firstComment field
  const postsWithFirstComment = allPosts.filter(p => p.firstComment);

  console.log(`Posts with first comment: ${postsWithFirstComment.length}\n`);

  if (postsWithFirstComment.length > 0) {
    console.log('📝 EXAMPLES OF FIRST COMMENTS:\n');

    postsWithFirstComment.slice(0, 20).forEach((post, idx) => {
      console.log(`${idx + 1}. First Comment: "${post.firstComment}"`);
      console.log(`   Caption: "${(post.content || '').substring(0, 80)}..."`);
      console.log('');
    });
  } else {
    console.log('⚠️  No posts have firstComment field in the API response.\n');
    console.log('This might mean:');
    console.log('   1. First comments aren\'t being tracked by Late.dev API');
    console.log('   2. No posts have been created with first comments yet');
    console.log('   3. The field is named differently in the API\n');

    console.log('Let me check the full structure of a post...\n');

    if (allPosts.length > 0) {
      console.log('Sample post structure:');
      console.log(JSON.stringify(allPosts[0], null, 2));
    }
  }

  console.log('\n' + '═'.repeat(100));
  console.log('\n💡 FIRST COMMENT STRATEGY RECOMMENDATIONS:\n');
  console.log('Based on social media best practices, first comments should:');
  console.log('   1. Add additional hashtags (for discoverability)');
  console.log('   2. Include a call-to-action');
  console.log('   3. Ask an engagement question');
  console.log('   4. Link to resources (bio link, website)');
  console.log('   5. Add context or bonus info not in caption\n');

  console.log('Example First Comments for OwnerFi:\n');

  console.log('OPTION 1 - Additional Hashtags:');
  console.log('   "💬 Tag someone who needs to see this! #mortgage #creditrepair #firsttimehomebuyer #renters #financialfreedom #wealth"\n');

  console.log('OPTION 2 - CTA + Question:');
  console.log('   "Ready to stop renting? Drop a 🏠 if you want to learn more about owner financing!"\n');

  console.log('OPTION 3 - Resource Link:');
  console.log('   "Want to find owner financed homes? Link in bio to search available properties 👆"\n');

  console.log('OPTION 4 - Bonus Context:');
  console.log('   "This works even if you\'re self-employed, have student loans, or been rejected by banks. No minimum credit score required!"\n');

  console.log('═'.repeat(100));
}

analyzeFirstComments().catch(console.error);
