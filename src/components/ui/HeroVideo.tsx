'use client';

import { useEffect, useRef, useState } from 'react';
import { setupVideoTracking } from '@/components/analytics/AnalyticsProvider';

export default function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    if (videoRef.current) {
      const cleanup = setupVideoTracking(videoRef.current, 'hero_demo');
      return cleanup;
    }
  }, []);

  return (
    <>
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
        poster="/hero-demo-poster.jpg"
        onError={() => setVideoError(true)}
        style={{ display: videoError ? 'none' : 'block' }}
      >
        <source src="/hero-demo.mp4" type="video/mp4" />
        <source src="/hero-demo.webm" type="video/webm" />
      </video>

      {/* Fallback Placeholder - Shows until video is added */}
      {videoError && (
        <div className="absolute inset-0 bg-slate-800">
          {/* Demo Property Image - Using Unsplash placeholder */}
          <img
            src="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&auto=format&fit=crop&q=80"
            alt="Modern home exterior"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/80" />

          {/* Property Card Preview */}
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
            <div className="flex gap-3 text-xs">
              <div className="flex items-center gap-1">
                <span>🛏️</span><span className="font-bold text-slate-900">3</span>
              </div>
              <div className="flex items-center gap-1">
                <span>🚿</span><span className="font-bold text-slate-900">2</span>
              </div>
              <div className="flex items-center gap-1">
                <span>📏</span><span className="font-bold text-slate-900">1,850 sq ft</span>
              </div>
            </div>
          </div>

          {/* Swipe Gesture Indicator */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <div className="flex gap-8 animate-pulse">
              <div className="w-16 h-16 bg-red-500/20 backdrop-blur-sm rounded-full flex items-center justify-center border-2 border-red-500">
                <span className="text-3xl">👎</span>
              </div>
              <div className="w-16 h-16 bg-green-500/20 backdrop-blur-sm rounded-full flex items-center justify-center border-2 border-green-500">
                <span className="text-3xl">👍</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
