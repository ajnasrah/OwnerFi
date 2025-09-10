import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase-admin';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

export async function POST(request: NextRequest) {
  try {
    const { customerId, priceId, planId } = await request.json();
    
    // Create the subscription in Stripe
    const subscription: Stripe.Subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [
        {
          price: priceId,
        },
      ],
      metadata: {
        planId: planId,
        userId: 'eilusPLDUeYLnCvOvtk2',
        userEmail: 'abdullah@prosway.com'
      }
    });
    
    // Update realtor with subscription ID using Admin SDK
    await adminDb.collection('realtors').doc('idjfqlXrzobyRoFVRTUO').update({
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: customerId,
      currentPlan: planId,
      subscriptionStatus: 'active',
      updatedAt: new Date()
    });
    
    return NextResponse.json({
      success: true,
      subscriptionId: subscription.id,
      status: subscription.status
    });
    
  } catch (error) {
    console.error('Failed to create subscription:', error);
    return NextResponse.json(
      { error: 'Failed to create subscription', details: (error as Error).message },
      { status: 500 }
    );
  }
}