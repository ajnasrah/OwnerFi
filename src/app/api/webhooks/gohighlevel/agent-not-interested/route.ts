import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import crypto from 'crypto';

// Initialize Firebase Admin
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    }),
  });
}

const db = getFirestore();

// Webhook secret for security
const GHL_WEBHOOK_SECRET = process.env.GHL_WEBHOOK_SECRET;

/**
 * Verify webhook authentication
 *
 * Supports two modes:
 * 1. Simple secret comparison (when GHL sends secret in body as GHL_WEBHOOK field)
 * 2. HMAC signature verification (when GHL sends computed signature in header)
 */
function verifyWebhookAuth(
  payload: string,
  headerSignature: string | null,
  bodySecret: string | null
): { valid: boolean; reason?: string } {
  if (!GHL_WEBHOOK_SECRET) {
    return {
      valid: false,
      reason: 'Server configuration error: GHL_WEBHOOK_SECRET not set'
    };
  }

  // Mode 1: Simple secret comparison (GHL sends the secret directly in body)
  if (bodySecret) {
    if (bodySecret === GHL_WEBHOOK_SECRET) {
      return { valid: true };
    }
  }

  // Mode 2: HMAC signature verification (GHL sends computed signature in header)
  if (headerSignature) {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', GHL_WEBHOOK_SECRET)
        .update(payload)
        .digest('hex');

      const validFormats = [
        headerSignature === expectedSignature,
        headerSignature === `sha256=${expectedSignature}`,
        headerSignature.replace(/^sha256=/, '') === expectedSignature,
      ];

      if (validFormats.some(valid => valid)) {
        return { valid: true };
      }
    } catch (error) {
      console.error('Error verifying webhook signature', error);
    }
  }

  // Neither method worked
  if (!headerSignature && !bodySecret) {
    return {
      valid: false,
      reason: 'Missing webhook authentication (no header signature or body secret)'
    };
  }

  return {
    valid: false,
    reason: 'Signature mismatch - invalid authentication'
  };
}

/**
 * Webhook: Mark Agent as Not Interested
 *
 * Simple webhook to mark properties as not interested (agent said no)
 * Called from GHL workflow when agent declines owner financing
 *
 * Expected payload:
 * {
 *   firebaseId: string,     // Required - the ID in agent_outreach_queue
 *   note?: string           // Optional - reason or note
 * }
 *
 * URL: /api/webhooks/gohighlevel/agent-not-interested
 * Method: POST
 */
export async function POST(request: NextRequest) {
  console.log('📨 [AGENT NOT INTERESTED] Received webhook');

  try {
    // Read raw body for signature verification
    const rawBody = await request.text();
    const body = JSON.parse(rawBody);

    // DEBUG: Log all body keys to see what GHL is sending
    console.log('📨 [DEBUG] Body keys:', Object.keys(body));
    console.log('📨 [DEBUG] Full body:', JSON.stringify(body, null, 2));

    // Check for secret in body - try all possible field names
    const bodySecret = body['x-webhook-signature'] ||
                      body['GHL_WEBHOOK'] ||
                      body['x-webhook-sig'] ||
                      body['webhook_secret'] ||
                      body['secret'] ||
                      body['signature'];

    const expectedSecret = process.env.GHL_WEBHOOK_SECRET;

    console.log('📨 [DEBUG] Body secret found:', bodySecret ? `YES (${bodySecret.length} chars)` : 'NO');
    console.log('📨 [DEBUG] Body secret value:', bodySecret);
    console.log('📨 [DEBUG] Expected secret:', expectedSecret);
    console.log('📨 [DEBUG] Match:', bodySecret === expectedSecret);
    console.log('📨 [DEBUG] Trimmed match:', bodySecret?.trim() === expectedSecret?.trim());

    // Simple direct comparison - no HMAC needed for GHL
    const isAuthenticated = bodySecret && expectedSecret &&
                           (bodySecret === expectedSecret || bodySecret.trim() === expectedSecret.trim());

    if (!isAuthenticated) {
      console.error('❌ [AGENT NOT INTERESTED] Auth failed');
      console.error('   Body secret length:', bodySecret?.length);
      console.error('   Expected length:', expectedSecret?.length);
      return NextResponse.json(
        { error: 'Unauthorized', reason: 'Signature mismatch - invalid authentication' },
        { status: 401 }
      );
    }

    console.log('✅ [AGENT NOT INTERESTED] Auth passed');
    const { firebaseId, note } = body;

    console.log(`   firebaseId: ${firebaseId}`);
    if (note) console.log(`   note: ${note}`);

    // Validate required fields
    if (!firebaseId) {
      console.error('❌ [AGENT NOT INTERESTED] Missing firebaseId');
      return NextResponse.json(
        { error: 'Missing required field: firebaseId' },
        { status: 400 }
      );
    }

    // Get property from agent_outreach_queue
    const docRef = db.collection('agent_outreach_queue').doc(firebaseId);
    const doc = await docRef.get();

    if (!doc.exists) {
      console.error('❌ [AGENT NOT INTERESTED] Property not found:', firebaseId);
      return NextResponse.json(
        { error: 'Property not found in queue' },
        { status: 404 }
      );
    }

    const property = doc.data()!;
    console.log(`   Property: ${property.address}, ${property.city} ${property.state}`);

    // Check if already processed
    if (property.status === 'agent_no') {
      console.log('⏭️  [AGENT NOT INTERESTED] Already marked as not interested');
      return NextResponse.json({
        success: true,
        message: 'Already marked as not interested',
        firebaseId,
        status: 'agent_no',
      });
    }

    // Update to agent_no
    await docRef.update({
      status: 'agent_no',
      agentResponse: 'no',
      agentResponseAt: new Date(),
      agentNote: note || 'Agent not interested - marked via GHL webhook',
      routedTo: 'rejected',
      updatedAt: new Date(),
    });

    console.log('✅ [AGENT NOT INTERESTED] Marked as not interested');

    return NextResponse.json({
      success: true,
      message: 'Property marked as not interested',
      firebaseId,
      address: property.address,
      status: 'agent_no',
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ [AGENT NOT INTERESTED] Error:', errorMessage);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}

// Also support GET for testing
export async function GET(_request: NextRequest) {
  return NextResponse.json({
    webhook: 'agent-not-interested',
    method: 'POST',
    description: 'Mark a property as not interested (agent said no)',
    payload: {
      firebaseId: 'string (required) - the Firebase document ID from agent_outreach_queue',
      note: 'string (optional) - reason or note',
    },
    example: {
      firebaseId: 'abc123xyz',
      note: 'Seller not interested in owner financing',
    },
  });
}
