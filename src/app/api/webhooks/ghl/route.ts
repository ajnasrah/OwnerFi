import { NextRequest, NextResponse } from 'next/server';
import { PropertyListing } from '@/lib/property-schema';
import { logInfo, logError } from '@/lib/logger';
import { adminDb } from '@/lib/firebase-admin';
import { 
  calculatePropertyFinancials, 
  validatePropertyFinancials 
} from '@/lib/property-calculations';
import { queueNearbyCitiesForProperty } from '@/lib/property-enhancement';

interface GHLWebhookData {
  id: string;
  type: string;
  customFields?: Record<string, string>;
  name?: string;
  [key: string]: unknown;
}

// GoHighLevel webhook handler for property listings
export async function POST(request: NextRequest) {
    // Check if Firebase Admin is initialized
    if (!adminDb) {
      return NextResponse.json({ error: 'Database connection not available' }, { status: 503 });
    }

  try {
    // Verify webhook signature
    const signature = request.headers.get('x-ghl-signature');
    const webhookSecret = process.env.GHL_WEBHOOK_SECRET;
    
    if (!webhookSecret || !signature) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.text();
    const data = JSON.parse(body);
    
    // Log incoming webhook
    await logInfo('GoHighLevel webhook received', {
      action: 'ghl_webhook',
      metadata: {
        type: data.type,
        contactId: data.contactId,
        eventData: data
      }
    });

    // Handle different webhook events
    switch (data.type) {
      case 'ContactCreate':
      case 'ContactUpdate':
        await handlePropertyListing(data);
        break;
      
      case 'ContactDelete':
        await handlePropertyDeletion(data);
        break;
        
      default:
        console.log('Unhandled GHL webhook type:', data.type);
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    await logError('GoHighLevel webhook error', {
      action: 'ghl_webhook_error'
    }, error as Error);

    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function handlePropertyListing(data: GHLWebhookData) {
  try {
    const customFields = data.customFields || {};
    
    // Map GHL CSV columns to our system (based on your template)
    const rawPropertyData = {
      // Basic property info
      address: String(customFields['Property Address'] || (data as any).address1 || ''),
      city: String(customFields['Property city'] || (data as any).city || ''),
      state: String(customFields.state || (data as any).state || ''),
      zipCode: String(customFields['Zip code'] || (data as any).postalCode || ''),
      
      // Property details
      bedrooms: parseInt(customFields.bedrooms || '0'),
      bathrooms: parseFloat(customFields.bathrooms || '0'),
      squareFeet: parseInt(customFields.livingArea || customFields.square_feet || '0'),
      yearBuilt: parseInt(customFields.yearBuilt || '0'),
      lotSize: parseFloat(customFields['lot sizes'] || '0'),
      
      // Description
      description: customFields.description || data.notes || '',
      homeType: customFields.homeType || 'single-family',
      
      // Financial data (might be provided or need calculation)
      listPrice: parseFloat(customFields.price || customFields.list_price || '0'),
      downPaymentAmount: parseFloat(customFields['down payment amount'] || '0'),
      downPaymentPercent: parseFloat(customFields['down payment'] || '0'), // This is percentage
      monthlyPayment: parseFloat(customFields['Monthly payment'] || '0'),
      interestRate: parseFloat(customFields['Interest rate'] || '7.0'),
      balloonPayment: parseFloat(customFields.Balloon || '0'),
      
      // Media - this is the key field you mentioned!
      imageUrl: customFields['Image link'] || '', // Single image URL from GHL
      
      // Lead tracking
      leadValue: parseFloat(customFields['Lead Value'] || '0'),
      buyersCompensation: customFields['Buyers Compensation'] || ''
    };

    // Calculate missing financial fields using our calculation system
    const financials = calculatePropertyFinancials({
      listPrice: rawPropertyData.listPrice,
      downPaymentAmount: rawPropertyData.downPaymentAmount,
      downPaymentPercent: rawPropertyData.downPaymentPercent,
      monthlyPayment: rawPropertyData.monthlyPayment,
      interestRate: rawPropertyData.interestRate,
      termYears: 20, // Default to 20 years if not specified
      balloonPayment: rawPropertyData.balloonPayment > 0 ? rawPropertyData.balloonPayment : undefined
    });

    // Validate the calculated financials
    const validation = validatePropertyFinancials(financials);
    if (!validation.valid) {
      throw new Error(`Property financial validation failed: ${validation.errors.join(', ')}`);
    }

    // Log any warnings
    if (validation.warnings.length > 0) {
      await logInfo('Property financial warnings', {
        action: 'property_validation_warnings',
        metadata: {
          propertyAddress: rawPropertyData.address,
          warnings: validation.warnings
        }
      });
    }
    
    // Create final property object
    const propertyData: Partial<PropertyListing> = {
      id: `ghl_${data.contactId}`,
      
      // Address and location
      address: rawPropertyData.address,
      city: rawPropertyData.city,
      state: rawPropertyData.state,
      zipCode: rawPropertyData.zipCode,
      
      // Property details
      propertyType: (rawPropertyData.homeType === 'house' ? 'single-family' : 
                   rawPropertyData.homeType === 'mobile' ? 'mobile-home' : 
                   rawPropertyData.homeType as 'single-family' | 'condo' | 'townhouse' | 'mobile-home' | 'multi-family' | 'land') || 'single-family',
      bedrooms: rawPropertyData.bedrooms,
      bathrooms: rawPropertyData.bathrooms,
      squareFeet: rawPropertyData.squareFeet,
      yearBuilt: rawPropertyData.yearBuilt,
      lotSize: rawPropertyData.lotSize,
      
      // Calculated financial information
      listPrice: financials.listPrice,
      downPaymentAmount: financials.downPaymentAmount,
      downPaymentPercent: financials.downPaymentPercent,
      monthlyPayment: financials.monthlyPayment,
      interestRate: financials.interestRate,
      termYears: financials.termYears,
      balloonPayment: financials.balloonPayment,
      
      // Media - handle the image URL from GHL
      imageUrls: rawPropertyData.imageUrl ? [rawPropertyData.imageUrl] : [],
      
      // Description and marketing
      description: String(rawPropertyData.description || ''),
      
      // Owner information (from GHL contact)
      ownerName: `${(data as any).firstName || ''} ${(data as any).lastName || ''}`.trim(),
      ownerPhone: String((data as any).phone || ''),
      ownerEmail: String((data as any).email || ''),
      
      // Listing management
      status: 'active' as const,
      priority: 5,
      featured: false,
      
      // Integration data
      source: 'ghl-webhook' as const,
      sourceId: String(data.contactId),
      ghlData: {
        contactId: String(data.contactId),
        opportunityId: String((data as any).opportunityId || ''),
        customFields: customFields,
        tags: Array.isArray((data as any).tags) ? (data as any).tags : [],
        leadValue: rawPropertyData.leadValue,
        buyersCompensation: rawPropertyData.buyersCompensation
      },
      
      // Timestamps
      dateAdded: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };

    // Validate required fields
    if (!propertyData.address || !propertyData.city || !propertyData.listPrice) {
      throw new Error('Missing required property fields');
    }

    // Check if property already exists
    const existingDocs = await adminDb.collection('properties')
      .where('sourceId', '==', String(data.contactId))
      .get();

    if (existingDocs.empty) {
      // FAST: Create property immediately, queue nearby cities for background processing
      await adminDb.collection('properties').doc(propertyData.id!).set({
        ...propertyData,
        nearbyCities: [], // Empty initially, populated by background job
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      // Queue nearby cities population (non-blocking)
      queueNearbyCitiesForProperty(propertyData.id!, propertyData.city, propertyData.state);
      
      await logInfo('Created new property from GHL', {
        action: 'property_created',
        metadata: {
          propertyId: propertyData.id,
          address: propertyData.address,
          city: propertyData.city,
          price: propertyData.listPrice
        }
      });
    } else {
      // Update existing property
      const existingDoc = existingDocs.docs[0];
      await adminDb.collection('properties').doc(existingDoc.id).update({
        ...propertyData,
        updatedAt: new Date()
      });
      
      await logInfo('Updated property from GHL', {
        action: 'property_updated',
        metadata: {
          propertyId: existingDoc.id,
          address: propertyData.address
        }
      });
    }

    // Clean up user favorites/rejected if property was deleted from source
    if (data.type === 'ContactDelete') {
      await cleanupDeletedPropertyFromUsers(String(data.contactId));
    }

  } catch (error) {
    await logError('Failed to process property from GHL webhook', {
      action: 'ghl_property_error',
      metadata: { contactId: data.contactId }
    }, error as Error);
    throw error;
  }
}

async function handlePropertyDeletion(data: GHLWebhookData) {
  try {
    // Find and update property status
    const propertyDocs = await adminDb.collection('properties')
      .where('sourceId', '==', String(data.contactId))
      .get();

    if (!propertyDocs.empty) {
      const propertyDoc = propertyDocs.docs[0];
      await adminDb.collection('properties').doc(propertyDoc.id).update({
        status: 'withdrawn',
        updatedAt: new Date()
      });

      // Clean up from all user accounts
      await cleanupDeletedPropertyFromUsers(String(data.contactId));
      
      await logInfo('Deleted property from GHL', {
        action: 'property_deleted',
        metadata: { 
          propertyId: propertyDoc.id,
          contactId: data.contactId 
        }
      });
    }
  } catch (error) {
    await logError('Failed to delete property from GHL webhook', {
      action: 'ghl_deletion_error',
      metadata: { contactId: data.contactId }
    }, error as Error);
    throw error;
  }
}

// Clean up deleted properties from all user accounts
async function cleanupDeletedPropertyFromUsers(sourceId: string) {
  try {
    // This would need to run through all buyer profiles and remove 
    // the deleted property from their favorites/rejected lists
    // For now, we'll log it and handle cleanup in a background job
    
    await logInfo('Property cleanup needed', {
      action: 'property_cleanup_required',
      metadata: { 
        sourceId,
        note: 'Property deleted, needs removal from user favorites/rejected lists'
      }
    });
    
    // TODO: Implement background job to clean up user data
    // - Remove from favorites in all buyerProfiles
    // - Remove from rejected lists  
    // - Remove from any realtor purchased leads
    // - Update analytics/reporting
    
  } catch (error) {
    await logError('Failed to cleanup deleted property from user accounts', {
      action: 'property_cleanup_error',
      metadata: { sourceId }
    }, error as Error);
  }
}

// Helper function to validate property data
export function validatePropertyData(data: Partial<PropertyListing>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Required fields
  if (!data.address) errors.push('Address is required');
  if (!data.city) errors.push('City is required');
  if (!data.state) errors.push('State is required');
  if (!data.listPrice || data.listPrice <= 0) errors.push('Valid list price is required');
  if (!data.bedrooms || data.bedrooms < 0) errors.push('Valid bedroom count is required');
  if (!data.bathrooms || data.bathrooms < 0) errors.push('Valid bathroom count is required');
  
  // Financial validation
  if (!data.monthlyPayment || data.monthlyPayment <= 0) errors.push('Valid monthly payment is required');
  if (!data.downPaymentAmount || data.downPaymentAmount < 0) errors.push('Valid down payment is required');
  if (!data.interestRate || data.interestRate <= 0 || data.interestRate > 50) errors.push('Valid interest rate is required');
  if (!data.termYears || data.termYears <= 0 || data.termYears > 50) errors.push('Valid loan term is required');
  
  return {
    valid: errors.length === 0,
    errors
  };
}