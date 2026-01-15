'use client';

import { useEffect, useRef, useCallback } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

// Analytics event types
export type AnalyticsEvent =
  | 'video_play'
  | 'video_progress_25'
  | 'video_progress_50'
  | 'video_progress_95'
  | 'swipe_first'
  | 'match_click'
  | 'lead_submit'
  | 'calc_used'
  | 'cta_click'
  | 'page_view'
  // Scroll tracking
  | 'scroll_25'
  | 'scroll_50'
  | 'scroll_75'
  | 'scroll_90'
  // Auth tracking
  | 'auth_otp_sent'
  | 'auth_otp_verified'
  | 'auth_login'
  | 'auth_signup'
  | 'auth_logout'
  // Form tracking
  | 'form_start'
  | 'form_submit'
  | 'form_success'
  | 'form_error'
  // Property engagement tracking
  | 'property_view'
  | 'property_like'
  | 'property_unlike'
  | 'property_pass'
  | 'property_share'
  | 'property_details_click'
  // Search & filter tracking
  | 'filter_applied'
  | 'location_changed'
  // Tutorial tracking
  | 'tutorial_start'
  | 'tutorial_complete'
  | 'tutorial_skip'
  // Session engagement
  | 'session_properties_viewed';

interface EventData {
  [key: string]: string | number | boolean;
}

// GTM/GA4 tracking
export function trackEvent(event: AnalyticsEvent, data?: EventData) {
  // Google Analytics 4 via dataLayer
  if (typeof window !== 'undefined' && (window as { dataLayer?: Array<Record<string, unknown>> }).dataLayer) {
    (window as { dataLayer: Array<Record<string, unknown>> }).dataLayer.push({
      event: event,
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  // Meta Pixel - use 'track' for standard events, 'trackCustom' for custom
  if (typeof window !== 'undefined' && (window as { fbq?: (action: string, eventName: string, data?: EventData) => void }).fbq) {
    const fbq = (window as { fbq: (action: string, eventName: string, data?: EventData) => void }).fbq;
    // Map our events to Meta standard events where applicable
    if (event === 'lead_submit' || event === 'form_success') {
      fbq('track', 'Lead', data);
    } else if (event === 'auth_signup') {
      fbq('track', 'CompleteRegistration', data);
    } else {
      fbq('trackCustom', event, data);
    }
  }

  // TikTok Pixel - map to TikTok standard events where applicable
  if (typeof window !== 'undefined' && (window as { ttq?: { track: (action: string, data?: EventData) => void } }).ttq) {
    const ttq = (window as { ttq: { track: (action: string, data?: EventData) => void } }).ttq;
    // Map our events to TikTok standard events where applicable
    if (event === 'lead_submit' || event === 'form_success') {
      ttq.track('SubmitForm', data);
    } else if (event === 'auth_signup') {
      ttq.track('CompleteRegistration', data);
    } else if (event === 'page_view') {
      ttq.track('ViewContent', data);
    } else {
      ttq.track(event, data);
    }
  }

  // Only log in development
  if (process.env.NODE_ENV === 'development') {
    console.log('Analytics Event:', event, data);
  }
}

// UTM parameter capture
export function captureUTMParams() {
  if (typeof window === 'undefined') return {};

  const params = new URLSearchParams(window.location.search);
  return {
    utm_source: params.get('utm_source') || '',
    utm_medium: params.get('utm_medium') || '',
    utm_campaign: params.get('utm_campaign') || '',
    utm_term: params.get('utm_term') || '',
    utm_content: params.get('utm_content') || '',
  };
}

// Store UTM params in localStorage for form submission
export function storeUTMParams() {
  const utmParams = captureUTMParams();
  if (Object.values(utmParams).some(v => v)) {
    localStorage.setItem('ownerfi_utm_params', JSON.stringify(utmParams));
  }
}

// Get stored UTM params
export function getStoredUTMParams() {
  if (typeof window === 'undefined') return {};

  const stored = localStorage.getItem('ownerfi_utm_params');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return {};
    }
  }
  return {};
}

// Video tracking helper
export function setupVideoTracking(videoElement: HTMLVideoElement, videoId: string) {
  const milestones = {
    play: false,
    25: false,
    50: false,
    95: false,
  };

  const onTimeUpdate = () => {
    const progress = (videoElement.currentTime / videoElement.duration) * 100;

    if (progress >= 25 && !milestones[25]) {
      milestones[25] = true;
      trackEvent('video_progress_25', { video_id: videoId, progress: 25 });
    }
    if (progress >= 50 && !milestones[50]) {
      milestones[50] = true;
      trackEvent('video_progress_50', { video_id: videoId, progress: 50 });
    }
    if (progress >= 95 && !milestones[95]) {
      milestones[95] = true;
      trackEvent('video_progress_95', { video_id: videoId, progress: 95 });
    }
  };

  const onPlay = () => {
    // Only track first play, not resume after pause
    if (!milestones.play) {
      milestones.play = true;
      trackEvent('video_play', { video_id: videoId });
    }
  };

  videoElement.addEventListener('timeupdate', onTimeUpdate);
  videoElement.addEventListener('play', onPlay);

  return () => {
    videoElement.removeEventListener('timeupdate', onTimeUpdate);
    videoElement.removeEventListener('play', onPlay);
  };
}

// Scroll depth tracking helper
export function setupScrollTracking(pageId?: string) {
  if (typeof window === 'undefined') return () => {};

  const milestones = { 25: false, 50: false, 75: false, 90: false };
  let ticking = false;

  const checkScrollDepth = () => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;

    if (docHeight <= 0) return;

    const scrollPercent = (scrollTop / docHeight) * 100;
    const data = pageId ? { page_id: pageId } : {};

    if (scrollPercent >= 25 && !milestones[25]) {
      milestones[25] = true;
      trackEvent('scroll_25', { ...data, depth: 25 });
    }
    if (scrollPercent >= 50 && !milestones[50]) {
      milestones[50] = true;
      trackEvent('scroll_50', { ...data, depth: 50 });
    }
    if (scrollPercent >= 75 && !milestones[75]) {
      milestones[75] = true;
      trackEvent('scroll_75', { ...data, depth: 75 });
    }
    if (scrollPercent >= 90 && !milestones[90]) {
      milestones[90] = true;
      trackEvent('scroll_90', { ...data, depth: 90 });
    }
  };

  const onScroll = () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        checkScrollDepth();
        ticking = false;
      });
      ticking = true;
    }
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  return () => window.removeEventListener('scroll', onScroll);
}

// Form tracking hook
export function useFormTracking(formId: string) {
  const hasStarted = useRef(false);

  const trackFormStart = useCallback(() => {
    if (!hasStarted.current) {
      hasStarted.current = true;
      trackEvent('form_start', { form_id: formId });
    }
  }, [formId]);

  const trackFormSubmit = useCallback(() => {
    trackEvent('form_submit', { form_id: formId });
  }, [formId]);

  const trackFormSuccess = useCallback((data?: EventData) => {
    // Include UTM params on success for attribution
    const utmParams = getStoredUTMParams();
    trackEvent('form_success', {
      form_id: formId,
      ...data,
      ...(utmParams.utm_source && { utm_source: utmParams.utm_source }),
      ...(utmParams.utm_medium && { utm_medium: utmParams.utm_medium }),
      ...(utmParams.utm_campaign && { utm_campaign: utmParams.utm_campaign }),
    });
  }, [formId]);

  const trackFormError = useCallback((error?: string) => {
    trackEvent('form_error', { form_id: formId, error: error || 'unknown' });
  }, [formId]);

  const resetFormTracking = useCallback(() => {
    hasStarted.current = false;
  }, []);

  return {
    trackFormStart,
    trackFormSubmit,
    trackFormSuccess,
    trackFormError,
    resetFormTracking,
  };
}

export default function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Track page views
  useEffect(() => {
    trackEvent('page_view', {
      page_path: pathname,
      page_search: searchParams?.toString() || '',
      page_title: typeof document !== 'undefined' ? document.title : '',
    });
  }, [pathname, searchParams]);

  // Capture and store UTM params on mount
  useEffect(() => {
    storeUTMParams();
  }, [searchParams]);

  // Set up global scroll depth tracking (resets on page change)
  useEffect(() => {
    const cleanup = setupScrollTracking(pathname);
    return cleanup;
  }, [pathname]);

  // Set up global click tracking for CTA buttons
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const button = target.closest('[data-event]');

      if (button) {
        const event = button.getAttribute('data-event') as AnalyticsEvent;
        const location = button.getAttribute('data-location');
        const label = button.getAttribute('data-label');

        trackEvent(event, {
          location: location || 'unknown',
          label: label || '',
          button_text: button.textContent?.trim() || '',
        });
      }
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  return <>{children}</>;
}
