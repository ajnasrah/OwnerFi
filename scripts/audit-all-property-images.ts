import * as dotenv from 'dotenv';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

dotenv.config({ path: '.env.local' });

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
};

const app = initializeApp({ credential: cert(serviceAccount as any) });
const db = getFirestore(app);

interface PropertyImageAnalysis {
  id: string;
  address: string;
  city: string;
  state: string;
  isActive: boolean;
  hasImageUrls: boolean;
  imageUrlsCount: number;
  hasLegacyImageUrl: boolean;
  hasZillowImageUrl: boolean;
  totalImages: number;
  imageStatus: 'good' | 'partial' | 'missing';
  sampleImageUrl?: string;
  imageUrls?: string[];
  legacyImageUrl?: string;
}

async function auditAllPropertyImages() {
  try {
    console.log('🔍 Auditing ALL properties for image issues...\n');
    console.log('This may take a moment...\n');

    const propertiesSnapshot = await db.collection('properties').get();
    console.log(`📊 Found ${propertiesSnapshot.size} total properties\n`);

    const results: PropertyImageAnalysis[] = [];
    const issues: PropertyImageAnalysis[] = [];

    propertiesSnapshot.forEach(doc => {
      const data = doc.data();

      const hasImageUrls = Array.isArray(data.imageUrls) && data.imageUrls.length > 0;
      const hasLegacyImageUrl = !!data.imageUrl;
      const hasZillowImageUrl = !!data.zillowImageUrl;

      const imageUrlsCount = Array.isArray(data.imageUrls) ? data.imageUrls.length : 0;
      const totalImages = imageUrlsCount + (hasLegacyImageUrl ? 1 : 0) + (hasZillowImageUrl ? 1 : 0);

      let imageStatus: 'good' | 'partial' | 'missing' = 'missing';
      if (totalImages >= 1) {
        imageStatus = 'good';
      } else if (hasZillowImageUrl || hasLegacyImageUrl || imageUrlsCount > 0) {
        imageStatus = 'partial';
      }

      const analysis: PropertyImageAnalysis = {
        id: doc.id,
        address: data.address || 'Unknown',
        city: data.city || 'Unknown',
        state: data.state || 'Unknown',
        isActive: data.isActive === true,
        hasImageUrls,
        imageUrlsCount,
        hasLegacyImageUrl,
        hasZillowImageUrl,
        totalImages,
        imageStatus,
        sampleImageUrl: hasLegacyImageUrl ? data.imageUrl : (hasImageUrls ? data.imageUrls[0] : undefined),
        imageUrls: data.imageUrls,
        legacyImageUrl: data.imageUrl,
      };

      results.push(analysis);

      // Flag as issue if active property has no images
      if (data.isActive && totalImages === 0) {
        issues.push(analysis);
      }
    });

    // Summary Statistics
    console.log('📈 SUMMARY STATISTICS');
    console.log('='.repeat(80));
    console.log(`Total Properties: ${results.length}`);
    console.log(`Active Properties: ${results.filter(p => p.isActive).length}`);
    console.log(`Inactive Properties: ${results.filter(p => !p.isActive).length}`);
    console.log('');

    const goodImages = results.filter(p => p.imageStatus === 'good');
    const partialImages = results.filter(p => p.imageStatus === 'partial');
    const missingImages = results.filter(p => p.imageStatus === 'missing');

    console.log(`✅ Properties with Good Images: ${goodImages.length} (${((goodImages.length / results.length) * 100).toFixed(1)}%)`);
    console.log(`🟡 Properties with Partial Images: ${partialImages.length} (${((partialImages.length / results.length) * 100).toFixed(1)}%)`);
    console.log(`❌ Properties with NO Images: ${missingImages.length} (${((missingImages.length / results.length) * 100).toFixed(1)}%)`);
    console.log('');

    const activeWithNoImages = results.filter(p => p.isActive && p.totalImages === 0);
    console.log(`⚠️  ACTIVE Properties with NO Images: ${activeWithNoImages.length}`);
    console.log('');

    // Image Source Statistics
    console.log('📸 IMAGE SOURCE BREAKDOWN');
    console.log('='.repeat(80));
    console.log(`Properties with imageUrls array: ${results.filter(p => p.hasImageUrls).length}`);
    console.log(`Properties with legacy imageUrl: ${results.filter(p => p.hasLegacyImageUrl).length}`);
    console.log(`Properties with zillowImageUrl: ${results.filter(p => p.hasZillowImageUrl).length}`);
    console.log('');

    // Domain Analysis
    console.log('🌐 IMAGE DOMAIN ANALYSIS');
    console.log('='.repeat(80));

    const domainCounts = new Map<string, number>();
    results.forEach(property => {
      if (property.sampleImageUrl) {
        try {
          const url = new URL(property.sampleImageUrl);
          const domain = url.hostname;
          domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
        } catch (e) {
          // Invalid URL
        }
      }
    });

    console.log('Image domains in use:');
    Array.from(domainCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([domain, count]) => {
        const needsConfig = !domain.includes('zillowstatic.com') &&
                           !domain.includes('googleusercontent.com') &&
                           !domain.includes('maps.googleapis.com');
        const status = needsConfig ? '⚠️  NEEDS CONFIG' : '✅';
        console.log(`  ${status} ${domain}: ${count} properties`);
      });
    console.log('');

    // Detailed Issues Report
    if (activeWithNoImages.length > 0) {
      console.log('🚨 ACTIVE PROPERTIES WITH NO IMAGES');
      console.log('='.repeat(80));
      console.log('These properties are visible to buyers but have no images:\n');

      activeWithNoImages.slice(0, 20).forEach((property, idx) => {
        console.log(`${idx + 1}. ${property.address}`);
        console.log(`   ID: ${property.id}`);
        console.log(`   Location: ${property.city}, ${property.state}`);
        console.log(`   Status: Active ⚠️`);
        console.log('');
      });

      if (activeWithNoImages.length > 20) {
        console.log(`... and ${activeWithNoImages.length - 20} more\n`);
      }
    }

    // Check for potential domain issues
    console.log('🔍 POTENTIAL DOMAIN CONFIGURATION ISSUES');
    console.log('='.repeat(80));

    const unconfiguredDomains = new Set<string>();
    results.forEach(property => {
      if (property.imageUrls) {
        property.imageUrls.forEach(url => {
          try {
            const domain = new URL(url).hostname;
            if (!domain.includes('zillowstatic.com') &&
                !domain.includes('googleusercontent.com') &&
                !domain.includes('maps.googleapis.com')) {
              unconfiguredDomains.add(domain);
            }
          } catch (e) {
            // Invalid URL
          }
        });
      }
    });

    if (unconfiguredDomains.size > 0) {
      console.log('⚠️  Found images from domains NOT in next.config.ts:');
      unconfiguredDomains.forEach(domain => {
        console.log(`   - ${domain}`);
      });
      console.log('\n💡 These domains should be added to next.config.ts remotePatterns\n');
    } else {
      console.log('✅ All image domains are properly configured in next.config.ts\n');
    }

    // Sample properties with good images
    console.log('✅ SAMPLE PROPERTIES WITH GOOD IMAGES (for testing)');
    console.log('='.repeat(80));
    goodImages.filter(p => p.isActive).slice(0, 5).forEach((property, idx) => {
      console.log(`${idx + 1}. ${property.address} (${property.city}, ${property.state})`);
      console.log(`   ID: ${property.id}`);
      console.log(`   Images: ${property.totalImages} total`);
      console.log(`   Sample: ${property.sampleImageUrl?.substring(0, 80)}...`);
      console.log('');
    });

    console.log('✅ Audit complete!');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

auditAllPropertyImages();
