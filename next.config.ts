import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Redirect old /shared URLs to new SEO-friendly /property URLs
  async redirects() {
    return [
      {
        source: '/shared/:propertyId',
        destination: '/property/:propertyId',
        permanent: true, // 301 redirect for SEO
      },
    ];
  },
  images: {
    remotePatterns: [
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
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**.googleusercontent.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'maps.googleapis.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  turbopack: {
    resolveAlias: {
      "@": path.resolve("./src"),
    },
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": path.resolve("./src"),
    };
    return config;
  },
};

export default nextConfig;
