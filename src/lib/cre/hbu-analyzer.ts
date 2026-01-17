/**
 * Highest & Best Use Analyzer
 *
 * Uses OpenAI to analyze demographics and business data
 * to recommend the best commercial use for a property.
 */

import OpenAI from 'openai';
import {
  HighestBestUse,
  DemographicsData,
  BusinessData,
  ParsedAddress,
  CommercialPropertyType,
  ConfidenceLevel,
} from './cre-models';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface HBUAnalysisInput {
  address: ParsedAddress;
  demographics: DemographicsData | null;
  businessData: BusinessData | null;
}

const SYSTEM_PROMPT = `You are a commercial real estate analyst specializing in highest and best use analysis.
Your task is to analyze location data and recommend the most profitable commercial development type.

You must respond with valid JSON in this exact format:
{
  "recommendation": "retail" | "office" | "industrial" | "multifamily" | "mixed-use" | "land",
  "confidence": "high" | "medium" | "low",
  "reasoning": "2-3 sentence explanation",
  "keyFactors": ["factor1", "factor2", "factor3"],
  "alternativeUses": [
    {"type": "propertyType", "viability": "high|medium|low", "notes": "brief note"}
  ],
  "considerations": ["consideration1", "consideration2"],
  "risks": ["risk1", "risk2"]
}

Guidelines:
- RETAIL: High traffic, strong consumer spending, growing population, median income >$50K
- OFFICE: Professional services presence, educated workforce (>30% bachelor+), low unemployment
- INDUSTRIAL: Near highways/logistics, manufacturing presence, moderate land costs
- MULTIFAMILY: Population growth, housing demand, urban/suburban areas, income $40-80K
- MIXED-USE: Dense urban areas, diverse economy, walkable neighborhoods
- LAND: Hold for future development if area is too undeveloped or uncertain

Consider:
- Population and growth trends
- Median household income
- Employment/unemployment rates
- Existing business mix
- Education levels
- Geographic factors`;

/**
 * Analyze location for highest and best use
 */
export async function analyzeHighestBestUse(input: HBUAnalysisInput): Promise<HighestBestUse> {
  const { address, demographics, businessData } = input;

  // Build context for GPT
  const locationContext = buildLocationContext(address, demographics, businessData);

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Analyze this location for highest and best use:\n\n${locationContext}\n\nProvide your analysis as JSON.`,
        },
      ],
      temperature: 0.3,
      max_tokens: 1000,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const result = JSON.parse(content);
    return parseHBUResponse(result);
  } catch (error) {
    console.error('HBU Analysis error:', error);
    // Return fallback analysis
    return createFallbackAnalysis(address, demographics, businessData);
  }
}

/**
 * Build location context string for GPT
 */
function buildLocationContext(
  address: ParsedAddress,
  demographics: DemographicsData | null,
  businessData: BusinessData | null
): string {
  const lines: string[] = [];

  // Location info
  lines.push(`LOCATION: ${address.formattedAddress}`);
  lines.push(`City: ${address.city}, ${address.state}`);
  lines.push(`County: ${address.county}`);
  lines.push('');

  // Demographics
  if (demographics) {
    lines.push('DEMOGRAPHICS:');
    lines.push(`- Population: ${demographics.population.toLocaleString()}`);
    if (demographics.populationGrowth5yr !== null) {
      lines.push(`- 5-Year Population Growth: ${demographics.populationGrowth5yr.toFixed(1)}%`);
    }
    lines.push(`- Median Household Income: $${demographics.medianHouseholdIncome.toLocaleString()}`);
    lines.push(`- Median Age: ${demographics.medianAge.toFixed(1)}`);
    if (demographics.unemploymentRate !== null) {
      lines.push(`- Unemployment Rate: ${demographics.unemploymentRate.toFixed(1)}%`);
    }
    if (demographics.educationBachelorOrHigher !== null) {
      lines.push(`- Bachelor's Degree or Higher: ${demographics.educationBachelorOrHigher.toFixed(1)}%`);
    }
    if (demographics.laborForceParticipation !== null) {
      lines.push(`- Labor Force Participation: ${demographics.laborForceParticipation.toFixed(1)}%`);
    }
    if (demographics.ownerOccupiedRate !== null) {
      lines.push(`- Owner-Occupied Housing: ${demographics.ownerOccupiedRate.toFixed(1)}%`);
    }
    lines.push(`- Data Source: Census ACS ${demographics.dataYear} (${demographics.geographyLevel} level)`);
    lines.push('');
  } else {
    lines.push('DEMOGRAPHICS: Data unavailable');
    lines.push('');
  }

  // Business data
  if (businessData) {
    lines.push('BUSINESS ENVIRONMENT:');
    lines.push(`- Total Establishments: ${businessData.totalEstablishments.toLocaleString()}`);
    if (businessData.totalEmployees) {
      lines.push(`- Total Employees: ${businessData.totalEmployees.toLocaleString()}`);
    }
    lines.push(`- Retail Establishments: ${businessData.retailEstablishments.toLocaleString()}`);
    lines.push(`- Food Service Establishments: ${businessData.foodServiceEstablishments.toLocaleString()}`);
    lines.push(`- Healthcare Establishments: ${businessData.healthcareEstablishments.toLocaleString()}`);
    lines.push(`- Professional Services: ${businessData.professionalServicesEstablishments.toLocaleString()}`);
    lines.push(`- Manufacturing: ${businessData.manufacturingEstablishments.toLocaleString()}`);
    lines.push('');
    lines.push('TOP INDUSTRIES:');
    businessData.topIndustries.slice(0, 5).forEach((industry, index) => {
      lines.push(`  ${index + 1}. ${industry.name}: ${industry.establishmentCount} establishments`);
    });
    lines.push(`- Data Source: Census CBP ${businessData.dataYear}`);
  } else {
    lines.push('BUSINESS ENVIRONMENT: Data unavailable');
  }

  return lines.join('\n');
}

/**
 * Parse GPT response into HighestBestUse
 */
function parseHBUResponse(response: Record<string, unknown>): HighestBestUse {
  const validTypes: CommercialPropertyType[] = ['retail', 'office', 'industrial', 'multifamily', 'mixed-use', 'land'];
  const validConfidence: ConfidenceLevel[] = ['high', 'medium', 'low'];

  const recommendation = validTypes.includes(response.recommendation as CommercialPropertyType)
    ? (response.recommendation as CommercialPropertyType)
    : 'mixed-use';

  const confidence = validConfidence.includes(response.confidence as ConfidenceLevel)
    ? (response.confidence as ConfidenceLevel)
    : 'medium';

  return {
    recommendation,
    confidence,
    reasoning: String(response.reasoning || 'Analysis based on available demographic and business data.'),
    keyFactors: Array.isArray(response.keyFactors)
      ? response.keyFactors.map(String).slice(0, 5)
      : [],
    alternativeUses: Array.isArray(response.alternativeUses)
      ? response.alternativeUses.slice(0, 3).map((alt: Record<string, unknown>) => ({
          type: validTypes.includes(alt.type as CommercialPropertyType)
            ? (alt.type as CommercialPropertyType)
            : 'land',
          viability: validConfidence.includes(alt.viability as ConfidenceLevel)
            ? (alt.viability as ConfidenceLevel)
            : 'low',
          notes: String(alt.notes || ''),
        }))
      : [],
    considerations: Array.isArray(response.considerations)
      ? response.considerations.map(String).slice(0, 5)
      : [],
    risks: Array.isArray(response.risks)
      ? response.risks.map(String).slice(0, 5)
      : [],
    generatedAt: new Date(),
    modelUsed: 'gpt-4o-mini',
  };
}

/**
 * Create fallback analysis when GPT fails
 */
function createFallbackAnalysis(
  address: ParsedAddress,
  demographics: DemographicsData | null,
  businessData: BusinessData | null
): HighestBestUse {
  // Simple rule-based fallback
  let recommendation: CommercialPropertyType = 'mixed-use';
  let confidence: ConfidenceLevel = 'low';
  const keyFactors: string[] = [];
  const considerations: string[] = ['AI analysis unavailable - using rule-based fallback'];

  if (demographics) {
    const income = demographics.medianHouseholdIncome;
    const population = demographics.population;

    if (income > 75000 && population > 50000) {
      recommendation = 'retail';
      keyFactors.push('High median income area');
      keyFactors.push('Significant population base');
      confidence = 'medium';
    } else if (income > 60000 && demographics.educationBachelorOrHigher && demographics.educationBachelorOrHigher > 35) {
      recommendation = 'office';
      keyFactors.push('Educated workforce');
      keyFactors.push('Above-average income');
      confidence = 'medium';
    } else if (income >= 40000 && income <= 80000) {
      recommendation = 'multifamily';
      keyFactors.push('Middle-income area suitable for rental housing');
      confidence = 'medium';
    }
  }

  if (businessData) {
    if (businessData.manufacturingEstablishments > businessData.retailEstablishments) {
      recommendation = 'industrial';
      keyFactors.push('Strong manufacturing presence');
    }
  }

  return {
    recommendation,
    confidence,
    reasoning: `Based on available data for ${address.city}, ${address.state}. This is a simplified analysis due to AI service unavailability.`,
    keyFactors,
    alternativeUses: [
      { type: 'mixed-use', viability: 'medium', notes: 'Diversified approach reduces risk' },
    ],
    considerations,
    risks: ['Analysis based on limited rule-based logic'],
    generatedAt: new Date(),
    modelUsed: 'rule-based-fallback',
  };
}

/**
 * Estimate cost of HBU analysis
 */
export function estimateHBUCost(): number {
  // GPT-4o-mini: ~$0.15/1M input tokens, ~$0.60/1M output tokens
  // Typical analysis: ~1500 input tokens, ~500 output tokens
  // Cost: ~$0.0003 per analysis
  return 0.001; // Round up for safety
}
