import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from './providers';

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: 'swap',
});


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
  maximumScale: 1.0,
  userScalable: false,
  themeColor: '#2563EB',
  viewportFit: 'cover'
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <head>
        {/* Performance optimizations */}
        <link rel="preconnect" href="https://ownerfi-default-rtdb.firebaseio.com" />
        <link rel="preconnect" href="https://firestore.googleapis.com" />
        <link rel="preconnect" href="https://maps.googleapis.com" />
        <link rel="dns-prefetch" href="//fonts.googleapis.com" />
        <link rel="dns-prefetch" href="//fonts.gstatic.com" />

        {/* PWA and mobile optimization */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />

        {/* Default OG image */}
        <meta property="og:image" content="https://ownerfi.ai/og-image.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="OwnerFi - Owner Financed Properties" />

        {/* Additional favicons */}
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="manifest" href="/manifest.json" />
        {process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? (
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
                  script.src = 'https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places&callback=initGoogleMaps';
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
        ) : (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                window.googleMapsState = { loaded: false, error: true, loading: false };
                // Google Maps API key not configured
                window.dispatchEvent(new Event('googleMapsError'));
              `
            }}
          />
        )}
      </head>
      <body
        className={`${inter.variable} antialiased bg-slate-900`}
      >
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
