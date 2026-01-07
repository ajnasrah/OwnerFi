'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { isExtendedSession } from '@/types/session';
import Tutorial from '@/components/dashboard/Tutorial';
import { PropertySwiper2 } from '@/components/ui/PropertySwiper2';
import { FilterUpgradeModal } from '@/components/FilterUpgradeModal';
import { useFilterUpgradePrompt } from '@/hooks/useFilterUpgradePrompt';
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
  dealType?: 'owner_finance' | 'cash_deal';
  percentOfArv?: number;
  discount?: number;
  arv?: number;
  yearBuilt?: number;
  zestimate?: number;
  rentEstimate?: number;
}

// Owner Financing Facts are now imported from legal-disclaimers.ts

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [profile, setProfile] = useState<BuyerDashboardView | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [likedProperties, setLikedProperties] = useState<string[]>([]);
  const [showTutorial, setShowTutorial] = useState(false);
  const [currentFact, setCurrentFact] = useState('');

  // Filter upgrade prompt for old users
  const { shouldShow: shouldShowFilterUpgrade, dismissPrompt: dismissFilterUpgrade } = useFilterUpgradePrompt(profile);

  // Select random fact on mount
  useEffect(() => {
    const randomFact = OWNER_FINANCING_FACTS[Math.floor(Math.random() * OWNER_FINANCING_FACTS.length)];
    setCurrentFact(randomFact);
  }, []);

  // Auth check - allow both buyers and realtors to access
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth');
    }
    // Realtors can now access buyer dashboard to search properties
  }, [status, router]);

  // Load data - works for both buyers and realtors
  useEffect(() => {
    if (status === 'authenticated') {
      loadData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const loadData = async () => {
    try {
      setLoading(true);

      const profileRes = await fetch('/api/buyer/profile');
      const profileData = await profileRes.json();

      console.log('📊 [DASHBOARD] Profile API response:', {
        hasProfile: !!profileData.profile,
        profileId: profileData.profile?.id,
        hasCity: !!profileData.profile?.city || !!profileData.profile?.preferredCity
      });

      if (!profileData.profile) {
        console.log('🔄 [DASHBOARD] No profile found, redirecting to setup');
        router.push('/auth/setup');
        return;
      }

      // Convert to BuyerDashboardView format
      const dashboardProfile: BuyerDashboardView = {
        id: profileData.profile.id,
        firstName: profileData.profile.firstName,
        lastName: profileData.profile.lastName,
        phone: profileData.profile.phone,
        city: profileData.profile.preferredCity || profileData.profile.city || 'Memphis',
        state: profileData.profile.preferredState || profileData.profile.state || 'TN',
        likedProperties: profileData.profile.likedPropertyIds || profileData.profile.likedProperties || [],
      };

      setProfile(dashboardProfile);
      setLikedProperties(dashboardProfile.likedProperties || []);

      console.log('🔍 [DASHBOARD] Fetching properties for:', dashboardProfile.city, dashboardProfile.state);

      const propertiesRes = await fetch(
        `/api/buyer/properties?city=${encodeURIComponent(dashboardProfile.city)}&state=${encodeURIComponent(dashboardProfile.state)}`
      );
      const propertiesData = await propertiesRes.json();

      console.log('🏠 [DASHBOARD] Properties API response:', {
        status: propertiesRes.status,
        count: propertiesData.properties?.length || 0,
        error: propertiesData.error || null,
        firstProperty: propertiesData.properties?.[0]?.address || 'none'
      });

      // Show only owner finance properties
      const ownerFinanceProps = (propertiesData.properties || []).map((p: Property) => ({
        ...p,
        dealType: 'owner_finance' as const,
      }));

      setProperties(ownerFinanceProps);

      // Check if tutorial should be shown - ONLY for first time users
      const tutorialCompleted = localStorage.getItem('buyerTutorialCompleted');
      const isNewAccount = localStorage.getItem('isNewBuyerAccount');

      // Show tutorial ONLY for new accounts that haven't seen it
      if (propertiesData.properties?.length > 0) {
        if (isNewAccount === 'true' && !tutorialCompleted) {
          // First time user who hasn't completed tutorial
          setShowTutorial(true);
          localStorage.removeItem('isNewBuyerAccount');
        }
        // Once completed, never show automatically again (user can click ? to see it)
      }
    } catch {
      // Error loading properties
    } finally {
      setLoading(false);
    }
  };

  // PERF: Memoized toggle like handler to prevent re-renders
  const toggleLike = useCallback(async (propertyId: string, property?: Property) => {
    try {
      const isLiked = likedProperties.includes(propertyId);
      const action = isLiked ? 'unlike' : 'like';

      // Include property context for ML training
      const propertyContext = property ? {
        monthlyPayment: property.monthlyPayment || 0,
        downPayment: property.downPaymentAmount || 0,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        squareFeet: property.squareFeet,
        city: property.city,
        source: ((property as Record<string, unknown>).source as string | undefined) || 'curated',
      } : undefined;

      const response = await fetch('/api/buyer/like-property', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId, action, propertyContext })
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
  }, [likedProperties]);

  // Handle auto-like from shared property link
  useEffect(() => {
    const likePropertyId = searchParams?.get('likeProperty');
    if (likePropertyId && profile && !likedProperties.includes(likePropertyId) && !loading) {
      // Auto-like the shared property
      const autoLikeProperty = async () => {
        try {
          const response = await fetch('/api/buyer/like-property', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ propertyId: likePropertyId, action: 'like' })
          });

          if (response.ok) {
            setLikedProperties(prev => [...prev, likePropertyId]);
            // Remove the query param from URL without reload
            const newUrl = window.location.pathname;
            window.history.replaceState({}, '', newUrl);
          }
        } catch (err) {
          console.error('Failed to auto-like property:', err);
        }
      };
      autoLikeProperty();
    }
  }, [searchParams, profile, likedProperties, loading]);

  // PERF: Convert Property to PropertyListing format - memoized to prevent recreation on every render
  // NOTE: Must be before early returns to satisfy Rules of Hooks
  const toPropertyListing = useCallback((property: Property): PropertyListing => {
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
      imageUrl: ((property as Record<string, unknown>).imageUrl as string | undefined) || '',
      propertyType: (property.propertyType as PropertyListing['propertyType']) || 'single-family',
      description: property.description || '',
      status: 'active' as const,
      isActive: true,
      dateAdded: property.dateAdded || new Date().toISOString(),
      lastUpdated: property.lastUpdated || new Date().toISOString(),
      priority: 1,
      featured: false,
      source: 'manual' as const,
      // Cash deal fields (passed through for badge display)
      dealType: property.dealType,
      percentOfArv: property.percentOfArv,
      discount: property.discount,
      arv: property.arv,
      yearBuilt: property.yearBuilt,
      // Third-party estimates (from Zillow - unverified)
      zestimate: property.zestimate,
      rentEstimate: property.rentEstimate,
    } as PropertyListing;
  }, []);

  // PERF: Memoize converted properties to avoid mapping on every render
  const propertyListings = useMemo(
    () => properties.map(toPropertyListing),
    [properties, toPropertyListing]
  );

  // PERF: Memoized handler for liking a property
  const handleLikeProperty = useCallback(async (property: PropertyListing) => {
    await toggleLike(property.id, property as Property);
  }, [toggleLike]);

  // PERF: Memoized handler for passing a property
  const handlePassProperty = useCallback(async (property: PropertyListing) => {
    try {
      // Optimistic update: remove from UI immediately for smooth transition
      setProperties(prev => prev.filter(p => p.id !== property.id));

      // Include property context for ML training
      const propertyContext = {
        monthlyPayment: property.monthlyPayment || 0,
        downPayment: property.downPaymentAmount || 0,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        squareFeet: property.squareFeet,
        city: property.city,
        source: ((property as Record<string, unknown>).source as string | undefined) || 'curated',
      };

      const response = await fetch('/api/buyer/pass-property', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: property.id,
          action: 'pass',
          propertyContext,
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('API error:', response.status, errorData);
        throw new Error(errorData.error || errorData.message || `Failed to pass property (${response.status})`);
      }

      console.log(`✅ Passed property ${property.id}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Failed to pass property:', errorMessage);

      // Revert the optimistic update
      setProperties(prev => [...prev, property as Property]);

      alert(`Failed to skip property: ${errorMessage}`);
    }
  }, []);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-slate-900 flex items-center justify-center p-6 overflow-hidden">
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
      <div className="h-screen overflow-hidden bg-slate-900 flex flex-col items-center justify-center p-4">
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

  return (
    <div className="h-screen overflow-hidden">
      {/* Tutorial Overlay */}
      <Tutorial
        isVisible={showTutorial}
        onComplete={() => setShowTutorial(false)}
      />

      {/* Top Navigation - Compact Design */}
      <div className="fixed top-0 left-0 right-0 z-header bg-gradient-to-b from-slate-900/90 to-transparent backdrop-blur-sm">
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
              {/* Realtor Dashboard Button - Only show for realtors */}
              {session && isExtendedSession(session) && session.user.role === 'realtor' && (
                <Link
                  href="/realtor-dashboard"
                  className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 rounded-lg flex items-center gap-1 transition-all border-white/20"
                  title="Realtor Dashboard"
                >
                  <span className="text-emerald-400 text-[10px] font-bold">HUB</span>
                  <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              )}
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
                onClick={() => signOut({ callbackUrl: '/auth/signout' })}
                className="w-8 h-8 bg-red-500/20 backdrop-blur-xl hover:bg-red-500/30 rounded-full flex items-center justify-center transition-all border border-red-500/40"
                title="Logout"
              >
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Content - PropertySwiper shows both owner finance and cash deals */}
      <PropertySwiper2
        properties={propertyListings}
        onLike={handleLikeProperty}
        onPass={handlePassProperty}
        favorites={likedProperties}
        passedIds={[]}
        isLoading={loading}
      />

      {/* Filter Upgrade Modal - One-time prompt for old users */}
      {shouldShowFilterUpgrade && (
        <FilterUpgradeModal
          onClose={dismissFilterUpgrade}
          onUpgrade={dismissFilterUpgrade}
        />
      )}
    </div>
  );
}