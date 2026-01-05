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
 * Verify webhook signature using HMAC SHA-256
 */
function verifyWebhookSignature(
  payload: string,
  signature: string | null
): { valid: boolean; reason?: string } {
  if (!GHL_WEBHOOK_SECRET) {
    return {
      valid: false,
      reason: 'Server configuration error: GHL_WEBHOOK_SECRET not set'
    };
  }

  if (!signature) {
    return {
      valid: false,
      reason: 'Missing webhook signature header'
    };
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', GHL_WEBHOOK_SECRET)
      .update(payload)
      .digest('hex');

    // Try multiple signature formats
    const validFormats = [
      signature === expectedSignature,
      signature === `sha256=${expectedSignature}`,
      signature.replace(/^sha256=/, '') === expectedSignature,
    ];

    if (validFormats.some(valid => valid)) {
      return { valid: true };
    }

    return {
      valid: false,
      reason: 'Signature mismatch - invalid authentication'
    };
  } catch (error) {
    console.error('Error verifying webhook signature', error);
    return {
      valid: false,
      reason: 'Signature verification error'
    };
  }
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

    // Check for signature in header OR body (GHL sends in body)
    const signature = request.headers.get('x-webhook-signature') ||
                     request.headers.get('x-ghl-signature') ||
                     body['x-webhook-signature'] ||
                     body['x-webhook-sig'] ||
                     body['GHL_WEBHOOK'];

    // Verify webhook signature
    const verification = verifyWebhookSignature(rawBody, signature);
    if (!verification.valid) {
      console.error('❌ [AGENT NOT INTERESTED] Invalid signature:', verification.reason);
      return NextResponse.json(
        { error: 'Unauthorized', reason: verification.reason },
        { status: 401 }
      );
    }
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
    console.error('❌ [AGENT NOT INTERESTED] Error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

// Also support GET for testing
export async function GET(request: NextRequest) {
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
