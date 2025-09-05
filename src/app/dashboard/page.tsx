'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PropertySwiper } from '@/components/ui/PropertySwiper';
import { Button } from '@/components/ui/Button';

interface BuyerProfile {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  preferredCity: string;
  preferredState: string;
  searchRadius: number;
  minPrice?: number;
  maxPrice: number;
  minBedrooms?: number;
  minBathrooms?: number;
  minSquareFeet?: number;
  maxDownPayment: number;
  emailNotifications: boolean;
  smsNotifications: boolean;
  profileComplete: boolean;
}

import { Property } from '@/lib/mock-data';

export default function BuyerDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<BuyerProfile | null>(null);
  const [matchedProperties, setMatchedProperties] = useState<Property[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [rejectedProperties, setRejectedProperties] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (status === 'authenticated') {
      // Redirect admin users to admin panel
      if ((session?.user as any)?.role === 'admin') {
        router.push('/admin');
        return;
      }
      
      // Only buyers can access dashboard
      if ((session?.user as any)?.role !== 'buyer') {
        router.push('/auth/signin');
        return;
      }
      
      // Load existing favorites and rejected from localStorage
      const savedFavorites = JSON.parse(localStorage.getItem('favorites') || '[]');
      const savedRejected = JSON.parse(localStorage.getItem('rejectedProperties') || '[]');
      setFavorites(savedFavorites);
      setRejectedProperties(savedRejected);
      fetchProfile();
    }
  }, [status, router, session]);

  // Refresh favorites and re-fetch properties when returning to this page
  useEffect(() => {
    const handleFocus = () => {
      const savedFavorites = JSON.parse(localStorage.getItem('favorites') || '[]');
      const savedRejected = JSON.parse(localStorage.getItem('rejectedProperties') || '[]');
      setFavorites(savedFavorites);
      setRejectedProperties(savedRejected);
      
      // Re-fetch profile and properties to get latest preferences
      if (profile) {
        fetchProfile();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [profile]);

  const fetchProfile = async () => {
    try {
      const response = await fetch('/api/buyer/profile');
      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
      } else if (!data.profile) {
        // No profile yet, redirect to setup
        router.push('/dashboard/setup');
      } else {
        setProfile(data.profile);
        await fetchMatchedProperties();
        setDataLoaded(true);
      }
    } catch (err) {
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const fetchMatchedProperties = async () => {
    try {
      const params = new URLSearchParams({
        city: profile?.preferredCity || 'Memphis',
        radius: profile?.searchRadius?.toString() || '25'
      });
      
      // Add budget filters
      if (profile?.maxMonthlyPayment) {
        params.append('maxMonthly', profile.maxMonthlyPayment.toString());
      }
      if (profile?.maxDownPayment) {
        params.append('maxDown', profile.maxDownPayment.toString());
      }
      
      // Add bedroom/bathroom filters
      if (profile?.minBedrooms) {
        params.append('minBedrooms', profile.minBedrooms.toString());
      }
      if (profile?.minBathrooms) {
        params.append('minBathrooms', profile.minBathrooms.toString());
      }
      
      const response = await fetch(`/api/buyer/matched-properties?${params}`);
      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
      } else {
        setMatchedProperties(data.properties || []);
      }
    } catch (err) {
      setError('Failed to load matched properties');
    }
  };

  const handleLike = (property: Property) => {
    // In a real app, send this to your API
    console.log('Liked property:', property.id);
  };

  const handlePass = (property: Property) => {
    // Add to rejected list and save to localStorage
    const newRejected = [...rejectedProperties, property.id];
    setRejectedProperties(newRejected);
    
    localStorage.setItem('rejectedProperties', JSON.stringify(newRejected));
    localStorage.setItem('rejectedPropertyDetails', JSON.stringify([
      ...JSON.parse(localStorage.getItem('rejectedPropertyDetails') || '[]'),
      property
    ]));
    
    console.log('Rejected property:', property.id);
  };

  const handleFavorite = (property: Property) => {
    const newFavorites = favorites.includes(property.id) 
      ? favorites.filter(id => id !== property.id)
      : [...favorites, property.id];
    
    setFavorites(newFavorites);
    
    // Save to localStorage so favorites page can access them
    localStorage.setItem('favorites', JSON.stringify(newFavorites));
    localStorage.setItem('favoriteProperties', JSON.stringify(
      newFavorites.includes(property.id) 
        ? [...JSON.parse(localStorage.getItem('favoriteProperties') || '[]'), property]
        : JSON.parse(localStorage.getItem('favoriteProperties') || '[]').filter((p: Property) => p.id !== property.id)
    ));
  };

  if (status === 'loading' || loading || !dataLoaded) {
    return (
      <div className="min-h-screen bg-primary-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary mx-auto mb-4"></div>
          <p className="text-secondary-text">Finding your perfect matches...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-primary-bg flex items-center justify-center p-4">
        <div className="text-center max-w-sm mx-auto">
          <div className="text-6xl mb-4">✨</div>
          <h2 className="text-2xl font-semibold text-primary-text mb-3">Let's Find Your Home</h2>
          <p className="text-secondary-text mb-6 leading-relaxed">
            Tell us what you're looking for so we can find properties that truly fit your life.
          </p>
          <Button variant="primary" size="lg" href="/dashboard/setup" className="w-full">
            Complete Your Profile
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary-bg flex flex-col">
      {/* Mobile-first header */}
      <header className="bg-white px-6 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link href="/" className="text-gray-600 hover:text-gray-800 transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Your Matches</h1>
          </div>
          <div className="flex items-center space-x-2">
            <Link href="/dashboard/settings" className="p-3 rounded-lg hover:bg-gray-50 transition-colors">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </Link>
            <Link href="/dashboard/favorites" className="p-3 rounded-lg hover:bg-gray-50 transition-colors relative">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              {favorites.length > 0 && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
                  {favorites.length}
                </div>
              )}
            </Link>
            <button 
              onClick={() => {
                fetchProfile(); // This will re-fetch profile and properties with latest settings
              }}
              className="p-3 rounded-lg hover:bg-gray-50 transition-colors"
              title="Refresh matches with latest settings"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button
              onClick={() => signOut({ callbackUrl: '/auth/logout' })}
              className="text-secondary-text hover:text-primary-text p-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="bg-error-bg border border-accent-primary/20 p-3 mx-4 mt-3 rounded-lg">
          <p className="text-accent-primary text-sm">{error}</p>
        </div>
      )}

      {/* Main swiper area */}
      <PropertySwiper
        properties={matchedProperties}
        onLike={handleLike}
        onPass={handlePass}
        onFavorite={handleFavorite}
        favorites={favorites}
      />

      {/* Bottom info */}
      <div className="bg-surface-bg border-t border-neutral-border px-4 py-3 safe-area-bottom">
        <div className="text-center">
          <div className="text-xs text-secondary-text">
            {profile.preferredCity}, {profile.preferredState}
          </div>
          <div className="text-xs text-secondary-text">
            {profile.searchRadius} mile radius
          </div>
        </div>
      </div>
    </div>
  );
}