'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ManualAddCredits() {
  const [email, setEmail] = useState('');
  const [credits, setCredits] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const addCredits = async () => {
    if (!email || !credits) {
      setMessage('Enter email and credits');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/admin/add-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          realtorEmail: email,
          credits: parseInt(credits)
        })
      });

      const data = await response.json();
      setMessage(data.error || 'Credits added successfully!');
    } catch {
      setMessage('Failed to add credits');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-4">Add Credits (Admin)</h1>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Realtor Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg"
              placeholder="realtor@example.com"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Credits to Add
            </label>
            <input
              type="number"
              value={credits}
              onChange={(e) => setCredits(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg"
              placeholder="10"
            />
          </div>
          
          <button
            onClick={addCredits}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Adding...' : 'Add Credits'}
          </button>
          
          {message && (
            <p className={`text-sm ${message.includes('success') ? 'text-green-600' : 'text-red-600'}`}>
              {message}
            </p>
          )}
        </div>

        <div className="mt-6 text-center">
          <Link href="/admin" className="text-gray-600 hover:text-gray-800">← Back to Admin</Link>
        </div>
      </div>
    </div>
  );
}