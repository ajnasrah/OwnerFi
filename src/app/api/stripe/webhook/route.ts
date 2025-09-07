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
    // For testing, try to parse as JSON first, then fall back to signature verification
    if (signature === 'test') {
      event = JSON.parse(body);
      console.log('Using test webhook data');
    } else {
      event = stripe.webhooks.constructEvent(body, signature, endpointSecret);
    }
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json(
      { error: 'Webhook signature verification failed' },
      { status: 400 }
    );
  }

  console.log('Stripe webhook event:', event.type);
  console.log('Event data:', JSON.stringify(event.data.object, null, 2));

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
  const { userId, userEmail, planId, type, customerId } = metadata;

  console.log('Processing checkout completion:', { userId, userEmail, planId, type, mode, customerId: customer || customerId });

  if (!userId) {
    console.error('Missing userId in checkout session metadata');
    return;
  }

  // For single credit purchases, default to payAsYouGo if planId missing
  let effectivePlanId = planId;
  if (!planId && (type === 'single_credit_purchase' || type === 'credit_purchase')) {
    effectivePlanId = 'payAsYouGo';
    console.log('Using default payAsYouGo plan for credit purchase');
  }

  const tier = PRICING_TIERS[effectivePlanId];
  if (!tier && effectivePlanId) {
    console.error('Invalid plan ID in checkout session:', effectivePlanId);
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

  // Store/update Stripe customer ID in realtor record
  const sessionCustomerId = customer || customerId;
  if (sessionCustomerId && sessionCustomerId !== realtor.stripeCustomerId) {
    await updateDoc(doc(db, 'realtors', realtor.id), {
      stripeCustomerId: sessionCustomerId,
      updatedAt: serverTimestamp()
    });
    console.log(`Updated realtor ${realtor.id} with Stripe customer ID: ${sessionCustomerId}`);
  }

  if (mode === 'payment' && (type === 'credit_purchase' || type === 'single_credit_purchase')) {
    // Handle one-time credit purchase (pay-as-you-go)
    const creditsToAdd = metadata.credits ? parseInt(metadata.credits) : (tier?.creditsPerMonth || 1);
    
    await updateDoc(doc(db, 'realtors', realtor.id), {
      credits: (realtor.credits || 0) + creditsToAdd,
      isOnTrial: false,
      updatedAt: serverTimestamp()
    });
    
    // Add transaction record
    await setDoc(doc(db, 'transactions', firestoreHelpers.generateId()), {
      realtorId: realtor.id,
      userId: userId,
      type: 'credit_purchase',
      description: `Purchased ${creditsToAdd} credit${creditsToAdd > 1 ? 's' : ''}`,
      amount: metadata.amount ? parseInt(metadata.amount) : 300,
      credits: creditsToAdd,
      stripeSessionId: session?.id || 'unknown',
      createdAt: serverTimestamp()
    });
    
    console.log(`Added ${creditsToAdd} credits to realtor ${realtor.id} (${type})`);
  } else if (mode === 'payment' && type === 'annual_purchase') {
    // Handle annual package purchase - give all credits upfront
    const annualCredits = tier.creditsPerMonth * 12; // All credits for the year
    
    await updateDoc(doc(db, 'realtors', realtor.id), {
      credits: (realtor.credits || 0) + annualCredits,
      currentPlan: effectivePlanId,
      subscriptionStatus: 'active',
      isOnTrial: false,
      updatedAt: serverTimestamp()
    });
    
    // Create annual subscription record
    const yearStart = new Date();
    const yearEnd = new Date();
    yearEnd.setFullYear(yearEnd.getFullYear() + 1); // 1 year from now
    
    await setDoc(doc(db, 'realtorSubscriptions', firestoreHelpers.generateId()), {
      realtorId: realtor.id,
      userId: userId,
      userEmail: userEmail || session?.customer_details?.email,
      plan: effectivePlanId,
      status: 'active',
      monthlyPrice: tier?.monthlyPrice || 0,
      creditsPerMonth: tier?.creditsPerMonth || 0,
      currentPeriodStart: yearStart,
      currentPeriodEnd: yearEnd,
      isAnnual: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    // Add transaction record
    await setDoc(doc(db, 'transactions', firestoreHelpers.generateId()), {
      realtorId: realtor.id,
      userId: userId,
      type: 'annual_purchase',
      description: `Annual ${tier.name} - ${annualCredits} credits`,
      amount: tier.monthlyPrice * 12 * 0.5, // 50% discount for annual
      credits: annualCredits,
      stripeSessionId: session?.id || 'unknown',
      createdAt: serverTimestamp()
    });
    
    console.log(`Added ${annualCredits} annual credits to realtor ${realtor.id}`);
  } else if (mode === 'payment' && type === 'monthly_purchase') {
    // Handle monthly package purchase - give monthly credits
    const monthlyCredits = tier.creditsPerMonth; 
    
    await updateDoc(doc(db, 'realtors', realtor.id), {
      credits: (realtor.credits || 0) + monthlyCredits,
      currentPlan: effectivePlanId,
      subscriptionStatus: 'active',
      isOnTrial: false,
      updatedAt: serverTimestamp()
    });
    
    // Create monthly subscription record
    const monthStart = new Date();
    const monthEnd = new Date();
    monthEnd.setDate(monthEnd.getDate() + 30); // 30 days
    
    await setDoc(doc(db, 'realtorSubscriptions', firestoreHelpers.generateId()), {
      realtorId: realtor.id,
      userId: userId,
      userEmail: userEmail || session?.customer_details?.email,
      plan: effectivePlanId,
      status: 'active',
      monthlyPrice: tier?.monthlyPrice || 0,
      creditsPerMonth: tier?.creditsPerMonth || 0,
      currentPeriodStart: monthStart,
      currentPeriodEnd: monthEnd,
      isAnnual: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    console.log(`Added ${monthlyCredits} monthly credits to realtor ${realtor.id}`);
  } else if (mode === 'subscription' && subscription) {
    // Handle subscription creation - give initial credits AND set up billing
    const initialCredits = tier?.creditsPerMonth || 0;
    
    // Update realtor with credits and subscription info
    await updateDoc(doc(db, 'realtors', realtor.id), {
      credits: (realtor.credits || 0) + initialCredits,
      currentPlan: effectivePlanId,
      subscriptionStatus: 'active',
      stripeSubscriptionId: subscription,
      isOnTrial: false,
      updatedAt: serverTimestamp()
    });
    
    // Create subscription billing record with proper customer tracking
    const periodStart = new Date();
    const periodEnd = new Date();
    periodEnd.setDate(periodEnd.getDate() + 30); // 30 days
    
    await setDoc(doc(db, 'realtorSubscriptions', firestoreHelpers.generateId()), {
      realtorId: realtor.id,
      userId: userId,
      userEmail: userEmail || session?.customer_details?.email,
      plan: effectivePlanId,
      status: 'active',
      monthlyPrice: tier?.monthlyPrice || 0,
      creditsPerMonth: tier?.creditsPerMonth || 0,
      stripeSubscriptionId: subscription,
      stripeCustomerId: sessionCustomerId,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    // Add transaction record  
    await setDoc(doc(db, 'transactions', firestoreHelpers.generateId()), {
      realtorId: realtor.id,
      userId: userId,
      type: 'subscription_start',
      description: `${tier?.name} subscription started - ${initialCredits} credits`,
      amount: tier?.monthlyPrice || 0,
      credits: initialCredits,
      stripeSubscriptionId: subscription,
      createdAt: serverTimestamp()
    });
    
    console.log(`Added ${initialCredits} initial subscription credits to realtor ${realtor.id}, plan ${effectivePlanId}`);
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