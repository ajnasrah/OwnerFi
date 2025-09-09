import { NextRequest, NextResponse } from 'next/server';
import { 
  collection, 
  getDocs
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * Verify ALL 63 properties have nearby cities populated
 */
export async function GET() {
  try {
    console.log('🔍 VERIFICATION: Checking ALL properties for nearby cities data...');
    
    const snapshot = await getDocs(collection(db, 'properties'));
    const properties = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    const verification = properties.map(property => {
      const hasNearbyCities = property.nearbyCities && Array.isArray(property.nearbyCities);
      const nearbyCitiesCount = property.nearbyCities?.length || 0;
      const isComprehensive = property.nearbyCitiesSource === 'comprehensive-database';
      const hasMinimumCities = nearbyCitiesCount >= 10; // Expect at least 10 cities for most areas
      
      return {
        id: property.id,
        address: property.address,
        city: property.city?.split(',')[0].trim(),
        state: property.state,
        hasNearbyCities,
        nearbyCitiesCount,
        isComprehensive,
        hasMinimumCities,
        status: hasNearbyCities && hasMinimumCities ? '✅ GOOD' : hasNearbyCities ? '⚠️ LIMITED' : '❌ MISSING',
        sampleCities: property.nearbyCities?.slice(0, 3) || [],
        lastUpdated: property.nearbyCitiesUpdatedAt ? 'Recently' : 'Never'
      };
    });

    const summary = {
      totalProperties: verification.length,
      withNearbyCities: verification.filter(v => v.hasNearbyCities).length,
      withoutNearbyCities: verification.filter(v => !v.hasNearbyCities).length,
      withGoodCoverage: verification.filter(v => v.hasMinimumCities).length,
      withLimitedCoverage: verification.filter(v => v.hasNearbyCities && !v.hasMinimumCities).length,
      isComprehensiveData: verification.filter(v => v.isComprehensive).length,
      avgNearbyCitiesCount: Math.round(verification.reduce((sum, v) => sum + v.nearbyCitiesCount, 0) / verification.length),
      maxNearbyCitiesCount: Math.max(...verification.map(v => v.nearbyCitiesCount)),
      minNearbyCitiesCount: Math.min(...verification.map(v => v.nearbyCitiesCount))
    };

    const byStatus = {
      good: verification.filter(v => v.status === '✅ GOOD'),
      limited: verification.filter(v => v.status === '⚠️ LIMITED'),
      missing: verification.filter(v => v.status === '❌ MISSING')
    };

    const dataQualityScore = Math.round((summary.withGoodCoverage / summary.totalProperties) * 100);

    return NextResponse.json({
      verification: {
        totalProperties: summary.totalProperties,
        dataQualityScore: `${dataQualityScore}%`,
        summary: summary
      },
      statusBreakdown: {
        good: { count: byStatus.good.length, percentage: Math.round((byStatus.good.length / summary.totalProperties) * 100) },
        limited: { count: byStatus.limited.length, percentage: Math.round((byStatus.limited.length / summary.totalProperties) * 100) },
        missing: { count: byStatus.missing.length, percentage: Math.round((byStatus.missing.length / summary.totalProperties) * 100) }
      },
      detailedResults: verification,
      topPerformers: verification
        .sort((a, b) => b.nearbyCitiesCount - a.nearbyCitiesCount)
        .slice(0, 5),
      needsAttention: verification
        .filter(v => v.status !== '✅ GOOD')
        .slice(0, 5),
      overallVerdict: dataQualityScore >= 90 ? '🎉 EXCELLENT' : dataQualityScore >= 75 ? '✅ GOOD' : dataQualityScore >= 50 ? '⚠️ NEEDS WORK' : '❌ POOR'
    });

  } catch (error) {
    console.error('❌ Verification failed:', error);
    return NextResponse.json(
      { error: 'Verification failed', details: (error as Error).message },
      { status: 500 }
    );
  }
}