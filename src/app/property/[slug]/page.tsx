import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import { getPropertyBySlug, getAllPropertySlugs } from '@/lib/property-seo';
import { US_STATES } from '@/lib/us-states';
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
      robots: { index: false, follow: true },
    };
  }

  // Sold properties get noindex so Google de-indexes them — we keep the
  // Firestore doc to serve a friendly "sold" page for bookmarks, but the
  // page itself should not compete for search traffic.
  const propertyStatus = (property as unknown as { status?: string }).status;
  const homeStatus = ((property as unknown as { homeStatus?: string }).homeStatus || '').toUpperCase();
  const isSold = propertyStatus === 'sold' || homeStatus === 'SOLD' || homeStatus === 'RECENTLY_SOLD';
  if (isSold) {
    return {
      title: `${property.address}, ${property.city} ${property.state} — Sold | Ownerfi`,
      description: `${property.address} in ${property.city}, ${property.state} is no longer available. Browse other owner-financed properties on Ownerfi.`,
      robots: { index: false, follow: true },
    };
  }

  // Title: Keep under 60 chars for Google
  // Adapt to deal type
  const isCashOnly = property.isCashDeal && !property.isOwnerfinance && property.dealType !== 'owner_finance' && property.dealType !== 'both';
  const shortAddress = property.address?.length > 25
    ? property.address.substring(0, 22) + '...'
    : property.address;
  const title = isCashOnly
    ? `${shortAddress}, ${property.city} ${property.state} | Cash Deal`
    : `${shortAddress}, ${property.city} ${property.state} | Owner Finance`;

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
  const isCashOnly = property.isCashDeal && !property.isOwnerfinance && property.dealType !== 'owner_finance' && property.dealType !== 'both';

  // Keep under 160 characters for Google
  let desc = `${beds} bed, ${baths} bath home in ${city}, ${state}`;

  if (price) {
    desc += ` for $${price.toLocaleString()}`;
  }

  if (isCashOnly) {
    desc += `. Cash deal — strong investment opportunity. Quick close available.`;
  } else if (property.monthlyPayment) {
    desc += `. $${property.monthlyPayment.toLocaleString()}/mo owner financing`;
    desc += `. No bank qualifying. Bad credit OK.`;
  } else {
    desc += `. Owner financing available. No bank qualifying.`;
  }

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

  // Sold properties are kept in Firestore (not deleted) so bookmarks + indexed
  // search results land on a friendly "sold" page instead of a 404. Render a
  // minimal notice and guide the visitor back to active listings.
  const propertyStatus = (property as unknown as { status?: string }).status;
  const homeStatus = ((property as unknown as { homeStatus?: string }).homeStatus || '').toUpperCase();
  const isSold = propertyStatus === 'sold' || homeStatus === 'SOLD' || homeStatus === 'RECENTLY_SOLD';
  if (isSold) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-slate-800/60 border border-slate-700 rounded-2xl p-8 text-center">
          <div className="inline-block px-3 py-1 rounded-full bg-slate-700 text-slate-300 text-xs font-semibold tracking-wider mb-4">
            NO LONGER AVAILABLE
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-3">
            This property has sold
          </h1>
          <p className="text-slate-300 mb-6">
            {property.address}, {property.city}, {property.state} is no longer on the market.
            Browse other owner-financed properties and we&apos;ll help you find a similar one.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-[#00BC7D] hover:bg-[#00d68f] text-white font-semibold transition-colors"
            >
              Browse Available Homes
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-semibold transition-colors"
            >
              Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const imageUrl = property.imageUrls?.[0] || property.firstPropertyImage || '/placeholder-house.jpg';
  const price = property.listPrice || property.price || 0;

  // Determine deal type
  const isOF = property.isOwnerfinance || property.dealType === 'owner_finance' || property.dealType === 'both';
  const isCash = property.isCashDeal || property.dealType === 'cash_deal' || property.dealType === 'both';
  const isCashOnly = isCash && !isOF;

  // Calculate investment metrics for cash deals
  const zestimate = (property as any).zestimate || (property as any).estimatedValue;
  const arvPercent = price && zestimate && zestimate > 0 ? Math.round((price / zestimate) * 100) : null;

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
              <svg width="28" height="28" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="lg" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse"><stop offset="0%" stopColor="#00BC7D"/><stop offset="100%" stopColor="#3B82F6"/></linearGradient></defs><circle cx="50" cy="50" r="45" stroke="url(#lg)" strokeWidth="7" fill="none"/><ellipse cx="50" cy="50" rx="42" ry="22" stroke="url(#lg)" strokeWidth="5.5" fill="none" transform="rotate(-25 50 50)"/><ellipse cx="50" cy="50" rx="22" ry="42" stroke="url(#lg)" strokeWidth="5.5" fill="none" transform="rotate(-25 50 50)"/></svg>
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
                {(() => {
                  const stateCode = property.state?.toUpperCase();
                  const stateName = US_STATES.find(s => s.code === stateCode)?.name;
                  const stateSlug = stateName?.toLowerCase().replace(/\s+/g, '-');
                  return stateSlug ? (
                    <Link
                      href={`/owner-financing-${stateSlug}`}
                      className="hover:text-[#00BC7D] transition-colors"
                    >
                      {stateName}
                    </Link>
                  ) : (
                    <span>{property.state}</span>
                  );
                })()}
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
                  alt={`${property.address}, ${property.city} ${property.state} - ${isCashOnly ? 'Cash Deal' : 'Owner Finance Home'}`}
                  priority
                  address={property.address}
                  city={property.city}
                  state={property.state}
                />
                <div className="absolute top-4 left-4 flex gap-2">
                  {isOF && (
                    <span className="bg-amber-500 text-white px-3 py-1.5 rounded-full text-sm font-bold shadow-lg">
                      Owner Finance
                    </span>
                  )}
                  {isCash && (
                    <span className="bg-emerald-500 text-white px-3 py-1.5 rounded-full text-sm font-bold shadow-lg">
                      Cash Deal
                    </span>
                  )}
                  {!isOF && !isCash && (
                    <span className="bg-[#00BC7D] text-white px-3 py-1.5 rounded-full text-sm font-bold shadow-lg">
                      Available
                    </span>
                  )}
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

                {/* OWNER FINANCE SECTION — only shown for OF properties */}
                {isOF && (
                  <>
                    <div className="space-y-4 mb-6">
                      <h3 className="font-bold text-amber-400 text-lg">Owner Financing Terms</h3>

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

                    {/* OF Benefits */}
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 mb-6">
                      <h4 className="font-bold text-amber-400 mb-3">Why Owner Financing?</h4>
                      <ul className="space-y-2 text-sm text-slate-300">
                        <li className="flex items-center gap-2">
                          <span className="text-amber-400">✓</span> No bank qualifying
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="text-amber-400">✓</span> Bad credit OK
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="text-amber-400">✓</span> Fast closing
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="text-amber-400">✓</span> Flexible terms
                        </li>
                      </ul>
                    </div>
                  </>
                )}

                {/* CASH DEAL SECTION — only shown for cash properties */}
                {isCash && (
                  <>
                    <div className="space-y-4 mb-6">
                      <h3 className="font-bold text-emerald-400 text-lg">Investment Metrics</h3>

                      {zestimate && zestimate > 0 && (
                        <div className="flex justify-between items-center py-2 border-b border-slate-700">
                          <span className="text-slate-400">Estimated Value (ARV)</span>
                          <span className="text-white font-bold">${zestimate.toLocaleString()}</span>
                        </div>
                      )}

                      {arvPercent && (
                        <div className="flex justify-between items-center py-2 border-b border-slate-700">
                          <span className="text-slate-400">% of ARV</span>
                          <span className={`font-bold ${
                            arvPercent <= 70 ? 'text-emerald-400' :
                            arvPercent <= 85 ? 'text-yellow-400' :
                            'text-red-400'
                          }`}>
                            {arvPercent}%
                          </span>
                        </div>
                      )}

                      {property.discountPercent && (
                        <div className="flex justify-between items-center py-2 border-b border-slate-700">
                          <span className="text-slate-400">Discount</span>
                          <span className="text-emerald-400 font-bold">{property.discountPercent}% below market</span>
                        </div>
                      )}

                      {property.rentEstimate && (
                        <div className="flex justify-between items-center py-2 border-b border-slate-700">
                          <span className="text-slate-400">Rent Estimate</span>
                          <span className="text-white font-bold">${property.rentEstimate.toLocaleString()}/mo</span>
                        </div>
                      )}

                      {property.annualTax && (
                        <div className="flex justify-between items-center py-2 border-b border-slate-700">
                          <span className="text-slate-400">Annual Tax</span>
                          <span className="text-white font-bold">${property.annualTax.toLocaleString()}</span>
                        </div>
                      )}
                    </div>

                    {/* Cash Deal Benefits */}
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 mb-6">
                      <h4 className="font-bold text-emerald-400 mb-3">Why This Cash Deal?</h4>
                      <ul className="space-y-2 text-sm text-slate-300">
                        {arvPercent && arvPercent <= 80 && (
                          <li className="flex items-center gap-2">
                            <span className="text-emerald-400">✓</span> Below market value ({arvPercent}% of ARV)
                          </li>
                        )}
                        <li className="flex items-center gap-2">
                          <span className="text-emerald-400">✓</span> Strong investment opportunity
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="text-emerald-400">✓</span> Quick close possible
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="text-emerald-400">✓</span> Ideal for flips or rentals
                        </li>
                      </ul>
                    </div>
                  </>
                )}

                {/* Fallback if no deal type determined — show generic */}
                {!isOF && !isCash && (
                  <div className="bg-[#004D33]/30 rounded-lg p-4 mb-6">
                    <h4 className="font-bold text-[#00BC7D] mb-3">Property Highlights</h4>
                    <ul className="space-y-2 text-sm text-slate-300">
                      <li className="flex items-center gap-2">
                        <span className="text-[#00BC7D]">✓</span> Available for purchase
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-[#00BC7D]">✓</span> Flexible terms possible
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-[#00BC7D]">✓</span> Fast closing
                      </li>
                    </ul>
                  </div>
                )}

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

          {/* FAQ Section for SEO — adapts to deal type */}
          <section className="mt-16 bg-slate-800/50 rounded-xl p-8">
            <h2 className="text-2xl font-bold text-white mb-6">
              {isCashOnly
                ? `Frequently Asked Questions About Cash Deals in ${property.city}`
                : `Frequently Asked Questions About Owner Financing in ${property.city}`
              }
            </h2>
            <div className="space-y-6">
              {isOF && (
                <>
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
                </>
              )}
              {isCashOnly && (
                <>
                  <FAQItem
                    question={`Why is ${property.address} a good cash deal?`}
                    answer={arvPercent
                      ? `This property is listed at ${arvPercent}% of its estimated market value, making it a strong investment opportunity in ${property.city}, ${property.state}. Cash deals like this are ideal for investors looking to flip or hold as a rental.`
                      : `This property in ${property.city}, ${property.state} is available as a cash deal, offering investors a quick-close opportunity with potential for strong returns through flipping or renting.`
                    }
                  />
                  <FAQItem
                    question="What makes a good cash deal investment?"
                    answer="A strong cash deal typically offers a price significantly below the after-repair value (ARV). Properties at 70-80% of ARV or below give investors room for rehab costs and profit. Location, condition, and rental potential are key factors."
                  />
                  <FAQItem
                    question={`Can I finance this ${property.city} property?`}
                    answer="This property is listed as a cash deal, meaning the seller prefers a cash purchase for a faster closing. However, you may be able to use hard money or private lending to fund the purchase. Sign up to discuss options."
                  />
                </>
              )}
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="mt-16 border-t border-slate-700/50 py-8">
          <div className="max-w-7xl mx-auto px-4 text-center text-slate-400 text-sm">
            <p>&copy; {new Date().getFullYear()} Ownerfi. All rights reserved.</p>
            <p className="mt-2">
              {isCashOnly
                ? `Cash deal investment properties in ${property.city}, ${property.state} and nationwide.`
                : `Owner financing homes in ${property.city}, ${property.state} and nationwide.`
              }
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
