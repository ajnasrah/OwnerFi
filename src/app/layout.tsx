import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from './providers';

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OwnerFi - Owner Financed Properties",
  description: "Find your dream home with owner financing in Texas, Florida, and Georgia",
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
  themeColor: '#2563EB'
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
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
                    console.error('Google Maps initialization failed:', error);
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
                console.warn('Google Maps API key not configured - Places autocomplete will not work');
                window.dispatchEvent(new Event('googleMapsError'));
              `
            }}
          />
        )}
      </head>
      <body
        className={`${inter.variable} ${geistMono.variable} antialiased bg-slate-900`}
      >
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
