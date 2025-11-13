'use client';

import { useState } from 'react';
import Link from 'next/link';

interface AgentDataAgreementProps {
  onAccept: (signature: string) => void;
  onDecline?: () => void;
  isOpen: boolean;
  agentName?: string;
  agentEmail?: string;
}

export function AgentDataAgreement({
  onAccept,
  onDecline,
  isOpen,
  agentName = '',
  agentEmail = ''
}: AgentDataAgreementProps) {
  const [hasScrolled, setHasScrolled] = useState(false);
  const [hasCheckedBox, setHasCheckedBox] = useState(false);
  const [signature, setSignature] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const scrolledToBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 50;
    if (scrolledToBottom) {
      setHasScrolled(true);
    }
  };

  const canSubmit = hasScrolled && hasCheckedBox && signature.trim().length > 0 && licenseNumber.trim().length > 0;

  const handleAccept = () => {
    if (canSubmit) {
      onAccept(signature);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6 rounded-t-2xl">
          <h2 className="text-3xl font-bold mb-2">📋 Agent Data Accuracy & Indemnity Agreement</h2>
          <p className="text-purple-100">Required for all licensed real estate professionals</p>
        </div>

        {/* Content - Scrollable */}
        <div
          className="flex-1 overflow-y-auto p-6 space-y-5"
          onScroll={handleScroll}
        >
          {/* Introduction */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
            <p className="text-blue-900 font-semibold mb-2">Purpose of This Agreement:</p>
            <p className="text-blue-800 text-sm">
              As a licensed real estate professional submitting property information to OwnerFi, you agree to provide accurate data and accept responsibility for any errors, omissions, or misrepresentations in the information you provide.
            </p>
          </div>

          {/* Agent Responsibilities */}
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-slate-900">Agent Agrees To:</h3>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h4 className="font-bold text-green-900 mb-2">1. Provide Accurate Information</h4>
              <p className="text-green-800 text-sm">
                All property information submitted to OwnerFi (including but not limited to property address, price, square footage, bedrooms, bathrooms, lot size, property condition, seller-finance terms, interest rates, down payments, balloon payments, and property descriptions) is <strong>accurate to the best of my knowledge</strong> and based on information I have personally verified or received from reliable sources.
              </p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="font-bold text-yellow-900 mb-2">2. Seller-Finance Terms are Hypothetical</h4>
              <p className="text-yellow-800 text-sm">
                I understand and acknowledge that any seller-finance terms I provide (interest rates, down payments, monthly payments, balloon payments, amortization periods) are <strong>hypothetical, illustrative, and non-binding</strong> unless contractually approved by the seller in a fully executed purchase agreement. These terms are subject to change or withdrawal by the seller at any time.
              </p>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <h4 className="font-bold text-orange-900 mb-2">3. Update Information Promptly</h4>
              <p className="text-orange-800 text-sm">
                I agree to promptly notify OwnerFi if any property information changes, including:
              </p>
              <ul className="list-disc ml-6 mt-2 space-y-1 text-orange-700 text-sm">
                <li>Property sold or under contract</li>
                <li>Price changes or term modifications</li>
                <li>Seller-finance terms changed or withdrawn</li>
                <li>Property delisted or removed from the market</li>
                <li>Material defects discovered or disclosed</li>
                <li>Any other material changes to property status or details</li>
              </ul>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h4 className="font-bold text-purple-900 mb-2">4. Acknowledge OwnerFi's Limitations</h4>
              <p className="text-purple-800 text-sm">
                I understand and acknowledge that:
              </p>
              <ul className="list-disc ml-6 mt-2 space-y-1 text-purple-700 text-sm">
                <li>OwnerFi does NOT verify, inspect, or confirm property information I provide</li>
                <li>OwnerFi relies entirely on the accuracy of information I submit</li>
                <li>OwnerFi is NOT responsible for errors in information I provide</li>
                <li>OwnerFi displays property information "as provided" by me</li>
                <li>Buyers will rely on the information I provide to make decisions</li>
              </ul>
            </div>
          </div>

          {/* Indemnification */}
          <div className="bg-red-50 border-2 border-red-300 rounded-lg p-5">
            <h3 className="text-xl font-bold text-red-900 mb-3">⚖️ Indemnification Clause</h3>
            <p className="text-red-800 text-sm font-semibold mb-3">
              Agent agrees to <strong>indemnify, defend, and hold harmless</strong> OwnerFi and its affiliates, officers, directors, employees, and contractors from and against any and all claims, damages, losses, liabilities, costs, or expenses (including reasonable attorney's fees) arising from or related to:
            </p>
            <ul className="list-disc ml-6 space-y-1 text-red-700 text-sm">
              <li>Inaccurate, incomplete, outdated, or misleading property information I provided</li>
              <li>Errors or omissions in seller-finance terms I submitted</li>
              <li>Material defects I failed to disclose</li>
              <li>Changes to property status or terms I failed to update</li>
              <li>Misrepresentations about property condition, ownership, or financing</li>
              <li>Buyer reliance on incorrect information I provided</li>
              <li>Any violation of real estate laws or regulations in my submission of property data</li>
              <li>Creative finance structures I described or promoted without proper compliance review</li>
            </ul>
          </div>

          {/* TCPA & Compliance */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
            <h3 className="text-xl font-bold text-blue-900 mb-3">📞 TCPA Compliance Obligation</h3>
            <p className="text-blue-800 text-sm mb-3">
              When contacting leads purchased from OwnerFi, I agree to:
            </p>
            <ul className="list-disc ml-6 space-y-1 text-blue-700 text-sm">
              <li>Comply with the federal Telephone Consumer Protection Act (TCPA)</li>
              <li>Comply with the Telemarketing Sales Rule (TSR)</li>
              <li>Comply with all applicable state mini-TCPA laws</li>
              <li>Honor all opt-out requests within 24 hours</li>
              <li>Maintain an internal Do Not Call list</li>
              <li>Properly identify myself and my brokerage in all communications</li>
              <li>Use automated dialing or texting systems only in compliance with applicable laws</li>
            </ul>
            <p className="text-blue-900 font-semibold mt-3 text-sm">
              See <Link href="/tcpa-compliance" target="_blank" className="underline hover:text-blue-600">TCPA Compliance Agreement</Link> for full details.
            </p>
          </div>

          {/* Independent Contractor */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-5">
            <h3 className="text-xl font-bold text-slate-900 mb-3">👔 Independent Contractor Status</h3>
            <p className="text-slate-700 text-sm">
              I acknowledge that I am an <strong>independent contractor</strong>, not an employee or representative of OwnerFi. All property listings, communications with buyers, and transactions are conducted on behalf of myself and/or my brokerage only. OwnerFi is not a party to any transaction and does not provide brokerage services.
            </p>
          </div>

          {/* Termination */}
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-5">
            <h3 className="text-xl font-bold text-orange-900 mb-3">🚫 Termination for Non-Compliance</h3>
            <p className="text-orange-800 text-sm">
              OwnerFi reserves the right to <strong>immediately suspend or terminate</strong> my access to the platform in the event of:
            </p>
            <ul className="list-disc ml-6 mt-2 space-y-1 text-orange-700 text-sm">
              <li>Repeated submission of inaccurate property information</li>
              <li>Failure to update property status promptly</li>
              <li>TCPA violations or consumer complaints</li>
              <li>Material misrepresentations or fraud</li>
              <li>Violation of real estate licensing laws</li>
              <li>Failure to comply with this agreement</li>
            </ul>
            <p className="text-orange-900 font-semibold mt-3 text-sm">
              Termination may occur without refund and without prior notice.
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

        {/* Footer - Signature and Buttons */}
        <div className="border-t border-slate-200 p-6 bg-slate-50 rounded-b-2xl space-y-4">
          {/* Agent Info Display */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 text-sm">
            <p className="text-slate-600">Agent Name: <strong className="text-slate-900">{agentName || 'Not provided'}</strong></p>
            <p className="text-slate-600">Email: <strong className="text-slate-900">{agentEmail || 'Not provided'}</strong></p>
          </div>

          {/* License Number */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Real Estate License Number <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={licenseNumber}
              onChange={(e) => setLicenseNumber(e.target.value)}
              disabled={!hasScrolled}
              placeholder="Enter your license number"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed"
            />
          </div>

          {/* Electronic Signature */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Electronic Signature (Type your full legal name) <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              disabled={!hasScrolled}
              placeholder="Type your full name to sign"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed font-serif text-lg"
            />
            <p className="text-xs text-slate-500 mt-1">
              By typing your name, you are signing this agreement electronically.
            </p>
          </div>

          {/* Checkbox */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={hasCheckedBox}
              onChange={(e) => setHasCheckedBox(e.target.checked)}
              disabled={!hasScrolled}
              className="mt-1 w-5 h-5 text-purple-600 rounded focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
            />
            <span className={`text-sm ${hasScrolled ? 'text-slate-800' : 'text-slate-400'}`}>
              <strong>I have read and agree to this Agent Data Accuracy & Indemnity Agreement.</strong> I acknowledge that I am responsible for the accuracy of all property information I submit, agree to indemnify OwnerFi for any claims arising from inaccurate information, and understand that I may be terminated for non-compliance.
            </span>
          </label>

          {/* Buttons */}
          <div className="flex gap-4">
            {onDecline && (
              <button
                onClick={onDecline}
                className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleAccept}
              disabled={!canSubmit}
              className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold py-3 px-6 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Sign and Accept Agreement
            </button>
          </div>

          {/* Date Display */}
          <div className="text-center text-xs text-slate-500">
            Agreement Date: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </div>

          {/* Additional Links */}
          <div className="text-center text-xs text-slate-600 space-x-4">
            <Link href="/terms" target="_blank" className="hover:text-purple-600 underline">
              Terms of Service
            </Link>
            <Link href="/tcpa-compliance" target="_blank" className="hover:text-purple-600 underline">
              TCPA Compliance
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
