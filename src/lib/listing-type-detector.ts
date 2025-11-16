/**
 * Listing Type Detector
 *
 * Detects different types of property listings:
 * - Regular Sale
 * - Rent-to-Own / Lease-to-Own
 * - For Rent
 */

export interface ListingTypeResult {
  type: 'SALE' | 'RENT_TO_OWN' | 'FOR_RENT';
  displayPriceLabel: string;
  isSuspiciouslyLow: boolean;
  warnings: string[];
}

// Keywords that indicate rent-to-own / lease-to-own
const RENT_TO_OWN_KEYWORDS = [
  /rent\s*to\s*own/i,
  /lease\s*to\s*own/i,
  /lease\s*option/i,
  /lease\s*purchase/i,
  /rent.*option.*buy/i,
  /lease.*option.*purchase/i,
];

// Keywords that indicate for rent
const FOR_RENT_KEYWORDS = [
  /for\s*rent/i,
  /rental\s*property/i,
  /monthly\s*rent/i,
  /available\s*for\s*rent/i,
];

/**
 * Detect the type of listing and how to display the price
 */
export function detectListingType(property: {
  price?: number;
  homeStatus?: string;
  description?: string;
  buildingType?: string;
  rentEstimate?: number;
}): ListingTypeResult {
  const { price, homeStatus, description, rentEstimate } = property;
  const warnings: string[] = [];

  // Check homeStatus first
  if (homeStatus === 'FOR_RENT') {
    return {
      type: 'FOR_RENT',
      displayPriceLabel: 'Monthly Rent',
      isSuspiciouslyLow: false,
      warnings: ['This property is for rent, not for sale'],
    };
  }

  // Check description for rent-to-own keywords
  const descLower = (description || '').toLowerCase();
  const isRentToOwn = RENT_TO_OWN_KEYWORDS.some(pattern => pattern.test(description || ''));
  const isForRent = FOR_RENT_KEYWORDS.some(pattern => pattern.test(description || ''));

  // Detect suspiciously low prices that might be monthly rent
  // If price is < $10,000 and there's a rent estimate that's close to the price
  const isSuspiciouslyLow = price && price < 10000;

  if (isSuspiciouslyLow) {
    // Check if price is close to rent estimate (within 20%)
    if (rentEstimate && Math.abs(price - rentEstimate) / rentEstimate < 0.2) {
      warnings.push(`Price ($${price.toLocaleString()}) might be monthly rent, not purchase price`);
    }
  }

  // Determine listing type
  if (isRentToOwn) {
    // If price is suspiciously low, it's likely the monthly payment
    if (isSuspiciouslyLow) {
      return {
        type: 'RENT_TO_OWN',
        displayPriceLabel: 'Monthly Payment',
        isSuspiciouslyLow: true,
        warnings: ['Price shown is monthly payment for rent-to-own'],
      };
    }

    // Otherwise it's the purchase price for a rent-to-own
    return {
      type: 'RENT_TO_OWN',
      displayPriceLabel: 'Purchase Price',
      isSuspiciouslyLow: false,
      warnings: ['Rent-to-own option available'],
    };
  }

  if (isForRent) {
    return {
      type: 'FOR_RENT',
      displayPriceLabel: 'Monthly Rent',
      isSuspiciouslyLow: false,
      warnings: ['Property appears to be for rent'],
    };
  }

  // Regular sale
  return {
    type: 'SALE',
    displayPriceLabel: 'Price',
    isSuspiciouslyLow,
    warnings: isSuspiciouslyLow ? ['Price seems unusually low - verify listing'] : [],
  };
}

/**
 * Format price with appropriate label
 */
export function formatPriceWithLabel(
  price: number | undefined,
  listingType: ListingTypeResult
): { price: string; label: string; badge?: string } {
  if (!price) {
    return { price: 'Contact for price', label: '' };
  }

  const formattedPrice = `$${price.toLocaleString()}`;

  return {
    price: formattedPrice,
    label: listingType.displayPriceLabel,
    badge: listingType.type === 'RENT_TO_OWN' ? 'Rent-to-Own' : undefined,
  };
}
