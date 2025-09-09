'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/ui/Header';
import { Footer } from '@/components/ui/Footer';

/**
 * SIMPLIFIED BUYER DASHBOARD
 * 
 * Shows properties based on 3 simple criteria:
 * 1. City match
 * 2. Monthly payment <= budget
 * 3. Down payment <= budget
 * 
 * NO complex matching, NO realtor dependencies.
 */

interface Property {
  id: string;
  address: string;
  city: string;
  state: string;
  listPrice: number;
  monthlyPayment: number;
  downPaymentAmount: number;
  bedrooms: number;
  bathrooms: number;
  squareFeet: number;
  description?: string;
  zillowImageUrl?: string;
  imageUrl?: string;
  // Nearby cities functionality
  resultType?: 'direct' | 'nearby';
  displayTag?: string | null;
  matchReason?: string;
}

interface BuyerProfile {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  city: string;
  state?: string;
  maxMonthlyPayment: number;
  maxDownPayment: number;
}

export default function BuyerDashboardV2() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [profile, setProfile] = useState<BuyerProfile | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [likedProperties, setLikedProperties] = useState<string[]>([]);
  const [propertyBreakdown, setPropertyBreakdown] = useState<{direct: number, nearby: number} | null>(null);
  const [currentPropertyIndex, setCurrentPropertyIndex] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);

  // Auth check
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (status === 'authenticated' && session?.user?.role !== 'buyer') {
      router.push('/auth/signin');
    }
  }, [status, session, router]);

  // Load buyer data
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role === 'buyer') {
      loadBuyerData();
    }
  }, [status, session]);

  const loadBuyerData = async () => {
    try {
      setLoading(true);

      // Load buyer profile
      const profileRes = await fetch('/api/buyer/profile');
      const profileData = await profileRes.json();

      if (!profileData.profile) {
        // No profile yet - redirect to setup
        router.push('/dashboard/setup');
        return;
      }

      setProfile(profileData.profile);
      setLikedProperties(profileData.profile.likedProperties || []);

      // Load properties based on profile criteria
      const propertiesRes = await fetch(
        `/api/buyer/properties?city=${encodeURIComponent(profileData.profile.city)}&state=${encodeURIComponent(profileData.profile.state || 'TX')}&maxMonthlyPayment=${profileData.profile.maxMonthlyPayment}&maxDownPayment=${profileData.profile.maxDownPayment}`
      );
      const propertiesData = await propertiesRes.json();

      setProperties(propertiesData.properties || []);
      setPropertyBreakdown(propertiesData.breakdown || { direct: 0, nearby: 0 });
      
      console.log(`🏠 LOADED ${propertiesData.properties?.length || 0} properties for ${profileData.profile.city}`);

    } catch (err) {
      console.error('Failed to load buyer data:', err);
      setError('Failed to load your properties');
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
    } catch (error) {
      console.error('Failed to update like status:', error);
    }
  };

  // Navigation functions
  const goToNext = () => {
    if (currentPropertyIndex < properties.length - 1) {
      setSwipeDirection('right');
      setTimeout(() => {
        setCurrentPropertyIndex(prev => prev + 1);
        setSwipeDirection(null);
      }, 150);
    }
  };

  const goToPrevious = () => {
    if (currentPropertyIndex > 0) {
      setSwipeDirection('left');
      setTimeout(() => {
        setCurrentPropertyIndex(prev => prev - 1);
        setSwipeDirection(null);
      }, 150);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        goToNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPrevious();
      } else if (e.key === 'l' || e.key === 'L') {
        if (properties[currentPropertyIndex]) {
          toggleLike(properties[currentPropertyIndex].id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentPropertyIndex, properties]);

  // Touch/swipe handling
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      goToNext();
    } else if (isRightSwipe) {
      goToPrevious();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading your properties...</p>
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
          {/* Clean Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {profile?.city}
                </h1>
                {propertyBreakdown && (propertyBreakdown.direct > 0 || propertyBreakdown.nearby > 0) && (
                  <p className="text-gray-600 mt-1">
                    {propertyBreakdown.direct + propertyBreakdown.nearby} properties found
                  </p>
                )}
              </div>
              <div className="flex space-x-2">
                <Link 
                  href="/dashboard/liked"
                  className="bg-white border border-gray-200 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                >
                  ♥ Saved ({likedProperties.length})
                </Link>
                <Link 
                  href="/dashboard/settings"
                  className="bg-white border border-gray-200 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                >
                  ⚙ Settings
                </Link>
              </div>
            </div>
          </div>

          {/* Error State */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {/* Tinder-Style Property Browser */}
          {properties.length > 0 ? (
            <div className="relative h-[calc(100vh-300px)] min-h-[600px] flex items-center justify-center">
              
              {/* Property Card Stack */}
              <div className="relative w-full max-w-md mx-auto h-full">
                {properties.map((property, index) => {
                  const isActive = index === currentPropertyIndex;
                  const isPrevious = index === currentPropertyIndex - 1;
                  const isNext = index === currentPropertyIndex + 1;
                  
                  if (!isActive && !isPrevious && !isNext) return null;
                  
                  let cardClasses = "absolute inset-0 bg-white rounded-2xl shadow-xl transition-all duration-300 ";
                  let cardStyle = {};
                  
                  if (isActive) {
                    cardClasses += `z-20 transform ${swipeDirection === 'left' ? '-translate-x-2 rotate-3' : swipeDirection === 'right' ? 'translate-x-2 -rotate-3' : 'translate-x-0 rotate-0'}`;
                  } else if (isNext) {
                    cardClasses += "z-10 transform scale-95 translate-y-2";
                    cardStyle = { opacity: 0.8 };
                  } else if (isPrevious) {
                    cardClasses += "z-10 transform scale-95 -translate-y-2";
                    cardStyle = { opacity: 0.8 };
                  }
                  
                  return (
                    <div
                      key={property.id}
                      className={cardClasses}
                      style={cardStyle}
                      onTouchStart={isActive ? onTouchStart : undefined}
                      onTouchMove={isActive ? onTouchMove : undefined}
                      onTouchEnd={isActive ? onTouchEnd : undefined}
                    >
                      {/* Property Image */}
                      <div className="relative h-3/5 overflow-hidden rounded-t-2xl">
                        <img
                          src={
                            property.zillowImageUrl || 
                            property.imageUrl ||
                            `https://maps.googleapis.com/maps/api/streetview?size=600x400&location=${encodeURIComponent(property.address + ', ' + property.city + ', ' + property.state)}&key=AIzaSyCelger3EPc8GzTOQq7-cv6tUeVh_XN9jE`
                          }
                          alt={property.address}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = `https://maps.googleapis.com/maps/api/streetview?size=600x400&location=${encodeURIComponent(property.address + ', ' + property.city + ', ' + property.state)}&key=AIzaSyCelger3EPc8GzTOQq7-cv6tUeVh_XN9jE`;
                          }}
                        />
                        
                        {/* Nearby Tag */}
                        {property.displayTag && (
                          <div className="absolute top-4 right-4 bg-blue-600 text-white text-sm px-3 py-1 rounded-full font-medium">
                            {property.displayTag}
                          </div>
                        )}
                        
                        {/* Clean image without text overlay */}
                      </div>
                      
                      {/* Property Details */}
                      <div className="h-2/5 p-4">
                        {/* Address and Location */}
                        <div className="mb-4">
                          <h2 className="text-xl font-bold text-gray-900 mb-1">{property.address}</h2>
                          <p className="text-gray-600">{property.city}, {property.state}</p>
                          {property.matchReason && property.resultType === 'nearby' && (
                            <p className="text-blue-600 text-sm font-medium mt-1">
                              📍 {property.matchReason}
                            </p>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center mb-4">
                          <div className="bg-gray-100 rounded-lg py-2">
                            <div className="text-lg font-bold text-gray-900">{property.bedrooms}</div>
                            <div className="text-xs text-gray-600">beds</div>
                          </div>
                          <div className="bg-gray-100 rounded-lg py-2">
                            <div className="text-lg font-bold text-gray-900">{property.bathrooms}</div>
                            <div className="text-xs text-gray-600">baths</div>
                          </div>
                          <div className="bg-gray-100 rounded-lg py-2">
                            <div className="text-lg font-bold text-gray-900">{property.squareFeet?.toLocaleString()}</div>
                            <div className="text-xs text-gray-600">sq ft</div>
                          </div>
                        </div>
                        
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">List Price <span className="text-xs opacity-60">est.</span></span>
                            <span className="font-semibold">${property.listPrice?.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Monthly <span className="text-xs opacity-60">est.</span></span>
                            <span className="font-semibold text-green-600">${property.monthlyPayment?.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Down Payment <span className="text-xs opacity-60">est.</span></span>
                            <span className="font-semibold text-blue-600">${property.downPaymentAmount?.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              
              {/* Property Counter - Moved above action buttons */}
              <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 bg-black/70 text-white px-3 py-1 rounded-full text-sm">
                {currentPropertyIndex + 1} of {properties.length}
              </div>
              
              {/* Navigation Arrows at Bottom Corners */}
              <button
                onClick={goToPrevious}
                disabled={currentPropertyIndex === 0}
                className="absolute bottom-6 left-6 z-30 w-12 h-12 bg-white shadow-lg rounded-full flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title="Previous Property"
              >
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              
              <button
                onClick={goToNext}
                disabled={currentPropertyIndex === properties.length - 1}
                className="absolute bottom-6 right-6 z-30 w-12 h-12 bg-white shadow-lg rounded-full flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title="Next Property"
              >
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Minimal Action Buttons */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex space-x-4">
                <button 
                  onClick={() => toggleLike(properties[currentPropertyIndex].id)}
                  className={`w-16 h-16 rounded-full shadow-lg transition-all ${
                    likedProperties.includes(properties[currentPropertyIndex].id)
                      ? 'bg-red-500 text-white'
                      : 'bg-white text-red-500 border-2 border-red-200'
                  }`}
                  title={likedProperties.includes(properties[currentPropertyIndex].id) ? 'Saved' : 'Save Property'}
                >
                  <span className="text-2xl">
                    {likedProperties.includes(properties[currentPropertyIndex].id) ? '♥' : '♡'}
                  </span>
                </button>
                
                <button 
                  onClick={() => {
                    const property = properties[currentPropertyIndex];
                    const message = `I'm interested in the property at ${property.address}, ${property.city}, ${property.state}. I found this deal through OwnerFi.`;
                    window.open(`sms:+1234567890&body=${encodeURIComponent(message)}`, '_self');
                  }}
                  className="w-16 h-16 bg-blue-500 text-white rounded-full shadow-lg transition-all hover:bg-blue-600 flex items-center justify-center"
                  title="Contact Agent"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-6m-6 0H3m6 0v-3.87a3.5 3.5 0 11-4.24 0V21m11-3v3a2 2 0 01-2 2H9a2 2 0 01-2-2v-3m14 0V9a2 2 0 00-2-2H5a2 2 0 00-2 2v10m14 0H5" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No properties found</h3>
              <p className="text-gray-600 mb-6">
                We couldn&apos;t find any properties in {profile?.city} that match your budget.
              </p>
              <button 
                onClick={() => router.push('/dashboard/settings')}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Update Search Criteria
              </button>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}