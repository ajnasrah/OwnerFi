import { NextRequest, NextResponse } from 'next/server';
import {
  collection,
  doc,
  setDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface ContactSubmission {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
}

export async function POST(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    const body: ContactSubmission = await request.json();

    // Validate required fields
    if (!body.name || !body.email || !body.subject || !body.message) {
      return NextResponse.json(
        { error: 'Missing required fields: name, email, subject, message' },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }

    // Create submission ID
    const submissionId = `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Save to Firebase
    await setDoc(doc(db, 'contactSubmissions', submissionId), {
      id: submissionId,
      name: body.name.trim(),
      email: body.email.trim().toLowerCase(),
      phone: body.phone?.trim() || null,
      subject: body.subject,
      message: body.message.trim(),
      status: 'new', // new, read, responded, archived
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    console.log(`[CONTACT] New submission: ${submissionId} from ${body.email}`);

    return NextResponse.json({
      success: true,
      message: 'Contact form submitted successfully',
      submissionId
    });

  } catch (error) {
    console.error('[CONTACT] Error saving submission:', error);
    return NextResponse.json(
      { error: 'Failed to submit contact form' },
      { status: 500 }
    );
  }
}
