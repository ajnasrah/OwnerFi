import { NextRequest, NextResponse } from 'next/server';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { getSafeDb } from '@/lib/firebase-safe';
import { requireRole, extractActorFromRequest } from '@/lib/auth-helpers';
import {
  ErrorResponses,
  createSuccessResponse,
  parseRequestBody,
  logError
} from '@/lib/api-error-handler';
import { AuditHelpers } from '@/lib/audit-logger';

interface AddCreditsRequest {
  realtorEmail: string;
  credits: number;
}

export async function POST(request: NextRequest) {
  // Standardized admin authentication
  const authResult = await requireRole(request, 'admin');
  if ('error' in authResult) return authResult.error;
  const { session } = authResult;

  // Standardized body parsing
  const bodyResult = await parseRequestBody<AddCreditsRequest>(request);
  if (!bodyResult.success) {
    return (bodyResult as { success: false; response: NextResponse }).response;
  }

  const { realtorEmail, credits } = bodyResult.data;

  // Validation
  if (!realtorEmail || !credits) {
    return ErrorResponses.validationError(
      'Realtor email and credits amount required'
    );
  }

  if (typeof credits !== 'number' || credits <= 0) {
    return ErrorResponses.validationError(
      'Credits must be a positive number'
    );
  }

  try {
    // Find realtor by email
    const db = getSafeDb();
    const usersQuery = query(
      collection(db, 'users'),
      where('email', '==', realtorEmail),
      where('role', '==', 'realtor')
    );
    const userDocs = await getDocs(usersQuery);

    if (userDocs.empty) {
      return ErrorResponses.notFound('Realtor');
    }

    const user = userDocs.docs[0];

    // Find realtor profile
    const realtorsQuery = query(
      collection(db, 'realtors'),
      where('userId', '==', user.id)
    );
    const realtorDocs = await getDocs(realtorsQuery);

    if (realtorDocs.empty) {
      return ErrorResponses.notFound('Realtor profile');
    }

    const realtorDoc = realtorDocs.docs[0];
    const currentCredits = realtorDoc.data().credits || 0;
    const newCredits = currentCredits + credits;

    // Update credits
    await updateDoc(doc(db, 'realtors', realtorDoc.id), {
      credits: newCredits,
      updatedAt: serverTimestamp()
    });

    // AUDIT LOG - Critical admin action
    await AuditHelpers.logCreditsAdded(
      extractActorFromRequest(request, session),
      realtorDoc.id,
      realtorEmail,
      credits
    );

    return createSuccessResponse({
      message: `Added ${credits} credits to ${realtorEmail}`,
      previousCredits: currentCredits,
      newCredits: newCredits,
      realtorId: realtorDoc.id
    });

  } catch (error) {
    logError('POST /api/admin/add-credits', error, {
      adminId: session.user.id,
      realtorEmail,
      credits
    });
    return ErrorResponses.databaseError('Failed to add credits', error);
  }
}
