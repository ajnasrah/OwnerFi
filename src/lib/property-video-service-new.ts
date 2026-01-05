/**
 * Property Video Service (New)
 * Stub module - property video generation not yet implemented
 */

export async function generatePropertyVideoNew(
  workflowId: string
): Promise<{ success: boolean; workflowId?: string; error?: string; message?: string }> {
  console.log(`⚠️ Property video service not implemented for workflow: ${workflowId}`);
  return {
    success: false,
    error: 'Property video service not implemented',
    message: 'Property video service not implemented'
  };
}
