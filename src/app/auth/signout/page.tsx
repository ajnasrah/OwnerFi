'use client';

import Link from 'next/link';
import { CheckCircle, Home, BookOpen, Mail } from 'lucide-react';

export default function SignOutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-6 py-20">
        <div className="max-w-2xl mx-auto">
          {/* Success Message */}
          <div className="bg-slate-800/50 backdrop-blur-lg border border-slate-700/50 rounded-2xl p-12 text-center shadow-2xl">
            {/* Success Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-full flex items-center justify-center shadow-2xl">
                <CheckCircle className="w-12 h-12 text-white" />
              </div>
            </div>

            {/* Title */}
            <h1 className="text-4xl font-black text-white mb-4">
              Successfully Signed Out
            </h1>

            {/* Message */}
            <p className="text-lg text-slate-300 mb-8">
              You've been safely signed out of your account. Come back anytime!
            </p>

            {/* Divider */}
            <div className="h-px bg-gradient-to-r from-transparent via-slate-600 to-transparent mb-8"></div>

            {/* Options */}
            <div className="space-y-4">
              <p className="text-sm text-slate-400 uppercase tracking-wider font-bold mb-6">
                What would you like to do next?
              </p>

              {/* Home Button */}
              <Link
                href="/"
                className="block w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 hover:scale-105 shadow-xl shadow-emerald-500/25 group"
              >
                <div className="flex items-center justify-center space-x-3">
                  <Home className="w-6 h-6 group-hover:scale-110 transition-transform" />
                  <span>Go to Home Page</span>
                </div>
              </Link>

              {/* How Owner Finance Works Button */}
              <Link
                href="/how-owner-finance-works"
                className="block w-full bg-slate-700/50 hover:bg-slate-700 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 hover:scale-105 border border-slate-600 group"
              >
                <div className="flex items-center justify-center space-x-3">
                  <BookOpen className="w-6 h-6 group-hover:scale-110 transition-transform" />
                  <span>Learn How Owner Financing Works</span>
                </div>
              </Link>

              {/* Contact Us Button */}
              <Link
                href="/contact"
                className="block w-full bg-slate-700/50 hover:bg-slate-700 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 hover:scale-105 border border-slate-600 group"
              >
                <div className="flex items-center justify-center space-x-3">
                  <Mail className="w-6 h-6 group-hover:scale-110 transition-transform" />
                  <span>Contact Us</span>
                </div>
              </Link>
            </div>

            {/* Footer Text */}
            <div className="mt-8 pt-8 border-t border-slate-700/50">
              <p className="text-sm text-slate-400">
                Need to sign back in?{' '}
                <Link
                  href="/auth/signin"
                  className="text-emerald-400 hover:text-emerald-300 font-bold underline decoration-2 underline-offset-2 transition-colors"
                >
                  Click here
                </Link>
              </p>
            </div>
          </div>

          {/* Additional Info Card */}
          <div className="mt-8 bg-slate-800/30 backdrop-blur-lg border border-slate-700/30 rounded-xl p-6 text-center">
            <p className="text-slate-400 text-sm">
              <span className="font-bold text-emerald-400">OwnerFi</span> - Your trusted platform for owner-financed properties
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
