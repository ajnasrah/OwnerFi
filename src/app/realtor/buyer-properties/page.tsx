'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function RealtorBuyerPropertiesView() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const buyerId = searchParams.get('buyerId');
  
  const [properties, setProperties] = useState<Record<string, unknown>[]>([]);
  const [buyer, setBuyer] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTab, setSelectedTab] = useState<'pending' | 'liked' | 'disliked'>('pending');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/realtor/signin');
    } else if (status === 'authenticated') {
      if (session?.user?.role !== 'realtor') {
        router.push('/realtor/signin');
      } else if (buyerId) {
        loadBuyerData();
      }
    }
  }, [status, router, session, buyerId]);

  const loadBuyerData = async () => {
    try {
      setLoading(true);
      
      // Get buyer profile
      const buyerResponse = await fetch(`/api/realtor/buyer-details?buyerId=${buyerId}`);
      const buyerData = await buyerResponse.json();
      
      if (buyerData.error) {
        setError(buyerData.error);
        return;
      }
      
      setBuyer(buyerData.buyer);
      console.log(`👤 Loaded buyer: ${buyerData.buyer.firstName} ${buyerData.buyer.lastName}`);
      
      // Load properties using unified API (same as buyer dashboard)
      await loadPropertiesForTab('pending');

    } catch (error) {
      setError('Failed to load buyer data');
    } finally {
      setLoading(false);
    }
  };

  const loadPropertiesForTab = async (tab: string) => {
    try {
      // Use identical API as buyer dashboard
      const propertiesResponse = await fetch(`/api/buyer/properties?buyerId=${buyerId}&status=${tab}`);
      const propertiesData = await propertiesResponse.json();
      
      if (!propertiesData.error) {
        setProperties(propertiesData.properties || []);
        console.log(`📦 Realtor view: ${propertiesData.properties?.length || 0} ${tab} properties`);
      } else {
        setProperties([]);
      }
    } catch (error) {
      console.error('Properties load error:', error);
      setProperties([]);
    }
  };

  const capitalizeFirstLetter = (str: string) => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!buyer) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Buyer Not Found</h2>
          <Link href="/realtor/dashboard" className="text-blue-600 hover:text-blue-800">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        
        {/* Header */}
        <div className="mb-8">
          <Link href="/realtor/dashboard" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
            ← Back to Dashboard
          </Link>
          
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Properties for {capitalizeFirstLetter(buyer.firstName)} {capitalizeFirstLetter(buyer.lastName)}
            </h1>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Location:</span>
                <div className="font-semibold">{buyer.searchCriteria?.cities?.[0]}, {buyer.searchCriteria?.state}</div>
              </div>
              <div>
                <span className="text-gray-500">Monthly Budget:</span>
                <div className="font-semibold">${buyer.searchCriteria?.maxMonthlyPayment?.toLocaleString()}</div>
              </div>
              <div>
                <span className="text-gray-500">Down Payment:</span>
                <div className="font-semibold">${buyer.searchCriteria?.maxDownPayment?.toLocaleString()}</div>
              </div>
              <div>
                <span className="text-gray-500">Contact:</span>
                <div className="font-semibold">{buyer.phone}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="bg-white rounded-xl p-1 shadow-sm">
            <div className="flex">
              {[
                { key: 'pending', label: 'Available', icon: '🏠' },
                { key: 'liked', label: 'Interested', icon: '❤️' },
                { key: 'disliked', label: 'Passed', icon: '👎' }
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => {
                    setSelectedTab(tab.key as 'pending' | 'liked' | 'disliked');
                    loadPropertiesForTab(tab.key);
                  }}
                  className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all ${
                    selectedTab === tab.key
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Properties Grid */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {properties.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl">
            <div className="text-4xl mb-4">
              {selectedTab === 'pending' && '🏠'}
              {selectedTab === 'liked' && '❤️'}
              {selectedTab === 'disliked' && '👎'}
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">
              No {selectedTab === 'pending' ? 'Available' : selectedTab === 'liked' ? 'Liked' : 'Passed'} Properties
            </h3>
            <p className="text-gray-600">
              This buyer hasn't {selectedTab === 'pending' ? 'found any properties yet' : selectedTab === 'liked' ? 'liked any properties yet' : 'passed on any properties yet'}.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {properties.map((property) => (
              <div key={property.id} className="bg-white rounded-xl shadow-sm overflow-hidden border">
                
                {/* Property Image */}
                <div className="h-48 bg-gray-200 relative">
                  <img 
                    src={`https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=400&h=300&fit=crop&seed=${property.id}`}
                    alt={property.address}
                    className="w-full h-full object-cover"
                  />
                  
                  {/* Status Badge */}
                  <div className={`absolute top-3 left-3 px-2 py-1 rounded-full text-xs font-medium ${
                    property.buyerStatus === 'liked' 
                      ? 'bg-green-500 text-white'
                      : property.buyerStatus === 'disliked'
                      ? 'bg-red-500 text-white'  
                      : 'bg-blue-500 text-white'
                  }`}>
                    {property.buyerStatus === 'liked' ? '❤️ Liked' : 
                     property.buyerStatus === 'disliked' ? '👎 Passed' : 
                     '🏠 Available'}
                  </div>

                  {/* Match Score */}
                  <div className="absolute top-3 right-3 bg-white/90 text-gray-800 px-2 py-1 rounded-full text-xs font-bold">
                    {property.matchScore}% match
                  </div>
                </div>

                {/* Property Details */}
                <div className="p-4">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">
                    ${property.listPrice?.toLocaleString()}
                  </h3>
                  <p className="text-gray-600 text-sm mb-2">{property.address}</p>
                  <p className="text-gray-500 text-sm mb-4">{property.city}, {property.state} {property.zipCode}</p>
                  
                  {/* Property Stats */}
                  <div className="flex justify-between text-sm text-gray-600 mb-4">
                    <span>{property.bedrooms} bed</span>
                    <span>{property.bathrooms} bath</span>
                    <span>{property.squareFeet?.toLocaleString()} sq ft</span>
                  </div>
                  
                  {/* Financing */}
                  <div className="bg-green-50 rounded-lg p-3 mb-4">
                    <div className="text-sm font-medium text-green-800 mb-2">Owner Financing</div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-green-600">Monthly:</span>
                        <div className="font-bold text-green-800">${property.monthlyPayment?.toLocaleString()}</div>
                      </div>
                      <div>
                        <span className="text-green-600">Down:</span>
                        <div className="font-bold text-green-800">${property.downPaymentAmount?.toLocaleString()}</div>
                      </div>
                    </div>
                  </div>

                  {/* More Details Button */}
                  <a
                    href={`https://www.google.com/search?q=${encodeURIComponent(`${property.address} ${property.city}, ${property.state} ${property.zipCode}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center space-x-2 text-blue-600 hover:text-blue-800 font-medium transition-colors border border-blue-200 rounded-lg px-3 py-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <span>Research Property</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}