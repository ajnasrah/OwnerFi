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
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
} from 'firebase/firestore';
import { getSafeDb } from '@/lib/firebase-safe';

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
  createdAt: typeof serverTimestamp;
  processingTimeMs?: number;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const db = getSafeDb();

  try {
    console.log('🔔 [GoHighLevel] Property match webhook received');

    // Parse request body
    const payload: PropertyMatchWebhookPayload = await request.json();

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

    // Format message for GoHighLevel
    const smsMessage = `🏠 New Property Match!

Hi ${payload.buyerFirstName}! We found a home for you in ${payload.propertyCity}, ${payload.propertyState}:

📍 ${payload.propertyAddress}
🛏️ ${payload.bedrooms} bed, ${payload.bathrooms} bath
💰 $${payload.listPrice.toLocaleString()} list price
💵 $${payload.monthlyPayment}/mo, $${payload.downPaymentAmount.toLocaleString()} down

View it now: ${payload.dashboardUrl}

Reply STOP to unsubscribe`;

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
      buyerEmail: payload.buyerEmail,
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

    const goHighLevelResponse = await fetch(goHighLevelWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(goHighLevelPayload),
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

// GET endpoint to retrieve webhook logs
export async function GET(request: NextRequest) {
  try {
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
