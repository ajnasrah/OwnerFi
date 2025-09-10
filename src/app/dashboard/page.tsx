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
  const [error, setError] = useState('');
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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="loading mb-4" style={{width: '48px', height: '48px', margin: '0 auto'}}></div>
          <p style={{color: 'var(--gray-600)', fontSize: 'var(--text-base)'}}>Loading your properties...</p>
        </div>
      </div>
    );
  }

  if (!properties.length) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        {/* Simple Header */}
        <header className="border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <h1 style={{fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)'}}>
              {profile?.city || 'Dashboard'}
            </h1>
            <Link href="/dashboard/settings" className="btn-ghost btn-sm">
              Settings
            </Link>
          </div>
        </header>
        
        {/* Empty State */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center" style={{maxWidth: '300px'}}>
            <div style={{
              fontSize: '4rem',
              marginBottom: 'var(--space-6)'
            }}>🏠</div>
            <h2 style={{
              fontSize: 'var(--text-2xl)',
              fontWeight: 'var(--font-bold)',
              marginBottom: 'var(--space-4)'
            }}>
              No properties found
            </h2>
            <p style={{
              fontSize: 'var(--text-base)',
              color: 'var(--blue-600)',
              marginBottom: 'var(--space-8)'
            }}>
              We couldn't find any properties in {profile?.city} that match your budget.
            </p>
            <a href="/dashboard/settings" className="btn-primary btn-lg w-full">
              Update Search Criteria
            </a>
          </div>
        </div>
      </div>
    );
  }

  const currentProperty = properties[currentIndex];

  return (
    <div className="min-h-screen bg-white">
      {/* Clean Header - NO OVERLAYS */}
      <header style={{
        padding: 'var(--space-4)',
        borderBottom: '1px solid var(--blue-200)',
        background: 'var(--white)'
      }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 style={{
              fontSize: 'var(--text-xl)',
              fontWeight: 'var(--font-bold)',
              color: 'var(--blue-950)'
            }}>
              {profile?.city}
            </h1>
            <p style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--blue-500)'
            }}>
              {properties.length} properties found
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/dashboard/liked" className="btn-ghost btn-sm">
              ♥ {likedProperties.length}
            </Link>
            <Link href="/dashboard/settings" className="btn-ghost btn-sm">
              ⚙
            </Link>
          </div>
        </div>
      </header>

      {/* Property Counter - Simple, Clean */}
      <div style={{
        padding: 'var(--space-3) var(--space-4)',
        background: 'var(--blue-50)',
        borderBottom: '1px solid var(--blue-200)',
        textAlign: 'center'
      }}>
        <span style={{
          fontSize: 'var(--text-sm)',
          color: 'var(--blue-600)',
          fontWeight: 'var(--font-medium)'
        }}>
          Property {currentIndex + 1} of {properties.length}
        </span>
      </div>

      {/* Property Display - NO OVERLAYS, CLEAN SCROLL */}
      <main style={{
        padding: 'var(--space-4)',
        paddingBottom: 'var(--space-20)'
      }}>
        {/* Property Image */}
        <div style={{
          width: '100%',
          height: '240px',
          borderRadius: 'var(--radius-xl)',
          overflow: 'hidden',
          marginBottom: 'var(--space-4)',
          background: 'var(--gray-100)'
        }}>
          <img
            src={
              currentProperty.zillowImageUrl || 
              currentProperty.imageUrl ||
              `https://maps.googleapis.com/maps/api/streetview?size=400x240&location=${encodeURIComponent(currentProperty.address + ', ' + currentProperty.city + ', ' + currentProperty.state)}&key=AIzaSyCelger3EPc8GzTOQq7-cv6tUeVh_XN9jE`
            }
            alt={currentProperty.address}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
            loading="lazy"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = `https://maps.googleapis.com/maps/api/streetview?size=400x240&location=${encodeURIComponent(currentProperty.address + ', ' + currentProperty.city + ', ' + currentProperty.state)}&key=AIzaSyCelger3EPc8GzTOQq7-cv6tUeVh_XN9jE`;
            }}
          />
        </div>

        {/* Property Details - Clean Card */}
        <div className="card" style={{padding: 'var(--space-4)', marginBottom: 'var(--space-6)'}}>
          {/* Address */}
          <h2 style={{
            fontSize: 'var(--text-xl)',
            fontWeight: 'var(--font-bold)',
            color: 'var(--blue-950)',
            marginBottom: 'var(--space-1)'
          }}>
            {currentProperty.address}
          </h2>
          
          <p style={{
            fontSize: 'var(--text-base)',
            color: 'var(--blue-600)',
            marginBottom: 'var(--space-4)'
          }}>
            {currentProperty.city}, {currentProperty.state}
          </p>

          {/* Property Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div style={{
                fontSize: 'var(--text-2xl)',
                fontWeight: 'var(--font-bold)',
                color: 'var(--blue-950)'
              }}>
                {currentProperty.bedrooms}
              </div>
              <div style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--blue-500)'
              }}>
                Beds
              </div>
            </div>
            
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div style={{
                fontSize: 'var(--text-2xl)',
                fontWeight: 'var(--font-bold)',
                color: 'var(--blue-950)'
              }}>
                {currentProperty.bathrooms}
              </div>
              <div style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--blue-500)'
              }}>
                Baths
              </div>
            </div>
            
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div style={{
                fontSize: 'var(--text-2xl)',
                fontWeight: 'var(--font-bold)',
                color: 'var(--blue-950)'
              }}>
                {currentProperty.squareFeet?.toLocaleString() || 'N/A'}
              </div>
              <div style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--blue-500)'
              }}>
                Sq Ft
              </div>
            </div>
          </div>

          {/* Financial Details */}
          <div style={{display: 'flex', flexDirection: 'column', gap: 'var(--space-3)'}}>
            <div className="flex justify-between items-center">
              <span style={{fontSize: 'var(--text-base)', color: 'var(--gray-600)'}}>List Price</span>
              <span style={{
                fontSize: 'var(--text-lg)',
                fontWeight: 'var(--font-semibold)',
                color: 'var(--blue-950)'
              }}>
                ${currentProperty.listPrice?.toLocaleString()}
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span style={{fontSize: 'var(--text-base)', color: 'var(--gray-600)'}}>Monthly Payment</span>
              <span style={{
                fontSize: 'var(--text-lg)',
                fontWeight: 'var(--font-semibold)',
                color: 'var(--success)'
              }}>
                ${currentProperty.monthlyPayment?.toLocaleString()}
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span style={{fontSize: 'var(--text-base)', color: 'var(--gray-600)'}}>Down Payment</span>
              <span style={{
                fontSize: 'var(--text-lg)',
                fontWeight: 'var(--font-semibold)',
                color: 'var(--primary)'
              }}>
                ${currentProperty.downPaymentAmount?.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons - Clean Row */}
        <div className="flex gap-3 mb-6">
          <button 
            onClick={() => toggleLike(currentProperty.id)}
            className={`flex-1 btn-lg ${
              likedProperties.includes(currentProperty.id) 
                ? 'btn-primary' 
                : 'btn-secondary'
            }`}
          >
            <span style={{fontSize: 'var(--text-xl)'}}>
              {likedProperties.includes(currentProperty.id) ? '♥' : '♡'}
            </span>
            {likedProperties.includes(currentProperty.id) ? 'Saved' : 'Save'}
          </button>
          
          <button 
            onClick={() => {
              const message = `I'm interested in ${currentProperty.address}, ${currentProperty.city}, ${currentProperty.state}. Found via OwnerFi.`;
              window.open(`sms:+1234567890&body=${encodeURIComponent(message)}`, '_self');
            }}
            className="flex-1 btn-primary btn-lg"
          >
            📱 Contact
          </button>
        </div>

        {/* Navigation - Simple Buttons */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={prevProperty}
            disabled={currentIndex === 0}
            className="btn-secondary btn-lg"
            style={{
              opacity: currentIndex === 0 ? '0.5' : '1',
              cursor: currentIndex === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            ← Previous
          </button>
          
          <button
            onClick={nextProperty}
            disabled={currentIndex === properties.length - 1}
            className="btn-secondary btn-lg"
            style={{
              opacity: currentIndex === properties.length - 1 ? '0.5' : '1',
              cursor: currentIndex === properties.length - 1 ? 'not-allowed' : 'pointer'
            }}
          >
            Next →
          </button>
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav style={{
        position: 'fixed',
        bottom: '0',
        left: '0',
        right: '0',
        background: 'var(--white)',
        borderTop: '1px solid var(--gray-200)',
        padding: 'var(--space-4)',
        zIndex: '50'
      }}>
        <div className="flex justify-center gap-8">
          <Link href="/dashboard" className="flex flex-col items-center gap-1">
            <span style={{fontSize: '1.5rem'}}>🏠</span>
            <span style={{fontSize: 'var(--text-xs)', color: 'var(--primary)', fontWeight: 'var(--font-medium)'}}>
              Browse
            </span>
          </Link>
          
          <Link href="/dashboard/liked" className="flex flex-col items-center gap-1">
            <span style={{fontSize: '1.5rem'}}>♥</span>
            <span style={{fontSize: 'var(--text-xs)', color: 'var(--gray-500)', fontWeight: 'var(--font-medium)'}}>
              Saved ({likedProperties.length})
            </span>
          </Link>
          
          <Link href="/dashboard/settings" className="flex flex-col items-center gap-1">
            <span style={{fontSize: '1.5rem'}}>⚙</span>
            <span style={{fontSize: 'var(--text-xs)', color: 'var(--gray-500)', fontWeight: 'var(--font-medium)'}}>
              Settings
            </span>
          </Link>
        </div>
      </nav>
    </div>
  );
}