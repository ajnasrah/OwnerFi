import { NextRequest, NextResponse } from 'next/server';
import { unifiedDb } from '@/lib/unified-db';
import { logError, logInfo } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      firstName,
      lastName,
      email,
      phone,
      company,
      licenseNumber,
      serviceStates
    } = body;

    // Validate required fields
    if (!firstName || !lastName || !email || !serviceStates || serviceStates.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    await logInfo('Starting agent registration', {
      action: 'agent_register',
      metadata: { 
        email,
        serviceStates,
        company
      }
    });

    // Check if agent already exists
    const existingAgent = await unifiedDb.agents.findByEmail(email);
    
    let agent;
    
    if (existingAgent) {
      // Update existing agent
      await unifiedDb.agents.update(existingAgent.id, {
        firstName,
        lastName,
        phone: phone || null,
        company: company || null,
        licenseNumber: licenseNumber || null,
        serviceStates: JSON.stringify(serviceStates),
        isActive: true
      });

      agent = await unifiedDb.agents.findById(existingAgent.id);

      await logInfo('Updated existing agent', {
        action: 'agent_update',
        userId: existingAgent.id,
        userType: 'agent'
      });
    } else {
      // Create new agent
      agent = await unifiedDb.agents.create({
        email,
        firstName,
        lastName,
        phone: phone || null,
        company: company || null,
        licenseNumber: licenseNumber || null,
        serviceStates: JSON.stringify(serviceStates),
        serviceCities: null, // Can be expanded later
        isActive: true,
        credits: 5, // Give new agents 5 free credits
      });

      await logInfo('Created new agent', {
        action: 'agent_create',
        userId: agent.id,
        userType: 'agent'
      });
    }

    return NextResponse.json({
      success: true,
      agent: {
        id: agent.id,
        firstName: agent.firstName,
        lastName: agent.lastName,
        email: agent.email,
        phone: agent.phone,
        company: agent.company,
        licenseNumber: agent.licenseNumber,
        serviceStates: JSON.parse(agent.serviceStates || '[]'),
        credits: agent.credits,
        isActive: agent.isActive,
      }
    });

  } catch (error) {
    await logError('Agent registration failed', {
      action: 'agent_register'
    }, error as Error);

    return NextResponse.json(
      { error: 'Registration failed', details: (error as Error).message },
      { status: 500 }
    );
  }
}