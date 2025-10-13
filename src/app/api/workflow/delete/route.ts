import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { deleteDoc, doc } from 'firebase/firestore';
import { getCollectionName } from '@/lib/feed-store-firestore';

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workflowId = searchParams.get('workflowId');
    const brand = searchParams.get('brand') as 'carz' | 'ownerfi';

    console.log('Delete workflow request:', { workflowId, brand });

    if (!workflowId || !brand) {
      return NextResponse.json(
        { error: 'Missing workflowId or brand parameter' },
        { status: 400 }
      );
    }

    if (brand !== 'carz' && brand !== 'ownerfi') {
      return NextResponse.json(
        { error: 'Invalid brand. Must be "carz" or "ownerfi"' },
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
    const collectionName = getCollectionName('WORKFLOW_QUEUE', brand);
    console.log('Deleting from collection:', collectionName);

    // Delete the workflow document from Firestore
    await deleteDoc(doc(db, collectionName, workflowId));

    console.log('Successfully deleted workflow:', workflowId);

    return NextResponse.json({
      success: true,
      message: `Workflow ${workflowId} deleted successfully`,
      workflowId,
      brand
    });
  } catch (error: any) {
    console.error('Error deleting workflow:', error);
    return NextResponse.json(
      { error: 'Failed to delete workflow', details: error.message },
      { status: 500 }
    );
  }
}
