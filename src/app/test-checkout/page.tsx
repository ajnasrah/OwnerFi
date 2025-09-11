'use client';

import { useState } from 'react';

export default function TestCheckout() {
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const testSubscription = async () => {
    setLoading(true);
    setResult('Testing...');
    
    try {
      
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: 'price_1S18NlJkpg3x1io7vUCoetwT',
          planId: 'professional',
          billingType: 'monthly'
        })
      });
      
      const data = await response.json();
      
      if (response.ok && data.url) {
        setResult(`SUCCESS! Checkout URL generated: ${data.url}`);
        setTimeout(() => {
          window.open(data.url, '_blank');
        }, 1000);
      } else {
        setResult(`API Error: ${JSON.stringify(data, null, 2)}`);
      }
    } catch (error) {
      setResult(`Network Error: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-2xl mx-auto bg-white rounded-lg p-6">
        <h1 className="text-2xl font-bold mb-4">Subscription API Test</h1>
        
        <button
          onClick={testSubscription}
          disabled={loading}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? 'Testing...' : 'Test Professional Plan Subscription'}
        </button>
        
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold mb-2">Result:</h3>
          <pre className="text-sm whitespace-pre-wrap">{result}</pre>
        </div>
        
        <div className="mt-4 text-sm text-gray-600">
          <p>This tests the /api/stripe/checkout endpoint directly with:</p>
          <ul className="list-disc ml-6 mt-2">
            <li>priceId: price_1S18NlJkpg3x1io7vUCoetwT (Professional)</li>
            <li>planId: professional</li>
            <li>billingType: monthly</li>
          </ul>
        </div>
      </div>
    </div>
  );
}