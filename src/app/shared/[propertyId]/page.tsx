'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import Link from 'next/link';
import { PropertyListing } from '@/lib/property-schema';

export default function SharedPropertyPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const propertyId = params?.propertyId as string;

  const [property, setProperty] = useState<PropertyListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!propertyId) return;

    async function fetchProperty() {
      try {
        const response = await fetch(`/api/properties/details?ids=${JSON.stringify([propertyId])}`);
        const data = await response.json();

        if (data.properties && data.properties.length > 0) {
          setProperty(data.properties[0]);
        } else {
          setError('Property not found');
        }
      } catch (err) {
        console.error('Failed to fetch property:', err);
        setError('Failed to load property');
      } finally {
        setLoading(false);
      }
    }

    fetchProperty();
  }, [propertyId]);

  const handleSaveProperty = async () => {
    // Wait for session to load
    if (status === 'loading') {
      return;
    }

    if (status === 'authenticated') {
      // User is logged in - directly like the property
      setSaving(true);
      try {
        const response = await fetch('/api/buyer/like-property', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ propertyId, action: 'like' })
        });

        if (response.ok) {
          // Redirect to liked properties to show the saved property
          router.push('/dashboard/liked');
        } else {
          // API error - show message and stay on page
          setSaving(false);
          alert('Failed to save property. Please try again.');
        }
      } catch (err) {
        console.error('Failed to like property:', err);
        setSaving(false);
        alert('Failed to save property. Please try again.');
      }
    } else {
      // User not logged in - store property ID and go to auth
      sessionStorage.setItem('shared_property_id', propertyId);
      router.push('/auth');
    }
  };

  // Determine if user is logged in (for button text)
  const isLoggedIn = status === 'authenticated';
  const isCheckingAuth = status === 'loading';

  // Get property image
  const getPropertyImage = () => {
    if (!property) return '/placeholder-house.jpg';
    const propertyAny = property as any;
    const imageUrl =
      propertyAny.imageUrl ||
      propertyAny.firstPropertyImage ||
      property.imageUrls?.[0] ||
      propertyAny.propertyImages?.[0] ||
      propertyAny.zillowImageUrl ||
      propertyAny.images?.[0];

    if (!imageUrl || typeof imageUrl !== 'string' || imageUrl.trim() === '' || imageError) {
      return '/placeholder-house.jpg';
    }
    return imageUrl;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-300">Loading property...</p>
        </div>
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">🏠</div>
          <h1 className="text-2xl font-bold text-white mb-2">Property Not Found</h1>
          <p className="text-slate-300 mb-6">This property may no longer be available or the link is invalid.</p>
          <Link
            href="/"
            className="inline-block bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold transition-colors"
          >
            Browse Properties
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-lg border-b border-slate-700/50">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </div>
            <span className="font-bold text-white">OwnerFi</span>
          </Link>
          <button
            onClick={handleSaveProperty}
            disabled={saving || isCheckingAuth}
            className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-700 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors"
          >
            {isCheckingAuth ? '...' : saving ? 'Saving...' : isLoggedIn ? 'Save Property' : 'Sign Up Free'}
          </button>
        </div>
      </header>

      {/* Property Content */}
      <main className="pt-16 pb-24">
        {/* Property Image */}
        <div className="relative h-72 sm:h-96 w-full">
          <Image
            src={getPropertyImage()}
            alt={property.address}
            fill
            className="object-cover"
            onError={() => setImageError(true)}
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />

          {/* Financing Badge */}
          <div className="absolute top-4 left-4">
            <span className="bg-emerald-600 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg">
              Owner Finance Available
            </span>
          </div>
        </div>

        {/* Property Details */}
        <div className="max-w-lg mx-auto px-4 -mt-8 relative z-10">
          <div className="bg-slate-800/90 backdrop-blur-lg border border-slate-700/50 rounded-2xl p-6 shadow-2xl">
            {/* Price */}
            <div className="mb-4">
              <div className="text-3xl font-black text-white">
                ${property.listPrice?.toLocaleString()}
              </div>
            </div>

            {/* Address */}
            <div className="mb-4">
              <h1 className="text-lg font-bold text-white leading-tight">
                {property.address}
              </h1>
              <p className="text-slate-400">
                {property.city}, {property.state} {property.zipCode}
              </p>
            </div>

            {/* Quick Stats */}
            <div className="flex gap-4 mb-6 flex-wrap">
              <div className="flex items-center gap-2 bg-slate-700/50 rounded-lg px-3 py-2">
                <span className="text-lg">🛏️</span>
                <span className="text-white font-bold">{property.bedrooms}</span>
                <span className="text-slate-400 text-sm">beds</span>
              </div>
              <div className="flex items-center gap-2 bg-slate-700/50 rounded-lg px-3 py-2">
                <span className="text-lg">🚿</span>
                <span className="text-white font-bold">{property.bathrooms}</span>
                <span className="text-slate-400 text-sm">baths</span>
              </div>
              {property.squareFeet && (
                <div className="flex items-center gap-2 bg-slate-700/50 rounded-lg px-3 py-2">
                  <span className="text-lg">📏</span>
                  <span className="text-white font-bold">{property.squareFeet.toLocaleString()}</span>
                  <span className="text-slate-400 text-sm">sq ft</span>
                </div>
              )}
            </div>

            {/* Description Preview */}
            {property.description && (
              <div className="mb-6">
                <h3 className="font-bold text-white mb-2">About This Property</h3>
                <p className="text-slate-300 text-sm leading-relaxed line-clamp-4">
                  {property.description}
                </p>
              </div>
            )}

            {/* Blurred overlay for additional details */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-800/90 rounded-xl pointer-events-none" />
              <div className="blur-sm opacity-50 p-4 bg-slate-700/30 rounded-xl">
                <div className="grid grid-cols-2 gap-4">
                  <div className="h-8 bg-slate-600/50 rounded"></div>
                  <div className="h-8 bg-slate-600/50 rounded"></div>
                  <div className="h-8 bg-slate-600/50 rounded"></div>
                  <div className="h-8 bg-slate-600/50 rounded"></div>
                </div>
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <svg className="w-8 h-8 text-emerald-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <p className="text-white font-semibold text-sm">Sign up to see full details</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Fixed Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-lg border-t border-slate-700/50 p-4">
        <div className="max-w-lg mx-auto">
          <button
            onClick={handleSaveProperty}
            disabled={saving || isCheckingAuth}
            className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 disabled:from-emerald-700 disabled:to-emerald-800 text-white py-4 px-6 rounded-xl font-bold text-lg shadow-xl hover:shadow-2xl transform hover:scale-[1.02] active:scale-[0.98] transition-all disabled:transform-none"
          >
            {isCheckingAuth ? 'Checking...' : saving ? 'Saving Property...' : isLoggedIn ? 'Save This Property' : 'Sign Up to Save This Property'}
          </button>
          <p className="text-center text-slate-400 text-xs mt-2">
            {isLoggedIn ? 'Property will be added to your favorites' : 'Free account - No credit card required'}
          </p>
        </div>
      </div>
    </div>
  );
}
