// GoHighLevel API Integration
import { logError, logInfo } from './logger';

const GHL_API_KEY = process.env.GHL_API_KEY || '';
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID || '';
const GHL_API_BASE = 'https://services.leadconnectorhq.com';

// Required environment variables:
// - GHL_API_KEY: Your GoHighLevel API key
// - GHL_LOCATION_ID: Your GoHighLevel location ID
// Note: Pipeline and stage are managed by GoHighLevel workflows, not needed here

interface PropertyData {
  id: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  listPrice: number;
  bedrooms: number;
  bathrooms: number;
  squareFeet?: number;
  imageUrl?: string;
  imageUrls?: string[];
  monthlyPayment?: number;
  downPaymentAmount?: number;
  interestRate?: number;
  description?: string;
  [key: string]: any;
}

interface BuyerData {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  maxMonthlyPayment: number;
  maxDownPayment: number;
  searchRadius?: number;
  languages?: string[];
  createdAt?: any;
  [key: string]: any;
}

/**
 * Create or update an opportunity in GoHighLevel
 */
export async function syncPropertyToGHL(property: PropertyData): Promise<{ success: boolean; opportunityId?: string; error?: string }> {
  try {
    if (!GHL_API_KEY || !GHL_LOCATION_ID) {
      logError('GoHighLevel API credentials not configured');
      return { success: false, error: 'API credentials not configured' };
    }

    // Format opportunity name
    const opportunityName = `${property.address}, ${property.city}, ${property.state} ${property.zipCode}`;

    // Create opportunity payload
    // Note: pipelineId and stageId are managed by GoHighLevel workflows
    const opportunityData: any = {
      locationId: GHL_LOCATION_ID,
      name: opportunityName,
      status: 'open',
      monetaryValue: property.listPrice,
      customFields: [
        { id: 'property_address', value: property.address },
        { id: 'property_city', value: property.city },
        { id: 'property_state', value: property.state },
        { id: 'property_zip', value: property.zipCode },
        { id: 'property_price', value: property.listPrice },
        { id: 'property_bedrooms', value: property.bedrooms },
        { id: 'property_bathrooms', value: property.bathrooms },
        { id: 'property_sqft', value: property.squareFeet || 0 },
        { id: 'property_monthly_payment', value: property.monthlyPayment || 0 },
        { id: 'property_down_payment', value: property.downPaymentAmount || 0 },
        { id: 'property_interest_rate', value: property.interestRate || 0 },
        { id: 'property_image_url', value: property.imageUrl || property.imageUrls?.[0] || '' },
        { id: 'property_id', value: property.id },
      ]
    };

    // Check if opportunity already exists
    const existingOpportunity = await findOpportunityByPropertyId(property.id);

    let response: Response;
    if (existingOpportunity) {
      // Update existing opportunity
      logInfo(`Updating existing opportunity for property ${property.id}`, {
        action: 'ghl_update_opportunity',
        metadata: { opportunityId: existingOpportunity.id, propertyId: property.id }
      });

      response = await fetch(`${GHL_API_BASE}/opportunities/${existingOpportunity.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${GHL_API_KEY}`,
          'Content-Type': 'application/json',
          'Version': '2021-07-28'
        },
        body: JSON.stringify(opportunityData)
      });
    } else {
      // Create new opportunity
      logInfo(`Creating new opportunity for property ${property.id}`, {
        action: 'ghl_create_opportunity',
        metadata: { propertyId: property.id }
      });

      response = await fetch(`${GHL_API_BASE}/opportunities`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GHL_API_KEY}`,
          'Content-Type': 'application/json',
          'Version': '2021-07-28'
        },
        body: JSON.stringify(opportunityData)
      });
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logError('GoHighLevel API error', {
        action: 'ghl_api_error',
        metadata: { status: response.status, error: errorData }
      });
      return { success: false, error: `API error: ${response.status}` };
    }

    const data = await response.json();
    const opportunityId = data.opportunity?.id || data.id;

    logInfo(`Successfully synced property ${property.id} to GoHighLevel`, {
      action: 'ghl_sync_success',
      metadata: { propertyId: property.id, opportunityId }
    });

    return { success: true, opportunityId };

  } catch (error) {
    logError('Failed to sync property to GoHighLevel', {
      action: 'ghl_sync_error',
      metadata: { propertyId: property.id }
    }, error as Error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Find an opportunity by property ID
 */
async function findOpportunityByPropertyId(propertyId: string): Promise<{ id: string } | null> {
  try {
    // Search for opportunity with matching property_id custom field
    const response = await fetch(`${GHL_API_BASE}/opportunities/search?locationId=${GHL_LOCATION_ID}&property_id=${propertyId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${GHL_API_KEY}`,
        'Version': '2021-07-28'
      }
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (data.opportunities && data.opportunities.length > 0) {
      return { id: data.opportunities[0].id };
    }

    return null;
  } catch (error) {
    logError('Failed to search for opportunity', error);
    return null;
  }
}

/**
 * Batch sync multiple properties to GoHighLevel
 */
export async function batchSyncPropertiesToGHL(properties: PropertyData[]): Promise<{
  success: boolean;
  syncedCount: number;
  failedCount: number;
  errors: string[];
}> {
  const results = {
    success: true,
    syncedCount: 0,
    failedCount: 0,
    errors: [] as string[]
  };

  for (const property of properties) {
    const result = await syncPropertyToGHL(property);

    if (result.success) {
      results.syncedCount++;
    } else {
      results.failedCount++;
      results.errors.push(`${property.address}: ${result.error}`);
    }

    // Rate limiting - wait 100ms between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  results.success = results.failedCount === 0;

  logInfo(`Batch sync completed: ${results.syncedCount} succeeded, ${results.failedCount} failed`, {
    action: 'ghl_batch_sync_complete',
    metadata: results
  });

  return results;
}

/**
 * Create or update a contact in GoHighLevel for a new buyer
 */
export async function syncBuyerToGHL(buyer: BuyerData): Promise<{ success: boolean; contactId?: string; error?: string }> {
  try {
    if (!GHL_API_KEY || !GHL_LOCATION_ID) {
      logError('GoHighLevel API credentials not configured for buyer sync');
      return { success: false, error: 'API credentials not configured' };
    }

    // Create contact payload
    const contactData = {
      locationId: GHL_LOCATION_ID,
      firstName: buyer.firstName || '',
      lastName: buyer.lastName || '',
      name: `${buyer.firstName} ${buyer.lastName}`.trim(),
      email: buyer.email,
      phone: buyer.phone,
      address1: buyer.city ? `${buyer.city}, ${buyer.state}` : undefined,
      city: buyer.city,
      state: buyer.state,
      tags: ['buyer', 'ownerfi-buyer'],
      customFields: [
        { key: 'buyer_id', field_value: buyer.id },
        { key: 'user_id', field_value: buyer.userId },
        { key: 'max_monthly_payment', field_value: buyer.maxMonthlyPayment?.toString() || '0' },
        { key: 'max_down_payment', field_value: buyer.maxDownPayment?.toString() || '0' },
        { key: 'preferred_city', field_value: buyer.city || '' },
        { key: 'preferred_state', field_value: buyer.state || '' },
        { key: 'search_radius', field_value: buyer.searchRadius?.toString() || '25' },
        { key: 'languages', field_value: buyer.languages?.join(', ') || 'English' },
        { key: 'source', field_value: 'ownerfi_platform' }
      ]
    };

    // Check if contact already exists by email
    const searchResponse = await fetch(`${GHL_API_BASE}/contacts/search?locationId=${GHL_LOCATION_ID}&email=${encodeURIComponent(buyer.email)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${GHL_API_KEY}`,
        'Version': '2021-07-28'
      }
    });

    let contactId: string | undefined;
    let response: Response;

    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      if (searchData.contacts && searchData.contacts.length > 0) {
        // Update existing contact
        contactId = searchData.contacts[0].id;

        logInfo(`Updating existing GoHighLevel contact for buyer ${buyer.id}`, {
          action: 'ghl_update_buyer',
          metadata: { buyerId: buyer.id, contactId }
        });

        response = await fetch(`${GHL_API_BASE}/contacts/${contactId}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${GHL_API_KEY}`,
            'Content-Type': 'application/json',
            'Version': '2021-07-28'
          },
          body: JSON.stringify(contactData)
        });
      } else {
        // Create new contact
        logInfo(`Creating new GoHighLevel contact for buyer ${buyer.id}`, {
          action: 'ghl_create_buyer',
          metadata: { buyerId: buyer.id }
        });

        response = await fetch(`${GHL_API_BASE}/contacts`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${GHL_API_KEY}`,
            'Content-Type': 'application/json',
            'Version': '2021-07-28'
          },
          body: JSON.stringify(contactData)
        });
      }
    } else {
      // Create new contact if search failed
      response = await fetch(`${GHL_API_BASE}/contacts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GHL_API_KEY}`,
          'Content-Type': 'application/json',
          'Version': '2021-07-28'
        },
        body: JSON.stringify(contactData)
      });
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logError('GoHighLevel API error syncing buyer', {
        action: 'ghl_buyer_sync_error',
        metadata: { status: response.status, error: errorData, buyerId: buyer.id }
      });
      return { success: false, error: `API error: ${response.status}` };
    }

    const data = await response.json();
    contactId = contactId || data.contact?.id || data.id;

    logInfo(`Successfully synced buyer ${buyer.id} to GoHighLevel`, {
      action: 'ghl_buyer_sync_success',
      metadata: { buyerId: buyer.id, contactId }
    });

    return { success: true, contactId };

  } catch (error) {
    logError('Failed to sync buyer to GoHighLevel', {
      action: 'ghl_buyer_sync_error',
      metadata: { buyerId: buyer.id }
    }, error as Error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
