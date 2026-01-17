/**
 * CRE Analysis Orchestration Service
 *
 * Coordinates all data fetching and analysis for a commercial real estate address.
 */

import { Timestamp } from 'firebase/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { fetchCensusData } from './census-service';
import { analyzeHighestBestUse, estimateHBUCost } from './hbu-analyzer';
import {
  CREAnalysis,
  CREAnalysisDoc,
  ParsedAddress,
  AnalysisCosts,
  CRE_COLLECTIONS,
  CRE_CACHE_TTL,
  createAddressCacheKey,
  docToCREAnalysis,
} from './cre-models';

/**
 * Geocode an address using Google Maps
 */
async function geocodeAddress(address: string): Promise<ParsedAddress | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    console.error('Google Maps API key not configured');
    return null;
  }

  try {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`;

    const response = await fetch(url);
    if (!response.ok) {
      console.error('Geocoding request failed:', response.status);
      return null;
    }

    const data = await response.json();

    if (data.status !== 'OK' || !data.results?.[0]) {
      console.error('Geocoding failed:', data.status);
      return null;
    }

    const result = data.results[0];
    const components = result.address_components;

    // Extract address components
    const getComponent = (type: string): string => {
      const comp = components.find((c: { types: string[] }) => c.types.includes(type));
      return comp?.long_name || comp?.short_name || '';
    };

    const getShortComponent = (type: string): string => {
      const comp = components.find((c: { types: string[] }) => c.types.includes(type));
      return comp?.short_name || comp?.long_name || '';
    };

    return {
      streetAddress: `${getComponent('street_number')} ${getComponent('route')}`.trim(),
      city: getComponent('locality') || getComponent('sublocality') || getComponent('administrative_area_level_3'),
      state: getShortComponent('administrative_area_level_1'),
      zipCode: getComponent('postal_code'),
      county: getComponent('administrative_area_level_2').replace(' County', ''),
      latitude: result.geometry.location.lat,
      longitude: result.geometry.location.lng,
      formattedAddress: result.formatted_address,
      placeId: result.place_id,
    };
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

/**
 * Check for cached analysis
 */
export async function getCachedAnalysis(address: string): Promise<CREAnalysis | null> {
  try {
    const db = await getAdminDb();
    if (!db) return null;

    const cacheKey = createAddressCacheKey(address);
    const now = Timestamp.now();

    const snapshot = await db
      .collection(CRE_COLLECTIONS.ANALYSES)
      .where('cacheKey', '==', cacheKey)
      .where('expiresAt', '>', now)
      .where('status', '==', 'complete')
      .limit(1)
      .get();

    if (snapshot.empty) return null;

    const doc = snapshot.docs[0].data() as CREAnalysisDoc;
    return docToCREAnalysis(doc);
  } catch (error) {
    console.error('Cache lookup error:', error);
    return null;
  }
}

/**
 * Save analysis to Firestore
 */
async function saveAnalysis(analysis: CREAnalysis): Promise<void> {
  try {
    const db = await getAdminDb();
    if (!db) return;

    const docData: CREAnalysisDoc = {
      ...analysis,
      createdAt: Timestamp.fromDate(analysis.createdAt),
      updatedAt: Timestamp.fromDate(analysis.updatedAt),
      expiresAt: Timestamp.fromDate(analysis.expiresAt),
      highestBestUse: analysis.highestBestUse ? {
        ...analysis.highestBestUse,
        generatedAt: Timestamp.fromDate(analysis.highestBestUse.generatedAt),
      } : null,
      marketData: analysis.marketData ? {
        ...analysis.marketData,
        dataFreshness: Timestamp.fromDate(analysis.marketData.dataFreshness),
      } : null,
    };

    await db.collection(CRE_COLLECTIONS.ANALYSES).doc(analysis.id).set(docData);
  } catch (error) {
    console.error('Failed to save analysis:', error);
  }
}

/**
 * Generate unique analysis ID
 */
function generateAnalysisId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `cre_${timestamp}_${random}`;
}

/**
 * Main analysis function
 */
export async function analyzeCREAddress(
  inputAddress: string,
  requestedBy: string
): Promise<CREAnalysis> {
  const analysisId = generateAnalysisId();
  const now = new Date();
  const costs: AnalysisCosts = {
    googleMaps: 0,
    census: 0,
    rentcast: 0,
    openai: 0,
    total: 0,
  };

  // Initialize analysis object
  const analysis: CREAnalysis = {
    id: analysisId,
    inputAddress,
    parsedAddress: {
      streetAddress: '',
      city: '',
      state: '',
      zipCode: '',
      county: '',
      latitude: 0,
      longitude: 0,
      formattedAddress: inputAddress,
    },
    demographics: null,
    businessData: null,
    marketData: null,
    highestBestUse: null,
    status: 'processing',
    requestedBy,
    apiCosts: costs,
    createdAt: now,
    updatedAt: now,
    expiresAt: new Date(now.getTime() + CRE_CACHE_TTL.ANALYSIS * 24 * 60 * 60 * 1000),
    cacheKey: createAddressCacheKey(inputAddress),
  };

  try {
    // Step 1: Geocode the address
    console.log(`[CRE] Geocoding address: ${inputAddress}`);
    const parsedAddress = await geocodeAddress(inputAddress);

    if (!parsedAddress) {
      analysis.status = 'failed';
      analysis.errorMessage = 'Could not geocode address. Please check the address and try again.';
      await saveAnalysis(analysis);
      return analysis;
    }

    analysis.parsedAddress = parsedAddress;
    costs.googleMaps = 0.005; // ~$5 per 1000 requests

    // Step 2: Fetch Census data
    console.log(`[CRE] Fetching Census data for ${parsedAddress.city}, ${parsedAddress.state}`);
    const { demographics, business } = await fetchCensusData(
      parsedAddress.latitude,
      parsedAddress.longitude
    );

    analysis.demographics = demographics;
    analysis.businessData = business;
    costs.census = 0; // Free API

    // Step 3: Run HBU analysis
    console.log('[CRE] Running highest & best use analysis');
    const hbuResult = await analyzeHighestBestUse({
      address: parsedAddress,
      demographics,
      businessData: business,
    });

    analysis.highestBestUse = hbuResult;
    costs.openai = estimateHBUCost();

    // Calculate total costs
    costs.total = costs.googleMaps + costs.census + costs.rentcast + costs.openai;
    analysis.apiCosts = costs;

    // Mark as complete
    analysis.status = 'complete';
    analysis.updatedAt = new Date();

    // Save to Firestore
    await saveAnalysis(analysis);

    console.log(`[CRE] Analysis complete for ${parsedAddress.formattedAddress}`);
    return analysis;

  } catch (error) {
    console.error('[CRE] Analysis failed:', error);
    analysis.status = 'failed';
    analysis.errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    analysis.updatedAt = new Date();
    await saveAnalysis(analysis);
    return analysis;
  }
}

/**
 * Get analysis by ID
 */
export async function getAnalysisById(id: string): Promise<CREAnalysis | null> {
  try {
    const db = await getAdminDb();
    if (!db) return null;

    const doc = await db.collection(CRE_COLLECTIONS.ANALYSES).doc(id).get();

    if (!doc.exists) return null;

    return docToCREAnalysis(doc.data() as CREAnalysisDoc);
  } catch (error) {
    console.error('Failed to get analysis:', error);
    return null;
  }
}

/**
 * Get analysis history for admin
 */
export async function getAnalysisHistory(
  limit: number = 20,
  offset: number = 0
): Promise<{ analyses: CREAnalysis[]; total: number }> {
  try {
    const db = await getAdminDb();
    if (!db) return { analyses: [], total: 0 };

    // Get total count
    const countSnapshot = await db.collection(CRE_COLLECTIONS.ANALYSES).count().get();
    const total = countSnapshot.data().count;

    // Get paginated results
    const snapshot = await db
      .collection(CRE_COLLECTIONS.ANALYSES)
      .orderBy('createdAt', 'desc')
      .offset(offset)
      .limit(limit)
      .get();

    const analyses = snapshot.docs.map(doc => docToCREAnalysis(doc.data() as CREAnalysisDoc));

    return { analyses, total };
  } catch (error) {
    console.error('Failed to get analysis history:', error);
    return { analyses: [], total: 0 };
  }
}

/**
 * Delete analysis by ID
 */
export async function deleteAnalysis(id: string): Promise<boolean> {
  try {
    const db = await getAdminDb();
    if (!db) return false;

    await db.collection(CRE_COLLECTIONS.ANALYSES).doc(id).delete();
    return true;
  } catch (error) {
    console.error('Failed to delete analysis:', error);
    return false;
  }
}
