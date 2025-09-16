'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/ui/Header';
import { Footer } from '@/components/ui/Footer';
import { collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface LogEntry {
  id: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  context?: {
    action?: string;
    metadata?: Record<string, unknown>;
  };
  stackTrace?: string;
  createdAt: { toDate?: () => Date } | null;
  userId?: string;
  userType?: string;
}

export default function AdminLogsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'upload' | 'error'>('upload');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }

    if (status === 'authenticated') {
      const userRole = (session?.user as { role?: string })?.role;
      if (userRole !== 'admin') {
        router.push('/dashboard');
      }
    }
  }, [status, session, router]);

  const fetchLogs = async () => {
    if (!db) return;

    setLoading(true);
    try {
      const logsRef = collection(db, 'systemLogs');
      let logsQuery = query(
        logsRef,
        orderBy('createdAt', 'desc'),
        limit(200)
      );

      if (filter === 'error') {
        logsQuery = query(
          logsRef,
          where('level', '==', 'error'),
          orderBy('createdAt', 'desc'),
          limit(200)
        );
      }

      const snapshot = await getDocs(logsQuery);
      const logEntries: LogEntry[] = [];

      snapshot.forEach(doc => {
        const data = doc.data();
        let context;
        try {
          context = data.context ? JSON.parse(data.context) : {};
        } catch {
          context = {};
        }

        const logEntry: LogEntry = {
          id: doc.id,
          level: data.level,
          message: data.message,
          context,
          stackTrace: data.stackTrace,
          createdAt: data.createdAt,
          userId: data.userId,
          userType: data.userType
        };

        // Filter by upload-related logs if needed
        if (filter === 'upload') {
          if (
            context.action === 'upload_properties' ||
            context.action === 'insert_property' ||
            data.message?.includes('property') ||
            data.message?.includes('upload') ||
            data.message?.includes('CSV') ||
            data.message?.includes('Excel')
          ) {
            logEntries.push(logEntry);
          }
        } else {
          logEntries.push(logEntry);
        }
      });

      setLogs(logEntries);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'authenticated') {
      fetchLogs();
    }
  }, [status, filter]); // eslint-disable-line react-hooks/exhaustive-deps

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-primary-bg flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const uploadSummaries = logs.filter(log => log.context?.action === 'upload_properties');
  const insertErrors = logs.filter(log => log.context?.action === 'insert_property' && log.level === 'error');

  return (
    <div className="min-h-screen bg-primary-bg flex flex-col">
      <Header />

      <div className="flex-1 px-6 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-primary-text mb-2">System Logs</h1>
              <p className="text-secondary-text">View property upload logs and system errors</p>
            </div>
            <div className="flex items-center space-x-4">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as 'all' | 'upload' | 'error')}
                className="px-4 py-2 border border-slate-300 rounded-lg bg-white"
              >
                <option value="upload">Upload Logs</option>
                <option value="error">Error Logs</option>
                <option value="all">All Logs</option>
              </select>
              <button
                onClick={fetchLogs}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-slate-400"
              >
                {loading ? 'Loading...' : 'Refresh'}
              </button>
            </div>
          </div>

          {/* Upload Summaries */}
          {filter === 'upload' && uploadSummaries.length > 0 && (
            <div className="bg-white rounded-xl p-6 shadow-lg mb-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">Upload Summaries</h2>
              <div className="space-y-4">
                {uploadSummaries.map((log) => (
                  <div key={log.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          log.level === 'error' ? 'bg-red-100 text-red-800' :
                          log.level === 'warn' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {log.level.toUpperCase()}
                        </span>
                        <span className="ml-2 text-sm text-slate-500">
                          {log.createdAt?.toDate?.()?.toLocaleString() || 'Unknown time'}
                        </span>
                      </div>
                    </div>
                    <h3 className="font-medium text-slate-900 mb-2">{log.message}</h3>
                    {log.context?.metadata && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="font-medium text-slate-700">File:</span>
                          <p className="text-slate-600">{(log.context.metadata.fileName as string) || 'Unknown'}</p>
                        </div>
                        <div>
                          <span className="font-medium text-slate-700">Total Rows:</span>
                          <p className="text-slate-600">{(log.context.metadata.totalProcessed as string) || (log.context.metadata.totalRows as string) || 'Unknown'}</p>
                        </div>
                        <div>
                          <span className="font-medium text-slate-700">Successful:</span>
                          <p className="text-green-600 font-medium">{(log.context.metadata.successfulInserts as string) || 'Unknown'}</p>
                        </div>
                        <div>
                          <span className="font-medium text-slate-700">Errors:</span>
                          <p className="text-red-600 font-medium">
                            Parse: {(log.context.metadata.parseErrors as number) || 0}, Insert: {(log.context.metadata.insertErrors as number) || 0}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Insert Errors */}
          {filter === 'upload' && insertErrors.length > 0 && (
            <div className="bg-white rounded-xl p-6 shadow-lg mb-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">
                Individual Property Insert Errors ({insertErrors.length})
              </h2>
              <div className="space-y-3">
                {insertErrors.slice(0, 20).map((log) => (
                  <div key={log.id} className="border border-red-200 rounded-lg p-4 bg-red-50">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <h4 className="font-medium text-red-900">
                          Property: {(log.context?.metadata?.property as string) || 'Unknown'}
                        </h4>
                        <p className="text-sm text-red-700">
                          ID: {(log.context?.metadata?.propertyId as string) || 'Unknown'}
                        </p>
                      </div>
                      <span className="text-xs text-red-600">
                        {log.createdAt?.toDate?.()?.toLocaleString() || 'Unknown time'}
                      </span>
                    </div>
                    <div className="mb-2">
                      <span className="font-medium text-red-800">Error Type:</span>
                      <p className="text-red-700">{(log.context?.metadata?.errorType as string) || 'Unknown'}</p>
                    </div>
                    <div className="mb-2">
                      <span className="font-medium text-red-800">Error Message:</span>
                      <p className="text-red-700 text-sm">{(log.context?.metadata?.errorMessage as string) || log.message}</p>
                    </div>
                    {log.stackTrace && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-red-800 font-medium text-sm">Stack Trace</summary>
                        <pre className="mt-2 text-xs text-red-600 bg-red-100 p-2 rounded overflow-x-auto">
                          {log.stackTrace}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
                {insertErrors.length > 20 && (
                  <p className="text-slate-600 text-center py-4">
                    ... and {insertErrors.length - 20} more errors
                  </p>
                )}
              </div>
            </div>
          )}

          {/* All Logs */}
          {filter !== 'upload' && (
            <div className="bg-white rounded-xl p-6 shadow-lg">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">
                Recent Logs ({logs.length})
              </h2>
              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-4 text-slate-600">Loading logs...</p>
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📄</div>
                  <h3 className="text-xl font-semibold text-slate-800 mb-2">No Logs Found</h3>
                  <p className="text-slate-600">No logs match the current filter</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {logs.map((log) => (
                    <div key={log.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            log.level === 'error' ? 'bg-red-100 text-red-800' :
                            log.level === 'warn' ? 'bg-yellow-100 text-yellow-800' :
                            log.level === 'info' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {log.level.toUpperCase()}
                          </span>
                          {log.context?.action && (
                            <span className="px-2 py-1 bg-slate-200 text-slate-700 rounded text-xs">
                              {log.context.action}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-500">
                          {log.createdAt?.toDate?.()?.toLocaleString() || 'Unknown time'}
                        </span>
                      </div>
                      <p className="text-slate-900 mb-2">{log.message}</p>
                      {log.stackTrace && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-slate-700 font-medium text-sm">
                            Stack Trace
                          </summary>
                          <pre className="mt-2 text-xs text-slate-600 bg-slate-100 p-2 rounded overflow-x-auto">
                            {log.stackTrace}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {filter === 'upload' && logs.length === 0 && !loading && (
            <div className="bg-white rounded-xl p-6 shadow-lg">
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📊</div>
                <h3 className="text-xl font-semibold text-slate-800 mb-2">No Upload Logs Found</h3>
                <p className="text-slate-600">No property upload logs found in the system</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}