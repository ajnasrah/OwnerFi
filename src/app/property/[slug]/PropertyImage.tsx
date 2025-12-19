'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

interface PropertyImageProps {
  src: string;
  alt: string;
  priority?: boolean;
  address?: string;
  city?: string;
  state?: string;
}

/**
 * Generate Google Street View URL for a property address
 */
function getStreetViewUrl(address: string, city: string, state: string): string {
  const fullAddress = `${address}, ${city}, ${state}`;
  const encoded = encodeURIComponent(fullAddress);
  // Using Google Maps Static Street View API
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  if (apiKey) {
    return `https://maps.googleapis.com/maps/api/streetview?size=1200x800&location=${encoded}&key=${apiKey}`;
  }
  return '/placeholder-house.jpg';
}

/**
 * Validate if a string is a valid URL or relative path
 */
function isValidImageUrl(url: string): boolean {
  if (!url || url.trim() === '') return false;
  if (url.startsWith('/')) return true;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export default function PropertyImage({
  src,
  alt,
  priority = false,
  address = '',
  city = '',
  state = ''
}: PropertyImageProps) {
  // Determine the best initial source
  const getInitialSrc = (): string => {
    if (isValidImageUrl(src)) return src;
    if (address && city && state) return getStreetViewUrl(address, city, state);
    return '/placeholder-house.jpg';
  };

  const [imageSrc, setImageSrc] = useState(() => getInitialSrc());
  const [errorCount, setErrorCount] = useState(0);

  // Reset state when src prop changes
  useEffect(() => {
    const newSrc = isValidImageUrl(src) ? src
      : (address && city && state) ? getStreetViewUrl(address, city, state)
      : '/placeholder-house.jpg';
    setImageSrc(newSrc);
    setErrorCount(0);
     
  }, [src, address, city, state]);

  const handleError = () => {
    if (errorCount === 0 && address && city && state) {
      // First error: try Google Street View
      setErrorCount(1);
      setImageSrc(getStreetViewUrl(address, city, state));
    } else if (errorCount <= 1) {
      // Second error or no address: use placeholder
      setErrorCount(2);
      setImageSrc('/placeholder-house.jpg');
    }
  };

  // Use unoptimized for ALL external images to avoid Next.js optimization issues
  const isExternal = imageSrc.startsWith('http');

  return (
    <Image
      src={imageSrc}
      alt={alt}
      fill
      className="object-cover"
      priority={priority}
      sizes="(max-width: 768px) 100vw, 66vw"
      onError={handleError}
      unoptimized={isExternal}
    />
  );
}
