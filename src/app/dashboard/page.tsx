'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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
  resultType?: 'direct' | 'nearby';
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
      router.push('/auth/signin');
    } else if (status === 'authenticated' && session?.user?.role !== 'buyer') {
      router.push('/auth/signin');
    }
  }, [status, session, router]);

  // Load data
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role === 'buyer') {
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
      console.error('Failed to load properties:', err);
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-700 font-medium">Finding amazing homes...</p>
        </div>
      </div>
    );
  }

  if (!properties.length) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">🏠</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            No homes found
          </h2>
          <p className="text-gray-600 mb-8 leading-relaxed">
            We couldn't find properties in {profile?.city} that match your criteria. Try adjusting your search.
          </p>
          <Link href="/dashboard/settings" className="bg-blue-600 text-white px-8 py-4 rounded-full font-semibold hover:bg-blue-700 transition-colors shadow-lg">
            Adjust Search
          </Link>
        </div>
      </div>
    );
  }

  const currentProperty = properties[currentIndex];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Minimal Header */}
      <header className="relative z-20 bg-white/80 backdrop-blur-lg border-b border-white/20 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">{profile?.city}</h1>
            <p className="text-xs text-gray-500 mt-1">{currentIndex + 1} of {properties.length} homes</p>
          </div>
          
          <div className="flex space-x-6">
            <Link href="/dashboard" className="flex flex-col items-center">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center shadow-lg">
                <span className="text-white text-lg">🏠</span>
              </div>
              <span className="text-xs font-medium text-blue-600 mt-1">Browse</span>
            </Link>
            
            <Link href="/dashboard/liked" className="flex flex-col items-center">
              <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                <span className="text-gray-600 text-lg">♥</span>
              </div>
              <span className="text-xs font-medium text-gray-500 mt-1">Saved</span>
            </Link>
            
            <Link href="/dashboard/settings" className="flex flex-col items-center">
              <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                <span className="text-gray-600 text-lg">⚙</span>
              </div>
              <span className="text-xs font-medium text-gray-500 mt-1">Settings</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative px-4 pt-6 pb-8 min-h-screen">
        {/* Property Card Stack */}
        <div className="relative max-w-sm mx-auto">
          {/* Background Cards for Stack Effect */}
          {currentIndex < properties.length - 1 && (
            <div className="absolute inset-0 bg-white rounded-3xl shadow-lg transform rotate-1 scale-95 z-10"></div>
          )}
          {currentIndex < properties.length - 2 && (
            <div className="absolute inset-0 bg-white rounded-3xl shadow-md transform -rotate-1 scale-90 z-5"></div>
          )}
          
          {/* Main Property Card */}
          <div className="relative bg-white rounded-3xl shadow-2xl overflow-hidden z-20" style={{height: '600px'}}>
            {/* Property Image */}
            <div className="relative h-80 overflow-hidden">
              <img
                src={
                  currentProperty.zillowImageUrl || 
                  currentProperty.imageUrl ||
                  `https://maps.googleapis.com/maps/api/streetview?size=600x400&location=${encodeURIComponent(currentProperty.address + ', ' + currentProperty.city + ', ' + currentProperty.state)}&key=AIzaSyCelger3EPc8GzTOQq7-cv6tUeVh_XN9jE`
                }
                alt={currentProperty.address}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              
              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent"></div>
              
              {/* Like Badge */}
              {likedProperties.includes(currentProperty.id) && (
                <div className="absolute top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg animate-pulse">
                  ❤️ Loved
                </div>
              )}
              
              {/* Property Title Overlay */}
              <div className="absolute bottom-4 left-4 right-4 text-white">
                <h2 className="text-2xl font-bold mb-1 leading-tight">
                  {currentProperty.address}
                </h2>
                <p className="text-white/90 text-sm">
                  {currentProperty.city}, {currentProperty.state}
                </p>
              </div>
            </div>

            {/* Property Details */}
            <div className="p-6 space-y-6">
              {/* Quick Stats */}
              <div className="flex justify-around bg-gray-50 rounded-2xl p-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">{currentProperty.bedrooms}</div>
                  <div className="text-xs text-gray-500 font-medium">BEDROOMS</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">{currentProperty.bathrooms}</div>
                  <div className="text-xs text-gray-500 font-medium">BATHROOMS</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {currentProperty.squareFeet?.toLocaleString() || '1,140'}
                  </div>
                  <div className="text-xs text-gray-500 font-medium">SQ FT</div>
                </div>
              </div>

              {/* Pricing Grid */}
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-2xl p-4">
                  <div className="text-center">
                    <div className="text-xs text-gray-500 font-medium mb-1">LIST PRICE</div>
                    <div className="text-3xl font-bold text-gray-900">
                      ${currentProperty.listPrice?.toLocaleString() || '260,000'}
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-green-50 rounded-2xl p-4 text-center">
                    <div className="text-xs text-green-600 font-medium mb-1">MONTHLY</div>
                    <div className="text-xl font-bold text-green-600">
                      ${currentProperty.monthlyPayment ? Math.ceil(currentProperty.monthlyPayment).toLocaleString() : '1,403'}
                    </div>
                    <div className="text-xs text-green-500">est.</div>
                  </div>
                  
                  <div className="bg-blue-50 rounded-2xl p-4 text-center">
                    <div className="text-xs text-blue-600 font-medium mb-1">DOWN</div>
                    <div className="text-xl font-bold text-blue-600">
                      ${currentProperty.downPaymentAmount?.toLocaleString() || '26,000'}
                    </div>
                    <div className="text-xs text-blue-500">est.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center items-center space-x-6 mt-8 max-w-sm mx-auto">
          {/* Skip Button */}
          <button
            onClick={prevProperty}
            disabled={currentIndex === 0}
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-lg ${
              currentIndex === 0 
                ? 'bg-gray-200 text-gray-400' 
                : 'bg-white text-gray-600 hover:bg-gray-50 active:scale-95'
            }`}
          >
            <span className="text-2xl">←</span>
          </button>

          {/* Dislike Button */}
          <button
            onClick={nextProperty}
            disabled={currentIndex === properties.length - 1}
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-lg ${
              currentIndex === properties.length - 1
                ? 'bg-gray-200 text-gray-400'
                : 'bg-white text-red-500 hover:bg-red-50 active:scale-95'
            }`}
          >
            <span className="text-2xl">✕</span>
          </button>

          {/* Love Button */}
          <button 
            onClick={() => toggleLike(currentProperty.id)}
            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-lg transform active:scale-95 ${
              likedProperties.includes(currentProperty.id) 
                ? 'bg-red-500 text-white shadow-red-200' 
                : 'bg-white text-red-500 hover:bg-red-50'
            }`}
          >
            <span className="text-3xl">
              {likedProperties.includes(currentProperty.id) ? '❤️' : '♡'}
            </span>
          </button>

          {/* Contact Button */}
          <button 
            onClick={() => {
              const message = `I'm interested in ${currentProperty.address}, ${currentProperty.city}, ${currentProperty.state}. Found via OwnerFi.`;
              window.open(`sms:+1234567890&body=${encodeURIComponent(message)}`, '_self');
            }}
            className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 transition-all shadow-lg transform active:scale-95"
          >
            <span className="text-2xl">💬</span>
          </button>

          {/* Next Button */}
          <button
            onClick={nextProperty}
            disabled={currentIndex === properties.length - 1}
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-lg ${
              currentIndex === properties.length - 1 
                ? 'bg-gray-200 text-gray-400' 
                : 'bg-white text-gray-600 hover:bg-gray-50 active:scale-95'
            }`}
          >
            <span className="text-2xl">→</span>
          </button>
        </div>

        {/* Progress Indicator */}
        <div className="flex justify-center mt-8">
          <div className="flex space-x-2">
            {properties.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentIndex 
                    ? 'bg-blue-600 w-6' 
                    : index < currentIndex 
                      ? 'bg-green-400' 
                      : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}