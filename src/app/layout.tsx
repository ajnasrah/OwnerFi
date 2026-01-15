import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { Providers } from './providers';
import AnalyticsScripts from '@/components/analytics/AnalyticsScripts';
import AnalyticsProvider from '@/components/analytics/AnalyticsProvider';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: 'swap',
});

// TEMP: Force all pages to be dynamic to fix useSearchParams build errors
export const dynamic = 'force-dynamic';
export const dynamicParams = true;
export const revalidate = 0;

export const metadata: Metadata = {
  title: "OwnerFi - Owner Financed Properties | No Bank Financing Needed",
  description: "Find owner financed homes in Texas, Florida, and Georgia. Skip the bank, buy directly from owners with flexible financing. Low down payments, no credit checks required.",
  keywords: "owner financing, owner financed homes, seller financing, no bank financing, buy house without bank, owner finance texas, owner finance florida, owner finance georgia, creative financing, rent to own homes",
  authors: [{ name: "OwnerFi" }],
  creator: "OwnerFi",
  publisher: "OwnerFi",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://ownerfi.ai',
    siteName: 'OwnerFi',
    title: 'OwnerFi - Owner Financed Properties | No Bank Financing Needed',
    description: 'Find owner financed homes in Texas, Florida, and Georgia. Skip the bank with flexible seller financing options.',
    images: [
      {
        url: 'https://ownerfi.ai/og-image.png',
        width: 1200,
        height: 630,
        alt: 'OwnerFi - Owner Financed Properties',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OwnerFi - Owner Financed Properties',
    description: 'Find owner financed homes with flexible financing. No bank needed.',
    images: ['https://ownerfi.ai/og-image.png'],
  },
  alternates: {
    canonical: 'https://ownerfi.ai',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "OwnerFi"
  },
  other: {
    'mobile-web-app-capable': 'yes'
  },
  formatDetection: {
    telephone: false,
    date: false,
    address: false,
    email: false,
    url: false
  }
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1.0,
  maximumScale: 1.0, // Prevent zoom for fixed layout
  userScalable: false, // Prevent user zoom for app-like experience
  themeColor: '#2563EB',
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content' // Handle mobile keyboards properly
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full" data-scroll-behavior="smooth">
      <head>
        {/* Performance: Preconnect to external domains */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://maps.googleapis.com" />
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        <link rel="dns-prefetch" href="https://maps.googleapis.com" />

        {/* Google Analytics 4 - Direct injection for reliability */}
        {process.env.NEXT_PUBLIC_GA4_ID && (
          <>
            <script
              async
              src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA4_ID}`}
            />
            <script
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${process.env.NEXT_PUBLIC_GA4_ID}', {
                    page_path: window.location.pathname,
                    send_page_view: true
                  });
                `
              }}
            />
          </>
        )}
      </head>
      <body
        className={`${inter.variable} antialiased bg-slate-900 h-full`}
      >
        <AnalyticsScripts
          ga4Id={process.env.NEXT_PUBLIC_GA4_ID}
        />
        <Providers>
          <AnalyticsProvider>
            <Suspense fallback={<div>Loading...</div>}>
              {children}
            </Suspense>
          </AnalyticsProvider>
        </Providers>
        {process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                // Google Maps initialization with proper error handling
                window.googleMapsState = {
                  loaded: false,
                  error: false,
                  loading: false
                };

                window.initGoogleMaps = function() {
                  try {
                    window.googleMapsState.loaded = true;
                    window.googleMapsState.loading = false;
                    window.googleMapsState.error = false;
                    window.dispatchEvent(new Event('googleMapsReady'));
                  } catch (error) {
                    // Google Maps failed to initialize
                    window.googleMapsState.error = true;
                    window.googleMapsState.loading = false;
                    window.dispatchEvent(new Event('googleMapsError'));
                  }
                };

                // Load Google Maps script dynamically with proper error handling
                function loadGoogleMaps() {
                  if (window.googleMapsState.loading || window.googleMapsState.loaded) return;

                  window.googleMapsState.loading = true;

                  const script = document.createElement('script');
                  script.src = 'https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places&loading=async&callback=initGoogleMaps';
                  script.async = true;
                  script.defer = true;
                  script.onerror = function() {
                    window.googleMapsState.error = true;
                    window.googleMapsState.loading = false;
                    window.dispatchEvent(new Event('googleMapsError'));
                  };

                  document.head.appendChild(script);
                }

                // Load when DOM is ready
                if (document.readyState === 'loading') {
                  document.addEventListener('DOMContentLoaded', loadGoogleMaps);
                } else {
                  loadGoogleMaps();
                }
              `
            }}
          />
        )}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
