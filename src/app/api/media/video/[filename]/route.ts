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
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;

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
    const fileSize = parseInt(metadata.size || '0');

    // SECURITY: Limit file size to prevent memory exhaustion (500MB max)
    const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
    if (fileSize > MAX_FILE_SIZE) {
      console.error(`Video too large: ${fileSize} bytes (max ${MAX_FILE_SIZE})`);
      return NextResponse.json(
        { error: 'Video file too large' },
        { status: 413 }
      );
    }

    // Stream the file directly using ReadableStream to avoid memory issues
    const nodeStream = file.createReadStream();

    // Convert Node.js stream to Web ReadableStream for efficient streaming
    const webStream = new ReadableStream({
      start(controller) {
        nodeStream.on('data', (chunk: Buffer) => {
          controller.enqueue(new Uint8Array(chunk));
        });
        nodeStream.on('end', () => {
          controller.close();
        });
        nodeStream.on('error', (err) => {
          controller.error(err);
        });
      },
      cancel() {
        nodeStream.destroy();
      }
    });

    // Return video with proper headers using streaming response
    return new NextResponse(webStream, {
      status: 200,
      headers: {
        'Content-Type': metadata.contentType || 'video/mp4',
        'Content-Length': fileSize.toString(),
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
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
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
