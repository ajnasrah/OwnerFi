import { NextRequest, NextResponse } from 'next/server';
import { getSessionWithRole } from '@/lib/auth-utils';
import Stripe from 'stripe';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  updateDoc, 
  doc, 
  serverTimestamp 
} from 'firebase/firestore';
import { getSafeDb } from '@/lib/firebase-safe';
import { RealtorProfile } from '@/lib/firebase-models';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionWithRole('realtor');
    
    if (!session?.user?.email || !session?.user?.id) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Get the realtor's profile to find their subscription
    const db = getSafeDb();
    const realtorsQuery = query(
      collection(db, 'realtors'),
      where('userId', '==', session.user.id!)
    );
    const realtorDocs = await getDocs(realtorsQuery);
    const realtor = realtorDocs.empty ? null : { id: realtorDocs.docs[0].id, ...realtorDocs.docs[0].data() } as RealtorProfile;

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
    const subscriptionsQuery = query(
      collection(db, 'realtorSubscriptions'),
      where('realtorId', '==', realtor.id),
      where('status', '==', 'active')
    );
    const subscriptionDocs = await getDocs(subscriptionsQuery);
    
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
      await updateDoc(doc(db, 'realtors', realtor.id), {
        subscriptionStatus: 'canceled',
        updatedAt: serverTimestamp()
      });
      
      // Update the subscription record if it exists
      if (subscriptionDocId) {
        await updateDoc(doc(db, 'realtorSubscriptions', subscriptionDocId), {
          status: 'canceled',
          canceledAt: new Date(canceledSubscription.canceled_at! * 1000),
          cancelAtPeriodEnd: true,
          updatedAt: serverTimestamp()
        });
      }

      return NextResponse.json({ 
        success: true,
        message: 'Subscription cancelled successfully. You will retain access until the end of your current billing period.',
        endsAt: (canceledSubscription as any).current_period_end ? new Date((canceledSubscription as any).current_period_end * 1000) : null
      });

    } catch (stripeError: unknown) {
      
      if ((stripeError as Stripe.errors.StripeError).code === 'resource_missing') {
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

  } catch {
    return NextResponse.json(
      { error: 'Failed to cancel subscription' },
      { status: 500 }
    );
  }
}