import { NextResponse } from 'next/server';
import { FirebaseDB } from '@/lib/firebase-db';

export async function POST() {
  try {
    const { email } = await request.json();
    
    
    // Find user by email
    const user = await FirebaseDB.findUserByEmail(email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    
    // Get buyer profile
    const buyerProfile = await FirebaseDB.findBuyerByUserId(user.id);
    
    
    // Get buyer link profile  
    const buyerLinks = await FirebaseDB.queryDocuments(
      'buyerLinks',
      [{ field: 'userId', operator: '==', value: user.id }]
    );
    

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      buyerProfile: buyerProfile,
      buyerLinks: buyerLinks
    });

  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}