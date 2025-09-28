import Script from 'next/script'

interface PropertySchemaProps {
  property: {
    id: string
    address: string
    city: string
    state: string
    zipCode: string
    listPrice: number
    bedrooms: number
    bathrooms: number
    squareFeet?: number
    description: string
    imageUrls?: string[]
    latitude?: number
    longitude?: number
    monthlyPayment?: number
    downPaymentAmount?: number
  }
  url: string
}

export function PropertySchema({ property, url }: PropertySchemaProps) {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    '@id': url,
    name: property.address,
    description: property.description || `Owner financed property at ${property.address}, ${property.city}, ${property.state}. ${property.bedrooms} bedrooms, ${property.bathrooms} bathrooms. Monthly payment starting at $${property.monthlyPayment}`,
    url: url,
    image: property.imageUrls?.[0] || 'https://ownerfi.com/placeholder-house.svg',
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
    offers: {
      '@type': 'Offer',
      price: property.listPrice,
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      seller: {
        '@type': 'Organization',
        name: 'OwnerFi',
        url: 'https://ownerfi.com',
      },
      priceSpecification: {
        '@type': 'PriceSpecification',
        price: property.monthlyPayment,
        priceCurrency: 'USD',
        unitText: 'MONTH',
        name: 'Monthly Payment',
      },
    },
    numberOfRooms: property.bedrooms,
    numberOfBathroomsTotal: property.bathrooms,
    floorSize: property.squareFeet ? {
      '@type': 'QuantitativeValue',
      value: property.squareFeet,
      unitCode: 'FTK', // Square feet
    } : undefined,
    additionalProperty: [
      {
        '@type': 'PropertyValue',
        name: 'Financing Type',
        value: 'Owner Financing Available',
      },
      {
        '@type': 'PropertyValue',
        name: 'Down Payment',
        value: `$${property.downPaymentAmount?.toLocaleString() || '0'}`,
      },
      {
        '@type': 'PropertyValue',
        name: 'Monthly Payment',
        value: `$${property.monthlyPayment?.toLocaleString() || '0'}`,
      },
    ],
  }

  return (
    <Script
      id={`property-schema-${property.id}`}
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(structuredData),
      }}
    />
  )
}