import { sanitizeDescription } from './description-sanitizer';

/**
 * Transforms raw Apify property data into our standardized property format.
 * Used by both regular scraper and cash deals scraper.
 */
export function transformApifyProperty(apifyData: any, source: string = 'apify-zillow') {
  const timestamp = new Date();
  const addressObj = apifyData.address || {};
  const streetAddress = addressObj.streetAddress || apifyData.streetAddress || '';
  const city = addressObj.city || apifyData.city || '';
  const state = addressObj.state || apifyData.state || '';
  const zipCode = addressObj.zipcode || apifyData.zipcode || addressObj.zip || '';
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

  const firstPropertyImage = apifyData.desktopWebHdpImageLink
    || apifyData.hiResImageLink
    || apifyData.mediumImageLink
    || (propertyImages.length > 0 ? propertyImages[0] : '')
    || '';

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

    propertyImages,
    firstPropertyImage,
    photoCount: apifyData.photoCount || propertyImages.length || 0,
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
