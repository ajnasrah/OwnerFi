'use client';

import { useEffect, useRef } from 'react';
import { setupVideoTracking } from '@/components/analytics/AnalyticsProvider';

export default function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      const cleanup = setupVideoTracking(videoRef.current, 'hero_demo');
      return cleanup;
    }
  }, []);

  return (
    <video
      ref={videoRef}
      autoPlay
      loop
      muted
      playsInline
      className="absolute inset-0 w-full h-full object-cover"
      poster="/hero-demo-poster.jpg"
    >
      <source src="/hero-demo.mp4" type="video/mp4" />
      <source src="/hero-demo.webm" type="video/webm" />
      {/* Fallback content */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-purple-500">
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white to-transparent p-6">
          <div className="mb-3">
            <div className="inline-block bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full mb-3">
              Owner Finance
            </div>
            <div className="text-2xl font-black text-slate-900 mb-1">$285,000</div>
            <div className="text-emerald-600 font-bold">$1,850/month</div>
          </div>
          <div className="text-sm font-semibold text-slate-900 mb-1">123 Main Street</div>
          <div className="text-xs text-slate-600 mb-3">Austin, TX 78701</div>
        </div>
      </div>
    </video>
  );
}
