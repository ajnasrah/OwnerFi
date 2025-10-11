// Redis-based workflow state management (PRODUCTION-READY)
// Use this instead of in-memory store for production

import { WorkflowState } from './workflow-store';
import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL;
const USE_REDIS = process.env.USE_REDIS === 'true' && REDIS_URL;

let redis: Redis | null = null;

if (USE_REDIS) {
  try {
    redis = new Redis(REDIS_URL);
    console.log('✅ Redis workflow store initialized');
  } catch (error) {
    console.error('❌ Failed to initialize Redis:', error);
    console.log('Falling back to in-memory store');
  }
}

const WORKFLOW_TTL = 10800; // 3 hours in seconds

/**
 * Create a workflow in Redis
 */
export async function createWorkflow(id: string, data: Partial<WorkflowState>): Promise<WorkflowState> {
  const workflow: WorkflowState = {
    videoId: data.videoId || '',
    script: data.script || '',
    status: 'heygen_pending',
    createdAt: Date.now(),
    ...data
  };

  if (redis) {
    try {
      // Store workflow data
      await redis.setex(
        `workflow:${id}`,
        WORKFLOW_TTL,
        JSON.stringify(workflow)
      );

      // Create index by video ID
      if (workflow.videoId) {
        await redis.setex(
          `workflow:video:${workflow.videoId}`,
          WORKFLOW_TTL,
          id
        );
      }

      // Add to status set
      await redis.sadd(`workflows:status:${workflow.status}`, id);
      await redis.expire(`workflows:status:${workflow.status}`, WORKFLOW_TTL);

      console.log('📝 Created workflow in Redis:', id);
    } catch (error) {
      console.error('Redis write error:', error);
      throw error;
    }
  }

  return workflow;
}

/**
 * Get a workflow from Redis
 */
export async function getWorkflow(id: string): Promise<WorkflowState | undefined> {
  if (redis) {
    try {
      const data = await redis.get(`workflow:${id}`);
      return data ? JSON.parse(data) : undefined;
    } catch (error) {
      console.error('Redis read error:', error);
      return undefined;
    }
  }

  return undefined;
}

/**
 * Find workflow by video ID
 */
export async function findWorkflowByVideoId(
  videoId: string
): Promise<{ id: string; workflow: WorkflowState } | undefined> {
  if (redis) {
    try {
      const workflowId = await redis.get(`workflow:video:${videoId}`);
      if (!workflowId) return undefined;

      const workflow = await getWorkflow(workflowId);
      if (!workflow) return undefined;

      return { id: workflowId, workflow };
    } catch (error) {
      console.error('Redis find error:', error);
      return undefined;
    }
  }

  return undefined;
}

/**
 * Find workflow by Submagic project ID
 */
export async function findWorkflowBySubmagicId(
  projectId: string
): Promise<{ id: string; workflow: WorkflowState } | undefined> {
  if (redis) {
    try {
      const workflowId = await redis.get(`workflow:submagic:${projectId}`);
      if (!workflowId) return undefined;

      const workflow = await getWorkflow(workflowId);
      if (!workflow) return undefined;

      return { id: workflowId, workflow };
    } catch (error) {
      console.error('Redis find error:', error);
      return undefined;
    }
  }

  return undefined;
}

/**
 * Update a workflow in Redis
 */
export async function updateWorkflow(
  id: string,
  updates: Partial<WorkflowState>
): Promise<WorkflowState | undefined> {
  if (redis) {
    try {
      const workflow = await getWorkflow(id);
      if (!workflow) return undefined;

      const updated = { ...workflow, ...updates };

      // Update main workflow data
      await redis.setex(
        `workflow:${id}`,
        WORKFLOW_TTL,
        JSON.stringify(updated)
      );

      // Update Submagic index if needed
      if (updates.submagicProjectId) {
        await redis.setex(
          `workflow:submagic:${updates.submagicProjectId}`,
          WORKFLOW_TTL,
          id
        );
      }

      // Update status set if status changed
      if (updates.status && updates.status !== workflow.status) {
        await redis.srem(`workflows:status:${workflow.status}`, id);
        await redis.sadd(`workflows:status:${updates.status}`, id);
        await redis.expire(`workflows:status:${updates.status}`, WORKFLOW_TTL);
      }

      console.log('📝 Updated workflow in Redis:', id, updates);
      return updated;
    } catch (error) {
      console.error('Redis update error:', error);
      return undefined;
    }
  }

  return undefined;
}

/**
 * Delete a workflow from Redis
 */
export async function deleteWorkflow(id: string): Promise<boolean> {
  if (redis) {
    try {
      const workflow = await getWorkflow(id);
      if (!workflow) return false;

      // Delete main data
      await redis.del(`workflow:${id}`);

      // Delete indexes
      if (workflow.videoId) {
        await redis.del(`workflow:video:${workflow.videoId}`);
      }
      if (workflow.submagicProjectId) {
        await redis.del(`workflow:submagic:${workflow.submagicProjectId}`);
      }

      // Remove from status set
      await redis.srem(`workflows:status:${workflow.status}`, id);

      console.log('🗑️ Deleted workflow from Redis:', id);
      return true;
    } catch (error) {
      console.error('Redis delete error:', error);
      return false;
    }
  }

  return false;
}

/**
 * Get all workflows by status
 */
export async function getWorkflowsByStatus(status: WorkflowState['status']): Promise<WorkflowState[]> {
  if (redis) {
    try {
      const ids = await redis.smembers(`workflows:status:${status}`);
      const workflows: WorkflowState[] = [];

      for (const id of ids) {
        const workflow = await getWorkflow(id);
        if (workflow) {
          workflows.push(workflow);
        }
      }

      return workflows;
    } catch (error) {
      console.error('Redis query error:', error);
      return [];
    }
  }

  return [];
}

/**
 * Get workflow stats
 */
export async function getWorkflowStats(): Promise<{
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}> {
  if (redis) {
    try {
      const [pending, heygenComplete, submagicPending, completed, failed] = await Promise.all([
        redis.scard('workflows:status:heygen_pending'),
        redis.scard('workflows:status:heygen_complete'),
        redis.scard('workflows:status:submagic_pending'),
        redis.scard('workflows:status:complete'),
        redis.scard('workflows:status:failed'),
      ]);

      return {
        pending: pending + heygenComplete,
        processing: submagicPending,
        completed,
        failed,
      };
    } catch (error) {
      console.error('Redis stats error:', error);
      return { pending: 0, processing: 0, completed: 0, failed: 0 };
    }
  }

  return { pending: 0, processing: 0, completed: 0, failed: 0 };
}

// Export Redis instance for advanced use cases
export { redis };
