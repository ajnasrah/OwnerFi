import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { ExtendedSession } from '@/types/session';

// Initialize Firebase Admin (if not already initialized)
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    }),
  });
}

const db = getFirestore();

export async function GET(request: NextRequest) {
  try {
    // Admin access control
    const session = await getServerSession(authOptions as any) as ExtendedSession | null;

    if (!session?.user || (session as ExtendedSession).user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Access denied. Admin access required.' },
        { status: 403 }
      );
    }

    // Fetch only properties where GHL webhook failed
    const snapshot = await db
      .collection('zillow_imports')
      .where('ghlSendStatus', '==', 'failed')
      .orderBy('importedAt', 'desc')
      .get();

    const properties = snapshot.docs
      .map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          // Convert Firestore timestamps
          importedAt: data.importedAt?.toDate?.()?.toISOString() || data.importedAt,
          scrapedAt: data.scrapedAt?.toDate?.()?.toISOString() || data.scrapedAt,
          ghlSentAt: data.ghlSentAt?.toDate?.()?.toISOString() || data.ghlSentAt,
        };
      });

    return NextResponse.json({
      success: true,
      properties,
      count: properties.length
    });

  } catch (error: any) {
    console.error('Failed to fetch zillow_imports:', error);
    return NextResponse.json(
      { error: 'Failed to fetch properties' },
      { status: 500 }
    );
  }
}
