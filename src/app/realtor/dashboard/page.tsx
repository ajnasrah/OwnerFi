'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface BuyerLead {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  maxMonthlyPayment: number;
  maxDownPayment: number;
  preferredCity: string;
  preferredState: string;
  searchRadius: number;
  minBedrooms?: number;
  minBathrooms?: number;
  matchedProperties: number;
  perfectMatches?: number;
  goodMatches?: number;
  createdAt: string;
  matchPercentage?: number;
  matchReasoning?: string[];
  languages?: string[];
  alreadyPurchased?: boolean;
  propertyMatchSummary?: string;
}

interface RealtorProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  credits: number;
  isOnTrial: boolean;
  trialEndDate: string;
  profileComplete: boolean;
}

export default function RealtorDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<RealtorProfile | null>(null);
  const [availableLeads, setAvailableLeads] = useState<BuyerLead[]>([]);
  const [purchasedLeads, setPurchasedLeads] = useState<BuyerLead[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/realtor/signin');
    } else if (status === 'authenticated' && session?.user?.role !== 'realtor') {
      router.push('/realtor/signin');
    }
  }, [status, router, session]);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role === 'realtor') {
      loadData();
    }
  }, [status, session]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const profileRes = await fetch('/api/realtor/profile');
      const profileData = await profileRes.json();

      if (!profileData.profile) {
        router.push('/realtor/setup');
        return;
      }

      setProfile(profileData.profile);

      const leadsRes = await fetch('/api/realtor/leads');
      const leadsData = await leadsRes.json();

      setAvailableLeads(leadsData.availableLeads || []);
      setPurchasedLeads(leadsData.purchasedLeads || []);

    } catch (err) {
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="loading mb-4" style={{width: '48px', height: '48px', margin: '0 auto'}}></div>
          <p style={{color: 'var(--gray-600)'}}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header style={{
        padding: 'var(--mobile-padding)',
        borderBottom: '1px solid var(--gray-200)',
        background: 'var(--primary)',
        color: 'white'
      }}>
        <div className="flex items-center justify-between mb-4">
          <Link href="/" style={{color: 'white', fontSize: 'var(--text-sm)'}}>
            ← Home
          </Link>
          <div className="flex gap-2">
            <Link href="/realtor/settings" className="btn-ghost btn-sm" style={{color: 'white'}}>
              Settings
            </Link>
            <button
              onClick={() => signOut({ redirect: false }).then(() => router.push('/'))}
              style={{
                background: 'rgba(255,255,255,0.2)',
                color: 'white',
                border: 'none',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--text-sm)'
              }}
            >
              Sign Out
            </button>
          </div>
        </div>
        
        <div>
          <h1 style={{
            fontSize: 'var(--text-2xl)',
            fontWeight: 'var(--font-bold)',
            marginBottom: 'var(--space-1)'
          }}>
            Welcome back, {profile?.firstName}! 👋
          </h1>
          <p style={{
            color: 'rgba(255,255,255,0.8)',
            fontSize: 'var(--text-sm)'
          }}>
            Your professional lead management center
          </p>
        </div>
      </header>

      {/* Stats */}
      <div style={{
        padding: 'var(--mobile-padding)',
        background: 'var(--gray-50)'
      }}>
        <div className="grid grid-cols-2 gap-4">
          <div className="card text-center p-4">
            <div style={{
              fontSize: 'var(--text-3xl)',
              fontWeight: 'var(--font-bold)',
              color: 'var(--primary)',
              marginBottom: 'var(--space-1)'
            }}>
              {profile?.credits || 0}
            </div>
            <div style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--gray-600)'
            }}>
              Credits Available
            </div>
          </div>
          
          <div className="card text-center p-4">
            <div style={{
              fontSize: 'var(--text-3xl)',
              fontWeight: 'var(--font-bold)',
              color: 'var(--success)',
              marginBottom: 'var(--space-1)'
            }}>
              {purchasedLeads.length}
            </div>
            <div style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--gray-600)'
            }}>
              Purchased Leads
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <main style={{
        padding: 'var(--mobile-padding)',
        paddingBottom: 'var(--space-8)'
      }}>
        {error && (
          <div className="alert error mb-6">
            {error}
          </div>
        )}

        {/* Available Leads */}
        <div style={{marginBottom: 'var(--space-8)'}}>
          <h2 style={{
            fontSize: 'var(--text-xl)',
            fontWeight: 'var(--font-bold)',
            color: 'var(--gray-900)',
            marginBottom: 'var(--space-4)'
          }}>
            Available Buyer Leads ({availableLeads.length})
          </h2>
          
          {availableLeads.length > 0 ? (
            <div style={{display: 'flex', flexDirection: 'column', gap: 'var(--space-4)'}}>
              {availableLeads.slice(0, 5).map((lead) => (
                <div key={lead.id} className="card p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 style={{
                        fontSize: 'var(--text-lg)',
                        fontWeight: 'var(--font-semibold)',
                        color: 'var(--gray-900)'
                      }}>
                        {lead.firstName} {lead.lastName}
                      </h3>
                      <p style={{
                        fontSize: 'var(--text-sm)',
                        color: 'var(--gray-600)'
                      }}>
                        {lead.preferredCity}, {lead.preferredState}
                      </p>
                    </div>
                    <span style={{
                      background: 'var(--primary-light)',
                      color: 'var(--primary)',
                      padding: 'var(--space-1) var(--space-2)',
                      borderRadius: 'var(--radius-base)',
                      fontSize: 'var(--text-xs)',
                      fontWeight: 'var(--font-medium)'
                    }}>
                      {lead.matchPercentage || 75}% Match
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div>
                      <div style={{
                        fontSize: 'var(--text-base)',
                        fontWeight: 'var(--font-semibold)',
                        color: 'var(--gray-900)'
                      }}>
                        ${lead.maxMonthlyPayment?.toLocaleString()}
                      </div>
                      <div style={{
                        fontSize: 'var(--text-xs)',
                        color: 'var(--gray-500)'
                      }}>
                        Max Monthly
                      </div>
                    </div>
                    <div>
                      <div style={{
                        fontSize: 'var(--text-base)',
                        fontWeight: 'var(--font-semibold)',
                        color: 'var(--gray-900)'
                      }}>
                        ${lead.maxDownPayment?.toLocaleString()}
                      </div>
                      <div style={{
                        fontSize: 'var(--text-xs)',
                        color: 'var(--gray-500)'
                      }}>
                        Max Down
                      </div>
                    </div>
                  </div>
                  
                  <button className="btn-primary btn-lg w-full">
                    Purchase Lead - 1 Credit
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="card p-8 text-center">
              <div style={{fontSize: '2rem', marginBottom: 'var(--space-4)'}}>👥</div>
              <h3 style={{
                fontSize: 'var(--text-lg)',
                fontWeight: 'var(--font-semibold)',
                marginBottom: 'var(--space-2)'
              }}>
                No leads available
              </h3>
              <p style={{color: 'var(--gray-600)', fontSize: 'var(--text-sm)'}}>
                Check back soon for new buyer leads in your area.
              </p>
            </div>
          )}
        </div>

        {/* Purchased Leads */}
        {purchasedLeads.length > 0 && (
          <div>
            <h2 style={{
              fontSize: 'var(--text-xl)',
              fontWeight: 'var(--font-bold)',
              color: 'var(--gray-900)',
              marginBottom: 'var(--space-4)'
            }}>
              Your Purchased Leads ({purchasedLeads.length})
            </h2>
            
            <div style={{display: 'flex', flexDirection: 'column', gap: 'var(--space-4)'}}>
              {purchasedLeads.slice(0, 3).map((lead) => (
                <div key={lead.id} className="card p-4" style={{background: 'var(--gray-50)'}}>
                  <div className="flex justify-between items-start mb-2">
                    <h3 style={{
                      fontSize: 'var(--text-base)',
                      fontWeight: 'var(--font-semibold)',
                      color: 'var(--gray-900)'
                    }}>
                      {lead.firstName} {lead.lastName}
                    </h3>
                    <span style={{
                      background: 'var(--success)',
                      color: 'white',
                      padding: 'var(--space-1) var(--space-2)',
                      borderRadius: 'var(--radius-base)',
                      fontSize: 'var(--text-xs)',
                      fontWeight: 'var(--font-medium)'
                    }}>
                      Purchased
                    </span>
                  </div>
                  
                  <div style={{
                    fontSize: 'var(--text-sm)',
                    color: 'var(--gray-600)',
                    marginBottom: 'var(--space-2)'
                  }}>
                    📧 {lead.email}
                  </div>
                  
                  <div style={{
                    fontSize: 'var(--text-sm)',
                    color: 'var(--gray-600)'
                  }}>
                    📱 {lead.phone}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}