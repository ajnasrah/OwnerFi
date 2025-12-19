import { MetadataRoute } from 'next'
import { getAllPropertiesForSitemap } from '@/lib/property-seo'

// This function runs on every request to generate a fresh sitemap
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://ownerfi.ai'

  // Static pages with their priorities and change frequencies
  // Note: Auth and signup pages are excluded as they're blocked in robots.txt
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

  // Major city pages - All cities with population > 50k
  const cityPages: MetadataRoute.Sitemap = [
    // Top 10 cities
    'new-york-city', 'los-angeles', 'chicago', 'houston', 'phoenix', 'philadelphia',
    'san-antonio', 'san-diego', 'dallas', 'austin',
    // Additional major cities (50k+ population)
    'miami', 'san-francisco', 'san-jose', 'sacramento', 'fort-worth',
    'orlando', 'tampa', 'jacksonville', 'buffalo', 'pittsburgh',
    'tucson', 'atlanta', 'las-vegas', 'seattle', 'denver',
    'boston', 'detroit', 'nashville', 'portland', 'charlotte',
    'indianapolis', 'columbus', 'milwaukee', 'kansas-city', 'baltimore'
  ].map(city => ({
    url: `${baseUrl}/${city}-owner-financing`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.7,
  }))

  // Fetch all active properties from ALL collections (properties, zillow_imports, cash_houses)
  let propertyPages: MetadataRoute.Sitemap = []

  try {
    // Get properties from all collections via property-seo library
    const allProperties = await getAllPropertiesForSitemap()

    propertyPages = allProperties.map(prop => ({
      url: `${baseUrl}/property/${prop.slug}`,
      lastModified: prop.lastModified,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }))

    // Collect unique cities and states for dynamic location pages
    const cities = new Set<string>()
    const states = new Set<string>()

    allProperties.forEach(prop => {
      if (prop.city) cities.add(prop.city.toLowerCase())
      if (prop.state) states.add(prop.state.toLowerCase())
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

    console.log(`[Sitemap] Generated ${propertyPages.length} property URLs from all collections`)

    // Combine all pages
    return [...staticPages, ...keywordPages, ...statePages, ...cityPages, ...propertyPages, ...dynamicCityPages, ...dynamicStatePages]
  } catch (error) {
    console.error('Error generating sitemap:', error)
    // Return at least static pages and keyword pages if database fails
    return [...staticPages, ...keywordPages, ...statePages, ...cityPages]
  }
}