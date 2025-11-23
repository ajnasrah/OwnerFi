'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface FilterUpgradeModalProps {
  onClose: () => void;
  onUpgrade: () => void;
}

export function FilterUpgradeModal({ onClose, onUpgrade }: FilterUpgradeModalProps) {
  const router = useRouter();
  const [isClosing, setIsClosing] = useState(false);

  const handleUpgrade = () => {
    setIsClosing(true);
    setTimeout(() => {
      onUpgrade();
      router.push('/dashboard/settings?tab=filters');
    }, 200);
  };

  const handleSkip = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 200);
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-3 transition-opacity duration-200 ${isClosing ? 'opacity-0' : 'opacity-100'}`}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleSkip}
      />

      {/* Modal - Compact for Mobile */}
      <div className={`relative bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl shadow-2xl border border-slate-700/50 max-w-md w-full max-h-[90vh] overflow-y-auto transform transition-all duration-200 ${isClosing ? 'scale-95' : 'scale-100'}`}>
        {/* Compact Header */}
        <div className="p-4 border-b border-slate-700/50">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="flex-1 pr-6">
              <h2 className="text-lg font-bold text-white mb-1">
                New Filter Options Available!
              </h2>
              <p className="text-slate-300 text-xs">
                We've upgraded our search system with better filters
              </p>
            </div>
          </div>
        </div>

        {/* Compact Content */}
        <div className="p-4 space-y-3">
          <div className="bg-slate-700/30 rounded-lg p-3 border border-slate-600/30">
            <h3 className="text-white font-semibold text-sm mb-2 flex items-center gap-1.5">
              <span className="text-emerald-400 text-base">✨</span>
              What's New:
            </h3>
            <ul className="space-y-1.5 text-slate-300 text-xs">
              <li className="flex items-start gap-1.5">
                <span className="text-emerald-400 mt-0.5">•</span>
                <span><strong className="text-white">Bedroom Range:</strong> Set min/max bedrooms (e.g., 3-4 bedrooms)</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-emerald-400 mt-0.5">•</span>
                <span><strong className="text-white">Bathroom Range:</strong> Filter by number of bathrooms</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-emerald-400 mt-0.5">•</span>
                <span><strong className="text-white">Square Footage:</strong> Set your ideal home size range</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-emerald-400 mt-0.5">•</span>
                <span><strong className="text-white">Asking Price:</strong> Filter by property listing price</span>
              </li>
            </ul>
          </div>

          <div className="bg-blue-500/10 rounded-lg p-3 border border-blue-500/30">
            <p className="text-blue-300 text-xs flex items-start gap-2">
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <span>
                <strong className="text-blue-200">Good news:</strong> We removed budget filtering, so you now see ALL properties in your area by default. These new filters are optional and give you more control!
              </span>
            </p>
          </div>
        </div>

        {/* Compact Actions */}
        <div className="p-4 border-t border-slate-700/50 flex flex-col gap-2">
          <button
            onClick={handleUpgrade}
            className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white py-2.5 px-4 rounded-lg font-semibold text-sm transition-all duration-300 hover:scale-[1.02] shadow-lg shadow-emerald-500/25"
          >
            Set Up Filters
          </button>
          <button
            onClick={handleSkip}
            className="w-full bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-white py-2.5 px-4 rounded-lg font-semibold text-sm transition-all duration-200 border border-slate-600/50"
          >
            Skip for Now
          </button>
        </div>

        {/* Close button */}
        <button
          onClick={handleSkip}
          className="absolute top-3 right-3 text-slate-400 hover:text-white transition-colors"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
