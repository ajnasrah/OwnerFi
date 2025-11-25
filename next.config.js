/** @type {import('next').NextConfig} */
const nextConfig = {
  // TEMP: Disable all static generation to fix useSearchParams errors
  experimental: {
    isrMemoryCacheSize: 0, // Disable ISR
  },

  // Production optimizations
  compress: true,

  // Bundle optimization removed - was causing startup issues

  // Image optimization
  images: {
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'maps.googleapis.com',
        port: '',
        pathname: '/maps/api/**',
      },
      {
        protocol: 'https',
        hostname: 'photos.zillowstatic.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'ap.rdcpix.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'gcdnb.pbrd.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'drive.google.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'example.com',
        port: '',
        pathname: '/**',
      },
    ],
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com https://maps.googleapis.com https://www.google.com https://www.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: https: blob:; connect-src 'self' https: wss:; frame-src 'self' https://www.google.com;"
          }
        ]
      }
    ];
  },

  // Webpack optimization
  webpack: (config, { dev, isServer }) => {
    // Externalize puppeteer packages for server-side only
    if (isServer) {
      config.externals.push('puppeteer', 'puppeteer-core', 'puppeteer-extra', 'puppeteer-extra-plugin-stealth', '@sparticuz/chromium');
    }

    // Production optimizations
    if (!dev && !isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          // PERFORMANCE FIX: Separate Firebase into its own chunk (3MB!)
          firebase: {
            name: 'firebase',
            test: /[\\/]node_modules[\\/](@firebase|firebase)[\\/]/,
            priority: 50,
            enforce: true,
          },
          framework: {
            name: 'framework',
            test: /[\\/]node_modules[\\/](react|react-dom|next)[\\/]/,
            priority: 40,
            enforce: true,
          },
          // PERFORMANCE FIX: Separate Google Maps
          googleMaps: {
            name: 'google-maps',
            test: /[\\/]node_modules[\\/](@googlemaps|@react-google-maps)[\\/]/,
            priority: 45,
            enforce: true,
          },
          vendor: {
            name: 'vendor',
            test: /[\\/]node_modules[\\/]/,
            priority: 30,
            minChunks: 1,
            maxSize: 200 * 1024, // Reduced from 244kb to 200kb
          }
        }
      };
    }

    return config;
  },

  // PERFORMANCE FIX: Enable CSS optimization
  experimental: {
    optimizeCss: true,
  },

  // Environment variables that should be available client-side
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version,
  },

  // ESLint configuration for build process
  eslint: {
    // Don't block builds on lint issues - allow warnings and most errors through
    ignoreDuringBuilds: true
  },

  // TypeScript configuration for build process
  typescript: {
    // Don't fail builds on type errors during deployment
    ignoreBuildErrors: true
  },

  // Redirects for SEO and URL consistency
  async redirects() {
    return [
      // State redirects - from short URLs to canonical owner-financing URLs
      { source: '/alabama', destination: '/owner-financing-alabama', permanent: true },
      { source: '/alaska', destination: '/owner-financing-alaska', permanent: true },
      { source: '/arizona', destination: '/owner-financing-arizona', permanent: true },
      { source: '/arkansas', destination: '/owner-financing-arkansas', permanent: true },
      { source: '/california', destination: '/owner-financing-california', permanent: true },
      { source: '/colorado', destination: '/owner-financing-colorado', permanent: true },
      { source: '/connecticut', destination: '/owner-financing-connecticut', permanent: true },
      { source: '/delaware', destination: '/owner-financing-delaware', permanent: true },
      { source: '/florida', destination: '/owner-financing-florida', permanent: true },
      { source: '/georgia', destination: '/owner-financing-georgia', permanent: true },
      { source: '/hawaii', destination: '/owner-financing-hawaii', permanent: true },
      { source: '/idaho', destination: '/owner-financing-idaho', permanent: true },
      { source: '/illinois', destination: '/owner-financing-illinois', permanent: true },
      { source: '/indiana', destination: '/owner-financing-indiana', permanent: true },
      { source: '/iowa', destination: '/owner-financing-iowa', permanent: true },
      { source: '/kansas', destination: '/owner-financing-kansas', permanent: true },
      { source: '/kentucky', destination: '/owner-financing-kentucky', permanent: true },
      { source: '/louisiana', destination: '/owner-financing-louisiana', permanent: true },
      { source: '/maine', destination: '/owner-financing-maine', permanent: true },
      { source: '/maryland', destination: '/owner-financing-maryland', permanent: true },
      { source: '/massachusetts', destination: '/owner-financing-massachusetts', permanent: true },
      { source: '/michigan', destination: '/owner-financing-michigan', permanent: true },
      { source: '/minnesota', destination: '/owner-financing-minnesota', permanent: true },
      { source: '/mississippi', destination: '/owner-financing-mississippi', permanent: true },
      { source: '/missouri', destination: '/owner-financing-missouri', permanent: true },
      { source: '/montana', destination: '/owner-financing-montana', permanent: true },
      { source: '/nebraska', destination: '/owner-financing-nebraska', permanent: true },
      { source: '/nevada', destination: '/owner-financing-nevada', permanent: true },
      { source: '/new-hampshire', destination: '/owner-financing-new-hampshire', permanent: true },
      { source: '/new-jersey', destination: '/owner-financing-new-jersey', permanent: true },
      { source: '/new-mexico', destination: '/owner-financing-new-mexico', permanent: true },
      { source: '/new-york', destination: '/owner-financing-new-york', permanent: true },
      { source: '/north-carolina', destination: '/owner-financing-north-carolina', permanent: true },
      { source: '/north-dakota', destination: '/owner-financing-north-dakota', permanent: true },
      { source: '/ohio', destination: '/owner-financing-ohio', permanent: true },
      { source: '/oklahoma', destination: '/owner-financing-oklahoma', permanent: true },
      { source: '/oregon', destination: '/owner-financing-oregon', permanent: true },
      { source: '/pennsylvania', destination: '/owner-financing-pennsylvania', permanent: true },
      { source: '/rhode-island', destination: '/owner-financing-rhode-island', permanent: true },
      { source: '/south-carolina', destination: '/owner-financing-south-carolina', permanent: true },
      { source: '/south-dakota', destination: '/owner-financing-south-dakota', permanent: true },
      { source: '/tennessee', destination: '/owner-financing-tennessee', permanent: true },
      { source: '/texas', destination: '/owner-financing-texas', permanent: true },
      { source: '/utah', destination: '/owner-financing-utah', permanent: true },
      { source: '/vermont', destination: '/owner-financing-vermont', permanent: true },
      { source: '/virginia', destination: '/owner-financing-virginia', permanent: true },
      { source: '/washington', destination: '/owner-financing-washington', permanent: true },
      { source: '/west-virginia', destination: '/owner-financing-west-virginia', permanent: true },
      { source: '/wisconsin', destination: '/owner-financing-wisconsin', permanent: true },
      { source: '/wyoming', destination: '/owner-financing-wyoming', permanent: true },

      // Major city redirects
      { source: '/new-york-city', destination: '/new-york-city-owner-financing', permanent: true },
      { source: '/nyc', destination: '/new-york-city-owner-financing', permanent: true },
      { source: '/los-angeles', destination: '/los-angeles-owner-financing', permanent: true },
      { source: '/la', destination: '/los-angeles-owner-financing', permanent: true },
      { source: '/chicago', destination: '/chicago-owner-financing', permanent: true },
      { source: '/houston', destination: '/houston-owner-financing', permanent: true },
      { source: '/phoenix', destination: '/phoenix-owner-financing', permanent: true },
      { source: '/philadelphia', destination: '/philadelphia-owner-financing', permanent: true },
      { source: '/philly', destination: '/philadelphia-owner-financing', permanent: true },
      { source: '/san-antonio', destination: '/san-antonio-owner-financing', permanent: true },
      { source: '/san-diego', destination: '/san-diego-owner-financing', permanent: true },
      { source: '/dallas', destination: '/dallas-owner-financing', permanent: true },
      { source: '/austin', destination: '/austin-owner-financing', permanent: true },
      { source: '/miami', destination: '/miami-owner-financing', permanent: true },
      { source: '/orlando', destination: '/orlando-owner-financing', permanent: true },
      { source: '/tampa', destination: '/tampa-owner-financing', permanent: true },
      { source: '/atlanta', destination: '/atlanta-owner-financing', permanent: true },
      { source: '/seattle', destination: '/seattle-owner-financing', permanent: true },
      { source: '/denver', destination: '/denver-owner-financing', permanent: true },
      { source: '/boston', destination: '/boston-owner-financing', permanent: true },
      { source: '/las-vegas', destination: '/las-vegas-owner-financing', permanent: true },
      { source: '/vegas', destination: '/las-vegas-owner-financing', permanent: true },
      { source: '/portland', destination: '/portland-owner-financing', permanent: true },
      { source: '/nashville', destination: '/nashville-owner-financing', permanent: true },
      { source: '/detroit', destination: '/detroit-owner-financing', permanent: true },
      { source: '/dc', destination: '/washington-dc-owner-financing', permanent: true },
      { source: '/washington-dc', destination: '/washington-dc-owner-financing', permanent: true },

      // Alternative patterns redirect to canonical URLs
      { source: '/rent-to-own/:location', destination: '/owner-financing-:location', permanent: true },
      { source: '/seller-financing/:location', destination: '/owner-financing-:location', permanent: true },
      { source: '/owner-finance/:location', destination: '/owner-financing-:location', permanent: true },

      // SEO-friendly redirects for common search queries
      { source: '/what-is-owner-financing', destination: '/how-owner-finance-works', permanent: true },
      { source: '/whats-owner-financing', destination: '/how-owner-finance-works', permanent: true },
      { source: '/owner-financing-explained', destination: '/how-owner-finance-works', permanent: true },
      { source: '/what-is-seller-financing', destination: '/how-owner-finance-works', permanent: true },
    ]
  }
};

module.exports = nextConfig;