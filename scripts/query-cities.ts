#!/usr/bin/env tsx

import { getAdminDb } from '../src/lib/firebase-admin'

async function getCities() {
  try {
    const adminDb = await getAdminDb()
    if (!adminDb) {
      console.error('Firebase Admin SDK not initialized')
      process.exit(1)
    }

    const snapshot = await adminDb
      .collection('properties')
      .where('isActive', '==', true)
      .get()

    const cityCounts: Record<string, { city: string; state: string; count: number }> = {}

    snapshot.forEach((doc: any) => {
      const data = doc.data()
      const city = data.city
      const state = data.state

      if (city && state) {
        const key = `${city}|${state}`
        if (!cityCounts[key]) {
          cityCounts[key] = { city, state, count: 0 }
        }
        cityCounts[key].count++
      }
    })

    // Sort by property count
    const sorted = Object.values(cityCounts)
      .sort((a, b) => b.count - a.count)

    console.log(JSON.stringify(sorted, null, 2))
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }

  process.exit(0)
}

getCities()
