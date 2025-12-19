/**
 * Deduplicate Typesense Index
 *
 * Finds duplicate properties (same address + city) and keeps only the best version:
 * 1. Prefer entries with images
 * 2. If both have images, prefer cash_houses source
 * 3. Update dealType to "both" if exists in multiple deal types
 */

import Typesense from 'typesense';

async function main() {
  const client = new Typesense.Client({
    nodes: [{
      host: process.env.TYPESENSE_HOST || "localhost",
      port: 443,
      protocol: "https"
    }],
    apiKey: process.env.TYPESENSE_API_KEY || "",
    connectionTimeoutSeconds: 10,
  });

  console.log('=== DEDUPLICATING TYPESENSE INDEX ===\n');

  // Fetch all properties in batches
  let page = 1;
  const perPage = 250;
  const allProperties: any[] = [];

  while (true) {
    const result = await client.collections("properties").documents().search({
      q: "*",
      per_page: perPage,
      page,
      include_fields: "id,address,city,state,primaryImage,dealType,sourceType,ownerFinanceVerified"
    });

    if (!result.hits || result.hits.length === 0) break;

    allProperties.push(...result.hits.map(h => (h as any).document));
    console.log(`Fetched page ${page}: ${result.hits.length} properties (total: ${allProperties.length})`);

    if (result.hits.length < perPage) break;
    page++;
  }

  console.log(`\nTotal properties fetched: ${allProperties.length}`);

  // Group by normalized address + city
  const groups = new Map<string, any[]>();

  for (const prop of allProperties) {
    // Normalize address: trim, lowercase, remove extra spaces
    const normalizedAddress = (prop.address || '').toLowerCase().trim().replace(/\s+/g, ' ');
    const normalizedCity = (prop.city || '').toLowerCase().trim();
    const key = `${normalizedAddress}|${normalizedCity}`;

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(prop);
  }

  // Find duplicates
  const duplicates = Array.from(groups.entries()).filter(([, props]) => props.length > 1);
  console.log(`\nFound ${duplicates.length} duplicate groups\n`);

  let totalDeleted = 0;
  let totalUpdated = 0;

  for (const [key, props] of duplicates) {
    // Sort to find the best entry:
    // 1. Has image
    // 2. Is from cash_houses
    // 3. Has ownerFinanceVerified
    props.sort((a, b) => {
      const aHasImage = a.primaryImage && a.primaryImage.length > 0 ? 1 : 0;
      const bHasImage = b.primaryImage && b.primaryImage.length > 0 ? 1 : 0;
      if (aHasImage !== bHasImage) return bHasImage - aHasImage;

      const aIsCash = a.sourceType === 'cash_houses' ? 1 : 0;
      const bIsCash = b.sourceType === 'cash_houses' ? 1 : 0;
      if (aIsCash !== bIsCash) return bIsCash - aIsCash;

      return 0;
    });

    const keeper = props[0];
    const toDelete = props.slice(1);

    // Check if we need to update dealType
    const dealTypes = new Set(props.map(p => p.dealType));
    const hasOwnerFinance = props.some(p => p.dealType === 'owner_finance' || p.ownerFinanceVerified);
    const hasCashDeal = props.some(p => p.dealType === 'cash_deal');
    const shouldBeBoth = hasOwnerFinance && hasCashDeal && keeper.dealType !== 'both';

    // Delete duplicates
    for (const dup of toDelete) {
      try {
        await client.collections("properties").documents(dup.id).delete();
        totalDeleted++;
      } catch (e: any) {
        console.log(`Failed to delete ${dup.id}:`, e.message);
      }
    }

    // Update keeper if needed
    if (shouldBeBoth) {
      try {
        await client.collections("properties").documents(keeper.id).update({
          dealType: "both",
          ownerFinanceVerified: true
        });
        totalUpdated++;
      } catch (e: any) {
        console.log(`Failed to update ${keeper.id}:`, e.message);
      }
    }

    // Log progress every 50 duplicates
    if ((totalDeleted + totalUpdated) % 50 === 0 && totalDeleted > 0) {
      console.log(`Progress: ${totalDeleted} deleted, ${totalUpdated} updated`);
    }
  }

  console.log('\n=== COMPLETE ===');
  console.log(`Deleted: ${totalDeleted} duplicate entries`);
  console.log(`Updated: ${totalUpdated} entries to dealType: both`);

  // Verify final count
  const finalResult = await client.collections("properties").documents().search({
    q: "*",
    per_page: 0
  });
  console.log(`\nFinal property count: ${finalResult.found}`);
}

main().catch(console.error);
