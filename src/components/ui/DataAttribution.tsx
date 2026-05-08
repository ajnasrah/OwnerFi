'use client';

export function DataAttribution() {
  return (
    <div className="text-center py-2 px-4">
      <p className="text-xs text-slate-500">
        <span className="inline-block mr-1">ℹ️</span>
        Property data aggregated from public sources including Zillow.com. 
        Information provided for reference only - not guaranteed accurate. 
        Verify all details independently.
      </p>
    </div>
  );
}

export function CompactDataAttribution() {
  return (
    <p className="text-[10px] text-slate-500 text-center mt-2">
      Data from public sources • Not guaranteed • Verify independently
    </p>
  );
}