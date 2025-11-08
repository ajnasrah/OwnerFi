#!/usr/bin/env tsx
/**
 * Deploy Missing Firestore Indexes
 *
 * Creates the missing composite indexes for vassdistro_workflow_queue and abdullah_workflow_queue
 * using the Firestore Admin API
 */

async function getAccessToken(): Promise<string> {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  if (!projectId || !privateKey || !clientEmail) {
    throw new Error('Missing Firebase credentials');
  }

  // Create JWT for service account authentication
  const jwtLib = await import('jsonwebtoken');
  const sign = jwtLib.default?.sign || jwtLib.sign;

  const now = Math.floor(Date.now() / 1000);
  const jwt = sign(
    {
      iss: clientEmail,
      sub: clientEmail,
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
      scope: 'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/datastore'
    },
    privateKey,
    { algorithm: 'RS256' }
  );

  // Exchange JWT for access token
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });

  if (!response.ok) {
    throw new Error(`Failed to get access token: ${await response.text()}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function createIndex(
  projectId: string,
  accessToken: string,
  collectionGroup: string,
  fields: Array<{ fieldPath: string; order: string }>
) {
  console.log(`📝 Creating index for ${collectionGroup}...`);
  console.log(`   Fields: ${fields.map(f => `${f.fieldPath} (${f.order})`).join(', ')}`);

  const indexConfig = {
    fields: fields.map(f => ({
      fieldPath: f.fieldPath,
      order: f.order,
    })),
    queryScope: 'COLLECTION',
  };

  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/collectionGroups/${collectionGroup}/indexes`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(indexConfig)
  });

  if (!response.ok) {
    const error = await response.text();

    // Check if index already exists
    if (error.includes('ALREADY_EXISTS') || error.includes('already exists')) {
      console.log(`   ✅ Index already exists (skipping)`);
      return;
    }

    throw new Error(`Failed to create index: ${error}`);
  }

  const result = await response.json();
  console.log(`   ✅ Index creation started: ${result.name}`);
  console.log(`   ⏳ Index will be available once building completes\n`);
}

async function main() {
  console.log('🚀 Deploying Missing Firestore Indexes\n');
  console.log('═'.repeat(60) + '\n');

  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error('FIREBASE_PROJECT_ID not set');
  }

  console.log(`📦 Project: ${projectId}\n`);

  // Get access token
  console.log('🔑 Getting access token...');
  const accessToken = await getAccessToken();
  console.log('   ✅ Access token obtained\n');

  // Create the missing indexes
  const indexesToCreate = [
    {
      collectionGroup: 'vassdistro_workflow_queue',
      fields: [
        { fieldPath: 'status', order: 'ASCENDING' },
        { fieldPath: 'createdAt', order: 'DESCENDING' }
      ]
    },
    {
      collectionGroup: 'abdullah_workflow_queue',
      fields: [
        { fieldPath: 'status', order: 'ASCENDING' },
        { fieldPath: 'createdAt', order: 'DESCENDING' }
      ]
    }
  ];

  for (const index of indexesToCreate) {
    try {
      await createIndex(projectId, accessToken, index.collectionGroup, index.fields);
    } catch (error) {
      console.error(`   ❌ Error: ${error instanceof Error ? error.message : error}\n`);
    }
  }

  console.log('═'.repeat(60));
  console.log('✅ Deployment complete!');
  console.log('\nNote: Indexes may take a few minutes to build.');
  console.log('You can check the status in the Firebase Console:');
  console.log(`https://console.firebase.google.com/project/${projectId}/firestore/indexes\n`);
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
