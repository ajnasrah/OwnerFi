// Delete Stuck Workflows Script
// Usage: node delete-stuck-workflows.mjs <brand> [workflowId]
// Brands: carz, ownerfi, podcast
// If no workflowId provided, shows all stuck workflows and prompts for confirmation

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createInterface } from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '.env.local') });

// Initialize Firebase Admin
if (getApps().length === 0) {
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountKey) {
    console.error('❌ FIREBASE_SERVICE_ACCOUNT_KEY not found in .env.local');
    process.exit(1);
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountKey);
    initializeApp({
      credential: cert(serviceAccount)
    });
  } catch (error) {
    console.error('❌ Failed to parse Firebase service account:', error.message);
    process.exit(1);
  }
}

const db = getFirestore();

const COLLECTION_NAMES = {
  carz: 'carz_workflow_queue',
  ownerfi: 'ownerfi_workflow_queue',
  podcast: 'podcast_workflow_queue'
};

async function promptUser(question) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.toLowerCase());
    });
  });
}

async function listStuckWorkflows(brand) {
  const collectionName = COLLECTION_NAMES[brand];
  if (!collectionName) {
    console.error(`❌ Invalid brand: ${brand}. Use: carz, ownerfi, or podcast`);
    return [];
  }

  console.log(`\n🔍 Checking stuck workflows for ${brand.toUpperCase()}...\n`);

  const snapshot = await db.collection(collectionName)
    .where('status', 'in', ['heygen_processing', 'submagic_processing', 'posting', 'publishing'])
    .get();

  if (snapshot.empty) {
    console.log('✅ No stuck workflows found!\n');
    return [];
  }

  const workflows = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    const stuckMinutes = Math.round((Date.now() - data.updatedAt) / 60000);
    workflows.push({
      id: doc.id,
      ...data,
      stuckMinutes
    });
  });

  workflows.sort((a, b) => b.stuckMinutes - a.stuckMinutes);

  console.log(`Found ${workflows.length} stuck workflow(s):\n`);
  workflows.forEach((w, i) => {
    console.log(`${i + 1}. ${w.id}`);
    console.log(`   Status: ${w.status}`);
    console.log(`   Stuck for: ${w.stuckMinutes} minutes`);
    if (w.articleTitle) console.log(`   Article: ${w.articleTitle.substring(0, 60)}...`);
    if (w.episodeTitle) console.log(`   Episode: #${w.episodeNumber} - ${w.episodeTitle}`);
    console.log('');
  });

  return workflows;
}

async function deleteWorkflow(brand, workflowId) {
  const collectionName = COLLECTION_NAMES[brand];

  try {
    const docRef = db.collection(collectionName).doc(workflowId);
    const doc = await docRef.get();

    if (!doc.exists) {
      console.error(`❌ Workflow ${workflowId} not found in ${brand}`);
      return false;
    }

    await docRef.delete();
    console.log(`✅ Deleted workflow: ${workflowId}`);
    return true;
  } catch (error) {
    console.error(`❌ Error deleting workflow:`, error.message);
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: node delete-stuck-workflows.mjs <brand> [workflowId]');
    console.log('Brands: carz, ownerfi, podcast');
    console.log('\nExamples:');
    console.log('  node delete-stuck-workflows.mjs podcast           # List all stuck podcast workflows');
    console.log('  node delete-stuck-workflows.mjs carz wf_123456    # Delete specific workflow');
    process.exit(0);
  }

  const brand = args[0];
  const workflowId = args[1];

  if (!['carz', 'ownerfi', 'podcast'].includes(brand)) {
    console.error(`❌ Invalid brand: ${brand}. Use: carz, ownerfi, or podcast`);
    process.exit(1);
  }

  if (workflowId) {
    // Delete specific workflow
    console.log(`\n🗑️  Deleting workflow ${workflowId} from ${brand}...\n`);
    const answer = await promptUser(`Are you sure you want to delete this workflow? (yes/no): `);

    if (answer === 'yes' || answer === 'y') {
      await deleteWorkflow(brand, workflowId);
    } else {
      console.log('❌ Cancelled');
    }
  } else {
    // List all stuck workflows
    const workflows = await listStuckWorkflows(brand);

    if (workflows.length === 0) {
      process.exit(0);
    }

    const answer = await promptUser(`\nDelete ALL ${workflows.length} stuck workflow(s)? (yes/no): `);

    if (answer === 'yes' || answer === 'y') {
      console.log('\n🗑️  Deleting workflows...\n');
      let deleted = 0;
      for (const w of workflows) {
        const success = await deleteWorkflow(brand, w.id);
        if (success) deleted++;
      }
      console.log(`\n✅ Deleted ${deleted} of ${workflows.length} workflows\n`);
    } else {
      console.log('❌ Cancelled\n');
    }
  }

  process.exit(0);
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
