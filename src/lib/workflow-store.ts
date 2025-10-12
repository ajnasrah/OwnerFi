// Shared workflow state management
// In production, replace with Redis, PostgreSQL, or another persistent store

export interface WorkflowState {
  videoId: string;
  videoUrl?: string;
  submagicProjectId?: string;
  finalVideoUrl?: string;
  status: 'heygen_pending' | 'heygen_complete' | 'submagic_pending' | 'complete' | 'failed';
  script: string;
  createdAt: number;
  error?: string;
  // Content metadata
  title?: string;
  caption?: string;
  hashtags?: string[];
  // Metricool integration
  metricoolPostId?: string;
  metricoolPlatforms?: string[];
  metricoolPosted?: boolean;
}

// In-memory store (for development)
// In production, use Redis with TTL for automatic cleanup
const workflowStore = new Map<string, WorkflowState>();

// Auto-cleanup old workflows after 1 hour
const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
const WORKFLOW_TTL = 60 * 60 * 1000; // 1 hour

setInterval(() => {
  const now = Date.now();
  for (const [id, workflow] of workflowStore.entries()) {
    if (now - workflow.createdAt > WORKFLOW_TTL) {
      console.log('🧹 Cleaning up old workflow:', id);
      workflowStore.delete(id);
    }
  }
}, CLEANUP_INTERVAL);

export function createWorkflow(id: string, data: Partial<WorkflowState>): WorkflowState {
  const workflow: WorkflowState = {
    videoId: data.videoId || '',
    script: data.script || '',
    status: 'heygen_pending',
    createdAt: Date.now(),
    ...data
  };

  workflowStore.set(id, workflow);
  console.log('📝 Created workflow:', id);
  return workflow;
}

export function getWorkflow(id: string): WorkflowState | undefined {
  return workflowStore.get(id);
}

export function findWorkflowByVideoId(videoId: string): { id: string; workflow: WorkflowState } | undefined {
  for (const [id, workflow] of workflowStore.entries()) {
    if (workflow.videoId === videoId) {
      return { id, workflow };
    }
  }
  return undefined;
}

export function findWorkflowBySubmagicId(projectId: string): { id: string; workflow: WorkflowState } | undefined {
  for (const [id, workflow] of workflowStore.entries()) {
    if (workflow.submagicProjectId === projectId) {
      return { id, workflow };
    }
  }
  return undefined;
}

export function updateWorkflow(id: string, updates: Partial<WorkflowState>): WorkflowState | undefined {
  const workflow = workflowStore.get(id);
  if (!workflow) return undefined;

  const updated = { ...workflow, ...updates };
  workflowStore.set(id, updated);
  console.log('📝 Updated workflow:', id, updates);
  return updated;
}

export function deleteWorkflow(id: string): boolean {
  return workflowStore.delete(id);
}

export function getAllWorkflows(): Map<string, WorkflowState> {
  return new Map(workflowStore);
}
