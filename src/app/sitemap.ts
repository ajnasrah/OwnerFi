import { MetadataRoute } from 'next'
import { db } from '@/lib/firebase'
import { collection, getDocs, query, where } from 'firebase/firestore'

// This function runs on every request to generate a fresh sitemap
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://ownerfi.ai'

  // Static pages with their priorities and change frequencies
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/how-owner-finance-works`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/auth/signin`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/realtor-signup`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/signup`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ]

  // High-priority keyword pages
  const keywordPages: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/rent-to-own-homes`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/bad-credit-home-buying`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/no-credit-check-homes`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
  ]

  // All 50 US states owner financing pages
  const statePages: MetadataRoute.Sitemap = [
    'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado', 'connecticut', 'delaware',
    'florida', 'georgia', 'hawaii', 'idaho', 'illinois', 'indiana', 'iowa', 'kansas', 'kentucky',
    'louisiana', 'maine', 'maryland', 'massachusetts', 'michigan', 'minnesota', 'mississippi',
    'missouri', 'montana', 'nebraska', 'nevada', 'new-hampshire', 'new-jersey', 'new-mexico',
    'new-york', 'north-carolina', 'north-dakota', 'ohio', 'oklahoma', 'oregon', 'pennsylvania',
    'rhode-island', 'south-carolina', 'south-dakota', 'tennessee', 'texas', 'utah', 'vermont',
    'virginia', 'washington', 'west-virginia', 'wisconsin', 'wyoming'
  ].map(state => ({
    url: `${baseUrl}/owner-financing-${state}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }))

  // Major city pages
  const cityPages: MetadataRoute.Sitemap = [
    'new-york-city', 'los-angeles', 'chicago', 'houston', 'phoenix', 'philadelphia',
    'san-antonio', 'san-diego', 'dallas', 'austin'
  ].map(city => ({
    url: `${baseUrl}/${city}-owner-financing`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.7,
  }))

  // Fetch all active properties from Firebase
  let propertyPages: MetadataRoute.Sitemap = []

  try {
    const propertiesRef = collection(db, 'properties')
    const activePropertiesQuery = query(propertiesRef, where('isActive', '==', true))
    const snapshot = await getDocs(activePropertiesQuery)

    propertyPages = snapshot.docs.map(doc => {
      const property = doc.data()
      // Create SEO-friendly URL from address
      const addressSlug = property.address
        ?.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || doc.id

      return {
        url: `${baseUrl}/property/${addressSlug}-${doc.id}`,
        lastModified: property.lastUpdated ? new Date(property.lastUpdated) : new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      }
    })

    // Also create location-based pages for better SEO
    const cities = new Set<string>()
    const states = new Set<string>()

    snapshot.docs.forEach(doc => {
      const property = doc.data()
      if (property.city) cities.add(property.city.toLowerCase())
      if (property.state) states.add(property.state.toLowerCase())
    })

    // Add dynamic city pages from properties
    const dynamicCityPages: MetadataRoute.Sitemap = Array.from(cities).map(city => ({
      url: `${baseUrl}/properties/${city.replace(/\s+/g, '-')}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.6,
    }))

    // Add dynamic state pages from properties
    const dynamicStatePages: MetadataRoute.Sitemap = Array.from(states).map(state => ({
      url: `${baseUrl}/properties/state/${state}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.6,
    }))

    // Combine all pages
    return [...staticPages, ...keywordPages, ...statePages, ...cityPages, ...propertyPages, ...dynamicCityPages, ...dynamicStatePages]
  } catch (error) {
    console.error('Error generating sitemap:', error)
    // Return at least static pages and keyword pages if database fails
    return [...staticPages, ...keywordPages, ...statePages, ...cityPages]
  }
}