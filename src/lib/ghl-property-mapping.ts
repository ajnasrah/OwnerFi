// GoHighLevel to OwnerFi Property Field Mapping
// Based on common GHL property management workflows

export interface GHLPropertyData {
  // Contact Information (from GHL Contact)
  contactId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  
  // Custom Fields (configured in GHL)
  customFields: {
    // Property Basics
    property_address?: string;
    property_city?: string;
    property_state?: string;
    property_zip?: string;
    
    // Property Details
    bedrooms?: string;
    bathrooms?: string;
    square_feet?: string;
    lot_size?: string;
    year_built?: string;
    property_type?: string; // single-family, condo, etc.
    
    // Owner Financing Terms
    list_price?: string;
    down_payment_amount?: string;
    down_payment_percent?: string;
    monthly_payment?: string;
    interest_rate?: string;
    loan_term_years?: string;
    balloon_payment?: string;
    balloon_years?: string;
    
    // Property Features
    garage_spaces?: string;
    pool?: string;
    fireplace?: string;
    updated_kitchen?: string;
    hardwood_floors?: string;
    central_air?: string;
    
    // Media
    photo_urls?: string; // Comma-separated URLs
    virtual_tour_url?: string;
    
    // Listing Details
    property_description?: string;
    listing_status?: string; // active, pending, sold
    date_available?: string;
    
    // Owner Contact
    owner_name?: string;
    owner_phone?: string;
    owner_email?: string;
    
    // Marketing
    featured_listing?: string; // "yes" or "no"
    priority_level?: string; // 1-10
  };
  
  // GHL Tags
  tags?: string[];
  
  // Opportunity Data (if using GHL pipeline)
  opportunityId?: string;
  opportunityStage?: string;
  opportunityValue?: number;
}

// Mapping function to convert GHL data to our PropertyListing schema
import { PropertyListing } from './property-schema';

export function mapGHLToProperty(ghlData: GHLPropertyData): Partial<PropertyListing> {
  const cf = ghlData.customFields;
  
  return {
    // Use custom field address if available, fallback to contact address
    address: cf.property_address || ghlData.address1 || '',
    city: cf.property_city || ghlData.city || '',
    state: cf.property_state || ghlData.state || '',
    zipCode: cf.property_zip || ghlData.postalCode || '',
    
    // Property specifications
    bedrooms: parseInt(cf.bedrooms || '0'),
    bathrooms: parseFloat(cf.bathrooms || '0'),
    squareFeet: parseInt(cf.square_feet || '0'),
    lotSize: parseInt(cf.lot_size || '0'),
    yearBuilt: parseInt(cf.year_built || '0'),
    propertyType: (cf.property_type as 'house' | 'condo' | 'townhouse' | 'mobile' | 'multi-family' | 'land') || 'house',
    
    // Financial terms
    listPrice: parseInt(cf.list_price || '0'),
    downPaymentAmount: parseInt(cf.down_payment_amount || '0'),
    downPaymentPercent: parseFloat(cf.down_payment_percent || '10'),
    monthlyPayment: parseInt(cf.monthly_payment || '0'),
    interestRate: parseFloat(cf.interest_rate || '7.0'),
    termYears: parseInt(cf.loan_term_years || '20'),
    balloonPayment: cf.balloon_payment ? parseInt(cf.balloon_payment) : undefined,
    balloonYears: cf.balloon_years ? parseInt(cf.balloon_years) : undefined,
    
    // Features array
    features: buildFeaturesArray(cf),
    
    // Media
    imageUrls: cf.photo_urls ? cf.photo_urls.split(',').map(url => url.trim()) : [],
    virtualTourUrl: cf.virtual_tour_url || undefined,
    
    // Description and marketing
    description: cf.property_description || '',
    featured: cf.featured_listing === 'yes' || cf.featured_listing === 'true',
    priority: parseInt(cf.priority_level || '5'),
    
    // Owner information
    ownerName: cf.owner_name || `${ghlData.firstName || ''} ${ghlData.lastName || ''}`.trim(),
    ownerPhone: cf.owner_phone || ghlData.phone,
    ownerEmail: cf.owner_email || ghlData.email,
    
    // Status and tracking
    status: mapListingStatus(cf.listing_status),
    source: 'ghl-webhook' as const,
    sourceId: ghlData.contactId,
    
    // GHL integration data
    ghlData: {
      contactId: ghlData.contactId,
      opportunityId: ghlData.opportunityId,
      customFields: cf,
      tags: ghlData.tags || []
    }
  };
}

function buildFeaturesArray(customFields: Record<string, string>): string[] {
  const features: string[] = [];
  
  if (customFields.garage_spaces && parseInt(customFields.garage_spaces) > 0) {
    features.push(`${customFields.garage_spaces} car garage`);
  }
  if (customFields.pool === 'yes' || customFields.pool === 'true') {
    features.push('Pool');
  }
  if (customFields.fireplace === 'yes' || customFields.fireplace === 'true') {
    features.push('Fireplace');
  }
  if (customFields.updated_kitchen === 'yes' || customFields.updated_kitchen === 'true') {
    features.push('Updated Kitchen');
  }
  if (customFields.hardwood_floors === 'yes' || customFields.hardwood_floors === 'true') {
    features.push('Hardwood Floors');
  }
  if (customFields.central_air === 'yes' || customFields.central_air === 'true') {
    features.push('Central Air');
  }
  
  return features;
}

function mapListingStatus(ghlStatus?: string): 'active' | 'pending' | 'sold' | 'withdrawn' | 'expired' {
  switch (ghlStatus?.toLowerCase()) {
    case 'sold':
    case 'closed':
      return 'sold';
    case 'pending':
    case 'under contract':
      return 'pending';
    case 'withdrawn':
    case 'canceled':
      return 'withdrawn';
    case 'expired':
      return 'expired';
    case 'active':
    case 'for sale':
    default:
      return 'active';
  }
}

// Expected GHL Custom Fields Structure for Properties:
export const EXPECTED_GHL_CUSTOM_FIELDS = {
  // Property Information
  property_address: 'Property Street Address',
  property_city: 'Property City', 
  property_state: 'Property State',
  property_zip: 'Property ZIP Code',
  
  // Property Details
  bedrooms: 'Number of Bedrooms',
  bathrooms: 'Number of Bathrooms', 
  square_feet: 'Square Footage',
  lot_size: 'Lot Size (sq ft)',
  year_built: 'Year Built',
  property_type: 'Property Type',
  
  // Owner Financing
  list_price: 'List Price ($)',
  down_payment_amount: 'Down Payment Amount ($)',
  down_payment_percent: 'Down Payment Percentage (%)',
  monthly_payment: 'Monthly Payment ($)',
  interest_rate: 'Interest Rate (%)',
  loan_term_years: 'Loan Term (Years)',
  
  // Features (Yes/No fields)
  garage_spaces: 'Garage Spaces',
  pool: 'Has Pool',
  fireplace: 'Has Fireplace',
  updated_kitchen: 'Updated Kitchen',
  hardwood_floors: 'Hardwood Floors',
  central_air: 'Central Air',
  
  // Media
  photo_urls: 'Photo URLs (comma-separated)',
  virtual_tour_url: 'Virtual Tour URL',
  
  // Listing Management
  property_description: 'Property Description',
  listing_status: 'Listing Status',
  featured_listing: 'Featured Listing',
  priority_level: 'Priority Level (1-10)',
  
  // Owner Contact
  owner_name: 'Owner Name',
  owner_phone: 'Owner Phone',
  owner_email: 'Owner Email'
};