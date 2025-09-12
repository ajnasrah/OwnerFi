import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { ExtendedSession } from '@/types/session';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

// Simple credit packages - no complex pricing tiers
const CREDIT_PACKAGES = {
  '1_credit': { credits: 1, price: 300, name: '1 Lead Credit', recurring: false },
  '4_credits': { credits: 4, price: 500, name: '4 Lead Credits (Monthly)', recurring: true },
  '10_credits': { credits: 10, price: 1000, name: '10 Lead Credits (Monthly)', recurring: true },
  '60_credits': { credits: 60, price: 3000, name: '60 Lead Credits', recurring: false },
};

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession;
    
    if (!session?.user?.email || session.user.role !== 'realtor') {
      return NextResponse.json({ error: 'Realtor access required' }, { status: 401 });
    }

    const { creditPackId } = await request.json();
    
    const package_ = CREDIT_PACKAGES[creditPackId as keyof typeof CREDIT_PACKAGES];
    if (!package_) {
      return NextResponse.json({ error: 'Invalid credit package' }, { status: 400 });
    }


    // Create Stripe checkout session
    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: package_.recurring ? 'subscription' : 'payment',
      customer_email: session.user.email,
      metadata: {
        userId: session.user.id!,
        creditPackId: creditPackId,
        credits: package_.credits.toString()
      },
      line_items: [
        {
          price_data: {
            currency: 'usd',
            ...(package_.recurring ? {
              recurring: { interval: 'month' },
            } : {}),
            product_data: {
              name: package_.name,
              description: `${package_.credits} buyer lead credits${package_.recurring ? ' (renews monthly)' : ''}`,
            },
            unit_amount: package_.price * 100, // Convert to cents
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXTAUTH_URL}/realtor-dashboard?payment=success&credits=${package_.credits}`,
      cancel_url: `${process.env.NEXTAUTH_URL}/buy-credits?payment=cancelled`,
    });

    return NextResponse.json({
      checkoutUrl: checkoutSession.url
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}