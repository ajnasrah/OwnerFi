/**
 * Admin Analytics Dashboard Page
 * Performance analytics from Late.dev social media posts
 */

import PlatformAnalyticsDashboard from '@/components/PlatformAnalyticsDashboard';

export const metadata = {
  title: 'Platform Analytics | Admin',
  description: 'Platform-specific social media performance analytics and AI-powered recommendations',
};

export default function AnalyticsDashboardPage() {
  return (
    <div className="h-screen overflow-hidden bg-gray-50 flex flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">📊 Platform Analytics Dashboard</h1>
          <p className="text-gray-600">
            Platform-specific insights, peak times, engagement trends, and AI-powered recommendations
          </p>
        </div>

        {/* Dashboard */}
        <PlatformAnalyticsDashboard />

        {/* Back to Admin */}
        <div className="mt-8">
          <a
            href="/admin"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700"
          >
            ← Back to Admin Dashboard
          </a>
        </div>
        </div>
      </div>
    </div>
  );
}
