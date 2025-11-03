#!/usr/bin/env tsx

import { initializeApp } from 'firebase/app'
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore'

// Initialize Firebase with client SDK
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

async function getCities() {
  try {
    console.error('Querying properties...')
    const propertiesRef = collection(db, 'properties')
    const q = query(propertiesRef, where('isActive', '==', true))
    const snapshot = await getDocs(q)

    console.error(`Found ${snapshot.size} active properties`)

    const cityCounts: Record<string, { city: string; state: string; count: number }> = {}

    snapshot.forEach((doc) => {
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
