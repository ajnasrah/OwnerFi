import { NextRequest, NextResponse } from 'next/server';
import {
  doc,
  getDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logError, logInfo, logWarn } from '@/lib/logger';
import crypto from 'crypto';

const GHL_WEBHOOK_SECRET = process.env.GHL_WEBHOOK_SECRET || '';
const BYPASS_SIGNATURE_CHECK = process.env.GHL_BYPASS_SIGNATURE === 'true'; // For testing only

function verifyWebhookSignature(
  payload: string,
  signature: string | null
): boolean {
  // TESTING ONLY: Bypass signature check if env var is set
  if (BYPASS_SIGNATURE_CHECK) {
    logWarn('⚠️ WARNING: Signature verification bypassed for testing');
    return true;
  }

  if (!signature || !GHL_WEBHOOK_SECRET) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', GHL_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

interface GHLDeletePayload {
  contactId?: string;
  locationId?: string;
  propertyId?: string;
  opportunityId?: string; // GHL sends this
  id?: string; // GHL might also send this
  propertyIds?: string[];
  deleteBy?: {
    field: string;
    value: string | number;
  };
  deleteAll?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    const body = await request.text();
    const signature = request.headers.get('x-ghl-signature');

    // Debug logging
    logInfo('GoHighLevel delete webhook request received', {
      action: 'webhook_request',
      metadata: {
        hasSignature: !!signature,
        signatureValue: signature,
        bodyLength: body.length,
        bodyPreview: body.substring(0, 200),
        hasSecret: !!GHL_WEBHOOK_SECRET,
        allHeaders: Object.fromEntries(request.headers.entries())
      }
    });

    if (!verifyWebhookSignature(body, signature)) {
      logError('Invalid GoHighLevel webhook signature', {
        action: 'signature_verification_failed',
        metadata: {
          providedSignature: signature,
          hasSecret: !!GHL_WEBHOOK_SECRET,
          bodyLength: body.length
        }
      });
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 401 }
      );
    }

    const payload: GHLDeletePayload = JSON.parse(body);

    // GHL can send opportunityId, id, or propertyId - normalize to propertyId
    const propertyId = payload.propertyId || payload.opportunityId || payload.id;

    logInfo('GoHighLevel delete property webhook received', {
      action: 'webhook_received',
      metadata: {
        hasPropertyId: !!payload.propertyId,
        hasOpportunityId: !!payload.opportunityId,
        hasId: !!payload.id,
        normalizedPropertyId: propertyId,
        hasPropertyIds: !!payload.propertyIds,
        hasDeleteBy: !!payload.deleteBy,
        deleteAll: payload.deleteAll,
        fullPayload: payload
      }
    });

    const deletedProperties: string[] = [];
    const errors: string[] = [];

    if (payload.deleteAll === true) {
      logWarn('Delete all properties requested - this action requires additional confirmation');
      return NextResponse.json(
        {
          success: false,
          error: 'Delete all properties requires additional confirmation',
          requiresConfirmation: true
        },
        { status: 400 }
      );
    }

    if (propertyId) {
      try {
        const propertyRef = doc(db, 'properties', propertyId);
        const propertyDoc = await getDoc(propertyRef);

        if (!propertyDoc.exists()) {
          errors.push(`Property ${propertyId} not found`);
          logWarn(`Property ${propertyId} not found in database`, {
            action: 'property_not_found',
            metadata: { propertyId }
          });
        } else {
          await deleteDoc(propertyRef);
          deletedProperties.push(propertyId);
          logInfo(`Successfully deleted property ${propertyId}`, {
            action: 'property_deleted',
            metadata: { propertyId }
          });
        }
      } catch (error) {
        errors.push(`Failed to delete property ${propertyId}: ${error}`);
        logError(`Error deleting property ${propertyId}:`, {
          action: 'delete_error',
          metadata: { propertyId }
        }, error as Error);
      }
    }

    if (payload.propertyIds && Array.isArray(payload.propertyIds)) {
      const batch = writeBatch(db);

      for (const id of payload.propertyIds) {
        try {
          const propertyRef = doc(db, 'properties', id);
          const propertyDoc = await getDoc(propertyRef);

          if (!propertyDoc.exists()) {
            errors.push(`Property ${id} not found`);
          } else {
            batch.delete(propertyRef);
            deletedProperties.push(id);
          }
        } catch (error) {
          errors.push(`Failed to process property ${id}: ${error}`);
          logError(`Error processing property ${id}:`, error);
        }
      }

      if (deletedProperties.length > 0) {
        await batch.commit();
        logInfo(`Batch deleted ${deletedProperties.length} properties`);
      }
    }

    if (payload.deleteBy) {
      const { field, value } = payload.deleteBy;

      const allowedFields = ['address', 'city', 'state', 'zipCode', 'status'];
      if (!allowedFields.includes(field)) {
        return NextResponse.json(
          {
            success: false,
            error: `Invalid field for deletion: ${field}. Allowed fields: ${allowedFields.join(', ')}`
          },
          { status: 400 }
        );
      }

      try {
        const q = query(
          collection(db, 'properties'),
          where(field, '==', value)
        );

        const snapshot = await getDocs(q);

        if (snapshot.empty) {
          errors.push(`No properties found with ${field} = ${value}`);
        } else {
          const batch = writeBatch(db);

          snapshot.forEach((doc) => {
            batch.delete(doc.ref);
            deletedProperties.push(doc.id);
          });

          await batch.commit();
          logInfo(`Deleted ${deletedProperties.length} properties where ${field} = ${value}`);
        }
      } catch (error) {
        errors.push(`Failed to delete properties by ${field}: ${error}`);
        logError(`Error deleting properties by ${field}:`, error);
      }
    }

    const response = {
      success: deletedProperties.length > 0,
      data: {
        deletedProperties,
        deletedCount: deletedProperties.length,
        errors: errors.length > 0 ? errors : undefined,
        contactId: payload.contactId,
        locationId: payload.locationId
      }
    };

    if (deletedProperties.length === 0 && errors.length > 0) {
      return NextResponse.json(response, { status: 400 });
    }

    return NextResponse.json(response);

  } catch (error) {
    logError('Error in GoHighLevel delete property webhook:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete properties',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}