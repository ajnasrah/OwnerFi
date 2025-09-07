import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { 
  doc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

export async function GET(request: NextRequest) {
  try {
    // Find customer by email
    const customers = await stripe.customers.list({
      email: 'abdullah@prosway.com',
      limit: 10
    });
    
    if (customers.data.length > 0) {
      const customer = customers.data[0];
      
      // Update realtor record with customer ID
      await updateDoc(doc(db, 'realtors', 'idjfqlXrzobyRoFVRTUO'), {
        stripeCustomerId: customer.id,
        updatedAt: serverTimestamp()
      });
      
      return NextResponse.json({
        found: true,
        customerId: customer.id,
        email: customer.email,
        created: new Date(customer.created * 1000).toISOString(),
        message: 'Customer found and saved to realtor profile'
      });
    } else {
      return NextResponse.json({
        found: false,
        message: 'No Stripe customer found for abdullah@prosway.com'
      });
    }
    
  } catch (error) {
    console.error('Failed to find customer:', error);
    return NextResponse.json(
      { error: 'Failed to find customer' },
      { status: 500 }
    );
  }
}