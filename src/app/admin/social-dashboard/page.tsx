'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// ─── Types ───

interface RunInfo {
  id: number;
  status: 'success' | 'failure' | 'in_progress' | 'queued' | 'cancelled' | 'unknown';
  conclusion: string | null;
  started_at: string;
  duration_seconds: number;
  trigger: string;
  url: string;
  run_number: number;
}

interface Pipeline {
  name: string;
  workflow_file: string;
  schedule: string;
  description: string;
  recent_runs: RunInfo[];
  last_success: string | null;
  last_failure: string | null;
  success_rate_7d: number;
  streak: { type: 'success' | 'failure'; count: number };
}

interface StatusData {
  success: boolean;
  pipelines: Pipeline[];
  error?: string;
  timestamp: string;
}

// ─── Helpers ───

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 0) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function statusBadge(status: RunInfo['status']) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    success: { bg: 'bg-green-900/40', text: 'text-green-400', label: 'Success' },
    failure: { bg: 'bg-red-900/40', text: 'text-red-400', label: 'Failed' },
    in_progress: { bg: 'bg-blue-900/40', text: 'text-blue-400', label: 'Running' },
    queued: { bg: 'bg-yellow-900/40', text: 'text-yellow-400', label: 'Queued' },
    cancelled: { bg: 'bg-slate-700', text: 'text-slate-400', label: 'Cancelled' },
    unknown: { bg: 'bg-slate-700', text: 'text-slate-400', label: 'Unknown' },
  };
  const s = map[status] || map.unknown;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>
      {status === 'in_progress' && (
        <span className="w-2 h-2 bg-blue-400 rounded-full mr-1.5 animate-pulse" />
      )}
      {s.label}
    </span>
  );
}

// ─── Component ───

export default function SocialDashboard() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState<string | null>(null);

  useEffect(() => {
    if (authStatus === 'unauthenticated') router.replace('/auth');
    if (authStatus === 'authenticated' && (session?.user as any)?.role !== 'admin') router.replace('/');
  }, [authStatus, session, router]);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/social-status');
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error('Failed to load social status:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authStatus === 'authenticated' && (session?.user as any)?.role === 'admin') {
      loadStatus();
      const interval = setInterval(loadStatus, 60000); // refresh every 60s
      return () => clearInterval(interval);
    }
    return undefined;
  }, [authStatus, session, loadStatus]);

  const triggerWorkflow = async (workflowFile: string, inputs?: Record<string, string>) => {
    setTriggering(workflowFile);
    try {
      const res = await fetch('/api/admin/trigger-workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflow: workflowFile, inputs }),
      });
      const json = await res.json();
      if (json.success) {
        alert(`Pipeline triggered! It will appear in the run list within ~30 seconds.`);
        setTimeout(loadStatus, 15000);
      } else {
        alert(`Failed: ${json.error || 'Unknown error'}`);
      }
    } catch (err) {
      alert('Failed to trigger workflow');
    } finally {
      setTriggering(null);
    }
  };

  if (authStatus !== 'authenticated' || (session?.user as any)?.role !== 'admin' || loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#111625]">
        <div className="w-8 h-8 border-2 border-[#00BC7D] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const pipelines = data?.pipelines || [];

  return (
    <div className="h-screen overflow-hidden bg-[#111625] flex flex-col">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <Link href="/admin" className="text-[#00BC7D] hover:text-[#00d68f] mb-4 inline-flex items-center gap-1">
            ← Back to Admin Hub
          </Link>
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-white">Social Media Pipelines</h1>
            <p className="text-slate-400 mt-1">
              GitHub Actions video pipelines — Creatify + Late.dev
              {data?.timestamp && (
                <span className="ml-2 text-slate-500 text-xs">Updated {timeAgo(data.timestamp)}</span>
              )}
            </p>
          </div>

          {/* Config missing warning */}
          {data?.error && (
            <div className="bg-amber-900/30 border border-amber-600/50 rounded-xl p-4 mb-6">
              <p className="text-amber-300 text-sm">{data.error}</p>
            </div>
          )}

          {/* Overview Cards */}
          {pipelines.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
                <div className="text-sm text-slate-400">Pipelines</div>
                <div className="text-2xl font-bold text-white mt-1">{pipelines.length}</div>
                <div className="text-xs text-slate-500 mt-1">active</div>
              </div>
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
                <div className="text-sm text-slate-400">Avg Success Rate</div>
                <div className={`text-2xl font-bold mt-1 ${
                  pipelines.every(p => p.success_rate_7d >= 90) ? 'text-green-400' :
                  pipelines.some(p => p.success_rate_7d < 50) ? 'text-red-400' : 'text-yellow-400'
                }`}>
                  {Math.round(pipelines.reduce((sum, p) => sum + p.success_rate_7d, 0) / pipelines.length)}%
                </div>
                <div className="text-xs text-slate-500 mt-1">recent runs</div>
              </div>
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
                <div className="text-sm text-slate-400">Video Engine</div>
                <div className="text-lg font-bold text-white mt-1">Creatify</div>
                <div className="text-xs text-slate-500 mt-1">AI avatar</div>
              </div>
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
                <div className="text-sm text-slate-400">Posting</div>
                <div className="text-lg font-bold text-white mt-1">Late.dev</div>
                <div className="text-xs text-slate-500 mt-1">all platforms</div>
              </div>
            </div>
          )}

          {/* Pipeline Cards */}
          {pipelines.map((pipeline) => (
            <PipelineCard
              key={pipeline.workflow_file}
              pipeline={pipeline}
              triggering={triggering === pipeline.workflow_file}
              onTrigger={(inputs) => triggerWorkflow(pipeline.workflow_file, inputs)}
            />
          ))}

          {pipelines.length === 0 && !data?.error && (
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-12 text-center">
              <p className="text-slate-400">No pipeline data available.</p>
              <p className="text-slate-500 text-sm mt-1">Make sure GITHUB_TOKEN is set in environment variables.</p>
            </div>
          )}

          {/* Platforms */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 mt-6">
            <h3 className="text-lg font-semibold text-white mb-4">Publishing Platforms</h3>
            <div className="flex flex-wrap gap-2">
              {['Instagram', 'TikTok', 'YouTube', 'Facebook', 'LinkedIn', 'Twitter/X', 'Threads', 'Bluesky'].map((p) => (
                <span key={p} className="px-3 py-1.5 rounded-full text-xs font-medium bg-[#00BC7D]/10 text-[#00BC7D] border border-[#00BC7D]/20">
                  {p}
                </span>
              ))}
            </div>
            <div className="mt-4 text-xs text-slate-500">
              Videos posted via Late.dev to Ownerfi profile. YouTube uses Short format.
            </div>
          </div>

          {/* System Info */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 mt-6">
            <h3 className="text-lg font-semibold text-white mb-4">Pipeline Architecture</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
              <div>
                <h4 className="font-medium text-slate-300 mb-2">Ownerfi Daily Video</h4>
                <ol className="text-slate-400 space-y-1 list-decimal ml-4">
                  <li>Query Typesense for properties by rotating state</li>
                  <li>Puppeteer renders property cards (uploaded to R2)</li>
                  <li>GPT-4o-mini generates script + caption</li>
                  <li>Creatify renders AI avatar video with cards</li>
                  <li>Late.dev posts to all platforms</li>
                </ol>
                <div className="text-xs text-slate-500 mt-2">EN + ES versions, ~8-10 min each</div>
              </div>
              <div>
                <h4 className="font-medium text-slate-300 mb-2">Realtor Lead Demo</h4>
                <ol className="text-slate-400 space-y-1 list-decimal ml-4">
                  <li>Puppeteer captures 5 dashboard screenshots</li>
                  <li>Upload screens to R2</li>
                  <li>GPT-4o-mini generates walkthrough script</li>
                  <li>Creatify renders avatar demo video</li>
                  <li>Late.dev posts to all platforms</li>
                </ol>
                <div className="text-xs text-slate-500 mt-2">Targets licensed agents, ~5 min</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Pipeline Card ───

function PipelineCard({
  pipeline,
  triggering,
  onTrigger,
}: {
  pipeline: Pipeline;
  triggering: boolean;
  onTrigger: (inputs?: Record<string, string>) => void;
}) {
  const isDaily = pipeline.workflow_file === 'daily-video.yml';
  const [showAll, setShowAll] = useState(false);
  const displayRuns = showAll ? pipeline.recent_runs : pipeline.recent_runs.slice(0, 5);

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 mb-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-white">{pipeline.name}</h3>
            {pipeline.streak.count > 0 && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                pipeline.streak.type === 'success'
                  ? 'bg-green-900/40 text-green-400'
                  : 'bg-red-900/40 text-red-400'
              }`}>
                {pipeline.streak.count}x {pipeline.streak.type}
              </span>
            )}
          </div>
          <p className="text-slate-400 text-sm mt-1">{pipeline.description}</p>
          <p className="text-slate-500 text-xs mt-1">Schedule: {pipeline.schedule}</p>
        </div>
        <div className="flex gap-2">
          {isDaily && (
            <div className="flex gap-1">
              <button
                onClick={() => onTrigger({ lang: 'en', dry_run: 'false' })}
                disabled={triggering}
                className="px-3 py-2 bg-[#00BC7D] text-white text-xs font-medium rounded-lg hover:bg-[#009B66] disabled:bg-slate-600 disabled:text-slate-400 transition-colors"
              >
                {triggering ? 'Triggering...' : 'Run EN'}
              </button>
              <button
                onClick={() => onTrigger({ lang: 'es', dry_run: 'false' })}
                disabled={triggering}
                className="px-3 py-2 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 disabled:bg-slate-600 disabled:text-slate-400 transition-colors"
              >
                ES
              </button>
            </div>
          )}
          {!isDaily && (
            <button
              onClick={() => onTrigger({ dry_run: 'false' })}
              disabled={triggering}
              className="px-4 py-2 bg-[#00BC7D] text-white text-xs font-medium rounded-lg hover:bg-[#009B66] disabled:bg-slate-600 disabled:text-slate-400 transition-colors"
            >
              {triggering ? 'Triggering...' : 'Run Now'}
            </button>
          )}
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="bg-slate-700/50 rounded-lg p-3">
          <div className="text-xs text-slate-400">Success Rate</div>
          <div className={`text-xl font-bold mt-1 ${
            pipeline.success_rate_7d >= 90 ? 'text-green-400' :
            pipeline.success_rate_7d >= 70 ? 'text-yellow-400' : 'text-red-400'
          }`}>
            {pipeline.success_rate_7d}%
          </div>
        </div>
        <div className="bg-slate-700/50 rounded-lg p-3">
          <div className="text-xs text-slate-400">Last Success</div>
          <div className="text-sm font-medium text-white mt-1">
            {pipeline.last_success ? timeAgo(pipeline.last_success) : 'Never'}
          </div>
        </div>
        <div className="bg-slate-700/50 rounded-lg p-3">
          <div className="text-xs text-slate-400">Last Failure</div>
          <div className="text-sm font-medium text-white mt-1">
            {pipeline.last_failure ? timeAgo(pipeline.last_failure) : 'None'}
          </div>
        </div>
        <div className="bg-slate-700/50 rounded-lg p-3">
          <div className="text-xs text-slate-400">Total Runs</div>
          <div className="text-xl font-bold text-white mt-1">{pipeline.recent_runs.length}</div>
        </div>
      </div>

      {/* Run History */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-slate-300">Recent Runs</h4>
          {pipeline.recent_runs.length > 5 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-xs text-[#00BC7D] hover:text-[#00d68f]"
            >
              {showAll ? 'Show less' : `Show all ${pipeline.recent_runs.length}`}
            </button>
          )}
        </div>

        {/* Mini status bar */}
        <div className="flex gap-1 mb-3">
          {pipeline.recent_runs.slice(0, 15).reverse().map((run) => (
            <div
              key={run.id}
              className={`h-6 flex-1 rounded-sm ${
                run.status === 'success' ? 'bg-green-500' :
                run.status === 'failure' ? 'bg-red-500' :
                run.status === 'in_progress' ? 'bg-blue-500 animate-pulse' :
                run.status === 'cancelled' ? 'bg-slate-600' :
                'bg-slate-600'
              }`}
              title={`#${run.run_number} - ${run.status} - ${new Date(run.started_at).toLocaleString()}`}
            />
          ))}
        </div>

        {/* Run list */}
        <div className="space-y-2">
          {displayRuns.map((run) => (
            <a
              key={run.id}
              href={run.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between bg-slate-700/50 hover:bg-slate-700 rounded-lg px-4 py-2.5 transition-colors group"
            >
              <div className="flex items-center gap-3">
                {statusBadge(run.status)}
                <span className="text-xs text-slate-500">#{run.run_number}</span>
                <span className="text-xs text-slate-400">
                  {new Date(run.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{' '}
                  {new Date(run.started_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' })} CT
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-0.5 rounded ${
                  run.trigger === 'scheduled' ? 'bg-slate-600 text-slate-300' : 'bg-purple-900/40 text-purple-400'
                }`}>
                  {run.trigger}
                </span>
                <span className="text-xs text-slate-500">{formatDuration(run.duration_seconds)}</span>
                <svg className="w-4 h-4 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </div>
            </a>
          ))}
        </div>

        {pipeline.recent_runs.length === 0 && (
          <div className="bg-slate-700/50 rounded-lg p-6 text-center">
            <p className="text-slate-500 text-sm">No runs found</p>
          </div>
        )}
      </div>
    </div>
  );
}
