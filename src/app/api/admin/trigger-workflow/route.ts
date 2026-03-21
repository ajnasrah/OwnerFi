/**
 * Admin API: Trigger GitHub Actions Workflow
 *
 * POST /api/admin/trigger-workflow
 * Body: { workflow: "daily-video.yml", inputs: { lang: "en", dry_run: "false" } }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO || 'abdullahabunasrah/ownerfi';

const ALLOWED_WORKFLOWS = [
  'daily-video.yml',
  'daily-lead-demo-video.yml',
];

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions as unknown as Parameters<typeof getServerSession>[0]);
  if (!session?.user || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  if (!GITHUB_TOKEN) {
    return NextResponse.json({ error: 'GITHUB_TOKEN not configured' }, { status: 500 });
  }

  try {
    const { workflow, inputs } = await request.json();

    if (!workflow || !ALLOWED_WORKFLOWS.includes(workflow)) {
      return NextResponse.json({ error: `Invalid workflow. Allowed: ${ALLOWED_WORKFLOWS.join(', ')}` }, { status: 400 });
    }

    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/${workflow}/dispatches`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ref: 'main',
          inputs: inputs || {},
        }),
      }
    );

    if (res.status === 204) {
      return NextResponse.json({ success: true, message: `Workflow ${workflow} triggered` });
    }

    const errorText = await res.text();
    console.error(`GitHub dispatch error: ${res.status}`, errorText);
    return NextResponse.json({ error: `GitHub API error: ${res.status}`, details: errorText }, { status: res.status });
  } catch (error) {
    console.error('[TRIGGER-WORKFLOW] Error:', error);
    return NextResponse.json({ error: 'Failed to trigger workflow' }, { status: 500 });
  }
}
