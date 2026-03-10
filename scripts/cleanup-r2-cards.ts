/**
 * R2 Property Cards Cleanup
 *
 * Deletes property card images older than 7 days from R2.
 * Safe to run because Late.dev downloads videos immediately on publishNow.
 * Keeps `latest-cards.json` (used by ES pipeline).
 *
 * Usage:
 *   npx tsx scripts/cleanup-r2-cards.ts           (delete files >7 days old)
 *   npx tsx scripts/cleanup-r2-cards.ts --dry-run  (list files without deleting)
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';

const DRY_RUN = process.argv.includes('--dry-run');
const MAX_AGE_DAYS = 7;
const PREFIX = 'property-cards/';
// Never delete the cards JSON used by the ES pipeline
const KEEP_FILES = ['property-cards/latest-cards.json'];

function getR2() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.R2_ACCOUNT_ID || '';
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    },
  });
}

async function main() {
  const bucket = process.env.R2_BUCKET_NAME || '';
  const r2 = getR2();
  const cutoff = new Date(Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000);

  console.log(`R2 Property Cards Cleanup${DRY_RUN ? ' (DRY RUN)' : ''}`);
  console.log(`Bucket: ${bucket}`);
  console.log(`Prefix: ${PREFIX}`);
  console.log(`Deleting files older than: ${cutoff.toISOString()}\n`);

  let totalFiles = 0;
  let toDelete: { Key: string }[] = [];
  let continuationToken: string | undefined;

  // List all objects under property-cards/
  do {
    const res = await r2.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: PREFIX,
      ContinuationToken: continuationToken,
    }));

    for (const obj of res.Contents || []) {
      totalFiles++;
      if (!obj.Key || !obj.LastModified) continue;

      // Never delete protected files
      if (KEEP_FILES.includes(obj.Key)) {
        console.log(`  KEEP: ${obj.Key} (protected)`);
        continue;
      }

      if (obj.LastModified < cutoff) {
        toDelete.push({ Key: obj.Key });
        const age = Math.round((Date.now() - obj.LastModified.getTime()) / (24 * 60 * 60 * 1000));
        console.log(`  ${DRY_RUN ? 'WOULD DELETE' : 'DELETE'}: ${obj.Key} (${age} days old)`);
      }
    }

    continuationToken = res.NextContinuationToken;
  } while (continuationToken);

  console.log(`\nTotal files: ${totalFiles}`);
  console.log(`Files to delete: ${toDelete.length}`);

  if (toDelete.length === 0) {
    console.log('Nothing to clean up.');
    return;
  }

  if (DRY_RUN) {
    console.log('\n--dry-run: no files deleted.');
    return;
  }

  // Delete in batches of 1000 (S3 limit)
  for (let i = 0; i < toDelete.length; i += 1000) {
    const batch = toDelete.slice(i, i + 1000);
    await r2.send(new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: { Objects: batch },
    }));
    console.log(`Deleted batch ${Math.floor(i / 1000) + 1} (${batch.length} files)`);
  }

  console.log(`\nDone. Deleted ${toDelete.length} files.`);
}

main().catch(err => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
