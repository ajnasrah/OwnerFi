'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface Property {
  id: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  bedrooms: number;
  bathrooms: number;
  squareFeet: number;
  listPrice: number;
  downPaymentAmount: number;
  monthlyPayment: number;
  interestRate: number;
  termYears: number;
  description?: string;
  imageUrl?: string;
}

export default function BuyerPropertiesView() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const buyerId = searchParams.get('buyerId');
  
  const [properties, setProperties] = useState<Property[]>([]);
  const [buyer, setBuyer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (status === 'authenticated') {
      if ((session?.user as any)?.role !== 'realtor') {
        router.push('/auth/signin');
        return;
      }
      
      if (buyerId) {
        fetchBuyerProperties();
      } else {
        setError('No buyer ID provided');
        setLoading(false);
      }
    }
  }, [status, router, session, buyerId]);

  const fetchBuyerProperties = async () => {
    try {
      // First get buyer details
      const buyerResponse = await fetch(`/api/realtor/buyer-details?buyerId=${buyerId}`);
      const buyerData = await buyerResponse.json();
      
      if (buyerData.error) {
        setError(buyerData.error);
        return;
      }
      
      setBuyer(buyerData.buyer);
      
      // Then get their matched properties
      const propertiesResponse = await fetch(`/api/buyer/matched-properties?city=${buyerData.buyer.preferredCity}&maxMonthly=${buyerData.buyer.maxMonthlyPayment}&maxDown=${buyerData.buyer.maxDownPayment}&minBedrooms=${buyerData.buyer.minBedrooms || ''}&minBathrooms=${buyerData.buyer.minBathrooms || ''}`);
      const propertiesData = await propertiesResponse.json();
      
      if (propertiesData.error) {
        setError(propertiesData.error);
      } else {
        setProperties(propertiesData.properties || []);
      }
    } catch (err) {
      setError('Failed to load buyer properties');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-primary-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary mx-auto mb-4"></div>
          <p className="text-secondary-text">Loading properties...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-primary-bg flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-6">{error}</p>
          <Link href="/realtor/dashboard" className="text-blue-600 hover:text-blue-800">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary-bg py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <Link href="/realtor/dashboard" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
            ← Back to Dashboard
          </Link>
          <div className="bg-white rounded-xl p-6 shadow-lg">
            <h1 className="text-2xl font-bold text-primary-text mb-2">
              Properties for {buyer?.firstName} {buyer?.lastName}
            </h1>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-secondary-text">Looking in:</span>
                <div className="font-semibold">{buyer?.preferredCity}, {buyer?.preferredState}</div>
              </div>
              <div>
                <span className="text-secondary-text">Monthly Budget:</span>
                <div className="font-semibold">{formatCurrency(buyer?.maxMonthlyPayment || 0)}</div>
              </div>
              <div>
                <span className="text-secondary-text">Down Payment:</span>
                <div className="font-semibold">{formatCurrency(buyer?.maxDownPayment || 0)}</div>
              </div>
              <div>
                <span className="text-secondary-text">Bedrooms/Baths:</span>
                <div className="font-semibold">{buyer?.minBedrooms || 'Any'}+ bed / {buyer?.minBathrooms || 'Any'}+ bath</div>
              </div>
            </div>
          </div>
        </div>

        {/* Properties Grid */}
        {properties.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl">
            <div className="text-4xl mb-4">🏠</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">No Properties Found</h3>
            <p className="text-gray-600">No properties match this buyer's criteria yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {properties.map((property) => (
              <div key={property.id} className="bg-white rounded-xl shadow-lg overflow-hidden">
                {/* Property Image */}
                <div className="h-48 bg-gray-200 relative overflow-hidden">
                  {property.imageUrl ? (
                    <img 
                      src={property.imageUrl} 
                      alt={property.address}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                      <div className="text-gray-400 text-center">
                        <div className="text-4xl mb-2">🏠</div>
                        <div className="text-sm">No Image</div>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Property Details */}
                <div className="p-5">
                  <div className="mb-3">
                    <h3 className="font-bold text-lg text-primary-text">{property.address}</h3>
                    <p className="text-secondary-text">{property.city}, {property.state} {property.zipCode}</p>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 text-sm mb-4">
                    <div className="text-center">
                      <div className="font-bold text-primary-text">{property.bedrooms}</div>
                      <div className="text-secondary-text">Bedrooms</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-primary-text">{property.bathrooms}</div>
                      <div className="text-secondary-text">Bathrooms</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-primary-text">{property.squareFeet.toLocaleString()}</div>
                      <div className="text-secondary-text">Sq Ft</div>
                    </div>
                  </div>
                  
                  {/* Financial Terms */}
                  <div className="bg-green-50 rounded-lg p-4 mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-2xl text-green-600">{formatCurrency(property.listPrice)}</span>
                      <span className="text-sm text-green-700">{property.interestRate}% APR</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-gray-600">Monthly Payment</div>
                        <div className="font-bold text-green-600">{formatCurrency(property.monthlyPayment)}</div>
                      </div>
                      <div>
                        <div className="text-gray-600">Down Payment</div>
                        <div className="font-bold text-green-600">{formatCurrency(property.downPaymentAmount)}</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Description */}
                  {property.description && (
                    <p className="text-secondary-text text-sm line-clamp-3 mb-4">
                      {property.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}