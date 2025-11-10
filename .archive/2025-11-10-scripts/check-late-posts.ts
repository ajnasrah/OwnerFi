/**
 * Check what captions were actually posted to Late
 */

import { db } from '../src/lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';

const LATE_API_KEY = process.env.LATE_API_KEY;

async function checkLatePosts() {
  console.log('🔍 Checking Late posts for benefit workflows...\n');

  if (!LATE_API_KEY) {
    console.error('❌ LATE_API_KEY not set');
    return;
  }

  try {
    // Get recent completed benefit workflows
    const q = query(
      collection(db, 'benefit_workflow_queue'),
      where('status', '==', 'completed')
    );

    const snapshot = await getDocs(q);
    console.log(`📦 Found ${snapshot.size} completed benefit workflows\n`);

    // Get the 5 most recent
    const workflows = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .sort((a: any, b: any) => (b.completedAt || 0) - (a.completedAt || 0))
      .slice(0, 10);

    for (const workflow of workflows) {
      console.log('━'.repeat(80));
      console.log(`Workflow: ${workflow.id}`);
      console.log(`Benefit: ${workflow.benefitTitle}`);
      console.log(`Late Post ID: ${workflow.latePostId || 'MISSING'}`);
      console.log(`Completed: ${new Date(workflow.completedAt || 0).toLocaleString()}`);

      console.log(`\nCaption in Firestore:`);
      if (workflow.caption) {
        console.log(`"${workflow.caption.substring(0, 200)}${workflow.caption.length > 200 ? '...' : ''}"`);
      } else {
        console.log('MISSING ❌');
      }

      // Try to fetch from Late API if we have a post ID
      if (workflow.latePostId) {
        try {
          const response = await fetch(`https://api.getlate.so/v1/posts/${workflow.latePostId}`, {
            headers: {
              'Authorization': `Bearer ${LATE_API_KEY}`,
              'Content-Type': 'application/json'
            }
          });

          if (response.ok) {
            const postData = await response.json();
            console.log(`\nCaption in Late API:`);
            if (postData.content) {
              console.log(`"${postData.content.substring(0, 200)}${postData.content.length > 200 ? '...' : ''}"`);

              // Check if they match
              if (workflow.caption && postData.content === workflow.caption) {
                console.log(`✅ MATCH - Captions are identical`);
              } else {
                console.log(`❌ MISMATCH - Captions are different!`);
              }
            } else {
              console.log('MISSING in Late API ❌');
            }
          } else {
            console.log(`\n⚠️  Late API error: ${response.status}`);
          }
        } catch (err) {
          console.log(`\n❌ Error fetching from Late: ${err instanceof Error ? err.message : err}`);
        }
      }
      console.log('');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkLatePosts().catch(error => {
  console.error('\n❌ Script error:', error);
  process.exit(1);
});
