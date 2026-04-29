import type { Metadata } from 'next';
import { stateData, cityData } from '@/lib/location-data';
import Link from 'next/link';
import { Header } from '@/components/ui/Header';
import { Footer } from '@/components/ui/Footer';
import { Shield, Home, Users, DollarSign, FileText, Calculator } from 'lucide-react';

// Type definitions
interface LocationData {
  name: string;
  slug: string;
  description: string;
  benefits: string[];
  cities?: string[];
  statistics?: {
    medianPrice?: string;
    growthRate?: string;
    population?: string;
  };
}

// Generate static params for all states and cities
export async function generateStaticParams() {
  const stateParams = Object.keys(stateData).map(slug => ({ location: slug }));
  const cityParams = Object.keys(cityData).map(slug => ({ location: slug }));
  return [...stateParams, ...cityParams];
}

// Get location data based on slug
function getLocationData(slug: string): LocationData | null {
  // Check if it's a state
  if (stateData[slug]) {
    return stateData[slug];
  }
  // Check if it's a city
  if (cityData[slug]) {
    return cityData[slug];
  }
  return null;
}

// Generate metadata for SEO
export async function generateMetadata({ params }: { params: { location: string } }): Promise<Metadata> {
  const location = getLocationData(params.location);
  
  if (!location) {
    return {
      title: 'Location Not Found | OwnerFi',
      description: 'The location you are looking for was not found.',
    };
  }

  const isState = !!stateData[params.location];
  const locationType = isState ? 'State' : 'City';
  
  return {
    title: `Owner Financing ${location.name} | Seller Financed Homes in ${location.name} | OwnerFi`,
    description: `Find owner financed homes in ${location.name}. Browse seller financing properties with flexible terms, no bank qualifying, and fast closings. Start your homeownership journey today!`,
    keywords: [
      `owner financing ${location.name}`,
      `seller financing ${location.name}`,
      `rent to own ${location.name}`,
      `owner financed homes ${location.name}`,
      `no bank financing ${location.name}`,
      `creative financing ${location.name}`,
      `contract for deed ${location.name}`,
      `lease purchase ${location.name}`,
    ].join(', '),
    openGraph: {
      title: `Owner Financed Homes in ${location.name} | OwnerFi`,
      description: location.description,
      url: `https://ownerfi.ai/owner-financing-${params.location}`,
      siteName: 'OwnerFi',
      images: [
        {
          url: '/og-image.png',
          width: 1200,
          height: 630,
          alt: `Owner financing homes in ${location.name}`,
        },
      ],
      locale: 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `Owner Financing in ${location.name}`,
      description: location.description,
      images: ['/og-image.png'],
    },
    alternates: {
      canonical: `https://ownerfi.ai/owner-financing-${params.location}`,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
  };
}

export default function OwnerFinancingLocationPage({ params }: { params: { location: string } }) {
  const location = getLocationData(params.location);
  
  if (!location) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="container mx-auto px-4 py-16">
          <h1 className="text-4xl font-bold mb-4">Location Not Found</h1>
          <p className="text-gray-600 mb-8">The location you are looking for was not found.</p>
          <Link href="/" className="text-blue-600 hover:underline">
            Return to Home
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  const isState = !!stateData[params.location];
  const locationType = isState ? 'State' : 'City';

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-900 to-blue-700 text-white py-20">
        <div className="container mx-auto px-4">
          <h1 className="text-5xl font-bold mb-6">
            Owner Financing in {location.name}
          </h1>
          <p className="text-xl mb-8 max-w-3xl">
            {location.description}
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href={`/dashboard/setup?city=${location.name}&state=${isState ? location.name : ''}`}
              className="bg-white text-blue-900 px-8 py-4 rounded-lg font-semibold hover:bg-gray-100 transition text-center"
            >
              Browse Properties
            </Link>
            <Link
              href="/how-owner-finance-works"
              className="border-2 border-white text-white px-8 py-4 rounded-lg font-semibold hover:bg-white hover:text-blue-900 transition text-center"
            >
              How It Works
            </Link>
          </div>
        </div>
      </section>

      {/* Statistics Section (if available) */}
      {location.statistics && (
        <section className="py-12 bg-white">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {location.statistics.medianPrice && (
                <div className="text-center">
                  <DollarSign className="w-12 h-12 mx-auto mb-4 text-blue-600" />
                  <h3 className="text-2xl font-bold">{location.statistics.medianPrice}</h3>
                  <p className="text-gray-600">Median Home Price</p>
                </div>
              )}
              {location.statistics.growthRate && (
                <div className="text-center">
                  <Users className="w-12 h-12 mx-auto mb-4 text-blue-600" />
                  <h3 className="text-2xl font-bold">{location.statistics.growthRate}</h3>
                  <p className="text-gray-600">Annual Growth Rate</p>
                </div>
              )}
              {location.statistics.population && (
                <div className="text-center">
                  <Home className="w-12 h-12 mx-auto mb-4 text-blue-600" />
                  <h3 className="text-2xl font-bold">{location.statistics.population}</h3>
                  <p className="text-gray-600">Population</p>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Benefits Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold mb-12 text-center">
            Benefits of Owner Financing in {location.name}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {location.benefits.map((benefit, index) => (
              <div key={index} className="bg-white p-6 rounded-lg shadow-md">
                <Shield className="w-10 h-10 mb-4 text-blue-600" />
                <h3 className="text-xl font-semibold mb-2">{benefit}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cities Section (for states) */}
      {isState && location.cities && location.cities.length > 0 && (
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <h2 className="text-4xl font-bold mb-12 text-center">
              Popular Cities in {location.name}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {location.cities.map((city, index) => (
                <Link
                  key={index}
                  href={`/owner-financing/${city.toLowerCase().replace(/\s+/g, '-')}`}
                  className="bg-gray-50 p-4 rounded-lg hover:bg-blue-50 transition text-center"
                >
                  {city}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* How It Works Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold mb-12 text-center">
            How Owner Financing Works in {location.name}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-blue-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                <FileText className="w-10 h-10 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">1. Find Your Property</h3>
              <p className="text-gray-600">
                Browse our selection of owner-financed homes in {location.name}
              </p>
            </div>
            <div className="text-center">
              <div className="bg-blue-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                <Calculator className="w-10 h-10 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">2. Negotiate Terms</h3>
              <p className="text-gray-600">
                Work directly with sellers to agree on price, down payment, and monthly payments
              </p>
            </div>
            <div className="text-center">
              <div className="bg-blue-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                <Home className="w-10 h-10 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">3. Move In</h3>
              <p className="text-gray-600">
                Close quickly without bank delays and start building equity immediately
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-blue-900 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-6">
            Ready to Find Your Home in {location.name}?
          </h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto">
            Join thousands of happy homeowners who found their dream homes through owner financing.
          </p>
          <Link
            href={`/dashboard/setup?city=${location.name}&state=${isState ? location.name : ''}`}
            className="bg-white text-blue-900 px-8 py-4 rounded-lg font-semibold hover:bg-gray-100 transition inline-block"
          >
            Start Browsing Properties
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}