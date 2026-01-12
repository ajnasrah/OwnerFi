/**
 * GoHighLevel Webhook - Property Match Notification
 *
 * This webhook sends SMS notifications to buyers when new properties match their criteria.
 *
 * Flow:
 * 1. Our system detects a new property match for a buyer
 * 2. We POST to this webhook with buyer + property data
 * 3. This webhook logs the event and forwards to GoHighLevel
 * 4. GoHighLevel workflow triggers SMS to the buyer
 *
 * Route: POST /api/webhooks/gohighlevel/property-match
 *
 * SECURITY: Requires webhook signature validation
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
} from 'firebase/firestore';
import { getSafeDb } from '@/lib/firebase-safe';
import { formatPropertyMatchSMS } from '@/lib/sms-templates';
import { fetchWithTimeout, ServiceTimeouts } from '@/lib/fetch-with-timeout';
import crypto from 'crypto';

// Webhook secret for signature validation
const WEBHOOK_SECRET = process.env.PROPERTY_MATCH_WEBHOOK_SECRET;

/**
 * Verify webhook signature using HMAC-SHA256
 */
function verifyWebhookSignature(payload: string, signature: string | null): boolean {
  if (!WEBHOOK_SECRET) {
    // In development, allow requests without signature if secret not configured
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ [SECURITY] PROPERTY_MATCH_WEBHOOK_SECRET not set - skipping signature validation in dev');
      return true;
    }
    return false;
  }

  if (!signature) {
    return false;
  }

  // Support multiple signature formats
  const signatureValue = signature.startsWith('sha256=')
    ? signature.slice(7)
    : signature;

  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signatureValue, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch {
    return false;
  }
}

interface PropertyMatchWebhookPayload {
  // Buyer Information
  buyerId: string;
  buyerName: string;
  buyerFirstName: string;
  buyerLastName: string;
  buyerPhone: string;
  buyerEmail: string;
  buyerCity: string;
  buyerState: string;
  buyerMaxMonthlyPayment: number;
  buyerMaxDownPayment: number;

  // Property Information
  propertyId: string;
  propertyAddress: string;
  propertyCity: string;
  propertyState: string;
  monthlyPayment: number;
  downPaymentAmount: number;
  listPrice: number;
  bedrooms: number;
  bathrooms: number;

  // Additional Data
  dashboardUrl: string;
  trigger: 'new_property_added' | 'buyer_criteria_changed' | 'manual_trigger';
}

interface WebhookLog {
  id?: string;
  type: 'property_match_notification';
  status: 'pending' | 'sent' | 'failed';
  buyerId: string;
  propertyId: string;
  buyerPhone: string;
  payload: PropertyMatchWebhookPayload;
  goHighLevelResponse?: unknown;
  errorMessage?: string;
  sentAt?: string;
  createdAt: ReturnType<typeof serverTimestamp>;
  processingTimeMs?: number;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const db = getSafeDb();

  try {
    console.log('🔔 [GoHighLevel] Property match webhook received');

    // Get raw body for signature validation
    const rawBody = await request.text();
    const signature = request.headers.get('x-webhook-signature') ||
                      request.headers.get('x-hub-signature-256') ||
                      request.headers.get('x-signature');

    // SECURITY: Verify webhook signature
    if (!verifyWebhookSignature(rawBody, signature)) {
      console.error('🚫 [SECURITY] Invalid webhook signature');
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 401 }
      );
    }

    // Parse request body
    const payload: PropertyMatchWebhookPayload = JSON.parse(rawBody);

    // Validate required fields
    const requiredFields = ['buyerId', 'propertyId', 'buyerName', 'buyerPhone', 'buyerEmail', 'buyerCity', 'propertyAddress', 'propertyCity'];
    for (const field of requiredFields) {
      if (!payload[field as keyof PropertyMatchWebhookPayload]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    console.log(`📱 [GoHighLevel] Sending notification to ${payload.buyerName} (${payload.buyerPhone})`);
    console.log(`🏠 [GoHighLevel] Property: ${payload.propertyAddress}, ${payload.propertyCity}`);

    // Create webhook log entry (PENDING)
    const logEntry: WebhookLog = {
      type: 'property_match_notification',
      status: 'pending',
      buyerId: payload.buyerId,
      propertyId: payload.propertyId,
      buyerPhone: payload.buyerPhone,
      payload: payload,
      createdAt: serverTimestamp(),
    };

    const logRef = await addDoc(collection(db, 'webhookLogs'), logEntry);
    console.log(`📝 [GoHighLevel] Webhook log created: ${logRef.id}`);

    // Forward to GoHighLevel webhook URL (you'll configure this in GoHighLevel)
    const goHighLevelWebhookUrl = process.env.GOHIGHLEVEL_WEBHOOK_URL;

    if (!goHighLevelWebhookUrl) {
      console.warn('⚠️ [GoHighLevel] GOHIGHLEVEL_WEBHOOK_URL not configured in environment');

      // Update log as failed
      await updateWebhookLog(logRef.id, {
        status: 'failed',
        errorMessage: 'GOHIGHLEVEL_WEBHOOK_URL not configured',
        processingTimeMs: Date.now() - startTime,
      });

      return NextResponse.json({
        success: false,
        error: 'GoHighLevel webhook URL not configured',
        logId: logRef.id,
        note: 'Set GOHIGHLEVEL_WEBHOOK_URL in your environment variables'
      }, { status: 500 });
    }

    // Format message for GoHighLevel using shared template
    const smsMessage = formatPropertyMatchSMS({
      buyerFirstName: payload.buyerFirstName,
      propertyAddress: payload.propertyAddress,
      propertyCity: payload.propertyCity,
      propertyState: payload.propertyState,
      bedrooms: payload.bedrooms,
      bathrooms: payload.bathrooms,
      listPrice: payload.listPrice,
      monthlyPayment: payload.monthlyPayment,
      downPaymentAmount: payload.downPaymentAmount,
      dashboardUrl: payload.dashboardUrl,
    });

    // Send to GoHighLevel
    const goHighLevelPayload = {
      // SMS Message
      phone: payload.buyerPhone,
      message: smsMessage,

      // Buyer Information (for GoHighLevel contact/workflow use)
      buyerId: payload.buyerId,
      buyerName: payload.buyerName,
      buyerFirstName: payload.buyerFirstName,
      buyerLastName: payload.buyerLastName,
      buyerEmail: payload.buyerEmail?.toLowerCase().trim() || '',
      buyerPhone: payload.buyerPhone,
      buyerCity: payload.buyerCity,
      buyerState: payload.buyerState,
      buyerMaxMonthlyPayment: payload.buyerMaxMonthlyPayment,
      buyerMaxDownPayment: payload.buyerMaxDownPayment,

      // Property Information
      propertyId: payload.propertyId,
      propertyAddress: payload.propertyAddress,
      propertyCity: payload.propertyCity,
      propertyState: payload.propertyState,
      monthlyPayment: payload.monthlyPayment,
      downPaymentAmount: payload.downPaymentAmount,
      listPrice: payload.listPrice,
      bedrooms: payload.bedrooms,
      bathrooms: payload.bathrooms,

      // Additional Data
      dashboardUrl: payload.dashboardUrl,
      trigger: payload.trigger,
      timestamp: new Date().toISOString(),
    };

    console.log(`🚀 [GoHighLevel] Forwarding to: ${goHighLevelWebhookUrl}`);

    const goHighLevelResponse = await fetchWithTimeout(goHighLevelWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(goHighLevelPayload),
      timeout: ServiceTimeouts.GHL,
      retries: 2,
      retryDelay: 1000,
    });

    const responseData = await goHighLevelResponse.json().catch(() => null);

    if (!goHighLevelResponse.ok) {
      throw new Error(`GoHighLevel returned ${goHighLevelResponse.status}: ${JSON.stringify(responseData)}`);
    }

    console.log(`✅ [GoHighLevel] Webhook forwarded successfully`);

    // Update log as sent
    await updateWebhookLog(logRef.id, {
      status: 'sent',
      sentAt: new Date().toISOString(),
      goHighLevelResponse: responseData,
      processingTimeMs: Date.now() - startTime,
    });

    return NextResponse.json({
      success: true,
      message: 'Property match notification sent to GoHighLevel',
      logId: logRef.id,
      buyerPhone: payload.buyerPhone,
      propertyAddress: payload.propertyAddress,
      processingTimeMs: Date.now() - startTime,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ [GoHighLevel] Webhook failed:', errorMessage);

    return NextResponse.json({
      success: false,
      error: errorMessage,
      processingTimeMs: Date.now() - startTime,
    }, { status: 500 });
  }
}

// Helper function to update webhook log
async function updateWebhookLog(logId: string, updates: Partial<WebhookLog>) {
  const db = getSafeDb();

  try {
    const logRef = doc(db, 'webhookLogs', logId);
    const { updateDoc } = await import('firebase/firestore');

    await updateDoc(logRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Failed to update webhook log:', error);
  }
}

// GET endpoint to retrieve webhook logs (admin only)
export async function GET(request: NextRequest) {
  try {
    // SECURITY: Require admin authentication to view webhook logs
    const { getServerSession } = await import('next-auth/next');
    const { authOptions } = await import('@/lib/auth');

    const session = await getServerSession(authOptions as unknown as Parameters<typeof getServerSession>[0]);
    const userRole = (session as { user?: { role?: string } })?.user?.role;

    if (!session?.user || userRole !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - admin access required' },
        { status: 403 }
      );
    }

    const db = getSafeDb();
    const { searchParams } = new URL(request.url);

    const buyerId = searchParams.get('buyerId');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Build query
    const { query, where, orderBy, limit: queryLimit, getDocs } = await import('firebase/firestore');

    let logsQuery = query(
      collection(db, 'webhookLogs'),
      orderBy('createdAt', 'desc'),
      queryLimit(limit)
    );

    // Filter by buyer if specified
    if (buyerId) {
      logsQuery = query(
        collection(db, 'webhookLogs'),
        where('buyerId', '==', buyerId),
        orderBy('createdAt', 'desc'),
        queryLimit(limit)
      );
    }

    const snapshot = await getDocs(logsQuery);
    const logs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({
      success: true,
      logs,
      total: logs.length,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      success: false,
      error: errorMessage,
    }, { status: 500 });
  }
}
