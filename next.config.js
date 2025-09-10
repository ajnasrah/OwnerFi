/** @type {import('next').NextConfig} */
const nextConfig = {
  // Production optimizations
  swcMinify: true,
  compress: true,
  
  // Bundle optimization
  experimental: {
    optimizeCss: true,
    turbotrace: {
      logLevel: 'error'
    }
  },

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
            value: 'DENY'
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
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com https://maps.googleapis.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: https: blob:; connect-src 'self' https: wss:;"
          }
        ]
      }
    ];
  },

  // Webpack optimization
  webpack: (config, { dev, isServer }) => {
    // Production optimizations
    if (!dev && !isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          framework: {
            name: 'framework',
            test: /[\\/]node_modules[\\/](react|react-dom|next)[\\/]/,
            priority: 40,
            enforce: true,
          },
          vendor: {
            name: 'vendor',
            test: /[\\/]node_modules[\\/]/,
            priority: 30,
            minChunks: 1,
            maxSize: 244 * 1024, // 244kb
          }
        }
      };
    }

    return config;
  },

  // Environment variables that should be available client-side
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version,
  },

  // ESLint configuration for build process
  eslint: {
    // Don't block builds on lint issues - allow warnings and most errors through
    ignoreDuringBuilds: true
  }
};

module.exports = nextConfig;