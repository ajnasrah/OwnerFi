/**
 * Census Bureau API Integration
 *
 * Uses American Community Survey (ACS) 5-Year estimates for demographics
 * and County Business Patterns (CBP) for business data.
 *
 * API Docs: https://www.census.gov/data/developers/data-sets.html
 */

import { DemographicsData, BusinessData, IndustryData } from './cre-models';

const CENSUS_BASE_URL = 'https://api.census.gov/data';

// ACS 5-Year variables we need
const ACS_VARIABLES = {
  totalPopulation: 'B01003_001E',
  medianAge: 'B01002_001E',
  medianHouseholdIncome: 'B19013_001E',
  totalHouseholds: 'B11001_001E',
  ownerOccupied: 'B25003_002E',
  totalHousingUnits: 'B25003_001E',
  laborForce: 'B23025_002E',
  employed: 'B23025_004E',
  unemployed: 'B23025_005E',
  civilianLaborForce: 'B23025_003E',
  bachelorDegreeOrHigher: 'B15003_022E', // Bachelor's
  masterDegree: 'B15003_023E',
  professionalDegree: 'B15003_024E',
  doctorateDegree: 'B15003_025E',
  totalEducationPop: 'B15003_001E',
};

// NAICS codes for industry categories
const NAICS_CATEGORIES = {
  retail: '44-45',
  foodService: '72',
  healthcare: '62',
  professionalServices: '54',
  manufacturing: '31-33',
  finance: '52',
  realEstate: '53',
  construction: '23',
  wholesale: '42',
  transportation: '48-49',
};

// Industry name mappings
const NAICS_NAMES: Record<string, string> = {
  '44-45': 'Retail Trade',
  '72': 'Accommodation & Food Services',
  '62': 'Healthcare & Social Assistance',
  '54': 'Professional Services',
  '31-33': 'Manufacturing',
  '52': 'Finance & Insurance',
  '53': 'Real Estate',
  '23': 'Construction',
  '42': 'Wholesale Trade',
  '48-49': 'Transportation & Warehousing',
  '51': 'Information',
  '56': 'Administrative Services',
  '61': 'Educational Services',
  '71': 'Arts & Entertainment',
  '81': 'Other Services',
};

interface CensusGeocode {
  state: string;
  county: string;
  tract?: string;
  place?: string;
}

/**
 * Get Census geography codes from coordinates
 */
async function getGeographyFromCoords(lat: number, lng: number): Promise<CensusGeocode | null> {
  try {
    const url = `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=${lng}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current&layers=all&format=json`;

    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    const geographies = data?.result?.geographies;

    if (!geographies) return null;

    // Get tract info (most granular)
    const tract = geographies['Census Tracts']?.[0];
    const county = geographies['Counties']?.[0];

    if (!county) return null;

    return {
      state: county.STATE,
      county: county.COUNTY,
      tract: tract?.TRACT,
      place: geographies['Incorporated Places']?.[0]?.PLACE,
    };
  } catch (error) {
    console.error('Census geocoding error:', error);
    return null;
  }
}

/**
 * Fetch ACS 5-Year demographics data
 */
async function fetchACSData(geo: CensusGeocode, year: number = 2022): Promise<Record<string, string> | null> {
  try {
    const variables = Object.values(ACS_VARIABLES).join(',');
    const apiKey = process.env.CENSUS_API_KEY ? `&key=${process.env.CENSUS_API_KEY}` : '';

    // Try tract level first (most granular), fall back to county
    let url: string;
    let geoLevel: string;

    if (geo.tract) {
      url = `${CENSUS_BASE_URL}/${year}/acs/acs5?get=NAME,${variables}&for=tract:${geo.tract}&in=state:${geo.state}&in=county:${geo.county}${apiKey}`;
      geoLevel = 'tract';
    } else {
      url = `${CENSUS_BASE_URL}/${year}/acs/acs5?get=NAME,${variables}&for=county:${geo.county}&in=state:${geo.state}${apiKey}`;
      geoLevel = 'county';
    }

    const response = await fetch(url);
    if (!response.ok) {
      // Fall back to county if tract fails
      if (geoLevel === 'tract') {
        const countyUrl = `${CENSUS_BASE_URL}/${year}/acs/acs5?get=NAME,${variables}&for=county:${geo.county}&in=state:${geo.state}${apiKey}`;
        const countyResponse = await fetch(countyUrl);
        if (!countyResponse.ok) return null;
        const countyData = await countyResponse.json();
        return parseACSResponse(countyData, 'county');
      }
      return null;
    }

    const data = await response.json();
    return parseACSResponse(data, geoLevel);
  } catch (error) {
    console.error('ACS data fetch error:', error);
    return null;
  }
}

/**
 * Parse ACS API response into key-value pairs
 */
function parseACSResponse(data: string[][], geoLevel: string): Record<string, string> {
  if (!data || data.length < 2) return {};

  const headers = data[0];
  const values = data[1];

  const result: Record<string, string> = { _geoLevel: geoLevel };
  headers.forEach((header, index) => {
    result[header] = values[index];
  });

  return result;
}

/**
 * Convert ACS data to DemographicsData
 */
function parseDemographics(acsData: Record<string, string>, year: number): DemographicsData {
  const getNum = (key: string): number => {
    const val = acsData[ACS_VARIABLES[key as keyof typeof ACS_VARIABLES]];
    const num = parseInt(val, 10);
    return isNaN(num) || num < 0 ? 0 : num;
  };

  const population = getNum('totalPopulation');
  const laborForce = getNum('laborForce');
  const unemployed = getNum('unemployed');
  const civilianLaborForce = getNum('civilianLaborForce');
  const totalHouseholds = getNum('totalHouseholds');
  const ownerOccupied = getNum('ownerOccupied');
  const totalHousing = getNum('totalHousingUnits');

  // Calculate education percentage
  const totalEduPop = getNum('totalEducationPop');
  const bachelorPlus = getNum('bachelorDegreeOrHigher') +
                       getNum('masterDegree') +
                       getNum('professionalDegree') +
                       getNum('doctorateDegree');

  return {
    population,
    populationGrowth5yr: null, // Would need historical data
    medianHouseholdIncome: getNum('medianHouseholdIncome'),
    medianAge: parseFloat(acsData[ACS_VARIABLES.medianAge]) || 0,
    laborForceParticipation: population > 0 ? (laborForce / population) * 100 : null,
    unemploymentRate: civilianLaborForce > 0 ? (unemployed / civilianLaborForce) * 100 : null,
    educationBachelorOrHigher: totalEduPop > 0 ? (bachelorPlus / totalEduPop) * 100 : null,
    householdCount: totalHouseholds,
    ownerOccupiedRate: totalHousing > 0 ? (ownerOccupied / totalHousing) * 100 : null,
    dataYear: year,
    geographyLevel: acsData._geoLevel as 'tract' | 'county' | 'zip' | 'place',
  };
}

/**
 * Fetch County Business Patterns data
 */
async function fetchCBPData(geo: CensusGeocode, year: number = 2021): Promise<BusinessData | null> {
  try {
    const apiKey = process.env.CENSUS_API_KEY ? `&key=${process.env.CENSUS_API_KEY}` : '';

    // Get all establishments for the county
    const url = `${CENSUS_BASE_URL}/${year}/cbp?get=NAICS2017,NAICS2017_LABEL,ESTAB,EMP,PAYANN&for=county:${geo.county}&in=state:${geo.state}${apiKey}`;

    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    return parseCBPData(data, year);
  } catch (error) {
    console.error('CBP data fetch error:', error);
    return null;
  }
}

/**
 * Parse CBP API response into BusinessData
 */
function parseCBPData(data: string[][], year: number): BusinessData | null {
  if (!data || data.length < 2) return null;

  const headers = data[0];
  const naicsIdx = headers.indexOf('NAICS2017');
  const labelIdx = headers.indexOf('NAICS2017_LABEL');
  const estabIdx = headers.indexOf('ESTAB');
  const empIdx = headers.indexOf('EMP');
  const payIdx = headers.indexOf('PAYANN');

  let totalEstablishments = 0;
  let totalEmployees = 0;
  const industries: IndustryData[] = [];

  // Category counts
  let retailCount = 0;
  let foodServiceCount = 0;
  let healthcareCount = 0;
  let professionalCount = 0;
  let manufacturingCount = 0;

  // Skip header row
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const naics = row[naicsIdx];
    const label = row[labelIdx];
    const estab = parseInt(row[estabIdx], 10) || 0;
    const emp = parseInt(row[empIdx], 10) || 0;
    const pay = parseInt(row[payIdx], 10) || 0;

    // Total row
    if (naics === '00') {
      totalEstablishments = estab;
      totalEmployees = emp;
      continue;
    }

    // 2-digit sector codes
    if (naics.length === 2 || naics.includes('-')) {
      industries.push({
        naicsCode: naics,
        name: NAICS_NAMES[naics] || label,
        establishmentCount: estab,
        employeeCount: emp,
        annualPayroll: pay,
      });

      // Count categories
      if (naics === '44' || naics === '45' || naics === '44-45') retailCount += estab;
      if (naics === '72') foodServiceCount = estab;
      if (naics === '62') healthcareCount = estab;
      if (naics === '54') professionalCount = estab;
      if (naics === '31' || naics === '32' || naics === '33' || naics === '31-33') manufacturingCount += estab;
    }
  }

  // Sort by establishment count
  industries.sort((a, b) => b.establishmentCount - a.establishmentCount);

  return {
    totalEstablishments,
    totalEmployees: totalEmployees || null,
    retailEstablishments: retailCount,
    foodServiceEstablishments: foodServiceCount,
    healthcareEstablishments: healthcareCount,
    professionalServicesEstablishments: professionalCount,
    manufacturingEstablishments: manufacturingCount,
    topIndustries: industries.slice(0, 10), // Top 10
    dataYear: year,
  };
}

/**
 * Main function to fetch all Census data for a location
 */
export async function fetchCensusData(
  lat: number,
  lng: number
): Promise<{ demographics: DemographicsData | null; business: BusinessData | null }> {
  // Get geography codes
  const geo = await getGeographyFromCoords(lat, lng);

  if (!geo) {
    console.error('Could not determine Census geography for coordinates');
    return { demographics: null, business: null };
  }

  // Fetch both datasets in parallel
  const [acsData, cbpData] = await Promise.all([
    fetchACSData(geo),
    fetchCBPData(geo),
  ]);

  const demographics = acsData ? parseDemographics(acsData, 2022) : null;

  return {
    demographics,
    business: cbpData,
  };
}

/**
 * Format currency for display
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Format percentage for display
 */
export function formatPercent(value: number | null): string {
  if (value === null) return 'N/A';
  return `${value.toFixed(1)}%`;
}

/**
 * Format large numbers with commas
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}
