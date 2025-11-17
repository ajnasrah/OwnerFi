'use client';

import { useState } from 'react';

interface UploadResult {
  success: boolean;
  property?: any;
  error?: string;
}

export default function ManualUploadPage() {
  const [zillowUrl, setZillowUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [uploadHistory, setUploadHistory] = useState<any[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!zillowUrl.trim()) {
      setResult({ success: false, error: 'Please enter a Zillow URL' });
      return;
    }

    // Validate Zillow URL
    if (!zillowUrl.includes('zillow.com')) {
      setResult({ success: false, error: 'Invalid Zillow URL' });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/admin/manual-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zillowUrl }),
      });

      const data = await response.json();

      if (response.ok) {
        setResult({ success: true, property: data.property });
        setUploadHistory([data.property, ...uploadHistory]);
        setZillowUrl(''); // Clear input
      } else {
        setResult({ success: false, error: data.error || 'Upload failed' });
      }
    } catch (error: any) {
      setResult({ success: false, error: error.message || 'Network error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Manual Property Upload
          </h1>
          <p className="text-gray-600">
            Upload verified owner financing properties from your outreach system.
            These properties bypass filters since you've confirmed with the agent.
          </p>
        </div>

        {/* Upload Form */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="zillowUrl" className="block text-sm font-medium text-gray-700 mb-2">
                Zillow Property URL
              </label>
              <input
                type="text"
                id="zillowUrl"
                value={zillowUrl}
                onChange={(e) => setZillowUrl(e.target.value)}
                placeholder="https://www.zillow.com/homedetails/..."
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 px-4 rounded-md font-medium text-white ${
                loading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Scraping & Adding Property...
                </span>
              ) : (
                'Upload Property'
              )}
            </button>
          </form>

          {/* Result Message */}
          {result && (
            <div className={`mt-4 p-4 rounded-md ${
              result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}>
              {result.success ? (
                <div>
                  <h3 className="text-green-800 font-medium mb-2">✅ Property Added Successfully!</h3>
                  <div className="text-sm text-green-700">
                    <p><strong>Address:</strong> {result.property?.fullAddress || 'N/A'}</p>
                    <p><strong>Price:</strong> ${result.property?.price?.toLocaleString() || 'N/A'}</p>
                    <p><strong>Beds/Baths:</strong> {result.property?.bedrooms || 0}bd / {result.property?.bathrooms || 0}ba</p>
                    <p className="mt-2 text-xs bg-green-100 px-2 py-1 rounded inline-block">
                      🎯 Manually Verified - Bypassed Filters
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  <h3 className="text-red-800 font-medium mb-2">❌ Upload Failed</h3>
                  <p className="text-sm text-red-700">{result.error}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Upload Statistics */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-blue-600">{uploadHistory.length}</div>
            <div className="text-sm text-gray-600">Properties Uploaded</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-green-600">
              {uploadHistory.filter(p => p.price).length}
            </div>
            <div className="text-sm text-gray-600">With Price Data</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-purple-600">
              {uploadHistory.filter(p => p.agentPhoneNumber).length}
            </div>
            <div className="text-sm text-gray-600">With Agent Contact</div>
          </div>
        </div>

        {/* Upload History */}
        {uploadHistory.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Recent Uploads ({uploadHistory.length})
            </h2>
            <div className="space-y-3">
              {uploadHistory.map((property, index) => (
                <div
                  key={index}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">
                        {property.fullAddress || property.streetAddress || 'Unknown Address'}
                      </h3>
                      <div className="mt-1 text-sm text-gray-600 space-y-1">
                        <div className="flex items-center space-x-4">
                          <span>💰 ${property.price?.toLocaleString() || 'N/A'}</span>
                          <span>🏠 {property.bedrooms || 0}bd / {property.bathrooms || 0}ba</span>
                          <span>📐 {property.squareFoot?.toLocaleString() || 'N/A'} sqft</span>
                        </div>
                        {property.agentPhoneNumber && (
                          <div>📞 Agent: {property.agentPhoneNumber}</div>
                        )}
                      </div>
                    </div>
                    <div className="ml-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        ✓ Manually Verified
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-blue-900 mb-2">
            📋 How It Works
          </h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
            <li>Paste the Zillow property URL you received from your outreach system</li>
            <li>The system scrapes full property details via Apify</li>
            <li><strong>Filters are bypassed</strong> since you've manually verified owner financing</li>
            <li>Property is marked as "Manually Verified" in the database</li>
            <li>Property appears immediately in the buyer dashboard</li>
          </ol>
          <div className="mt-4 p-3 bg-blue-100 rounded text-sm text-blue-900">
            <strong>💡 Tip:</strong> These properties won't be filtered out even if the description says "no owner financing"
            because you've confirmed with the agent directly.
          </div>
        </div>
      </div>
    </div>
  );
}
