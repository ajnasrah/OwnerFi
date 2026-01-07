import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { ExtendedSession } from '@/types/session';

// GET - Run system health check
export async function GET() {
  try {
    // Check if user is admin (basic check)
    const session = await // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getServerSession(authOptions as any) as ExtendedSession | null;
    
    if (!session?.user || (session as ExtendedSession).user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const { SystemValidator } = await import('@/lib/system-validator');
    const healthReport = await SystemValidator.runSystemHealthCheck();

    return NextResponse.json({
      success: true,
      data: healthReport
    });

  } catch (error) {
    
    return NextResponse.json(
      { 
        success: false,
        error: 'System health check failed',
        details: (error as Error).message
      },
      { status: 500 }
    );
  }
}

// POST - Database cleanup (deprecated - module removed)
export async function POST(_request: NextRequest) {
  return NextResponse.json(
    { error: 'Database cleanup endpoint has been deprecated' },
    { status: 410 }
  );
}