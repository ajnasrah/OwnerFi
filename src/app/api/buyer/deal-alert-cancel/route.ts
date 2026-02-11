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
    const subscriptionId = dealAlertSub?.stripeSubscriptionId as string | undefined;

    if (!subscriptionId) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 400 });
    }

    if (dealAlertSub?.status === 'canceled') {
      return NextResponse.json({ error: 'Subscription is already canceled' }, { status: 400 });
    }

    const stripe = getStripe();

    try {
      const canceledSubscription = await stripe.subscriptions.cancel(subscriptionId);

      const existing = (buyer.dealAlertSubscription || {}) as Record<string, unknown>;
      await FirebaseDB.updateDocument('buyerProfiles', buyer.id as string, {
        dealAlertSubscription: {
          ...existing,
          status: 'canceled',
          canceledAt: new Date(),
        },
        updatedAt: new Date(),
      });

      console.log(`[DEAL-ALERT-CANCEL] Subscription canceled for buyer ${buyer.id}`);

      // In Stripe basil API, current_period_end is on items.data[0]
      const subJson = JSON.parse(JSON.stringify(canceledSubscription));
      const periodEnd = subJson?.items?.data?.[0]?.current_period_end as number | undefined;
      return NextResponse.json({
        success: true,
        message: 'Subscription canceled. You will keep access until the end of your billing period.',
        endsAt: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      });
    } catch (stripeError: unknown) {
      if ((stripeError as Stripe.errors.StripeError).code === 'resource_missing') {
        // Subscription already canceled in Stripe — sync our DB
        const existing = (buyer.dealAlertSubscription || {}) as Record<string, unknown>;
        await FirebaseDB.updateDocument('buyerProfiles', buyer.id as string, {
          dealAlertSubscription: {
            ...existing,
            status: 'canceled',
            canceledAt: new Date(),
          },
          updatedAt: new Date(),
        });

        return NextResponse.json({
          success: true,
          message: 'Subscription was already canceled.',
          endsAt: null,
        });
      }

      console.error('[DEAL-ALERT-CANCEL] Stripe error:', stripeError);
      return NextResponse.json(
        { error: 'Failed to cancel subscription in Stripe' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[DEAL-ALERT-CANCEL] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to cancel subscription', details: message },
      { status: 500 }
    );
  }
}
