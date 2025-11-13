'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ExtendedSession, isExtendedSession } from '@/types/session';
import Tutorial from '@/components/dashboard/Tutorial';
import { PropertySwiper2 } from '@/components/ui/PropertySwiper2';

import { PropertyListing } from '@/lib/property-schema';
import { BuyerDashboardView } from '@/lib/view-models';
import { OWNER_FINANCING_FACTS, SAFE_UI_LABELS } from '@/lib/legal-disclaimers';

// Extended Property interface that includes PropertyListing fields
interface Property extends Partial<PropertyListing> {
  id: string;
  address: string;
  city: string;
  state: string;
  zipCode?: string;
  bedrooms: number;
  bathrooms: number;
  squareFeet?: number;
  listPrice?: number;
  monthlyPayment?: number;
  downPaymentAmount?: number;
  balloonPayment?: number;
  balloonYears?: number;
  interestRate?: number;
  termYears?: number;
  imageUrls?: string[];
  zillowImageUrl?: string;
  imageUrl?: string;
  displayTag?: string;
  matchReason?: string;
  resultType?: 'direct' | 'nearby' | 'liked';
  isLiked?: boolean;
}

// Owner Financing Facts are now imported from legal-disclaimers.ts

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [profile, setProfile] = useState<BuyerDashboardView | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [likedProperties, setLikedProperties] = useState<string[]>([]);
  const [showTutorial, setShowTutorial] = useState(false);
  const [currentFact, setCurrentFact] = useState('');

  // Select random fact on mount
  useEffect(() => {
    const randomFact = OWNER_FINANCING_FACTS[Math.floor(Math.random() * OWNER_FINANCING_FACTS.length)];
    setCurrentFact(randomFact);
  }, []);

  // Auth check
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    } else if (status === 'authenticated' && isExtendedSession(session as unknown as ExtendedSession) && (session as unknown as ExtendedSession)?.user?.role !== 'buyer') {
      router.push('/');
    }
  }, [status, session, router]);

  // Cleanup body styles when component unmounts
  useEffect(() => {
    return () => {
      // Reset body styles when leaving dashboard
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
    };
  }, []);

  // Load data
  useEffect(() => {
    if (status === 'authenticated' && isExtendedSession(session as unknown as ExtendedSession) && (session as unknown as ExtendedSession)?.user?.role === 'buyer') {
      loadData();
    }
  }, [status, session]);

  const loadData = async () => {
    try {
      setLoading(true);

      const profileRes = await fetch('/api/buyer/profile');
      const profileData = await profileRes.json();

      console.log('📊 [DASHBOARD] Profile API response:', {
        hasProfile: !!profileData.profile,
        profileId: profileData.profile?.id,
        hasCity: !!profileData.profile?.city || !!profileData.profile?.preferredCity,
        hasMaxMonthlyPayment: !!profileData.profile?.maxMonthlyPayment,
        hasMaxDownPayment: !!profileData.profile?.maxDownPayment
      });

      if (!profileData.profile) {
        console.log('🔄 [DASHBOARD] No profile found, redirecting to setup');
        router.push('/dashboard/setup');
        return;
      }

      // Convert to BuyerDashboardView format
      const dashboardProfile: BuyerDashboardView = {
        id: profileData.profile.id,
        firstName: profileData.profile.firstName,
        lastName: profileData.profile.lastName,
        phone: profileData.profile.phone,
        city: profileData.profile.preferredCity || profileData.profile.city,
        state: profileData.profile.preferredState || profileData.profile.state || 'TX',
        maxMonthlyPayment: profileData.profile.maxMonthlyPayment,
        maxDownPayment: profileData.profile.maxDownPayment,
        likedProperties: profileData.profile.likedPropertyIds || profileData.profile.likedProperties || [],
      };

      setProfile(dashboardProfile);
      setLikedProperties(dashboardProfile.likedProperties || []);

      const propertiesRes = await fetch(
        `/api/buyer/properties?city=${encodeURIComponent(dashboardProfile.city)}&state=${encodeURIComponent(dashboardProfile.state)}&maxMonthlyPayment=${dashboardProfile.maxMonthlyPayment}&maxDownPayment=${dashboardProfile.maxDownPayment}`
      );
      const propertiesData = await propertiesRes.json();

      setProperties(propertiesData.properties || []);

      // Check if tutorial should be shown
      const tutorialCompleted = localStorage.getItem('buyerTutorialCompleted');
      const isNewAccount = localStorage.getItem('isNewBuyerAccount');

      // Show tutorial for new accounts or if never completed
      if ((isNewAccount === 'true' || !tutorialCompleted) && propertiesData.properties?.length > 0) {
        setShowTutorial(true);
        // Clear the new account flag once tutorial is shown
        localStorage.removeItem('isNewBuyerAccount');
      }
    } catch {
      // Error loading properties
    } finally {
      setLoading(false);
    }
  };

  const toggleLike = async (propertyId: string) => {
    try {
      const isLiked = likedProperties.includes(propertyId);
      const action = isLiked ? 'unlike' : 'like';

      const response = await fetch('/api/buyer/like-property', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId, action })
      });

      if (response.ok) {
        if (isLiked) {
          setLikedProperties(prev => prev.filter(id => id !== propertyId));
        } else {
          setLikedProperties(prev => [...prev, propertyId]);
        }
      }
    } catch {
      // Error updating like status
    }
  };

  if (loading) {
    return (
      <div className="h-screen bg-slate-900 flex items-center justify-center p-6 overflow-hidden fixed inset-0">
          <div className="text-center max-w-sm w-full flex flex-col justify-center min-h-0">
            {/* Animated Logo/Icon */}
            <div className="mb-6">
              <div className="w-16 h-16 mx-auto mb-3 relative">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-3xl animate-pulse"></div>
                <div className="absolute inset-2 bg-slate-900 rounded-2xl flex items-center justify-center">
                  <span className="text-2xl font-black">🏠</span>
                </div>
              </div>

              {/* Animated Spinner */}
              <div className="flex justify-center">
                <div className="w-12 h-12 border-4 border-slate-700 border-t-emerald-400 rounded-full animate-spin"></div>
              </div>
            </div>

            {/* Main Status */}
            <h1 className="text-2xl font-black text-white mb-2">
              {SAFE_UI_LABELS.SEARCHING_TEXT}
            </h1>
            <p className="text-slate-400 text-sm mb-4">
              {SAFE_UI_LABELS.LOADING_TEXT} in {profile?.city || 'your area'}...
            </p>

            {/* Loading Progress Bar */}
            <div className="bg-slate-700/50 rounded-full h-2 mb-4 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-400 to-blue-500 rounded-full animate-pulse w-3/4"></div>
            </div>

            {/* Educational Information Section - Compact */}
            {currentFact && (
              <div className="bg-gradient-to-br from-emerald-500/10 to-blue-500/10 border border-emerald-500/30 rounded-xl p-4 max-h-[40vh] overflow-y-auto">
                <div className="flex items-start gap-3">
                  <div className="text-xl flex-shrink-0">💡</div>
                  <div className="text-left flex-1 min-w-0">
                    <h3 className="text-emerald-400 font-bold text-sm mb-2">General Information</h3>
                    <p className="text-slate-200 text-sm leading-relaxed">
                      {currentFact}
                    </p>
                    <p className="text-[9px] text-slate-400 mt-2 italic">
                      General information only. Individual situations vary.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
    );
  }

  if (!properties.length) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="text-center">
          <div className="text-4xl mb-4">🏠</div>
          <h2 className="text-xl font-bold text-white mb-4">NO HOMES FOUND</h2>
          <p className="text-slate-300 mb-6 text-base">
            No properties in <span className="text-emerald-400">{profile?.city}</span> match your criteria.
          </p>
          <Link 
            href="/dashboard/settings" 
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-semibold"
          >
            ADJUST SEARCH
          </Link>
        </div>
      </div>
    );
  }

  // Convert Property to PropertyListing format
  const toPropertyListing = (property: Property): PropertyListing => {
    return {
      id: property.id,
      address: property.address,
      city: property.city,
      state: property.state,
      zipCode: property.zipCode || '',
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      squareFeet: property.squareFeet,
      listPrice: property.listPrice || 0,
      monthlyPayment: property.monthlyPayment || 0,
      downPaymentAmount: property.downPaymentAmount || 0,
      downPaymentPercent: property.downPaymentAmount && property.listPrice
        ? (property.downPaymentAmount / property.listPrice) * 100
        : 0,
      interestRate: property.interestRate || 0,
      termYears: property.termYears || 0,
      balloonPayment: property.balloonPayment,
      balloonYears: property.balloonYears,
      imageUrls: property.imageUrls || [],
      propertyType: (property.propertyType as PropertyListing['propertyType']) || 'single-family',
      description: property.description || '',
      status: 'active' as const,
      isActive: true,
      dateAdded: property.dateAdded || new Date().toISOString(),
      lastUpdated: property.lastUpdated || new Date().toISOString(),
      priority: 1,
      featured: false,
      source: 'manual' as const,
    };
  };

  // Handler for liking a property (converted to PropertyListing format)
  const handleLikeProperty = async (property: PropertyListing) => {
    await toggleLike(property.id);
  };

  // Handler for passing a property (no action needed for buyer dashboard)
  const handlePassProperty = (property: PropertyListing) => {
    // Just move to next property - no server call needed
  };

  return (
    <>
      {/* Tutorial Overlay */}
      <Tutorial
        isVisible={showTutorial}
        onComplete={() => setShowTutorial(false)}
      />

      {/* Top Navigation - Compact Design */}
      <div className="fixed top-0 left-0 right-0 z-[60] bg-gradient-to-b from-slate-900/90 to-transparent backdrop-blur-sm">
        <div className="max-w-md mx-auto px-3 py-2">
          {/* Single Row Layout */}
          <div className="flex items-center justify-between gap-2">
            {/* Left: Location - Clickable to edit */}
            <Link
              href="/dashboard/settings"
              className="flex items-center gap-1.5 bg-white/10 backdrop-blur-xl rounded-full px-3 py-1.5 border border-white/20 hover:bg-white/20 transition-colors active:scale-95"
            >
              <span className="text-sm">📍</span>
              <span className="text-white font-bold text-xs">{profile?.city}</span>
            </Link>

            {/* Right: Action Buttons */}
            <div className="flex items-center gap-1.5">
              <Link
                href="/dashboard/liked"
                className="relative w-8 h-8 bg-white/10 backdrop-blur-xl hover:bg-white/20 rounded-full flex items-center justify-center transition-all border border-white/20"
              >
                <span className="text-sm">❤️</span>
                {likedProperties.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold border border-slate-900">
                    {likedProperties.length}
                  </span>
                )}
              </Link>
              <Link
                href="/dashboard/settings"
                className="w-8 h-8 bg-white/10 backdrop-blur-xl hover:bg-white/20 rounded-full flex items-center justify-center transition-all border border-white/20"
              >
                <span className="text-sm">⚙️</span>
              </Link>
              <button
                onClick={() => setShowTutorial(true)}
                className="w-8 h-8 bg-white/10 backdrop-blur-xl hover:bg-white/20 rounded-full flex items-center justify-center transition-all border border-white/20"
                title="Show Help"
              >
                <span className="text-sm">❓</span>
              </button>
              <button
                onClick={() => router.push('/')}
                className="w-8 h-8 bg-white/10 backdrop-blur-xl hover:bg-white/20 rounded-full flex items-center justify-center transition-all border border-white/20"
              >
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* PropertySwiper2 Component - New Modern Swiper */}
      <PropertySwiper2
        properties={properties.map(toPropertyListing)}
        onLike={handleLikeProperty}
        onPass={handlePassProperty}
        favorites={likedProperties}
        passedIds={[]}
        isLoading={loading}
      />
    </>
  );
}