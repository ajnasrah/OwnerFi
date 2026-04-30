import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/scraper-v2/firebase-admin';

/**
 * Delete properties from specific zip codes (except protected ones)
 * POST /api/admin/delete-zip-properties
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const adminSecret = process.env.ADMIN_SECRET_KEY || process.env.CRON_SECRET;

  if (!adminSecret || authHeader !== `Bearer ${adminSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { zipCodes, protectedZips = [] } = body;

    if (!zipCodes || !Array.isArray(zipCodes)) {
      return NextResponse.json({ error: 'zipCodes array required' }, { status: 400 });
    }

    console.log(`DELETE ZIP PROPERTIES: Deleting properties from ${zipCodes.length} zip codes`);
    console.log('Protected zips (will not delete):', protectedZips);

    const { db } = getFirebaseAdmin();
    const batch = db.batch();
    
    let deleted = 0;
    let protectedCount = 0;
    let agentOutreachDeleted = 0;

    // Delete from main properties collection
    for (const zipCode of zipCodes) {
      if (protectedZips.includes(zipCode)) {
        protectedCount++;
        continue;
      }

      // Find properties in this zip code
      const propertiesQuery = await db.collection('properties')
        .where('zipcode', '==', zipCode)
        .get();

      console.log(`Zip ${zipCode}: Found ${propertiesQuery.size} properties to delete`);

      propertiesQuery.docs.forEach(doc => {
        batch.delete(doc.ref);
        deleted++;
      });

      // Delete from agent outreach queue too
      const zpids = propertiesQuery.docs.map(doc => doc.data().zpid).filter(zpid => zpid);
      let agentQuery;
      if (zpids.length > 0) {
        agentQuery = await db.collection('agent_outreach_queue')
          .where('zpid', 'in', zpids.slice(0, 10)) // Firestore 'in' limit is 10
          .get();
      } else {
        agentQuery = { docs: [] };
      }

      agentQuery.docs.forEach(doc => {
        batch.delete(doc.ref);
        agentOutreachDeleted++;
      });

      // Commit every 400 operations to avoid batch limits
      if (deleted % 400 === 0 && deleted > 0) {
        await batch.commit();
      }
    }

    // Commit remaining deletions
    if (deleted % 400 !== 0) {
      await batch.commit();
    }

    console.log(`DELETE COMPLETE: ${deleted} properties deleted, ${protectedCount} zips protected, ${agentOutreachDeleted} agent queue items deleted`);

    return NextResponse.json({
      success: true,
      deleted,
      protectedZips: protectedCount,
      agentOutreachDeleted,
      message: `Deleted ${deleted} properties from ${zipCodes.length - protectedCount} zip codes`
    });

  } catch (error: any) {
    console.error('Delete zip properties error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}