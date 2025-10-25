#!/usr/bin/env node

/**
 * Retry Failed Podcast Workflows
 *
 * This script fetches HeyGen video URLs for failed workflows and retries the Submagic step.
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fetch from 'node-fetch';
import admin from 'firebase-admin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '../.env.local') });

const BASE_URL = 'https://ownerfi.ai';

// Workflows with their fetched HeyGen video URLs
const WORKFLOWS_WITH_URLS = [
  {
    id: 'podcast_1761404414182_1r3hbrv6a',
    title: 'Alex Rivera on AI Tools For Daily Life',
    videoUrl: 'https://files2.heygen.ai/aws_pacific/avatar_tmp/341b42c6e9954d79bbf8e5c18318a9c2/9d78bb64ea6841e58d8ea6488629a00e.mp4?Expires=1762010132&Signature=FnCs8exhc6uo38VhPA1pfyc26ehuRcj5zrK42uN3bPPFTLJr4970UzlTKxO2PA8GO8gSinhE1neslLzgj~OmwbmChaer56UUc-bhFWWIgX0C08RYuL8BF7z7pUvRzyF-Egnmd11HLvwjdZSENF3WcFBZM4xeF8lpaoNyGsHPfeIT439xcL9giMacaMAnXgGo3jGu-1GAcVqoEbXxmzWYoI0Y6G2pYtc6GasJGMlpNjbrT8Xqvs7ylie4cE3HjjS-JobEj0zgjvA60JPDNuqDY3HMtOKdrikAi1dsRWgDQBCTeSHMagg802QGlPkoxDUYaUSIUWeIthkXFhP2IvRuIg__&Key-Pair-Id=K38HBHX5LX3X2H'
  },
  {
    id: 'podcast_1761382814289_lqb345iph',
    title: 'James Chen on Retirement Planning Basics',
    videoUrl: 'https://files2.heygen.ai/aws_pacific/avatar_tmp/341b42c6e9954d79bbf8e5c18318a9c2/2b87234624d24747965ec81083f1e6d5.mp4?Expires=1761988532&Signature=d0q3XI1CXPeQl1K771qq5BvuiPuPEn3M0Q6lbJEv8EOQYn4oPY8rt59NyXOcj~aYAIxgJogsRmFk3~TP57CFdI48xZJmhTux53NvsdswG7N7myOTPIP~koDpvP66Xh9RehN6~YcxFDfFDEh0kg5VJLrAeCja3YBDfwCpajzKUipwX~moHqVbKzjaEKFqdI-2EFlWv8UzOvraz-1~NdZ-6VR2L05mkeaRi3VxBLJMWWrMfZ08pDei3pESW5ErAeKFTBTfoe0OcyKmkZ41pbTPfOuy3d-zYIa8mn8Un4yurl4YkpGDJSoEuNmHrotrXN-tyFa6kFl5hjnYN0D1I48d7Q__&Key-Pair-Id=K38HBHX5LX3X2H'
  },
  {
    id: 'podcast_1761339614366_fzfscp01v',
    title: 'Coach Maria on Building Muscle Efficiently',
    videoUrl: 'https://files2.heygen.ai/aws_pacific/avatar_tmp/341b42c6e9954d79bbf8e5c18318a9c2/1478c152a9774613a087c89db63f930c.mp4?Expires=1761945333&Signature=fUTlWcke2QP8pPs17JvRwmeZ6G9sLNdXMtDu1K~WpptkAt5mlF30DCKx7XwRo5L9dtU1yGjwMD6xxjBxWxjHN2PUgQicMIhV0C9K11pXoABom6qOM224vQn3G1Tg8mS-uZfVS1qcTQCr8oyh4eBWayqgmqeohk0yzjObXZGrT1qWF2iTetSxH0-uDWOTQNvD1pFJyddLifbm8qn7dZK~9CGn6BMyKlPBJZV1K-zq3kKoFWAssyBslyGKiq4DiMWynQW3heZheNhR49aV0kGLZR6rXc5rWYen6rsWHatRBYdD8wEoGHmVw20sn9UdgUQna-6VzF1x2~bF~QBCQQdUyA__&Key-Pair-Id=K38HBHX5LX3X2H'
  },
  {
    id: 'podcast_1761318014358_kju0ya7kv',
    title: 'Sarah Johnson on Mortgage Tips And Advice',
    videoUrl: 'https://files2.heygen.ai/aws_pacific/avatar_tmp/341b42c6e9954d79bbf8e5c18318a9c2/ffc99b4e86584e7f84fb5af8c39761b7.mp4?Expires=1761923733&Signature=XgDxaj6otC9~aNGlIPwLdlazTKH-gGQsfDvdOFPEOvswAENHz79cgOJ5TtKkmiA4oM7AAjmKDkgHiq-3tXlXvZO312E0ZVvhVhWFYxnyg71WZHySbR0Q7jfeZzSb46wRSb52NPNxET9pL~faiJ-H2hNSYLMk~8kDN4l1xfhYe6bcRoHkF~V~LcnkYVxSPXvu8ZMy2drTxYKWr2BpwTQ6ZyDoOlj-kZViZ4dtPZsbbXEq2t6ZuBKD1Op5h-sIRynEgSxBnI4VXen8viRp42wmxl9brc1jdJqoj9U8HcXuDSej0UmcG0XjHlxX-Xbd9H0ROSvjO4Scn6X7mgqxlMxTSw__&Key-Pair-Id=K38HBHX5LX3X2H'
  },
  {
    id: 'podcast_1761296414324_b5nir0pqe',
    title: 'James Chen on Tax Optimization Strategies',
    videoUrl: 'https://files2.heygen.ai/aws_pacific/avatar_tmp/341b42c6e9954d79bbf8e5c18318a9c2/e46e30c08f354a28ac5e8e7e0e5917c6.mp4?Expires=1761902133&Signature=Wc9b2DFuKXNnnQZbnyG7wVCiNzyDuaK0n-ea4cWNzHb8PeoK4-DKMmXYud7Wyt3tLSj0H79p20zNdBKr1rkf8~8YGw1xBdpnyhKx94F9RRjo4blIJDiCLqQ32YxrzCV8jimVr3Dd5ybtgvVSkFItJUhfVULUYzlcY2c-zFHU-PWz5jadbbzroqO6-StGMkJDBwv0mh5iLVnw-tVPhs8iCszCxACiJxPolmjshdEmUpEILrJVAwGx0E38pYSxh9ogzhQOkzccBSPTanMmmEeUzAgcO9rJ43oKUCJ-iaoTH-L364j6iFFTl50GZVatpKRkLTJ9NLx5duxovKd3nDGDmg__&Key-Pair-Id=K38HBHX5LX3X2H'
  },
  {
    id: 'podcast_1761253214435_8shk1d45n',
    title: 'James Chen on Passive Income Creation',
    videoUrl: 'https://files2.heygen.ai/aws_pacific/avatar_tmp/341b42c6e9954d79bbf8e5c18318a9c2/cad809d491134095920134e02a2e33d3.mp4?Expires=1761858933&Signature=ISzNSsDn31ETVglI~OwVrsVwk0eV61k7rwld8Zaxv-7azt55~RMzkxjdCmfDlV0nje667C-WJwb-OZVjr9yURRW6T5ciM~MutsrSmiuOgWKz8GVJYA3HBpLs4NxKJvYawgxrRsvqrspalp4s-Oi9Yl9KrcVxFvaPawhWUApzYUfiLGCcnUMUDsea0U4sK3JjMdiFfqwHYzD4s~HJetU-pAPF3F~JJwxBASJ-MpLNkM12rlk~KNiR6cxn53cDmLZVMRNFdBgK~~f4ezL4fnE3XMADVKXtdHqUqW3CuZ0~xJtgK98Sw5pqkWogwWqPAhywubLOF5Wdk2heBtD8XaNkLw__&Key-Pair-Id=K38HBHX5LX3X2H'
  },
  {
    id: 'podcast_1761233830951_pmgioh2gj',
    title: 'Mike Thompson on Electric Vehicles And Hybrids',
    videoUrl: 'https://files2.heygen.ai/aws_pacific/avatar_tmp/341b42c6e9954d79bbf8e5c18318a9c2/b2238bd29a9848b9bb5daffd256f73e7.mp4?Expires=1761839127&Signature=f2j0WKLLlPw-78OvnMR74fL18jA5NOMxBWAC7-Duyle-lS6XgTl1WDURH2NsiYAIF6qAa4ernR3jdMLCZgRHB3t9cDPImf8lzpOgRgwCb1hmQ8PDyoLcBXyi3fTDssqwkQtw6dsA5-kU7Q2MleIEbfSRdtH8qsXa1L-kn8xaF0rPwrz0bqa2VnGLFh-CLiTy6UDWWQLF9ixHTF4jAnophe0ggoBFjF54OJLhtDncMpBFYejN7V6oQsLFHXlpT-Aiu7LEsfElOP6jId7-Ngk00V9-X8mOUh1ikCVX6ysok9Y0BQLZ86QVYTrjBb4oXzsODmow7XYq1MBchvk0LDXEew__&Key-Pair-Id=K38HBHX5LX3X2H'
  },
  {
    id: 'podcast_1761231639508_583rjx5mm',
    title: 'James Chen on Tax Optimization Strategies',
    videoUrl: 'https://files2.heygen.ai/aws_pacific/avatar_tmp/341b42c6e9954d79bbf8e5c18318a9c2/c790d2a371e6463c8c5a4d1061e88579.mp4?Expires=1761837329&Signature=UfaQeqjfEX8Lg0SnnP10cCZHN6dXNldw-eX7J0Pp5mQS2wpBgp3rqhW94eryi-lXhXMsz41mlB-MvFh1gdBZ6FVZJ7TAB8b1dhodR9jQ4ZFG1ShwkReQu6XXcveRAEMWyJmTvpYIT5igbj84rWJEkgMYHXnRqaZB4v46L6c7GsNRliKOwQGZNykK8eLvA6Dm7IlvahhQbLohLEhvW8FrmCx9S34kn5Dtqbce~UzjdImzcoNjZc6f1xyVkr5I1Ce1e6opB-gsRTWWV~Yw65Qnm3q~xv4Iw~iuFY1Ix3jL3Z9IyxWPgmeIzv-0-KZeGG8suKgFh9BhtCuyB03qKBnAA__&Key-Pair-Id=K38HBHX5LX3X2H'
  },
  {
    id: 'podcast_1761231631380_r51jifo07',
    title: 'Coach Maria on Nutrition For Performance',
    videoUrl: 'https://files2.heygen.ai/aws_pacific/avatar_tmp/341b42c6e9954d79bbf8e5c18318a9c2/1c577b3ec8614be4af3a8b19f441344c.mp4?Expires=1761837325&Signature=YCZunZZ4FBj~9o~FEBM0xna4v-Huy1x0o7pY7XCbxwuus22-VKBVsjg1vW4mIRraYrVsEIrkSfzn-G~Tz4awkwGKSVFj4lHxllrY1Bum6f8jxFUjtfhRux-ofEon8uCBcDrKmVZV6riqUTAVxRohj7YM2jvxETkxCBpcbFwxHDOen5Pgdzv~PgUETntzeLoS9CTXO1a2Vr2QqgfRRfDkVQUrtTaVbnRvjl-h5pnXRRrwJ8YH0LlKPKTCmdzfMcUNJOY1N681~bOo76LrfyLASsLmUuXpDHP~c-gnEkY8xKOSqqZ-McIiEwSKMZ0raMk~Wi4sliQ108vuaoIXTSD4KQ__&Key-Pair-Id=K38HBHX5LX3X2H'
  },
  {
    id: 'podcast_1761210040372_zzl5ubol8',
    title: 'Mike Thompson on Electric Vehicles And Hybrids',
    videoUrl: 'https://files2.heygen.ai/aws_pacific/avatar_tmp/341b42c6e9954d79bbf8e5c18318a9c2/693f83363c1f4689af415bfe1be8656a.mp4?Expires=1761815725&Signature=LCjT2e78hCNe5ZhGQo14Vjaa5AMcuRcviSd4qHEVMp3Fe0u1NMPqNDRyjnr1GcLl6fKEHi6Odrv4oJY~LzyLXAS1MqTnzk9OZaIIiJSj4CAZzw9rCVeN5H1jSBIMTs-LzDzH~F-MmTnK0bQ7X925BnobDSPddEaTDBMzigJcyvnJ67mZPR-5fuWuJ9G3LGmMRYika6tofb~UghfpbOg1qxiOr2W0V4RDSnvxrGeJfr~QslXvPui7bike3YnWuRM4E4qDzpHy4gxO1JXsuiXeadJvBqOzvKZNPs7GvXy8LG5zv7U81IHjztvMf9MXcrh6DAEYmd8CpnaVNFUDPliaeA__&Key-Pair-Id=K38HBHX5LX3X2H'
  }
];

// Initialize Firebase
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
}

const db = admin.firestore();

async function retryWorkflow(workflow) {
  const { id, title, videoUrl } = workflow;
  console.log(`\n🔄 ${title}`);
  console.log(`   Workflow ID: ${id.substring(0, 35)}...`);

  try {
    // Step 1: Save HeyGen video URL to Firestore
    console.log(`   📝 Saving HeyGen video URL to Firestore...`);
    await db.collection('podcast_workflow_queue').doc(id).update({
      heygenVideoUrl: videoUrl,
      status: 'heygen_completed' // Mark as ready for Submagic
    });
    console.log(`   ✅ Saved HeyGen URL`);

    // Step 2: Call retry-submagic endpoint
    console.log(`   🎨 Sending to Submagic...`);
    const response = await fetch(`${BASE_URL}/api/workflow/retry-submagic`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        workflowId: id,
        brand: 'podcast'
      })
    });

    const data = await response.json();

    if (data.success) {
      console.log(`   ✅ Submagic started! Project ID: ${data.projectId}`);
      return { success: true, workflowId: id, projectId: data.projectId };
    } else {
      console.log(`   ❌ Failed: ${data.error || 'Unknown error'}`);
      return { success: false, workflowId: id, error: data.error };
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return { success: false, workflowId: id, error: error.message };
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║   Retrying Failed Abdullah Podcast Workflows          ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  console.log(`Total workflows to retry: ${WORKFLOWS_WITH_URLS.length}\n`);

  const results = [];

  for (const workflow of WORKFLOWS_WITH_URLS) {
    const result = await retryWorkflow(workflow);
    results.push(result);

    // Wait 3 seconds between retries to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║                    RETRY SUMMARY                       ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`✅ Successful: ${successful.length}/${WORKFLOWS_WITH_URLS.length}`);
  console.log(`❌ Failed: ${failed.length}/${WORKFLOWS_WITH_URLS.length}`);

  if (successful.length > 0) {
    console.log('\n✅ Successfully Started:');
    successful.forEach(r => {
      console.log(`   - ${r.workflowId.substring(0, 35)}... (Submagic: ${r.projectId.substring(0, 12)}...)`);
    });
  }

  if (failed.length > 0) {
    console.log('\n❌ Failed Workflows:');
    failed.forEach(f => {
      console.log(`   - ${f.workflowId.substring(0, 35)}...`);
      console.log(`     Error: ${f.error}`);
    });
  }

  console.log('\n💡 Next Steps:');
  console.log('   1. Wait 2-5 minutes for Submagic to process the videos');
  console.log('   2. Check https://ownerfi.ai/admin for status updates');
  console.log('   3. Videos will progress: submagic_processing → publishing → completed');
  console.log('\n✨ Done!');

  process.exit(0);
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
