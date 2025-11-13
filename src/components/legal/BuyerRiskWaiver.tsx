'use client';

import { useState } from 'react';
import Link from 'next/link';

interface BuyerRiskWaiverProps {
  onAccept: () => void;
  onDecline?: () => void;
  isOpen: boolean;
}

export function BuyerRiskWaiver({ onAccept, onDecline, isOpen }: BuyerRiskWaiverProps) {
  const [hasScrolled, setHasScrolled] = useState(false);
  const [hasCheckedBox, setHasCheckedBox] = useState(false);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const scrolledToBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 50;
    if (scrolledToBottom) {
      setHasScrolled(true);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-orange-600 text-white p-6 rounded-t-2xl">
          <h2 className="text-3xl font-bold mb-2">⚠️ Buyer Acknowledgment & Risk Disclosure</h2>
          <p className="text-red-100">Required before viewing properties</p>
        </div>

        {/* Content - Scrollable */}
        <div
          className="flex-1 overflow-y-auto p-6 space-y-5"
          onScroll={handleScroll}
        >
          {/* Critical Warning */}
          <div className="bg-red-50 border-2 border-red-300 rounded-lg p-5">
            <h3 className="text-xl font-bold text-red-900 mb-3">
              🚨 CRITICAL: READ BEFORE PROCEEDING
            </h3>
            <p className="text-red-800 font-semibold">
              By checking the box below, you acknowledge and agree to ALL statements in this disclosure. This is a legally binding agreement.
            </p>
          </div>

          {/* Acknowledgments */}
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-bold text-blue-900 mb-2">1. All Property Data is Unverified</h4>
              <p className="text-blue-800 text-sm">
                I understand that ALL property information displayed on OwnerFi is unverified and provided solely by listing agents, MLS systems, and third-party sources. OwnerFi does not inspect, verify, or guarantee any property data.
              </p>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <h4 className="font-bold text-orange-900 mb-2">2. Terms are Hypothetical and Subject to Change</h4>
              <p className="text-orange-800 text-sm">
                I understand that all seller-finance terms (interest rates, down payments, monthly payments, balloon payments) are <strong>hypothetical, approximate, and non-binding</strong>. Sellers can change or withdraw these terms at any time.
              </p>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h4 className="font-bold text-purple-900 mb-2">3. OwnerFi Does Not Represent Me</h4>
              <p className="text-purple-800 text-sm">
                I understand that OwnerFi is <strong>NOT a broker, agent, lender, or advisor</strong>. OwnerFi does not represent me, negotiate for me, or provide any brokerage services. OwnerFi is only a lead generation and property database platform.
              </p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="font-bold text-yellow-900 mb-2">4. I Must Independently Verify All Information</h4>
              <p className="text-yellow-800 text-sm">
                I agree to independently verify ALL property information including: ownership, title status, liens, property condition, square footage, seller-finance terms, interest rates, payment amounts, balloon payments, taxes, insurance, HOA fees, and all other material facts.
              </p>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h4 className="font-bold text-red-900 mb-2">5. Creative Finance Carries Significant Risks</h4>
              <p className="text-red-800 text-sm">
                I understand that creative finance structures (subject-to, wraparound mortgages, lease options, contract-for-deed) carry significant legal and financial risks including due-on-sale triggers, balloon payment defaults, title issues, and regulatory violations. I will consult licensed professionals before entering any creative finance transaction.
              </p>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h4 className="font-bold text-green-900 mb-2">6. I Will Hire Licensed Professionals</h4>
              <p className="text-green-800 text-sm">
                I agree to hire and consult with licensed professionals including:
              </p>
              <ul className="list-disc ml-6 mt-2 space-y-1 text-green-700 text-sm">
                <li><strong>Residential Mortgage Loan Originator (RMLO)</strong> or licensed mortgage broker</li>
                <li><strong>Licensed real estate attorney</strong> to review all contracts</li>
                <li><strong>Licensed real estate agent</strong> (buyer's agent) to represent my interests</li>
                <li><strong>Title company</strong> to conduct title search and verify ownership</li>
                <li><strong>Licensed home inspector</strong> to assess property condition</li>
                <li><strong>CPA or tax professional</strong> for tax implications</li>
              </ul>
            </div>

            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
              <h4 className="font-bold text-indigo-900 mb-2">7. I Will Not Rely Solely on OwnerFi</h4>
              <p className="text-indigo-800 text-sm">
                I will NOT rely solely on OwnerFi's property database or payment calculations to make financial decisions. I understand that payment estimates exclude taxes, insurance, HOA fees, reserves, and other costs. My actual monthly payment will be significantly higher.
              </p>
            </div>

            <div className="bg-pink-50 border border-pink-200 rounded-lg p-4">
              <h4 className="font-bold text-pink-900 mb-2">8. I Accept Full Responsibility for Due Diligence</h4>
              <p className="text-pink-800 text-sm">
                I accept <strong>full responsibility</strong> for conducting my own due diligence, verifying all information, and making informed decisions. I will NOT hold OwnerFi liable for inaccurate information, failed transactions, changed terms, or any losses I may incur.
              </p>
            </div>
          </div>

          {/* Wire Fraud Warning */}
          <div className="bg-red-100 border-2 border-red-400 rounded-lg p-5">
            <h4 className="font-bold text-red-900 text-lg mb-2">💰 WIRE FRAUD WARNING</h4>
            <ul className="space-y-2 text-red-800 text-sm font-semibold">
              <li>⛔ OWNERFI NEVER PROVIDES WIRE INSTRUCTIONS</li>
              <li>⛔ OWNERFI NEVER REQUESTS PAYMENTS OR DEPOSITS</li>
              <li>⛔ OWNERFI NEVER SENDS WIRING INFORMATION BY EMAIL</li>
            </ul>
            <p className="text-red-900 font-bold mt-3 text-sm">
              ✅ ALWAYS verify wiring instructions BY PHONE with your title/escrow company using a number YOU look up independently.
            </p>
          </div>

          {/* Scroll Reminder */}
          {!hasScrolled && (
            <div className="bg-yellow-100 border border-yellow-300 rounded-lg p-4 text-center">
              <p className="text-yellow-800 font-semibold">
                👇 Please scroll to the bottom to continue
              </p>
            </div>
          )}
        </div>

        {/* Footer - Checkbox and Buttons */}
        <div className="border-t border-slate-200 p-6 bg-slate-50 rounded-b-2xl space-y-4">
          {/* Checkbox */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={hasCheckedBox}
              onChange={(e) => setHasCheckedBox(e.target.checked)}
              disabled={!hasScrolled}
              className="mt-1 w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
            <span className={`text-sm ${hasScrolled ? 'text-slate-800' : 'text-slate-400'}`}>
              <strong>I have read and understand all of the above statements.</strong> I acknowledge that:
              (1) all information is unverified, (2) terms are hypothetical and can change,
              (3) OwnerFi does not represent me, (4) I must verify everything independently,
              (5) I will hire licensed professionals, (6) I accept full responsibility for due diligence,
              and (7) I will not hold OwnerFi liable for any inaccuracies, errors, or losses.
            </span>
          </label>

          {/* Buttons */}
          <div className="flex gap-4">
            {onDecline && (
              <button
                onClick={onDecline}
                className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                I Do Not Agree
              </button>
            )}
            <button
              onClick={onAccept}
              disabled={!hasScrolled || !hasCheckedBox}
              className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 px-6 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              I Agree - Continue to Properties
            </button>
          </div>

          {/* Additional Links */}
          <div className="text-center text-xs text-slate-600 space-x-4">
            <Link href="/terms" target="_blank" className="hover:text-blue-600 underline">
              Full Terms of Service
            </Link>
            <Link href="/privacy" target="_blank" className="hover:text-blue-600 underline">
              Privacy Policy
            </Link>
            <Link href="/creative-finance-disclaimer" target="_blank" className="hover:text-blue-600 underline">
              Creative Finance Disclaimer
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
