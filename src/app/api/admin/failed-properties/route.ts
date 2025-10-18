import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import {
  collection,
  query,
  getDocs,
  where,
  or,
  orderBy
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logError } from '@/lib/logger';
import { ExtendedSession } from '@/types/session';

/**
 * Get failed/problematic properties with filtering
 *
 * Filters:
 * - validation: Properties with validation errors or incomplete required fields
 * - withdrawn: Properties with status 'withdrawn' or 'expired'
 * - missing-data: Properties missing images, description, or other key data
 * - all: All failed properties (default)
 */
export async function GET(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    // Admin access control
    const session = await // eslint-disable-line @typescript-eslint/no-explicit-any
    getServerSession(authOptions as any) as ExtendedSession | null;

    if (!session?.user || (session as ExtendedSession).user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Access denied. Admin access required.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const filterType = searchParams.get('filter') || 'all';

    // Fetch all properties (we'll filter in memory for complex conditions)
    const propertiesQuery = query(
      collection(db, 'properties'),
      orderBy('dateAdded', 'desc')
    );

    const propertiesSnapshot = await getDocs(propertiesQuery);
    const allProperties = propertiesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      // Convert Firestore timestamps
      dateAdded: doc.data().dateAdded?.toDate?.()?.toISOString() || doc.data().dateAdded,
      lastUpdated: doc.data().lastUpdated?.toDate?.()?.toISOString() || doc.data().lastUpdated
    }));

    // Filter properties based on failure type
    let failedProperties = [];

    if (filterType === 'withdrawn' || filterType === 'all') {
      // Properties with status 'withdrawn' or 'expired'
      const withdrawnProps = allProperties.filter(prop =>
        prop.status === 'withdrawn' || prop.status === 'expired'
      );
      failedProperties.push(...withdrawnProps.map(p => ({ ...p, failureType: 'withdrawn' })));
    }

    if (filterType === 'missing-data' || filterType === 'all') {
      // Properties missing critical data
      const missingDataProps = allProperties.filter(prop => {
        const hasImages = Array.isArray(prop.imageUrls) && prop.imageUrls.length > 0;
        const hasDescription = prop.description && prop.description.trim().length > 10;
        const hasAddress = prop.address && prop.address.trim().length > 0;
        const hasPrice = prop.listPrice && prop.listPrice > 0;

        return !hasImages || !hasDescription || !hasAddress || !hasPrice;
      });

      failedProperties.push(...missingDataProps.map(p => ({
        ...p,
        failureType: 'missing-data',
        missingFields: [
          !Array.isArray(p.imageUrls) || p.imageUrls.length === 0 ? 'images' : null,
          !p.description || p.description.trim().length <= 10 ? 'description' : null,
          !p.address || p.address.trim().length === 0 ? 'address' : null,
          !p.listPrice || p.listPrice <= 0 ? 'price' : null
        ].filter(Boolean)
      })));
    }

    if (filterType === 'validation' || filterType === 'all') {
      // Properties with validation issues (missing required fields per schema)
      const validationProps = allProperties.filter(prop => {
        const requiredFields = [
          'address', 'city', 'state', 'zipCode',
          'propertyType', 'bedrooms', 'bathrooms',
          'listPrice', 'downPaymentAmount', 'downPaymentPercent',
          'monthlyPayment', 'interestRate', 'termYears'
        ];

        const missingRequired = requiredFields.some(field => {
          const value = prop[field];
          return value === undefined || value === null || value === '' ||
                 (typeof value === 'number' && isNaN(value));
        });

        return missingRequired;
      });

      failedProperties.push(...validationProps.map(p => ({
        ...p,
        failureType: 'validation',
        validationErrors: [
          !p.address ? 'Missing address' : null,
          !p.city ? 'Missing city' : null,
          !p.state ? 'Missing state' : null,
          !p.zipCode ? 'Missing zip code' : null,
          !p.propertyType ? 'Missing property type' : null,
          typeof p.bedrooms !== 'number' ? 'Missing bedrooms' : null,
          typeof p.bathrooms !== 'number' ? 'Missing bathrooms' : null,
          typeof p.listPrice !== 'number' ? 'Missing list price' : null,
          typeof p.downPaymentAmount !== 'number' ? 'Missing down payment amount' : null,
          typeof p.downPaymentPercent !== 'number' ? 'Missing down payment percent' : null,
          typeof p.monthlyPayment !== 'number' ? 'Missing monthly payment' : null,
          typeof p.interestRate !== 'number' ? 'Missing interest rate' : null,
          typeof p.termYears !== 'number' ? 'Missing term years' : null
        ].filter(Boolean)
      })));
    }

    // Remove duplicates (a property can match multiple failure types)
    const uniqueProperties = Array.from(
      new Map(failedProperties.map(p => [p.id, p])).values()
    );

    // Sort by date added (newest first)
    uniqueProperties.sort((a, b) => {
      const dateA = new Date(a.dateAdded || 0).getTime();
      const dateB = new Date(b.dateAdded || 0).getTime();
      return dateB - dateA;
    });

    return NextResponse.json({
      properties: uniqueProperties,
      count: uniqueProperties.length,
      filter: filterType,
      summary: {
        total: uniqueProperties.length,
        withdrawn: uniqueProperties.filter(p => p.failureType === 'withdrawn').length,
        missingData: uniqueProperties.filter(p => p.failureType === 'missing-data').length,
        validation: uniqueProperties.filter(p => p.failureType === 'validation').length
      }
    });

  } catch (error) {
    await logError('Failed to fetch failed properties', {
      action: 'admin_failed_properties_fetch'
    }, error as Error);

    return NextResponse.json(
      { error: 'Failed to fetch failed properties' },
      { status: 500 }
    );
  }
}
