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

import { PropertyListing } from '@/lib/property-schema';

type Property = PropertyListing & {
  zillowImageUrl?: string;
  imageUrl?: string;
  resultType?: 'direct' | 'nearby';
  displayTag?: string | null;
  matchReason?: string;
};

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
    <div className="min-h-screen flex flex-col mobile-safe-area prevent-overscroll">
      <Header />
      
      <main className="flex-1 mobile-content">
        <div className="mobile-container">
          {/* Mobile-Optimized Header */}
          <div className="mb-4">
            <div className="flex flex-col gap-3">
              <div className="flex-1">
                <h1 className="text-2xl font-bold" style={{color: 'var(--primary-text)'}}>
                  {profile?.city}
                </h1>
                {propertyBreakdown && (propertyBreakdown.direct > 0 || propertyBreakdown.nearby > 0) && (
                  <p style={{color: 'var(--secondary-text)', fontSize: 'var(--text-sm)'}} className="mt-1">
                    {propertyBreakdown.direct + propertyBreakdown.nearby} properties found
                  </p>
                )}
              </div>
              <div className="mobile-grid" style={{gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)'}}>
                <Link 
                  href="/dashboard/liked"
                  className="mobile-button secondary"
                  style={{fontSize: 'var(--text-sm)'}}
                >
                  <span>♥</span>
                  <span className="mobile-only">({likedProperties.length})</span>
                  <span className="desktop-only">Saved ({likedProperties.length})</span>
                </Link>
                <Link 
                  href="/dashboard/settings"
                  className="mobile-button secondary"
                  style={{fontSize: 'var(--text-sm)'}}
                >
                  <span>⚙</span>
                  <span className="desktop-only">Settings</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Error State */}
          {error && (
            <div className="alert error">
              <p>{error}</p>
            </div>
          )}

          {/* Mobile-Optimized Property Browser */}
          {properties.length > 0 ? (
            <div className="relative" style={{height: 'calc(100vh - 200px)', minHeight: '500px', maxHeight: '700px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
              
              {/* Property Card Stack */}
              <div className="relative w-full h-full" style={{maxWidth: '380px', margin: '0 auto'}}>
                {properties.map((property, index) => {
                  const isActive = index === currentPropertyIndex;
                  const isPrevious = index === currentPropertyIndex - 1;
                  const isNext = index === currentPropertyIndex + 1;
                  
                  if (!isActive && !isPrevious && !isNext) return null;
                  
                  let cardClasses = "absolute inset-0 mobile-card transition-all duration-300 ";
                  let cardStyle: any = {borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-large)'};
                  
                  if (isActive) {
                    cardClasses += `z-20 transform ${swipeDirection === 'left' ? '-translate-x-2 rotate-3' : swipeDirection === 'right' ? 'translate-x-2 -rotate-3' : 'translate-x-0 rotate-0'}`;
                    cardStyle.zIndex = 20;
                  } else if (isNext) {
                    cardClasses += "z-10 transform scale-95 translate-y-2";
                    cardStyle = { ...cardStyle, opacity: 0.8, zIndex: 10, transform: 'scale(0.95) translateY(8px)' };
                  } else if (isPrevious) {
                    cardClasses += "z-10 transform scale-95 -translate-y-2";
                    cardStyle = { ...cardStyle, opacity: 0.8, zIndex: 10, transform: 'scale(0.95) translateY(-8px)' };
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
                      <div className="relative overflow-hidden" style={{height: '60%', borderTopLeftRadius: 'var(--radius-xl)', borderTopRightRadius: 'var(--radius-xl)'}}>
                        <img
                          src={
                            property.zillowImageUrl || 
                            property.imageUrl ||
                            `https://maps.googleapis.com/maps/api/streetview?size=400x300&location=${encodeURIComponent(property.address + ', ' + property.city + ', ' + property.state)}&key=AIzaSyCelger3EPc8GzTOQq7-cv6tUeVh_XN9jE`
                          }
                          alt={property.address}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = `https://maps.googleapis.com/maps/api/streetview?size=400x300&location=${encodeURIComponent(property.address + ', ' + property.city + ', ' + property.state)}&key=AIzaSyCelger3EPc8GzTOQq7-cv6tUeVh_XN9jE`;
                          }}
                        />
                        
                        {/* Nearby Tag */}
                        {property.displayTag && (
                          <div className="absolute" style={{top: 'var(--space-3)', right: 'var(--space-3)', background: 'var(--accent-primary)', color: 'white', fontSize: 'var(--text-xs)', padding: 'var(--space-1) var(--space-2)', borderRadius: '999px', fontWeight: '500'}}>
                            {property.displayTag}
                          </div>
                        )}
                      </div>
                      
                      {/* Property Details */}
                      <div className="overflow-y-auto" style={{height: '40%', padding: 'var(--space-3)'}}>
                        {/* Address and Location */}
                        <div style={{marginBottom: 'var(--space-3)'}}>
                          <h2 style={{fontSize: 'var(--text-lg)', fontWeight: '700', color: 'var(--primary-text)', marginBottom: 'var(--space-1)', lineHeight: '1.25'}}>{property.address}</h2>
                          <p style={{color: 'var(--secondary-text)', fontSize: 'var(--text-sm)'}}>{property.city}, {property.state}</p>
                          {property.matchReason && property.resultType === 'nearby' && (
                            <p style={{color: 'var(--accent-primary)', fontSize: 'var(--text-xs)', fontWeight: '500', marginTop: 'var(--space-1)'}}>
                              📍 {property.matchReason}
                            </p>
                          )}
                        </div>

                        <div className="mobile-grid" style={{gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)', textAlign: 'center', marginBottom: 'var(--space-3)'}}>
                          <div style={{background: 'var(--neutral-hover)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2)'}}>
                            <div style={{fontSize: 'var(--text-base)', fontWeight: '700', color: 'var(--primary-text)'}}>{property.bedrooms}</div>
                            <div style={{fontSize: 'var(--text-xs)', color: 'var(--secondary-text)'}}>beds</div>
                          </div>
                          <div style={{background: 'var(--neutral-hover)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2)'}}>
                            <div style={{fontSize: 'var(--text-base)', fontWeight: '700', color: 'var(--primary-text)'}}>{property.bathrooms}</div>
                            <div style={{fontSize: 'var(--text-xs)', color: 'var(--secondary-text)'}}>baths</div>
                          </div>
                          <div style={{background: 'var(--neutral-hover)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2)'}}>
                            <div style={{fontSize: 'var(--text-base)', fontWeight: '700', color: 'var(--primary-text)'}}>{property.squareFeet?.toLocaleString()}</div>
                            <div style={{fontSize: 'var(--text-xs)', color: 'var(--secondary-text)'}}>sq ft</div>
                          </div>
                        </div>
                        
                        <div style={{display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontSize: 'var(--text-xs)'}}>
                          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                            <span style={{color: 'var(--secondary-text)'}}>List Price <span style={{opacity: '0.6'}}>est.</span></span>
                            <span style={{fontWeight: '600', fontSize: 'var(--text-sm)', color: 'var(--primary-text)'}}>${property.listPrice?.toLocaleString()}</span>
                          </div>
                          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                            <span style={{color: 'var(--secondary-text)'}}>Monthly <span style={{opacity: '0.6'}}>est.</span></span>
                            <span style={{fontWeight: '600', fontSize: 'var(--text-sm)', color: 'var(--accent-success)'}}>${property.monthlyPayment?.toLocaleString()}</span>
                          </div>
                          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                            <span style={{color: 'var(--secondary-text)'}}>Down Payment <span style={{opacity: '0.6'}}>est.</span></span>
                            <span style={{fontWeight: '600', fontSize: 'var(--text-sm)', color: 'var(--accent-primary)'}}>${property.downPaymentAmount?.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              
              {/* Property Counter */}
              <div className="absolute" style={{top: 'var(--space-4)', left: '50%', transform: 'translateX(-50%)', zIndex: '30', background: 'rgba(0,0,0,0.7)', color: 'white', padding: 'var(--space-1) var(--space-3)', borderRadius: '999px', fontSize: 'var(--text-xs)', fontWeight: '500'}}>
                {currentPropertyIndex + 1} of {properties.length}
              </div>
              
              {/* Navigation Arrows - Optimized for Touch */}
              <button
                onClick={goToPrevious}
                disabled={currentPropertyIndex === 0}
                className="absolute touch-target"
                style={{
                  bottom: '80px',
                  left: 'var(--space-4)',
                  zIndex: '30',
                  background: 'var(--surface-bg)',
                  boxShadow: 'var(--shadow-medium)',
                  borderRadius: '50%',
                  border: 'none',
                  cursor: currentPropertyIndex === 0 ? 'not-allowed' : 'pointer',
                  opacity: currentPropertyIndex === 0 ? '0.3' : '1',
                  color: 'var(--secondary-text)',
                  transition: 'all 0.2s ease'
                }}
                title="Previous Property"
              >
                <svg style={{width: '20px', height: '20px'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              
              <button
                onClick={goToNext}
                disabled={currentPropertyIndex === properties.length - 1}
                className="absolute touch-target"
                style={{
                  bottom: '80px',
                  right: 'var(--space-4)',
                  zIndex: '30',
                  background: 'var(--surface-bg)',
                  boxShadow: 'var(--shadow-medium)',
                  borderRadius: '50%',
                  border: 'none',
                  cursor: currentPropertyIndex === properties.length - 1 ? 'not-allowed' : 'pointer',
                  opacity: currentPropertyIndex === properties.length - 1 ? '0.3' : '1',
                  color: 'var(--secondary-text)',
                  transition: 'all 0.2s ease'
                }}
                title="Next Property"
              >
                <svg style={{width: '20px', height: '20px'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Mobile-Optimized Action Buttons */}
              <div className="absolute" style={{bottom: 'var(--space-4)', left: '50%', transform: 'translateX(-50%)', zIndex: '30', display: 'flex', gap: 'var(--space-3)'}}>
                <button 
                  onClick={() => toggleLike(properties[currentPropertyIndex].id)}
                  className="touch-target"
                  style={{
                    borderRadius: '50%',
                    boxShadow: 'var(--shadow-medium)',
                    border: likedProperties.includes(properties[currentPropertyIndex].id) ? 'none' : '2px solid #fecaca',
                    background: likedProperties.includes(properties[currentPropertyIndex].id) ? 'var(--accent-danger)' : 'var(--surface-bg)',
                    color: likedProperties.includes(properties[currentPropertyIndex].id) ? 'white' : 'var(--accent-danger)',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer'
                  }}
                  title={likedProperties.includes(properties[currentPropertyIndex].id) ? 'Saved' : 'Save Property'}
                >
                  <span style={{fontSize: 'var(--text-xl)'}}>
                    {likedProperties.includes(properties[currentPropertyIndex].id) ? '♥' : '♡'}
                  </span>
                </button>
                
                <button 
                  onClick={() => {
                    const property = properties[currentPropertyIndex];
                    const message = `I'm interested in the property at ${property.address}, ${property.city}, ${property.state}. I found this deal through OwnerFi.`;
                    window.open(`sms:+1234567890&body=${encodeURIComponent(message)}`, '_self');
                  }}
                  className="touch-target"
                  style={{
                    background: 'var(--accent-primary)',
                    color: 'white',
                    borderRadius: '50%',
                    boxShadow: 'var(--shadow-medium)',
                    border: 'none',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer'
                  }}
                  title="Contact Agent"
                >
                  <svg style={{width: '20px', height: '20px'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </button>
              </div>
            </div>
          ) : (
            <div style={{textAlign: 'center', padding: 'var(--space-8) var(--space-4)'}}>
              <div style={{color: 'var(--muted-text)', marginBottom: 'var(--space-6)'}}>
                <svg style={{width: '48px', height: '48px', margin: '0 auto'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-6m-6 0H3m6 0v-3.87a3.5 3.5 0 11-4.24 0V21m11-3v3a2 2 0 01-2 2H9a2 2 0 01-2-2v-3m14 0V9a2 2 0 00-2-2H5a2 2 0 00-2 2v10m14 0H5" />
                </svg>
              </div>
              <h3 style={{fontSize: 'var(--text-lg)', fontWeight: '500', color: 'var(--primary-text)', marginBottom: 'var(--space-2)'}}>No properties found</h3>
              <p style={{color: 'var(--secondary-text)', marginBottom: 'var(--space-6)', fontSize: 'var(--text-sm)'}}>
                We couldn&apos;t find any properties in {profile?.city} that match your budget.
              </p>
              <button 
                onClick={() => router.push('/dashboard/settings')}
                className="mobile-button primary"
                style={{width: '100%'}}
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