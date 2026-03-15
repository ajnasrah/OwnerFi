'use client';

import Image from 'next/image';
import { useState, useCallback, useRef, useEffect } from 'react';
import type { InvestorDeal } from '@/app/api/buyer/investor-deals/route';
import { OWNER_FINANCE_BADGE, CASH_DEAL_BADGE } from '@/lib/deal-badge';

interface InvestorPropertyCardProps {
  deal: InvestorDeal;
  isLiked: boolean;
  onToggleLike: () => void;
  onHide?: () => void;
  isPriority?: boolean;
}

export function InvestorPropertyCard({ deal, isLiked, onToggleLike, onHide, isPriority = false }: InvestorPropertyCardProps) {
  const [imageError, setImageError] = useState<Set<number>>(new Set());
  const [imageLoading, setImageLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hiding, setHiding] = useState(false);
  const [copied, setCopied] = useState(false);

  // Build gallery: use galleryImages if available, otherwise fall back to primary
  const images = (deal.galleryImages && deal.galleryImages.length > 0)
    ? deal.galleryImages
    : deal.imgSrc ? [deal.imgSrc] : [];
  const hasMultiple = images.length > 1;
  const currentImage = images[currentIndex] || '/placeholder-house.jpg';
  const isCurrentError = imageError.has(currentIndex);

  // Touch swipe state
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchStartTime = useRef(0);
  const isSwiping = useRef(false);
  const recentlySwipedRef = useRef(false);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const imagesLengthRef = useRef(images.length);
  imagesLengthRef.current = images.length;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (imagesLengthRef.current < 2) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchStartTime.current = Date.now();
    isSwiping.current = false;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (imagesLengthRef.current < 2 || !isSwiping.current) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const absDx = Math.abs(dx);
    const elapsed = Date.now() - touchStartTime.current;

    if (absDx < 30) return; // Too small to count as a swipe

    // Velocity = pixels per millisecond
    const velocity = absDx / Math.max(elapsed, 1);
    // Fast swipe (>0.8 px/ms) skips more images: 1 base + extra per velocity tier
    let skip = 1;
    if (velocity > 2.0) skip = 5;
    else if (velocity > 1.5) skip = 4;
    else if (velocity > 1.0) skip = 3;
    else if (velocity > 0.8) skip = 2;

    // Block the Zillow link click that follows touchEnd
    recentlySwipedRef.current = true;
    setTimeout(() => { recentlySwipedRef.current = false; }, 300);

    const len = imagesLengthRef.current;
    if (dx < 0) {
      // Swipe left → next images
      setCurrentIndex(i => Math.min(i + skip, len - 1));
    } else {
      // Swipe right → previous images
      setCurrentIndex(i => Math.max(i - skip, 0));
    }
    setImageLoading(true);
    isSwiping.current = false;
  }, []);

  // Non-passive touchmove listener so we can preventDefault to block page scroll during swipe
  useEffect(() => {
    const node = imageContainerRef.current;
    if (!node) return;
    const onTouchMove = (e: TouchEvent) => {
      if (imagesLengthRef.current < 2) return;
      const dx = Math.abs(e.touches[0].clientX - touchStartX.current);
      const dy = Math.abs(e.touches[0].clientY - touchStartY.current);
      if (dx > 10 && dx > dy) {
        isSwiping.current = true;
        e.preventDefault();
      }
    };
    node.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => node.removeEventListener('touchmove', onTouchMove);
  }, []);

  const goTo = useCallback((index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex(index);
    setImageLoading(true);
  }, []);

  const goPrev = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (images.length < 2) return;
    setCurrentIndex(i => (i <= 0 ? images.length - 1 : i - 1));
    setImageLoading(true);
  }, [images.length]);

  const goNext = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (images.length < 2) return;
    setCurrentIndex(i => (i >= images.length - 1 ? 0 : i + 1));
    setImageLoading(true);
  }, [images.length]);

  // Build the details URL — prefer Zillow search by address (always works, even for sold/delisted properties)
  // Direct Zillow URLs (/homedetails/ZPID_zpid/) break when listings are removed
  const zillowSearchUrl = `https://www.zillow.com/homes/${encodeURIComponent(`${deal.address}, ${deal.city}, ${deal.state}`.trim())}_rb/`;
  const detailsUrl = zillowSearchUrl;

  // Explicit click handler for More Info — belt-and-suspenders approach
  const handleMoreInfoClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    // Let the native <a> tag handle it first, but if something blocks it,
    // force open via window.open
    try {
      const win = window.open(detailsUrl, '_blank', 'noopener,noreferrer');
      if (win) {
        // window.open succeeded, prevent the <a> from also navigating
        e.preventDefault();
      }
      // If window.open returns null (blocked by popup blocker), let the <a> tag handle it naturally
    } catch {
      // If window.open throws, let the <a> tag handle it naturally
    }
  }, [detailsUrl]);

  // Hide handler with visual feedback
  const handleHide = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (hiding || !onHide) return;
    setHiding(true);
    onHide();
  }, [hiding, onHide]);

  return (
    <article className={`bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden hover:border-slate-600/70 transition-all duration-200 hover:shadow-lg hover:shadow-black/20 group ${hiding ? 'opacity-50 scale-95 pointer-events-none' : ''}`}>
      {/* Image Section with Gallery — tappable to open Zillow, swipeable */}
      <div
        ref={imageContainerRef}
        className="relative aspect-[4/3] bg-slate-700"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <a
          href={detailsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute inset-0 z-[1] cursor-pointer"
          aria-label="View all photos on Zillow"
          onClick={(e) => { if (recentlySwipedRef.current) e.preventDefault(); }}
        />
        {!isCurrentError ? (
          <Image
            src={currentImage}
            alt={deal.address || 'Property image'}
            fill
            className={`object-cover transition-opacity duration-300 ${imageLoading ? 'opacity-0' : 'opacity-100'}`}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            quality={75}
            priority={isPriority && currentIndex === 0}
            loading={isPriority && currentIndex === 0 ? 'eager' : 'lazy'}
            onLoad={() => setImageLoading(false)}
            onError={() => { setImageError(prev => new Set(prev).add(currentIndex)); setImageLoading(false); }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-700">
            <span className="text-4xl">🏠</span>
          </div>
        )}

        {/* Loading skeleton */}
        {imageLoading && !isCurrentError && (
          <div className="absolute inset-0 bg-slate-700 animate-pulse" />
        )}

        {/* Gallery navigation arrows — 44px touch targets */}
        {hasMultiple && (
          <>
            <button
              onClick={goPrev}
              aria-label="Previous image"
              className="absolute left-1 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 active:scale-90 transition-all z-10"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={goNext}
              aria-label="Next image"
              className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 active:scale-90 transition-all z-10"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}

        {/* Dot indicators */}
        {hasMultiple && (
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-1 z-10">
            {images.length <= 7 ? (
              images.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => goTo(i, e)}
                  aria-label={`Go to image ${i + 1}`}
                  className={`rounded-full transition-all ${i === currentIndex ? 'w-2 h-2 bg-white' : 'w-1.5 h-1.5 bg-white/50 hover:bg-white/80'}`}
                />
              ))
            ) : (
              <span className="text-[10px] font-semibold text-white bg-black/50 px-2 py-0.5 rounded-full backdrop-blur-sm">
                {currentIndex + 1} / {images.length}
              </span>
            )}
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

        {/* Deal type badge - top left */}
        <div className="absolute top-2.5 left-2.5 z-10 flex flex-wrap gap-1.5">
          {deal.dealType === 'owner_finance' ? (
            <span className={`px-2.5 py-1 text-xs font-bold ${OWNER_FINANCE_BADGE.bg}/90 ${OWNER_FINANCE_BADGE.textColor} rounded-lg backdrop-blur-sm`}>
              {OWNER_FINANCE_BADGE.text}
            </span>
          ) : (
            <span className={`px-2.5 py-1 text-xs font-bold ${CASH_DEAL_BADGE.bg}/90 ${CASH_DEAL_BADGE.textColor} rounded-lg backdrop-blur-sm`}>
              {CASH_DEAL_BADGE.text}
              {deal.percentOfArv != null && ` · ${deal.percentOfArv}%`}
            </span>
          )}
          {/* Show secondary badge when property qualifies for both deal types */}
          {deal.qualifiesForBoth && (
            deal.dealType === 'owner_finance' ? (
              <span className={`px-2 py-1 text-[10px] font-bold ${CASH_DEAL_BADGE.bg}/70 ${CASH_DEAL_BADGE.textColor} rounded-lg backdrop-blur-sm`}>
                + Cash {deal.percentOfArv != null && `${deal.percentOfArv}%`}
              </span>
            ) : (
              <span className={`px-2 py-1 text-[10px] font-bold ${OWNER_FINANCE_BADGE.bg}/70 ${OWNER_FINANCE_BADGE.textColor} rounded-lg backdrop-blur-sm`}>
                + Owner Fin
              </span>
            )
          )}
          {deal.needsWork && (
            <span className="px-2 py-1 text-xs font-bold bg-red-600/90 text-white rounded-lg backdrop-blur-sm">
              Fixer
            </span>
          )}
        </div>

        {/* Top right: Hide + Like buttons — 44px min touch targets for driving safety */}
        <div className="absolute top-2 right-2 flex items-center gap-2 z-10">
          {onHide && (
            <button
              onClick={handleHide}
              aria-label="Hide property"
              className="w-11 h-11 flex items-center justify-center rounded-full bg-black/50 backdrop-blur-sm hover:bg-red-600/80 transition-all active:scale-90"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onToggleLike(); }}
            aria-label={isLiked ? 'Unlike property' : 'Like property'}
            className="w-11 h-11 flex items-center justify-center rounded-full bg-black/50 backdrop-blur-sm hover:bg-black/60 transition-all active:scale-90"
          >
            {isLiked ? (
              <svg className="w-6 h-6 text-red-500 fill-current" viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            )}
          </button>
        </div>

        {/* Photo count badge - bottom right */}
        {images.length > 1 && (
          <div className="absolute bottom-2.5 right-2.5 z-10">
            <span className="flex items-center gap-1 text-[10px] font-semibold text-white bg-black/50 px-2 py-0.5 rounded-full backdrop-blur-sm">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {images.length}
            </span>
          </div>
        )}

        {/* Price overlay - bottom of image */}
        <div className="absolute bottom-2.5 left-2.5 z-10">
          <div className="text-3xl sm:text-2xl font-black text-white drop-shadow-lg">
            ${(deal.price || 0).toLocaleString()}
          </div>
          {/* Key metric right under price for at-a-glance driving */}
          {deal.dealType === 'owner_finance' && deal.monthlyPayment != null && (
            <div className="text-sm font-bold text-emerald-400 drop-shadow-lg">
              ${deal.monthlyPayment.toLocaleString()}/mo
            </div>
          )}
          {deal.dealType === 'cash_deal' && deal.percentOfArv != null && (
            <div className={`text-sm font-bold drop-shadow-lg ${deal.percentOfArv <= 70 ? 'text-green-400' : deal.percentOfArv <= 85 ? 'text-amber-400' : 'text-orange-400'}`}>
              {deal.percentOfArv}% of Zestimate
            </div>
          )}
        </div>
      </div>

      {/* Info Section */}
      <div className="p-3.5">
        {/* Address */}
        <div className="min-w-0 flex items-start gap-1.5">
          <div className="min-w-0 flex-1">
            <h3 className="text-base sm:text-sm font-bold text-white truncate">{deal.address}</h3>
            <p className="text-sm sm:text-xs text-slate-400 mt-0.5">{deal.city}, {deal.state} {deal.zipCode}</p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              const fullAddress = `${deal.address}, ${deal.city}, ${deal.state} ${deal.zipCode}`;
              navigator.clipboard.writeText(fullAddress);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="flex-shrink-0 mt-0.5 p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
            title="Copy full address"
          >
            {copied ? (
              <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>
        </div>

        {/* Specs row */}
        <div className="flex items-center gap-3 mt-2.5 text-sm sm:text-xs text-slate-300">
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            {deal.beds} bd
          </span>
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4" />
            </svg>
            {deal.baths} ba
          </span>
          {deal.sqft > 0 && (
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
              {deal.sqft.toLocaleString()} sf
            </span>
          )}
          {deal.yearBuilt && deal.yearBuilt > 0 && (
            <span className="text-slate-500">Built {deal.yearBuilt}</span>
          )}
        </div>

        {/* Deal-specific info */}
        <div className="mt-2.5 pt-2.5 border-t border-slate-700/50">
          {deal.dealType === 'owner_finance' ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              {deal.monthlyPayment != null && (
                <span className="text-emerald-400 font-bold">${deal.monthlyPayment.toLocaleString()}/mo</span>
              )}
              {deal.downPaymentAmount != null && (
                <span className="text-slate-300">
                  ${(deal.downPaymentAmount / 1000).toFixed(0)}K down
                  {deal.downPaymentPercent != null ? ` (${deal.downPaymentPercent}%)` : ''}
                </span>
              )}
              {deal.interestRate != null && (
                <span className="text-slate-400">{deal.interestRate}% rate</span>
              )}
              {deal.termYears != null && (
                <span className="text-slate-400">{deal.termYears} yr</span>
              )}
              {deal.balloonYears != null && (
                <span className="text-amber-400 text-[10px] font-semibold">Balloon {deal.balloonYears}yr</span>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              {deal.percentOfArv != null && (
                <span className={`font-bold ${deal.percentOfArv <= 60 ? 'text-green-400' : deal.percentOfArv <= 70 ? 'text-emerald-400' : deal.percentOfArv <= 85 ? 'text-amber-400' : deal.percentOfArv <= 100 ? 'text-orange-400' : 'text-red-400'}`}>
                  {deal.percentOfArv}% of Zest
                </span>
              )}
              {deal.discount && deal.discount > 0 && (
                <span className="text-emerald-300">${(deal.discount / 1000).toFixed(0)}K below Zest</span>
              )}
              {deal.arv && (
                <span className="text-slate-400">Zest ${(deal.arv / 1000).toFixed(0)}K</span>
              )}
              {deal.rentEstimate && deal.rentEstimate > 0 && (
                <span className="text-blue-400">Rent ~${deal.rentEstimate.toLocaleString()}</span>
              )}
            </div>
          )}
        </div>

        {/* View Details link — 44px+ height for easy thumb tap */}
        <a
          href={detailsUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleMoreInfoClick}
          className="block w-full mt-3 px-3 py-3 bg-emerald-600/80 hover:bg-emerald-500/90 text-white text-sm font-bold rounded-xl transition-all text-center cursor-pointer select-none active:scale-[0.98]"
        >
          View on Zillow
          <svg className="w-3.5 h-3.5 ml-1.5 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>
    </article>
  );
}
