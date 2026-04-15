'use client';

/**
 * Cookie consent banner.
 *
 * Gates marketing/analytics pixels (GA4, Meta, TikTok) behind explicit consent
 * so the site is compliant under CCPA/CPRA "sale/share" rules (which treat
 * pixel data transmission to ad networks as a share) and EU GDPR.
 *
 * Also respects the GPC (Global Privacy Control) signal — if a browser signals
 * opt-out via `navigator.globalPrivacyControl`, we treat that as implicit
 * rejection and never load pixels.
 *
 * Consent is persisted in localStorage under `ownerfi_cookie_consent` with
 * values `'accepted' | 'rejected'`. Other code (AnalyticsScripts) reads
 * `hasAnalyticsConsent()` before firing pixel loaders.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';

export const CONSENT_STORAGE_KEY = 'ownerfi_cookie_consent';

export type ConsentValue = 'accepted' | 'rejected';

export function hasAnalyticsConsent(): boolean {
  if (typeof window === 'undefined') return false;
  // GPC override: browser opt-out always wins, no matter what's in localStorage.
  const gpc = (navigator as unknown as { globalPrivacyControl?: boolean }).globalPrivacyControl;
  if (gpc === true) return false;
  try {
    return window.localStorage.getItem(CONSENT_STORAGE_KEY) === 'accepted';
  } catch {
    return false;
  }
}

export function setConsent(value: ConsentValue): void {
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, value);
    // Broadcast so AnalyticsScripts can react without a page reload.
    window.dispatchEvent(new CustomEvent('ownerfi:consent-changed', { detail: value }));
  } catch {
    /* fail-silent: user blocked storage */
  }
}

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // GPC signal = don't show the banner; user has already opted out at the
    // browser level, and showing a banner asking for consent would be
    // misleading.
    const gpc = (navigator as unknown as { globalPrivacyControl?: boolean }).globalPrivacyControl;
    if (gpc === true) {
      try {
        window.localStorage.setItem(CONSENT_STORAGE_KEY, 'rejected');
      } catch { /* ignore */ }
      return;
    }
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    } catch { /* ignore */ }
    if (stored !== 'accepted' && stored !== 'rejected') {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
      className="fixed bottom-0 left-0 right-0 z-[9999] bg-slate-900/95 backdrop-blur-md border-t border-slate-700 px-4 py-4 shadow-2xl"
    >
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-start md:items-center gap-4">
        <div className="flex-1 text-sm text-slate-200">
          <p>
            We use cookies and similar technologies (including Google Analytics, Meta, and TikTok pixels) to understand how visitors use the site and to measure ad performance. You can accept to enable these, or reject and continue with essential cookies only. See our{' '}
            <Link href="/privacy" className="text-[#00BC7D] underline hover:text-[#00d68f]">Privacy Policy</Link>{' '}
            or{' '}
            <Link href="/do-not-sell" className="text-[#00BC7D] underline hover:text-[#00d68f]">Do Not Sell/Share</Link> opt-out form.
          </p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button
            onClick={() => { setConsent('rejected'); setVisible(false); }}
            className="flex-1 md:flex-none px-4 py-2 text-sm font-semibold text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
          >
            Reject
          </button>
          <button
            onClick={() => { setConsent('accepted'); setVisible(false); }}
            className="flex-1 md:flex-none px-4 py-2 text-sm font-semibold text-white bg-[#00BC7D] hover:bg-[#00d68f] rounded-lg transition-colors"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
