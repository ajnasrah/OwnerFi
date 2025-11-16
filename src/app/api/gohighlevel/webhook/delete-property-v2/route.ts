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

// Rate limiting map (in-memory, consider Redis for production)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_MINUTE = 20;

/**
 * SECURE DELETE PROPERTY WEBHOOK - V2
 *
 * Enhanced security features:
 * - REQUIRED webhook signature verification
 * - Rate limiting (max 20 requests/minute)
 * - Comprehensive audit logging
 * - IP tracking
 * - Bulk delete limits
 * - No bypass options
 *
 * Date Created: November 15, 2025
 */

function verifyWebhookSignature(
  payload: string,
  signature: string | null
): boolean {
  if (!signature || !GHL_WEBHOOK_SECRET) {
    logWarn('Missing signature or webhook secret', {
      action: 'signature_verification_failed',
      metadata: {
        hasSignature: !!signature,
        hasSecret: !!GHL_WEBHOOK_SECRET
      }
    });
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', GHL_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  const isValid = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );

  if (!isValid) {
    logWarn('Invalid webhook signature', {
      action: 'signature_verification_failed',
      metadata: {
        providedSignature: signature.substring(0, 10) + '...',
        expectedSignature: expectedSignature.substring(0, 10) + '...'
      }
    });
  }

  return isValid;
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const rateLimitData = rateLimitMap.get(ip);

  if (!rateLimitData || now > rateLimitData.resetTime) {
    // New window
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (rateLimitData.count >= MAX_REQUESTS_PER_MINUTE) {
    logWarn('Rate limit exceeded', {
      action: 'rate_limit_exceeded',
      metadata: {
        ip,
        count: rateLimitData.count,
        limit: MAX_REQUESTS_PER_MINUTE
      }
    });
    return false;
  }

  rateLimitData.count++;
  return true;
}

interface GHLDeletePayload {
  contactId?: string;
  locationId?: string;
  propertyId?: string;
  opportunityId?: string;
  id?: string;
  propertyIds?: string[];
  deleteBy?: {
    field: string;
    value: string | number;
  };
  deleteAll?: boolean;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Get IP for rate limiting and logging
    const ip = request.headers.get('x-forwarded-for') ||
               request.headers.get('x-real-ip') ||
               'unknown';

    // Check rate limit
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: `Maximum ${MAX_REQUESTS_PER_MINUTE} requests per minute allowed`,
          retryAfter: 60
        },
        { status: 429 }
      );
    }

    if (!db) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    const body = await request.text();
    const signature = request.headers.get('x-ghl-signature');

    // REQUIRED: Verify signature (no bypass)
    if (!verifyWebhookSignature(body, signature)) {
      logError('Unauthorized webhook request - invalid signature', {
        action: 'unauthorized_webhook_request',
        metadata: {
          ip,
          hasSignature: !!signature,
          timestamp: new Date().toISOString()
        }
      });

      return NextResponse.json(
        { error: 'Unauthorized - Invalid webhook signature' },
        { status: 401 }
      );
    }

    const payload: GHLDeletePayload = JSON.parse(body);

    // Log the authenticated request
    logInfo('Authenticated delete webhook request received', {
      action: 'webhook_request_authenticated',
      metadata: {
        ip,
        hasPropertyId: !!(payload.propertyId || payload.opportunityId || payload.id),
        hasPropertyIds: !!payload.propertyIds,
        hasDeleteBy: !!payload.deleteBy,
        propertyIdsCount: payload.propertyIds?.length || 0,
        timestamp: new Date().toISOString()
      }
    });

    const propertyIdFromHeaders = request.headers.get('propertyid') ||
                                   request.headers.get('propertyId') ||
                                   request.headers.get('opportunityid') ||
                                   request.headers.get('opportunityId');

    const propertyId = propertyIdFromHeaders || payload.propertyId || payload.opportunityId || payload.id;

    const deletedProperties: string[] = [];
    const errors: string[] = [];

    // BLOCK: deleteAll is not allowed
    if (payload.deleteAll === true) {
      logWarn('Blocked deleteAll request', {
        action: 'delete_all_blocked',
        metadata: { ip }
      });

      return NextResponse.json(
        {
          success: false,
          error: 'Delete all properties is not allowed',
          message: 'Use admin panel for mass deletions'
        },
        { status: 403 }
      );
    }

    // Single property deletion
    if (propertyId) {
      try {
        const propertyRef = doc(db, 'properties', propertyId);
        const propertyDoc = await getDoc(propertyRef);

        if (!propertyDoc.exists()) {
          errors.push(`Property ${propertyId} not found`);
          logWarn(`Property ${propertyId} not found in database`, {
            action: 'property_not_found',
            metadata: { propertyId, ip }
          });
        } else {
          // Log before deletion
          const propertyData = propertyDoc.data();
          logInfo(`Deleting property ${propertyId}`, {
            action: 'property_deletion_started',
            metadata: {
              propertyId,
              address: propertyData?.address,
              city: propertyData?.city,
              state: propertyData?.state,
              ip
            }
          });

          await deleteDoc(propertyRef);
          deletedProperties.push(propertyId);

          // Remove from queue
          try {
            const { deletePropertyWorkflow } = await import('@/lib/property-workflow');
            const deleted = await deletePropertyWorkflow(propertyId);
            if (deleted) {
              logInfo(`Removed deleted property from queue: ${propertyId}`, {
                action: 'queue_cleanup',
                metadata: { propertyId }
              });
            }
          } catch (queueError) {
            logWarn(`Could not remove from queue: ${propertyId}`, {
              action: 'queue_cleanup_error',
              metadata: { propertyId, error: (queueError as Error).message }
            });
          }

          logInfo(`Successfully deleted property ${propertyId}`, {
            action: 'property_deleted',
            metadata: { propertyId, ip, deletionTime: Date.now() - startTime }
          });
        }
      } catch (error) {
        errors.push(`Failed to delete property ${propertyId}: ${error}`);
        logError(`Error deleting property ${propertyId}:`, {
          action: 'delete_error',
          metadata: { propertyId, ip }
        }, error as Error);
      }
    }

    // Batch deletion with limit
    if (payload.propertyIds && Array.isArray(payload.propertyIds)) {
      // Limit batch size
      const MAX_BATCH_SIZE = 50;
      if (payload.propertyIds.length > MAX_BATCH_SIZE) {
        return NextResponse.json(
          {
            success: false,
            error: `Batch size exceeds limit`,
            message: `Maximum ${MAX_BATCH_SIZE} properties per request. Received: ${payload.propertyIds.length}`,
            limit: MAX_BATCH_SIZE
          },
          { status: 400 }
        );
      }

      logInfo(`Batch deletion started for ${payload.propertyIds.length} properties`, {
        action: 'batch_deletion_started',
        metadata: {
          count: payload.propertyIds.length,
          ip
        }
      });

      const batch = writeBatch(db);
      const queueCleanupIds: string[] = [];

      for (const id of payload.propertyIds) {
        try {
          const propertyRef = doc(db, 'properties', id);
          const propertyDoc = await getDoc(propertyRef);

          if (!propertyDoc.exists()) {
            errors.push(`Property ${id} not found`);
          } else {
            batch.delete(propertyRef);
            deletedProperties.push(id);
            queueCleanupIds.push(id);
          }
        } catch (error) {
          errors.push(`Failed to process property ${id}: ${error}`);
          logError(`Error processing property ${id}:`, error);
        }
      }

      if (deletedProperties.length > 0) {
        await batch.commit();
        logInfo(`Batch deleted ${deletedProperties.length} properties`, {
          action: 'batch_deletion_completed',
          metadata: {
            count: deletedProperties.length,
            ip,
            deletionTime: Date.now() - startTime
          }
        });

        // Clean up queue
        const { deletePropertyWorkflow } = await import('@/lib/property-workflow');
        for (const id of queueCleanupIds) {
          try {
            await deletePropertyWorkflow(id);
          } catch (queueError) {
            logWarn(`Could not remove ${id} from queue`, {
              action: 'queue_cleanup_error',
              metadata: { propertyId: id }
            });
          }
        }
        logInfo(`Cleaned up ${queueCleanupIds.length} entries from queue`);
      }
    }

    // Query-based deletion with restrictions
    if (payload.deleteBy) {
      const { field, value } = payload.deleteBy;

      const allowedFields = ['address', 'city', 'state', 'zipCode', 'status'];
      if (!allowedFields.includes(field)) {
        return NextResponse.json(
          {
            success: false,
            error: `Invalid field for deletion: ${field}`,
            message: `Allowed fields: ${allowedFields.join(', ')}`
          },
          { status: 400 }
        );
      }

      logInfo(`Query deletion started for ${field} = ${value}`, {
        action: 'query_deletion_started',
        metadata: { field, value, ip }
      });

      try {
        const q = query(
          collection(db, 'properties'),
          where(field, '==', value)
        );

        const snapshot = await getDocs(q);

        if (snapshot.empty) {
          errors.push(`No properties found with ${field} = ${value}`);
        } else {
          // Limit query-based deletions
          const MAX_QUERY_DELETE = 100;
          if (snapshot.size > MAX_QUERY_DELETE) {
            return NextResponse.json(
              {
                success: false,
                error: `Query would delete too many properties`,
                message: `Found ${snapshot.size} properties, limit is ${MAX_QUERY_DELETE}`,
                limit: MAX_QUERY_DELETE,
                found: snapshot.size
              },
              { status: 400 }
            );
          }

          const batch = writeBatch(db);
          const deleteByCleanupIds: string[] = [];

          snapshot.forEach((doc) => {
            batch.delete(doc.ref);
            deletedProperties.push(doc.id);
            deleteByCleanupIds.push(doc.id);
          });

          await batch.commit();
          logInfo(`Deleted ${deletedProperties.length} properties where ${field} = ${value}`, {
            action: 'query_deletion_completed',
            metadata: {
              field,
              value,
              count: deletedProperties.length,
              ip,
              deletionTime: Date.now() - startTime
            }
          });

          // Clean up queue
          for (const id of deleteByCleanupIds) {
            try {
              const { deletePropertyWorkflow } = await import('@/lib/property-workflow');
              await deletePropertyWorkflow(id);
            } catch (queueError) {
              logWarn(`Could not remove ${id} from queue`, {
                action: 'queue_cleanup_error',
                metadata: { propertyId: id }
              });
            }
          }
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
        locationId: payload.locationId,
        processingTime: Date.now() - startTime
      }
    };

    if (deletedProperties.length === 0 && errors.length > 0) {
      return NextResponse.json(response, { status: 400 });
    }

    return NextResponse.json(response);

  } catch (error) {
    logError('Error in delete property webhook:', error);
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
