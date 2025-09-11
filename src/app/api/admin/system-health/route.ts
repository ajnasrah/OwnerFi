import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { ExtendedSession } from '@/types/session';

// GET - Run system health check
export async function GET(request: NextRequest) {
  try {
    // Check if user is admin (basic check)
    const session = await getServerSession(authOptions) as any;
    
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

// POST - Run database cleanup
export async function POST(request: NextRequest) {
  try {
    // Check if user is admin
    const session = await getServerSession(authOptions) as any;
    
    if (!session?.user || (session as ExtendedSession).user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action } = body;

    const { DatabaseCleanup } = await import('@/lib/database-cleanup');
    
    let results;
    
    switch (action) {
      case 'remove_duplicates':
        results = await DatabaseCleanup.removeDuplicateBuyers();
        break;
      case 'cleanup_orphaned':
        results = await DatabaseCleanup.cleanupOrphanedLeadPurchases();
        break;
      case 'fix_profiles':
        results = await DatabaseCleanup.fixIncompleteProfiles();
        break;
      case 'remove_test_data':
        results = await DatabaseCleanup.removeTestData();
        break;
      case 'comprehensive':
        results = await DatabaseCleanup.runComprehensiveCleanup();
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid cleanup action' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      data: results
    });

  } catch (error) {
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Database cleanup failed',
        details: (error as Error).message
      },
      { status: 500 }
    );
  }
}