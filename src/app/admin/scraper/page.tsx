'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import Link from 'next/link';

interface UploadProgress {
  status: 'idle' | 'uploading' | 'scraping' | 'complete' | 'error';
  message: string;
  urlsFound?: number;
  propertiesScraped?: number;
  total?: number;
  duplicatesInFile?: number;
  alreadyInDatabase?: number;
  newProperties?: number;
}

interface QuickAddResult {
  url: string;
  status: 'pending' | 'adding' | 'added' | 'exists' | 'error';
  message?: string;
}

export default function ScraperPage() {
  const [progress, setProgress] = useState<UploadProgress>({
    status: 'idle',
    message: 'Upload an Excel or CSV file to begin',
  });

  // Quick add state
  const [quickUrl, setQuickUrl] = useState('');
  const [quickResults, setQuickResults] = useState<QuickAddResult[]>([]);
  const [quickAdding, setQuickAdding] = useState(false);

  const handleQuickAdd = async () => {
    // Parse URLs (one per line or comma separated)
    const urls = quickUrl
      .split(/[\n,]/)
      .map(u => u.trim())
      .filter(u => u.includes('zillow.com'));

    if (urls.length === 0) {
      alert('No valid Zillow URLs found');
      return;
    }

    setQuickAdding(true);
    setQuickResults(urls.map(url => ({ url, status: 'pending' })));

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];

      setQuickResults(prev => prev.map((r, idx) =>
        idx === i ? { ...r, status: 'adding' } : r
      ));

      try {
        const response = await fetch('/api/v2/scraper/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        });

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed');
        }

        // Check results from v2 endpoint
        const result = data.results?.[0];
        if (result?.skipped && result?.skipReason?.includes('Duplicate')) {
          setQuickResults(prev => prev.map((r, idx) =>
            idx === i ? { ...r, status: 'exists', message: result.skipReason } : r
          ));
        } else if (result?.skipped) {
          setQuickResults(prev => prev.map((r, idx) =>
            idx === i ? { ...r, status: 'error', message: result.skipReason || 'Skipped' } : r
          ));
        } else if (result?.savedTo?.length > 0) {
          setQuickResults(prev => prev.map((r, idx) =>
            idx === i ? { ...r, status: 'added', message: `Added as ${result.savedTo.join(', ')}` } : r
          ));
        } else {
          throw new Error(result?.error || 'No results returned');
        }
      } catch (error) {
        setQuickResults(prev => prev.map((r, idx) =>
          idx === i ? { ...r, status: 'error', message: error instanceof Error ? error.message : 'Unknown error' } : r
        ));
      }

      // Small delay
      if (i < urls.length - 1) {
        await new Promise(r => setTimeout(r, 300));
      }
    }

    setQuickAdding(false);
    setQuickUrl('');
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setProgress({
      status: 'uploading',
      message: `Uploading ${file.name}...`,
    });

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/admin/scraper/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const data = await response.json();

      let message = `Found ${data.urlsFound} URLs in file.`;
      if (data.duplicatesInFile > 0) {
        message += ` Removed ${data.duplicatesInFile} duplicates within file.`;
      }
      if (data.alreadyInDatabase > 0) {
        message += ` ${data.alreadyInDatabase} already in database.`;
      }
      message += ` Importing ${data.newProperties} new properties...`;

      setProgress({
        status: 'scraping',
        message,
        urlsFound: data.urlsFound,
        duplicatesInFile: data.duplicatesInFile,
        alreadyInDatabase: data.alreadyInDatabase,
        newProperties: data.newProperties,
      });

      // Poll for job status
      pollJobStatus(data.jobId);

    } catch (error) {
      setProgress({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to upload file',
      });
    }
  }, []);

  const pollJobStatus = async (jobId: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/admin/scraper/status?jobId=${jobId}`);
        const data = await response.json();

        if (data.status === 'complete') {
          clearInterval(interval);
          setProgress({
            status: 'complete',
            message: `✅ Complete! Imported ${data.imported} properties to Firebase`,
            propertiesScraped: data.imported,
            total: data.total,
          });
        } else if (data.status === 'error') {
          clearInterval(interval);
          setProgress({
            status: 'error',
            message: `❌ Error: ${data.error}`,
          });
        } else {
          setProgress({
            status: 'scraping',
            message: `Scraping... ${data.progress || 0}% complete`,
            propertiesScraped: data.imported || 0,
            total: data.total || 0,
          });
        }
      } catch (error) {
        console.error('Error polling status:', error);
      }
    }, 3000); // Poll every 3 seconds
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    multiple: false,
  });

  return (
    <div className="h-screen overflow-hidden bg-slate-900 flex flex-col">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
      <Link href="/admin" className="text-emerald-400 hover:text-emerald-300 text-sm mb-4 inline-block">← Back to Admin</Link>
      <h1 className="text-3xl font-bold mb-2 text-white">Zillow Property Scraper</h1>
      <p className="text-slate-400 mb-8">
        Add Zillow URLs to queue for scraping and GHL agent outreach
      </p>

      {/* Quick Add Section */}
      <div className="mb-8 p-6 bg-slate-800 border border-slate-700 rounded-lg">
        <h2 className="text-lg font-semibold mb-3 text-white">Quick Add URLs</h2>
        <p className="text-sm text-slate-400 mb-4">Paste Zillow URLs (one per line) to add to scraper queue</p>

        <textarea
          value={quickUrl}
          onChange={(e) => setQuickUrl(e.target.value)}
          placeholder="https://www.zillow.com/homedetails/123-Main-St/12345678_zpid/"
          className="w-full h-24 bg-slate-900 border border-slate-600 rounded-lg p-3 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-sm font-mono"
          disabled={quickAdding}
        />

        <div className="mt-3 flex items-center gap-4">
          <button
            onClick={handleQuickAdd}
            disabled={quickAdding || !quickUrl.trim()}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              quickAdding || !quickUrl.trim()
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {quickAdding ? 'Adding...' : 'Add to Queue'}
          </button>

          {quickResults.length > 0 && (
            <span className="text-sm text-slate-400">
              {quickResults.filter(r => r.status === 'added').length} added,{' '}
              {quickResults.filter(r => r.status === 'exists').length} already exist
            </span>
          )}
        </div>

        {/* Quick add results */}
        {quickResults.length > 0 && (
          <div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
            {quickResults.map((result, idx) => (
              <div
                key={idx}
                className={`text-sm px-3 py-2 rounded flex items-center justify-between ${
                  result.status === 'added'
                    ? 'bg-emerald-900/30 text-emerald-300'
                    : result.status === 'exists'
                    ? 'bg-yellow-900/30 text-yellow-300'
                    : result.status === 'error'
                    ? 'bg-red-900/30 text-red-300'
                    : result.status === 'adding'
                    ? 'bg-blue-900/30 text-blue-300'
                    : 'bg-slate-700 text-slate-400'
                }`}
              >
                <span className="truncate flex-1 font-mono text-xs">{result.url.slice(0, 60)}...</span>
                <span className="ml-2 whitespace-nowrap">
                  {result.status === 'adding' && '...'}
                  {result.status === 'added' && '✓ Added'}
                  {result.status === 'exists' && '⚠ Exists'}
                  {result.status === 'error' && '✗ Error'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="relative mb-8">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-700"></div>
        </div>
        <div className="relative flex justify-center">
          <span className="px-3 bg-slate-900 text-slate-500 text-sm">or upload a file</span>
        </div>
      </div>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors
          ${isDragActive ? 'border-emerald-500 bg-emerald-900/20' : 'border-slate-600 hover:border-slate-500'}
          ${progress.status === 'uploading' || progress.status === 'scraping' ? 'opacity-50 pointer-events-none' : ''}
        `}
      >
        <input {...getInputProps()} />

        <div className="mb-4">
          <svg
            className="mx-auto h-12 w-12 text-slate-500"
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
          >
            <path
              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {isDragActive ? (
          <p className="text-lg text-emerald-400">Drop the file here...</p>
        ) : (
          <div>
            <p className="text-lg mb-2 text-white">Drag & drop an Excel or CSV file here</p>
            <p className="text-sm text-slate-400">or click to select a file</p>
          </div>
        )}
      </div>

      {/* Progress */}
      {progress.status !== 'idle' && (
        <div className="mt-8">
          <div
            className={`p-6 rounded-lg border ${
              progress.status === 'error'
                ? 'bg-red-900/30 border-red-700'
                : progress.status === 'complete'
                ? 'bg-emerald-900/30 border-emerald-700'
                : 'bg-blue-900/30 border-blue-700'
            }`}
          >
            <div className="flex items-start">
              {progress.status === 'uploading' || progress.status === 'scraping' ? (
                <div className="mr-3">
                  <div className="animate-spin h-6 w-6 border-2 border-emerald-400 border-t-transparent rounded-full"></div>
                </div>
              ) : progress.status === 'complete' ? (
                <svg
                  className="h-6 w-6 text-emerald-400 mr-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              ) : progress.status === 'error' ? (
                <svg
                  className="h-6 w-6 text-red-400 mr-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : null}

              <div className="flex-1">
                <p className="font-semibold text-lg mb-1 text-white">{progress.message}</p>

                <div className="mt-3 space-y-1">
                  {progress.urlsFound !== undefined && (
                    <p className="text-sm text-slate-300">
                      <span className="font-medium">URLs in file:</span> {progress.urlsFound}
                    </p>
                  )}

                  {progress.duplicatesInFile !== undefined && progress.duplicatesInFile > 0 && (
                    <p className="text-sm text-orange-400">
                      <span className="font-medium">Duplicates in file:</span> {progress.duplicatesInFile}
                    </p>
                  )}

                  {progress.alreadyInDatabase !== undefined && progress.alreadyInDatabase > 0 && (
                    <p className="text-sm text-orange-400">
                      <span className="font-medium">Already in database:</span> {progress.alreadyInDatabase}
                    </p>
                  )}

                  {progress.newProperties !== undefined && (
                    <p className="text-sm text-emerald-400 font-medium">
                      <span>New properties:</span> {progress.newProperties}
                    </p>
                  )}

                  {progress.propertiesScraped !== undefined && (
                    <p className="text-sm text-slate-300 mt-2">
                      <span className="font-medium">Properties imported:</span> {progress.propertiesScraped}
                      {progress.total && ` / ${progress.total}`}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-12 bg-slate-800 border border-slate-700 p-6 rounded-lg">
        <h2 className="text-lg font-semibold mb-3 text-white">How it works</h2>
        <ol className="list-decimal list-inside space-y-2 text-slate-300">
          <li>Upload a CSV or Excel file containing Zillow property URLs</li>
          <li>The system automatically removes duplicates within the file</li>
          <li>Checks against existing properties in the database</li>
          <li>Only new properties are sent to Apify for scraping</li>
          <li>All data is saved to the <code className="bg-slate-700 px-2 py-1 rounded text-emerald-400">zillow_imports</code> collection</li>
          <li>Review imported properties in Firebase before moving to production</li>
        </ol>

        <div className="mt-4 p-4 bg-emerald-900/30 border border-emerald-700 rounded">
          <p className="text-sm font-medium text-emerald-300 mb-1">✓ Duplicate Protection</p>
          <p className="text-sm text-emerald-200">
            The scraper automatically prevents importing duplicate properties. It checks both within your file and against existing database records.
          </p>
        </div>

        <div className="mt-4 p-4 bg-blue-900/30 border border-blue-700 rounded">
          <p className="text-sm font-medium text-blue-300 mb-1">Expected File Format</p>
          <p className="text-sm text-blue-200">
            Your file should have a column named <strong>URL</strong>, <strong>url</strong>, or{' '}
            <strong>link</strong> containing Zillow property URLs
          </p>
        </div>
      </div>
        </div>
      </div>
    </div>
  );
}
