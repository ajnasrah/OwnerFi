import { NextResponse } from 'next/server';
import { 
  collection, 
  query, 
  getDocs, 
  orderBy,
  doc,
  deleteDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { ExtendedSession } from '@/types/session';

// GET - Fetch all contact form submissions
export async function GET() {
  try {
    if (!db) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    const session = await getServerSession(authOptions) as ExtendedSession;
    
    if (!session?.user || session.user?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const contactsQuery = query(
      collection(db, 'contactSubmissions'),
      orderBy('createdAt', 'desc')
    );
    const contactDocs = await getDocs(contactsQuery);

    const contacts = contactDocs.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt
    }));

    return NextResponse.json({
      contacts,
      totalContacts: contacts.length
    });

  } catch {
    return NextResponse.json(
      { error: 'Failed to load contact submissions' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a contact submission
export async function DELETE(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    const session = await getServerSession(authOptions) as ExtendedSession;
    
    if (!session?.user || session.user?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get('id');

    if (!contactId) {
      return NextResponse.json(
        { error: 'Contact ID required' },
        { status: 400 }
      );
    }

    await deleteDoc(doc(db, 'contactSubmissions', contactId));

    return NextResponse.json({
      success: true,
      message: 'Contact deleted successfully'
    });

  } catch {
    return NextResponse.json(
      { error: 'Failed to delete contact' },
      { status: 500 }
    );
  }
}