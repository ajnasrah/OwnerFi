// Public video proxy endpoint for Metricool
// Provides permanent URLs to Firebase videos without expiration

import { NextRequest, NextResponse } from 'next/server';
import admin from 'firebase-admin';

// Initialize Firebase Admin if needed
function getFirebaseAdmin() {
  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
      storageBucket: `${process.env.FIREBASE_PROJECT_ID}.firebasestorage.app`
    });
  }
  return admin.storage();
}

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const filename = params.filename;

    // Get file from Firebase
    const storage = getFirebaseAdmin();
    const bucket = storage.bucket();
    const file = bucket.file(`podcast-videos/${filename}`);

    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    // Get file metadata
    const [metadata] = await file.getMetadata();

    // Stream the file
    const stream = file.createReadStream();
    const chunks: Uint8Array[] = [];

    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    const buffer = Buffer.concat(chunks);

    // Return video with proper headers
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': metadata.contentType || 'video/mp4',
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable', // 1 year cache
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('Error serving video:', error);
    return NextResponse.json(
      { error: 'Failed to serve video' },
      { status: 500 }
    );
  }
}

// Support HEAD requests for URL validation
export async function HEAD(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const filename = params.filename;
    const storage = getFirebaseAdmin();
    const bucket = storage.bucket();
    const file = bucket.file(`podcast-videos/${filename}`);

    const [exists] = await file.exists();
    if (!exists) {
      return new NextResponse(null, { status: 404 });
    }

    const [metadata] = await file.getMetadata();

    return new NextResponse(null, {
      status: 200,
      headers: {
        'Content-Type': metadata.contentType || 'video/mp4',
        'Content-Length': metadata.size?.toString() || '0',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });

  } catch (error) {
    return new NextResponse(null, { status: 500 });
  }
}
