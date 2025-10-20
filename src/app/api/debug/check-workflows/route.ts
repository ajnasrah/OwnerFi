// Debug endpoint to check workflow statuses
// Use this to see what's actually in Firestore

import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  try {
    const { db } = await import('@/lib/firebase');
    const { collection, getDocs, query, where, orderBy, limit } = await import('firebase/firestore');
    const { getCollectionName } = await import('@/lib/feed-store-firestore');

    if (!db) {
      return NextResponse.json({ error: 'Firebase not initialized' }, { status: 500 });
    }

    const results: any = {
      carz: {
        submagic_processing: [],
        posting: [],
        all_recent: []
      },
      ownerfi: {
        submagic_processing: [],
        posting: [],
        all_recent: []
      },
      podcast: {
        submagic_processing: [],
        publishing: [],
        all_recent: []
      }
    };

    // Check Carz workflows
    console.log('Checking Carz workflows...');
    const carzCollection = getCollectionName('WORKFLOW_QUEUE', 'carz');

    // Get stuck in submagic_processing
    const carzSubmagicQuery = query(
      collection(db, carzCollection),
      where('status', '==', 'submagic_processing')
    );
    const carzSubmagicSnap = await getDocs(carzSubmagicQuery);
    carzSubmagicSnap.forEach(doc => {
      const data = doc.data();
      results.carz.submagic_processing.push({
        id: doc.id,
        status: data.status,
        articleTitle: data.articleTitle,
        submagicVideoId: data.submagicVideoId,
        updatedAt: data.updatedAt,
        stuckMinutes: Math.round((Date.now() - (data.updatedAt || 0)) / 60000)
      });
    });

    // Get stuck in posting
    const carzPostingQuery = query(
      collection(db, carzCollection),
      where('status', '==', 'posting')
    );
    const carzPostingSnap = await getDocs(carzPostingQuery);
    carzPostingSnap.forEach(doc => {
      const data = doc.data();
      results.carz.posting.push({
        id: doc.id,
        status: data.status,
        articleTitle: data.articleTitle,
        finalVideoUrl: data.finalVideoUrl,
        updatedAt: data.updatedAt,
        stuckMinutes: Math.round((Date.now() - (data.updatedAt || 0)) / 60000)
      });
    });

    // Get all recent (last 10)
    const carzRecentQuery = query(
      collection(db, carzCollection),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
    const carzRecentSnap = await getDocs(carzRecentQuery);
    carzRecentSnap.forEach(doc => {
      const data = doc.data();
      results.carz.all_recent.push({
        id: doc.id,
        status: data.status,
        articleTitle: data.articleTitle?.substring(0, 50),
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        ageMinutes: Math.round((Date.now() - (data.createdAt || 0)) / 60000)
      });
    });

    // Check OwnerFi workflows
    console.log('Checking OwnerFi workflows...');
    const ownerfiCollection = getCollectionName('WORKFLOW_QUEUE', 'ownerfi');

    // Get stuck in submagic_processing
    const ownerfiSubmagicQuery = query(
      collection(db, ownerfiCollection),
      where('status', '==', 'submagic_processing')
    );
    const ownerfiSubmagicSnap = await getDocs(ownerfiSubmagicQuery);
    ownerfiSubmagicSnap.forEach(doc => {
      const data = doc.data();
      results.ownerfi.submagic_processing.push({
        id: doc.id,
        status: data.status,
        articleTitle: data.articleTitle,
        submagicVideoId: data.submagicVideoId,
        updatedAt: data.updatedAt,
        stuckMinutes: Math.round((Date.now() - (data.updatedAt || 0)) / 60000)
      });
    });

    // Get stuck in posting
    const ownerfiPostingQuery = query(
      collection(db, ownerfiCollection),
      where('status', '==', 'posting')
    );
    const ownerfiPostingSnap = await getDocs(ownerfiPostingQuery);
    ownerfiPostingSnap.forEach(doc => {
      const data = doc.data();
      results.ownerfi.posting.push({
        id: doc.id,
        status: data.status,
        articleTitle: data.articleTitle,
        finalVideoUrl: data.finalVideoUrl,
        updatedAt: data.updatedAt,
        stuckMinutes: Math.round((Date.now() - (data.updatedAt || 0)) / 60000)
      });
    });

    // Get all recent (last 10)
    const ownerfiRecentQuery = query(
      collection(db, ownerfiCollection),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
    const ownerfiRecentSnap = await getDocs(ownerfiRecentQuery);
    ownerfiRecentSnap.forEach(doc => {
      const data = doc.data();
      results.ownerfi.all_recent.push({
        id: doc.id,
        status: data.status,
        articleTitle: data.articleTitle?.substring(0, 50),
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        ageMinutes: Math.round((Date.now() - (data.createdAt || 0)) / 60000)
      });
    });

    // Check Podcast workflows
    console.log('Checking Podcast workflows...');

    // Get stuck in submagic_processing
    const podcastSubmagicQuery = query(
      collection(db, 'podcast_workflow_queue'),
      where('status', '==', 'submagic_processing')
    );
    const podcastSubmagicSnap = await getDocs(podcastSubmagicQuery);
    podcastSubmagicSnap.forEach(doc => {
      const data = doc.data();
      results.podcast.submagic_processing.push({
        id: doc.id,
        status: data.status,
        episodeTitle: data.episodeTitle,
        submagicProjectId: data.submagicProjectId,
        updatedAt: data.updatedAt,
        stuckMinutes: Math.round((Date.now() - (data.updatedAt || 0)) / 60000)
      });
    });

    // Get stuck in publishing
    const podcastPublishingQuery = query(
      collection(db, 'podcast_workflow_queue'),
      where('status', '==', 'publishing')
    );
    const podcastPublishingSnap = await getDocs(podcastPublishingQuery);
    podcastPublishingSnap.forEach(doc => {
      const data = doc.data();
      results.podcast.publishing.push({
        id: doc.id,
        status: data.status,
        episodeTitle: data.episodeTitle,
        finalVideoUrl: data.finalVideoUrl,
        updatedAt: data.updatedAt,
        stuckMinutes: Math.round((Date.now() - (data.updatedAt || 0)) / 60000)
      });
    });

    // Get all recent (last 10)
    const podcastRecentQuery = query(
      collection(db, 'podcast_workflow_queue'),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
    const podcastRecentSnap = await getDocs(podcastRecentQuery);
    podcastRecentSnap.forEach(doc => {
      const data = doc.data();
      results.podcast.all_recent.push({
        id: doc.id,
        status: data.status,
        episodeTitle: data.episodeTitle?.substring(0, 50),
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        ageMinutes: Math.round((Date.now() - (data.createdAt || 0)) / 60000)
      });
    });

    // Summary counts
    const summary = {
      carz: {
        submagic_processing: results.carz.submagic_processing.length,
        posting: results.carz.posting.length,
        total_recent: results.carz.all_recent.length
      },
      ownerfi: {
        submagic_processing: results.ownerfi.submagic_processing.length,
        posting: results.ownerfi.posting.length,
        total_recent: results.ownerfi.all_recent.length
      },
      podcast: {
        submagic_processing: results.podcast.submagic_processing.length,
        publishing: results.podcast.publishing.length,
        total_recent: results.podcast.all_recent.length
      }
    };

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary,
      details: results
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('Error checking workflows:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
