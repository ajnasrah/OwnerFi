import Script from 'next/script'

export function OrganizationSchema() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': 'https://ownerfi.ai/#organization',
    name: 'Ownerfi',
    url: 'https://ownerfi.ai',
    logo: 'https://ownerfi.ai/logo.png',
    description: 'Find owner financed properties in Texas, Florida, and Georgia. Skip the bank with flexible seller financing options.',
    foundingDate: '2024',
    areaServed: [
      {
        '@type': 'State',
        name: 'Texas',
        '@id': 'https://en.wikipedia.org/wiki/Texas',
      },
      {
        '@type': 'State',
        name: 'Florida',
        '@id': 'https://en.wikipedia.org/wiki/Florida',
      },
      {
        '@type': 'State',
        name: 'Georgia',
        '@id': 'https://en.wikipedia.org/wiki/Georgia_(U.S._state)',
      },
    ],
    knowsAbout: [
      'Owner Financing',
      'Seller Financing',
      'Real Estate',
      'Property Investment',
      'Creative Financing',
      'No Bank Financing',
      'Rent to Own',
    ],
    sameAs: [
      'https://www.facebook.com/ownerfi',
      'https://www.linkedin.com/company/ownerfi',
      'https://twitter.com/ownerfi',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      email: 'support@ownerfi.ai',
      availableLanguage: ['English', 'Spanish'],
    },
    // aggregateRating removed — was fabricated (4.8 / 127 reviews) and emitted
    // sitewide in JSON-LD. Google disciplines sites for fake rich-result data
    // and it's an FTC §5 deception risk. Restore only with real verified
    // review data tied to a review platform.
  }

  return (
    <Script
      id="organization-schema"
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(structuredData),
      }}
    />
  )
}