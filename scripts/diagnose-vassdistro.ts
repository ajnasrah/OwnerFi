import { db } from '../src/lib/firebase-admin';

async function diagnoseVassDistro() {
  console.log('🔍 Diagnosing VassDistro Issues\n');

  // 1. Check recent workflows
  console.log('1️⃣ Checking recent workflows...');
  const workflowsSnapshot = await db
    .collection('vassdistro_workflow_queue')
    .orderBy('createdAt', 'desc')
    .limit(5)
    .get();

  console.log(`Found ${workflowsSnapshot.size} recent workflows:\n`);

  for (const doc of workflowsSnapshot.docs) {
    const data = doc.data();
    const created = data.createdAt?.toDate?.() || new Date(data.createdAt);
    console.log(`📋 Workflow: ${doc.id}`);
    console.log(`   Status: ${data.status}`);
    console.log(`   Created: ${created.toLocaleString()}`);
    console.log(`   Stage: ${data.stage || 'unknown'}`);
    if (data.error) {
      console.log(`   ❌ Error: ${data.error}`);
    }
    if (data.article_id) {
      console.log(`   Article ID: ${data.article_id}`);
    }
    console.log();
  }

  // 2. Check available articles
  console.log('\n2️⃣ Checking available articles...');
  const articlesSnapshot = await db
    .collection('vassdistro_articles')
    .where('processed', '==', false)
    .orderBy('publishedAt', 'desc')
    .limit(5)
    .get();

  console.log(`Found ${articlesSnapshot.size} unprocessed articles:\n`);

  for (const doc of articlesSnapshot.docs) {
    const data = doc.data();
    const published = data.publishedAt?.toDate?.() || new Date(data.publishedAt);
    const contentLength = data.content?.length || 0;
    console.log(`📰 Article: ${data.title.substring(0, 60)}...`);
    console.log(`   ID: ${doc.id}`);
    console.log(`   Published: ${published.toLocaleString()}`);
    console.log(`   Content Length: ${contentLength} chars`);
    console.log(`   Feed: ${data.feedId || 'unknown'}`);
    console.log(`   Quality Score: ${data.qualityScore || 'not rated'}`);

    if (contentLength === 0) {
      console.log(`   ⚠️  WARNING: Article has ZERO content!`);
    } else if (contentLength < 200) {
      console.log(`   ⚠️  WARNING: Article content too short (<200 chars)`);
    } else if (contentLength < 500) {
      console.log(`   ⚠️  Note: Article content is short (<500 chars)`);
    } else {
      console.log(`   ✅ Content length looks good`);
    }
    console.log();
  }

  // 3. Check recent failed workflows with details
  console.log('\n3️⃣ Analyzing recent failures...');
  const failedSnapshot = await db
    .collection('vassdistro_workflow_queue')
    .where('status', '==', 'failed')
    .orderBy('createdAt', 'desc')
    .limit(3)
    .get();

  if (failedSnapshot.empty) {
    console.log('✅ No failed workflows found!\n');
  } else {
    console.log(`Found ${failedSnapshot.size} failed workflows:\n`);

    for (const doc of failedSnapshot.docs) {
      const data = doc.data();
      console.log(`❌ Failed Workflow: ${doc.id}`);
      console.log(`   Error: ${data.error || 'Unknown'}`);
      console.log(`   Stage: ${data.stage || 'Unknown'}`);
      console.log(`   Article ID: ${data.article_id || 'N/A'}`);

      // Try to get the article details
      if (data.article_id) {
        const articleDoc = await db.collection('vassdistro_articles').doc(data.article_id).get();
        if (articleDoc.exists) {
          const articleData = articleDoc.data();
          console.log(`   Article: ${articleData?.title?.substring(0, 60)}...`);
          console.log(`   Content Length: ${articleData?.content?.length || 0} chars`);
        }
      }
      console.log();
    }
  }

  // 4. Summary and recommendations
  console.log('\n📊 SUMMARY & RECOMMENDATIONS\n');

  const totalWorkflows = workflowsSnapshot.size;
  const failedCount = workflowsSnapshot.docs.filter(d => d.data().status === 'failed').length;
  const completedCount = workflowsSnapshot.docs.filter(d => d.data().status === 'completed').length;

  console.log(`Recent workflows: ${totalWorkflows}`);
  console.log(`  ✅ Completed: ${completedCount}`);
  console.log(`  ❌ Failed: ${failedCount}`);
  console.log(`  📊 Success rate: ${((completedCount / totalWorkflows) * 100).toFixed(1)}%\n`);

  if (failedCount > 0) {
    console.log('⚠️  Issues detected:');
    console.log('   - Review failed workflow error messages above');
    console.log('   - Check if articles have sufficient content (>200 chars)');
    console.log('   - Verify HeyGen/Submagic API keys are valid');
    console.log('   - Check if feeds are providing full content');
  } else {
    console.log('✅ No issues detected!');
  }
}

diagnoseVassDistro().then(() => {
  console.log('\n✅ Diagnosis complete');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Diagnosis error:', error);
  process.exit(1);
});
