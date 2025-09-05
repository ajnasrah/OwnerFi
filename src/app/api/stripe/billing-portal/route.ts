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

    // Get the realtor's profile to find their customer ID
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

    let customerId = null;
    
    // Try to get customer ID from subscription data
    if (realtor.subscriptionData) {
      try {
        const subscriptionData = JSON.parse(realtor.subscriptionData);
        customerId = subscriptionData.customerId;
      } catch (e) {
        console.error('Failed to parse subscription data:', e);
      }
    }

    // If no customer ID found, try to find customer by email
    if (!customerId) {
      try {
        const customers = await stripe.customers.list({
          email: session.user.email,
          limit: 1
        });
        
        if (customers.data.length > 0) {
          customerId = customers.data[0].id;
        }
      } catch (e) {
        console.error('Failed to find customer by email:', e);
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
        
        // Save the customer ID for future use
        const subscriptionData = realtor.subscriptionData 
          ? JSON.parse(realtor.subscriptionData)
          : {};
        
        if (realtor) {
          await updateDoc(doc(db, 'realtors', realtor.id), {
            subscriptionData: JSON.stringify({
              ...subscriptionData,
              customerId: customerId
            }),
            updatedAt: serverTimestamp()
          });
        }

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
        { error: 'Failed to create billing portal session' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Billing portal error:', error);
    return NextResponse.json(
      { error: 'Failed to create billing portal session' },
      { status: 500 }
    );
  }
}