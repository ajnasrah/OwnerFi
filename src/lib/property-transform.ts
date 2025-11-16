import { sanitizeDescription } from './description-sanitizer';

/**
 * Helper function to parse street address from full address
 * Extracts just the street portion, removing city/state/zip
 */
function parseStreetAddress(fullAddr: string, city?: string): string {
  if (!fullAddr) return '';

  // If we have city, use it to split
  if (city && fullAddr.toLowerCase().includes(city.toLowerCase())) {
    const parts = fullAddr.split(',');
    return parts[0].trim();
  }

  // Otherwise, take everything before the first comma
  const parts = fullAddr.split(',');
  return parts[0].trim();
}

/**
 * Transforms raw Apify property data into our standardized property format.
 * Used by both regular scraper and cash deals scraper.
 */
export function transformApifyProperty(apifyData: any, source: string = 'apify-zillow') {
  const timestamp = new Date();
  const addressObj = apifyData.address || {};

  // Extract address components
  const city = addressObj.city || apifyData.city || '';
  const state = addressObj.state || apifyData.state || '';
  const zipCode = addressObj.zipcode || apifyData.zipcode || addressObj.zip || '';

  // Extract street address - ensure it doesn't contain city/state/zip
  let rawStreetAddress = addressObj.streetAddress || apifyData.streetAddress || '';

  // Clean the street address to remove any city/state/zip that might be included
  const streetAddress = parseStreetAddress(rawStreetAddress, city);

  // Construct full address from components (ensures consistency)
  const fullAddress = `${streetAddress}, ${city}, ${state} ${zipCode}`.trim();

  // ===== CONSTRUCT FULL URL =====
  let fullUrl = apifyData.url || '';
  if (!fullUrl || !fullUrl.startsWith('http')) {
    // If url is missing or relative, construct from hdpUrl or zpid
    if (apifyData.hdpUrl) {
      fullUrl = `https://www.zillow.com${apifyData.hdpUrl}`;
    } else if (apifyData.zpid) {
      fullUrl = `https://www.zillow.com/homedetails/${apifyData.zpid}_zpid/`;
    }
  }

  // ===== ENHANCED AGENT/BROKER EXTRACTION =====
  // Try attributionInfo first
  let agentPhone = apifyData.attributionInfo?.agentPhoneNumber
    || apifyData.agentPhoneNumber
    || apifyData.agentPhone
    || '';

  // If not found, try contactFormRenderData (nested structure)
  if (!agentPhone && apifyData.contactFormRenderData?.data?.agent_module?.phone) {
    const phoneObj = apifyData.contactFormRenderData.data.agent_module.phone;
    if (phoneObj.areacode && phoneObj.prefix && phoneObj.number) {
      agentPhone = `${phoneObj.areacode}-${phoneObj.prefix}-${phoneObj.number}`;
    }
  }

  const brokerPhone = apifyData.attributionInfo?.brokerPhoneNumber
    || apifyData.brokerPhoneNumber
    || apifyData.brokerPhone
    || '';

  const finalAgentPhone = agentPhone || brokerPhone;

  const agentName = apifyData.attributionInfo?.agentName
    || apifyData.agentName
    || apifyData.listingAgent
    || (Array.isArray(apifyData.attributionInfo?.listingAgents) && apifyData.attributionInfo.listingAgents[0]?.memberFullName)
    || apifyData.contactFormRenderData?.data?.agent_module?.display_name
    || '';

  const brokerName = apifyData.attributionInfo?.brokerName
    || apifyData.brokerName
    || apifyData.brokerageName
    || (Array.isArray(apifyData.attributionInfo?.listingOffices) && apifyData.attributionInfo.listingOffices[0]?.officeName)
    || '';

  // Extract images
  const propertyImages = Array.isArray(apifyData.responsivePhotos)
    ? apifyData.responsivePhotos.map((p: any) => p.url).filter(Boolean)
    : Array.isArray(apifyData.photos)
    ? apifyData.photos.map((p: any) => typeof p === 'string' ? p : p.url || p.href).filter(Boolean)
    : Array.isArray(apifyData.images)
    ? apifyData.images
    : [];

  // Generate Street View image as fail-safe if no images available
  const getStreetViewImageByAddress = (address: string): string => {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey || !address) return '';

    const encodedAddress = encodeURIComponent(address);
    return `https://maps.googleapis.com/maps/api/streetview?` +
      `size=800x500&` +
      `location=${encodedAddress}&` +
      `heading=0&` +
      `fov=90&` +
      `pitch=10&` +
      `key=${apiKey}`;
  };

  const firstPropertyImage = apifyData.desktopWebHdpImageLink
    || apifyData.hiResImageLink
    || apifyData.mediumImageLink
    || (propertyImages.length > 0 ? propertyImages[0] : '')
    || getStreetViewImageByAddress(fullAddress);

  // Ensure propertyImages always has at least one image (Street View if nothing else)
  const finalPropertyImages = propertyImages.length > 0
    ? propertyImages
    : (firstPropertyImage ? [firstPropertyImage] : []);

  return {
    url: fullUrl,
    hdpUrl: apifyData.hdpUrl || '',
    virtualTourUrl: apifyData.virtualTourUrl || apifyData.thirdPartyVirtualTour?.externalUrl || '',
    fullAddress,
    streetAddress,
    city,
    state,
    zipCode,
    county: apifyData.county || '',
    subdivision: addressObj.subdivision || '',
    neighborhood: addressObj.neighborhood || '',
    zpid: apifyData.zpid || 0,
    parcelId: apifyData.parcelId || apifyData.resoFacts?.parcelNumber || '',
    mlsId: apifyData.attributionInfo?.mlsId || apifyData.mlsid || '',
    bedrooms: apifyData.bedrooms || apifyData.beds || 0,
    bathrooms: apifyData.bathrooms || apifyData.baths || 0,
    squareFoot: apifyData.livingArea || apifyData.livingAreaValue || apifyData.squareFoot || 0,
    buildingType: apifyData.propertyTypeDimension || apifyData.buildingType || apifyData.homeType || '',
    homeType: apifyData.homeType || '',
    homeStatus: apifyData.homeStatus || '',
    yearBuilt: apifyData.yearBuilt || 0,
    lotSquareFoot: apifyData.lotSize || apifyData.lotAreaValue || apifyData.resoFacts?.lotSize || 0,
    latitude: apifyData.latitude || 0,
    longitude: apifyData.longitude || 0,
    price: apifyData.price || apifyData.listPrice || 0,
    estimate: apifyData.zestimate || apifyData.homeValue || apifyData.estimate || 0,
    rentEstimate: apifyData.rentZestimate || 0,
    hoa: apifyData.monthlyHoaFee || apifyData.hoa || 0,
    annualTaxAmount: (Array.isArray(apifyData.taxHistory) && apifyData.taxHistory.find((t: any) => t.taxPaid)?.taxPaid) || 0,
    recentPropertyTaxes: (Array.isArray(apifyData.taxHistory) && apifyData.taxHistory[0]?.value) || 0,
    propertyTaxRate: apifyData.propertyTaxRate || 0,
    annualHomeownersInsurance: apifyData.annualHomeownersInsurance || 0,
    daysOnZillow: apifyData.daysOnZillow || 0,
    datePostedString: apifyData.datePostedString || '',
    listingDataSource: apifyData.listingDataSource || '',
    description: sanitizeDescription(apifyData.description),

    // ===== CRITICAL CONTACT INFORMATION =====
    agentName,
    agentPhoneNumber: finalAgentPhone,
    agentEmail: apifyData.attributionInfo?.agentEmail || apifyData.agentEmail || '',
    agentLicenseNumber: apifyData.attributionInfo?.agentLicenseNumber
      || (Array.isArray(apifyData.attributionInfo?.listingAgents) && apifyData.attributionInfo.listingAgents[0]?.memberStateLicense)
      || '',
    brokerName,
    brokerPhoneNumber: brokerPhone,

    propertyImages: finalPropertyImages,
    firstPropertyImage,
    imageUrl: firstPropertyImage,
    imageUrls: finalPropertyImages,
    imageSource: (propertyImages.length > 0) ? 'Zillow' : 'Google Street View',
    photoCount: apifyData.photoCount || finalPropertyImages.length || 0,
    source,
    importedAt: timestamp,
    scrapedAt: timestamp,
  };
}

/**
 * Validates that a property has minimum required data
 */
export function validatePropertyData(propertyData: any): { valid: boolean; reason?: string } {
  if (!propertyData.zpid) {
    return { valid: false, reason: 'Missing zpid' };
  }
  if (!propertyData.fullAddress || propertyData.fullAddress.trim() === ', ,') {
    return { valid: false, reason: 'Missing address' };
  }
  if (!propertyData.city || !propertyData.state) {
    return { valid: false, reason: 'Missing city or state' };
  }
  return { valid: true };
}
