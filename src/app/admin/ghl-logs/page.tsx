'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ExtendedSession, isExtendedSession } from '@/types/session';

interface WebhookLog {
  id: string;
  type: 'property_match_notification';
  status: 'pending' | 'sent' | 'failed';
  buyerId: string;
  propertyId: string;
  buyerPhone: string;
  payload: {
    buyerName: string;
    propertyAddress: string;
    propertyCity: string;
    propertyState: string;
    monthlyPayment: number;
    downPaymentAmount: number;
    trigger: string;
  };
  errorMessage?: string;
  sentAt?: string;
  createdAt: { seconds: number };
  processingTimeMs?: number;
}

interface Buyer {
  id: string;
  name: string;
  phone: string;
  city: string;
  state: string;
  smsEnabled: boolean;
}

interface Property {
  id: string;
  address: string;
  city: string;
  state: string;
  monthlyPayment: number;
  downPaymentAmount: number;
}

export default function GoHighLevelLogsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Test notification state
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedBuyerId, setSelectedBuyerId] = useState('');
  const [selectedPropertyId, setSelectedPropertyId] = useState('');

  // Auth check
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (
      status === 'authenticated' &&
      isExtendedSession(session as unknown as ExtendedSession) &&
      (session as unknown as ExtendedSession)?.user?.role !== 'admin'
    ) {
      router.push('/');
    }
  }, [status, session, router]);

  // Load logs and test data
  useEffect(() => {
    if (
      status === 'authenticated' &&
      isExtendedSession(session as unknown as ExtendedSession) &&
      (session as unknown as ExtendedSession)?.user?.role === 'admin'
    ) {
      loadLogs();
      loadTestData();
    }
  }, [status, session]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/webhooks/gohighlevel/property-match?limit=100');
      const data = await response.json();

      if (data.success) {
        setLogs(data.logs);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to load webhook logs');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadTestData = async () => {
    try {
      const response = await fetch('/api/admin/test-ghl-notification');
      const data = await response.json();

      if (data.success) {
        setBuyers(data.buyers);
        setProperties(data.properties);
      }
    } catch (err) {
      console.error('Failed to load test data:', err);
    }
  };

  const sendTestNotification = async () => {
    if (!selectedBuyerId || !selectedPropertyId) {
      setTestResult({ success: false, message: 'Please select both a buyer and property' });
      return;
    }

    try {
      setTestLoading(true);
      setTestResult(null);

      const response = await fetch('/api/admin/test-ghl-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyerId: selectedBuyerId,
          propertyId: selectedPropertyId,
        }),
      });

      const data = await response.json();

      setTestResult({
        success: data.success,
        message: data.success ? `✅ ${data.message}` : `❌ ${data.error}`,
      });

      if (data.success) {
        // Reload logs to show the new test notification
        setTimeout(() => loadLogs(), 1000);
      }
    } catch (err) {
      setTestResult({
        success: false,
        message: `❌ Failed to send test: ${err}`,
      });
    } finally {
      setTestLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading webhook logs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold">GoHighLevel SMS Logs</h1>
              <p className="text-slate-400 mt-2">Monitor property match notifications sent to buyers</p>
            </div>
            <button
              onClick={loadLogs}
              className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-lg font-semibold transition-colors"
            >
              🔄 Refresh
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <div className="text-3xl font-bold text-emerald-400">{logs.length}</div>
              <div className="text-slate-400 text-sm mt-1">Total Notifications</div>
            </div>
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <div className="text-3xl font-bold text-green-400">
                {logs.filter((l) => l.status === 'sent').length}
              </div>
              <div className="text-slate-400 text-sm mt-1">Successfully Sent</div>
            </div>
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <div className="text-3xl font-bold text-red-400">
                {logs.filter((l) => l.status === 'failed').length}
              </div>
              <div className="text-slate-400 text-sm mt-1">Failed</div>
            </div>
          </div>
        </div>

        {/* Test Notification Section */}
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 mb-8">
          <h2 className="text-xl font-bold mb-4">🧪 Test Notification</h2>
          <p className="text-slate-400 mb-4">Send a test SMS notification to verify your GoHighLevel integration</p>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-semibold mb-2">Select Buyer</label>
              <select
                value={selectedBuyerId}
                onChange={(e) => setSelectedBuyerId(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2"
              >
                <option value="">-- Choose a buyer --</option>
                {buyers.map((buyer) => (
                  <option key={buyer.id} value={buyer.id}>
                    {buyer.name} - {buyer.phone} ({buyer.city}, {buyer.state})
                    {!buyer.smsEnabled && ' [SMS DISABLED]'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">Select Property</label>
              <select
                value={selectedPropertyId}
                onChange={(e) => setSelectedPropertyId(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2"
              >
                <option value="">-- Choose a property --</option>
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.address} - {property.city}, {property.state} (${property.monthlyPayment}/mo)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={sendTestNotification}
            disabled={testLoading || !selectedBuyerId || !selectedPropertyId}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 disabled:cursor-not-allowed px-6 py-2 rounded-lg font-semibold transition-colors"
          >
            {testLoading ? '⏳ Sending...' : '📱 Send Test SMS'}
          </button>

          {testResult && (
            <div
              className={`mt-4 p-4 rounded-lg ${
                testResult.success
                  ? 'bg-green-900/30 border border-green-700 text-green-300'
                  : 'bg-red-900/30 border border-red-700 text-red-300'
              }`}
            >
              {testResult.message}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 mb-6">
            <p className="text-red-300">{error}</p>
          </div>
        )}

        {/* Logs Table */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Buyer</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Phone</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Property</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Trigger</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Time</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      No webhook logs yet. Send a test notification to get started!
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-700/50">
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                            log.status === 'sent'
                              ? 'bg-green-900/50 text-green-300'
                              : log.status === 'failed'
                              ? 'bg-red-900/50 text-red-300'
                              : 'bg-yellow-900/50 text-yellow-300'
                          }`}
                        >
                          {log.status === 'sent' && '✅'}
                          {log.status === 'failed' && '❌'}
                          {log.status === 'pending' && '⏳'}
                          {' '}
                          {log.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">{log.payload.buyerName}</td>
                      <td className="px-4 py-3 text-sm font-mono">{log.buyerPhone}</td>
                      <td className="px-4 py-3 text-sm">
                        {log.payload.propertyAddress}
                        <br />
                        <span className="text-slate-500 text-xs">
                          {log.payload.propertyCity}, {log.payload.propertyState}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className="text-slate-400">{log.payload.trigger.replace(/_/g, ' ')}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">
                        {new Date(log.createdAt.seconds * 1000).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">
                        {log.processingTimeMs ? `${log.processingTimeMs}ms` : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Back Button */}
        <div className="mt-8">
          <button
            onClick={() => router.push('/admin')}
            className="bg-slate-700 hover:bg-slate-600 px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            ← Back to Admin Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
