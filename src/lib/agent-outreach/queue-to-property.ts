/**
 * Shared builder: agent_outreach_queue doc → properties-collection doc.
 *
 * Multiple paths create property docs from queue items:
 *   - agent-response webhook (GHL YES)
 *   - opportunity-stage-change webhook (GHL stage transition)
 *   - process-agent-outreach-queue (cash-deal auto-save)
 *   - property-resolver.handleAgentYes (SMS / voice / VAPI)
 *
 * Each used to duplicate a ~50-field mapping, which meant new queue fields
 * (rentEstimate, lotSize, broker info, county, parcel, etc.) had to be
 * added in every place or properties landed sparse. This builder centralizes
 * the mapping so the queue→Firestore data surface lives in one spot.
 */

import { sanitizeDescription } from '@/lib/description-sanitizer';
import { detectFinancingType } from '@/lib/financing-type-detector';
import { normalizeHomeType } from '@/lib/scraper-v2/property-transformer';
import { calculateCashFlow } from '@/lib/cash-flow';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type QueueItem = Record<string, any>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pick = (...candidates: any[]): any => {
  for (const c of candidates) if (c != null && c !== '' && c !== 0) return c;
  return null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const hasHttp = (v: any): v is string => typeof v === 'string' && /^https?:\/\//i.test(v.trim());

export interface QueueToPropertyOptions {
  /** Queue item as stored in agent_outreach_queue. */
  queueItem: QueueItem;
  /** True when agent confirmed owner financing. */
  isOwnerfinance: boolean;
  /** True when price < 80% Zestimate (cash deal). */
  isCashDeal: boolean;
  /** Distressed listings (auction / foreclosure / REO) are never OF — price is opening bid. */
  isDistressed?: boolean;
  /** Source tag for the properties doc. */
  source: string;
  /** Agent note (free-form text from YES response). */
  agentNote?: string | null;
  /** GHL opportunity ID when available. */
  ghlOpportunityId?: string | null;
  /** Queue doc ID to persist as originalQueueId. */
  originalQueueId?: string | null;
  /** Optional lat/lng overrides (e.g. geocode fallback). */
  latitude?: number | null;
  longitude?: number | null;
}

/**
 * Build a fully-populated property doc from a queue item, pulling every
 * available field from queue fields + queue.rawData.
 */
export function buildPropertyDocFromQueue(opts: QueueToPropertyOptions): Record<string, unknown> {
  const {
    queueItem: q,
    isOwnerfinance,
    isCashDeal,
    isDistressed = false,
    source,
    agentNote,
    ghlOpportunityId,
    originalQueueId,
    latitude,
    longitude,
  } = opts;

  const r: QueueItem = q.rawData || {};

  // ── Description + financing detection ───────────────────────────────────
  const description = sanitizeDescription(q.description || r.description || '');
  const financingTypeResult = detectFinancingType(description);

  // ── Images ──────────────────────────────────────────────────────────────
  const primaryImage =
    (hasHttp(q.primaryImage) && q.primaryImage) ||
    (hasHttp(q.firstPropertyImage) && q.firstPropertyImage) ||
    (hasHttp(q.imgSrc) && q.imgSrc) ||
    (hasHttp(q.hiResImageLink) && q.hiResImageLink) ||
    (hasHttp(q.desktopWebHdpImageLink) && q.desktopWebHdpImageLink) ||
    (hasHttp(q.mediumImageLink) && q.mediumImageLink) ||
    (hasHttp(r.hiResImageLink) && r.hiResImageLink) ||
    (hasHttp(r.desktopWebHdpImageLink) && r.desktopWebHdpImageLink) ||
    (hasHttp(r.mediumImageLink) && r.mediumImageLink) ||
    (Array.isArray(q.propertyImages) && hasHttp(q.propertyImages[0]) && q.propertyImages[0]) ||
    (Array.isArray(q.imageUrls) && hasHttp(q.imageUrls[0]) && q.imageUrls[0]) ||
    null;
  const gallery: string[] | null =
    Array.isArray(q.propertyImages) && q.propertyImages.length > 0
      ? q.propertyImages
      : Array.isArray(q.imageUrls) && q.imageUrls.length > 0
      ? q.imageUrls
      : null;

  // ── Structural / financial detail (queue → rawData → null) ──────────────
  const rentEstimate = pick(q.rentZestimate, q.rentEstimate, r.rentZestimate, r.rentEstimate);
  const yearBuilt = Number(pick(q.yearBuilt, r.yearBuilt) || 0) || null;
  const lotSize = pick(q.lotSize, r.lotAreaValue, r.lotSize);
  const daysOnZillow = q.daysOnZillow ?? r.daysOnZillow ?? null;
  const hoa = pick(q.hoa, r.monthlyHoaFee, r.hoaFee) || 0;
  const taxFromHistory = Array.isArray(r.taxHistory)
    ? r.taxHistory.find((t: { taxPaid?: number }) => t?.taxPaid)?.taxPaid || 0
    : 0;
  const annualTaxAmount = pick(q.annualTaxAmount, taxFromHistory);
  const propertyTaxRate = q.propertyTaxRate ?? r.propertyTaxRate ?? null;
  const annualHomeownersInsurance = q.annualHomeownersInsurance ?? r.annualHomeownersInsurance ?? null;

  const county = pick(q.county, r.county);
  const parcelId = pick(q.parcelId, r.parcelId, r.resoFacts?.parcelNumber);
  const mlsId = pick(q.mlsId, r.attributionInfo?.mlsId, r.mlsid);
  const virtualTourUrl = pick(q.virtualTourUrl, r.virtualTourUrl, r.thirdPartyVirtualTour?.externalUrl);
  const brokerName = pick(q.brokerName, r.attributionInfo?.brokerName, r.brokerName);
  const brokerPhoneNumber = pick(q.brokerPhone, r.attributionInfo?.brokerPhoneNumber, r.brokerPhoneNumber);
  const agentEmail = pick(q.agentEmail, r.attributionInfo?.agentEmail, r.agentEmail);
  const hdpUrl = q.hdpUrl || r.hdpUrl || null;

  const homeTypeRaw = q.propertyType || r.homeType || r.propertyType || 'SINGLE_FAMILY';
  const normalizedHomeType = normalizeHomeType(homeTypeRaw);

  // ── Price + cash flow recompute ─────────────────────────────────────────
  const price = q.price || 0;
  const zestimate = q.zestimate || null;
  const priceToZestimateRatio = q.priceToZestimateRatio || (zestimate ? price / zestimate : 0);
  const discountPercent = priceToZestimateRatio ? Math.round((1 - priceToZestimateRatio) * 100) : 0;
  const cashFlow = price && rentEstimate
    ? calculateCashFlow(price, rentEstimate, Number(annualTaxAmount) || 0, Number(hoa) || 0)
    : null;

  // ── dealTypes array ─────────────────────────────────────────────────────
  const dealTypes: string[] = [];
  if (isOwnerfinance && !isDistressed) dealTypes.push('owner_finance');
  if (isCashDeal) dealTypes.push('cash_deal');

  return {
    // Identifiers + URLs
    zpid: q.zpid,
    url: q.url,
    hdpUrl,
    virtualTourUrl,
    mlsId,
    parcelId,
    county,

    // Address
    address: q.address || '',
    streetAddress: q.address || '',
    fullAddress: `${q.address || ''}, ${q.city || ''}, ${q.state || ''} ${q.zipCode || ''}`.trim(),
    city: q.city || '',
    state: q.state || '',
    zipCode: q.zipCode || '',
    zipcode: q.zipCode || '',

    // Pricing + estimates
    price,
    listPrice: price,
    zestimate,
    estimate: zestimate,
    rentEstimate,
    rentZestimate: rentEstimate,
    priceToZestimateRatio,
    discountPercent: isCashDeal ? discountPercent : null,
    discountPercentage: isCashDeal ? discountPercent : null,

    // Structural
    bedrooms: q.beds || 0,
    bathrooms: q.baths || 0,
    squareFoot: q.squareFeet || 0,
    squareFeet: q.squareFeet || 0,
    lotSize,
    lotSquareFoot: lotSize,
    yearBuilt,
    daysOnZillow,
    homeType: normalizedHomeType,
    propertyType: homeTypeRaw,
    isLand: normalizedHomeType === 'land',
    homeStatus: q.homeStatus || 'FOR_SALE',
    keystoneHomeStatus: q.keystoneHomeStatus || r.keystoneHomeStatus || null,

    // Location (caller-provided fallback wins over rawData)
    latitude: latitude ?? q.latitude ?? r.latitude ?? null,
    longitude: longitude ?? q.longitude ?? r.longitude ?? null,

    // Costs
    hoa,
    monthlyHoaFee: hoa || null,
    annualTaxAmount,
    propertyTaxRate,
    annualHomeownersInsurance,

    // Cash flow
    cashFlow,

    // Agent / broker
    agentName: q.agentName,
    agentPhoneNumber: q.agentPhone,
    agentEmail,
    brokerName,
    brokerPhoneNumber,

    // Description
    description,

    // Images — every alias surfaced so downstream consumers don't fall back.
    ...(primaryImage && {
      primaryImage,
      firstPropertyImage: primaryImage,
      imgSrc: primaryImage,
      hiResImageLink: q.hiResImageLink || primaryImage,
      mediumImageLink: q.mediumImageLink || primaryImage,
      desktopWebHdpImageLink: q.desktopWebHdpImageLink || primaryImage,
    }),
    ...(gallery && gallery.length > 0 && {
      propertyImages: gallery,
      imageUrls: gallery,
      photoCount: q.photoCount || gallery.length,
    }),

    // Financing (OF-confirmed docs get Owner Finance defaults; distressed keep nulls)
    financingType: isDistressed ? null : (financingTypeResult.financingType || 'Owner Finance'),
    allFinancingTypes: isDistressed ? [] : (financingTypeResult.allTypes.length > 0 ? financingTypeResult.allTypes : ['Owner Finance']),
    financingTypeLabel: isDistressed ? null : (financingTypeResult.displayLabel || 'Owner Finance'),
    ownerFinanceVerified: isOwnerfinance && !isDistressed,
    agentConfirmedOwnerfinance: isOwnerfinance && !isDistressed,
    ...(isDistressed && { agentConfirmedDistressedCashOnly: true }),
    ...(isCashDeal && { agentConfirmedMotivated: true }),

    // Unified flags
    isOwnerfinance: isOwnerfinance && !isDistressed,
    isCashDeal,
    dealTypes,
    isActive: true,

    // Source + tracking
    source,
    agentConfirmedAt: isOwnerfinance ? new Date() : null,
    agentNote: agentNote || null,
    // Coerce undefined → null. Firestore rejects `undefined` but accepts
    // `null`. Callers that don't pass originalQueueId (e.g. the queue
    // processor cash-deal save path) used to hit the 2 failed-property
    // errors the verification sweep surfaced.
    originalQueueId: originalQueueId ?? null,
    ghlOpportunityId: ghlOpportunityId || null,

    // Timestamps
    importedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    lastStatusCheck: new Date(),
    lastScrapedAt: new Date(),

    // Full raw passthrough for future field additions
    rawData: q.rawData || null,
  };
}
