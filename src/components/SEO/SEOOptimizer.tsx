import { JsonLd, WebPageSchema, BreadcrumbSchema } from './JsonLd';

// Comprehensive SEO optimization for any page
interface SEOOptimizerProps {
  title: string;
  description: string;
  canonical?: string;
  breadcrumbs?: Array<{ name: string; url: string }>;
  structuredData?: object;
}

export function SEOOptimizer({
  title,
  description,
  canonical,
  breadcrumbs,
  structuredData,
}: SEOOptimizerProps) {
  return (
    <>
      {/* Structured Data */}
      {structuredData && <JsonLd data={structuredData} />}
      {breadcrumbs && <BreadcrumbSchema items={breadcrumbs} />}
      <WebPageSchema
        title={title}
        description={description}
        url={canonical || 'https://ownerfi.ai'}
        breadcrumbs={breadcrumbs}
      />
    </>
  );
}

// Generate optimized metadata for state pages
export function generateStateMetadata(state: string): Metadata {
  const stateTitle = state.split('-').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');

  return {
    title: `Owner Financing ${stateTitle} - Seller Financed Homes | OwnerFi`,
    description: `Find owner financed homes in ${stateTitle}. Browse seller financing properties with flexible terms, no bank approval needed. Bad credit OK, low down payments.`,
    keywords: `owner financing ${stateTitle}, seller financing ${stateTitle}, ${stateTitle} real estate, no bank ${stateTitle}, owner financed homes ${stateTitle}, rent to own ${stateTitle}`,
    alternates: {
      canonical: `https://ownerfi.ai/owner-financing-${state}`
    },
    openGraph: {
      title: `Owner Financing ${stateTitle} - No Bank Required | OwnerFi`,
      description: `Discover owner financed properties in ${stateTitle}. Skip the bank with flexible seller financing options.`,
      url: `https://ownerfi.ai/owner-financing-${state}`,
      images: [{
        url: 'https://ownerfi.ai/og-image.png',
        width: 1200,
        height: 630,
        alt: `Owner Financing ${stateTitle} - OwnerFi`
      }]
    },
    twitter: {
      card: 'summary_large_image',
      title: `Owner Financing ${stateTitle}`,
      description: `Find seller financed homes in ${stateTitle}. No bank required.`,
      images: ['https://ownerfi.ai/og-image.png']
    }
  };
}

// Generate optimized metadata for city pages
export function generateCityMetadata(city: string): Metadata {
  const cityTitle = city.split('-').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');

  return {
    title: `${cityTitle} Owner Financing - Direct Seller Financing | OwnerFi`,
    description: `Owner financed properties in ${cityTitle}. Skip the bank with direct seller financing. View available homes with flexible terms and low down payments.`,
    keywords: `${cityTitle} owner financing, ${cityTitle} seller financing, ${cityTitle} real estate, ${cityTitle} homes for sale, ${cityTitle} no bank financing`,
    alternates: {
      canonical: `https://ownerfi.ai/${city}-owner-financing`
    },
    openGraph: {
      title: `${cityTitle} Owner Financing - No Bank Required | OwnerFi`,
      description: `Find owner financed homes in ${cityTitle}. Direct seller financing available.`,
      url: `https://ownerfi.ai/${city}-owner-financing`,
      images: [{
        url: 'https://ownerfi.ai/og-image.png',
        width: 1200,
        height: 630,
        alt: `${cityTitle} Owner Financing - OwnerFi`
      }]
    },
    twitter: {
      card: 'summary_large_image',
      title: `${cityTitle} Owner Financing`,
      description: `Seller financed homes in ${cityTitle}. No bank needed.`,
      images: ['https://ownerfi.ai/og-image.png']
    }
  };
}

// Generate optimized metadata for keyword pages
export function generateKeywordMetadata(keyword: string): Metadata {
  const configs = {
    'rent-to-own-homes': {
      title: "Rent to Own Homes - No Credit Check Required | OwnerFi",
      description: "Find rent to own homes with flexible terms. No credit check required, low down payments, and pathway to homeownership. Better than traditional rent-to-own.",
      keywords: "rent to own homes, lease to own, rent with option to buy, no credit check homes, flexible homeownership, rent to own bad credit"
    },
    'bad-credit-home-buying': {
      title: "Bad Credit Home Buying - Owner Financing Solutions | OwnerFi",
      description: "Buy a home with bad credit through owner financing. Flexible terms, no bank approval needed, fresh start to homeownership. Poor credit OK.",
      keywords: "bad credit home buying, poor credit mortgage, owner financing bad credit, no credit check real estate, bad credit real estate"
    },
    'no-credit-check-homes': {
      title: "No Credit Check Homes - Owner Financed Properties | OwnerFi",
      description: "Find homes with no credit check required. Owner financing makes homeownership possible regardless of credit history. Skip bank approval.",
      keywords: "no credit check homes, no credit real estate, owner financing no credit, buy house no credit check, no credit approval homes"
    }
  };

  const config = configs[keyword as keyof typeof configs];
  if (!config) {
    throw new Error(`No SEO config found for keyword: ${keyword}`);
  }

  return {
    title: config.title,
    description: config.description,
    keywords: config.keywords,
    alternates: {
      canonical: `https://ownerfi.ai/${keyword}`
    },
    openGraph: {
      title: config.title,
      description: config.description,
      url: `https://ownerfi.ai/${keyword}`,
      images: [{
        url: 'https://ownerfi.ai/og-image.png',
        width: 1200,
        height: 630,
        alt: config.title
      }]
    },
    twitter: {
      card: 'summary_large_image',
      title: config.title,
      description: config.description,
      images: ['https://ownerfi.ai/og-image.png']
    }
  };
}

// All US states for easy reference
export const US_STATES = [
  'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado',
  'connecticut', 'delaware', 'florida', 'georgia', 'hawaii', 'idaho',
  'illinois', 'indiana', 'iowa', 'kansas', 'kentucky', 'louisiana',
  'maine', 'maryland', 'massachusetts', 'michigan', 'minnesota', 'mississippi',
  'missouri', 'montana', 'nebraska', 'nevada', 'new-hampshire', 'new-jersey',
  'new-mexico', 'new-york', 'north-carolina', 'north-dakota', 'ohio', 'oklahoma',
  'oregon', 'pennsylvania', 'rhode-island', 'south-carolina', 'south-dakota',
  'tennessee', 'texas', 'utah', 'vermont', 'virginia', 'washington',
  'west-virginia', 'wisconsin', 'wyoming'
];

// Major cities for easy reference
export const MAJOR_CITIES = [
  'new-york-city', 'los-angeles', 'chicago', 'houston', 'phoenix',
  'philadelphia', 'san-antonio', 'san-diego', 'dallas', 'austin'
];

// Keyword pages for easy reference
export const KEYWORD_PAGES = [
  'rent-to-own-homes', 'bad-credit-home-buying', 'no-credit-check-homes'
];