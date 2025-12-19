/**
 * Admin YouTube Analytics Dashboard Page
 * Analyze video performance, select top performers, and generate prompt recommendations
 */

import YouTubeAnalyticsDashboard from '@/components/YouTubeAnalyticsDashboard';
import Link from 'next/link';

export const metadata = {
  title: 'YouTube Analytics | Admin',
  description: 'YouTube video performance analytics and prompt optimization',
};

export default function YouTubeAnalyticsPage() {
  return (
    <div className="h-screen overflow-hidden bg-gray-50 flex flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">📺 YouTube Analytics Dashboard</h1>
            <p className="text-gray-600">
              Analyze video performance across all channels, select top performers, and generate prompt recommendations
            </p>
          </div>

          {/* Dashboard */}
          <YouTubeAnalyticsDashboard />

          {/* Back to Admin */}
          <div className="mt-8">
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700"
            >
              ← Back to Admin Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
