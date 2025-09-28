#!/usr/bin/env ts-node

import * as fs from 'fs'
import * as path from 'path'

// Top 20 states by population (already have Texas, Florida, Georgia)
const states = [
  'California', 'New York', 'Pennsylvania', 'Illinois', 'Ohio',
  'North Carolina', 'Michigan', 'New Jersey', 'Virginia', 'Washington',
  'Arizona', 'Tennessee', 'Indiana', 'Missouri', 'Maryland',
  'Wisconsin', 'Colorado'
]

// Top 50 cities by population and real estate activity
const cities = [
  // California
  { name: 'Los Angeles', state: 'California', stateAbbr: 'CA' },
  { name: 'San Diego', state: 'California', stateAbbr: 'CA' },
  { name: 'San Francisco', state: 'California', stateAbbr: 'CA' },
  { name: 'San Jose', state: 'California', stateAbbr: 'CA' },
  { name: 'Sacramento', state: 'California', stateAbbr: 'CA' },

  // Texas (already have state page)
  { name: 'Houston', state: 'Texas', stateAbbr: 'TX' },
  { name: 'Dallas', state: 'Texas', stateAbbr: 'TX' },
  { name: 'Austin', state: 'Texas', stateAbbr: 'TX' },
  { name: 'San Antonio', state: 'Texas', stateAbbr: 'TX' },
  { name: 'Fort Worth', state: 'Texas', stateAbbr: 'TX' },

  // New York
  { name: 'New York', state: 'New York', stateAbbr: 'NY' },
  { name: 'Brooklyn', state: 'New York', stateAbbr: 'NY' },
  { name: 'Buffalo', state: 'New York', stateAbbr: 'NY' },

  // Florida (already have state page)
  { name: 'Miami', state: 'Florida', stateAbbr: 'FL' },
  { name: 'Orlando', state: 'Florida', stateAbbr: 'FL' },
  { name: 'Tampa', state: 'Florida', stateAbbr: 'FL' },
  { name: 'Jacksonville', state: 'Florida', stateAbbr: 'FL' },

  // Illinois
  { name: 'Chicago', state: 'Illinois', stateAbbr: 'IL' },

  // Pennsylvania
  { name: 'Philadelphia', state: 'Pennsylvania', stateAbbr: 'PA' },
  { name: 'Pittsburgh', state: 'Pennsylvania', stateAbbr: 'PA' },

  // Arizona
  { name: 'Phoenix', state: 'Arizona', stateAbbr: 'AZ' },
  { name: 'Tucson', state: 'Arizona', stateAbbr: 'AZ' },

  // Georgia (already have state page)
  { name: 'Atlanta', state: 'Georgia', stateAbbr: 'GA' },

  // Other major cities
  { name: 'Las Vegas', state: 'Nevada', stateAbbr: 'NV' },
  { name: 'Seattle', state: 'Washington', stateAbbr: 'WA' },
  { name: 'Denver', state: 'Colorado', stateAbbr: 'CO' },
  { name: 'Boston', state: 'Massachusetts', stateAbbr: 'MA' },
  { name: 'Detroit', state: 'Michigan', stateAbbr: 'MI' },
  { name: 'Nashville', state: 'Tennessee', stateAbbr: 'TN' },
  { name: 'Portland', state: 'Oregon', stateAbbr: 'OR' },
  { name: 'Charlotte', state: 'North Carolina', stateAbbr: 'NC' },
  { name: 'Indianapolis', state: 'Indiana', stateAbbr: 'IN' },
  { name: 'Columbus', state: 'Ohio', stateAbbr: 'OH' },
  { name: 'Milwaukee', state: 'Wisconsin', stateAbbr: 'WI' },
  { name: 'Kansas City', state: 'Missouri', stateAbbr: 'MO' },
  { name: 'Baltimore', state: 'Maryland', stateAbbr: 'MD' },
]

// Note: The dynamic [location] route will handle all these automatically
// This script documents which pages would be highest priority for explicit creation

console.log('SEO Page Generation Plan')
console.log('========================\n')

console.log('States to generate explicit pages for:')
states.forEach(state => {
  const slug = `owner-financing-${state.toLowerCase().replace(' ', '-')}`
  console.log(`- /app/${slug}/page.tsx`)
})

console.log('\nTop cities (handled by dynamic route):')
cities.forEach(city => {
  const slug = city.name.toLowerCase().replace(' ', '-')
  console.log(`- /${slug} (${city.state})`)
})

console.log('\n✓ Dynamic [location] route already handles all cities and states')
console.log('✓ Explicit pages only needed for highest-traffic keywords')
console.log('\nPriority explicit pages to create:')
console.log('1. /owner-financing-california')
console.log('2. /owner-financing-new-york')
console.log('3. /owner-financing-arizona')
console.log('4. /houston-owner-financing')
console.log('5. /los-angeles-owner-financing')