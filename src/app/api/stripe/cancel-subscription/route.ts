import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase-admin';
import { RealtorProfile } from '@/lib/firebase-models';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

// Force dynamic rendering to prevent build-time Firebase evaluation
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId' },
        { status: 400 }
      );
    }

    if (!adminDb) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 503 }
      );
    }

    // Get the realtor's profile to find their subscription
    const realtorsSnapshot = await adminDb.collection('realtors').where('userId', '==', userId).get();
    const realtor = realtorsSnapshot.empty ? null : { id: realtorsSnapshot.docs[0].id, ...realtorsSnapshot.docs[0].data() } as RealtorProfile;

    if (!realtor) {
      return NextResponse.json(
        { error: 'Realtor profile not found' },
        { status: 404 }
      );
    }

    // Check if they're on a trial
    if (realtor.isOnTrial) {
      return NextResponse.json(
        { error: 'You are currently on a free trial. No subscription to cancel.' },
        { status: 400 }
      );
    }
    
    // Check if they have a Stripe subscription ID
    let stripeSubscriptionId = realtor.stripeSubscriptionId;
    let subscriptionDocId = null;
    
    // Also check in realtorSubscriptions collection
    const subscriptionsSnapshot = await adminDb.collection('realtorSubscriptions')
      .where('realtorId', '==', realtor.id)
      .where('status', '==', 'active')
      .get();
    const subscriptionDocs = subscriptionsSnapshot;
    
    if (!subscriptionDocs.empty) {
      const subscriptionDoc = subscriptionDocs.docs[0];
      const subscription = subscriptionDoc.data();
      
      // Check if this is a trial subscription
      if (subscription.plan === 'trial') {
        return NextResponse.json(
          { error: 'You are currently on a free trial. No paid subscription to cancel.' },
          { status: 400 }
        );
      }
      
      stripeSubscriptionId = subscription.stripeSubscriptionId || stripeSubscriptionId;
      subscriptionDocId = subscriptionDoc.id;
    }
    
    if (!stripeSubscriptionId) {
      return NextResponse.json(
        { error: 'No active paid subscription found' },
        { status: 400 }
      );
    }

    // Cancel the subscription in Stripe
    try {
      const canceledSubscription = await stripe.subscriptions.cancel(stripeSubscriptionId);
      
      // Update the realtor record
      await adminDb.collection('realtors').doc(realtor.id).update({
        subscriptionStatus: 'canceled',
        updatedAt: new Date()
      });
      
      // Update the subscription record if it exists
      if (subscriptionDocId) {
        await adminDb.collection('realtorSubscriptions').doc(subscriptionDocId).update({
          status: 'canceled',
          canceledAt: new Date(canceledSubscription.canceled_at! * 1000),
          cancelAtPeriodEnd: true,
          updatedAt: new Date()
        });
      }

      return NextResponse.json({ 
        success: true,
        message: 'Subscription cancelled successfully. You will retain access until the end of your current billing period.',
        endsAt: (canceledSubscription as any).current_period_end ? new Date((canceledSubscription as any).current_period_end * 1000) : null
      });

    } catch (stripeError: any) {
      console.error('Stripe cancellation error:', stripeError);
      
      if (stripeError.code === 'resource_missing') {
        return NextResponse.json(
          { error: 'Subscription not found in Stripe. It may have already been cancelled.' },
          { status: 404 }
        );
      }
      
      return NextResponse.json(
        { error: 'Failed to cancel subscription in Stripe' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Cancel subscription error:', error);
    return NextResponse.json(
      { error: 'Failed to cancel subscription' },
      { status: 500 }
    );
  }
}