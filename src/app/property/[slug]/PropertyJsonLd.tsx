/**
 * JSON-LD Structured Data for Property Pages
 *
 * This enables:
 * - Rich snippets in Google search results
 * - Google Knowledge Panel integration
 * - Better visibility in real estate searches
 */

interface PropertyJsonLdProps {
  property: any;
  slug: string;
}

/**
 * Convert various date formats to ISO string
 */
function toISOString(value: any): string {
  if (!value) return new Date().toISOString();

  // Already a string
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
  }

  // Firestore Timestamp
  if (value.toDate && typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }

  // Firestore Timestamp object with _seconds
  if (value._seconds) {
    return new Date(value._seconds * 1000).toISOString();
  }

  // Unix timestamp
  if (typeof value === 'number') {
    return new Date(value).toISOString();
  }

  // Date object
  if (value instanceof Date) {
    return value.toISOString();
  }

  return new Date().toISOString();
}

/**
 * Remove undefined values from object for clean JSON
 */
function cleanObject(obj: any): any {
  return JSON.parse(JSON.stringify(obj));
}

export default function PropertyJsonLd({ property, slug }: PropertyJsonLdProps) {
  const price = property.listPrice || property.price || 0;

  // Use property image, or Google Street View as fallback
  let imageUrl = property.imageUrls?.[0] || property.firstPropertyImage;
  if (!imageUrl) {
    const fullAddress = `${property.address}, ${property.city}, ${property.state}`;
    const googleApiKey = process.env.GOOGLE_MAPS_API_KEY || '';
    if (googleApiKey) {
      imageUrl = `https://maps.googleapis.com/maps/api/streetview?size=1200x800&location=${encodeURIComponent(fullAddress)}&key=${googleApiKey}`;
    } else {
      imageUrl = 'https://ownerfi.ai/placeholder-house.jpg';
    }
  }

  const canonicalUrl = `https://ownerfi.ai/property/${slug}`;
  const datePosted = toISOString(property.dateAdded || property.createdAt);
  const dateModified = toISOString(property.lastUpdated || property.updatedAt);

  // RealEstateListing Schema (most specific for property listings)
  const realEstateListingSchema = cleanObject({
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: `${property.address}, ${property.city} ${property.state}`,
    description: property.description || `${property.bedrooms || '?'} bed, ${property.bathrooms || '?'} bath home with owner financing available in ${property.city}, ${property.state}.`,
    url: canonicalUrl,
    datePosted,
    dateModified,
    image: imageUrl,
    offers: {
      '@type': 'Offer',
      price: price,
      priceCurrency: 'USD',
      availability: property.status === 'active' || property.isActive !== false
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      seller: {
        '@type': 'Organization',
        name: 'OwnerFi',
        url: 'https://ownerfi.ai',
      },
    },
  });

  // Residence/House Schema for property details
  const residenceSchema = cleanObject({
    '@context': 'https://schema.org',
    '@type': getPropertySchemaType(property.propertyType),
    name: `${property.address}`,
    description: property.description || `Owner financing available for this ${property.bedrooms || '?'} bed, ${property.bathrooms || '?'} bath home.`,
    address: {
      '@type': 'PostalAddress',
      streetAddress: property.address,
      addressLocality: property.city,
      addressRegion: property.state,
      postalCode: property.zipCode,
      addressCountry: 'US',
    },
    geo: property.latitude && property.longitude ? {
      '@type': 'GeoCoordinates',
      latitude: property.latitude,
      longitude: property.longitude,
    } : undefined,
    numberOfRooms: property.bedrooms || undefined,
    numberOfBedrooms: property.bedrooms || undefined,
    numberOfBathroomsTotal: property.bathrooms || undefined,
    floorSize: property.squareFeet ? {
      '@type': 'QuantitativeValue',
      value: property.squareFeet,
      unitCode: 'FTK',
    } : undefined,
    yearBuilt: property.yearBuilt || undefined,
    image: imageUrl,
    url: canonicalUrl,
  });

  // FAQ Schema for FAQ section
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `What is owner financing for ${property.address}?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Owner financing means the seller of ${property.address} acts as the lender. Instead of getting a mortgage from a bank, you make monthly payments directly to the property owner. This property in ${property.city}, ${property.state} is available with owner financing terms.`,
        },
      },
      {
        '@type': 'Question',
        name: 'Do I need good credit for owner financing?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'No! One of the biggest advantages of owner financing is that you typically don\'t need to qualify through a bank. This makes it possible to buy a home even with bad credit, no credit history, or self-employment income that\'s hard to document.',
        },
      },
      {
        '@type': 'Question',
        name: `How much is the down payment for this ${property.city} home?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: property.downPaymentAmount
            ? `The down payment for this property is $${property.downPaymentAmount.toLocaleString()}${property.downPaymentPercent ? ` (${property.downPaymentPercent}% of the purchase price)` : ''}. Contact OwnerFi to discuss flexible down payment options.`
            : `Down payment terms are negotiable. Sign up for free at OwnerFi to get the specific financing details for this ${property.city} property.`,
        },
      },
    ],
  };

  // BreadcrumbList Schema - Use state pages that actually exist
  const stateSlug = property.state?.toLowerCase().replace(/\s+/g, '-');
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: 'https://ownerfi.ai',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: `${property.state} Owner Financing`,
        item: `https://ownerfi.ai/owner-financing-${stateSlug}`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: property.address,
        item: canonicalUrl,
      },
    ],
  };

  // Product Schema (alternative - helps with Google Shopping/Merchant)
  const productSchema = cleanObject({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `${property.address} - Owner Finance Home`,
    description: `${property.bedrooms || '?'} bed, ${property.bathrooms || '?'} bath home with owner financing in ${property.city}, ${property.state}. No bank qualifying required.`,
    image: imageUrl,
    brand: {
      '@type': 'Organization',
      name: 'OwnerFi',
    },
    offers: {
      '@type': 'Offer',
      url: canonicalUrl,
      priceCurrency: 'USD',
      price: price,
      availability: property.status === 'active' || property.isActive !== false
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      seller: {
        '@type': 'Organization',
        name: 'OwnerFi',
      },
    },
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(realEstateListingSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(residenceSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
    </>
  );
}

function getPropertySchemaType(propertyType: string | undefined): string {
  switch (propertyType?.toLowerCase()) {
    case 'condo':
    case 'condominium':
      return 'Apartment';
    case 'townhouse':
    case 'townhome':
      return 'House';
    case 'multi-family':
    case 'duplex':
    case 'triplex':
      return 'House';
    case 'mobile-home':
    case 'manufactured':
      return 'House';
    case 'single-family':
    default:
      return 'SingleFamilyResidence';
  }
}
