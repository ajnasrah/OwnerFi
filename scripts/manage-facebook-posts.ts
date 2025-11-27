/**
 * Manage Facebook Posts for Lead Scraping
 *
 * Usage:
 *   npx tsx scripts/manage-facebook-posts.ts list              - List all configured posts
 *   npx tsx scripts/manage-facebook-posts.ts add <url> <group> - Add a new post
 *   npx tsx scripts/manage-facebook-posts.ts remove <url>      - Remove a post
 *   npx tsx scripts/manage-facebook-posts.ts clear             - Clear all posts
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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

interface FacebookPost {
  url: string;
  groupName: string;
  postDescription?: string;
  addedAt: Date;
}

async function listPosts() {
  const doc = await db.collection('scraper_config').doc('facebook_posts').get();

  if (!doc.exists) {
    console.log('\n📱 No Facebook posts configured yet.\n');
    console.log('Add posts with: npx tsx scripts/manage-facebook-posts.ts add <url> <groupName>');
    return;
  }

  const data = doc.data();
  const posts: FacebookPost[] = data?.posts || [];

  if (posts.length === 0) {
    console.log('\n📱 No Facebook posts configured yet.\n');
    return;
  }

  console.log(`\n📱 Configured Facebook Posts (${posts.length}):\n`);

  posts.forEach((post, index) => {
    console.log(`${index + 1}. ${post.groupName}`);
    console.log(`   URL: ${post.url}`);
    if (post.postDescription) {
      console.log(`   Description: ${post.postDescription}`);
    }
    console.log('');
  });
}

async function addPost(url: string, groupName: string, description?: string) {
  if (!url.includes('facebook.com')) {
    console.error('❌ Invalid URL - must be a Facebook URL');
    process.exit(1);
  }

  const docRef = db.collection('scraper_config').doc('facebook_posts');
  const doc = await docRef.get();

  const existingPosts: FacebookPost[] = doc.exists ? (doc.data()?.posts || []) : [];

  // Check for duplicates
  if (existingPosts.some(p => p.url === url)) {
    console.log('⚠️  This URL is already configured');
    return;
  }

  const newPost: FacebookPost = {
    url,
    groupName,
    postDescription: description,
    addedAt: new Date(),
  };

  existingPosts.push(newPost);

  await docRef.set({ posts: existingPosts }, { merge: true });

  console.log(`\n✅ Added post from "${groupName}"`);
  console.log(`   URL: ${url}\n`);
}

async function removePost(url: string) {
  const docRef = db.collection('scraper_config').doc('facebook_posts');
  const doc = await docRef.get();

  if (!doc.exists) {
    console.log('No posts configured');
    return;
  }

  const existingPosts: FacebookPost[] = doc.data()?.posts || [];
  const filtered = existingPosts.filter(p => p.url !== url);

  if (filtered.length === existingPosts.length) {
    console.log('⚠️  URL not found in configured posts');
    return;
  }

  await docRef.set({ posts: filtered });

  console.log(`\n✅ Removed post: ${url}\n`);
}

async function clearPosts() {
  await db.collection('scraper_config').doc('facebook_posts').delete();
  console.log('\n✅ Cleared all Facebook posts\n');
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'list':
      await listPosts();
      break;

    case 'add':
      const url = args[1];
      const groupName = args[2];
      const description = args[3];

      if (!url || !groupName) {
        console.error('Usage: npx tsx scripts/manage-facebook-posts.ts add <url> <groupName> [description]');
        process.exit(1);
      }

      await addPost(url, groupName, description);
      break;

    case 'remove':
      const removeUrl = args[1];

      if (!removeUrl) {
        console.error('Usage: npx tsx scripts/manage-facebook-posts.ts remove <url>');
        process.exit(1);
      }

      await removePost(removeUrl);
      break;

    case 'clear':
      await clearPosts();
      break;

    default:
      console.log(`
📱 Facebook Posts Manager

Commands:
  list              - List all configured posts
  add <url> <group> - Add a new post to scrape
  remove <url>      - Remove a post
  clear             - Clear all posts

Examples:
  npx tsx scripts/manage-facebook-posts.ts list
  npx tsx scripts/manage-facebook-posts.ts add "https://facebook.com/groups/123/posts/456" "Creative Financing Memphis"
  npx tsx scripts/manage-facebook-posts.ts remove "https://facebook.com/groups/123/posts/456"
`);
  }

  process.exit(0);
}

main().catch(console.error);
