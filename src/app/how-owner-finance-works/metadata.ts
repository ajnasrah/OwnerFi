import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'How Owner Financing Works | Complete Guide 2025 | OwnerFi',
  description: 'Learn how owner financing works, understand seller financing, contract for deed, and subject-to deals. Discover how to buy a home without bank financing. Complete guide with FAQs.',
  keywords: 'how owner financing works, seller financing guide, owner finance explained, no bank home buying, contract for deed, subject to real estate, lease to own, owner will carry, creative financing, owner financed homes guide, seller financing process, owner finance vs bank loan, balloon payment explained, interest rate owner financing',

  openGraph: {
    title: 'How Owner Financing Works - Complete Guide | OwnerFi',
    description: 'Comprehensive guide to owner financing. Learn seller financing, understand the process, risks, and benefits. Buy homes without traditional bank loans.',
    url: 'https://ownerfi.com/how-owner-finance-works',
    siteName: 'OwnerFi',
    type: 'article',
    images: [
      {
        url: 'https://ownerfi.com/og-owner-finance-guide.png',
        width: 1200,
        height: 630,
        alt: 'How Owner Financing Works Guide',
      }
    ],
    locale: 'en_US',
    publishedTime: '2024-01-01T00:00:00Z',
    modifiedTime: new Date().toISOString(),
    authors: ['OwnerFi'],
    tags: ['owner financing', 'seller financing', 'real estate', 'home buying', 'creative financing'],
  },

  twitter: {
    card: 'summary_large_image',
    title: 'How Owner Financing Works - Complete Guide',
    description: 'Learn everything about owner financing, seller financing, and buying homes without banks.',
    images: ['https://ownerfi.com/og-owner-finance-guide.png'],
  },

  alternates: {
    canonical: 'https://ownerfi.com/how-owner-finance-works',
  },

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

  authors: [{ name: 'OwnerFi', url: 'https://ownerfi.com' }],
  creator: 'OwnerFi',
  publisher: 'OwnerFi',

  category: 'Real Estate Education',

  other: {
    'article:section': 'Real Estate Education',
    'article:tag': 'Owner Financing, Seller Financing, Creative Financing',
    'og:updated_time': new Date().toISOString(),
  },
}