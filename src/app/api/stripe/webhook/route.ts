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
import { FirebaseDB } from '@/lib/firebase-db';
import Stripe from 'stripe';
import { RealtorProfile } from '@/lib/firebase-models';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: NextRequest) {
  if (!db) {
    return NextResponse.json(
      { error: 'Database not available' },
      { status: 500 }
    );
  }

  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  let event;

  try {
    // Always verify webhook signature for security
    if (!signature || !endpointSecret) {
      throw new Error('Missing webhook signature or endpoint secret');
    }
    
    event = stripe.webhooks.constructEvent(body, signature, endpointSecret);
  } catch (err) {
    return NextResponse.json(
      { error: 'Webhook signature verification failed' },
      { status: 400 }
    );
  }


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
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const { customer, subscription, metadata, mode } = session;
  const { userId, userEmail, planId, type, customerId, creditPackId, credits } = metadata || {};


  // Handle credit purchase
  if (creditPackId && credits && userId) {
    try {
      
      // Get current user data
      const userData = await FirebaseDB.getDocument('users', userId);
      if (!userData) {
        return;
      }

      // Add credits to realtor account
      const currentCredits = (userData as any).realtorData?.credits || 0;
      const newCredits = currentCredits + parseInt(credits);

      const updatedRealtorData = {
        ...(userData as any).realtorData || {},
        credits: newCredits,
        lastPurchase: new Date(),
        updatedAt: new Date()
      };

      await FirebaseDB.updateDocument('users', userId, {
        realtorData: updatedRealtorData,
        updatedAt: new Date()
      });

      // Create transaction record
      await FirebaseDB.createDocument('realtorTransactions', {
        realtorUserId: userId,
        type: 'credit_purchase',
        description: `Purchased ${credits} credits via Stripe`,
        creditsChange: parseInt(credits),
        runningBalance: newCredits,
        stripeSessionId: session.id,
        amount: (session.amount_total || 0) / 100, // Convert from cents
        createdAt: new Date()
      });

      
    } catch (error) {
    }
    return;
  }

  if (!userId) {
    return;
  }

  // For single credit purchases, default to payAsYouGo if planId missing
  let effectivePlanId = planId;
  if (!planId && (type === 'single_credit_purchase' || type === 'credit_purchase')) {
    effectivePlanId = 'payAsYouGo';
  }

  const tier = PRICING_TIERS[effectivePlanId];
  if (!tier && effectivePlanId) {
    return;
  }

  // Find the realtor
  if (!db) return;
  const realtorsQuery = query(
    collection(db, 'realtors'),
    where('userId', '==', userId)
  );
  const realtorDocs = await getDocs(realtorsQuery);

  if (realtorDocs.empty) {
    return;
  }

  const realtorDoc = realtorDocs.docs[0];
  const realtor = { id: realtorDoc.id, ...realtorDoc.data() } as RealtorProfile;

  // Store/update Stripe customer ID in realtor record
  const sessionCustomerId = customer || customerId;
  if (sessionCustomerId && sessionCustomerId !== realtor.stripeCustomerId) {
    await updateDoc(doc(db, 'realtors', realtor.id), {
      stripeCustomerId: sessionCustomerId,
      updatedAt: serverTimestamp()
    });
  }

  if (mode === 'payment' && (type === 'credit_purchase' || type === 'single_credit_purchase')) {
    // Handle one-time credit purchase (pay-as-you-go)
    const creditsToAdd = metadata?.credits ? parseInt(metadata.credits) : (tier?.creditsPerMonth || 1);
    
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
      amount: metadata?.amount ? parseInt(metadata.amount) : 300,
      credits: creditsToAdd,
      stripeSessionId: session?.id || 'unknown',
      createdAt: serverTimestamp()
    });
    
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
    
  }
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  // This is usually handled in checkout.session.completed
  // But we can handle it here as a fallback
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  // Handle subscription changes (plan changes, status updates)
  if (!db) return;
  const subscriptionsQuery = query(
    collection(db, 'realtorSubscriptions'),
    where('stripeSubscriptionId', '==', subscription.id)
  );
  const subscriptionDocs = await getDocs(subscriptionsQuery);

  if (subscriptionDocs.empty) {
    return;
  }

  const subscriptionDoc = subscriptionDocs.docs[0];
  
  await updateDoc(doc(db, 'realtorSubscriptions', subscriptionDoc.id), {
    status: subscription.status === 'active' ? 'active' : 'canceled',
    currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
    currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
    updatedAt: serverTimestamp()
  });

}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  if (!db) {
    return;
  }
  
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

}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  // Handle successful recurring payments
  const subscriptionId = (invoice as any).subscription;
  
  if (!subscriptionId) return;

  // Find the subscription
  if (!db) return;
  const subscriptionsQuery = query(
    collection(db, 'realtorSubscriptions'),
    where('stripeSubscriptionId', '==', subscriptionId)
  );
  const subscriptionDocs = await getDocs(subscriptionsQuery);

  if (subscriptionDocs.empty) {
    return;
  }

  const subscription = subscriptionDocs.docs[0].data();
  const tier = PRICING_TIERS[subscription.plan];
  if (!tier) {
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

    }
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  // Handle failed payments
  
  const subscriptionId = (invoice as any).subscription;
  if (subscriptionId) {
    // You might want to send an email notification here
  }
}

async function createOrUpdateSubscription(realtorId: string, planId: string, stripeSubscription: Stripe.Subscription, tier: typeof PRICING_TIERS[keyof typeof PRICING_TIERS]) {
  const subscriptionData = {
    realtorId,
    plan: planId,
    status: stripeSubscription.status === 'active' ? 'active' : 'canceled',
    monthlyPrice: tier.monthlyPrice,
    creditsPerMonth: tier.creditsPerMonth,
    stripeCustomerId: stripeSubscription.customer,
    stripeSubscriptionId: stripeSubscription.id,
    currentPeriodStart: new Date((stripeSubscription as any).current_period_start * 1000),
    currentPeriodEnd: new Date((stripeSubscription as any).current_period_end * 1000),
    updatedAt: serverTimestamp()
  };

  // Check if subscription already exists
  if (!db) return;
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