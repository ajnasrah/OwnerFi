#!/usr/bin/env tsx
/**
 * Check Brand Activity
 * Diagnoses which brands are actively posting to social media
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();

interface BrandCheck {
  name: string;
  workflow: string;
  articles?: string;
  lateProfileId?: string;
}

async function checkBrandActivity() {
  console.log('\n=== SOCIAL MEDIA BRAND ACTIVITY DIAGNOSIS ===\n');

  const brands: BrandCheck[] = [
    {
      name: 'CARZ',
      workflow: 'carz_workflow_queue',
      articles: 'carz_articles',
      lateProfileId: process.env.LATE_CARZ_PROFILE_ID
    },
    {
      name: 'VASSDISTRO',
      workflow: 'vassdistro_workflow_queue',
      articles: 'vassdistro_articles',
      lateProfileId: process.env.LATE_VASSDISTRO_PROFILE_ID
    },
    {
      name: 'PODCAST',
      workflow: 'podcast_workflow_queue',
      articles: 'podcast_articles',
      lateProfileId: process.env.LATE_PODCAST_PROFILE_ID
    },
    {
      name: 'ABDULLAH',
      workflow: 'abdullah_workflow_queue',
      lateProfileId: process.env.LATE_ABDULLAH_PROFILE_ID
    },
    {
      name: 'BENEFIT',
      workflow: 'benefit_workflow_queue'
    },
    {
      name: 'PROPERTY',
      workflow: 'property_workflow_queue',
      lateProfileId: process.env.LATE_PROPERTY_PROFILE_ID
    }
  ];

  for (const brand of brands) {
    console.log(`\n📱 ${brand.name}:`);
    console.log('─'.repeat(50));

    // Check Late Profile Configuration
    if (brand.lateProfileId) {
      console.log(`  ✅ Late Profile ID: ${brand.lateProfileId}`);
    } else {
      console.log(`  ⚠️  No Late Profile ID configured`);
    }

    // Check workflow queue
    try {
      const workflowRef = db.collection(brand.workflow);
      const recentWorkflows = await workflowRef
        .orderBy('createdAt', 'desc')
        .limit(5)
        .get();

      if (!recentWorkflows.empty) {
        console.log(`  ✅ Workflow Queue: ${recentWorkflows.size} recent items`);

        const latest = recentWorkflows.docs[0].data();
        const createdAt = latest.createdAt?.toDate?.();
        const status = latest.status || 'unknown';

        if (createdAt) {
          const daysAgo = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
          console.log(`     Latest: ${daysAgo} days ago (${createdAt.toISOString().split('T')[0]})`);
          console.log(`     Status: ${status}`);
        }

        // Count statuses
        const statuses: Record<string, number> = {};
        recentWorkflows.docs.forEach(doc => {
          const s = doc.data().status || 'unknown';
          statuses[s] = (statuses[s] || 0) + 1;
        });
        console.log(`     Recent statuses:`, statuses);
      } else {
        console.log(`  ❌ Workflow Queue: EMPTY`);
      }
    } catch (e: any) {
      console.log(`  ❌ Workflow Queue: Error - ${e.message}`);
    }

    // Check articles
    if (brand.articles) {
      try {
        const articlesRef = db.collection(brand.articles);
        const recentArticles = await articlesRef
          .orderBy('createdAt', 'desc')
          .limit(1)
          .get();

        if (!recentArticles.empty) {
          const latest = recentArticles.docs[0].data();
          const createdAt = latest.createdAt?.toDate?.();

          if (createdAt) {
            const daysAgo = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
            console.log(`  ✅ Articles: Latest ${daysAgo} days ago`);
          }
        } else {
          console.log(`  ❌ Articles: EMPTY`);
        }
      } catch (e: any) {
        console.log(`  ❌ Articles: Error - ${e.message}`);
      }
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('SUMMARY');
  console.log('='.repeat(50));
  console.log(`
  ✅ = Active/Configured
  ⚠️  = Configured but no recent activity
  ❌ = Not configured or error
  `);
}

checkBrandActivity().catch(console.error);
