'use client';

interface WorkflowRecoveryButtonsProps {
  workflow: {
    id: string;
    brand?: string;
    heygenVideoUrl?: string;
    heygenVideoR2Url?: string;
  };
  onSuccess: () => void;
}

export default function WorkflowRecoveryButtons({ workflow, onSuccess }: WorkflowRecoveryButtonsProps) {
  const hasHeygenVideo = workflow.heygenVideoUrl || workflow.heygenVideoR2Url;

  if (!hasHeygenVideo) {
    return null;
  }

  const retrySubmagic = async () => {
    if (!confirm('Retry Submagic step using saved HeyGen video?')) return;

    try {
      const res = await fetch('/api/workflow/retry-submagic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflowId: workflow.id,
          brand: workflow.brand || 'ownerfi'
        })
      });
      const data = await res.json();
      alert(data.success ? '✅ Submagic retry started!' : `❌ Error: ${data.error}`);
      if (data.success) onSuccess();
    } catch (e) {
      alert('❌ Failed to retry Submagic');
      console.error(e);
    }
  };

  const completeWithoutSubmagic = async () => {
    if (!confirm('Complete workflow with HeyGen video only (skip Submagic and post to social media)?')) return;

    try {
      const res = await fetch('/api/workflow/complete-without-submagic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflowId: workflow.id,
          brand: workflow.brand || 'ownerfi'
        })
      });
      const data = await res.json();
      alert(data.success ? '✅ Workflow completed and posted!' : `❌ Error: ${data.error}`);
      if (data.success) onSuccess();
    } catch (e) {
      alert('❌ Failed to complete workflow');
      console.error(e);
    }
  };

  return (
    <div className="flex gap-2 mt-2">
      <button
        onClick={retrySubmagic}
        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded transition-colors"
      >
        🔄 Retry Submagic
      </button>
      <button
        onClick={completeWithoutSubmagic}
        className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded transition-colors"
      >
        ✅ Use HeyGen Video
      </button>
    </div>
  );
}
