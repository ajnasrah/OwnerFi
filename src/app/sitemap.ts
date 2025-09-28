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
      url: `${baseUrl}/contact`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/realtor`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/auth/signin`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/auth/signup`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/realtor/signin`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/realtor/signup`,
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

    // Add city pages
    const cityPages: MetadataRoute.Sitemap = Array.from(cities).map(city => ({
      url: `${baseUrl}/properties/${city.replace(/\s+/g, '-')}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.9,
    }))

    // Add state pages
    const statePages: MetadataRoute.Sitemap = Array.from(states).map(state => ({
      url: `${baseUrl}/properties/state/${state}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.9,
    }))

    // Combine all pages
    return [...staticPages, ...propertyPages, ...cityPages, ...statePages]
  } catch (error) {
    console.error('Error generating sitemap:', error)
    // Return at least static pages if database fails
    return staticPages
  }
}