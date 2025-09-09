import type { Metadata } from "next";
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <head>
        <script
          src="https://maps.googleapis.com/maps/api/js?key=AIzaSyCelger3EPc8GzTOQq7-cv6tUeVh_XN9jE&libraries=places&callback=initMap"
          async
          defer
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              function initMap() {
                window.googleMapsLoaded = true;
                window.dispatchEvent(new Event('googleMapsLoaded'));
              }
            `
          }}
        />
      </head>
      <body
        className={`${inter.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
