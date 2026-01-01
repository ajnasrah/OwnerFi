// Real-time Workflow Logs API
// Returns all active workflows with their current status

import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, limit as firestoreLimit } from 'firebase/firestore';

const COLLECTIONS = {
  CARZ: 'carz_workflow_queue',
  OWNERFI: 'ownerfi_workflow_queue',
  BENEFIT: 'benefit_workflow_queue',
  ABDULLAH: 'abdullah_workflow_queue',
  PERSONAL: 'personal_workflow_queue',
  GAZA: 'gaza_workflow_queue',
};

export async function GET(request: Request) {
  try {
    if (!db) {
      return NextResponse.json({ error: 'Firebase not initialized' }, { status: 500 });
    }

    // Parse URL to check for history query param
    const { searchParams } = new URL(request.url);
    const includeHistory = searchParams.get('history') === 'true';

    // Fetch workflows by createdAt only (no index needed), then filter in memory
    const fetchLimit = includeHistory ? 50 : 100; // Get more if filtering for active

    const [carzSnapshot, ownerfiSnapshot, benefitSnapshot, abdullahSnapshot, personalSnapshot, gazaSnapshot] = await Promise.all([
      getDocs(query(collection(db, COLLECTIONS.CARZ), orderBy('createdAt', 'desc'), firestoreLimit(fetchLimit))),
      getDocs(query(collection(db, COLLECTIONS.OWNERFI), orderBy('createdAt', 'desc'), firestoreLimit(fetchLimit))),
      getDocs(query(collection(db, COLLECTIONS.BENEFIT), orderBy('createdAt', 'desc'), firestoreLimit(fetchLimit))),
      getDocs(query(collection(db, COLLECTIONS.ABDULLAH), orderBy('createdAt', 'desc'), firestoreLimit(fetchLimit))),
      getDocs(query(collection(db, COLLECTIONS.PERSONAL), orderBy('createdAt', 'desc'), firestoreLimit(fetchLimit))),
      getDocs(query(collection(db, COLLECTIONS.GAZA), orderBy('createdAt', 'desc'), firestoreLimit(fetchLimit)))
    ]);

    // Filter in memory if showing active only (avoids composite index requirement)
    const activeStatuses = ['pending', 'heygen_processing', 'submagic_processing', 'posting'];

    const filterWorkflows = (snapshot: any) => {
      let docs = snapshot.docs;
      if (!includeHistory) {
        docs = docs.filter((doc: Record<string, unknown>) => activeStatuses.includes(doc.data().status)).slice(0, 20);
      }
      return docs.map((doc: Record<string, unknown>) => ({ id: doc.id, ...doc.data() }));
    };

    const carzWorkflows = filterWorkflows(carzSnapshot);
    const ownerfiWorkflows = filterWorkflows(ownerfiSnapshot);
    const benefitWorkflows = filterWorkflows(benefitSnapshot);
    const abdullahWorkflows = filterWorkflows(abdullahSnapshot);
    const personalWorkflows = filterWorkflows(personalSnapshot);
    const gazaWorkflows = filterWorkflows(gazaSnapshot);

    return NextResponse.json({
      success: true,
      workflows: {
        carz: carzWorkflows,
        ownerfi: ownerfiWorkflows,
        benefit: benefitWorkflows,
        abdullah: abdullahWorkflows,
        personal: personalWorkflows,
        gaza: gazaWorkflows
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching workflow logs:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
