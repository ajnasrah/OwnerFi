import React from 'react'

interface Organization {
  '@context': string
  '@type': string
  name: string
  url: string
  logo: string
  sameAs: string[]
  description: string
  contactPoint?: {
    '@type': string
    contactType: string
    email: string
  }
}

interface WebPage {
  '@context': string
  '@type': string
  name: string
  description: string
  url: string
  publisher: {
    '@type': string
    name: string
    logo: {
      '@type': string
      url: string
    }
  }
}

interface RealEstateListingSchema {
  '@context': string
  '@type': string
  name: string
  description: string
  url: string
  geo?: {
    '@type': string
    addressLocality: string
    addressRegion: string
    addressCountry: string
  }
  offers?: {
    '@type': string
    availability: string
    priceCurrency: string
  }
}

interface BreadcrumbList {
  '@context': string
  '@type': string
  itemListElement: Array<{
    '@type': string
    position: number
    name: string
    item?: string
  }>
}

interface StructuredDataProps {
  type: 'organization' | 'webpage' | 'listing' | 'breadcrumb'
  data?: {
    title?: string
    description?: string
    url?: string
    city?: string
    state?: string
    breadcrumbs?: Array<{ name: string; url?: string }>
  }
}

export function StructuredData({ type, data = {} }: StructuredDataProps) {
  const baseUrl = 'https://ownerfi.ai'

  const getSchema = () => {
    switch (type) {
      case 'organization': {
        const schema: Organization = {
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: 'OwnerFi',
          url: baseUrl,
          logo: `${baseUrl}/logo.png`,
          sameAs: [
            'https://facebook.com/ownerfi',
            'https://twitter.com/ownerfi',
            'https://linkedin.com/company/ownerfi'
          ],
          description: 'Find owner financed homes with flexible financing. No bank needed.',
          contactPoint: {
            '@type': 'ContactPoint',
            contactType: 'Customer Service',
            email: 'support@ownerfi.ai'
          }
        }
        return schema
      }

      case 'webpage': {
        const schema: WebPage = {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: data.title || 'OwnerFi - Owner Financed Properties',
          description: data.description || 'Find owner financed homes with flexible financing.',
          url: data.url || baseUrl,
          publisher: {
            '@type': 'Organization',
            name: 'OwnerFi',
            logo: {
              '@type': 'ImageObject',
              url: `${baseUrl}/logo.png`
            }
          }
        }
        return schema
      }

      case 'listing': {
        const schema: RealEstateListingSchema = {
          '@context': 'https://schema.org',
          '@type': 'RealEstateListing',
          name: data.title || 'Owner Financed Properties',
          description: data.description || 'Browse owner financed homes in your area',
          url: data.url || baseUrl,
          ...(data.city && data.state ? {
            geo: {
              '@type': 'GeoCoordinates',
              addressLocality: data.city,
              addressRegion: data.state,
              addressCountry: 'US'
            }
          } : {}),
          offers: {
            '@type': 'Offer',
            availability: 'https://schema.org/InStock',
            priceCurrency: 'USD'
          }
        }
        return schema
      }

      case 'breadcrumb': {
        const schema: BreadcrumbList = {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: (data.breadcrumbs || []).map((crumb, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: crumb.name,
            ...(crumb.url ? { item: crumb.url } : {})
          }))
        }
        return schema
      }

      default:
        return null
    }
  }

  const schema = getSchema()

  if (!schema) return null

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

// Convenience component for common page types
export function PageStructuredData({
  title,
  description,
  url,
  city,
  state,
  breadcrumbs
}: {
  title: string
  description: string
  url: string
  city?: string
  state?: string
  breadcrumbs?: Array<{ name: string; url?: string }>
}) {
  return (
    <>
      <StructuredData type="organization" />
      <StructuredData type="webpage" data={{ title, description, url }} />
      {(city || state) && (
        <StructuredData type="listing" data={{ title, description, url, city, state }} />
      )}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <StructuredData type="breadcrumb" data={{ breadcrumbs }} />
      )}
    </>
  )
}
