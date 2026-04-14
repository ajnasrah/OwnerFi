'use client';

/**
 * Admin filter editor for any user.
 * URL: /admin/users/[userId]/filters?name=Alice%20Smith&role=buyer
 *
 * Optional query params `name` and `role` are just display hints — auth is
 * enforced server-side on the API.
 */

import { useEffect, useState, useCallback, use } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ExtendedSession } from '@/types/session';
import { FilterEditor } from '@/components/filters/FilterEditor';
import { FilterConfig, EMPTY_FILTER } from '@/lib/filter-schema';

export default function AdminUserFiltersPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = use(params);
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const displayName = searchParams?.get('name') || null;
  const displayRole = searchParams?.get('role') || null;

  const [filter, setFilter] = useState<FilterConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  // Auth guard
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/auth');
    } else if (
      status === 'authenticated' &&
      (session as unknown as ExtendedSession)?.user?.role !== 'admin'
    ) {
      router.replace('/');
    }
  }, [status, session, router]);

  // Load filter
  useEffect(() => {
    if (status !== 'authenticated') return undefined;
    if ((session as unknown as ExtendedSession)?.user?.role !== 'admin') return undefined;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/filters`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setFilter(data.filter || EMPTY_FILTER);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load filter');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, status, session]);

  const handleSave = useCallback(
    async (next: FilterConfig) => {
      try {
        setSaving(true);
        setError(null);
        const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/filters`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(next),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        setFilter(data.filter);
        setSavedAt(new Date());
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Save failed');
      } finally {
        setSaving(false);
      }
    },
    [userId],
  );

  if (status !== 'authenticated' || (session as unknown as ExtendedSession)?.user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-[#111625] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00BC7D]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111625]">
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Header */}
        <Link
          href="/admin"
          className="text-[#00BC7D] hover:text-[#00d68f] mb-4 inline-flex items-center gap-1 text-sm"
        >
          ← Back to Admin Hub
        </Link>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Edit Filters</h1>
          <p className="text-slate-400 text-sm mt-1">
            {displayName ? (
              <>
                {displayName}
                {displayRole ? <span className="ml-2 text-slate-500">({displayRole})</span> : null}
                <span className="ml-2 font-mono text-xs text-slate-600">{userId}</span>
              </>
            ) : (
              <span className="font-mono text-xs">{userId}</span>
            )}
          </p>
        </div>

        {error && (
          <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {savedAt && !error && (
          <div className="mb-4 bg-[#00BC7D]/10 border border-[#00BC7D]/30 rounded-lg px-4 py-3 text-sm text-[#00BC7D]">
            Saved at {savedAt.toLocaleTimeString()}
          </div>
        )}

        {loading || !filter ? (
          <div className="py-12 text-center text-slate-400 text-sm">Loading filter…</div>
        ) : (
          <FilterEditor
            initialFilter={filter}
            onSave={handleSave}
            saving={saving}
            headerNote={`Editing as admin. Changes take effect immediately on the user's next dashboard load.`}
            disableSavedSearches
          />
        )}
      </div>
    </div>
  );
}
