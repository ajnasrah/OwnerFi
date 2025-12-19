/**
 * HeyGen Agents Admin API
 *
 * Endpoints for managing and monitoring HeyGen agents:
 * - GET: List all agents with usage stats
 * - POST: Preview agent selection / reset usage
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  HEYGEN_AGENTS,
  getAgentsForBrand,
  getPrimaryAgentForBrand,
  getAgentsByLanguage,
  SCALE_PRESETS,
} from '@/config/heygen-agents';
import {
  selectAgent,
  getAgentStats,
  previewAgentSelection,
  resetAgentUsage,
} from '@/lib/agent-selector';
import { Brand } from '@/config/constants';

// Verify admin access
function verifyAdminAccess(request: NextRequest): boolean {
  const authHeader = request.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) return false;

  // Check Bearer token
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    return token === cronSecret;
  }

  return false;
}

/**
 * GET /api/admin/agents
 *
 * List all agents with usage statistics
 * Query params:
 * - brand: Filter by brand (default: 'benefit')
 * - language: Filter by language ('en' | 'es')
 */
export async function GET(request: NextRequest) {
  if (!verifyAdminAccess(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const brand = (searchParams.get('brand') || 'benefit') as Brand;
    const language = searchParams.get('language') as 'en' | 'es' | null;

    // Get all agents
    const allAgents = HEYGEN_AGENTS;

    // Get filtered agents
    const brandAgents = getAgentsForBrand(brand);
    const primaryAgent = getPrimaryAgentForBrand(brand);
    // const languageAgents = language ? getAgentsByLanguage(language, brand) : null;

    // Get usage stats
    const stats = await getAgentStats(brand);

    // Build response
    const response = {
      summary: {
        totalAgents: allAgents.length,
        activeAgents: allAgents.filter(a => a.isActive).length,
        agentsForBrand: brandAgents.length,
        primaryAgentId: primaryAgent?.id || null,
        scalePresets: SCALE_PRESETS,
      },
      agents: stats.usage.map(({ agent, usageCount, lastUsedAt }) => ({
        id: agent.id,
        name: agent.name,
        description: agent.description,
        isActive: agent.isActive,
        isPrimary: agent.isPrimary || false,
        avatar: {
          type: agent.avatar.avatarType,
          id: agent.avatar.avatarId,
          scale: agent.avatar.scale,
          talkingStyle: agent.avatar.talkingStyle,
        },
        voice: {
          id: agent.voice.voiceId,
          speed: agent.voice.speed,
          emotion: agent.voice.emotion,
          language: agent.voiceLanguage,
        },
        brands: agent.brands,
        usage: {
          count: usageCount,
          lastUsed: lastUsedAt ? new Date(lastUsedAt).toISOString() : null,
        },
        previewImageUrl: agent.previewImageUrl,
      })),
      filters: {
        brand,
        language,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching agents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agents', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/agents
 *
 * Actions:
 * - preview: Preview which agent would be selected
 * - reset: Reset usage counts for a brand
 * - select: Actually select an agent (for testing)
 */
export async function POST(request: NextRequest) {
  if (!verifyAdminAccess(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, brand = 'benefit', language, mode = 'round-robin' } = body;

    switch (action) {
      case 'preview': {
        const result = await previewAgentSelection(brand as Brand, {
          mode,
          language,
        });

        return NextResponse.json({
          action: 'preview',
          selectedAgent: result.selectedAgent ? {
            id: result.selectedAgent.id,
            name: result.selectedAgent.name,
          } : null,
          eligibleAgents: result.eligibleAgents.map(({ agent, usageCount }) => ({
            id: agent.id,
            name: agent.name,
            usageCount,
          })),
          reason: result.reason,
        });
      }

      case 'reset': {
        await resetAgentUsage(brand as Brand);
        return NextResponse.json({
          action: 'reset',
          brand,
          message: `Usage counts reset for brand: ${brand}`,
        });
      }

      case 'select': {
        const agent = await selectAgent(brand as Brand, {
          mode,
          language,
        });

        if (!agent) {
          return NextResponse.json({
            action: 'select',
            error: 'No eligible agents found',
          }, { status: 404 });
        }

        return NextResponse.json({
          action: 'select',
          selectedAgent: {
            id: agent.id,
            name: agent.name,
            avatar: agent.avatar,
            voice: agent.voice,
          },
          message: 'Agent selected and usage incremented',
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}. Valid actions: preview, reset, select` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error processing agent action:', error);
    return NextResponse.json(
      { error: 'Failed to process action', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
