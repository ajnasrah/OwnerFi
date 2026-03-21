import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import { getPropertyBySlug, getAllPropertySlugs } from '@/lib/property-seo';
import PropertyJsonLd from './PropertyJsonLd';
import PropertyDetails from './PropertyDetails';
import PropertyImage from './PropertyImage';
import InvestorNav from './InvestorNav';

interface PageProps {
  params: Promise<{ slug: string }>;
}

// Revalidate pages every hour for fresh data
export const revalidate = 3600;

// Allow pages not in generateStaticParams to be generated on-demand
export const dynamicParams = true;

// Generate static params for all properties (ISR)
// Limit to prevent build timeout - remaining pages generated on-demand
export async function generateStaticParams() {
  const slugs = await getAllPropertySlugs();
  // Pre-generate first 500 pages, rest will be generated on-demand
  return slugs.slice(0, 500).map((slug) => ({ slug }));
}

// Generate SEO metadata for each property
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const property = await getPropertyBySlug(slug);

  if (!property) {
    return {
      title: 'Property Not Found | Ownerfi',
      description: 'This property listing is no longer available.',
    };
  }

  // Title: Keep under 60 chars for Google
  // Format: "123 Main St, Memphis TN | Owner Finance | Ownerfi"
  const shortAddress = property.address?.length > 25
    ? property.address.substring(0, 22) + '...'
    : property.address;
  const title = `${shortAddress}, ${property.city} ${property.state} | Owner Finance`;

  const description = generateMetaDescription(property);

  // Use property image, or Google Street View as fallback for OG images
  let imageUrl = property.imageUrls?.[0] || property.firstPropertyImage;
  if (!imageUrl) {
    const fullAddress = `${property.address}, ${property.city}, ${property.state}`;
    const googleApiKey = process.env.GOOGLE_MAPS_API_KEY || '';
    if (googleApiKey) {
      imageUrl = `https://maps.googleapis.com/maps/api/streetview?size=1200x630&location=${encodeURIComponent(fullAddress)}&key=${googleApiKey}`;
    } else {
      imageUrl = 'https://ownerfi.ai/placeholder-house.jpg';
    }
  }

  const canonicalUrl = `https://ownerfi.ai/property/${slug}`;

  return {
    title,
    description,
    keywords: [
      'owner financing',
      'seller financing',
      `${property.city} homes`,
      `${property.state} owner finance`,
      'no bank qualifying',
      'rent to own',
      `${property.bedrooms} bedroom home`,
      property.city,
      property.state,
    ].join(', '),
    authors: [{ name: 'Ownerfi' }],
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: 'Ownerfi',
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: `${property.address} - Owner Finance Home`,
        },
      ],
      locale: 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
    },
    alternates: {
      canonical: canonicalUrl,
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

function generateMetaDescription(property: any): string {
  const beds = property.bedrooms || '?';
  const baths = property.bathrooms || '?';
  const city = property.city || '';
  const state = property.state || '';
  const price = property.listPrice || property.price;

  // Keep under 160 characters for Google
  let desc = `${beds} bed, ${baths} bath home in ${city}, ${state}`;

  if (price) {
    desc += ` for $${price.toLocaleString()}`;
  }

  if (property.monthlyPayment) {
    desc += `. $${property.monthlyPayment.toLocaleString()}/mo owner financing`;
  } else {
    desc += `. Owner financing available`;
  }

  desc += `. No bank qualifying. Bad credit OK.`;

  // Truncate if over 160 chars
  if (desc.length > 160) {
    desc = desc.substring(0, 157) + '...';
  }

  return desc;
}

export default async function PropertyPage({ params }: PageProps) {
  const { slug } = await params;
  const property = await getPropertyBySlug(slug);

  if (!property) {
    notFound();
  }

  const imageUrl = property.imageUrls?.[0] || property.firstPropertyImage || '/placeholder-house.jpg';
  const price = property.listPrice || property.price || 0;

  return (
    <>
      {/* JSON-LD Structured Data for Google */}
      <PropertyJsonLd property={property} slug={slug} />

      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        {/* Investor navigation bar (shown when coming from deal alert SMS) */}
        <Suspense fallback={null}>
          <InvestorNav />
        </Suspense>

        {/* Header */}
        <header className="sticky top-0 z-50 bg-[#111625]/95 backdrop-blur-lg border-b border-slate-700/50">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <img src="/logo.jpg" alt="Ownerfi" width={32} height={32} className="rounded-lg" />
              <span className="font-bold text-white text-xl">Ownerfi</span>
            </Link>
            <Link
              href="/auth"
              className="bg-[#00BC7D]/50 hover:bg-[#00BC7D] text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors"
            >
              Sign Up Free
            </Link>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 py-8">
          {/* Breadcrumb - Links to existing state pages */}
          <nav className="mb-6" aria-label="Breadcrumb">
            <ol className="flex items-center space-x-2 text-sm text-slate-400">
              <li>
                <Link href="/" className="hover:text-[#00BC7D] transition-colors">Home</Link>
              </li>
              <li>/</li>
              <li>
                <Link
                  href={`/owner-financing-${property.state?.toLowerCase().replace(/\s+/g, '-')}`}
                  className="hover:text-[#00BC7D] transition-colors"
                >
                  {property.state}
                </Link>
              </li>
              <li>/</li>
              <li className="text-white truncate max-w-[200px]" title={property.address}>
                {property.address}
              </li>
            </ol>
          </nav>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Left Column - Images & Details */}
            <div className="lg:col-span-2 space-y-6">
              {/* Property Image */}
              <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-800">
                <PropertyImage
                  src={imageUrl}
                  alt={`${property.address}, ${property.city} ${property.state} - Owner Finance Home`}
                  priority
                  address={property.address}
                  city={property.city}
                  state={property.state}
                />
                <div className="absolute top-4 left-4">
                  <span className="bg-[#00BC7D] text-white px-3 py-1.5 rounded-full text-sm font-bold shadow-lg">
                    Owner Finance Available
                  </span>
                </div>
              </div>

              {/* Property Title & Address */}
              <div>
                <h1 className="text-3xl md:text-4xl font-black text-white mb-2">
                  {property.address}
                </h1>
                <p className="text-xl text-slate-300">
                  {property.city}, {property.state} {property.zipCode}
                </p>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard icon="🛏️" value={property.bedrooms || '—'} label="Bedrooms" />
                <StatCard icon="🚿" value={property.bathrooms || '—'} label="Bathrooms" />
                <StatCard icon="📏" value={property.squareFeet?.toLocaleString() || '—'} label="Sq Ft" />
                <StatCard icon="📅" value={property.yearBuilt || '—'} label="Year Built" />
              </div>

              {/* Description */}
              {property.description && (
                <div className="bg-slate-800/50 rounded-xl p-6">
                  <h2 className="text-xl font-bold text-white mb-4">About This Property</h2>
                  <p className="text-slate-300 leading-relaxed whitespace-pre-line">
                    {property.description}
                  </p>
                </div>
              )}

              {/* Property Details */}
              <PropertyDetails property={property} />
            </div>

            {/* Right Column - Pricing & CTA */}
            <div className="lg:col-span-1">
              <div className="sticky top-24 bg-slate-800/90 backdrop-blur-lg border border-slate-700/50 rounded-2xl p-6 shadow-2xl">
                {/* Price */}
                <div className="mb-6">
                  <p className="text-slate-400 text-sm mb-1">Listed Price</p>
                  <p className="text-4xl font-black text-white">
                    ${price.toLocaleString()}
                  </p>
                </div>

                {/* Owner Financing Terms */}
                <div className="space-y-4 mb-6">
                  <h3 className="font-bold text-[#00BC7D] text-lg">Owner Financing Terms</h3>

                  {property.downPaymentAmount && (
                    <div className="flex justify-between items-center py-2 border-b border-slate-700">
                      <span className="text-slate-400">Down Payment</span>
                      <span className="text-white font-bold">
                        ${property.downPaymentAmount.toLocaleString()}
                        {property.downPaymentPercent && (
                          <span className="text-slate-400 font-normal ml-1">
                            ({property.downPaymentPercent}%)
                          </span>
                        )}
                      </span>
                    </div>
                  )}

                  {property.monthlyPayment && (
                    <div className="flex justify-between items-center py-2 border-b border-slate-700">
                      <span className="text-slate-400">Monthly Payment</span>
                      <span className="text-white font-bold">${property.monthlyPayment.toLocaleString()}/mo</span>
                    </div>
                  )}

                  {property.interestRate && (
                    <div className="flex justify-between items-center py-2 border-b border-slate-700">
                      <span className="text-slate-400">Interest Rate</span>
                      <span className="text-white font-bold">{property.interestRate}%</span>
                    </div>
                  )}

                  {property.termYears && (
                    <div className="flex justify-between items-center py-2 border-b border-slate-700">
                      <span className="text-slate-400">Loan Term</span>
                      <span className="text-white font-bold">{property.termYears} years</span>
                    </div>
                  )}

                  {property.balloonYears && (
                    <div className="flex justify-between items-center py-2 border-b border-slate-700">
                      <span className="text-slate-400">Balloon</span>
                      <span className="text-white font-bold">{property.balloonYears} years</span>
                    </div>
                  )}
                </div>

                {/* Benefits */}
                <div className="bg-[#004D33]/30 rounded-lg p-4 mb-6">
                  <h4 className="font-bold text-[#00BC7D] mb-3">Why Owner Financing?</h4>
                  <ul className="space-y-2 text-sm text-slate-300">
                    <li className="flex items-center gap-2">
                      <span className="text-[#00BC7D]">✓</span> No bank qualifying
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-[#00BC7D]">✓</span> Bad credit OK
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-[#00BC7D]">✓</span> Fast closing
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-[#00BC7D]">✓</span> Flexible terms
                    </li>
                  </ul>
                </div>

                {/* CTA Button */}
                <Link
                  href={`/auth?property=${slug}`}
                  className="block w-full bg-gradient-to-r from-[#00BC7D] to-[#009B66] hover:from-[#00BC7D] hover:to-[#009B66] text-white py-4 px-6 rounded-xl font-bold text-lg text-center shadow-xl hover:shadow-2xl transform hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  Get More Details
                </Link>
                <p className="text-center text-slate-400 text-xs mt-3">
                  Free account - No credit card required
                </p>
              </div>
            </div>
          </div>

          {/* FAQ Section for SEO */}
          <section className="mt-16 bg-slate-800/50 rounded-xl p-8">
            <h2 className="text-2xl font-bold text-white mb-6">
              Frequently Asked Questions About Owner Financing in {property.city}
            </h2>
            <div className="space-y-6">
              <FAQItem
                question={`What is owner financing for ${property.address}?`}
                answer={`Owner financing means the seller of ${property.address} acts as the lender. Instead of getting a mortgage from a bank, you make monthly payments directly to the property owner. This property in ${property.city}, ${property.state} is available with owner financing terms.`}
              />
              <FAQItem
                question="Do I need good credit for owner financing?"
                answer="No! One of the biggest advantages of owner financing is that you typically don't need to qualify through a bank. This makes it possible to buy a home even with bad credit, no credit history, or self-employment income that's hard to document."
              />
              <FAQItem
                question={`How much is the down payment for this ${property.city} home?`}
                answer={property.downPaymentAmount
                  ? `The down payment for this property is $${property.downPaymentAmount.toLocaleString()}${property.downPaymentPercent ? ` (${property.downPaymentPercent}% of the purchase price)` : ''}. Contact us to discuss flexible down payment options.`
                  : `Down payment terms are negotiable. Sign up for free to get the specific financing details for this ${property.city} property.`
                }
              />
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="mt-16 border-t border-slate-700/50 py-8">
          <div className="max-w-7xl mx-auto px-4 text-center text-slate-400 text-sm">
            <p>&copy; {new Date().getFullYear()} Ownerfi. All rights reserved.</p>
            <p className="mt-2">
              Owner financing homes in {property.city}, {property.state} and nationwide.
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}

function StatCard({ icon, value, label }: { icon: string; value: string | number; label: string }) {
  return (
    <div className="bg-slate-800/50 rounded-xl p-4 text-center">
      <span className="text-2xl mb-2 block">{icon}</span>
      <p className="text-xl font-bold text-white">{value}</p>
      <p className="text-slate-400 text-sm">{label}</p>
    </div>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-white mb-2">{question}</h3>
      <p className="text-slate-300">{answer}</p>
    </div>
  );
}
