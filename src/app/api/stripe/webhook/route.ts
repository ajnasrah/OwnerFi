import { NextRequest, NextResponse } from 'next/server';
import { FirebaseDB } from '@/lib/firebase-db';
import Stripe from 'stripe';
import { UserWithRealtorData } from '@/lib/realtor-models';

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-08-27.basil',
  });
}

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

// New credit package system - only these packages are valid
const CREDIT_PACKAGES = {
  '1_credit': { credits: 1, price: 300, name: '1 Lead Credit', recurring: false },
  '4_credits': { credits: 4, price: 500, name: '4 Lead Credits (Monthly)', recurring: true },
  '10_credits': { credits: 10, price: 1000, name: '10 Lead Credits (Monthly)', recurring: true },
  '60_credits': { credits: 60, price: 3000, name: '60 Lead Credits', recurring: false },
};

export async function POST(request: NextRequest) {
  const stripe = getStripe();

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
  const { userId, userEmail, creditPackId, credits } = metadata || {};

  // CRITICAL: Don't silently fail - customer paid but we can't process
  if (!userId || !creditPackId) {
    console.error('❌ [STRIPE] CRITICAL: Missing required metadata in checkout session', {
      sessionId: session.id,
      hasUserId: !!userId,
      hasCreditPackId: !!creditPackId,
      metadata
    });
    throw new Error(`Missing required metadata: userId=${userId}, creditPackId=${creditPackId}. Session: ${session.id}`);
  }

  // Validate credit package
  const creditPackage = CREDIT_PACKAGES[creditPackId as keyof typeof CREDIT_PACKAGES];
  if (!creditPackage) {
    console.error('❌ [STRIPE] CRITICAL: Invalid credit package ID', {
      sessionId: session.id,
      creditPackId,
      validPackages: Object.keys(CREDIT_PACKAGES)
    });
    throw new Error(`Invalid credit package: ${creditPackId}. Session: ${session.id}`);
  }

  try {
    // Get current user data
    const userData = await FirebaseDB.getDocument('users', userId);
    if (!userData) {
      console.error('❌ [STRIPE] CRITICAL: User not found for credit purchase', {
        sessionId: session.id,
        userId,
        creditPackId
      });
      throw new Error(`User not found: ${userId}. Session: ${session.id}`);
    }

    // Add credits to realtor account using new system
    const currentCredits = (userData as UserWithRealtorData).realtorData?.credits || 0;
    const creditsToAdd = parseInt(credits || creditPackage.credits.toString());
    const newCredits = currentCredits + creditsToAdd;

    const updatedRealtorData = {
      ...(userData as UserWithRealtorData).realtorData || {},
      credits: newCredits,
      lastPurchase: new Date(),
      updatedAt: new Date()
    };

    // Handle subscription vs one-time purchase
    if (mode === 'subscription' && subscription && creditPackage.recurring) {
      // Only 4 and 10 credit packages should create subscriptions
      (updatedRealtorData as Record<string, unknown>).stripeSubscriptionId = typeof subscription === 'string' ? subscription : subscription.id;
      (updatedRealtorData as Record<string, unknown>).subscriptionStatus = 'active';
      (updatedRealtorData as Record<string, unknown>).currentPlan = creditPackId;
    }

    // Store Stripe customer ID if provided
    if (customer) {
      (updatedRealtorData as Record<string, unknown>).stripeCustomerId = customer;
    }

    await FirebaseDB.updateDocument('users', userId, {
      realtorData: updatedRealtorData,
      updatedAt: new Date()
    });

    // Create transaction record
    await FirebaseDB.createDocument('realtorTransactions', {
      realtorUserId: userId,
      type: creditPackage.recurring ? 'subscription_purchase' : 'credit_purchase',
      description: `Purchased ${creditPackage.name} - ${creditsToAdd} credits`,
      creditsChange: creditsToAdd,
      runningBalance: newCredits,
      stripeSessionId: session.id,
      stripeSubscriptionId: subscription || null,
      amount: (session.amount_total || 0) / 100,
      creditPackageId: creditPackId,
      createdAt: new Date()
    });

  } catch (error) {
    // CRITICAL: Re-throw to signal Stripe to retry the webhook
    // Silent failures here mean customers pay but don't get credits!
    console.error('❌ [STRIPE] Failed to process checkout:', error);
    throw error;
  }
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  // This is handled in checkout.session.completed for our new system
  // No additional action needed
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  try {
    // Find user with this subscription ID and update status
    // TODO: Add Firestore index on 'realtorData.stripeSubscriptionId' for scale
    const users = await FirebaseDB.queryDocuments(
      'users',
      [{ field: 'realtorData.stripeSubscriptionId', operator: '==', value: subscription.id }],
      1 // Limit to 1 result since subscription IDs are unique
    ) as UserWithRealtorData[];

    if (users.length === 0) {
      // Warning:(`No user found for subscription ${subscription.id}`);
      return;
    }

    const user = users[0] as UserWithRealtorData;
    const updatedRealtorData = {
      ...user.realtorData || {},
      subscriptionStatus: subscription.status === 'active' ? 'active' : 'canceled',
      updatedAt: new Date()
    };

    await FirebaseDB.updateDocument('users', user.id, {
      realtorData: updatedRealtorData,
      updatedAt: new Date()
    });
  } catch (error) {
    console.error('❌ [STRIPE] Error in handleSubscriptionUpdated:', error);
    throw error; // Re-throw so Stripe retries
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  try {
    // Find user with this subscription ID and update status to canceled
    // TODO: Add Firestore index on 'realtorData.stripeSubscriptionId' for scale
    const users = await FirebaseDB.queryDocuments(
      'users',
      [{ field: 'realtorData.stripeSubscriptionId', operator: '==', value: subscription.id }],
      1 // Limit to 1 result since subscription IDs are unique
    ) as UserWithRealtorData[];

    if (users.length === 0) {
      // Warning:(`No user found for subscription deletion ${subscription.id}`);
      return;
    }

    const user = users[0] as UserWithRealtorData;
    const updatedRealtorData = {
      ...user.realtorData || {},
      subscriptionStatus: 'canceled',
      stripeSubscriptionId: null,
      updatedAt: new Date()
    };

    await FirebaseDB.updateDocument('users', user.id, {
      realtorData: updatedRealtorData,
      updatedAt: new Date()
    });
  } catch (error) {
    console.error('❌ [STRIPE] Error in handleSubscriptionDeleted:', error);
    throw error; // Re-throw so Stripe retries
  }
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  try {
    const subscriptionId = (invoice as { subscription?: string }).subscription;
    
    if (!subscriptionId) return;

    // Find user with this subscription ID
    // TODO: Add Firestore index on 'realtorData.stripeSubscriptionId' for scale
    const users = await FirebaseDB.queryDocuments(
      'users',
      [{ field: 'realtorData.stripeSubscriptionId', operator: '==', value: subscriptionId }],
      1 // Limit to 1 result since subscription IDs are unique
    ) as UserWithRealtorData[];

    if (users.length === 0) {
      // Warning:(`No user found for payment success ${subscriptionId}`);
      return;
    }

    const user = users[0] as UserWithRealtorData;
    const realtorData = user.realtorData || {};
    const creditPackId = (realtorData as Record<string, unknown>).currentPlan as string;
    
    // Find the credit package to get credits
    const creditPackage = CREDIT_PACKAGES[creditPackId as keyof typeof CREDIT_PACKAGES];
    if (!creditPackage || !creditPackage.recurring) {
      return;
    }

    // Add monthly credits for recurring subscriptions
    const currentCredits = (realtorData as Record<string, unknown>).credits as number || 0;
    const newCredits = currentCredits + creditPackage.credits;

    const updatedRealtorData = {
      ...realtorData,
      credits: newCredits,
      lastRenewal: new Date(),
      updatedAt: new Date()
    };

    await FirebaseDB.updateDocument('users', user.id, {
      realtorData: updatedRealtorData,
      updatedAt: new Date()
    });

    // Create renewal transaction record
    await FirebaseDB.createDocument('realtorTransactions', {
      realtorUserId: user.id,
      type: 'subscription_renewal',
      description: `Monthly renewal - ${creditPackage.name} - ${creditPackage.credits} credits`,
      creditsChange: creditPackage.credits,
      runningBalance: newCredits,
      stripeInvoiceId: invoice.id,
      stripeSubscriptionId: subscriptionId,
      amount: (invoice.amount_paid || 0) / 100,
      creditPackageId: creditPackId,
      createdAt: new Date()
    });
  } catch (error) {
    // CRITICAL: Payment succeeded but credits weren't added - must retry!
    console.error('❌ [STRIPE] Error in handlePaymentSucceeded:', error);
    throw error; // Re-throw so Stripe retries
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  try {
    const subscriptionId = (invoice as { subscription?: string }).subscription;
    
    if (!subscriptionId) return;

    // Find user with this subscription and update status
    // TODO: Add Firestore index on 'realtorData.stripeSubscriptionId' for scale
    const users = await FirebaseDB.queryDocuments(
      'users',
      [{ field: 'realtorData.stripeSubscriptionId', operator: '==', value: subscriptionId }],
      1 // Limit to 1 result since subscription IDs are unique
    ) as UserWithRealtorData[];

    if (users.length === 0) {
      // Warning:(`No user found for payment failure ${subscriptionId}`);
      return;
    }

    const user = users[0] as UserWithRealtorData;
    const updatedRealtorData = {
      ...user.realtorData || {},
      subscriptionStatus: 'payment_failed',
      lastPaymentFailed: new Date(),
      updatedAt: new Date()
    };

    await FirebaseDB.updateDocument('users', user.id, {
      realtorData: updatedRealtorData,
      updatedAt: new Date()
    });

    // Log the failed payment
    await FirebaseDB.createDocument('realtorTransactions', {
      realtorUserId: user.id,
      type: 'payment_failed',
      description: 'Monthly subscription payment failed',
      stripeInvoiceId: invoice.id,
      stripeSubscriptionId: subscriptionId,
      amount: (invoice.amount_due || 0) / 100,
      createdAt: new Date()
    });
  } catch (error) {
    console.error('❌ [STRIPE] Error in handlePaymentFailed:', error);
    throw error; // Re-throw so Stripe retries
  }
}

// This function is no longer needed - all subscription logic is handled in the new system