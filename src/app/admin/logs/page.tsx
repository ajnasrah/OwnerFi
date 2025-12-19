'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
      router.push('/auth');
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
    } catch {
      // Failed to fetch logs
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'authenticated') {
      fetchLogs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, filter]);

  if (status === 'loading') {
    return (
      <div className="h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400"></div>
      </div>
    );
  }

  const uploadSummaries = logs.filter(log => log.context?.action === 'upload_properties');
  const insertErrors = logs.filter(log => log.context?.action === 'insert_property' && log.level === 'error');

  return (
    <div className="h-screen overflow-hidden bg-slate-900 flex flex-col">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto">
          <Link href="/admin" className="text-emerald-400 hover:text-emerald-300 text-sm mb-4 inline-block">← Back to Admin</Link>
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">System Logs</h1>
              <p className="text-slate-400">View property upload logs and system errors</p>
            </div>
            <div className="flex items-center space-x-4">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as 'all' | 'upload' | 'error')}
                className="px-4 py-2 border border-slate-600 rounded-lg bg-slate-800 text-white"
              >
                <option value="upload">Upload Logs</option>
                <option value="error">Error Logs</option>
                <option value="all">All Logs</option>
              </select>
              <button
                onClick={fetchLogs}
                disabled={loading}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:bg-slate-600"
              >
                {loading ? 'Loading...' : 'Refresh'}
              </button>
            </div>
          </div>

          {/* Upload Summaries */}
          {filter === 'upload' && uploadSummaries.length > 0 && (
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-6">
              <h2 className="text-xl font-semibold text-white mb-4">Upload Summaries</h2>
              <div className="space-y-4">
                {uploadSummaries.map((log) => (
                  <div key={log.id} className="border border-slate-600 rounded-lg p-4 bg-slate-700/50">
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
                          {(() => {
                            const ts = log.createdAt as unknown;
                            if (!ts) return 'Unknown time';
                            if (typeof ts === 'object' && ts !== null && 'toDate' in ts && typeof (ts as { toDate: () => Date }).toDate === 'function') return (ts as { toDate: () => Date }).toDate().toLocaleString();
                            if (typeof ts === 'object' && ts !== null && '_seconds' in ts && typeof (ts as { _seconds: number })._seconds === 'number') return new Date((ts as { _seconds: number })._seconds * 1000).toLocaleString();
                            if (typeof ts === 'object' && ts !== null && 'seconds' in ts && typeof (ts as { seconds: number }).seconds === 'number') return new Date((ts as { seconds: number }).seconds * 1000).toLocaleString();
                            const date = new Date(ts as string | number);
                            return isNaN(date.getTime()) ? 'Unknown time' : date.toLocaleString();
                          })()}
                        </span>
                      </div>
                    </div>
                    <h3 className="font-medium text-white mb-2">{log.message}</h3>
                    {log.context?.metadata && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="font-medium text-slate-300">File:</span>
                          <p className="text-slate-400">{(log.context.metadata.fileName as string) || 'Unknown'}</p>
                        </div>
                        <div>
                          <span className="font-medium text-slate-300">Total Rows:</span>
                          <p className="text-slate-400">{(log.context.metadata.totalProcessed as string) || (log.context.metadata.totalRows as string) || 'Unknown'}</p>
                        </div>
                        <div>
                          <span className="font-medium text-slate-300">Successful:</span>
                          <p className="text-emerald-400 font-medium">{(log.context.metadata.successfulInserts as string) || 'Unknown'}</p>
                        </div>
                        <div>
                          <span className="font-medium text-slate-300">Errors:</span>
                          <p className="text-red-400 font-medium">
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
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-6">
              <h2 className="text-xl font-semibold text-white mb-4">
                Individual Property Insert Errors ({insertErrors.length})
              </h2>
              <div className="space-y-3">
                {insertErrors.slice(0, 20).map((log) => (
                  <div key={log.id} className="border border-red-700 rounded-lg p-4 bg-red-900/30">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <h4 className="font-medium text-red-300">
                          Property: {(log.context?.metadata?.property as string) || 'Unknown'}
                        </h4>
                        <p className="text-sm text-red-400">
                          ID: {(log.context?.metadata?.propertyId as string) || 'Unknown'}
                        </p>
                      </div>
                      <span className="text-xs text-red-400">
                        {(() => {
                          const ts = log.createdAt as unknown;
                          if (!ts) return 'Unknown time';
                          if (typeof ts === 'object' && ts !== null && 'toDate' in ts && typeof (ts as { toDate: () => Date }).toDate === 'function') return (ts as { toDate: () => Date }).toDate().toLocaleString();
                          if (typeof ts === 'object' && ts !== null && '_seconds' in ts && typeof (ts as { _seconds: number })._seconds === 'number') return new Date((ts as { _seconds: number })._seconds * 1000).toLocaleString();
                          if (typeof ts === 'object' && ts !== null && 'seconds' in ts && typeof (ts as { seconds: number }).seconds === 'number') return new Date((ts as { seconds: number }).seconds * 1000).toLocaleString();
                          const date = new Date(ts as string | number);
                          return isNaN(date.getTime()) ? 'Unknown time' : date.toLocaleString();
                        })()}
                      </span>
                    </div>
                    <div className="mb-2">
                      <span className="font-medium text-red-300">Error Type:</span>
                      <p className="text-red-400">{(log.context?.metadata?.errorType as string) || 'Unknown'}</p>
                    </div>
                    <div className="mb-2">
                      <span className="font-medium text-red-300">Error Message:</span>
                      <p className="text-red-400 text-sm">{(log.context?.metadata?.errorMessage as string) || log.message}</p>
                    </div>
                    {log.stackTrace && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-red-300 font-medium text-sm">Stack Trace</summary>
                        <pre className="mt-2 text-xs text-red-400 bg-red-900/50 p-2 rounded overflow-x-auto">
                          {log.stackTrace}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
                {insertErrors.length > 20 && (
                  <p className="text-slate-400 text-center py-4">
                    ... and {insertErrors.length - 20} more errors
                  </p>
                )}
              </div>
            </div>
          )}

          {/* All Logs */}
          {filter !== 'upload' && (
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
              <h2 className="text-xl font-semibold text-white mb-4">
                Recent Logs ({logs.length})
              </h2>
              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400 mx-auto"></div>
                  <p className="mt-4 text-slate-400">Loading logs...</p>
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📄</div>
                  <h3 className="text-xl font-semibold text-white mb-2">No Logs Found</h3>
                  <p className="text-slate-400">No logs match the current filter</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {logs.map((log) => (
                    <div key={log.id} className="border border-slate-600 rounded-lg p-4 bg-slate-700/50">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            log.level === 'error' ? 'bg-red-900/50 text-red-300' :
                            log.level === 'warn' ? 'bg-yellow-900/50 text-yellow-300' :
                            log.level === 'info' ? 'bg-blue-900/50 text-blue-300' :
                            'bg-slate-600 text-slate-300'
                          }`}>
                            {log.level.toUpperCase()}
                          </span>
                          {log.context?.action && (
                            <span className="px-2 py-1 bg-slate-600 text-slate-300 rounded text-xs">
                              {log.context.action}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-400">
                          {(() => {
                            const ts = log.createdAt as unknown;
                            if (!ts) return 'Unknown time';
                            if (typeof ts === 'object' && ts !== null && 'toDate' in ts && typeof (ts as { toDate: () => Date }).toDate === 'function') return (ts as { toDate: () => Date }).toDate().toLocaleString();
                            if (typeof ts === 'object' && ts !== null && '_seconds' in ts && typeof (ts as { _seconds: number })._seconds === 'number') return new Date((ts as { _seconds: number })._seconds * 1000).toLocaleString();
                            if (typeof ts === 'object' && ts !== null && 'seconds' in ts && typeof (ts as { seconds: number }).seconds === 'number') return new Date((ts as { seconds: number }).seconds * 1000).toLocaleString();
                            const date = new Date(ts as string | number);
                            return isNaN(date.getTime()) ? 'Unknown time' : date.toLocaleString();
                          })()}
                        </span>
                      </div>
                      <p className="text-white mb-2">{log.message}</p>
                      {log.stackTrace && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-slate-300 font-medium text-sm">
                            Stack Trace
                          </summary>
                          <pre className="mt-2 text-xs text-slate-400 bg-slate-900 p-2 rounded overflow-x-auto">
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
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📊</div>
                <h3 className="text-xl font-semibold text-white mb-2">No Upload Logs Found</h3>
                <p className="text-slate-400">No property upload logs found in the system</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}