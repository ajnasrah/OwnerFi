'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useFormTracking } from '@/components/analytics/AnalyticsProvider';

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: ''
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Form tracking
  const { trackFormStart, trackFormSubmit, trackFormSuccess, trackFormError, resetFormTracking } = useFormTracking('contact');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    trackFormSubmit();

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit');
      }

      trackFormSuccess({ subject: formData.subject });
      setSuccess(true);
      setFormData({ name: '', email: '', phone: '', subject: '', message: '' });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Something went wrong';
      trackFormError(errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#111625] text-white">
      {/* Header */}
      <nav className="sticky top-0 z-50 bg-[#111625]/90 backdrop-blur-xl border-b border-white/[0.06] px-4 sm:px-6">
        <div className="flex justify-between items-center max-w-6xl mx-auto h-14 sm:h-16">
          <Link href="/" className="flex items-center gap-2">
            <svg width="28" height="28" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="lg" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse"><stop offset="0%" stopColor="#00BC7D"/><stop offset="100%" stopColor="#3B82F6"/></linearGradient></defs><circle cx="50" cy="50" r="45" stroke="url(#lg)" strokeWidth="7" fill="none"/><ellipse cx="50" cy="50" rx="42" ry="22" stroke="url(#lg)" strokeWidth="5.5" fill="none" transform="rotate(-25 50 50)"/><ellipse cx="50" cy="50" rx="22" ry="42" stroke="url(#lg)" strokeWidth="5.5" fill="none" transform="rotate(-25 50 50)"/></svg>
            <span className="text-lg font-bold text-white">Ownerfi</span>
          </Link>
          <Link
            href="/"
            className="hidden sm:inline-flex text-sm text-slate-400 hover:text-white px-3 py-2 rounded-lg transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">Contact Us</h1>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto">
            Have questions about owner financing or need help finding your dream home? We're here to help.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-12">
          {/* Contact Form */}
          <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8">
            {success ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-[#00BC7D]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-[#00BC7D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Message Sent!</h3>
                <p className="text-slate-300 mb-6">We'll get back to you within 24 hours.</p>
                <button
                  onClick={() => {
                    setSuccess(false);
                    resetFormTracking();
                  }}
                  className="text-[#00BC7D] hover:text-[#00d68f] font-medium"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3">
                    <p className="text-red-300 text-sm">{error}</p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    onFocus={trackFormStart}
                    className="w-full px-4 py-3 bg-[#111625]/50 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00BC7D] text-white placeholder-slate-500"
                    placeholder="Your name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">Email *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-4 py-3 bg-[#111625]/50 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00BC7D] text-white placeholder-slate-500"
                    placeholder="you@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">Phone (optional)</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-4 py-3 bg-[#111625]/50 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00BC7D] text-white placeholder-slate-500"
                    placeholder="(555) 123-4567"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">Subject *</label>
                  <select
                    required
                    value={formData.subject}
                    onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                    className="w-full px-4 py-3 bg-[#111625]/50 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00BC7D] text-white"
                  >
                    <option value="">Select a topic</option>
                    <option value="general">General Question</option>
                    <option value="buyer">Buyer Inquiry</option>
                    <option value="seller">Seller/Property Owner</option>
                    <option value="realtor">Realtor Partnership</option>
                    <option value="support">Technical Support</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">Message *</label>
                  <textarea
                    required
                    rows={5}
                    value={formData.message}
                    onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                    className="w-full px-4 py-3 bg-[#111625]/50 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00BC7D] text-white placeholder-slate-500 resize-none"
                    placeholder="How can we help you?"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-[#00BC7D] to-[#009B66] hover:from-[#00BC7D] hover:to-[#009B66] text-white py-3 px-4 rounded-lg font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Sending...' : 'Send Message'}
                </button>
              </form>
            )}
          </div>

          {/* Contact Info */}
          <div className="space-y-8">
            <div>
              <h3 className="text-xl font-bold text-white mb-4">Other Ways to Reach Us</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-[#00BC7D]/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-[#00BC7D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Email</p>
                    <a href="mailto:support@ownerfi.ai" className="text-white hover:text-[#00BC7D] transition-colors">
                      support@ownerfi.ai
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Response Time</p>
                    <p className="text-white">Within 24 hours</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-[#00BC7D]/10 to-blue-500/10 border border-[#00BC7D]/30 rounded-xl p-6">
              <h4 className="text-lg font-bold text-white mb-3">Looking for Properties?</h4>
              <p className="text-slate-300 text-sm mb-4">
                Skip the contact form and start browsing owner-financed homes right now.
              </p>
              <Link
                href="/auth"
                className="inline-block bg-[#00BC7D]/50 hover:bg-[#00BC7D] text-white px-6 py-2 rounded-lg font-semibold transition-colors"
              >
                Browse Homes
              </Link>
            </div>

            <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6">
              <h4 className="text-lg font-bold text-white mb-3">Are You a Realtor?</h4>
              <p className="text-slate-300 text-sm mb-4">
                Partner with us to access pre-screened buyers looking for owner-financed properties.
              </p>
              <Link
                href="/auth"
                className="text-[#00BC7D] hover:text-[#00d68f] font-medium"
              >
                Learn about partnerships
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-slate-800/30 border-t border-slate-700/50 py-8">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="flex justify-center gap-8 text-sm mb-4">
            <Link href="/" className="text-slate-400 hover:text-[#00BC7D] transition-colors">
              Home
            </Link>
            <Link href="/about" className="text-slate-400 hover:text-[#00BC7D] transition-colors">
              About
            </Link>
            <Link href="/terms" className="text-slate-400 hover:text-[#00BC7D] transition-colors">
              Terms
            </Link>
            <Link href="/privacy" className="text-slate-400 hover:text-[#00BC7D] transition-colors">
              Privacy
            </Link>
          </div>
          <p className="text-xs text-slate-500">
            &copy; 2025 Ownerfi. Empowering homeownership through innovative financing solutions.
          </p>
        </div>
      </footer>
    </div>
  );
}
