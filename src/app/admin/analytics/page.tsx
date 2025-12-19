/**
 * Admin Analytics Dashboard Page
 * Performance analytics from Late.dev social media posts
 */

import PlatformAnalyticsDashboard from '@/components/PlatformAnalyticsDashboard';
import Link from 'next/link';

export const metadata = {
  title: 'Platform Analytics | Admin',
  description: 'Platform-specific social media performance analytics and AI-powered recommendations',
};

export default function AnalyticsDashboardPage() {
  return (
    <div className="h-screen overflow-hidden bg-slate-900 flex flex-col">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto">
        <Link href="/admin" className="text-emerald-400 hover:text-emerald-300 text-sm mb-4 inline-block">← Back to Admin</Link>
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">📊 Platform Analytics Dashboard</h1>
          <p className="text-slate-400">
            Platform-specific insights, peak times, engagement trends, and AI-powered recommendations
          </p>
        </div>

        {/* Dashboard */}
        <PlatformAnalyticsDashboard />
        </div>
      </div>
    </div>
  );
}
