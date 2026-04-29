import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { AgentDataService } from '@/lib/agents/agent-data-service';
import { AgentFirestoreService, AgentProfile } from '@/lib/agents/agent-firestore';

/**
 * Sync agent data from external sources
 * POST /api/agents/sync
 * 
 * Admin only - fetches agent data from Zillow/Realtor and stores in Firestore
 */
export async function POST(request: NextRequest) {
  try {
    // Check admin auth
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const { city, state, radius = 10 } = body;
    
    if (!city || !state) {
      return NextResponse.json(
        { error: 'City and state are required' },
        { status: 400 }
      );
    }
    
    console.log(`[Agent Sync] Starting sync for ${city}, ${state}`);
    
    // Initialize services
    const agentDataService = new AgentDataService();
    const firestoreService = new AgentFirestoreService();
    
    // Fetch agents from external sources
    const externalAgents = await agentDataService.fetchAgentsByLocation(
      city,
      state,
      radius
    );
    
    console.log(`[Agent Sync] Found ${externalAgents.length} agents from external sources`);
    
    // Transform and save to Firestore
    const savedAgents: string[] = [];
    const errors: string[] = [];
    
    for (const agent of externalAgents) {
      try {
        // Transform to our schema
        const agentProfile: Partial<AgentProfile> = {
          id: agent.id,
          name: agent.name,
          photo: agent.photo,
          licenseNumber: agent.licenseNumber,
          licenseState: agent.state,
          brokerageName: agent.brokerageName,
          phone: agent.phone,
          email: agent.email,
          website: agent.website,
          city: agent.city,
          state: agent.state,
          zipCode: agent.zipCode,
          serviceAreas: agent.serviceAreas || [],
          specializations: [], // Will be enriched later
          languages: ['English'], // Default, will be enriched later
          averageRating: agent.averageRating || 0,
          totalReviews: agent.totalReviews || 0,
          ratingsBreakdown: {
            5: 0,
            4: 0,
            3: 0,
            2: 0,
            1: 0,
          },
          recentSales: agent.recentSales || 0,
          yearsExperience: agent.yearsExperience || 0,
          responseTimeHours: 24, // Default
          successRate: 0, // Will be calculated from platform data
          
          // Store external ratings
          ...(agent.source === 'zillow' && {
            zillowRating: agent.averageRating,
            zillowReviews: agent.totalReviews,
          }),
          ...(agent.source === 'realtor' && {
            realtorRating: agent.averageRating,
            realtorReviews: agent.totalReviews,
          }),
          
          // Platform defaults
          leadsReceived: 0,
          dealsCompleted: 0,
          totalEarnings: 0,
          
          // Status
          isActive: true,
          isVerified: false, // Will verify license later
          isPremium: false,
          isFeatured: false,
          
          // Metadata
          createdAt: new Date(),
          updatedAt: new Date(),
          lastScrapedAt: new Date(),
        };
        
        // Save to Firestore
        await firestoreService.upsertAgentProfile(agentProfile);
        savedAgents.push(agent.id);
        
        // If Zillow agent, try to fetch reviews
        if (agent.source === 'zillow' && agent.sourceUrl) {
          try {
            const zillowId = agent.sourceUrl.split('/').pop();
            if (zillowId) {
              const reviews = await agentDataService.fetchAgentReviews(zillowId);
              console.log(`[Agent Sync] Fetched ${reviews.length} reviews for ${agent.name}`);
              // Store reviews (implement if needed)
            }
          } catch (reviewError) {
            console.error(`[Agent Sync] Error fetching reviews for ${agent.name}:`, reviewError);
          }
        }
      } catch (error) {
        console.error(`[Agent Sync] Error saving agent ${agent.name}:`, error);
        errors.push(`${agent.name}: ${error}`);
      }
    }
    
    console.log(`[Agent Sync] Successfully saved ${savedAgents.length} agents`);
    
    return NextResponse.json({
      success: true,
      message: `Synced ${savedAgents.length} agents for ${city}, ${state}`,
      savedCount: savedAgents.length,
      errorCount: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    });
    
  } catch (error) {
    console.error('[Agent Sync] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to sync agent data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}