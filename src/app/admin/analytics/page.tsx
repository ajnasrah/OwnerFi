/**
 * Admin Analytics Dashboard Page
 * Performance analytics from Late.dev social media posts
 */

import AnalyticsDashboard from '@/components/AnalyticsDashboard';

export const metadata = {
  title: 'Analytics Dashboard | Admin',
  description: 'Social media performance analytics and insights',
};

export default function AnalyticsDashboardPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">📊 Analytics Dashboard</h1>
          <p className="text-gray-600">
            Performance insights from Late.dev - analyze time slots, content types, hooks, and platforms
          </p>
        </div>

        {/* Dashboard */}
        <AnalyticsDashboard />

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
  );
}
