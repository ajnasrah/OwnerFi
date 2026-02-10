import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { FirebaseDB } from '@/lib/firebase-db';
import Stripe from 'stripe';

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-08-27.basil',
  });
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if ('error' in authResult) return authResult.error;
    const { session } = authResult;

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Find buyer profile
    const buyers = await FirebaseDB.queryDocuments(
      'buyerProfiles',
      [{ field: 'userId', operator: '==', value: session.user.id }],
      1
    );

    if (buyers.length === 0) {
      return NextResponse.json({ error: 'Buyer profile not found' }, { status: 404 });
    }

    const buyer = buyers[0] as Record<string, unknown>;
    const dealAlertSub = buyer.dealAlertSubscription as Record<string, unknown> | undefined;
    const customerId = dealAlertSub?.stripeCustomerId as string | undefined;

    if (!customerId) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 400 });
    }

    const stripe = getStripe();
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL;

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/dashboard/investor`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    console.error('[DEAL-ALERT-PORTAL] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to create billing portal session', details: message },
      { status: 500 }
    );
  }
}
