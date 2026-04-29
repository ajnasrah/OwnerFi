import { NextRequest, NextResponse } from 'next/server';
import { getRankedMarkets, getQualifiedMarkets, getMarketAnalysis } from '@/lib/market-cost-analysis';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const minScore = parseInt(searchParams.get('minScore') || '50');
    const includeDetails = searchParams.get('details') === 'true';
    
    // Get all ranked markets
    const allMarkets = getRankedMarkets();
    
    // Get qualified markets above minimum score
    const qualifiedMarkets = getQualifiedMarkets(minScore);
    
    if (includeDetails) {
      // Include full analysis for each qualified market
      const detailedMarkets = qualifiedMarkets.map(city => ({
        city,
        analysis: getMarketAnalysis(city)
      }));
      
      return NextResponse.json({
        success: true,
        totalMarkets: allMarkets.length,
        qualifiedCount: qualifiedMarkets.length,
        minScore,
        detailedMarkets,
        topMarkets: allMarkets.slice(0, 10).map(m => ({
          city: m.city,
          score: m.score,
          medianPrice: m.data.medianHomePrice,
          rentYield: `${(m.data.rentToOwnRatio * 100).toFixed(1)}%`,
          propertyTax: `${m.data.propertyTaxRate}%`,
          insurance: `$${m.data.homeInsuranceAnnual.toLocaleString()}`,
          riskLevel: m.data.insuranceRiskLevel
        }))
      });
    } else {
      // Simple list format
      return NextResponse.json({
        success: true,
        totalMarkets: allMarkets.length,
        qualifiedCount: qualifiedMarkets.length,
        minScore,
        qualifiedMarkets,
        topMarkets: allMarkets.slice(0, 15).map(m => ({
          city: m.city,
          score: m.score
        })),
        message: `${qualifiedMarkets.length} markets qualify with score >= ${minScore}`
      });
    }
    
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}