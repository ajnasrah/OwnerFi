'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PropertySwiper } from '@/components/ui/PropertySwiper';

export default function BuyerDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [properties, setProperties] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (status === 'authenticated') {
      if (session?.user?.role !== 'buyer') {
        router.push('/auth/signin');
      } else {
        loadBuyerData();
      }
    }
  }, [status, router, session]);

  // Refresh only when returning from other pages (not internal clicks)
  useEffect(() => {
    let wasHidden = false;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        wasHidden = true;
      } else if (wasHidden && profile) {
        console.log('👁️ Returned to dashboard - refreshing data');
        loadProperties(profile.id);
        wasHidden = false;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [profile]);

  const loadBuyerData = async () => {
    try {
      setLoading(true);
      
      // Load buyer profile
      const profileResponse = await fetch('/api/buyer/profile');
      const profileData = await profileResponse.json();
      
      if (!profileData.profile) {
        router.push('/dashboard/setup');
        return;
      }

      setProfile(profileData.profile);
      console.log('📊 Profile loaded:', profileData.profile);

      // Load pending properties using new unified API
      await loadProperties(profileData.profile.id);

    } catch (error) {
      setError('Failed to load data');
      console.error('Load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProperties = async (buyerId: string) => {
    try {
      setRefreshing(true);
      
      // Use unified property API for pending properties
      const propertiesResponse = await fetch(`/api/buyer/properties?buyerId=${buyerId}&status=pending`);
      const propertiesData = await propertiesResponse.json();
      
      if (!propertiesData.error) {
        setProperties(propertiesData.properties || []);
        console.log(`📦 Loaded ${propertiesData.properties?.length || 0} pending properties`);
      } else {
        setProperties([]);
      }

      // Load liked properties for favorites
      const likedResponse = await fetch(`/api/buyer/properties?buyerId=${buyerId}&status=liked`);
      const likedData = await likedResponse.json();
      
      if (!likedData.error) {
        setFavorites(likedData.properties?.map(p => p.id) || []);
      }

    } catch (error) {
      console.error('Properties load error:', error);
      setProperties([]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleLike = async (property: any) => {
    try {
      const response = await fetch('/api/property-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          buyerId: profile.id, 
          propertyId: property.id, 
          action: 'like' 
        })
      });
      
      if (response.ok) {
        setFavorites(prev => [...prev, property.id]);
        console.log('✅ Property liked');
      }
    } catch (error) {
      console.error('Failed to like property:', error);
    }
  };

  const handlePass = async (property: any) => {
    try {
      const response = await fetch('/api/property-actions', {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyerId: profile.id,
          propertyId: property.id,
          action: 'pass'
        })
      });
      
      if (response.ok) {
        // Remove from current properties list
        setProperties(prev => prev.filter(p => p.id !== property.id));
        console.log('✅ Property passed');
      }
    } catch (error) {
      console.error('Failed to pass property:', error);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your properties...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-3">
            <Link href="/dashboard/settings" className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Your Matches</h1>
              <p className="text-sm text-gray-500">{profile?.searchCriteria?.cities?.[0]}, {profile?.searchCriteria?.state}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Link href="/dashboard/favorites" className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 relative">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              {favorites.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {favorites.length}
                </span>
              )}
            </Link>
            
            <button onClick={() => signOut()} className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {/* Properties */}
      <PropertySwiper
        properties={properties}
        onLike={handleLike}
        onPass={handlePass}
        onFavorite={handleLike} // Same as handleLike
        favorites={favorites}
        isLoading={refreshing || loading}
      />

      {/* Bottom Status */}
      <div className="bg-white border-t border-gray-200 px-4 py-3">
        <div className="text-center">
          <div className="text-sm font-medium text-gray-700">
            {properties.length} properties available
          </div>
          <div className="text-xs text-gray-500">
            Budget: ${profile?.searchCriteria?.maxMonthlyPayment?.toLocaleString()}/mo
          </div>
        </div>
      </div>
    </div>
  );
}