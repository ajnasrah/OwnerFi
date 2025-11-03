#!/usr/bin/env tsx

import * as fs from 'fs'
import * as path from 'path'

// Major US cities with population > 50k
const cities = [
  // California
  { name: 'Los Angeles', state: 'California', stateAbbr: 'CA', neighborhoods: ['Downtown', 'Hollywood', 'Santa Monica', 'Beverly Hills', 'Venice'] },
  { name: 'San Diego', state: 'California', stateAbbr: 'CA', neighborhoods: ['Downtown', 'La Jolla', 'Pacific Beach', 'Gaslamp Quarter', 'Coronado'] },
  { name: 'San Francisco', state: 'California', stateAbbr: 'CA', neighborhoods: ['Financial District', 'Mission District', 'Nob Hill', 'Haight-Ashbury', 'SOMA'] },
  { name: 'San Jose', state: 'California', stateAbbr: 'CA', neighborhoods: ['Downtown', 'Willow Glen', 'Almaden Valley', 'Cambrian Park', 'Evergreen'] },
  { name: 'Sacramento', state: 'California', stateAbbr: 'CA', neighborhoods: ['Downtown', 'Midtown', 'East Sacramento', 'Land Park', 'Natomas'] },

  // Texas
  { name: 'Houston', state: 'Texas', stateAbbr: 'TX', neighborhoods: ['Downtown', 'Montrose', 'River Oaks', 'Midtown', 'Heights'] },
  { name: 'Dallas', state: 'Texas', stateAbbr: 'TX', neighborhoods: ['Uptown', 'Deep Ellum', 'Bishop Arts', 'Lakewood', 'Highland Park'] },
  { name: 'Austin', state: 'Texas', stateAbbr: 'TX', neighborhoods: ['Downtown', 'South Congress', 'East Austin', 'West Lake Hills', 'Hyde Park'] },
  { name: 'San Antonio', state: 'Texas', stateAbbr: 'TX', neighborhoods: ['Downtown', 'Alamo Heights', 'Stone Oak', 'Southtown', 'King William'] },
  { name: 'Fort Worth', state: 'Texas', stateAbbr: 'TX', neighborhoods: ['Downtown', 'Sundance Square', 'Near Southside', 'Arlington Heights', 'Stockyards'] },

  // Florida
  { name: 'Miami', state: 'Florida', stateAbbr: 'FL', neighborhoods: ['South Beach', 'Brickell', 'Wynwood', 'Coral Gables', 'Coconut Grove'] },
  { name: 'Orlando', state: 'Florida', stateAbbr: 'FL', neighborhoods: ['Downtown', 'Winter Park', 'College Park', 'Thornton Park', 'Lake Nona'] },
  { name: 'Tampa', state: 'Florida', stateAbbr: 'FL', neighborhoods: ['Downtown', 'Ybor City', 'Hyde Park', 'Channelside', 'Westshore'] },
  { name: 'Jacksonville', state: 'Florida', stateAbbr: 'FL', neighborhoods: ['Downtown', 'Riverside', 'San Marco', 'Beaches', 'Mandarin'] },

  // New York
  { name: 'New York City', state: 'New York', stateAbbr: 'NY', neighborhoods: ['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island'] },
  { name: 'Buffalo', state: 'New York', stateAbbr: 'NY', neighborhoods: ['Downtown', 'Elmwood Village', 'Allentown', 'North Buffalo', 'Hertel'] },

  // Illinois
  { name: 'Chicago', state: 'Illinois', stateAbbr: 'IL', neighborhoods: ['Downtown', 'Lincoln Park', 'Wicker Park', 'Lakeview', 'River North'] },

  // Pennsylvania
  { name: 'Philadelphia', state: 'Pennsylvania', stateAbbr: 'PA', neighborhoods: ['Center City', 'Old City', 'Rittenhouse', 'Fishtown', 'University City'] },
  { name: 'Pittsburgh', state: 'Pennsylvania', stateAbbr: 'PA', neighborhoods: ['Downtown', 'Shadyside', 'Squirrel Hill', 'Lawrenceville', 'Strip District'] },

  // Arizona
  { name: 'Phoenix', state: 'Arizona', stateAbbr: 'AZ', neighborhoods: ['Downtown', 'Scottsdale', 'Tempe', 'Arcadia', 'Biltmore'] },
  { name: 'Tucson', state: 'Arizona', stateAbbr: 'AZ', neighborhoods: ['Downtown', 'Catalina Foothills', 'Oro Valley', 'Midtown', 'University District'] },

  // Georgia
  { name: 'Atlanta', state: 'Georgia', stateAbbr: 'GA', neighborhoods: ['Downtown', 'Buckhead', 'Midtown', 'Virginia Highland', 'Inman Park'] },

  // Other major cities
  { name: 'Las Vegas', state: 'Nevada', stateAbbr: 'NV', neighborhoods: ['The Strip', 'Downtown', 'Henderson', 'Summerlin', 'Spring Valley'] },
  { name: 'Seattle', state: 'Washington', stateAbbr: 'WA', neighborhoods: ['Downtown', 'Capitol Hill', 'Ballard', 'Fremont', 'Queen Anne'] },
  { name: 'Denver', state: 'Colorado', stateAbbr: 'CO', neighborhoods: ['Downtown', 'LoDo', 'Capitol Hill', 'Cherry Creek', 'Highland'] },
  { name: 'Boston', state: 'Massachusetts', stateAbbr: 'MA', neighborhoods: ['Downtown', 'Back Bay', 'Beacon Hill', 'North End', 'South End'] },
  { name: 'Detroit', state: 'Michigan', stateAbbr: 'MI', neighborhoods: ['Downtown', 'Midtown', 'Corktown', 'Greektown', 'Eastern Market'] },
  { name: 'Nashville', state: 'Tennessee', stateAbbr: 'TN', neighborhoods: ['Downtown', 'Gulch', 'East Nashville', 'Green Hills', 'Germantown'] },
  { name: 'Portland', state: 'Oregon', stateAbbr: 'OR', neighborhoods: ['Downtown', 'Pearl District', 'Hawthorne', 'Alberta', 'Northwest'] },
  { name: 'Charlotte', state: 'North Carolina', stateAbbr: 'NC', neighborhoods: ['Uptown', 'South End', 'NoDa', 'Plaza Midwood', 'Dilworth'] },
  { name: 'Indianapolis', state: 'Indiana', stateAbbr: 'IN', neighborhoods: ['Downtown', 'Broad Ripple', 'Fountain Square', 'Mass Ave', 'Carmel'] },
  { name: 'Columbus', state: 'Ohio', stateAbbr: 'OH', neighborhoods: ['Downtown', 'Short North', 'German Village', 'Clintonville', 'Grandview'] },
  { name: 'Milwaukee', state: 'Wisconsin', stateAbbr: 'WI', neighborhoods: ['Downtown', 'East Side', 'Bay View', 'Third Ward', 'Walker\'s Point'] },
  { name: 'Kansas City', state: 'Missouri', stateAbbr: 'MO', neighborhoods: ['Downtown', 'Westport', 'Plaza', 'Crossroads', 'River Market'] },
  { name: 'Baltimore', state: 'Maryland', stateAbbr: 'MD', neighborhoods: ['Inner Harbor', 'Fells Point', 'Canton', 'Federal Hill', 'Mount Vernon'] },
]

const appDir = path.join(process.cwd(), 'src', 'app')

// Check which pages already exist
const existingPages = cities.filter(city => {
  const slug = city.name.toLowerCase().replace(/\s+/g, '-')
  const pagePath = path.join(appDir, `${slug}-owner-financing`, 'page.tsx')
  return fs.existsSync(pagePath)
})

const missingPages = cities.filter(city => {
  const slug = city.name.toLowerCase().replace(/\s+/g, '-')
  const pagePath = path.join(appDir, `${slug}-owner-financing`, 'page.tsx')
  return !fs.existsSync(pagePath)
})

console.log(`\n📊 City Pages Analysis:`)
console.log(`✅ Existing pages: ${existingPages.length}`)
console.log(`❌ Missing pages: ${missingPages.length}`)
console.log(`📝 Total cities: ${cities.length}\n`)

console.log(`\nExisting pages:`)
existingPages.forEach(city => {
  const slug = city.name.toLowerCase().replace(/\s+/g, '-')
  console.log(`  ✅ ${city.name}, ${city.stateAbbr} (/${slug}-owner-financing)`)
})

console.log(`\nMissing pages:`)
missingPages.forEach(city => {
  const slug = city.name.toLowerCase().replace(/\s+/g, '-')
  console.log(`  ❌ ${city.name}, ${city.stateAbbr} (/${slug}-owner-financing)`)
})

console.log(`\n\nTo generate all missing pages, I'll create them based on the Miami template.`)
console.log(`Do you want to proceed? This will create ${missingPages.length} new page files.\n`)
