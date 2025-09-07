import { NextRequest, NextResponse } from 'next/server';
import { 
  collection, 
  doc, 
  setDoc, 
  serverTimestamp,
  query,
  where,
  getDocs,
  getDoc
} from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getSessionWithRole } from '@/lib/auth-utils';
import { logError, logInfo } from '@/lib/logger';
import { firestoreHelpers } from '@/lib/firestore';

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionWithRole('realtor');
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Handle FormData for file uploads
    const formData = await request.formData();
    const transactionId = formData.get('transactionId') as string;
    const reason = formData.get('reason') as string;
    const explanation = formData.get('explanation') as string;
    const contactAttempts = formData.get('contactAttempts') as string;
    const evidence = formData.get('evidence') as string;
    const buyerName = formData.get('buyerName') as string;
    const purchaseDate = formData.get('purchaseDate') as string;
    const screenshotCount = parseInt(formData.get('screenshotCount') as string || '0');
    
    // Collect and upload screenshots to Firebase Storage
    const screenshotUrls = [];
    for (let i = 0; i < screenshotCount; i++) {
      const screenshot = formData.get(`screenshot_${i}`) as File;
      if (screenshot && screenshot.size > 0) {
        try {
          // Convert File to buffer
          const bytes = await screenshot.arrayBuffer();
          const buffer = Buffer.from(bytes);
          
          // Create a unique filename
          const timestamp = Date.now();
          const filename = `disputes/${transactionId}/${timestamp}_${i}_${screenshot.name}`;
          
          // Upload to Firebase Storage
          const storageRef = ref(storage, filename);
          const snapshot = await uploadBytes(storageRef, buffer, {
            contentType: screenshot.type || 'image/jpeg'
          });
          
          // Get the download URL
          const downloadUrl = await getDownloadURL(snapshot.ref);
          screenshotUrls.push(downloadUrl);
        } catch (uploadError) {
          console.error('Failed to upload screenshot:', uploadError);
        }
      }
    }

    // Validation
    if (!transactionId || !reason || !explanation) {
      return NextResponse.json(
        { error: 'Missing required fields. Need reason and explanation.' },
        { status: 400 }
      );
    }
    
    // Validate screenshots were uploaded
    if (screenshotUrls.length < 3) {
      return NextResponse.json(
        { error: `Please upload at least 3 screenshots showing contact attempts. Only ${screenshotUrls.length} were uploaded successfully.` },
        { status: 400 }
      );
    }

    // Get realtor profile
    const realtorsQuery = query(
      collection(db, 'realtors'),
      where('userId', '==', session.user.id!)
    );
    const realtorDocs = await getDocs(realtorsQuery);

    if (realtorDocs.empty) {
      return NextResponse.json(
        { error: 'Realtor profile not found' },
        { status: 400 }
      );
    }

    const realtorDoc = realtorDocs.docs[0];
    const realtorProfile = { id: realtorDoc.id, ...realtorDoc.data() };

    // Verify the transaction belongs to this realtor
    const purchaseDoc = await getDoc(doc(db, 'buyerLeadPurchases', transactionId));
    
    if (!purchaseDoc.exists() || purchaseDoc.data()?.realtorId !== realtorDoc.id) {
      return NextResponse.json(
        { error: 'Transaction not found or access denied' },
        { status: 403 }
      );
    }

    // Check if dispute already exists
    const existingDisputeQuery = query(
      collection(db, 'leadDisputes'),
      where('transactionId', '==', transactionId)
    );
    const existingDisputes = await getDocs(existingDisputeQuery);

    if (!existingDisputes.empty) {
      return NextResponse.json(
        { error: 'Dispute already submitted for this transaction' },
        { status: 400 }
      );
    }

    // Create dispute record
    const disputeId = firestoreHelpers.generateId();
    
    await setDoc(doc(db, 'leadDisputes', disputeId), {
      id: disputeId,
      transactionId: transactionId,
      realtorId: realtorDoc.id,
      realtorName: `${realtorProfile.firstName} ${realtorProfile.lastName}`,
      realtorEmail: realtorProfile.email,
      buyerName: buyerName || 'Unknown',
      purchaseDate: purchaseDate,
      reason: reason,
      explanation: explanation,
      contactAttempts: contactAttempts || '',
      evidence: screenshotUrls, // Store the actual screenshot URLs
      screenshotCount: screenshotUrls.length,
      status: 'pending',
      submittedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    await logInfo('Lead dispute submitted', {
      action: 'lead_dispute_submitted',
      disputeId: disputeId,
      realtorId: realtorDoc.id,
      transactionId: transactionId,
      reason: reason,
      metadata: {
        buyerName,
        realtorEmail: realtorProfile.email
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Dispute submitted successfully. We will review and respond within 24 hours.',
      disputeId: disputeId
    });

  } catch (error) {
    await logError('Failed to submit dispute', error, {
      action: 'dispute_submission_error'
    });

    return NextResponse.json(
      { error: 'Failed to submit dispute. Please try again.' },
      { status: 500 }
    );
  }
}