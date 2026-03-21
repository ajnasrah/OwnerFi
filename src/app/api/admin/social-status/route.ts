/**
 * Admin API: Social Media Pipeline Status
 *
 * Fetches GitHub Actions workflow runs to show pipeline health.
 * GET /api/admin/social-status
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO || 'abdullahabunasrah/ownerfi';

interface WorkflowRun {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  html_url: string;
  created_at: string;
  updated_at: string;
  run_started_at: string;
  event: string;
  run_number: number;
  run_attempt: number;
  head_branch: string;
}

interface PipelineStatus {
  name: string;
  workflow_file: string;
  schedule: string;
  description: string;
  recent_runs: {
    id: number;
    status: 'success' | 'failure' | 'in_progress' | 'queued' | 'cancelled' | 'unknown';
    conclusion: string | null;
    started_at: string;
    duration_seconds: number;
    trigger: string;
    url: string;
    run_number: number;
  }[];
  last_success: string | null;
  last_failure: string | null;
  success_rate_7d: number;
  streak: { type: 'success' | 'failure'; count: number };
}

async function fetchWorkflowRuns(workflowFile: string, perPage = 15): Promise<WorkflowRun[]> {
  if (!GITHUB_TOKEN) return [];

  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/${workflowFile}/runs?per_page=${perPage}&branch=main`,
      {
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
        },
        next: { revalidate: 60 },
      }
    );

    if (!res.ok) {
      console.error(`GitHub API error for ${workflowFile}: ${res.status}`);
      return [];
    }

    const data = await res.json();
    return data.workflow_runs || [];
  } catch (err) {
    console.error(`Failed to fetch workflow runs for ${workflowFile}:`, err);
    return [];
  }
}

function mapConclusion(run: WorkflowRun): PipelineStatus['recent_runs'][0]['status'] {
  if (run.status === 'in_progress' || run.status === 'queued') return run.status as any;
  if (run.conclusion === 'success') return 'success';
  if (run.conclusion === 'failure') return 'failure';
  if (run.conclusion === 'cancelled') return 'cancelled';
  return 'unknown';
}

function buildPipelineStatus(
  name: string,
  workflowFile: string,
  schedule: string,
  description: string,
  runs: WorkflowRun[]
): PipelineStatus {
  const recentRuns = runs.map((run) => {
    const startedAt = run.run_started_at || run.created_at;
    const updatedAt = run.updated_at;
    const duration = Math.round(
      (new Date(updatedAt).getTime() - new Date(startedAt).getTime()) / 1000
    );

    return {
      id: run.id,
      status: mapConclusion(run),
      conclusion: run.conclusion,
      started_at: startedAt,
      duration_seconds: duration > 0 ? duration : 0,
      trigger: run.event === 'schedule' ? 'scheduled' : run.event === 'workflow_dispatch' ? 'manual' : run.event,
      url: run.html_url,
      run_number: run.run_number,
    };
  });

  const completedRuns = recentRuns.filter((r) => r.status === 'success' || r.status === 'failure');
  const successCount = completedRuns.filter((r) => r.status === 'success').length;
  const successRate = completedRuns.length > 0 ? (successCount / completedRuns.length) * 100 : 0;

  const lastSuccess = recentRuns.find((r) => r.status === 'success')?.started_at || null;
  const lastFailure = recentRuns.find((r) => r.status === 'failure')?.started_at || null;

  // Calculate streak
  let streakType: 'success' | 'failure' = 'success';
  let streakCount = 0;
  for (const run of completedRuns) {
    if (streakCount === 0) {
      streakType = run.status as 'success' | 'failure';
      streakCount = 1;
    } else if (run.status === streakType) {
      streakCount++;
    } else {
      break;
    }
  }

  return {
    name,
    workflow_file: workflowFile,
    schedule,
    description,
    recent_runs: recentRuns,
    last_success: lastSuccess,
    last_failure: lastFailure,
    success_rate_7d: Math.round(successRate * 10) / 10,
    streak: { type: streakType, count: streakCount },
  };
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions as unknown as Parameters<typeof getServerSession>[0]);
  if (!session?.user || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  if (!GITHUB_TOKEN) {
    return NextResponse.json({
      success: true,
      pipelines: [],
      error: 'GITHUB_TOKEN not configured — add it to Vercel env vars to enable pipeline monitoring',
    });
  }

  const [dailyVideoRuns, leadDemoRuns] = await Promise.all([
    fetchWorkflowRuns('daily-video.yml'),
    fetchWorkflowRuns('daily-lead-demo-video.yml'),
  ]);

  const pipelines: PipelineStatus[] = [
    buildPipelineStatus(
      'Ownerfi Daily Video',
      'daily-video.yml',
      'EN 10:00 AM CDT / ES 10:30 AM CDT + Sunday R2 cleanup',
      'Property card videos with Creatify AI avatar, posted to all platforms via Late.dev',
      dailyVideoRuns
    ),
    buildPipelineStatus(
      'Realtor Lead Demo',
      'daily-lead-demo-video.yml',
      '8:00 AM CDT daily',
      'Realtor dashboard walkthrough video showing lead referral flow',
      leadDemoRuns
    ),
  ];

  return NextResponse.json({
    success: true,
    pipelines,
    timestamp: new Date().toISOString(),
  });
}
