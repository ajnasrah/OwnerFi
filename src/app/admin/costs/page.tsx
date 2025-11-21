/**
 * Admin Cost Dashboard Page
 * Real-time tracking of API costs and budget usage
 */

import CostDashboard from '@/components/CostDashboard';

export const metadata = {
  title: 'Cost Dashboard | Admin',
  description: 'Real-time API cost tracking and budget management',
};

export default function CostDashboardPage() {
  return (
    <div className="h-screen overflow-hidden bg-gray-900 text-white flex flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">💰 Cost Dashboard</h1>
          <p className="text-gray-400">
            Real-time tracking of HeyGen, Submagic, OpenAI, Late, and R2 costs
          </p>
        </div>

        {/* Dashboard */}
        <CostDashboard />

        {/* Back to Admin */}
        <div className="mt-8">
          <a
            href="/admin"
            className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300"
          >
            ← Back to Admin Dashboard
          </a>
        </div>
        </div>
      </div>
    </div>
  );
}
