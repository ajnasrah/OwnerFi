import { NextRequest, NextResponse } from 'next/server';
import { getSessionWithRole } from '@/lib/auth-utils';
import { FirebaseDB } from '@/lib/firebase-db';
import { db } from '@/lib/firebase';
import Stripe from 'stripe';
import { UserWithRealtorData } from '@/lib/realtor-models';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

// Credit packages that have subscriptions (only 4 and 10 credit packages)
const SUBSCRIPTION_PACKAGES = ['4_credits', '10_credits'];

export async function GET(_: NextRequest) {
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
    const userData = await FirebaseDB.getDocument('users', session.user.id!);
    if (!userData) {
      return NextResponse.json({ subscriptions: [] });
    }

    const realtorData = (userData as UserWithRealtorData).realtorData;
    if (!realtorData?.stripeCustomerId) {
      return NextResponse.json({ subscriptions: [] });
    }

    // Only show subscriptions if user has a subscription plan (4 or 10 credits)
    const currentPlan = (realtorData as any).currentPlan;
    if (!currentPlan || !SUBSCRIPTION_PACKAGES.includes(currentPlan)) {
      return NextResponse.json({ subscriptions: [] });
    }

    // Get active subscriptions from Stripe
    const subscriptions = await stripe.subscriptions.list({
      customer: realtorData.stripeCustomerId,
      status: 'active',
      limit: 10
    });

    const formattedSubscriptions = subscriptions.data.map(sub => ({
      id: sub.id,
      status: sub.status,
      current_period_end: sub.current_period_end,
      credits: sub.metadata.credits ? parseInt(sub.metadata.credits) : 0,
      price: sub.items.data[0]?.price.unit_amount ? (sub.items.data[0].price.unit_amount / 100) : 0,
      plan: currentPlan
    }));

    return NextResponse.json({ subscriptions: formattedSubscriptions });

  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch subscriptions' },
      { status: 500 }
    );
  }
}

export async function POST(_: NextRequest) {
  try {
    const session = await getSessionWithRole('realtor');
    
    if (!session?.user?.email || !session?.user?.id) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Get user data from new system
    const userData = await FirebaseDB.getDocument('users', session.user.id!);
    if (!userData) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    const realtorData = (userData as UserWithRealtorData).realtorData;
    
    // Only allow billing portal access if user has active subscription
    const currentPlan = realtorData?.currentPlan;
    if (!currentPlan || !SUBSCRIPTION_PACKAGES.includes(currentPlan)) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 400 }
      );
    }

    // Get customer ID
    let customerId = realtorData?.stripeCustomerId;

    // If no customer ID found, try to find customer by email
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

          await FirebaseDB.updateDocument('users', session.user.id!, {
            realtorData: updatedRealtorData,
            updatedAt: new Date()
          });
        }
      } catch {
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

        await FirebaseDB.updateDocument('users', session.user.id!, {
          realtorData: updatedRealtorData,
          updatedAt: new Date()
        });

      } catch {
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