import { NextRequest, NextResponse } from 'next/server';
import { getSessionWithRole } from '@/lib/auth-utils';
import { db } from '@/lib/firebase';
import Stripe from 'stripe';
import { UserWithRealtorData } from '@/lib/realtor-models';

// Lazy-initialize Stripe to avoid build-time errors
function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-08-27.basil',
  });
}

// Credit packages that have subscriptions (only 4 and 10 credit packages)
const SUBSCRIPTION_PACKAGES = ['4_credits', '10_credits'];

export async function GET() {
  try {
    if (!db) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    const session = await getSessionWithRole('realtor');
    
    if (!session?.user?.email || !session?.user?.id) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Get user data from new system
    if (!db) {
      return NextResponse.json({ subscriptions: [] });
    }
    
    const { getDoc, doc } = await import('firebase/firestore');
    const userDocRef = doc(db, 'users', session.user.id!);
    const userDocSnap = await getDoc(userDocRef);
    
    if (!userDocSnap.exists()) {
      return NextResponse.json({ subscriptions: [] });
    }
    
    const userData = { id: userDocSnap.id, ...userDocSnap.data() };

    const realtorData = (userData as UserWithRealtorData).realtorData;
    if (!realtorData?.stripeCustomerId) {
      return NextResponse.json({ subscriptions: [] });
    }

    // Only show subscriptions if user has a subscription plan (4 or 10 credits)
    const currentPlan = (realtorData as unknown as { currentPlan?: string }).currentPlan;
    if (!currentPlan || !SUBSCRIPTION_PACKAGES.includes(currentPlan)) {
      return NextResponse.json({ subscriptions: [] });
    }

    // Get active subscriptions from Stripe
    const stripe = getStripe();
    const subscriptions = await stripe.subscriptions.list({
      customer: realtorData.stripeCustomerId,
      status: 'active',
      limit: 10
    });

    const formattedSubscriptions = subscriptions.data.map((sub: Stripe.Subscription) => ({
      id: sub.id,
      status: sub.status,
      current_period_end: (sub as unknown as { current_period_end: number }).current_period_end,
      credits: sub.metadata?.credits ? parseInt(sub.metadata.credits) : 0,
      price: sub.items.data[0]?.price?.unit_amount ? (sub.items.data[0].price.unit_amount / 100) : 0,
      plan: currentPlan
    }));

    return NextResponse.json({ subscriptions: formattedSubscriptions });

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch subscriptions' },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const session = await getSessionWithRole('realtor');
    
    if (!session?.user?.email || !session?.user?.id) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Get user data from new system
    if (!db) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }
    
    const { getDoc, doc, updateDoc } = await import('firebase/firestore');
    const userDocRef = doc(db, 'users', session.user.id!);
    const userDocSnap = await getDoc(userDocRef);
    
    if (!userDocSnap.exists()) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }
    
    const userData = { id: userDocSnap.id, ...userDocSnap.data() };

    const realtorData = (userData as UserWithRealtorData).realtorData;
    
    // Only allow billing portal access if user has active subscription
    const currentPlan = (realtorData as unknown as { currentPlan?: string }).currentPlan;
    if (!currentPlan || !SUBSCRIPTION_PACKAGES.includes(currentPlan)) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 400 }
      );
    }

    // Get customer ID
    let customerId = realtorData?.stripeCustomerId;

    // If no customer ID found, try to find customer by email
    const stripe = getStripe();
    if (!customerId) {
      try {
        const customers = await stripe.customers.list({
          email: session.user.email,
          limit: 1
        });
        
        if (customers.data.length > 0) {
          customerId = customers.data[0].id;
          
          // Store the found customer ID for future use
          const updatedRealtorData = {
            ...realtorData || {},
            stripeCustomerId: customerId,
            updatedAt: new Date()
          };

          await updateDoc(userDocRef, {
            realtorData: updatedRealtorData,
            updatedAt: new Date()
          });
        }
      } catch (error) {
        // Handle error silently
      }
    }

    // If still no customer, create one
    if (!customerId) {
      try {
        const customer = await stripe.customers.create({
          email: session.user.email,
          name: (userData as UserWithRealtorData).email || session.user.email,
          metadata: {
            userId: session.user.id,
            userRole: 'realtor'
          }
        });
        customerId = customer.id;
        
        // Save the customer ID in user record
        const updatedRealtorData = {
          ...realtorData || {},
          stripeCustomerId: customerId,
          updatedAt: new Date()
        };

        await updateDoc(userDocRef, {
          realtorData: updatedRealtorData,
          updatedAt: new Date()
        });

      } catch (error) {
        return NextResponse.json(
          { error: 'Failed to create customer account' },
          { status: 500 }
        );
      }
    }

    // Create billing portal session
    try {
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${process.env.NEXTAUTH_URL}/realtor-dashboard?portal=closed`,
      });

      return NextResponse.json({ 
        url: portalSession.url 
      });

    } catch (stripeError: unknown) {
      return NextResponse.json(
        { 
          error: 'Failed to create billing portal session',
          details: (stripeError as Error).message
        },
        { status: 500 }
      );
    }

  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to create billing portal session',
        details: (error as Error).message
      },
      { status: 500 }
    );
  }
}