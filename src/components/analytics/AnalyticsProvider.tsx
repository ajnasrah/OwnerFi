'use client';

import { useEffect } from 'react';
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
  | 'page_view';

interface EventData {
  [key: string]: string | number | boolean;
}

// GTM/GA4 tracking
export function trackEvent(event: AnalyticsEvent, data?: EventData) {
  // Google Analytics 4 via dataLayer
  if (typeof window !== 'undefined' && (window as any).dataLayer) {
    (window as any).dataLayer.push({
      event: event,
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  // Meta Pixel
  if (typeof window !== 'undefined' && (window as any).fbq) {
    const fbEvent = event === 'lead_submit' ? 'Lead' : 'trackCustom';
    (window as any).fbq(fbEvent, event, data);
  }

  // TikTok Pixel
  if (typeof window !== 'undefined' && (window as any).ttq) {
    const ttqEvent = event === 'lead_submit' ? 'SubmitForm' : 'track';
    (window as any).ttq.track(ttqEvent, data);
  }

  console.log('Analytics Event:', event, data);
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
    trackEvent('video_play', { video_id: videoId });
  };

  videoElement.addEventListener('timeupdate', onTimeUpdate);
  videoElement.addEventListener('play', onPlay);

  return () => {
    videoElement.removeEventListener('timeupdate', onTimeUpdate);
    videoElement.removeEventListener('play', onPlay);
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
    });
  }, [pathname, searchParams]);

  // Capture and store UTM params on mount
  useEffect(() => {
    storeUTMParams();
  }, [searchParams]);

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
