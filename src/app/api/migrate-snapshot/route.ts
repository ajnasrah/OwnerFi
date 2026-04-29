import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/scraper-v2/firebase-admin';

export async function POST(request: NextRequest) {
  console.log('MIGRATING: Moving snapshot properties to main properties collection for agent outreach');
  
  try {
    const { db } = getFirebaseAdmin();
    
    // Read all properties from snapshot collection
    const snapshotCollection = db.collection('all_properties_snapshot');
    const snapshotDocs = await snapshotCollection.get();
    
    const mainCollection = db.collection('properties');
    const batch = db.batch();
    
    let migrated = 0;
    let skipped = 0;
    
    for (const doc of snapshotDocs.docs) {
      // Skip metadata document
      if (doc.id === '_metadata') continue;
      
      const propertyData = doc.data();
      
      // Check if property already exists in main collection
      const existingDoc = await mainCollection.doc(doc.id).get();
      if (existingDoc.exists) {
        skipped++;
        continue;
      }
      
      // Add to main properties collection with agent outreach fields
      batch.set(mainCollection.doc(doc.id), {
        ...propertyData,
        addedToAgentOutreach: false,
        migratedFromSnapshot: true,
        migratedAt: new Date().toISOString()
      });
      
      migrated++;
      
      // Commit in batches
      if (migrated % 400 === 0) {
        await batch.commit();
      }
    }
    
    // Commit remaining
    if (migrated % 400 !== 0) {
      await batch.commit();
    }
    
    console.log(`Migration complete: ${migrated} properties migrated, ${skipped} skipped`);
    
    return NextResponse.json({
      success: true,
      migrated,
      skipped,
      message: `Successfully migrated ${migrated} properties to main collection for agent outreach`
    });
    
  } catch (error: any) {
    console.error('Migration error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}