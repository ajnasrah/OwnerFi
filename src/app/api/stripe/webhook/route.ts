import { NextRequest, NextResponse } from 'next/server';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PRICING_TIERS } from '@/lib/pricing';
import { firestoreHelpers } from '@/lib/firestore';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  let event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json(
      { error: 'Webhook signature verification failed' },
      { status: 400 }
    );
  }

  console.log('Stripe webhook event:', event.type);

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;
      
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;
      
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;
      
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(session: any) {
  const { customer, subscription, metadata, mode } = session;
  const { userId, planId, type } = metadata;

  if (!userId || !planId) {
    console.error('Missing metadata in checkout session');
    return;
  }

  const tier = PRICING_TIERS[planId];
  if (!tier) {
    console.error('Invalid plan ID in checkout session:', planId);
    return;
  }

  // Find the realtor
  const realtorsQuery = query(
    collection(db, 'realtors'),
    where('userId', '==', userId)
  );
  const realtorDocs = await getDocs(realtorsQuery);

  if (realtorDocs.empty) {
    console.error('Realtor not found for user:', userId);
    return;
  }

  const realtorDoc = realtorDocs.docs[0];
  const realtor = { id: realtorDoc.id, ...realtorDoc.data() };

  if (mode === 'payment' && type === 'credit_purchase') {
    // Handle one-time credit purchase (pay-as-you-go)
    const creditsToAdd = tier.creditsPerMonth; // For pay-as-you-go, this is the credits per purchase
    
    await updateDoc(doc(db, 'realtors', realtor.id), {
      credits: (realtor.credits || 0) + creditsToAdd,
      updatedAt: serverTimestamp()
    });
    
    console.log(`Added ${creditsToAdd} credits to realtor ${realtor.id}`);
  } else if (mode === 'payment' && type === 'annual_purchase') {
    // Handle annual package purchase - give all credits upfront
    const annualCredits = tier.creditsPerMonth * 12; // All credits for the year
    
    await updateDoc(doc(db, 'realtors', realtor.id), {
      credits: (realtor.credits || 0) + annualCredits,
      updatedAt: serverTimestamp()
    });
    
    console.log(`Added ${annualCredits} annual credits to realtor ${realtor.id}`);
  } else if (mode === 'payment' && type === 'monthly_purchase') {
    // Handle monthly package purchase - give monthly credits
    const monthlyCredits = tier.creditsPerMonth; 
    
    await updateDoc(doc(db, 'realtors', realtor.id), {
      credits: (realtor.credits || 0) + monthlyCredits,
      updatedAt: serverTimestamp()
    });
    
    console.log(`Added ${monthlyCredits} monthly credits to realtor ${realtor.id}`);
  } else if (mode === 'subscription' && subscription) {
    // Handle subscription creation
    const subscriptionData = await stripe.subscriptions.retrieve(subscription);
    
    await createOrUpdateSubscription(realtor.id, planId, subscriptionData, tier, 'monthly');
    
    console.log(`Created subscription for realtor ${realtor.id}, plan ${planId}`);
  }
}

async function handleSubscriptionCreated(subscription: any) {
  // This is usually handled in checkout.session.completed
  // But we can handle it here as a fallback
  console.log('Subscription created:', subscription.id);
}

async function handleSubscriptionUpdated(subscription: any) {
  // Handle subscription changes (plan changes, status updates)
  const subscriptionsQuery = query(
    collection(db, 'realtorSubscriptions'),
    where('stripeSubscriptionId', '==', subscription.id)
  );
  const subscriptionDocs = await getDocs(subscriptionsQuery);

  if (subscriptionDocs.empty) {
    console.error('Subscription not found:', subscription.id);
    return;
  }

  const subscriptionDoc = subscriptionDocs.docs[0];
  
  await updateDoc(doc(db, 'realtorSubscriptions', subscriptionDoc.id), {
    status: subscription.status === 'active' ? 'active' : 'canceled',
    currentPeriodStart: new Date(subscription.current_period_start * 1000),
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    updatedAt: serverTimestamp()
  });

  console.log(`Updated subscription ${subscription.id} to status ${subscription.status}`);
}

async function handleSubscriptionDeleted(subscription: any) {
  // Handle subscription cancellation
  const subscriptionsQuery = query(
    collection(db, 'realtorSubscriptions'),
    where('stripeSubscriptionId', '==', subscription.id)
  );
  const subscriptionDocs = await getDocs(subscriptionsQuery);

  if (!subscriptionDocs.empty) {
    const subscriptionDoc = subscriptionDocs.docs[0];
    await updateDoc(doc(db, 'realtorSubscriptions', subscriptionDoc.id), {
      status: 'canceled',
      updatedAt: serverTimestamp()
    });
  }

  console.log(`Canceled subscription ${subscription.id}`);
}

async function handlePaymentSucceeded(invoice: any) {
  // Handle successful recurring payments
  const subscriptionId = invoice.subscription;
  
  if (!subscriptionId) return;

  // Find the subscription
  const subscriptionsQuery = query(
    collection(db, 'realtorSubscriptions'),
    where('stripeSubscriptionId', '==', subscriptionId)
  );
  const subscriptionDocs = await getDocs(subscriptionsQuery);

  if (subscriptionDocs.empty) {
    console.error('Subscription not found for invoice:', invoice.id);
    return;
  }

  const subscription = subscriptionDocs.docs[0].data();
  const tier = PRICING_TIERS[subscription.plan];
  if (!tier) {
    console.error('Invalid plan in subscription:', subscription.plan);
    return;
  }

  // Add monthly credits for subscription plans
  if (tier.creditsPerMonth > 0) {
    const realtorDoc = await getDoc(doc(db, 'realtors', subscription.realtorId));
    if (realtorDoc.exists()) {
      const realtorData = realtorDoc.data();
      await updateDoc(doc(db, 'realtors', subscription.realtorId), {
        credits: (realtorData.credits || 0) + tier.creditsPerMonth,
        updatedAt: serverTimestamp()
      });

      console.log(`Added ${tier.creditsPerMonth} monthly credits to realtor ${subscription.realtorId}`);
    }
  }
}

async function handlePaymentFailed(invoice: any) {
  // Handle failed payments
  console.log('Payment failed for invoice:', invoice.id);
  
  const subscriptionId = invoice.subscription;
  if (subscriptionId) {
    // You might want to send an email notification here
    console.log(`Payment failed for subscription ${subscriptionId}`);
  }
}

async function createOrUpdateSubscription(realtorId: string, planId: string, stripeSubscription: any, tier: any) {
  const subscriptionData = {
    realtorId,
    plan: planId,
    status: stripeSubscription.status === 'active' ? 'active' : 'canceled',
    monthlyPrice: tier.monthlyPrice,
    creditsPerMonth: tier.creditsPerMonth,
    stripeCustomerId: stripeSubscription.customer,
    stripeSubscriptionId: stripeSubscription.id,
    currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
    currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
    updatedAt: serverTimestamp()
  };

  // Check if subscription already exists
  const existingQuery = query(
    collection(db, 'realtorSubscriptions'),
    where('realtorId', '==', realtorId)
  );
  const existingDocs = await getDocs(existingQuery);

  if (!existingDocs.empty) {
    // Update existing subscription
    const existingDoc = existingDocs.docs[0];
    await updateDoc(doc(db, 'realtorSubscriptions', existingDoc.id), subscriptionData);
  } else {
    // Create new subscription
    const subscriptionId = doc(collection(db, 'realtorSubscriptions')).id;
    await setDoc(doc(db, 'realtorSubscriptions', subscriptionId), {
      id: subscriptionId,
      ...subscriptionData,
      createdAt: serverTimestamp()
    });
  }

  // Update realtor to remove trial status if they had one
  const realtorQuery = query(
    collection(db, 'realtors'),
    where('userId', '==', realtorId)
  );
  const realtorDocs = await getDocs(realtorQuery);
  
  if (!realtorDocs.empty) {
    const realtorDoc = realtorDocs.docs[0];
    await updateDoc(doc(db, 'realtors', realtorDoc.id), {
      isOnTrial: false,
      updatedAt: serverTimestamp()
    });
  }
}