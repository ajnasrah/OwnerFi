import { NextRequest, NextResponse } from 'next/server';
import { unifiedDb } from '@/lib/unified-db';
import { logError } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter is required' },
        { status: 400 }
      );
    }

    const agent = await unifiedDb.agents.findByEmail(email);
    
    if (!agent) {
      return NextResponse.json({ agent: null });
    }

    const agentData = agent;
    
    return NextResponse.json({
      agent: {
        id: agentData.id,
        firstName: agentData.firstName,
        lastName: agentData.lastName,
        email: agentData.email,
        phone: agentData.phone,
        company: agentData.company,
        licenseNumber: agentData.licenseNumber,
        serviceStates: JSON.parse(agentData.serviceStates || '[]'),
        credits: agentData.credits,
        isActive: agentData.isActive,
      }
    });

  } catch (error) {
    await logError('Failed to fetch agent profile', {
      action: 'agent_profile'
    }, error as Error);

    return NextResponse.json(
      { error: 'Failed to fetch profile', details: (error as Error).message },
      { status: 500 }
    );
  }
}