/**
 * Workflow State Machine
 * 
 * Validates state transitions and ensures workflow integrity
 * Prevents invalid state changes and tracks transition history
 */

export type WorkflowStatus = 
  | 'pending'
  | 'heygen_processing'
  | 'synthesia_processing' 
  | 'submagic_processing'
  | 'posting'
  | 'completed'
  | 'failed'
  | 'video_processing_failed';

interface StateTransition {
  from: WorkflowStatus;
  to: WorkflowStatus;
  condition?: (context: any) => boolean;
  action?: (context: any) => void;
}

interface TransitionResult {
  valid: boolean;
  error?: string;
  newState: WorkflowStatus;
  timestamp: number;
}

export class WorkflowStateMachine {
  private static readonly VALID_TRANSITIONS: StateTransition[] = [
    // Initial transitions from pending
    { from: 'pending', to: 'heygen_processing' },
    { from: 'pending', to: 'synthesia_processing' },
    { from: 'pending', to: 'failed' },

    // Video processing success paths
    { from: 'heygen_processing', to: 'submagic_processing' },
    { from: 'heygen_processing', to: 'posting' }, // Skip Submagic
    { from: 'synthesia_processing', to: 'submagic_processing' },
    { from: 'synthesia_processing', to: 'posting' }, // Skip Submagic

    // Video processing failure paths
    { from: 'heygen_processing', to: 'video_processing_failed' },
    { from: 'heygen_processing', to: 'pending' }, // Retry
    { from: 'synthesia_processing', to: 'video_processing_failed' },
    { from: 'synthesia_processing', to: 'pending' }, // Retry

    // Submagic transitions
    { from: 'submagic_processing', to: 'posting' },
    { from: 'submagic_processing', to: 'posting' }, // Skip on failure, use original
    { from: 'submagic_processing', to: 'failed' },

    // Final transitions
    { from: 'posting', to: 'completed' },
    { from: 'posting', to: 'failed' },

    // Failure recovery
    { from: 'failed', to: 'pending' }, // Manual retry
    { from: 'video_processing_failed', to: 'pending' }, // Manual retry

    // Self-transitions (for updates)
    { from: 'pending', to: 'pending' },
    { from: 'heygen_processing', to: 'heygen_processing' },
    { from: 'synthesia_processing', to: 'synthesia_processing' },
    { from: 'submagic_processing', to: 'submagic_processing' },
    { from: 'posting', to: 'posting' },
  ];

  /**
   * Validate if a state transition is allowed
   */
  static validateTransition(
    fromState: WorkflowStatus,
    toState: WorkflowStatus,
    context?: any
  ): TransitionResult {
    const timestamp = Date.now();

    // Find matching transition
    const validTransition = this.VALID_TRANSITIONS.find(
      t => t.from === fromState && t.to === toState
    );

    if (!validTransition) {
      return {
        valid: false,
        error: `Invalid transition from '${fromState}' to '${toState}'`,
        newState: fromState, // Keep current state
        timestamp
      };
    }

    // Check conditions if specified
    if (validTransition.condition && context) {
      if (!validTransition.condition(context)) {
        return {
          valid: false,
          error: `Transition condition not met for '${fromState}' to '${toState}'`,
          newState: fromState,
          timestamp
        };
      }
    }

    // Execute transition action if specified
    if (validTransition.action && context) {
      try {
        validTransition.action(context);
      } catch (error) {
        return {
          valid: false,
          error: `Transition action failed: ${error}`,
          newState: fromState,
          timestamp
        };
      }
    }

    return {
      valid: true,
      newState: toState,
      timestamp
    };
  }

  /**
   * Get all possible next states from current state
   */
  static getPossibleNextStates(currentState: WorkflowStatus): WorkflowStatus[] {
    return this.VALID_TRANSITIONS
      .filter(t => t.from === currentState)
      .map(t => t.to);
  }

  /**
   * Check if workflow is in a terminal state
   */
  static isTerminalState(state: WorkflowStatus): boolean {
    return state === 'completed' || state === 'failed';
  }

  /**
   * Check if workflow is in a processing state
   */
  static isProcessingState(state: WorkflowStatus): boolean {
    return [
      'heygen_processing',
      'synthesia_processing',
      'submagic_processing',
      'posting'
    ].includes(state);
  }

  /**
   * Check if workflow can be retried
   */
  static canRetry(state: WorkflowStatus, retryCount: number = 0, maxRetries: number = 3): boolean {
    const retryableStates: WorkflowStatus[] = ['failed', 'video_processing_failed'];
    return retryableStates.includes(state) && retryCount < maxRetries;
  }

  /**
   * Get expected duration for a state (in minutes)
   */
  static getExpectedDuration(state: WorkflowStatus): number {
    switch (state) {
      case 'pending': return 1;
      case 'heygen_processing': return 10;
      case 'synthesia_processing': return 15;
      case 'submagic_processing': return 5;
      case 'posting': return 2;
      default: return 0;
    }
  }

  /**
   * Check if workflow is stuck (exceeded expected duration)
   */
  static isStuck(
    state: WorkflowStatus, 
    lastUpdated: number, 
    multiplier: number = 2
  ): boolean {
    if (this.isTerminalState(state)) return false;

    const expectedDurationMs = this.getExpectedDuration(state) * 60 * 1000 * multiplier;
    return (Date.now() - lastUpdated) > expectedDurationMs;
  }

  /**
   * Get human-readable state description
   */
  static getStateDescription(state: WorkflowStatus): string {
    switch (state) {
      case 'pending': return 'Waiting to start';
      case 'heygen_processing': return 'Generating video with HeyGen';
      case 'synthesia_processing': return 'Generating video with Synthesia';
      case 'submagic_processing': return 'Adding captions with Submagic';
      case 'posting': return 'Posting to social media';
      case 'completed': return 'Successfully completed';
      case 'failed': return 'Failed';
      case 'video_processing_failed': return 'Video generation failed';
      default: return 'Unknown state';
    }
  }
}

/**
 * Enhanced updateWorkflowStatus with state machine validation
 */
export async function updateWorkflowStatusWithValidation(
  workflowId: string,
  brand: string,
  newStatus: WorkflowStatus,
  updates: Record<string, any> = {},
  context?: any
): Promise<{ success: boolean; error?: string }> {
  const { updateWorkflowStatus } = await import('./feed-store-firestore');
  
  try {
    // Get current workflow state
    const { db } = await import('./firebase-admin');
    const workflowDoc = await db.collection(`${brand}_workflow_queue`).doc(workflowId).get();
    
    if (!workflowDoc.exists()) {
      return { success: false, error: 'Workflow not found' };
    }

    const currentData = workflowDoc.data();
    const currentStatus = currentData?.status as WorkflowStatus;

    // Validate transition
    const validation = WorkflowStateMachine.validateTransition(
      currentStatus,
      newStatus,
      { ...currentData, ...context }
    );

    if (!validation.valid) {
      console.error(`[Workflow State Machine] ${validation.error}`);
      return { success: false, error: validation.error };
    }

    // Add state transition metadata
    const enhancedUpdates = {
      ...updates,
      status: validation.newState,
      statusChangedAt: validation.timestamp,
      previousStatus: currentStatus,
      stateTransition: {
        from: currentStatus,
        to: validation.newState,
        timestamp: validation.timestamp,
        valid: true
      }
    };

    // Update workflow with validation
    await updateWorkflowStatus(workflowId, brand as any, validation.newState);

    console.log(`[Workflow State Machine] Valid transition: ${currentStatus} → ${validation.newState}`);
    return { success: true };

  } catch (error) {
    console.error('[Workflow State Machine] Update failed:', error);
    return { success: false, error: `Update failed: ${error}` };
  }
}