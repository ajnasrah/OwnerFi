import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { 
  doc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

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
    
    // Update realtor with subscription ID
    await updateDoc(doc(db, 'realtors', 'idjfqlXrzobyRoFVRTUO'), {
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: customerId,
      currentPlan: planId,
      subscriptionStatus: 'active',
      updatedAt: serverTimestamp()
    });
    
    return NextResponse.json({
      success: true,
      subscriptionId: subscription.id,
      status: subscription.status,
      currentPeriodEnd: new Date(subscription.currentPeriodEnd * 1000).toISOString()
    });
    
  } catch (error) {
    console.error('Failed to create subscription:', error);
    return NextResponse.json(
      { error: 'Failed to create subscription', details: (error as Error).message },
      { status: 500 }
    );
  }
}