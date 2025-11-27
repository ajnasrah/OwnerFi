import { NextRequest, NextResponse } from 'next/server';
import { ApifyClient } from 'apify-client';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Extend function timeout to 5 minutes for scraping
export const maxDuration = 300;

// Initialize Firebase Admin
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    }),
  });
}

const db = getFirestore();

/**
 * CRON: Facebook Group Lead Scraper
 *
 * Scrapes comments from Facebook group posts to extract buyer emails
 * for creative financing leads.
 *
 * Process:
 * 1. Fetch configured Facebook group posts
 * 2. Use Apify to scrape comments from each post
 * 3. Extract emails from comment text using regex
 * 4. Deduplicate against existing leads
 * 5. Push new leads to GoHighLevel as contacts
 *
 * Schedule: Daily at 8 AM
 */

// Email extraction regex - handles common email formats
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;

// GHL API configuration
const GHL_API_BASE = 'https://services.leadconnectorhq.com';

interface FacebookPost {
  url: string;
  groupName: string;
  postDescription?: string;
}

interface ExtractedLead {
  email: string;
  commenterName?: string;
  commentText: string;
  postUrl: string;
  groupName: string;
  extractedAt: Date;
}

/**
 * Extract all emails from comment text
 */
function extractEmails(text: string): string[] {
  if (!text) return [];
  const matches = text.match(EMAIL_REGEX);
  if (!matches) return [];

  // Normalize and dedupe emails from this comment
  const uniqueEmails = [...new Set(matches.map(email => email.toLowerCase().trim()))];

  // Filter out obvious fake/invalid emails
  return uniqueEmails.filter(email => {
    // Skip example domains
    if (email.includes('example.com') || email.includes('test.com')) return false;
    // Skip if email is too short
    if (email.length < 6) return false;
    // Skip common placeholder patterns
    if (email.includes('xxx') || email.includes('___')) return false;
    return true;
  });
}

/**
 * Create or update a contact in GoHighLevel
 */
async function syncLeadToGHL(lead: ExtractedLead): Promise<{ success: boolean; contactId?: string; error?: string }> {
  const GHL_API_KEY = process.env.GHL_API_KEY;
  const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;
  const GHL_FB_LEADS_TAG = process.env.GHL_FB_LEADS_TAG || 'facebook-lead';

  if (!GHL_API_KEY || !GHL_LOCATION_ID) {
    return { success: false, error: 'GHL API credentials not configured' };
  }

  try {
    // Check if contact already exists by email
    const searchResponse = await fetch(
      `${GHL_API_BASE}/contacts/lookup?locationId=${GHL_LOCATION_ID}&email=${encodeURIComponent(lead.email)}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${GHL_API_KEY}`,
          'Version': '2021-07-28',
        },
      }
    );

    let contactId: string | undefined;

    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      if (searchData.contacts && searchData.contacts.length > 0) {
        contactId = searchData.contacts[0].id;
        console.log(`   📋 Contact already exists in GHL: ${lead.email}`);
        return { success: true, contactId };
      }
    }

    // Create new contact
    const contactPayload = {
      locationId: GHL_LOCATION_ID,
      email: lead.email,
      name: lead.commenterName || '',
      tags: [GHL_FB_LEADS_TAG, 'creative-financing-buyer'],
      source: 'Facebook Group',
      customFields: [
        { id: 'lead_source_group', value: lead.groupName },
        { id: 'lead_source_post', value: lead.postUrl },
        { id: 'original_comment', value: lead.commentText.slice(0, 500) },
      ],
    };

    const createResponse = await fetch(`${GHL_API_BASE}/contacts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GHL_API_KEY}`,
        'Content-Type': 'application/json',
        'Version': '2021-07-28',
      },
      body: JSON.stringify(contactPayload),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      return { success: false, error: `GHL API error: ${createResponse.status} - ${errorText}` };
    }

    const createData = await createResponse.json();
    contactId = createData.contact?.id;

    console.log(`   ✅ Created new contact in GHL: ${lead.email}`);
    return { success: true, contactId };

  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  console.log('📱 [FACEBOOK LEAD SCRAPER] Starting...');

  // Security check
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    console.error('❌ [FACEBOOK LEAD SCRAPER] Unauthorized request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const apiKey = process.env.APIFY_API_KEY;
    if (!apiKey) {
      throw new Error('APIFY_API_KEY not found');
    }

    const client = new ApifyClient({ token: apiKey });

    // Get configured Facebook posts from Firestore
    const configDoc = await db.collection('scraper_config').doc('facebook_posts').get();

    let facebookPosts: FacebookPost[] = [];

    if (configDoc.exists) {
      const config = configDoc.data();
      facebookPosts = config?.posts || [];
    }

    if (facebookPosts.length === 0) {
      console.log('⚠️  [FACEBOOK LEAD SCRAPER] No Facebook posts configured');
      console.log('   Add posts to Firestore: scraper_config/facebook_posts.posts[]');
      return NextResponse.json({
        success: false,
        error: 'No Facebook posts configured',
        message: 'Add posts to Firestore collection: scraper_config/facebook_posts',
      });
    }

    console.log(`📋 [FACEBOOK LEAD SCRAPER] Found ${facebookPosts.length} posts to scrape`);

    const stats = {
      postsScraped: 0,
      commentsScraped: 0,
      emailsExtracted: 0,
      newLeadsAdded: 0,
      duplicatesSkipped: 0,
      ghlSynced: 0,
      ghlFailed: 0,
      errors: [] as string[],
    };

    // Process each Facebook post
    for (const post of facebookPosts) {
      console.log(`\n🔍 Scraping: ${post.groupName}`);
      console.log(`   URL: ${post.url}`);

      try {
        // Run Apify Facebook Comments Scraper
        const scraperInput = {
          startUrls: [{ url: post.url }],
          maxComments: 1000,
          sortBy: 'NEWEST',
        };

        const run = await client.actor('apify/facebook-comments-scraper').call(scraperInput);
        const { items: comments } = await client.dataset(run.defaultDatasetId).listItems();

        stats.postsScraped++;
        stats.commentsScraped += comments.length;

        console.log(`   📝 Found ${comments.length} comments`);

        // Extract emails from each comment
        for (const comment of comments) {
          const commentData = comment as any;
          const commentText = commentData.text || commentData.message || '';
          const commenterName = commentData.authorName || commentData.profileName || '';
          const commentId = commentData.id || commentData.commentId || '';

          const emails = extractEmails(commentText);

          if (emails.length === 0) continue;

          stats.emailsExtracted += emails.length;

          // Process each email found in comment
          for (const email of emails) {
            // Check if we've already processed this email
            const existingLead = await db
              .collection('facebook_buyer_leads')
              .where('email', '==', email)
              .limit(1)
              .get();

            if (!existingLead.empty) {
              stats.duplicatesSkipped++;
              continue;
            }

            // Create lead record
            const lead: ExtractedLead = {
              email,
              commenterName,
              commentText: commentText.slice(0, 1000),
              postUrl: post.url,
              groupName: post.groupName,
              extractedAt: new Date(),
            };

            // Save to Firestore
            await db.collection('facebook_buyer_leads').add({
              ...lead,
              commentId,
              status: 'new',
              ghlSynced: false,
              createdAt: new Date(),
            });

            stats.newLeadsAdded++;

            // Sync to GoHighLevel
            const ghlResult = await syncLeadToGHL(lead);

            if (ghlResult.success) {
              stats.ghlSynced++;

              // Update Firestore record with GHL sync status
              const leadRef = await db
                .collection('facebook_buyer_leads')
                .where('email', '==', email)
                .limit(1)
                .get();

              if (!leadRef.empty) {
                await leadRef.docs[0].ref.update({
                  ghlSynced: true,
                  ghlContactId: ghlResult.contactId,
                  ghlSyncedAt: new Date(),
                });
              }
            } else {
              stats.ghlFailed++;
              console.log(`   ⚠️  GHL sync failed for ${email}: ${ghlResult.error}`);
            }

            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }

        // Small delay between posts
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        const errorMsg = `Error scraping ${post.url}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        stats.errors.push(errorMsg);
        console.error(`   ❌ ${errorMsg}`);
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n✅ [FACEBOOK LEAD SCRAPER] Complete in ${duration}s:`);
    console.log(`   📱 Posts scraped: ${stats.postsScraped}`);
    console.log(`   💬 Comments scraped: ${stats.commentsScraped}`);
    console.log(`   📧 Emails extracted: ${stats.emailsExtracted}`);
    console.log(`   ✅ New leads added: ${stats.newLeadsAdded}`);
    console.log(`   ⏭️  Duplicates skipped: ${stats.duplicatesSkipped}`);
    console.log(`   🔗 GHL synced: ${stats.ghlSynced}`);
    if (stats.ghlFailed > 0) {
      console.log(`   ⚠️  GHL failed: ${stats.ghlFailed}`);
    }
    if (stats.errors.length > 0) {
      console.log(`   ❌ Errors: ${stats.errors.length}`);
    }

    return NextResponse.json({
      success: true,
      duration: `${duration}s`,
      stats,
      message: `Extracted ${stats.newLeadsAdded} new leads from ${stats.postsScraped} Facebook posts`,
    });

  } catch (error: any) {
    console.error('❌ [FACEBOOK LEAD SCRAPER] Error:', error);

    return NextResponse.json(
      {
        error: error.message,
        duration: `${((Date.now() - startTime) / 1000).toFixed(2)}s`,
      },
      { status: 500 }
    );
  }
}
