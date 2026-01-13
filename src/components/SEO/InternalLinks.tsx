import Link from 'next/link';

// Component for state-to-state internal linking
interface StateLinksProps {
  currentState?: string;
  className?: string;
}

export function StateLinks({ currentState, className = "" }: StateLinksProps) {
  const states = [
    { name: 'Texas', slug: 'texas' },
    { name: 'Florida', slug: 'florida' },
    { name: 'Georgia', slug: 'georgia' },
    { name: 'California', slug: 'california' },
    { name: 'New York', slug: 'new-york' },
    { name: 'Arizona', slug: 'arizona' },
    { name: 'North Carolina', slug: 'north-carolina' },
    { name: 'Virginia', slug: 'virginia' },
    { name: 'Illinois', slug: 'illinois' },
    { name: 'Ohio', slug: 'ohio' }
  ];

  const filteredStates = states.filter(state => state.slug !== currentState);

  return (
    <div className={`space-y-2 ${className}`}>
      <h3 className="text-lg font-semibold mb-3">Owner Financing by State</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
        {filteredStates.map((state) => (
          <Link
            key={state.slug}
            href={`/owner-financing-${state.slug}`}
            className="text-blue-600 hover:text-blue-800 hover:underline text-sm"
          >
            {state.name}
          </Link>
        ))}
      </div>
    </div>
  );
}

// Component for city internal linking
interface CityLinksProps {
  currentCity?: string;
  className?: string;
}

export function CityLinks({ currentCity, className = "" }: CityLinksProps) {
  const cities = [
    { name: 'New York City', slug: 'new-york-city' },
    { name: 'Los Angeles', slug: 'los-angeles' },
    { name: 'Chicago', slug: 'chicago' },
    { name: 'Houston', slug: 'houston' },
    { name: 'Phoenix', slug: 'phoenix' },
    { name: 'Philadelphia', slug: 'philadelphia' },
    { name: 'San Antonio', slug: 'san-antonio' },
    { name: 'San Diego', slug: 'san-diego' },
    { name: 'Dallas', slug: 'dallas' },
    { name: 'Austin', slug: 'austin' }
  ];

  const filteredCities = cities.filter(city => city.slug !== currentCity);

  return (
    <div className={`space-y-2 ${className}`}>
      <h3 className="text-lg font-semibold mb-3">Owner Financing by City</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
        {filteredCities.map((city) => (
          <Link
            key={city.slug}
            href={`/${city.slug}-owner-financing`}
            className="text-blue-600 hover:text-blue-800 hover:underline text-sm"
          >
            {city.name}
          </Link>
        ))}
      </div>
    </div>
  );
}

// Component for keyword page internal linking
interface KeywordLinksProps {
  currentPage?: string;
  className?: string;
}

export function KeywordLinks({ currentPage, className = "" }: KeywordLinksProps) {
  const keywords = [
    { name: 'Rent to Own Homes', slug: 'rent-to-own-homes', description: 'Flexible lease-to-own options' },
    { name: 'Bad Credit Home Buying', slug: 'bad-credit-home-buying', description: 'Solutions for poor credit' },
    { name: 'No Credit Check Homes', slug: 'no-credit-check-homes', description: 'Buy without credit approval' }
  ];

  const filteredKeywords = keywords.filter(keyword => keyword.slug !== currentPage);

  return (
    <div className={`space-y-2 ${className}`}>
      <h3 className="text-lg font-semibold mb-3">Alternative Financing Options</h3>
      <div className="space-y-3">
        {filteredKeywords.map((keyword) => (
          <Link
            key={keyword.slug}
            href={`/${keyword.slug}`}
            className="block p-3 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
          >
            <div className="font-medium text-blue-600 hover:text-blue-800">
              {keyword.name}
            </div>
            <div className="text-sm text-gray-600">
              {keyword.description}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

// Comprehensive footer with all important links
export function SEOFooter() {
  return (
    <footer className="bg-gray-900 text-white py-12 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Company */}
          <div>
            <h3 className="text-lg font-semibold mb-4">OwnerFi</h3>
            <ul className="space-y-2">
              <li><Link href="/about" className="hover:text-blue-400">About Us</Link></li>
              <li><Link href="/contact" className="hover:text-blue-400">Contact</Link></li>
              <li><Link href="/how-owner-finance-works" className="hover:text-blue-400">How It Works</Link></li>
              <li><Link href="/realtor-dashboard" className="hover:text-blue-400">For Realtors</Link></li>
            </ul>
          </div>

          {/* Top States */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Popular States</h3>
            <ul className="space-y-2">
              <li><Link href="/owner-financing-texas" className="hover:text-blue-400">Texas</Link></li>
              <li><Link href="/owner-financing-florida" className="hover:text-blue-400">Florida</Link></li>
              <li><Link href="/owner-financing-california" className="hover:text-blue-400">California</Link></li>
              <li><Link href="/owner-financing-georgia" className="hover:text-blue-400">Georgia</Link></li>
              <li><Link href="/owner-financing-new-york" className="hover:text-blue-400">New York</Link></li>
            </ul>
          </div>

          {/* Top Cities */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Popular Cities</h3>
            <ul className="space-y-2">
              <li><Link href="/houston-owner-financing" className="hover:text-blue-400">Houston</Link></li>
              <li><Link href="/los-angeles-owner-financing" className="hover:text-blue-400">Los Angeles</Link></li>
              <li><Link href="/chicago-owner-financing" className="hover:text-blue-400">Chicago</Link></li>
              <li><Link href="/phoenix-owner-financing" className="hover:text-blue-400">Phoenix</Link></li>
              <li><Link href="/dallas-owner-financing" className="hover:text-blue-400">Dallas</Link></li>
            </ul>
          </div>

          {/* Financing Options */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Financing Options</h3>
            <ul className="space-y-2">
              <li><Link href="/rent-to-own-homes" className="hover:text-blue-400">Rent to Own</Link></li>
              <li><Link href="/bad-credit-home-buying" className="hover:text-blue-400">Bad Credit Solutions</Link></li>
              <li><Link href="/no-credit-check-homes" className="hover:text-blue-400">No Credit Check</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom section */}
        <div className="border-t border-gray-800 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
          <div className="text-sm text-gray-400">
            © 2024 OwnerFi. All rights reserved.
          </div>
          <div className="flex space-x-6 mt-4 md:mt-0">
            <Link href="/privacy" className="text-sm text-gray-400 hover:text-blue-400">Privacy Policy</Link>
            <Link href="/terms" className="text-sm text-gray-400 hover:text-blue-400">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

// Breadcrumb component
interface BreadcrumbProps {
  items: Array<{
    name: string;
    href?: string;
  }>;
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav className="flex mb-6" aria-label="Breadcrumb">
      <ol className="inline-flex items-center space-x-1 md:space-x-3">
        {items.map((item, index) => (
          <li key={index} className="inline-flex items-center">
            {index > 0 && (
              <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            )}
            {item.href ? (
              <Link href={item.href} className="text-blue-600 hover:text-blue-800">
                {item.name}
              </Link>
            ) : (
              <span className="text-gray-500">{item.name}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}