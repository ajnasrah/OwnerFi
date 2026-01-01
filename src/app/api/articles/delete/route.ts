import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { deleteDoc, doc } from 'firebase/firestore';

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const articleId = searchParams.get('articleId');
    const brand = searchParams.get('brand') as 'carz' | 'ownerfi' | 'benefit' | 'abdullah' | 'personal' | 'gaza';

    console.log('Delete article request:', { articleId, brand });

    if (!articleId || !brand) {
      return NextResponse.json(
        { error: 'Missing articleId or brand parameter' },
        { status: 400 }
      );
    }

    if (!['carz', 'ownerfi', 'benefit', 'abdullah', 'personal', 'gaza'].includes(brand)) {
      return NextResponse.json(
        { error: 'Invalid brand. Must be one of: carz, ownerfi, benefit, abdullah, personal, gaza' },
        { status: 400 }
      );
    }

    if (!db) {
      console.error('Firebase not initialized');
      return NextResponse.json(
        { error: 'Firebase not initialized' },
        { status: 500 }
      );
    }

    // Get the collection name for the specific brand
    const collectionName = `${brand}_articles`;
    console.log('Deleting from collection:', collectionName);

    // Delete the article document from Firestore
    await deleteDoc(doc(db, collectionName, articleId));

    console.log('Successfully deleted article:', articleId);

    return NextResponse.json({
      success: true,
      message: `Article ${articleId} deleted successfully`,
      articleId,
      brand
    });
  } catch (error) {
    console.error('Error deleting article:', error);
    return NextResponse.json(
      { error: 'Failed to delete article', details: error.message },
      { status: 500 }
    );
  }
}
