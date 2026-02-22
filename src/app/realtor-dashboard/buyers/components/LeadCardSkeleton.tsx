'use client';

export function LeadCardSkeleton() {
  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4 animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="h-5 w-32 bg-slate-700 rounded mb-2" />
          <div className="h-4 w-24 bg-slate-700/60 rounded mb-1" />
          <div className="h-3 w-20 bg-slate-700/40 rounded" />
        </div>
        <div className="h-6 w-16 bg-slate-700 rounded" />
      </div>
      <div className="h-10 w-full bg-slate-700/40 rounded-lg" />
    </div>
  );
}

export function LeadCardSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {Array.from({ length: count }).map((_, i) => (
        <LeadCardSkeleton key={i} />
      ))}
    </div>
  );
}
