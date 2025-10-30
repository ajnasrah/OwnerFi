'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ExtendedSession } from '@/types/session';
import Tutorial from '@/components/dashboard/Tutorial';
import { PropertySwiper2 } from '@/components/ui/PropertySwiper2';
import { PropertyListing } from '@/lib/property-schema';
import { BuyerDashboardView } from '@/lib/view-models';

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

// Owner Financing Fun Facts
const OWNER_FINANCING_FACTS = [
  "💡 Owner financing often requires less paperwork than traditional mortgages - closing can happen in weeks instead of months!",
  "🏦 Did you know? You don't need perfect credit for owner financing - sellers look at the whole picture, not just your credit score.",
  "💰 Owner financing typically has lower closing costs - you can save thousands compared to traditional bank loans.",
  "⚡ Fast closings! Owner-financed deals often close 3-4x faster than traditional bank mortgages.",
  "🎯 More negotiable terms! Interest rates, down payments, and monthly payments can all be customized to fit your budget.",
  "📈 Build equity faster! Many owner-financed properties require lower down payments, letting you invest in more properties.",
  "🏡 Own a home even if you're self-employed or have non-traditional income - owner financing is more flexible!",
  "💼 Sellers often offer better interest rates than banks to make the deal attractive and close faster.",
  "🔓 No bank approval needed! The seller is the lender, so approval is based on mutual agreement, not bank policies.",
  "📊 Owner financing has been around for centuries - it's how many of America's first homes were purchased!",
  "🌟 Balloon payments give you time to improve your credit and refinance with better terms later.",
  "🤝 Direct relationship with the seller means more flexibility if you need to modify terms down the road.",
  "💵 You can often negotiate including repairs or improvements as part of the financing deal.",
  "🏃 Skip the bank! No waiting for loan underwriters, appraisals delays, or last-minute loan denials.",
  "📝 Creative terms are possible - some sellers accept trade-ins, sweat equity, or other creative payment arrangements!"
];

export default function BuyerPreview() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const buyerId = params.buyerId as string;

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

  // Auth check - only admin can access
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    } else if (status === 'authenticated' && (session?.user as any)?.role !== 'admin') {
      router.push('/');
    }
  }, [status, session, router]);

  // Load buyer data
  useEffect(() => {
    if (status === 'authenticated' && (session?.user as any)?.role === 'admin') {
      loadBuyerData();
    }
  }, [status, session, buyerId]);

  const loadBuyerData = async () => {
    try {
      setLoading(true);

      // Fetch buyer profile from admin API
      const profileRes = await fetch(`/api/admin/buyers/profile/${buyerId}`);
      const profileData = await profileRes.json();

      if (!profileData.profile) {
        router.push('/admin/buyers');
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
        likedProperties: profileData.profile.likedPropertyIds || [],
      };

      setProfile(dashboardProfile);
      setLikedProperties(dashboardProfile.likedProperties || []);

      // Fetch properties using same API as buyer dashboard
      const propertiesRes = await fetch(
        `/api/buyer/properties?city=${encodeURIComponent(dashboardProfile.city)}&state=${encodeURIComponent(dashboardProfile.state)}&maxMonthlyPayment=${dashboardProfile.maxMonthlyPayment}&maxDownPayment=${dashboardProfile.maxDownPayment}`
      );
      const propertiesData = await propertiesRes.json();

      setProperties(propertiesData.properties || []);
    } catch (error) {
      console.error('Error loading buyer data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Admin preview mode - don't allow actual liking/passing
  const toggleLike = async (propertyId: string) => {
    // Just update UI, don't persist
    if (likedProperties.includes(propertyId)) {
      setLikedProperties(prev => prev.filter(id => id !== propertyId));
    } else {
      setLikedProperties(prev => [...prev, propertyId]);
    }
  };

  if (loading) {
    return (
      <div className="h-screen bg-slate-900 flex items-center justify-center p-4 overflow-hidden fixed inset-0">
        <div className="text-center max-w-sm w-full">
          {/* Animated Logo/Icon */}
          <div className="mb-8">
            <div className="w-20 h-20 mx-auto mb-4 relative">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-3xl animate-pulse"></div>
              <div className="absolute inset-2 bg-slate-900 rounded-2xl flex items-center justify-center">
                <span className="text-3xl font-black">🏠</span>
              </div>
            </div>

            {/* Animated Spinner */}
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 border-4 border-slate-700 border-t-emerald-400 rounded-full animate-spin"></div>
            </div>
          </div>

          {/* Main Status */}
          <h1 className="text-3xl font-black text-white mb-3">
            Loading Buyer Preview
          </h1>
          <p className="text-slate-400 text-lg mb-8">
            Loading buyer experience for {profile?.city || 'preview'}...
          </p>

          {/* Loading Progress Bar */}
          <div className="bg-slate-700/50 rounded-full h-3 mb-6 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-emerald-400 to-blue-500 rounded-full animate-pulse w-3/4"></div>
          </div>

          {/* Fun Fact Section */}
          {currentFact && (
            <div className="bg-gradient-to-br from-emerald-500/10 to-blue-500/10 border-2 border-emerald-500/30 rounded-2xl p-6">
              <div className="flex items-start gap-4">
                <div className="text-3xl flex-shrink-0">💡</div>
                <div className="text-left">
                  <h3 className="text-emerald-400 font-black text-base mb-3">Did You Know?</h3>
                  <p className="text-slate-200 text-base leading-relaxed">
                    {currentFact.replace(/^[^\s]+\s/, '')}
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
            No properties in <span className="text-emerald-400">{profile?.city}</span> match buyer criteria.
          </p>
          <Link
            href="/admin/buyers"
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-semibold"
          >
            BACK TO BUYERS
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

  // Handler for passing a property (no action needed for preview)
  const handlePassProperty = (property: PropertyListing) => {
    // Just move to next property - no server call needed
  };

  return (
    <>
      {/* Admin Preview Banner */}
      <div className="fixed top-0 left-0 right-0 z-[70] bg-yellow-500 text-black px-4 py-2 text-center font-bold">
        👁️ ADMIN PREVIEW MODE - Viewing as: {profile?.firstName} {profile?.lastName} ({profile?.city}, {profile?.state})
        <Link href="/admin/buyers" className="ml-4 underline">Back to Admin</Link>
      </div>

      {/* Tutorial Overlay */}
      <Tutorial
        isVisible={showTutorial}
        onComplete={() => setShowTutorial(false)}
      />

      {/* Top Navigation - Compact Design (offset for admin banner) */}
      <div className="fixed top-12 left-0 right-0 z-[60] bg-gradient-to-b from-slate-900/90 to-transparent backdrop-blur-sm">
        <div className="max-w-md mx-auto px-3 py-2">
          {/* Single Row Layout */}
          <div className="flex items-center justify-between gap-2">
            {/* Left: Location - Clickable (disabled in preview) */}
            <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-xl rounded-full px-3 py-1.5 border border-white/20 opacity-90 cursor-not-allowed">
              <span className="text-sm">📍</span>
              <span className="text-white font-bold text-xs">{profile?.city}</span>
            </div>

            {/* Right: Action Buttons */}
            <div className="flex items-center gap-1.5">
              <div className="relative w-8 h-8 bg-white/10 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/20">
                <span className="text-sm">❤️</span>
                {likedProperties.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold border border-slate-900">
                    {likedProperties.length}
                  </span>
                )}
              </div>
              <div className="w-8 h-8 bg-white/10 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/20 opacity-50 cursor-not-allowed">
                <span className="text-sm">⚙️</span>
              </div>
              <button
                onClick={() => setShowTutorial(true)}
                className="w-8 h-8 bg-white/10 backdrop-blur-xl hover:bg-white/20 rounded-full flex items-center justify-center transition-all border border-white/20"
                title="Show Help"
              >
                <span className="text-sm">❓</span>
              </button>
              <div className="w-8 h-8 bg-white/10 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/20 opacity-50 cursor-not-allowed">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PropertySwiper2 Component - Exact same as buyer dashboard */}
      <div className="mt-12">
        <PropertySwiper2
          properties={properties.map(toPropertyListing)}
          onLike={handleLikeProperty}
          onPass={handlePassProperty}
          favorites={likedProperties}
          passedIds={[]}
          isLoading={loading}
        />
      </div>
    </>
  );
}
