'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

/**
 * Investor navigation bar shown when visitor comes from a deal alert SMS.
 * Detects ?ref=deal-alert query param.
 */
export default function InvestorNav() {
  const searchParams = useSearchParams();
  const fromAlert = searchParams.get('ref') === 'deal-alert';

  if (!fromAlert) return null;

  return (
    <div className="bg-[#004D33]/80 backdrop-blur-sm border-b border-[#009B66]/50">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link
          href="/dashboard/investor"
          className="flex items-center gap-2 text-[#00d68f] hover:text-white transition-colors text-sm font-medium"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </Link>
        <Link
          href="/dashboard/investor"
          className="bg-[#00BC7D] hover:bg-[#00BC7D]/50 text-white px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors"
        >
          Browse All Deals
        </Link>
      </div>
    </div>
  );
}
