#!/usr/bin/env npx tsx
// Monitor podcast workflow status in real-time

async function monitorWorkflow() {
  console.log('📊 Monitoring Podcast Workflows\n');

  try {
    const baseUrl = 'https://ownerfi.ai';
    const url = `${baseUrl}/api/podcast/workflow/logs`;

    const response = await fetch(url);
    const data = await response.json();

    if (!data.success) {
      console.error('❌ Failed to fetch workflows');
      return;
    }

    console.log(`Found ${data.workflows.length} workflows:\n`);

    data.workflows.forEach((workflow: any, index: number) => {
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Workflow #${index + 1}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📝 Title: ${workflow.episodeTitle || 'N/A'}`);
      console.log(`🎭 Guest: ${workflow.guestName || 'N/A'}`);
      console.log(`💬 Topic: ${workflow.topic || 'N/A'}`);
      console.log(`📊 Status: ${workflow.status}`);
      console.log(`🆔 Episode: #${workflow.episodeNumber || 'N/A'}`);

      if (workflow.heygenVideoId) {
        console.log(`\n🎥 HeyGen:`);
        console.log(`   Video ID: ${workflow.heygenVideoId}`);
        if (workflow.heygenVideoUrl) {
          console.log(`   ✅ Video URL: ${workflow.heygenVideoUrl.substring(0, 60)}...`);
        }
      }

      if (workflow.submagicProjectId || workflow.submagicVideoId) {
        console.log(`\n✨ Submagic:`);
        if (workflow.submagicProjectId) {
          console.log(`   Project ID: ${workflow.submagicProjectId}`);
        }
        if (workflow.submagicVideoId) {
          console.log(`   Video ID: ${workflow.submagicVideoId}`);
        }
      }

      if (workflow.latePostId) {
        console.log(`\n🚀 GetLate:`);
        console.log(`   Post ID: ${workflow.latePostId}`);
      }

      if (workflow.error) {
        console.log(`\n❌ Error: ${workflow.error}`);
      }

      const created = new Date(workflow.createdAt).toLocaleString();
      const updated = new Date(workflow.updatedAt).toLocaleString();
      console.log(`\n⏰ Created: ${created}`);
      console.log(`⏰ Updated: ${updated}`);

      if (workflow.completedAt) {
        const completed = new Date(workflow.completedAt).toLocaleString();
        console.log(`✅ Completed: ${completed}`);
      }
    });

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Show status summary
    const statusCounts: Record<string, number> = {};
    data.workflows.forEach((w: any) => {
      statusCounts[w.status] = (statusCounts[w.status] || 0) + 1;
    });

    console.log('📈 Status Summary:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      const emoji =
        status === 'completed' ? '✅' :
        status === 'failed' ? '❌' :
        status === 'heygen_processing' ? '🎥' :
        status === 'submagic_processing' ? '✨' :
        status === 'posting' ? '🚀' : '⏳';
      console.log(`   ${emoji} ${status}: ${count}`);
    });

    console.log('\n💡 To trigger a new podcast:');
    console.log('   Visit: https://ownerfi.ai/admin/social-dashboard');
    console.log('   Click: "Generate Podcast Now" button\n');

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

monitorWorkflow();
