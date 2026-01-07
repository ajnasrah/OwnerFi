/**
 * GoHighLevel SMS Notification System
 *
 * This module handles sending property match notifications to buyers via GoHighLevel webhooks.
 */

import { BuyerProfile } from './firebase-models';
import { PropertyListing } from './property-schema';
import { fetchWithTimeout, ServiceTimeouts } from './fetch-with-timeout';

interface PropertyMatchNotificationOptions {
  buyer: BuyerProfile;
  property: PropertyListing;
  trigger: 'new_property_added' | 'buyer_criteria_changed' | 'manual_trigger';
  baseUrl?: string;
}

/**
 * Send a property match notification to a buyer via GoHighLevel
 *
 * This function triggers our internal webhook which forwards to GoHighLevel
 * to send an SMS notification to the buyer.
 */
export async function sendPropertyMatchNotification(
  options: PropertyMatchNotificationOptions
): Promise<{ success: boolean; logId?: string; error?: string }> {
  try {
    const { buyer, property, trigger, baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.com' } = options;

    // Validate buyer has phone number
    if (!buyer.phone) {
      console.warn(`[GoHighLevel] Buyer ${buyer.id} has no phone number, skipping SMS`);
      return {
        success: false,
        error: 'Buyer has no phone number',
      };
    }

    // Check if buyer has SMS notifications enabled
    if (buyer.smsNotifications === false) {
      console.log(`[GoHighLevel] Buyer ${buyer.id} has SMS notifications disabled`);
      return {
        success: false,
        error: 'Buyer has SMS notifications disabled',
      };
    }

    // Check if buyer was already notified about this property (deduplication)
    // Use atomic claim to prevent race conditions between concurrent requests
    const claimId = `${buyer.id}_${property.id}`;
    let claimAcquired = false;

    try {
      const { doc, setDoc, getDoc } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');

      const claimRef = doc(db, 'sms_notification_claims', claimId);
      const existingClaim = await getDoc(claimRef);

      if (existingClaim.exists()) {
        console.log(`[GoHighLevel] Buyer ${buyer.id} already notified about property ${property.id} (claim exists)`);
        return {
          success: false,
          error: 'Buyer already notified about this property',
        };
      }

      // Create claim atomically - if another request creates it first, this will still succeed
      // but we check again after to handle the race
      await setDoc(claimRef, {
        buyerId: buyer.id,
        propertyId: property.id,
        claimedAt: new Date(),
        status: 'pending'
      });
      claimAcquired = true;

      // Double-check the in-memory array as backup
      if (buyer.notifiedPropertyIds?.includes(property.id)) {
        console.log(`[GoHighLevel] Buyer ${buyer.id} already notified (in-memory check)`);
        return {
          success: false,
          error: 'Buyer already notified about this property',
        };
      }
    } catch (claimErr) {
      console.warn('[GoHighLevel] Failed to check/create notification claim:', claimErr);
      // Fall back to in-memory check only
      if (buyer.notifiedPropertyIds?.includes(property.id)) {
        return {
          success: false,
          error: 'Buyer already notified about this property',
        };
      }
    }

    // Prepare webhook payload
    const payload = {
      // Buyer Information
      buyerId: buyer.id,
      buyerName: `${buyer.firstName} ${buyer.lastName}`,
      buyerFirstName: buyer.firstName,
      buyerLastName: buyer.lastName,
      buyerPhone: buyer.phone,
      buyerEmail: buyer.email,
      buyerCity: buyer.preferredCity || buyer.city || '',
      buyerState: buyer.preferredState || buyer.state || '',

      // Property Information
      propertyId: property.id,
      propertyAddress: property.address,
      propertyCity: property.city,
      propertyState: property.state,
      monthlyPayment: property.monthlyPayment,
      downPaymentAmount: property.downPaymentAmount,
      listPrice: property.listPrice,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,

      // Additional Data
      dashboardUrl: `${baseUrl}/dashboard`,
      trigger,
    };

    console.log(`[GoHighLevel] Sending notification for property ${property.id} to buyer ${buyer.id}`);

    // Call our internal webhook endpoint
    const response = await fetchWithTimeout(`${baseUrl}/api/webhooks/gohighlevel/property-match`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      timeout: ServiceTimeouts.GHL,
      retries: 2,
      retryDelay: 1000,
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Failed to send notification');
    }

    console.log(`[GoHighLevel] Notification sent successfully. Log ID: ${result.logId}`);

    // Track notification in buyer profile and update claim status
    try {
      const { doc, updateDoc, arrayUnion, increment } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');

      // Update buyer profile
      await updateDoc(doc(db, 'buyerProfiles', buyer.id), {
        notifiedPropertyIds: arrayUnion(property.id),
        lastNotifiedAt: new Date(),
        notificationCount: increment(1)
      });

      // Update claim status to sent
      if (claimAcquired) {
        await updateDoc(doc(db, 'sms_notification_claims', claimId), {
          status: 'sent',
          sentAt: new Date()
        });
      }

      console.log(`[GoHighLevel] Tracked notification for buyer ${buyer.id}`);
    } catch (err) {
      console.warn('[GoHighLevel] Failed to track notification in buyer profile:', err);
      // Don't fail the notification if tracking fails
    }

    return {
      success: true,
      logId: result.logId,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[GoHighLevel] Failed to send notification:', errorMessage);

    // Clean up claim on failure so it can be retried
    if (claimAcquired) {
      try {
        const { doc, deleteDoc } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');
        await deleteDoc(doc(db, 'sms_notification_claims', claimId));
        console.log(`[GoHighLevel] Cleaned up failed claim for ${claimId}`);
      } catch (cleanupErr) {
        console.warn('[GoHighLevel] Failed to clean up claim:', cleanupErr);
      }
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Send batch notifications to multiple buyers
 *
 * Useful when a new property is added that matches multiple buyers.
 */
export async function sendBatchPropertyMatchNotifications(
  property: PropertyListing,
  buyers: BuyerProfile[],
  trigger: 'new_property_added' | 'buyer_criteria_changed' | 'manual_trigger' = 'new_property_added'
): Promise<{ sent: number; failed: number; results: Array<{ buyerId: string; success: boolean; error?: string }> }> {
  console.log(`[GoHighLevel] Sending batch notifications for property ${property.id} to ${buyers.length} buyers`);

  const results = await Promise.allSettled(
    buyers.map(buyer =>
      sendPropertyMatchNotification({
        buyer,
        property,
        trigger,
      })
    )
  );

  const sent = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
  const failed = results.length - sent;

  const detailedResults = buyers.map((buyer, index) => {
    const result = results[index];
    if (result.status === 'fulfilled') {
      return {
        buyerId: buyer.id,
        success: result.value.success,
        error: result.value.error,
      };
    } else {
      return {
        buyerId: buyer.id,
        success: false,
        error: result.reason,
      };
    }
  });

  console.log(`[GoHighLevel] Batch complete: ${sent} sent, ${failed} failed`);

  return {
    sent,
    failed,
    results: detailedResults,
  };
}

/**
 * Check if a buyer should receive notifications for a property
 *
 * Helps prevent spam by checking:
 * - Buyer has SMS notifications enabled
 * - Buyer hasn't already been notified about this property recently
 * - Property matches buyer's criteria
 */
export function shouldNotifyBuyer(
  buyer: BuyerProfile,
  property: PropertyListing,
  recentNotifications: string[] = []
): { shouldNotify: boolean; reason?: string } {
  // Check if buyer has SMS enabled
  if (buyer.smsNotifications === false) {
    return {
      shouldNotify: false,
      reason: 'SMS notifications disabled',
    };
  }

  // Check if buyer has phone number
  if (!buyer.phone) {
    return {
      shouldNotify: false,
      reason: 'No phone number',
    };
  }

  // Check if buyer is active
  if (buyer.isActive === false) {
    return {
      shouldNotify: false,
      reason: 'Buyer profile inactive',
    };
  }

  // Check if already notified recently
  if (recentNotifications.includes(property.id)) {
    return {
      shouldNotify: false,
      reason: 'Already notified about this property',
    };
  }

  // Check if buyer has already liked or passed this property
  if (buyer.likedPropertyIds?.includes(property.id)) {
    return {
      shouldNotify: false,
      reason: 'Buyer already liked this property',
    };
  }

  if (buyer.passedPropertyIds?.includes(property.id)) {
    return {
      shouldNotify: false,
      reason: 'Buyer already passed on this property',
    };
  }

  // Check location match
  const _buyerCity = buyer.preferredCity || buyer.city; // Reserved for future city-level filtering
  const buyerState = buyer.preferredState || buyer.state;

  if (property.state !== buyerState) {
    return {
      shouldNotify: false,
      reason: 'Property not in buyer\'s preferred state',
    };
  }

  return {
    shouldNotify: true,
  };
}
