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
import { db } from '@/lib/firebase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
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
    const realtorsQuery = query(
      collection(db, 'realtors'),
      where('userId', '==', session.user.id!)
    );
    const realtorDocs = await getDocs(realtorsQuery);
    const realtor = realtorDocs.empty ? null : { id: realtorDocs.docs[0].id, ...realtorDocs.docs[0].data() };

    if (!realtor) {
      return NextResponse.json(
        { error: 'Realtor profile not found' },
        { status: 404 }
      );
    }

    // Check if they have a subscription
    let subscriptionData = null;
    if (realtor.subscriptionData) {
      try {
        subscriptionData = JSON.parse(realtor.subscriptionData);
      } catch (e) {
        console.error('Failed to parse subscription data:', e);
      }
    }

    if (!subscriptionData?.subscriptionId) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 400 }
      );
    }

    // Cancel the subscription in Stripe
    try {
      const canceledSubscription = await stripe.subscriptions.cancel(subscriptionData.subscriptionId);
      
      // Update the subscription data in our database
      const updatedSubscriptionData = {
        ...subscriptionData,
        status: 'canceled',
        canceledAt: canceledSubscription.canceled_at,
        cancelAtPeriodEnd: true
      };

      if (realtor) {
        await updateDoc(doc(db, 'realtors', realtor.id), {
          subscriptionData: JSON.stringify(updatedSubscriptionData),
          updatedAt: serverTimestamp()
        });
      }

      return NextResponse.json({ 
        success: true,
        message: 'Subscription cancelled successfully. You will retain access until the end of your current billing period.',
        endsAt: canceledSubscription.current_period_end ? new Date(canceledSubscription.current_period_end * 1000) : null
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