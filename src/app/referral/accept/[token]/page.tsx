'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface ReferralDetails {
  buyerFirstName: string;
  buyerLastName: string;
  buyerCity: string;
  buyerState: string;
  referringAgentName: string;
  referringAgentCompany: string;
  referralFeePercent: number;
  ownerFiCutPercent: number;
  agreementTermDays: number;
  expiresAt: string | null;
}

interface LeadDetails {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
}

interface SessionUser {
  id?: string;
  email?: string;
  role?: string;
}

export default function AcceptReferralPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  // Handle token param safely - could be string or string[] in Next.js
  const rawToken = params.token;
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;

  const [referral, setReferral] = useState<ReferralDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [signatureName, setSignatureName] = useState('');
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [agreeTCPA, setAgreeTCPA] = useState(false);
  const [agreeCreativeFinance, setAgreeCreativeFinance] = useState(false);
  const [agreeDataAsIs, setAgreeDataAsIs] = useState(false);
  const [success, setSuccess] = useState(false);
  const [leadDetails, setLeadDetails] = useState<LeadDetails | null>(null);

  // Load referral details
  useEffect(() => {
    // Handle missing or invalid token
    if (!token) {
      setError('Invalid referral link - no token provided');
      setLoading(false);
      return;
    }

    async function loadReferral() {
      try {
        const response = await fetch(`/api/realtor/referral/accept?token=${encodeURIComponent(token)}`);
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'Failed to load referral');
          return;
        }

        setReferral(data.referral);
      } catch {
        setError('Failed to load referral details');
      } finally {
        setLoading(false);
      }
    }

    loadReferral();
  }, [token]);

  const handleAccept = async () => {
    if (!signatureName.trim()) {
      setError('Please type your full name to sign');
      return;
    }

    if (!agreeToTerms) {
      setError('Please agree to the referral terms');
      return;
    }

    if (!agreeTCPA) {
      setError('Please acknowledge the TCPA Compliance Agreement');
      return;
    }

    if (!agreeCreativeFinance) {
      setError('Please acknowledge the Creative Finance Disclaimer');
      return;
    }

    if (!agreeDataAsIs) {
      setError('Please accept the data as-is terms');
      return;
    }

    setAccepting(true);
    setError(null);

    try {
      const response = await fetch('/api/realtor/referral/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          signatureTypedName: signatureName,
          signatureCheckbox: agreeToTerms,
          agreeTCPA,
          agreeCreativeFinance,
          agreeDataAsIs
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to accept referral');
        return;
      }

      setSuccess(true);
      setLeadDetails(data.leadDetails);
    } catch {
      setError('Failed to accept referral');
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          {/* OwnerFi Branding */}
          <Link href="/" className="flex items-center justify-center gap-2 mb-6 hover:opacity-80 transition-opacity">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">O</span>
            </div>
            <span className="text-xl font-bold text-white">OwnerFi</span>
          </Link>
          <div className="w-8 h-8 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-white text-lg">Loading referral...</div>
        </div>
      </div>
    );
  }

  if (error && !referral) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 rounded-xl p-8 max-w-md w-full text-center">
          {/* OwnerFi Branding */}
          <Link href="/" className="flex items-center justify-center gap-2 mb-6 hover:opacity-80 transition-opacity">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">O</span>
            </div>
            <span className="text-xl font-bold text-white">OwnerFi</span>
          </Link>
          <div className="text-red-400 text-xl mb-4">{error}</div>
          <Link href="/" className="text-emerald-400 hover:text-emerald-300">
            Go to Homepage
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 rounded-xl p-8 max-w-lg w-full">
          {/* OwnerFi Branding */}
          <Link href="/" className="flex items-center justify-center gap-2 mb-6 hover:opacity-80 transition-opacity">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">O</span>
            </div>
            <span className="text-xl font-bold text-white">OwnerFi</span>
          </Link>
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl text-emerald-400">&#10003;</span>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Referral Accepted!</h1>
            <p className="text-slate-400">The lead has been added to your account.</p>
          </div>

          {leadDetails && (
            <div className="bg-slate-700 rounded-lg p-4 mb-6">
              <h3 className="text-white font-semibold mb-3">Lead Details</h3>
              <div className="space-y-2 text-slate-300">
                <p><span className="text-slate-400">Name:</span> {[leadDetails.firstName, leadDetails.lastName].filter(Boolean).join(' ') || 'N/A'}</p>
                <p><span className="text-slate-400">Email:</span> {leadDetails.email || 'N/A'}</p>
                <p><span className="text-slate-400">Phone:</span> {leadDetails.phone || 'N/A'}</p>
                <p><span className="text-slate-400">Location:</span> {[leadDetails.city, leadDetails.state].filter(Boolean).join(', ') || 'N/A'}</p>
              </div>
            </div>
          )}

          <Link
            href="/realtor-dashboard/buyers"
            className="block w-full bg-emerald-600 hover:bg-emerald-700 text-white text-center py-3 rounded-lg font-semibold transition-colors"
          >
            View My Leads
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* OwnerFi Branding */}
        <div className="flex justify-center mb-6">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">O</span>
            </div>
            <span className="text-xl font-bold text-white">OwnerFi</span>
          </Link>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Buyer Lead Referral</h1>
          <p className="text-slate-400">You&apos;ve been referred a buyer lead</p>
        </div>

        {/* Referral Details */}
        <div className="bg-slate-800 rounded-xl p-6 mb-6">
          <h2 className="text-xl font-semibold text-white mb-4">Lead Preview</h2>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <p className="text-slate-400 text-sm">Buyer Name</p>
              <p className="text-white font-medium">
                {[referral?.buyerFirstName, referral?.buyerLastName].filter(Boolean).join(' ') || 'Unknown'}
              </p>
            </div>
            <div>
              <p className="text-slate-400 text-sm">Location</p>
              <p className="text-white font-medium">
                {[referral?.buyerCity, referral?.buyerState].filter(Boolean).join(', ') || 'Unknown'}
              </p>
            </div>
          </div>

          <div className="border-t border-slate-700 pt-4">
            <h3 className="text-lg font-semibold text-white mb-3">Referred By</h3>
            <p className="text-slate-300">{referral?.referringAgentName}</p>
            {referral?.referringAgentCompany && (
              <p className="text-slate-400 text-sm">{referral.referringAgentCompany}</p>
            )}
          </div>
        </div>

        {/* Agreement Terms */}
        <div className="bg-slate-800 rounded-xl p-6 mb-6">
          <h2 className="text-xl font-semibold text-white mb-4">Referral Agreement Terms</h2>

          <div className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b border-slate-700">
              <span className="text-slate-400">Referral Fee to {referral?.referringAgentName?.split(' ')[0] || 'Agent'}</span>
              <span className="text-white font-semibold">{referral?.referralFeePercent ?? 25}%</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-700">
              <span className="text-slate-400">Agreement Duration</span>
              <span className="text-white font-semibold">{referral?.agreementTermDays ?? 180} days</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-slate-400">Invite Expires</span>
              <span className="text-white font-semibold">
                {referral?.expiresAt ? new Date(referral.expiresAt).toLocaleDateString() : 'N/A'}
              </span>
            </div>
          </div>

          <div className="mt-4 p-3 bg-slate-700/50 rounded-lg text-sm text-slate-300">
            By accepting this referral, you agree to pay {referral?.referralFeePercent ?? 25}% of your commission
            to {referral?.referringAgentName || 'the referring agent'} upon closing. Full contact details will be released after signing.
          </div>
        </div>

        {/* Auth Check */}
        {status === 'loading' ? (
          <div className="text-center text-slate-400 py-8">Checking authentication...</div>
        ) : status === 'unauthenticated' ? (
          <div className="bg-slate-800 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Sign In to Accept</h2>
            <p className="text-slate-400 mb-6">
              You need to be logged in as a realtor to accept this referral.
            </p>
            <div className="flex gap-4">
              <Link
                href={`/auth?redirect=${encodeURIComponent(`/referral/accept/${token}`)}`}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-center py-3 rounded-lg font-semibold transition-colors"
              >
                Sign In
              </Link>
              <Link
                href={`/auth?type=realtor&redirect=${encodeURIComponent(`/referral/accept/${token}`)}`}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white text-center py-3 rounded-lg font-semibold transition-colors"
              >
                Sign Up
              </Link>
            </div>
          </div>
        ) : (session?.user as SessionUser)?.role !== 'realtor' ? (
          <div className="bg-slate-800 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Realtor Account Required</h2>
            <p className="text-slate-400 mb-6">
              Only realtors can accept lead referrals. Please sign up as a realtor to continue.
            </p>
            <Link
              href={`/auth?type=realtor&redirect=${encodeURIComponent(`/referral/accept/${token}`)}`}
              className="block w-full bg-emerald-600 hover:bg-emerald-700 text-white text-center py-3 rounded-lg font-semibold transition-colors"
            >
              Sign Up as Realtor
            </Link>
          </div>
        ) : (
          /* E-Sign Form */
          <div className="bg-slate-800 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Sign Agreement</h2>

            {error && (
              <div className="bg-red-500/20 border border-red-500 text-red-400 p-3 rounded-lg mb-4">
                {error}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-slate-400 text-sm mb-2">
                Type your full legal name to sign
              </label>
              <input
                type="text"
                value={signatureName}
                onChange={(e) => setSignatureName(e.target.value)}
                placeholder="Your Full Name"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="mb-6">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreeToTerms}
                  onChange={(e) => setAgreeToTerms(e.target.checked)}
                  className="w-5 h-5 mt-0.5 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500"
                />
                <span className="text-slate-300 text-sm">
                  I agree to the referral terms above and understand that I will pay {referral?.referralFeePercent ?? 25}%
                  of my commission to the referring agent upon closing this transaction.
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreeTCPA}
                  onChange={(e) => setAgreeTCPA(e.target.checked)}
                  className="w-5 h-5 mt-0.5 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500"
                />
                <span className="text-slate-300 text-sm">
                  I acknowledge and agree to OwnerFi&apos;s <a href="/tcpa-compliance" target="_blank" className="text-emerald-400 hover:underline">TCPA Compliance Agreement</a>. I will comply with all telemarketing laws and honor opt-out requests within 24 hours.
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreeCreativeFinance}
                  onChange={(e) => setAgreeCreativeFinance(e.target.checked)}
                  className="w-5 h-5 mt-0.5 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500"
                />
                <span className="text-slate-300 text-sm">
                  I acknowledge OwnerFi&apos;s <a href="/creative-finance-disclaimer" target="_blank" className="text-emerald-400 hover:underline">Creative Finance Disclaimer</a>. I understand referred buyers may seek owner-financed properties and will direct them to verify all data with licensed professionals.
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreeDataAsIs}
                  onChange={(e) => setAgreeDataAsIs(e.target.checked)}
                  className="w-5 h-5 mt-0.5 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500"
                />
                <span className="text-slate-300 text-sm">
                  I accept that lead contact information is provided &quot;as-is&quot; without verification by OwnerFi. I will independently confirm all lead details before proceeding.
                </span>
              </label>
            </div>

            <button
              onClick={handleAccept}
              disabled={accepting || !signatureName.trim() || !agreeToTerms || !agreeTCPA || !agreeCreativeFinance || !agreeDataAsIs}
              className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                accepting || !signatureName.trim() || !agreeToTerms || !agreeTCPA || !agreeCreativeFinance || !agreeDataAsIs
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              {accepting ? 'Accepting...' : 'Accept Referral & Sign Agreement'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
