import { ApifyClient } from 'apify-client';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Initialize Firebase Admin
const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
};

const app = initializeApp({
  credential: cert(serviceAccount as any),
});

const db = getFirestore(app);

interface PropertyURL {
  url: string;
  address?: string;
  price?: string;
}

interface PropertyData {
  // URL
  url: string;
  hdpUrl: string;
  virtualTourUrl: string;

  // Address fields
  fullAddress: string;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  county: string;
  subdivision: string;
  neighborhood: string;

  // Property IDs
  zpid: number;
  parcelId: string;
  mlsId: string;

  // Property details
  bedrooms: number;
  bathrooms: number;
  squareFoot: number;
  buildingType: string;
  homeType: string;
  homeStatus: string;
  yearBuilt: number;
  lotSquareFoot: number;

  // Location
  latitude: number;
  longitude: number;

  // Financial
  price: number;
  estimate: number;
  rentEstimate: number;
  hoa: number;
  annualTaxAmount: number;
  recentPropertyTaxes: number;
  propertyTaxRate: number;
  annualHomeownersInsurance: number;

  // Listing info
  daysOnZillow: number;
  datePostedString: string;
  listingDataSource: string;

  // Description
  description: string;

  // Agent info
  agentName: string;
  agentPhoneNumber: string;
  agentEmail: string;
  agentLicenseNumber: string;

  // Broker info
  brokerName: string;
  brokerPhoneNumber: string;

  // Images
  propertyImages: string[];

  // Metadata
  source: string;
  importedAt: Date;
  scrapedAt: Date;
}

class FirebasePropertyImporter {
  private client: ApifyClient;
  // Original (expired): 'fdbXYQHBkaccpmRtX'
  // Free alternative: 'maxcopell/zillow-detail-scraper'
  private actorId: string = 'maxcopell/zillow-detail-scraper';
  private collectionName: string = 'zillow_imports';
  private importedCount: number = 0;
  private failedCount: number = 0;

  constructor() {
    const apiKey = process.env.APIFY_API_KEY;
    if (!apiKey) {
      throw new Error('APIFY_API_KEY not found in .env.local');
    }
    this.client = new ApifyClient({ token: apiKey });
  }

  /**
   * Read Excel/CSV file and extract URLs
   */
  readUrlsFromFile(filePath: string): PropertyURL[] {
    console.log(`📂 Reading file: ${filePath}\n`);

    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    return this.extractURLs(data);
  }

  /**
   * Extract URLs from data rows
   */
  private extractURLs(data: any[]): PropertyURL[] {
    const properties: PropertyURL[] = [];
    const urlKeys = ['url', 'URL', 'link', 'Link', 'property_url', 'Property URL'];
    const addressKeys = ['address', 'Address'];
    const priceKeys = ['price', 'Price'];

    data.forEach((row) => {
      let url: string | undefined;
      let address: string | undefined;
      let price: string | undefined;

      // Find URL
      for (const key of urlKeys) {
        if (row[key] && typeof row[key] === 'string' && row[key].includes('zillow.com')) {
          url = row[key];
          break;
        }
      }

      if (!url) {
        for (const value of Object.values(row)) {
          if (typeof value === 'string' && value.includes('zillow.com')) {
            url = value;
            break;
          }
        }
      }

      // Find address
      for (const key of addressKeys) {
        if (row[key]) {
          address = String(row[key]);
          break;
        }
      }

      // Find price
      for (const key of priceKeys) {
        if (row[key]) {
          price = String(row[key]);
          break;
        }
      }

      if (url) {
        properties.push({ url, address, price });
      }
    });

    return properties;
  }

  /**
   * Scrape and import properties to Firebase
   */
  async importToFirebase(properties: PropertyURL[], batchSize: number = 50): Promise<void> {
    console.log(`\n🔥 Firebase Property Importer`);
    console.log('='.repeat(60));
    console.log(`Total URLs: ${properties.length}`);
    console.log(`Batch size: ${batchSize}`);
    console.log(`Collection: ${this.collectionName}`);
    console.log('='.repeat(60));
    console.log();

    // Split into batches
    const batches: PropertyURL[][] = [];
    for (let i = 0; i < properties.length; i += batchSize) {
      batches.push(properties.slice(i, i + batchSize));
    }

    console.log(`📦 Processing ${batches.length} batches\n`);

    for (let i = 0; i < batches.length; i++) {
      // CHECK FOR STOP FILE - allows graceful stopping
      if (fs.existsSync('.stop-scraper')) {
        console.log('\n⛔ STOP FILE DETECTED - Stopping import gracefully');
        console.log('To resume, delete the .stop-scraper file and run again.');
        break;
      }

      const batch = batches[i];
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🔄 Batch ${i + 1}/${batches.length} (${batch.length} properties)`);
      console.log('='.repeat(60));

      try {
        // Scrape with Apify
        const scrapedData = await this.scrapeWithApify(batch);

        // Transform and save to Firebase
        await this.saveToFirebase(scrapedData);

        console.log(`✅ Batch ${i + 1} complete`);
        console.log(`   Imported: ${this.importedCount}/${properties.length}`);
        console.log(`   Failed: ${this.failedCount}`);

        // Delay between batches
        if (i < batches.length - 1) {
          console.log(`\n⏳ Waiting 5 seconds before next batch...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
        }

      } catch (error) {
        console.error(`❌ Error in batch ${i + 1}:`, error);
        this.failedCount += batch.length;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Import Complete!');
    console.log('='.repeat(60));
    console.log(`Total imported: ${this.importedCount}`);
    console.log(`Total failed: ${this.failedCount}`);
    console.log(`\nFirebase Collection: '${this.collectionName}'`);
    console.log(`View at: Firebase Console > Firestore > ${this.collectionName}`);
  }

  /**
   * Scrape properties with Apify
   */
  private async scrapeWithApify(properties: PropertyURL[]): Promise<any[]> {
    console.log(`   🚀 Starting Apify scraper...`);

    // maxcopell/zillow-detail-scraper uses startUrls format
    const input = {
      startUrls: properties.map(p => ({ url: p.url }))
    };

    const run = await this.client.actor(this.actorId).call(input);
    const { items } = await this.client.dataset(run.defaultDatasetId).listItems();

    console.log(`   ✓ Scraped ${items.length} properties`);
    return items;
  }

  /**
   * Transform Apify data to our schema
   */
  private transformProperty(apifyData: any): PropertyData | null {
    const timestamp = new Date();

    // Parse address components
    const addressObj = apifyData.address || {};
    const streetAddress = addressObj.streetAddress || apifyData.streetAddress || '';
    const city = addressObj.city || apifyData.city || '';
    const state = addressObj.state || apifyData.state || '';
    const zipCode = addressObj.zipcode || apifyData.zipcode || addressObj.zip || '';
    const county = apifyData.county || '';
    const subdivision = addressObj.subdivision || '';
    const neighborhood = addressObj.neighborhood || '';
    const fullAddress = `${streetAddress}, ${city}, ${state} ${zipCode}`.trim();

    // Get property IDs
    const zpid = apifyData.zpid || 0;
    const parcelId = apifyData.parcelId || apifyData.resoFacts?.parcelNumber || '';
    const mlsId = apifyData.attributionInfo?.mlsId || apifyData.mlsid || '';

    // Build Zillow URL if not provided
    const hdpUrl = apifyData.hdpUrl || '';
    const fullUrl = hdpUrl ? `https://www.zillow.com${hdpUrl}` : (apifyData.url || apifyData.addressOrUrlFromInput || '');

    // ===== ENHANCED AGENT/BROKER EXTRACTION =====
    // Try multiple paths for agent phone
    const agentPhone = apifyData.attributionInfo?.agentPhoneNumber
      || apifyData.agentPhoneNumber
      || apifyData.agentPhone
      || '';

    // Try multiple paths for broker phone
    const brokerPhone = apifyData.attributionInfo?.brokerPhoneNumber
      || apifyData.brokerPhoneNumber
      || apifyData.brokerPhone
      || '';

    // VALIDATION: Skip property if no phone number available
    if (!agentPhone && !brokerPhone) {
      console.log(`   ⚠️  SKIPPED: No agent or broker phone for ${streetAddress || 'property'} (ZPID: ${zpid})`);
      console.log(`      attributionInfo present: ${!!apifyData.attributionInfo}`);
      console.log(`      agentPhoneNumber: ${apifyData.attributionInfo?.agentPhoneNumber}`);
      console.log(`      brokerPhoneNumber: ${apifyData.attributionInfo?.brokerPhoneNumber}`);
      return null;
    }

    // Use broker phone as fallback if agent phone is missing
    const finalAgentPhone = agentPhone || brokerPhone;

    // Extract agent name from multiple sources
    const agentName = apifyData.attributionInfo?.agentName
      || apifyData.agentName
      || apifyData.listingAgent
      || (Array.isArray(apifyData.attributionInfo?.listingAgents) && apifyData.attributionInfo.listingAgents[0]?.memberFullName)
      || '';

    // Extract broker name from multiple sources
    const brokerName = apifyData.attributionInfo?.brokerName
      || apifyData.brokerName
      || apifyData.brokerageName
      || (Array.isArray(apifyData.attributionInfo?.listingOffices) && apifyData.attributionInfo.listingOffices[0]?.officeName)
      || '';

    // Log successful contact extraction
    console.log(`   ✓ CONTACT INFO for ${streetAddress} (ZPID: ${zpid}):`);
    console.log(`      Agent: ${agentName} | Phone: ${agentPhone || '(using broker phone)'}`);
    console.log(`      Broker: ${brokerName} | Phone: ${brokerPhone}`);
    console.log(`      Final Agent Phone: ${finalAgentPhone}`);

    return {
      // URL
      url: fullUrl,
      hdpUrl: hdpUrl,
      virtualTourUrl: apifyData.virtualTourUrl || apifyData.thirdPartyVirtualTour?.externalUrl || '',

      // Address fields
      fullAddress: fullAddress || apifyData.fullAddress || '',
      streetAddress,
      city,
      state,
      zipCode,
      county,
      subdivision,
      neighborhood,

      // Property IDs
      zpid,
      parcelId,
      mlsId,

      // Property details
      bedrooms: apifyData.bedrooms || apifyData.beds || 0,
      bathrooms: apifyData.bathrooms || apifyData.baths || 0,
      squareFoot: apifyData.livingArea || apifyData.livingAreaValue || apifyData.squareFoot || 0,
      buildingType: apifyData.propertyTypeDimension || apifyData.buildingType || apifyData.homeType || '',
      homeType: apifyData.homeType || '',
      homeStatus: apifyData.homeStatus || '',
      yearBuilt: apifyData.yearBuilt || 0,
      lotSquareFoot: apifyData.lotSize || apifyData.lotAreaValue || apifyData.resoFacts?.lotSize || 0,

      // Location
      latitude: apifyData.latitude || 0,
      longitude: apifyData.longitude || 0,

      // Financial
      price: apifyData.price || apifyData.listPrice || 0,
      estimate: apifyData.zestimate || apifyData.homeValue || apifyData.estimate || 0,
      rentEstimate: apifyData.rentZestimate || 0,
      hoa: apifyData.monthlyHoaFee || apifyData.hoa || 0,
      // Tax PAID (actual tax amount) - find the most recent entry with taxPaid value
      annualTaxAmount: (Array.isArray(apifyData.taxHistory)
        && apifyData.taxHistory.find((t: any) => t.taxPaid)?.taxPaid) || 0,
      // Tax assessment value
      recentPropertyTaxes: (Array.isArray(apifyData.taxHistory) && apifyData.taxHistory[0]?.value) || 0,
      propertyTaxRate: apifyData.propertyTaxRate || 0,
      annualHomeownersInsurance: apifyData.annualHomeownersInsurance || 0,

      // Listing info
      daysOnZillow: apifyData.daysOnZillow || 0,
      datePostedString: apifyData.datePostedString || '',
      listingDataSource: apifyData.listingDataSource || '',

      // Description
      description: apifyData.description || '',

      // ===== CRITICAL CONTACT INFORMATION =====
      agentName,
      agentPhoneNumber: finalAgentPhone, // Uses broker phone as fallback
      agentEmail: apifyData.attributionInfo?.agentEmail || apifyData.agentEmail || '',
      agentLicenseNumber: apifyData.attributionInfo?.agentLicenseNumber
        || (Array.isArray(apifyData.attributionInfo?.listingAgents) && apifyData.attributionInfo.listingAgents[0]?.memberStateLicense)
        || '',
      brokerName,
      brokerPhoneNumber: brokerPhone,

      // Images - extract from responsivePhotos array (Apify uses this field)
      propertyImages: Array.isArray(apifyData.responsivePhotos)
        ? apifyData.responsivePhotos.map((p: any) => p.url).filter(Boolean)
        : Array.isArray(apifyData.photos)
        ? apifyData.photos.map((p: any) => typeof p === 'string' ? p : p.url || p.href).filter(Boolean)
        : Array.isArray(apifyData.images)
        ? apifyData.images
        : [],

      // Metadata
      source: 'apify-zillow',
      importedAt: timestamp,
      scrapedAt: timestamp,
    };
  }

  /**
   * Save properties to Firebase
   */
  private async saveToFirebase(properties: any[]): Promise<void> {
    console.log(`   💾 Saving to Firebase...`);

    const batch = db.batch();
    let skippedCount = 0;

    for (const rawProperty of properties) {
      try {
        // Transform to our schema - returns null if no phone numbers
        const propertyData = this.transformProperty(rawProperty);

        // Skip if validation failed (no phone numbers)
        if (!propertyData) {
          skippedCount++;
          this.failedCount++;
          continue;
        }

        // Create document reference
        const docRef = db.collection(this.collectionName).doc();

        batch.set(docRef, propertyData);
        this.importedCount++;

      } catch (error) {
        console.error(`   ⚠️  Error preparing property: ${rawProperty.url}`, error);
        this.failedCount++;
      }
    }

    // Commit batch
    await batch.commit();
    console.log(`   ✓ Saved ${this.importedCount} properties to Firebase`);
    if (skippedCount > 0) {
      console.log(`   ⚠️  Skipped ${skippedCount} properties (no agent/broker phone)`);
    }
  }

  /**
   * Get import stats
   */
  getStats() {
    return {
      imported: this.importedCount,
      failed: this.failedCount,
      total: this.importedCount + this.failedCount,
    };
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
Firebase Property Importer with Apify
======================================

Usage:
  npm run import-firebase <csv-file> [batch-size]

Arguments:
  csv-file    Path to CSV/Excel file with property URLs
  batch-size  Properties per batch (default: 50)

Examples:
  npm run import-firebase /Users/abdullahabunasrah/Downloads/texas.csv
  npm run import-firebase texas-urls.csv 25

Fields Imported:
  ✓ Full address, Street, City, State, Zip
  ✓ Bedrooms, Bathrooms, Square foot
  ✓ Building type, Year built, Lot square foot
  ✓ Price, Estimate, HOA
  ✓ Description
  ✓ Agent name, Agent phone
  ✓ Broker name, Broker phone
  ✓ Annual tax amount, Recent property taxes
  ✓ All property image URLs

Output:
  - Saves to Firebase 'zillow_imports' collection
  - Separate from main properties collection
  - Review before moving to production
    `);
    process.exit(0);
  }

  const filePath = args[0];
  const batchSize = args[1] ? parseInt(args[1]) : 50;

  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }

  try {
    const importer = new FirebasePropertyImporter();

    // Read URLs
    const properties = importer.readUrlsFromFile(filePath);
    console.log(`✅ Found ${properties.length} property URLs`);

    if (properties.length === 0) {
      console.error('❌ No URLs found in file');
      process.exit(1);
    }

    // Show sample
    console.log('\nSample URLs:');
    properties.slice(0, 3).forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.url}`);
      if (p.address) console.log(`     ${p.address}`);
    });
    if (properties.length > 3) {
      console.log(`  ... and ${properties.length - 3} more`);
    }

    // Import to Firebase
    await importer.importToFirebase(properties, batchSize);

    const stats = importer.getStats();
    console.log(`\n📊 Final Stats:`);
    console.log(`   Success: ${stats.imported}`);
    console.log(`   Failed: ${stats.failed}`);
    console.log(`   Total: ${stats.total}`);

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { FirebasePropertyImporter };
