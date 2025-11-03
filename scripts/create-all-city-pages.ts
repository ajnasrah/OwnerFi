#!/usr/bin/env tsx

import * as fs from 'fs'
import * as path from 'path'

interface CityData {
  name: string
  state: string
  stateAbbr: string
  neighborhoods: string[]
  theme?: {
    primary: string
    secondary: string
  }
  tagline?: string
}

const cities: CityData[] = [
  { name: 'San Francisco', state: 'California', stateAbbr: 'CA', neighborhoods: ['Financial District', 'Mission District', 'Nob Hill', 'Haight-Ashbury', 'SOMA'], theme: { primary: 'blue', secondary: 'orange' }, tagline: 'Tech Hub & Bay Area Living' },
  { name: 'San Jose', state: 'California', stateAbbr: 'CA', neighborhoods: ['Downtown', 'Willow Glen', 'Almaden Valley', 'Cambrian Park', 'Evergreen'], theme: { primary: 'cyan', secondary: 'blue' }, tagline: 'Silicon Valley Heart' },
  { name: 'Sacramento', state: 'California', stateAbbr: 'CA', neighborhoods: ['Downtown', 'Midtown', 'East Sacramento', 'Land Park', 'Natomas'], theme: { primary: 'green', secondary: 'yellow' }, tagline: 'California Capital' },
  { name: 'Fort Worth', state: 'Texas', stateAbbr: 'TX', neighborhoods: ['Downtown', 'Sundance Square', 'Near Southside', 'Arlington Heights', 'Stockyards'], theme: { primary: 'red', secondary: 'blue' }, tagline: 'Cowtown & Culture' },
  { name: 'Orlando', state: 'Florida', stateAbbr: 'FL', neighborhoods: ['Downtown', 'Winter Park', 'College Park', 'Thornton Park', 'Lake Nona'], theme: { primary: 'purple', secondary: 'orange' }, tagline: 'Theme Park Capital' },
  { name: 'Tampa', state: 'Florida', stateAbbr: 'FL', neighborhoods: ['Downtown', 'Ybor City', 'Hyde Park', 'Channelside', 'Westshore'], theme: { primary: 'red', secondary: 'blue' }, tagline: 'Tampa Bay Living' },
  { name: 'Jacksonville', state: 'Florida', stateAbbr: 'FL', neighborhoods: ['Downtown', 'Riverside', 'San Marco', 'Beaches', 'Mandarin'], theme: { primary: 'teal', secondary: 'orange' }, tagline: 'River City by the Sea' },
  { name: 'Buffalo', state: 'New York', stateAbbr: 'NY', neighborhoods: ['Downtown', 'Elmwood Village', 'Allentown', 'North Buffalo', 'Hertel'], theme: { primary: 'blue', secondary: 'red' }, tagline: 'Buffalo Strong' },
  { name: 'Pittsburgh', state: 'Pennsylvania', stateAbbr: 'PA', neighborhoods: ['Downtown', 'Shadyside', 'Squirrel Hill', 'Lawrenceville', 'Strip District'], theme: { primary: 'yellow', secondary: 'blue' }, tagline: 'Steel City Renaissance' },
  { name: 'Tucson', state: 'Arizona', stateAbbr: 'AZ', neighborhoods: ['Downtown', 'Catalina Foothills', 'Oro Valley', 'Midtown', 'University District'], theme: { primary: 'orange', secondary: 'red' }, tagline: 'Desert Oasis' },
  { name: 'Atlanta', state: 'Georgia', stateAbbr: 'GA', neighborhoods: ['Downtown', 'Buckhead', 'Midtown', 'Virginia Highland', 'Inman Park'], theme: { primary: 'red', secondary: 'blue' }, tagline: 'Capital of the South' },
  { name: 'Las Vegas', state: 'Nevada', stateAbbr: 'NV', neighborhoods: ['The Strip', 'Downtown', 'Henderson', 'Summerlin', 'Spring Valley'], theme: { primary: 'yellow', secondary: 'red' }, tagline: 'Entertainment Capital' },
  { name: 'Seattle', state: 'Washington', stateAbbr: 'WA', neighborhoods: ['Downtown', 'Capitol Hill', 'Ballard', 'Fremont', 'Queen Anne'], theme: { primary: 'green', secondary: 'blue' }, tagline: 'Emerald City' },
  { name: 'Denver', state: 'Colorado', stateAbbr: 'CO', neighborhoods: ['Downtown', 'LoDo', 'Capitol Hill', 'Cherry Creek', 'Highland'], theme: { primary: 'blue', secondary: 'orange' }, tagline: 'Mile High City' },
  { name: 'Boston', state: 'Massachusetts', stateAbbr: 'MA', neighborhoods: ['Downtown', 'Back Bay', 'Beacon Hill', 'North End', 'South End'], theme: { primary: 'red', secondary: 'blue' }, tagline: 'Historic Hub' },
  { name: 'Detroit', state: 'Michigan', stateAbbr: 'MI', neighborhoods: ['Downtown', 'Midtown', 'Corktown', 'Greektown', 'Eastern Market'], theme: { primary: 'blue', secondary: 'red' }, tagline: 'Motor City' },
  { name: 'Nashville', state: 'Tennessee', stateAbbr: 'TN', neighborhoods: ['Downtown', 'Gulch', 'East Nashville', 'Green Hills', 'Germantown'], theme: { primary: 'purple', secondary: 'yellow' }, tagline: 'Music City' },
  { name: 'Portland', state: 'Oregon', stateAbbr: 'OR', neighborhoods: ['Downtown', 'Pearl District', 'Hawthorne', 'Alberta', 'Northwest'], theme: { primary: 'green', secondary: 'blue' }, tagline: 'Keep Portland Weird' },
  { name: 'Charlotte', state: 'North Carolina', stateAbbr: 'NC', neighborhoods: ['Uptown', 'South End', 'NoDa', 'Plaza Midwood', 'Dilworth'], theme: { primary: 'blue', secondary: 'cyan' }, tagline: 'Queen City' },
  { name: 'Indianapolis', state: 'Indiana', stateAbbr: 'IN', neighborhoods: ['Downtown', 'Broad Ripple', 'Fountain Square', 'Mass Ave', 'Carmel'], theme: { primary: 'blue', secondary: 'yellow' }, tagline: 'Indy' },
  { name: 'Columbus', state: 'Ohio', stateAbbr: 'OH', neighborhoods: ['Downtown', 'Short North', 'German Village', 'Clintonville', 'Grandview'], theme: { primary: 'red', secondary: 'gray' }, tagline: 'Ohio Capital' },
  { name: 'Milwaukee', state: 'Wisconsin', stateAbbr: 'WI', neighborhoods: ['Downtown', 'East Side', 'Bay View', 'Third Ward', 'Walker\'s Point'], theme: { primary: 'blue', secondary: 'yellow' }, tagline: 'Brew City' },
  { name: 'Kansas City', state: 'Missouri', stateAbbr: 'MO', neighborhoods: ['Downtown', 'Westport', 'Plaza', 'Crossroads', 'River Market'], theme: { primary: 'red', secondary: 'yellow' }, tagline: 'BBQ Capital' },
  { name: 'Baltimore', state: 'Maryland', stateAbbr: 'MD', neighborhoods: ['Inner Harbor', 'Fells Point', 'Canton', 'Federal Hill', 'Mount Vernon'], theme: { primary: 'orange', secondary: 'purple' }, tagline: 'Charm City' },
]

function generateCityPage(city: CityData): string {
  const slug = city.name.toLowerCase().replace(/\s+/g, '-')
  const functionName = city.name.replace(/\s+/g, '')
  const stateSlug = city.state.toLowerCase().replace(/\s+/g, '-')

  const colorMap: Record<string, string[]> = {
    'blue': ['blue', 'indigo'],
    'red': ['red', 'pink'],
    'green': ['green', 'emerald'],
    'orange': ['orange', 'amber'],
    'purple': ['purple', 'pink'],
    'cyan': ['cyan', 'blue'],
    'yellow': ['yellow', 'orange'],
    'teal': ['teal', 'cyan'],
    'gray': ['gray', 'slate'],
  }

  const [color1, color2] = colorMap[city.theme?.primary || 'blue'] || ['blue', 'indigo']

  return `import { Metadata } from 'next'
import Link from 'next/link'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs } from 'firebase/firestore'

export const metadata: Metadata = {
  title: 'Owner Financing ${city.name} | Rent to Own Alternative ${city.stateAbbr} | ${city.neighborhoods.slice(0, 2).join(', ')} | OwnerFi',
  description: 'Find owner financed homes in ${city.name} - better than rent to own! Immediate ownership in ${city.neighborhoods.slice(0, 3).join(', ')}. No banks needed. Flexible credit options.',
  keywords: 'owner financing ${city.name.toLowerCase()}, owner financed homes ${city.name.toLowerCase()}, rent to own ${city.name.toLowerCase()}, rent to own ${city.state.toLowerCase()}, seller financing ${city.name.toLowerCase()}, no credit check homes ${city.name.toLowerCase()}, bad credit homes ${city.name.toLowerCase()}, ${city.name.toLowerCase()} real estate owner financing',
  openGraph: {
    title: 'Owner Financed Homes in ${city.name} - Better Than Rent to Own | OwnerFi',
    description: 'Skip the banks! Find owner financed properties across ${city.name} with immediate ownership. Serving ${city.neighborhoods.slice(0, 3).join(', ')} and more.',
    url: 'https://ownerfi.ai/${slug}-owner-financing',
    siteName: 'OwnerFi',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Owner Financing ${city.name} - Better Than Rent to Own',
    description: 'Find owner financed homes across ${city.name}. Immediate ownership, no banks needed.',
  },
  alternates: {
    canonical: 'https://ownerfi.ai/${slug}-owner-financing',
  }
}

async function get${functionName}Properties() {
  try {
    const propertiesRef = collection(db, 'properties')
    const q = query(
      propertiesRef,
      where('isActive', '==', true),
      where('city', 'in', ['${city.name}', '${city.neighborhoods.slice(0, 5).join("', '")}'])
    )
    const snapshot = await getDocs(q)

    const areaCounts: Record<string, number> = {}
    let totalCount = 0

    snapshot.docs.forEach(doc => {
      const data = doc.data()
      const cityName = data.city || ''
      if (cityName) {
        areaCounts[cityName] = (areaCounts[cityName] || 0) + 1
        totalCount++
      }
    })

    return { areaCounts, totalCount }
  } catch (error) {
    console.error('Error fetching ${city.name} properties:', error)
    return { areaCounts: {}, totalCount: 0 }
  }
}

export default async function OwnerFinancing${functionName}() {
  const { areaCounts, totalCount } = await get${functionName}Properties()

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "Is owner financing better than rent to own in ${city.name}?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes! With owner financing in ${city.name}, you get immediate ownership and build equity from day one. Rent to own requires years of renting before you can purchase. Owner financing gives you the deed right away with seller-held financing."
        }
      },
      {
        "@type": "Question",
        "name": "Can I get owner financing with bad credit in ${city.name}?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Many ${city.name} sellers offering owner financing are flexible with credit requirements. While some properties require credit checks, approximately 30% have no credit requirements and 50% work with buyers who have credit challenges."
        }
      },
      {
        "@type": "Question",
        "name": "What neighborhoods in ${city.name} offer owner financed homes?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Owner financed homes are available throughout ${city.name} including ${city.neighborhoods.join(', ')}, and more."
        }
      },
      {
        "@type": "Question",
        "name": "How much down payment is needed for ${city.name} owner financing?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Down payments in ${city.name} typically range from 10% to 20% of the purchase price. ${city.state}'s market makes owner financing accessible with reasonable terms."
        }
      }
    ]
  }

  const localBusinessSchema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": "OwnerFi ${city.name} - Owner Financed Homes",
    "description": "Find owner financed homes throughout ${city.name}. Better than rent to own with immediate ownership.",
    "url": "https://ownerfi.ai/${slug}-owner-financing",
    "areaServed": {
      "@type": "City",
      "name": "${city.name}",
      "containsPlace": [
        ${city.neighborhoods.slice(0, 5).map(n => `{ "@type": "Neighborhood", "name": "${n}" }`).join(',\n        ')}
      ]
    }
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
      />

      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="max-w-7xl mx-auto px-4 py-12">
          {/* Breadcrumb */}
          <nav className="mb-8">
            <ol className="flex space-x-2 text-sm text-slate-600">
              <li><Link href="/" className="hover:text-indigo-600">Home</Link></li>
              <li>/</li>
              <li><Link href="/owner-financing-${stateSlug}" className="hover:text-indigo-600">${city.state}</Link></li>
              <li>/</li>
              <li className="text-slate-900 font-medium">${city.name}</li>
            </ol>
          </nav>

          {/* Hero Section */}
          <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12 mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">
              Owner Financing ${city.name} - Better Than Rent to Own
            </h1>
            <p className="text-xl text-slate-700 mb-8">
              Find {totalCount > 0 ? \`\${totalCount}+ \` : ''}owner financed homes across ${city.tagline || city.name}.
              Skip the banks and get immediate ownership with seller financing in ${city.neighborhoods.slice(0, 3).join(', ')}, and beyond.
            </p>

            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl border border-green-200">
                <h3 className="font-bold text-green-900 mb-2">Immediate ${city.name} Ownership</h3>
                <p className="text-green-800">Get the deed right away, unlike rent to own</p>
              </div>
              <div className="bg-gradient-to-br from-${color1}-50 to-${color2}-50 p-6 rounded-xl border border-${color1}-200">
                <h3 className="font-bold text-${color1}-900 mb-2">${city.tagline || city.name}</h3>
                <p className="text-${color1}-800">Premium location, great lifestyle</p>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-xl border border-purple-200">
                <h3 className="font-bold text-purple-900 mb-2">Flexible Terms</h3>
                <p className="text-purple-800">Bad credit OK, low down payments</p>
              </div>
            </div>

            <Link href="/signup">
              <button className="bg-gradient-to-r from-${color1}-600 to-${color2}-600 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:from-${color1}-700 hover:to-${color2}-700 transition-all transform hover:scale-105 shadow-lg">
                Browse ${city.name} Properties →
              </button>
            </Link>
          </div>

          {/* Call to Action Section */}
          <section className="py-12 px-6 bg-gradient-to-r from-${color1}-900/30 to-${color2}-900/30 rounded-2xl mb-12">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-3xl font-bold text-white mb-4">
                Ready to Find Your ${city.name} Home?
              </h2>
              <p className="text-xl text-slate-300 mb-8">
                Browse owner financed and rent-to-own properties across ${city.name}.
                No banks needed, flexible terms available.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/signup">
                  <button className="bg-gradient-to-r from-${color1}-600 to-${color1}-500 hover:from-${color1}-500 hover:to-${color1}-400 text-white py-4 px-8 rounded-xl font-semibold text-lg transition-all duration-300 hover:scale-[1.02] shadow-lg hover:shadow-xl">
                    🏠 Browse ${city.name} Properties
                  </button>
                </Link>
                <Link href="/signup">
                  <button className="bg-white/10 backdrop-blur-sm border-2 border-white/30 hover:bg-white/20 text-white py-4 px-8 rounded-xl font-semibold text-lg transition-all duration-300 hover:scale-[1.02]">
                    Get Pre-Qualified Today
                  </button>
                </Link>
              </div>
              <p className="text-sm text-slate-400 mt-6">
                Join 500+ buyers who found their dream home without traditional financing
              </p>
            </div>
          </section>

          {/* ${city.name} Neighborhoods Section */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-8">
              Owner Financed Homes by ${city.name} Neighborhood
            </h2>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              ${city.neighborhoods.map((neighborhood, idx) => {
                const colors = ['cyan', 'blue', 'purple', 'emerald', 'teal', 'orange']
                const color = colors[idx % colors.length]
                return `<div className="p-6 bg-gradient-to-br from-${color}-50 to-${color}-50 rounded-xl border-2 border-${color}-200">
                <h3 className="text-xl font-bold text-${color}-900 mb-2">
                  ${neighborhood}
                </h3>
                <p className="text-${color}-700 mb-2">
                  {areaCounts['${neighborhood}'] || 'Premium'} owner financed properties
                </p>
                <p className="text-sm text-${color}-600 mb-3">
                  Great neighborhood with owner financing options
                </p>
              </div>`
              }).join('\n              ')}
            </div>
          </div>

          {/* Why Owner Financing in ${city.name} */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-6">
              Why Choose Owner Financing in ${city.name}?
            </h2>

            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-semibold text-slate-800 mb-4">
                  ${city.name} Real Estate Advantages
                </h3>
                <ul className="space-y-3 text-slate-700">
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Great location and lifestyle in ${city.name}</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Skip traditional bank financing requirements</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Flexible terms with seller financing</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Build equity from day one</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Owner financing makes homeownership accessible</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-slate-800 mb-4">
                  Owner Financing vs Rent to Own in ${city.name}
                </h3>
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <h4 className="font-semibold text-green-900 mb-2">Owner Financing ✓</h4>
                    <p className="text-green-800 text-sm">
                      Immediate ownership with deed transfer. Build equity from day one.
                      ${city.state} property tax benefits. Protected by state property laws.
                    </p>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                    <h4 className="font-semibold text-red-900 mb-2">Rent to Own ✗</h4>
                    <p className="text-red-800 text-sm">
                      Years of renting before ownership. No equity during rental period.
                      Risk of losing option fee. Treated as tenant under ${city.state} law.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* FAQ Section */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-8">
              ${city.name} Owner Financing FAQ
            </h2>

            <div className="space-y-6">
              <div className="border-b pb-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  Is owner financing legal in ${city.name}?
                </h3>
                <p className="text-slate-700">
                  Yes, owner financing is completely legal in ${city.name}. The city follows ${city.state} state laws governing
                  seller financing through warranty deeds, mortgages, and promissory notes.
                </p>
              </div>

              <div className="border-b pb-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  What credit score do I need for owner financing in ${city.name}?
                </h3>
                <p className="text-slate-700">
                  Credit requirements vary by seller. Approximately 30% of our ${city.name} properties have
                  no credit check requirements, 50% work with buyers who have credit challenges,
                  and 20% prefer good credit.
                </p>
              </div>

              <div className="border-b pb-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  How much down payment is typical for ${city.name} owner financing?
                </h3>
                <p className="text-slate-700">
                  Down payments typically range from 10% to 20% of the purchase price in ${city.name}.
                  The average is around 15%, making homeownership more accessible than traditional financing.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  Can I use owner financing for ${city.name} investment properties?
                </h3>
                <p className="text-slate-700">
                  Yes! Many ${city.name} sellers offer owner financing for investment properties.
                  The city's market creates opportunities for real estate investors.
                </p>
              </div>
            </div>
          </div>

          {/* CTA Section */}
          <div className="bg-gradient-to-r from-${color1}-600 to-${color2}-600 rounded-2xl shadow-xl p-8 text-center text-white">
            <h2 className="text-3xl font-bold mb-4">
              Start Your ${city.name} Homeownership Journey Today
            </h2>
            <p className="text-xl mb-8 text-${color1}-100">
              Better than rent to own - get immediate ownership with owner financing
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/signup">
                <button className="bg-white text-${color1}-600 px-8 py-4 rounded-xl font-semibold hover:bg-${color1}-50 transition-all">
                  Search ${city.name} Properties
                </button>
              </Link>
              <Link href="/how-owner-finance-works">
                <button className="bg-${color1}-500 text-white px-8 py-4 rounded-xl font-semibold hover:bg-${color1}-400 transition-all">
                  Learn How It Works
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
`
}

const appDir = path.join(process.cwd(), 'src', 'app')

console.log('🚀 Starting city page generation...\n')

let created = 0
let skipped = 0

for (const city of cities) {
  const slug = city.name.toLowerCase().replace(/\s+/g, '-')
  const dirPath = path.join(appDir, `${slug}-owner-financing`)
  const filePath = path.join(dirPath, 'page.tsx')

  if (fs.existsSync(filePath)) {
    console.log(`⏭️  Skipped: ${city.name} (already exists)`)
    skipped++
    continue
  }

  // Create directory
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }

  // Generate and write page
  const pageContent = generateCityPage(city)
  fs.writeFileSync(filePath, pageContent)

  console.log(`✅ Created: ${city.name}, ${city.stateAbbr} (/${slug}-owner-financing)`)
  created++
}

console.log(`\n📊 Summary:`)
console.log(`✅ Created: ${created} pages`)
console.log(`⏭️  Skipped: ${skipped} pages`)
console.log(`📝 Total: ${cities.length} cities processed\n`)
