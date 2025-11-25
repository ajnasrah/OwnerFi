import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
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

/**
 * GET /api/admin/zillow-imports/[id]
 * Fetch a single property by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions as any) as ExtendedSession | null;

    if (!session?.user || (session as ExtendedSession).user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Access denied. Admin access required.' },
        { status: 403 }
      );
    }

    const doc = await db.collection('zillow_imports').doc(id).get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: 'Property not found' },
        { status: 404 }
      );
    }

    const data = doc.data();
    return NextResponse.json({
      success: true,
      property: {
        id: doc.id,
        ...data,
        // Convert Firestore timestamps
        importedAt: data?.importedAt?.toDate?.()?.toISOString() || data?.importedAt,
        foundAt: data?.foundAt?.toDate?.()?.toISOString() || data?.foundAt,
        verifiedAt: data?.verifiedAt?.toDate?.()?.toISOString() || data?.verifiedAt,
        soldAt: data?.soldAt?.toDate?.()?.toISOString() || data?.soldAt,
      }
    });

  } catch (error: any) {
    console.error('Failed to fetch property:', error);
    return NextResponse.json(
      { error: 'Failed to fetch property' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/zillow-imports/[id]
 * Update a property with financing terms
 * AUTO-UPDATES STATUS when all required fields are filled
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions as any) as ExtendedSession | null;

    if (!session?.user || (session as ExtendedSession).user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Access denied. Admin access required.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const propertyRef = db.collection('zillow_imports').doc(id);
    const propertyDoc = await propertyRef.get();

    if (!propertyDoc.exists) {
      return NextResponse.json(
        { error: 'Property not found' },
        { status: 404 }
      );
    }

    const currentData = propertyDoc.data();

    // Build update object
    const updates: any = {
      ...body,
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Remove undefined values
    Object.keys(updates).forEach(key => {
      if (updates[key] === undefined) {
        delete updates[key];
      }
    });

    // AUTO-STATUS UPDATE LOGIC
    // Check if all required financing terms are filled
    const updatedData = { ...currentData, ...updates };
    const hasAllTerms = !!(
      updatedData.downPaymentAmount &&
      updatedData.monthlyPayment &&
      updatedData.interestRate &&
      updatedData.loanTermYears
    );

    console.log('[AUTO-STATUS] Checking terms:', {
      downPaymentAmount: updatedData.downPaymentAmount,
      monthlyPayment: updatedData.monthlyPayment,
      interestRate: updatedData.interestRate,
      loanTermYears: updatedData.loanTermYears,
      hasAllTerms,
      currentStatus: currentData?.status,
    });

    // If all terms are filled AND status is null, auto-update to 'verified'
    if (hasAllTerms && currentData?.status === null) {
      updates.status = 'verified';
      updates.verifiedAt = FieldValue.serverTimestamp();
      console.log('[AUTO-STATUS] ✅ Auto-updating status to "verified"');
    }

    // If terms are removed/cleared, reset status back to null
    if (!hasAllTerms && currentData?.status === 'verified') {
      updates.status = null;
      updates.verifiedAt = null;
      console.log('[AUTO-STATUS] ⚠️ Resetting status to null (terms incomplete)');
    }

    // Update the document
    await propertyRef.update(updates);

    // Fetch updated document
    const updatedDoc = await propertyRef.get();
    const updatedDocData = updatedDoc.data();

    return NextResponse.json({
      success: true,
      message: hasAllTerms && currentData?.status === null
        ? 'Property updated and status auto-set to verified'
        : 'Property updated successfully',
      property: {
        id: updatedDoc.id,
        ...updatedDocData,
        importedAt: updatedDocData?.importedAt?.toDate?.()?.toISOString() || updatedDocData?.importedAt,
        foundAt: updatedDocData?.foundAt?.toDate?.()?.toISOString() || updatedDocData?.foundAt,
        verifiedAt: updatedDocData?.verifiedAt?.toDate?.()?.toISOString() || updatedDocData?.verifiedAt,
        soldAt: updatedDocData?.soldAt?.toDate?.()?.toISOString() || updatedDocData?.soldAt,
      }
    });

  } catch (error: any) {
    console.error('Failed to update property:', error);
    return NextResponse.json(
      { error: 'Failed to update property', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/zillow-imports/[id]
 * Delete a property (mark as sold/pending)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions as any) as ExtendedSession | null;

    if (!session?.user || (session as ExtendedSession).user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Access denied. Admin access required.' },
        { status: 403 }
      );
    }

    const propertyRef = db.collection('zillow_imports').doc(id);
    const propertyDoc = await propertyRef.get();

    if (!propertyDoc.exists) {
      return NextResponse.json(
        { error: 'Property not found' },
        { status: 404 }
      );
    }

    // Soft delete - mark as sold instead of hard delete
    await propertyRef.update({
      status: 'sold',
      soldAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      message: 'Property marked as sold'
    });

  } catch (error: any) {
    console.error('Failed to delete property:', error);
    return NextResponse.json(
      { error: 'Failed to delete property' },
      { status: 500 }
    );
  }
}
