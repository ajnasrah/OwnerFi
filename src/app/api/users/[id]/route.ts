import { NextRequest, NextResponse } from 'next/server';
import { getSessionWithRole } from '@/lib/auth-utils';
import { unifiedDb } from '@/lib/unified-db';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Get session to verify user is accessing their own data  
    const session = await getSessionWithRole('realtor');
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Verify user is accessing their own data
    if (session.user.id !== params.id) {
      return NextResponse.json(
        { error: 'Access denied - can only access your own data' },
        { status: 403 }
      );
    }

    // Get user data from database
    const user = await unifiedDb.users.findById(params.id);
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Return user data (excluding password)
    const { password, ...userData } = user;
    
    return NextResponse.json({
      user: userData
    });

  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user data' },
      { status: 500 }
    );
  }
}