import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { ExtendedSession } from '@/types/session';
import fs from 'fs';
import path from 'path';

/**
 * Get the image quality analysis report
 */
export async function GET(_request: NextRequest) {
  try {
    // Admin access control
    const session = await // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getServerSession(authOptions as any) as ExtendedSession | null;

    if (!session?.user || (session as ExtendedSession).user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Access denied. Admin access required.' },
        { status: 403 }
      );
    }

    // Check if report exists
    const reportPath = path.join(process.cwd(), 'scripts', 'image-quality-report.json');

    if (!fs.existsSync(reportPath)) {
      return NextResponse.json(
        {
          error: 'Report not found. Please run the image analysis script first.',
          reportExists: false
        },
        { status: 404 }
      );
    }

    // Read and parse the report
    const reportData = fs.readFileSync(reportPath, 'utf-8');
    const report = JSON.parse(reportData);

    return NextResponse.json({
      reportExists: true,
      report
    });

  } catch (error) {
    console.error('Failed to load image quality report:', error);
    return NextResponse.json(
      { error: 'Failed to load image quality report' },
      { status: 500 }
    );
  }
}
