import { ApifyClient } from 'apify-client';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

interface PropertyURL {
  url: string;
  address?: string;
  price?: string;
}

interface ApifyPropertyData {
  url: string;
  address?: string;
  price?: number;
  bedrooms?: number;
  bathrooms?: number;
  livingArea?: number;
  lotSize?: number;
  yearBuilt?: number;
  propertyType?: string;
  description?: string;
  images?: string[];
  [key: string]: any;
}

class ApifyZillowScraper {
  private client: ApifyClient;
  // Original (expired): 'fdbXYQHBkaccpmRtX'
  // Free alternative: 'maxcopell/zillow-detail-scraper'
  private actorId: string = 'maxcopell/zillow-detail-scraper';
  private allResults: ApifyPropertyData[] = [];

  constructor() {
    const apiKey = process.env.APIFY_API_KEY;

    if (!apiKey) {
      throw new Error('APIFY_API_KEY not found in environment variables');
    }

    this.client = new ApifyClient({ token: apiKey });
  }

  /**
   * Read Excel/CSV file and extract URLs
   */
  readUrlsFromFile(filePath: string): PropertyURL[] {
    console.log(`📂 Reading file: ${filePath}\n`);

    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.csv') {
      return this.readCSV(filePath);
    } else if (ext === '.xlsx' || ext === '.xls') {
      return this.readExcel(filePath);
    } else {
      throw new Error(`Unsupported file type: ${ext}. Use .csv, .xlsx, or .xls`);
    }
  }

  /**
   * Read CSV file
   */
  private readCSV(filePath: string): PropertyURL[] {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    return this.extractURLs(data);
  }

  /**
   * Read Excel file
   */
  private readExcel(filePath: string): PropertyURL[] {
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

    // Look for columns that might contain URLs
    const urlKeys = ['url', 'URL', 'link', 'Link', 'property_url', 'Property URL'];
    const addressKeys = ['address', 'Address', 'street', 'Street'];
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

      // If no URL found, check all values
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
   * Scrape properties using Apify
   */
  async scrapeProperties(properties: PropertyURL[], batchSize: number = 50): Promise<ApifyPropertyData[]> {
    console.log(`🏡 Starting Apify scraping for ${properties.length} properties\n`);
    console.log(`📦 Batch size: ${batchSize} properties per run\n`);

    // Split into batches to avoid overwhelming Apify
    const batches: PropertyURL[][] = [];
    for (let i = 0; i < properties.length; i += batchSize) {
      batches.push(properties.slice(i, i + batchSize));
    }

    console.log(`📊 Total batches: ${batches.length}\n`);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🔄 Processing Batch ${i + 1}/${batches.length} (${batch.length} properties)`);
      console.log('='.repeat(60));

      try {
        const results = await this.runApifyActor(batch);
        this.allResults.push(...results);

        console.log(`✅ Batch ${i + 1} complete: ${results.length} properties scraped`);
        console.log(`📊 Total scraped so far: ${this.allResults.length}/${properties.length}\n`);

        // Save progress after each batch
        this.saveProgress();

        // Delay between batches to be respectful
        if (i < batches.length - 1) {
          const delay = 5000; // 5 seconds
          console.log(`⏳ Waiting ${delay / 1000} seconds before next batch...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

      } catch (error) {
        console.error(`❌ Error in batch ${i + 1}:`, error);
        console.log('Continuing with next batch...\n');
      }
    }

    return this.allResults;
  }

  /**
   * Run Apify actor for a batch of URLs
   */
  private async runApifyActor(properties: PropertyURL[]): Promise<ApifyPropertyData[]> {
    // Prepare input format for Apify (maxcopell/zillow-detail-scraper uses startUrls)
    const input = {
      startUrls: properties.map(p => ({ url: p.url }))
    };

    console.log(`   🚀 Starting Apify actor run...`);

    // Run the Actor and wait for it to finish
    const run = await this.client.actor(this.actorId).call(input);

    console.log(`   📥 Fetching results from dataset...`);

    // Fetch results from the run's dataset
    const { items } = await this.client.dataset(run.defaultDatasetId).listItems();

    console.log(`   ✓ Retrieved ${items.length} property details`);

    return items as ApifyPropertyData[];
  }

  /**
   * Save progress to JSON file
   */
  private saveProgress(): void {
    const outputDir = path.join(process.cwd(), 'apify-output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const progressPath = path.join(outputDir, 'zillow-details-progress.json');
    fs.writeFileSync(progressPath, JSON.stringify(this.allResults, null, 2));
  }

  /**
   * Save final results
   */
  saveResults(): void {
    const outputDir = path.join(process.cwd(), 'apify-output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Save JSON
    const jsonPath = path.join(outputDir, 'zillow-details-complete.json');
    fs.writeFileSync(jsonPath, JSON.stringify(this.allResults, null, 2));
    console.log(`\n💾 Saved JSON: ${jsonPath}`);

    // Save Excel
    this.saveToExcel();

    // Save CSV
    this.saveToCSV();
  }

  /**
   * Save to Excel file
   */
  private saveToExcel(): void {
    const outputDir = path.join(process.cwd(), 'apify-output');

    // Flatten the data for Excel
    const flatData = this.allResults.map(property => ({
      URL: property.url,
      Address: property.address || '',
      Price: property.price || '',
      Bedrooms: property.bedrooms || '',
      Bathrooms: property.bathrooms || '',
      'Living Area (sqft)': property.livingArea || '',
      'Lot Size (sqft)': property.lotSize || '',
      'Year Built': property.yearBuilt || '',
      'Property Type': property.propertyType || '',
      Description: property.description || '',
      Images: Array.isArray(property.images) ? property.images.join(', ') : '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(flatData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Properties');

    const excelPath = path.join(outputDir, 'zillow-details-complete.xlsx');
    XLSX.writeFile(workbook, excelPath);
    console.log(`💾 Saved Excel: ${excelPath}`);
  }

  /**
   * Save to CSV file
   */
  private saveToCSV(): void {
    const outputDir = path.join(process.cwd(), 'apify-output');

    const headers = [
      'URL', 'Address', 'Price', 'Bedrooms', 'Bathrooms',
      'Living Area (sqft)', 'Lot Size (sqft)', 'Year Built',
      'Property Type', 'Description'
    ];

    const rows = this.allResults.map(property => [
      property.url,
      property.address || '',
      property.price || '',
      property.bedrooms || '',
      property.bathrooms || '',
      property.livingArea || '',
      property.lotSize || '',
      property.yearBuilt || '',
      property.propertyType || '',
      (property.description || '').replace(/"/g, '""'), // Escape quotes
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const csvPath = path.join(outputDir, 'zillow-details-complete.csv');
    fs.writeFileSync(csvPath, csvContent);
    console.log(`💾 Saved CSV: ${csvPath}`);
  }

  getResults(): ApifyPropertyData[] {
    return this.allResults;
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
Apify Zillow Property Scraper
==============================

Usage:
  npm run scrape-apify <file-path> [batch-size]

Arguments:
  file-path   Path to Excel/CSV file with property URLs (required)
  batch-size  Number of properties per batch (default: 50)

Examples:
  npm run scrape-apify scraper-output/zillow-texas-results.csv
  npm run scrape-apify ~/Downloads/properties.xlsx 25

The file should contain a column with Zillow property URLs.
Column names like "url", "URL", "link", or "property_url" work automatically.
    `);
    process.exit(0);
  }

  const filePath = args[0];
  const batchSize = args[1] ? parseInt(args[1]) : 50;

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }

  try {
    const scraper = new ApifyZillowScraper();

    // Read URLs from file
    const properties = scraper.readUrlsFromFile(filePath);
    console.log(`✅ Found ${properties.length} property URLs\n`);

    if (properties.length === 0) {
      console.error('❌ No property URLs found in the file.');
      console.log('Make sure your file has a column with Zillow URLs.');
      process.exit(1);
    }

    // Show sample
    console.log('Sample URLs:');
    properties.slice(0, 3).forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.url}`);
      if (p.address) console.log(`     Address: ${p.address}`);
    });
    if (properties.length > 3) {
      console.log(`  ... and ${properties.length - 3} more\n`);
    }

    // Scrape using Apify
    await scraper.scrapeProperties(properties, batchSize);

    // Save results
    scraper.saveResults();

    const results = scraper.getResults();
    console.log('\n' + '='.repeat(60));
    console.log('✅ Scraping Complete!');
    console.log('='.repeat(60));
    console.log(`Total properties scraped: ${results.length}/${properties.length}`);
    console.log(`\nResults saved to: apify-output/`);

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { ApifyZillowScraper };
