import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import Stripe from 'stripe';

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-08-27.basil',
  });
}

export async function POST(request: NextRequest) {
  const stripe = getStripe();

  try {
    const authResult = await requireAuth(request);
    if ('error' in authResult) return authResult.error;
    const { session } = authResult;

    if (!session?.user?.email || !session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { successUrl, cancelUrl } = await request.json();
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL;

    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: session.user.email,
      metadata: {
        userId: session.user.id,
        userEmail: session.user.email,
        subscriptionType: 'deal_alert',
      },
      line_items: [{
        price_data: {
          currency: 'usd',
          recurring: { interval: 'month' },
          product_data: {
            name: 'Investor Deal Alerts',
            description: 'SMS alerts for investment deals below your ARV threshold - $5/month',
          },
          unit_amount: 500, // $5.00 in cents
        },
        quantity: 1,
      }],
      success_url: successUrl || `${baseUrl}/dashboard/investor?subscription=success`,
      cancel_url: cancelUrl || `${baseUrl}/dashboard/investor?subscription=cancelled`,
    });

    return NextResponse.json({
      checkoutUrl: checkoutSession.url,
      sessionId: checkoutSession.id,
    });
  } catch (error) {
    console.error('[DEAL-ALERT-CHECKOUT] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to create checkout session', details: message },
      { status: 500 }
    );
  }
}
