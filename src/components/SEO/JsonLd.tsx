import Script from 'next/script';

interface JsonLdProps {
  data: object;
}

export function JsonLd({ data }: JsonLdProps) {
  return (
    <Script
      id="json-ld"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

// Real Estate Website Schema
export function RealEstateWebsiteSchema() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    "name": "OwnerFi",
    "description": "Find owner financed homes with flexible financing options. No bank required, direct seller financing available.",
    "url": "https://ownerfi.ai",
    "logo": "https://ownerfi.ai/logo.png",
    "sameAs": [
      "https://www.facebook.com/ownerfi",
      "https://www.instagram.com/ownerfi",
      "https://www.linkedin.com/company/ownerfi"
    ],
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": "+1-800-OWNERFI",
      "contactType": "customer service",
      "availableLanguage": "English"
    },
    "areaServed": {
      "@type": "Country",
      "name": "United States"
    },
    "serviceType": "Owner Financing Real Estate",
    "priceRange": "$$"
  };

  return <JsonLd data={schema} />;
}

// Breadcrumb Schema
interface BreadcrumbItem {
  name: string;
  url: string;
}

interface BreadcrumbSchemaProps {
  items: BreadcrumbItem[];
}

export function BreadcrumbSchema({ items }: BreadcrumbSchemaProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      "item": item.url
    }))
  };

  return <JsonLd data={schema} />;
}

// WebPage Schema
interface WebPageSchemaProps {
  title: string;
  description: string;
  url: string;
  breadcrumbs?: BreadcrumbItem[];
}

export function WebPageSchema({ title, description, url, breadcrumbs }: WebPageSchemaProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": title,
    "description": description,
    "url": url,
    "inLanguage": "en-US",
    "isPartOf": {
      "@type": "WebSite",
      "name": "OwnerFi",
      "url": "https://ownerfi.ai"
    },
    "publisher": {
      "@type": "Organization",
      "name": "OwnerFi",
      "logo": {
        "@type": "ImageObject",
        "url": "https://ownerfi.ai/logo.png"
      }
    }
  };

  return (
    <>
      <JsonLd data={schema} />
      {breadcrumbs && <BreadcrumbSchema items={breadcrumbs} />}
    </>
  );
}

// Property Schema
interface PropertySchemaProps {
  property: {
    id: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    price: number;
    bedrooms: number;
    bathrooms: number;
    squareFootage: number;
    description: string;
    images: string[];
  };
}

export function PropertySchema({ property }: PropertySchemaProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "House",
    "name": `${property.address}, ${property.city}, ${property.state}`,
    "description": property.description,
    "address": {
      "@type": "PostalAddress",
      "streetAddress": property.address,
      "addressLocality": property.city,
      "addressRegion": property.state,
      "postalCode": property.zipCode,
      "addressCountry": "US"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "addressCountry": "US"
    },
    "offers": {
      "@type": "Offer",
      "price": property.price,
      "priceCurrency": "USD",
      "availability": "https://schema.org/InStock",
      "seller": {
        "@type": "Organization",
        "name": "OwnerFi"
      }
    },
    "numberOfRooms": property.bedrooms,
    "numberOfBathroomsTotal": property.bathrooms,
    "floorSize": {
      "@type": "QuantitativeValue",
      "value": property.squareFootage,
      "unitCode": "SQF"
    },
    "image": property.images
  };

  return <JsonLd data={schema} />;
}