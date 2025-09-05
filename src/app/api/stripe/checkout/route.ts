import { NextRequest, NextResponse } from 'next/server';
import { getSessionWithRole } from '@/lib/auth-utils';
import { PRICING_TIERS } from '@/lib/pricing';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionWithRole('realtor');
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { priceId, planId, billingType, successUrl, cancelUrl } = await request.json();

    // Validate the plan
    const tier = PRICING_TIERS[planId];
    if (!tier) {
      return NextResponse.json(
        { error: 'Invalid plan selected' },
        { status: 400 }
      );
    }

    // Determine the correct price ID based on billing type
    let finalPriceId = priceId;
    if (billingType === 'annual' && tier.stripePriceAnnual) {
      finalPriceId = tier.stripePriceAnnual;
    } else if (billingType === 'monthly' && tier.stripePrice) {
      finalPriceId = tier.stripePrice;
    }

    // TEMPORARY FIX: Make all payments one-time until price IDs are sorted
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: session.user.email,
      line_items: [
        {
          // Use the appropriate price ID
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${tier.name} - ${billingType === 'annual' ? 'Annual' : 'Monthly'} Package`,
              description: tier.features.join(', ')
            },
            unit_amount: billingType === 'annual' ? Math.round(tier.monthlyPrice * 12 * 0.5) * 100 : tier.monthlyPrice * 100 // Convert to cents
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId: session.user.id,
        planId: planId,
        billingType: billingType || 'monthly',
        type: billingType === 'annual' ? 'annual_purchase' : tier.isPayPerLead ? 'credit_purchase' : 'monthly_purchase'
      },
      success_url: successUrl || `${process.env.NEXTAUTH_URL}/realtor/settings?success=true`,
      cancel_url: cancelUrl || `${process.env.NEXTAUTH_URL}/realtor/settings?canceled=true`,
    });

    return NextResponse.json({ 
      url: checkoutSession.url,
      sessionId: checkoutSession.id 
    });

  } catch (error) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}