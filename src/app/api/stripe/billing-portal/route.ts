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
  getDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { RealtorProfile } from '@/lib/firebase-models';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

export async function POST(request: NextRequest) {
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

    // Get the realtor's profile to find their customer ID
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

    // Get customer ID from multiple sources
    let customerId = realtor.stripeCustomerId;
    
    // If not in realtor record, check user record
    if (!customerId) {
      try {
        const userDoc = await getDoc(doc(db, 'users', session.user.id!));
        const userData = userDoc.exists() ? userDoc.data() : null;
        customerId = userData?.stripeCustomerId;
      } catch (e) {
      }
    }

    // If still no customer ID found, try to find customer by email
    if (!customerId) {
      try {
        const customers = await stripe.customers.list({
          email: session.user.email,
          limit: 1
        });
        
        if (customers.data.length > 0) {
          customerId = customers.data[0].id;
          
          // Store the found customer ID for future use
          await updateDoc(doc(db, 'realtors', realtor.id), {
            stripeCustomerId: customerId,
            updatedAt: serverTimestamp()
          });
        }
      } catch (e) {
      }
    }

    // If still no customer, create one
    if (!customerId) {
      try {
        const customer = await stripe.customers.create({
          email: session.user.email,
          name: `${realtor.firstName} ${realtor.lastName}`.trim(),
          metadata: {
            userId: session.user.id,
            userRole: 'realtor'
          }
        });
        customerId = customer.id;
        
        // Save the customer ID directly in realtor record
        await updateDoc(doc(db, 'realtors', realtor.id), {
          stripeCustomerId: customerId,
          updatedAt: serverTimestamp()
        });

      } catch (e) {
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