'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

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

export default function ScraperPage() {
  const [progress, setProgress] = useState<UploadProgress>({
    status: 'idle',
    message: 'Upload an Excel or CSV file to begin',
  });

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

    } catch (error: any) {
      setProgress({
        status: 'error',
        message: error.message || 'Failed to upload file',
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
      <a href="/admin" className="text-emerald-400 hover:text-emerald-300 text-sm mb-4 inline-block">← Back to Admin</a>
      <h1 className="text-3xl font-bold mb-2 text-white">Zillow Property Scraper</h1>
      <p className="text-slate-400 mb-8">
        Upload CSV or Excel files with Zillow property URLs to automatically scrape and import
      </p>

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
