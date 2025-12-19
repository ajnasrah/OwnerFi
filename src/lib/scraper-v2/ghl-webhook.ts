/**
 * GHL Webhook Integration
 *
 * Sends properties from Cash Deals Regional search to GHL
 * to find more owner finance deals
 */

import { GHL_WEBHOOK_URL } from './search-config';

export interface GHLPropertyPayload {
  zpid: number;
  address: string;
  city: string;
  state: string;
  zipcode: string;
  price: number;
  zestimate?: number;
  bedrooms?: number;
  bathrooms?: number;
  livingArea?: number;
  yearBuilt?: number;
  homeType?: string;
  description?: string;
  url: string;
  imgSrc?: string;
  source: string;
  scrapedAt: string;
}

/**
 * Send a single property to GHL webhook
 */
export async function sendToGHLWebhook(property: GHLPropertyPayload): Promise<boolean> {
  try {
    const response = await fetch(GHL_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(property),
    });

    if (!response.ok) {
      console.error(`[GHL] Failed to send property ${property.zpid}: ${response.status}`);
      return false;
    }

    return true;
  } catch (error: any) {
    console.error(`[GHL] Error sending property ${property.zpid}:`, error.message);
    return false;
  }
}

/**
 * Send multiple properties to GHL webhook (with rate limiting)
 */
export async function sendBatchToGHLWebhook(
  properties: GHLPropertyPayload[],
  options: {
    delayMs?: number;
    onProgress?: (sent: number, total: number) => void;
  } = {}
): Promise<{ sent: number; failed: number }> {
  const { delayMs = 100, onProgress } = options;
  let sent = 0;
  let failed = 0;

  console.log(`[GHL] Sending ${properties.length} properties to webhook...`);

  for (let i = 0; i < properties.length; i++) {
    const property = properties[i];
    const success = await sendToGHLWebhook(property);

    if (success) {
      sent++;
    } else {
      failed++;
    }

    // Progress callback
    if (onProgress && (i + 1) % 10 === 0) {
      onProgress(i + 1, properties.length);
    }

    // Rate limiting - small delay between requests
    if (delayMs > 0 && i < properties.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  console.log(`[GHL] Completed: ${sent} sent, ${failed} failed`);
  return { sent, failed };
}

/**
 * Transform a scraped property to GHL payload format
 */
export function toGHLPayload(property: {
  zpid: number;
  fullAddress?: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  zipcode?: string;
  price?: number;
  estimate?: number;
  bedrooms?: number;
  bathrooms?: number;
  livingArea?: number;
  yearBuilt?: number;
  homeType?: string;
  description?: string;
  zillowUrl?: string;
  imgSrc?: string;
  firstPropertyImage?: string;
}): GHLPropertyPayload {
  return {
    zpid: property.zpid,
    address: property.fullAddress || property.streetAddress || '',
    city: property.city || '',
    state: property.state || '',
    zipcode: property.zipCode || property.zipcode || '',
    price: property.price || 0,
    zestimate: property.estimate,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    livingArea: property.livingArea,
    yearBuilt: property.yearBuilt,
    homeType: property.homeType,
    description: property.description,
    url: property.zillowUrl || `https://www.zillow.com/homedetails/${property.zpid}_zpid/`,
    imgSrc: property.imgSrc || property.firstPropertyImage,
    source: 'cash-deals-regional',
    scrapedAt: new Date().toISOString(),
  };
}
