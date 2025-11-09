import { NextRequest, NextResponse } from 'next/server';
import { getDocs, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;

interface SyncStatus {
  timestamp: string;
  ghlTotal: number;
  firestoreTotal: number;
  difference: number;
  byStage: {
    stage: string;
    count: number;
    shouldBeInFirestore: boolean;
  }[];
  critical: {
    exportedToWebsiteMissing: number;
    availableMissing: number;
  };
  issues: string[];
  recommendations: string[];
}

/**
 * Monitor GHL → Firestore sync status
 * GET /api/admin/monitor-ghl-sync
 */
export async function GET(request: NextRequest) {
  try {
    if (!GHL_API_KEY || !GHL_LOCATION_ID) {
      return NextResponse.json(
        { error: 'GHL credentials not configured' },
        { status: 500 }
      );
    }

    console.log('📊 Fetching GHL opportunities...');

    // Fetch all opportunities from GHL
    const ghlResponse = await fetch(
      `https://services.leadconnectorhq.com/opportunities/search?location_id=${GHL_LOCATION_ID}&limit=1000`,
      {
        headers: {
          'Authorization': `Bearer ${GHL_API_KEY}`,
          'Version': '2021-07-28'
        }
      }
    );

    if (!ghlResponse.ok) {
      throw new Error(`GHL API error: ${ghlResponse.status}`);
    }

    const ghlData = await ghlResponse.json();
    const ghlOpportunities = ghlData.opportunities || [];

    console.log(`📊 Found ${ghlOpportunities.length} opportunities in GHL`);

    // Fetch all properties from Firestore
    const propertiesSnapshot = await getDocs(collection(db, 'properties'));
    const firestoreProperties = propertiesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`📊 Found ${firestoreProperties.length} properties in Firestore`);

    // Create maps for comparison
    const ghlOpportunityIds = new Set(ghlOpportunities.map((op: any) => op.id));
    const firestorePropertyIds = new Set(firestoreProperties.map(p => p.id));

    // Analyze by stage
    const stageBreakdown = new Map<string, number>();
    const exportedToWebsiteMissing: any[] = [];

    ghlOpportunities.forEach((opp: any) => {
      const stage = opp.stage?.name || 'unknown';
      stageBreakdown.set(stage, (stageBreakdown.get(stage) || 0) + 1);

      // ONLY "exported to website" should be in Firestore
      // "available" is an internal GHL stage and should NOT be synced
      if (!firestorePropertyIds.has(opp.id)) {
        if (stage === 'exported to website') {
          exportedToWebsiteMissing.push(opp);
        }
      }
    });

    // Build status report
    const byStage = Array.from(stageBreakdown.entries()).map(([stage, count]) => ({
      stage,
      count,
      shouldBeInFirestore: stage === 'exported to website' // ONLY this stage should sync
    })).sort((a, b) => b.count - a.count);

    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check for critical issues
    if (exportedToWebsiteMissing.length > 0) {
      issues.push(`🚨 CRITICAL: ${exportedToWebsiteMissing.length} properties marked "exported to website" but NOT in Firestore`);
      recommendations.push(`Trigger webhook for these ${exportedToWebsiteMissing.length} "exported to website" properties immediately`);
      recommendations.push(`Check GHL workflow configuration for "exported to website" stage`);
      recommendations.push(`Review webhook logs for failures during stage transitions`);
    }

    // Check for properties in Firestore but not in GHL
    const orphanedProperties = firestoreProperties.filter(p => !ghlOpportunityIds.has(p.id));
    if (orphanedProperties.length > 0) {
      issues.push(`${orphanedProperties.length} properties in Firestore but NOT in GHL (possibly deleted)`);
      recommendations.push(`Review and potentially archive ${orphanedProperties.length} orphaned properties`);
    }

    const status: SyncStatus = {
      timestamp: new Date().toISOString(),
      ghlTotal: ghlOpportunities.length,
      firestoreTotal: firestoreProperties.length,
      difference: ghlOpportunities.length - firestoreProperties.length,
      byStage,
      critical: {
        exportedToWebsiteMissing: exportedToWebsiteMissing.length
      },
      issues,
      recommendations
    };

    return NextResponse.json({
      success: true,
      status,
      details: {
        exportedToWebsiteMissing: exportedToWebsiteMissing.slice(0, 20).map((opp: any) => ({
          id: opp.id,
          name: opp.name,
          stage: opp.stage?.name,
          monetaryValue: opp.monetaryValue
        })),
        orphanedProperties: orphanedProperties.slice(0, 10).map(p => ({
          id: p.id,
          address: p.address,
          source: p.source
        }))
      }
    });

  } catch (error) {
    console.error('Error monitoring GHL sync:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to monitor GHL sync',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
