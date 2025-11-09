import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { deleteDoc, doc } from 'firebase/firestore';

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workflowId = searchParams.get('workflowId');
    const brand = searchParams.get('brand');

    console.log('Delete workflow request:', { workflowId, brand });

    if (!workflowId || !brand) {
      return NextResponse.json(
        { error: 'Missing workflowId or brand parameter' },
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

    // Map brand to collection name
    const collectionMap: Record<string, string> = {
      'carz': 'carz_workflow_queue',
      'ownerfi': 'ownerfi_workflow_queue',
      'podcast': 'podcast_workflow_queue',
      'benefit': 'benefit_workflow_queue',
      'property': 'property_videos',
      'vassdistro': 'vassdistro_workflow_queue',
      'abdullah': 'abdullah_workflow_queue',
    };

    const collectionName = collectionMap[brand];

    if (!collectionName) {
      return NextResponse.json(
        { error: `Invalid brand: "${brand}". Must be one of: carz, ownerfi, podcast, benefit, property, vassdistro, abdullah` },
        { status: 400 }
      );
    }

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
