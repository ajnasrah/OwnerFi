'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/ui/Header';
import { Footer } from '@/components/ui/Footer';

import { PropertyListing } from '@/lib/property-schema';

type Property = PropertyListing & {
  isLiked: boolean;
  zillowImageUrl?: string;
  imageUrl?: string;
};

interface BuyerProfile {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  city: string;
  maxMonthlyPayment?: number;
  maxDownPayment?: number;
  likedProperties?: string[];
}

export default function LikedProperties() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [properties, setProperties] = useState<Property[]>([]);
  const [profile, setProfile] = useState<BuyerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Auth check
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (status === 'authenticated' && session?.user?.role !== 'buyer') {
      router.push('/auth/signin');
    }
  }, [status, session, router]);

  // Load liked properties
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role === 'buyer') {
      loadLikedProperties();
    }
  }, [status, session]);

  const loadLikedProperties = async () => {
    try {
      setLoading(true);

      const response = await fetch('/api/buyer/liked-properties');
      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else {
        setProperties(data.likedProperties || []);
        setProfile(data.profile);
        
        console.log(`❤️ LOADED ${data.likedProperties?.length || 0} liked properties`);
      }

    } catch (err) {
      console.error('Failed to load liked properties:', err);
      setError('Failed to load your liked properties');
    } finally {
      setLoading(false);
    }
  };

  const removeLike = async (propertyId: string) => {
    try {
      const response = await fetch('/api/buyer/like-property', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId, action: 'unlike' })
      });

      if (response.ok) {
        setProperties(prev => prev.filter(p => p.id !== propertyId));
      }
    } catch (error) {
      console.error('Failed to remove like:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading your liked properties...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1 px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  ❤️ Liked Properties
                </h1>
                <p className="text-gray-600 mt-2">
                  Properties you've saved for consideration
                </p>
              </div>
              <Link 
                href="/dashboard"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                ← Back to All Properties
              </Link>
            </div>
          </div>

          {/* Debug Profile Info */}
          {profile && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="font-medium text-blue-900 mb-2">Your Profile</h3>
              <div className="text-sm text-blue-800">
                <p><strong>Name:</strong> {profile.firstName} {profile.lastName}</p>
                <p><strong>Email:</strong> {profile.email}</p>
                <p><strong>Phone:</strong> {profile.phone || 'Not provided'}</p>
                <p><strong>City:</strong> {profile.city}</p>
                <p><strong>Max Monthly:</strong> ${profile.maxMonthlyPayment?.toLocaleString()}</p>
                <p><strong>Max Down:</strong> ${profile.maxDownPayment?.toLocaleString()}</p>
                <p><strong>Liked Properties:</strong> {profile.likedProperties?.length || 0}</p>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {/* Liked Properties Grid */}
          {properties.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {properties.map((property) => (
                <div key={property.id} className="bg-white rounded-lg shadow-md overflow-hidden border-2 border-red-200">
                  {/* Property Image */}
                  <div className="w-full h-48 bg-gray-200 overflow-hidden relative">
                    <img
                      src={
                        property.zillowImageUrl || 
                        property.imageUrl ||
                        `https://maps.googleapis.com/maps/api/streetview?size=400x300&location=${encodeURIComponent(property.address + ', ' + property.city + ', ' + property.state)}&key=AIzaSyCelger3EPc8GzTOQq7-cv6tUeVh_XN9jE`
                      }
                      alt={property.address}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = `https://maps.googleapis.com/maps/api/streetview?size=400x300&location=${encodeURIComponent(property.address + ', ' + property.city + ', ' + property.state)}&key=AIzaSyCelger3EPc8GzTOQq7-cv6tUeVh_XN9jE`;
                      }}
                    />
                    <div className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-medium">
                      ❤️ Liked
                    </div>
                  </div>
                  
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {property.address}
                    </h3>
                    <p className="text-gray-600 mb-4">
                      {property.city}, {property.state}
                    </p>
                    
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between">
                        <span className="text-gray-600">List Price:</span>
                        <span className="font-semibold">${property.listPrice?.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Monthly Payment:</span>
                        <span className="font-semibold text-green-600">${property.monthlyPayment?.toLocaleString()}/mo</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Down Payment:</span>
                        <span className="font-semibold text-blue-600">${property.downPaymentAmount?.toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="flex justify-between text-sm text-gray-600 mb-4">
                      <span>{property.bedrooms} bed</span>
                      <span>{property.bathrooms} bath</span>
                      <span>{property.squareFeet?.toLocaleString()} sq ft</span>
                    </div>

                    {property.description && (
                      <p className="text-gray-700 text-sm mb-4 line-clamp-3">
                        {property.description}
                      </p>
                    )}

                    <div className="flex space-x-2">
                      <button 
                        onClick={() => removeLike(property.id)}
                        className="flex-1 bg-red-100 text-red-700 py-2 px-4 rounded-lg hover:bg-red-200 transition-colors"
                      >
                        💔 Remove
                      </button>
                      
                      <button 
                        onClick={() => {
                          const message = `I'm interested in the property at ${property.address}, ${property.city}, ${property.state}`;
                          window.open(`sms:+1234567890&body=${encodeURIComponent(message)}`, '_self');
                        }}
                        className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Contact Agent
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No liked properties yet</h3>
              <p className="text-gray-600 mb-6">
                Start browsing properties and click the "Like" button to save them here.
              </p>
              <Link 
                href="/dashboard"
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Browse Properties
              </Link>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}