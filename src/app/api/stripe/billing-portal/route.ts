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
    const { userId, userEmail } = await request.json();
    
    if (!userId || !userEmail) {
      return NextResponse.json(
        { error: 'Missing userId or userEmail' },
        { status: 400 }
      );
    }

    if (!adminDb) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 503 }
      );
    }

    // Get the realtor's profile to find their customer ID
    const realtorsSnapshot = await adminDb.collection('realtors').where('userId', '==', userId).get();
    const realtor = realtorsSnapshot.empty ? null : { id: realtorsSnapshot.docs[0].id, ...realtorsSnapshot.docs[0].data() } as RealtorProfile;

    if (!realtor) {
      return NextResponse.json(
        { error: 'Realtor profile not found' },
        { status: 404 }
      );
    }

    // Get customer ID from multiple sources
    let customerId = realtor.stripeCustomerId;
    
    // If not in realtor record, check user record
    if (!customerId) {
      try {
        const userDoc = await adminDb.collection('users').doc(userId).get();
        const userData = userDoc.exists ? userDoc.data() : null;
        customerId = userData?.stripeCustomerId;
      } catch (e) {
        console.error('Failed to get user data:', e);
      }
    }

    // If still no customer ID found, try to find customer by email
    if (!customerId) {
      try {
        const customers = await stripe.customers.list({
          email: userEmail,
          limit: 1
        });
        
        if (customers.data.length > 0) {
          customerId = customers.data[0].id;
          
          // Store the found customer ID for future use
          await adminDb.collection('realtors').doc(realtor.id).update({
            stripeCustomerId: customerId,
            updatedAt: new Date()
          });
        }
      } catch (e) {
        console.error('Failed to find customer by email:', e);
      }
    }

    // If still no customer, create one
    if (!customerId) {
      try {
        const customer = await stripe.customers.create({
          email: userEmail,
          name: `${realtor.firstName} ${realtor.lastName}`.trim(),
          metadata: {
            userId: userId,
            userRole: 'realtor'
          }
        });
        customerId = customer.id;
        
        // Save the customer ID directly in realtor record
        await adminDb.collection('realtors').doc(realtor.id).update({
          stripeCustomerId: customerId,
          updatedAt: new Date()
        });

      } catch (e) {
        console.error('Failed to create customer:', e);
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
        return_url: `${process.env.NEXTAUTH_URL}/realtor/settings#subscription`,
      });

      return NextResponse.json({ 
        url: portalSession.url 
      });

    } catch (stripeError: any) {
      console.error('Stripe billing portal error:', stripeError);
      return NextResponse.json(
        { 
          error: 'Failed to create billing portal session',
          details: stripeError.message,
          debug: process.env.NODE_ENV === 'development' ? {
            customerId,
            hasRealtor: !!realtor,
            errorType: stripeError.type
          } : undefined
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Billing portal error:', error);
    
    // Handle role validation errors specifically
    if ((error as Error).message.includes('Access denied') || (error as Error).message.includes('Not authenticated')) {
      return NextResponse.json(
        { error: 'Access denied. Realtor access required.' },
        { status: 403 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to create billing portal session',
        details: (error as Error).message,
        debug: process.env.NODE_ENV === 'development' ? {
          errorName: (error as Error).name,
          errorStack: (error as Error).stack
        } : undefined
      },
      { status: 500 }
    );
  }
}