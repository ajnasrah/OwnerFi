import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { validateImportedPayment } from '@/lib/payment-source-tracking';

/**
 * Analyze payment calculation vs import logic across all properties
 */
export async function GET() {
  try {
    console.log('🔍 ANALYZING: Payment sources (imported vs calculated) for all properties');
    
    // Get all properties
    const snapshot = await getDocs(collection(db, 'properties'));
    const properties = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    const analysis = properties.map(property => {
      const validation = validateImportedPayment(property);
      
      // Determine likely source based on validation
      const likelyImported = !validation.trustImported; // If calculation doesn't match, likely imported
      
      return {
        id: property.id,
        address: property.address,
        city: property.city,
        state: property.state,
        
        // Financial data
        listPrice: property.listPrice,
        monthlyPayment: property.monthlyPayment,
        downPaymentAmount: property.downPaymentAmount,
        interestRate: property.interestRate || 7.0,
        termYears: property.termYears || 20,
        
        // Validation results
        calculatedMonthlyPayment: validation.recommendedPayment,
        paymentDifference: validation.monthlyPaymentDifference,
        percentageDifference: Math.round((validation.monthlyPaymentDifference / Math.max(property.monthlyPayment, 1)) * 100),
        
        // Source inference
        monthlyPaymentSource: likelyImported ? 'imported' : 'calculated',
        trustLevel: validation.trustImported ? 'high' : 'low',
        
        // Display recommendations
        shouldShowAsEstimate: !validation.trustImported,
        displayLabel: validation.trustImported ? 'Monthly Payment' : 'Monthly Payment (est)',
        
        // Import source tracking
        source: property.source || 'unknown',
        hasPaymentMetadata: !!property.paymentMetadata
      };
    });
    
    // Group analysis
    const summary = {
      totalProperties: analysis.length,
      likelyImported: analysis.filter(a => a.monthlyPaymentSource === 'imported').length,
      likelyCalculated: analysis.filter(a => a.monthlyPaymentSource === 'calculated').length,
      highTrust: analysis.filter(a => a.trustLevel === 'high').length,
      lowTrust: analysis.filter(a => a.trustLevel === 'low').length,
      avgPaymentDifference: Math.round(analysis.reduce((sum, a) => sum + a.paymentDifference, 0) / analysis.length),
      maxPaymentDifference: Math.max(...analysis.map(a => a.paymentDifference)),
      shouldShowEstimates: analysis.filter(a => a.shouldShowAsEstimate).length
    };
    
    const bySource = analysis.reduce((acc: any, item) => {
      const source = item.source || 'unknown';
      if (!acc[source]) acc[source] = [];
      acc[source].push(item);
      return acc;
    }, {});
    
    // Get properties with biggest discrepancies (likely imported with different terms)
    const biggestDiscrepancies = analysis
      .filter(a => a.percentageDifference > 20)
      .sort((a, b) => b.percentageDifference - a.percentageDifference)
      .slice(0, 10);
    
    return NextResponse.json({
      paymentAnalysis: {
        summary,
        byImportSource: Object.entries(bySource).map(([source, properties]) => ({
          source,
          count: (properties as any[]).length,
          avgDifference: Math.round((properties as any[]).reduce((sum, p) => sum + p.paymentDifference, 0) / (properties as any[]).length)
        })),
        biggestDiscrepancies
      },
      currentLogic: {
        description: 'System prioritizes imported values over calculations',
        importSources: ['GHL webhooks', 'CSV uploads', 'Manual entry'],
        calculationTrigger: 'Only when monthlyPayment = 0 or missing',
        displayLogic: 'All payments show (est) currently - should distinguish imported vs calculated'
      },
      recommendations: [
        summary.shouldShowEstimates > summary.totalProperties / 2 
          ? '⚠️ Many properties need payment verification - consider re-calculating with current 20-year terms'
          : '✅ Most payments appear to be imported values',
        
        biggestDiscrepancies.length > 5
          ? `🔧 ${biggestDiscrepancies.length} properties have payment discrepancies >20% - review import data`
          : '✅ Payment data appears consistent',
          
        '🏷️ Update UI to show definitive vs estimated labels based on payment source'
      ],
      sampleAnalysis: analysis.slice(0, 10)
    });
    
  } catch (error) {
    console.error('Payment source analysis error:', error);
    return NextResponse.json({ 
      error: 'Analysis failed', 
      details: (error as Error).message 
    }, { status: 500 });
  }
}