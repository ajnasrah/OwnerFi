'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ExtendedSession, isExtendedSession } from '@/types/session';

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

interface Property {
  id: string;
  address: string;
  city: string;
  state: string;
  bedrooms: number;
  bathrooms: number;
  squareFeet?: number;
  listPrice?: number;
  monthlyPayment?: number;
  downPaymentAmount?: number;
  zillowImageUrl?: string;
  imageUrl?: string;
  displayTag?: string;
  matchReason?: string;
  resultType?: 'direct' | 'nearby' | 'liked';
  isLiked?: boolean;
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [profile, setProfile] = useState<BuyerProfile | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [likedProperties, setLikedProperties] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Auth check
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    } else if (status === 'authenticated' && isExtendedSession(session as any) && (session as any)?.user?.role !== 'buyer') {
      router.push('/');
    }
  }, [status, session, router]);

  // Load data
  useEffect(() => {
    if (status === 'authenticated' && isExtendedSession(session as any) && (session as any)?.user?.role === 'buyer') {
      loadData();
    }
  }, [status, session]);

  const loadData = async () => {
    try {
      setLoading(true);

      const profileRes = await fetch('/api/buyer/profile');
      const profileData = await profileRes.json();

      if (!profileData.profile) {
        router.push('/dashboard/setup');
        return;
      }

      setProfile(profileData.profile);
      setLikedProperties(profileData.profile.likedProperties || []);

      const propertiesRes = await fetch(
        `/api/buyer/properties?city=${encodeURIComponent(profileData.profile.city)}&state=${encodeURIComponent(profileData.profile.state || 'TX')}&maxMonthlyPayment=${profileData.profile.maxMonthlyPayment}&maxDownPayment=${profileData.profile.maxDownPayment}`
      );
      const propertiesData = await propertiesRes.json();

      setProperties(propertiesData.properties || []);
      
    } catch (err) {
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

  const nextProperty = () => {
    if (currentIndex < properties.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const prevProperty = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
          <div className="text-2xl font-bold text-white mb-2">SCANNING PROPERTIES</div>
          <p className="text-slate-400 font-medium">Finding owner-financed homes in your area...</p>
        </div>
      </div>
    );
  }

  if (!properties.length) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="w-32 h-32 bg-slate-800/50 backdrop-blur-lg border border-slate-700/50 rounded-2xl flex items-center justify-center mx-auto mb-8">
            <span className="text-6xl">🏠</span>
          </div>
          <h2 className="text-3xl font-black text-white mb-4">
            NO PROPERTIES FOUND
          </h2>
          <p className="text-slate-300 mb-8 leading-relaxed text-lg">
            No owner-financed properties in <span className="text-emerald-400 font-bold">{profile?.city}</span> match your criteria. Expand your search parameters.
          </p>
          <Link 
            href="/dashboard/settings" 
            className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 rounded-xl font-bold text-lg transition-all duration-300 hover:scale-105 shadow-2xl shadow-emerald-500/25"
          >
            ADJUST SEARCH CRITERIA
            <svg className="ml-2 w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </Link>
        </div>
      </div>
    );
  }

  const currentProperty = properties[currentIndex];

  return (
    <div className="min-h-screen bg-slate-900 text-white" style={{zoom: '0.85'}}>
      {/* Dark Header */}
      <header className="relative z-20 bg-slate-800/50 backdrop-blur-lg border-b border-slate-700/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-white">{profile?.city?.toUpperCase()}</h1>
            <p className="text-sm text-slate-400 mt-1 font-semibold">{currentIndex + 1} OF {properties.length} PROPERTIES</p>
          </div>
          
          <div className="flex items-center space-x-6">
            <div className="flex space-x-4">
              <Link href="/dashboard" className="flex flex-col items-center group">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <span className="text-white text-xl">🏠</span>
                </div>
                <span className="text-xs font-bold text-emerald-400 mt-1">BROWSE</span>
              </Link>
              
              <Link href="/dashboard/liked" className="flex flex-col items-center group">
                <div className="w-12 h-12 bg-slate-700/50 hover:bg-slate-600/50 rounded-xl flex items-center justify-center transition-colors group-hover:scale-110">
                  <span className="text-slate-300 text-xl">♥</span>
                </div>
                <span className="text-xs font-bold text-slate-400 mt-1">SAVED</span>
              </Link>
              
              <Link href="/dashboard/settings" className="flex flex-col items-center group">
                <div className="w-12 h-12 bg-slate-700/50 hover:bg-slate-600/50 rounded-xl flex items-center justify-center transition-colors group-hover:scale-110">
                  <span className="text-slate-300 text-xl">⚙</span>
                </div>
                <span className="text-xs font-bold text-slate-400 mt-1">SETTINGS</span>
              </Link>
            </div>
            
            <button
              onClick={() => signOut({ callbackUrl: '/auth/signin' })}
              className="flex flex-col items-center group"
            >
              <div className="w-12 h-12 bg-slate-700/50 hover:bg-red-600/30 rounded-xl flex items-center justify-center transition-all group-hover:scale-110 duration-300">
                <span className="text-slate-300 group-hover:text-red-400 text-xl transition-colors">⏻</span>
              </div>
              <span className="text-xs font-bold text-slate-400 group-hover:text-red-400 mt-1 transition-colors">LOGOUT</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative px-4 pt-6 pb-4">
        {/* Property Card Stack */}
        <div className="relative max-w-md mx-auto">
          {/* Background Cards for Stack Effect */}
          {currentIndex < properties.length - 1 && (
            <div className="absolute inset-0 bg-slate-800/30 rounded-2xl shadow-xl transform rotate-1 scale-95 z-10 border border-slate-700/50"></div>
          )}
          {currentIndex < properties.length - 2 && (
            <div className="absolute inset-0 bg-slate-800/20 rounded-2xl shadow-lg transform -rotate-1 scale-90 z-5 border border-slate-700/30"></div>
          )}
          
          {/* Main Property Card */}
          <div className="relative bg-slate-800/50 backdrop-blur-lg border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden z-20" style={{height: '700px'}}>
            {/* Property Image */}
            <div className="relative h-80 overflow-hidden">
              <img
                src={
                  currentProperty.zillowImageUrl || 
                  currentProperty.imageUrl ||
                  `https://maps.googleapis.com/maps/api/streetview?size=600x400&location=${encodeURIComponent(currentProperty.address + ', ' + currentProperty.city + ', ' + currentProperty.state)}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`
                }
                alt={currentProperty.address}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              
              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>
              
              {/* Property Tags */}
              <div className="absolute top-4 right-4 flex flex-col gap-2">
                {/* Display Tag (liked, nearby, etc.) */}
                {currentProperty.displayTag && (
                  <div className={`px-4 py-2 rounded-xl text-sm font-bold shadow-xl border ${
                    currentProperty.displayTag.includes('❤️') 
                      ? 'bg-gradient-to-r from-red-500 to-red-600 text-white border-red-400/30'
                      : currentProperty.displayTag === 'Nearby'
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white border-blue-400/30'
                      : currentProperty.displayTag.includes('Over Budget')
                      ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white border-orange-400/30'
                      : 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white border-emerald-400/30'
                  }`}>
                    {currentProperty.displayTag}
                  </div>
                )}
                
                {/* Legacy Like Badge - show only if no displayTag with heart */}
                {likedProperties.includes(currentProperty.id) && !currentProperty.displayTag?.includes('❤️') && (
                  <div className="bg-gradient-to-r from-red-500 to-red-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-xl border border-red-400/30">
                    ❤️ SAVED
                  </div>
                )}
              </div>
              
              {/* Property Title Overlay */}
              <div className="absolute bottom-4 left-4 right-4 text-white">
                <h2 className="text-2xl font-black mb-2 leading-tight">
                  {currentProperty.address.toUpperCase()}
                </h2>
                <p className="text-slate-300 text-sm font-semibold">
                  {currentProperty.city.toUpperCase()}, {currentProperty.state}
                </p>
              </div>
            </div>

            {/* Property Details */}
            <div className="p-6 space-y-6">
              {/* Quick Stats */}
              <div className="flex justify-around bg-slate-700/50 backdrop-blur-lg rounded-xl p-4 border border-slate-600/50">
                <div className="text-center">
                  <div className="text-3xl font-black text-emerald-400">{currentProperty.bedrooms}</div>
                  <div className="text-xs text-slate-400 font-bold">BEDROOMS</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-black text-emerald-400">{currentProperty.bathrooms}</div>
                  <div className="text-xs text-slate-400 font-bold">BATHROOMS</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-black text-emerald-400">
                    {currentProperty.squareFeet?.toLocaleString() || '1,140'}
                  </div>
                  <div className="text-xs text-slate-400 font-bold">SQ FT</div>
                </div>
              </div>

              {/* Pricing Grid */}
              <div className="space-y-4">
                <div className="bg-slate-700/50 backdrop-blur-lg rounded-xl p-4 border border-slate-600/50">
                  <div className="text-center">
                    <div className="text-xs text-slate-400 font-bold mb-2">LIST PRICE</div>
                    <div className="text-3xl font-black text-white">
                      ${currentProperty.listPrice?.toLocaleString() || '260,000'}
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gradient-to-br from-emerald-600/20 to-emerald-700/20 backdrop-blur-lg rounded-xl p-4 text-center border border-emerald-500/30">
                    <div className="text-xs text-emerald-400 font-bold mb-1">MONTHLY</div>
                    <div className="text-xl font-black text-emerald-300">
                      ${currentProperty.monthlyPayment ? Math.ceil(currentProperty.monthlyPayment).toLocaleString() : '1,403'}
                    </div>
                    <div className="text-xs text-emerald-400/70 font-semibold">ESTIMATED</div>
                  </div>
                  
                  <div className="bg-gradient-to-br from-blue-600/20 to-blue-700/20 backdrop-blur-lg rounded-xl p-4 text-center border border-blue-500/30">
                    <div className="text-xs text-blue-400 font-bold mb-1">DOWN</div>
                    <div className="text-xl font-black text-blue-300">
                      ${currentProperty.downPaymentAmount?.toLocaleString() || '26,000'}
                    </div>
                    <div className="text-xs text-blue-400/70 font-semibold">ESTIMATED</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center items-center space-x-4 mt-8 max-w-md mx-auto">
          {/* Previous Button */}
          <button
            onClick={prevProperty}
            disabled={currentIndex === 0}
            className={`w-16 h-16 rounded-xl flex items-center justify-center transition-all shadow-xl border-2 ${
              currentIndex === 0 
                ? 'bg-slate-700/30 text-slate-500 border-slate-600/30' 
                : 'bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 hover:text-white border-slate-600/50 hover:border-slate-500 hover:scale-110 active:scale-95'
            }`}
          >
            <span className="text-2xl font-bold">←</span>
          </button>

          {/* Pass Button */}
          <button
            onClick={nextProperty}
            disabled={currentIndex === properties.length - 1}
            className={`w-16 h-16 rounded-xl flex items-center justify-center transition-all shadow-xl border-2 ${
              currentIndex === properties.length - 1
                ? 'bg-slate-700/30 text-slate-500 border-slate-600/30'
                : 'bg-gradient-to-br from-red-600/20 to-red-700/20 hover:from-red-500/30 hover:to-red-600/30 text-red-400 hover:text-red-300 border-red-500/30 hover:border-red-400/50 hover:scale-110 active:scale-95'
            }`}
          >
            <span className="text-2xl font-bold">✕</span>
          </button>

          {/* Love Button */}
          <button 
            onClick={() => toggleLike(currentProperty.id)}
            className={`w-20 h-20 rounded-xl flex items-center justify-center transition-all shadow-2xl transform active:scale-95 hover:scale-110 border-2 ${
              likedProperties.includes(currentProperty.id) 
                ? 'bg-gradient-to-br from-red-500 to-red-600 text-white border-red-400/50 shadow-red-500/30' 
                : 'bg-gradient-to-br from-red-600/20 to-red-700/20 hover:from-red-500/30 hover:to-red-600/30 text-red-400 hover:text-red-300 border-red-500/30 hover:border-red-400/50'
            }`}
          >
            <span className="text-3xl">
              {likedProperties.includes(currentProperty.id) ? '❤️' : '♡'}
            </span>
          </button>

          {/* Contact Button */}
          <button 
            onClick={() => {
              const message = `I&apos;m interested in ${currentProperty.address}, ${currentProperty.city}, ${currentProperty.state}. Found through OwnerFi.`;
              window.open(`sms:+1234567890&body=${encodeURIComponent(message)}`, '_self');
            }}
            className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white rounded-xl flex items-center justify-center transition-all shadow-2xl shadow-emerald-500/25 transform active:scale-95 hover:scale-110 border-2 border-emerald-400/30"
          >
            <span className="text-xl">💬</span>
          </button>

          {/* Next Button */}
          <button
            onClick={nextProperty}
            disabled={currentIndex === properties.length - 1}
            className={`w-16 h-16 rounded-xl flex items-center justify-center transition-all shadow-xl border-2 ${
              currentIndex === properties.length - 1 
                ? 'bg-slate-700/30 text-slate-500 border-slate-600/30' 
                : 'bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 hover:text-white border-slate-600/50 hover:border-slate-500 hover:scale-110 active:scale-95'
            }`}
          >
            <span className="text-2xl font-bold">→</span>
          </button>
        </div>

        {/* Progress Indicator */}
        <div className="flex justify-center mt-8">
          <div className="flex space-x-2 bg-slate-800/30 backdrop-blur-lg rounded-full px-4 py-2 border border-slate-700/50">
            {properties.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentIndex 
                    ? 'bg-emerald-400 w-8' 
                    : index < currentIndex 
                      ? 'bg-emerald-500/70' 
                      : 'bg-slate-600'
                }`}
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}