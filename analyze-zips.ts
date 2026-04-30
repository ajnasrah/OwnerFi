import { getFirebaseAdmin } from './src/lib/scraper-v2/firebase-admin';
import { TARGETED_ZIP_URLS } from './src/lib/scraper-v2/search-config';

async function analyzeExistingZips() {
  try {
    const { db } = getFirebaseAdmin();
    
    console.log('=== ANALYZING TARGET ZIP CODES ===\n');
    console.log(`Total target URLs configured: ${TARGETED_ZIP_URLS.length}`);
    
    // Extract zip codes from URLs
    const targetZips = TARGETED_ZIP_URLS.map(url => {
      const zipMatch = url.match(/(\d{5})/);
      return zipMatch ? zipMatch[1] : null;
    }).filter(Boolean) as string[];
    
    console.log(`Extracted ${targetZips.length} zip codes from URLs\n`);
    
    // Count properties by zip
    const zipCounts: Record<string, number> = {};
    let totalPropsInTargetZips = 0;
    
    console.log('Checking property counts by zip code:');
    
    for (const zip of targetZips) {
      try {
        const zipSnapshot = await db.collection('properties')
          .where('zipCode', '==', zip)
          .count()
          .get();
        
        const count = zipSnapshot.data().count;
        zipCounts[zip] = count;
        totalPropsInTargetZips += count;
        
        console.log(`  ${zip}: ${count} properties`);
      } catch (error) {
        console.log(`  ${zip}: Error counting - ${error}`);
        zipCounts[zip] = 0;
      }
    }
    
    console.log(`\n=== SUMMARY ===`);
    console.log(`Total properties in target zips: ${totalPropsInTargetZips}`);
    console.log(`Total properties in database: 9314`);
    console.log(`Percentage in target zips: ${((totalPropsInTargetZips / 9314) * 100).toFixed(1)}%`);
    
    // Find which zips have no properties
    const emptyZips = Object.entries(zipCounts)
      .filter(([zip, count]) => count === 0)
      .map(([zip]) => zip);
    
    const populatedZips = Object.entries(zipCounts)
      .filter(([zip, count]) => count > 0)
      .sort((a, b) => b[1] - a[1]);
    
    console.log(`\nEmpty zips (${emptyZips.length}): ${emptyZips.join(', ')}`);
    console.log(`\nTop populated target zips:`);
    populatedZips.slice(0, 10).forEach(([zip, count]) => {
      console.log(`  ${zip}: ${count}`);
    });
    
    // Estimate remaining work
    const averagePropsPerZip = totalPropsInTargetZips / (targetZips.length - emptyZips.length);
    const estimatedMissingProps = emptyZips.length * averagePropsPerZip;
    
    console.log(`\nEstimated work remaining:`);
    console.log(`  Empty zips: ${emptyZips.length}`);
    console.log(`  Average props per populated zip: ${averagePropsPerZip.toFixed(0)}`);
    console.log(`  Estimated missing properties: ${estimatedMissingProps.toFixed(0)}`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

analyzeExistingZips();