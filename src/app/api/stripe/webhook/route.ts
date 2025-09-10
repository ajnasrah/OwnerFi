import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { PRICING_TIERS } from '@/lib/pricing';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

// Force dynamic rendering to prevent build-time Firebase evaluation
export const dynamic = 'force-dynamic';

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  let event;

  try {
    event = stripe.webhooks.constructEvent(body, signature!, endpointSecret!);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 });
  }

  try {
    if (!adminDb) {
      console.error('Admin DB not available');
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook processing failed:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const metadata = session.metadata;
  const userId = metadata?.userId;
  const planId = metadata?.planId;
  const billingType = metadata?.billingType; // 'monthly' | 'annual' | 'one-time'
  const type = metadata?.type; // 'subscription' | 'credit_purchase' | 'annual_purchase'
  
  if (!userId) {
    console.error('No userId in checkout session metadata');
    return;
  }

  // Find realtor by userId
  const realtorsSnapshot = await adminDb!.collection('realtors').where('userId', '==', userId).get();
  
  if (realtorsSnapshot.empty) {
    console.error('Realtor not found for user:', userId);
    return;
  }

  const realtorDoc = realtorsSnapshot.docs[0];
  const realtor = { id: realtorDoc.id, ...realtorDoc.data() };
  const tier = planId ? PRICING_TIERS[planId] : PRICING_TIERS.payAsYouGo;

  // Update realtor with Stripe customer ID
  await adminDb!.collection('realtors').doc(realtor.id).update({
    stripeCustomerId: session.customer,
    updatedAt: new Date()
  });

  if (type === 'credit_purchase' || type === 'single_credit_purchase') {
    // ONE-TIME CREDIT PURCHASE (Pay-As-You-Go)
    const creditsToAdd = tier.creditsPerMonth || 1;
    
    await adminDb!.collection('realtors').doc(realtor.id).update({
      credits: (realtor.credits || 0) + creditsToAdd,
      isOnTrial: false,
      updatedAt: new Date()
    });

    // Add transaction record
    await adminDb!.collection('transactions').add({
      realtorId: realtor.id,
      userId: userId,
      type: 'credit_purchase',
      description: `Purchased ${creditsToAdd} credit${creditsToAdd > 1 ? 's' : ''}`,
      amount: tier.monthlyPrice,
      creditsAdded: creditsToAdd,
      stripeSessionId: session.id,
      createdAt: new Date()
    });
    
    console.log(`✅ Added ${creditsToAdd} credits to realtor ${realtor.id} (pay-as-you-go)`);

  } else if (type === 'annual_purchase') {
    // ANNUAL PACKAGE - Give ALL credits upfront
    const annualCredits = tier.creditsPerMonth * 12;
    
    await adminDb!.collection('realtors').doc(realtor.id).update({
      credits: (realtor.credits || 0) + annualCredits,
      currentPlan: planId,
      subscriptionStatus: 'active',
      isOnTrial: false,
      updatedAt: new Date()
    });

    // Create annual subscription record
    const yearStart = new Date();
    const yearEnd = new Date();
    yearEnd.setFullYear(yearEnd.getFullYear() + 1);

    await adminDb!.collection('realtorSubscriptions').add({
      realtorId: realtor.id,
      userId: userId,
      plan: planId,
      status: 'active',
      isAnnual: true,
      monthlyPrice: tier.monthlyPrice,
      creditsPerMonth: tier.creditsPerMonth,
      stripeCustomerId: session.customer,
      currentPeriodStart: yearStart,
      currentPeriodEnd: yearEnd,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Add transaction record
    await adminDb!.collection('transactions').add({
      realtorId: realtor.id,
      userId: userId,
      type: 'annual_purchase',
      description: `Annual ${tier.name} - ${annualCredits} credits upfront`,
      amount: tier.monthlyPrice * 12 * 0.5, // 50% discount
      creditsAdded: annualCredits,
      stripeSessionId: session.id,
      createdAt: new Date()
    });
    
    console.log(`✅ Added ${annualCredits} annual credits to realtor ${realtor.id}`);

  } else if (type === 'subscription' && session.subscription) {
    // MONTHLY SUBSCRIPTION - Give monthly credits + set up billing
    const monthlyCredits = tier.creditsPerMonth;
    
    await adminDb!.collection('realtors').doc(realtor.id).update({
      credits: (realtor.credits || 0) + monthlyCredits,
      currentPlan: planId,
      subscriptionStatus: 'active',
      stripeSubscriptionId: session.subscription,
      isOnTrial: false,
      updatedAt: new Date()
    });

    // Create subscription record
    const periodStart = new Date();
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    await adminDb!.collection('realtorSubscriptions').add({
      realtorId: realtor.id,
      userId: userId,
      plan: planId,
      status: 'active',
      isAnnual: false,
      monthlyPrice: tier.monthlyPrice,
      creditsPerMonth: tier.creditsPerMonth,
      stripeSubscriptionId: session.subscription,
      stripeCustomerId: session.customer,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Add transaction record
    await adminDb!.collection('transactions').add({
      realtorId: realtor.id,
      userId: userId,
      type: 'subscription_start',
      description: `${tier.name} subscription - ${monthlyCredits} monthly credits`,
      amount: tier.monthlyPrice,
      creditsAdded: monthlyCredits,
      stripeSubscriptionId: session.subscription,
      createdAt: new Date()
    });
    
    console.log(`✅ Started subscription for realtor ${realtor.id}, added ${monthlyCredits} credits`);
  }
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  // Handle recurring subscription payments - add monthly credits
  const subscriptionId = (invoice as any).subscription;
  
  if (!subscriptionId) {
    console.log('No subscription ID in invoice - skipping credit addition');
    return;
  }

  // Find subscription record
  const subscriptionsSnapshot = await adminDb!.collection('realtorSubscriptions')
    .where('stripeSubscriptionId', '==', subscriptionId)
    .get();

  if (subscriptionsSnapshot.empty) {
    console.error('Subscription not found for invoice:', invoice.id);
    return;
  }

  const subscription = subscriptionsSnapshot.docs[0].data();
  const tier = PRICING_TIERS[subscription.plan];
  
  if (!tier) {
    console.error('Invalid plan in subscription:', subscription.plan);
    return;
  }

  // Add monthly credits for recurring payment
  const monthlyCredits = tier.creditsPerMonth;
  
  if (monthlyCredits > 0) {
    const realtorDoc = await adminDb!.collection('realtors').doc(subscription.realtorId).get();
    
    if (realtorDoc.exists) {
      const realtorData = realtorDoc.data()!;
      
      await adminDb!.collection('realtors').doc(subscription.realtorId).update({
        credits: (realtorData.credits || 0) + monthlyCredits,
        updatedAt: new Date()
      });

      // Add transaction record
      await adminDb!.collection('transactions').add({
        realtorId: subscription.realtorId,
        userId: subscription.userId,
        type: 'monthly_credits',
        description: `Monthly ${tier.name} credits`,
        amount: tier.monthlyPrice,
        creditsAdded: monthlyCredits,
        stripeInvoiceId: invoice.id,
        createdAt: new Date()
      });
      
      console.log(`✅ Added ${monthlyCredits} monthly credits to realtor ${subscription.realtorId}`);
    }
  }
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  // Usually handled in checkout.session.completed, but this is a fallback
  console.log('Subscription created (fallback):', subscription.id);
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  // Handle subscription changes (plan upgrades, etc.)
  const subscriptionsSnapshot = await adminDb!.collection('realtorSubscriptions')
    .where('stripeSubscriptionId', '==', subscription.id)
    .get();

  if (!subscriptionsSnapshot.empty) {
    const subscriptionDoc = subscriptionsSnapshot.docs[0];
    
    await adminDb!.collection('realtorSubscriptions').doc(subscriptionDoc.id).update({
      status: subscription.status === 'active' ? 'active' : 'canceled',
      currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
      currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
      updatedAt: new Date()
    });
    
    console.log(`✅ Updated subscription ${subscription.id} status: ${subscription.status}`);
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  // Handle subscription cancellation
  const subscriptionsSnapshot = await adminDb!.collection('realtorSubscriptions')
    .where('stripeSubscriptionId', '==', subscription.id)
    .get();

  if (!subscriptionsSnapshot.empty) {
    const subscriptionDoc = subscriptionsSnapshot.docs[0];
    const subscriptionData = subscriptionDoc.data();
    
    // Update subscription status
    await adminDb!.collection('realtorSubscriptions').doc(subscriptionDoc.id).update({
      status: 'canceled',
      canceledAt: new Date(),
      updatedAt: new Date()
    });

    // Update realtor status
    await adminDb!.collection('realtors').doc(subscriptionData.realtorId).update({
      subscriptionStatus: 'canceled',
      updatedAt: new Date()
    });
    
    console.log(`✅ Canceled subscription ${subscription.id} for realtor ${subscriptionData.realtorId}`);
  }
}