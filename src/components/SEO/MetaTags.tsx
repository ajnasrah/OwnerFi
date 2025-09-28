import Head from 'next/head';

interface MetaTagsProps {
  title: string;
  description: string;
  keywords?: string;
  canonical?: string;
  ogImage?: string;
  ogType?: 'website' | 'article';
  twitterCard?: 'summary' | 'summary_large_image';
  noIndex?: boolean;
}

export function MetaTags({
  title,
  description,
  keywords,
  canonical,
  ogImage = 'https://ownerfi.ai/og-image.png',
  ogType = 'website',
  twitterCard = 'summary_large_image',
  noIndex = false
}: MetaTagsProps) {
  // Ensure title includes brand name
  const fullTitle = title.includes('OwnerFi') ? title : `${title} | OwnerFi`;

  // Truncate description to optimal length
  const truncatedDescription = description.length > 160
    ? description.substring(0, 157) + '...'
    : description;

  return (
    <Head>
      {/* Basic Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={truncatedDescription} />
      {keywords && <meta name="keywords" content={keywords} />}

      {/* Canonical URL */}
      {canonical && <link rel="canonical" href={canonical} />}

      {/* Robots */}
      <meta name="robots" content={noIndex ? 'noindex, nofollow' : 'index, follow'} />

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={truncatedDescription} />
      <meta property="og:type" content={ogType} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={title} />
      <meta property="og:site_name" content="OwnerFi" />
      <meta property="og:locale" content="en_US" />
      {canonical && <meta property="og:url" content={canonical} />}

      {/* Twitter */}
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={truncatedDescription} />
      <meta name="twitter:image" content={ogImage} />

      {/* Additional SEO Meta Tags */}
      <meta name="author" content="OwnerFi" />
      <meta name="publisher" content="OwnerFi" />
      <meta name="language" content="en-US" />
      <meta name="format-detection" content="telephone=no" />

      {/* Mobile Optimization */}
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta name="theme-color" content="#2563EB" />

      {/* Apple Touch Icon */}
      <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

      {/* Favicon */}
      <link rel="icon" type="image/x-icon" href="/favicon.ico" />
      <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
      <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
    </Head>
  );
}

// Specific meta tag configurations for different page types
export const SEO_CONFIGS = {
  home: {
    title: "OwnerFi - Owner Financed Properties | No Bank Financing Needed",
    description: "Find owner financed homes in all 50 states. Skip the bank with flexible seller financing. Low down payments, no credit checks required.",
    keywords: "owner financing, owner financed homes, seller financing, no bank financing, buy house without bank, creative financing, rent to own homes"
  },

  statePages: {
    title: (state: string) => `Owner Financing ${state} - No Bank Required | OwnerFi`,
    description: (state: string) => `Find owner financed homes in ${state}. Flexible seller financing options, low down payments, and no bank approval needed.`,
    keywords: (state: string) => `owner financing ${state}, seller financing ${state}, ${state} real estate, no bank ${state}, owner financed homes ${state}`
  },

  cityPages: {
    title: (city: string) => `${city} Owner Financing - Direct Seller Financing | OwnerFi`,
    description: (city: string) => `Owner financed properties in ${city}. Skip the bank with direct seller financing. View available homes with flexible terms.`,
    keywords: (city: string) => `${city} owner financing, ${city} seller financing, ${city} real estate, ${city} homes for sale`
  },

  keywordPages: {
    rentToOwn: {
      title: "Rent to Own Homes - No Credit Check Required | OwnerFi",
      description: "Find rent to own homes with flexible terms. No credit check required, low down payments, and pathway to homeownership.",
      keywords: "rent to own homes, lease to own, rent with option to buy, no credit check homes, flexible homeownership"
    },

    badCredit: {
      title: "Bad Credit Home Buying - Owner Financing Solutions | OwnerFi",
      description: "Buy a home with bad credit through owner financing. Flexible terms, no bank approval needed, fresh start to homeownership.",
      keywords: "bad credit home buying, poor credit mortgage, owner financing bad credit, no credit check real estate"
    },

    noCreditCheck: {
      title: "No Credit Check Homes - Owner Financed Properties | OwnerFi",
      description: "Find homes with no credit check required. Owner financing makes homeownership possible regardless of credit history.",
      keywords: "no credit check homes, no credit real estate, owner financing no credit, buy house no credit check"
    }
  }
};