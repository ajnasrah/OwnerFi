/**
 * Local preview of the redesigned property card — OF + cash variants.
 * Uses the real buildCardHTML from generate-property-cards.ts so it stays
 * in sync with production output.
 */
import puppeteer from 'puppeteer';
import { buildCardHTML } from './generate-property-cards';

const REAL_IMAGE = 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=1600&q=80';

const samples = [
  {
    id: 'sample-of',
    address: '123 Main St',
    city: 'Austin',
    state: 'TX',
    zipCode: '78701',
    listPrice: 285000,
    bedrooms: 3,
    bathrooms: 2,
    squareFeet: 1850,
    primaryImage: REAL_IMAGE,
    monthlyPayment: 1650,
    dealType: ['owner_finance'],
  },
  {
    id: 'sample-cash',
    address: '456 Oak Ave',
    city: 'Memphis',
    state: 'TN',
    zipCode: '38104',
    listPrice: 115000,
    bedrooms: 4,
    bathrooms: 2,
    squareFeet: 1450,
    primaryImage: REAL_IMAGE,
    dealType: ['cash_deal'],
  },
];

async function main() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  for (const [i, p] of samples.entries()) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
    const html = buildCardHTML(p as any);
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 15000 });
    await new Promise(r => setTimeout(r, 1500));
    const out = `/tmp/preview-card-${i + 1}-${p.dealType?.[0]}.png`;
    await page.screenshot({ path: out as `${string}.png`, type: 'png' });
    console.log(`Saved ${out}`);
    await page.close();
  }
  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
