import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { doc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logError, logInfo } from '@/lib/logger';
import { ExtendedSession } from '@/types/session';
import { PropertyListing } from '@/lib/property-schema';
import { analyzePropertyImageAsync } from '@/lib/image-quality-analyzer';
import { autoCleanPropertyData } from '@/lib/property-auto-cleanup';

/**
 * Create a new property manually via admin form
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json();

    // Validate required fields
    const requiredFields = [
      'address', 'city', 'state', 'zipCode',
      'propertyType', 'bedrooms', 'bathrooms',
      'listPrice', 'downPaymentAmount', 'downPaymentPercent',
      'monthlyPayment', 'interestRate', 'termYears'
    ];

    const missingFields = requiredFields.filter(field => !body[field]);
    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      );
    }

    // Generate property ID
    const propertyId = `prop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Parse image URLs (comma-separated string to array)
    const imageUrls = body.imageUrls
      ? body.imageUrls.split(',').map((url: string) => url.trim()).filter(Boolean)
      : [];

    // Parse features (comma-separated string to array)
    const features = body.features
      ? body.features.split(',').map((f: string) => f.trim()).filter(Boolean)
      : [];

    // Build property data
    const propertyData: Partial<PropertyListing> = {
      // Core Identification
      id: propertyId,
      mlsNumber: body.mlsNumber || undefined,

      // Address & Location
      address: body.address,
      city: body.city,
      state: body.state,
      zipCode: body.zipCode,
      county: body.county || undefined,
      neighborhood: body.neighborhood || undefined,

      // Property Details
      propertyType: body.propertyType,
      bedrooms: Number(body.bedrooms),
      bathrooms: Number(body.bathrooms),
      squareFeet: body.squareFeet ? Number(body.squareFeet) : undefined,
      lotSize: body.lotSize ? Number(body.lotSize) : undefined,
      yearBuilt: body.yearBuilt ? Number(body.yearBuilt) : undefined,
      stories: body.stories ? Number(body.stories) : undefined,
      garage: body.garage ? Number(body.garage) : undefined,

      // Financial Information
      listPrice: Number(body.listPrice),
      downPaymentAmount: Number(body.downPaymentAmount),
      downPaymentPercent: Number(body.downPaymentPercent),
      monthlyPayment: Number(body.monthlyPayment),
      interestRate: Number(body.interestRate),
      termYears: Number(body.termYears),
      balloonPayment: body.balloonPayment ? Number(body.balloonPayment) : null,
      balloonYears: body.balloonYears ? Number(body.balloonYears) : undefined,

      // Property Features
      features: features.length > 0 ? features : undefined,
      heating: body.heating || undefined,
      cooling: body.cooling || undefined,
      parking: body.parking || undefined,

      // Media
      imageUrls: imageUrls,
      virtualTourUrl: body.virtualTourUrl || undefined,

      // Description & Marketing
      title: body.title || `${body.address}, ${body.city}, ${body.state}`,
      description: body.description || '',

      // Owner/Contact Information
      ownerName: body.ownerName || undefined,
      ownerPhone: body.ownerPhone || undefined,
      ownerEmail: body.ownerEmail || undefined,

      // Listing Management
      status: body.status || 'active',
      isActive: body.isActive !== undefined ? body.isActive : true,
      dateAdded: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      priority: body.priority ? Number(body.priority) : 5,
      featured: body.featured || false,

      // HOA
      hoa: body.hasHOA ? {
        hasHOA: true,
        monthlyFee: body.hoaMonthlyFee ? Number(body.hoaMonthlyFee) : undefined,
        restrictions: body.hoaRestrictions ? body.hoaRestrictions.split(',').map((r: string) => r.trim()) : undefined
      } : undefined,

      // Taxes
      taxes: body.annualTaxes ? {
        annualAmount: Number(body.annualTaxes),
        assessedValue: body.assessedValue ? Number(body.assessedValue) : undefined
      } : undefined,

      // Integration Data
      source: 'manual',
      sourceId: undefined,

      // Location Analytics (placeholder)
      nearbyCities: [],
      nearbyCitiesSource: undefined,
      nearbyCitiesUpdatedAt: undefined
    };

    // Auto-cleanup: Clean address and upgrade image URLs
    const cleanedData = autoCleanPropertyData({
      address: propertyData.address,
      city: propertyData.city,
      state: propertyData.state,
      zipCode: propertyData.zipCode,
      imageUrl: propertyData.imageUrl,
      imageUrls: propertyData.imageUrls,
      zillowImageUrl: propertyData.zillowImageUrl
    });

    // Apply cleaned data
    if (cleanedData.address) propertyData.address = cleanedData.address;
    if (cleanedData.imageUrl) propertyData.imageUrl = cleanedData.imageUrl;
    if (cleanedData.imageUrls) propertyData.imageUrls = cleanedData.imageUrls;
    if (cleanedData.zillowImageUrl) propertyData.zillowImageUrl = cleanedData.zillowImageUrl;

    // Save to Firestore
    await setDoc(doc(db, 'properties', propertyId), {
      ...propertyData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    logInfo('Manual property created', {
      action: 'admin_manual_property_create',
      metadata: { propertyId, address: body.address }
    });

    // Analyze image quality in background (non-blocking)
    if (imageUrls.length > 0 && db) {
      const primaryImage = imageUrls[0];
      analyzePropertyImageAsync(
        propertyId,
        primaryImage,
        body.address,
        async (data) => {
          await updateDoc(doc(db, 'properties', propertyId), data);
        }
      );
    }

    // Auto-add to property rotation queue (non-blocking)
    // Only if property is active and has images
    if (propertyData.status === 'active' && propertyData.isActive && imageUrls.length > 0) {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        const webhookSecret = process.env.WEBHOOK_SECRET || process.env.CRON_SECRET;

        // Call add-to-queue endpoint in background
        fetch(`${baseUrl}/api/property/add-to-queue`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${webhookSecret}`
          },
          body: JSON.stringify({ propertyId })
        }).catch(err => {
          // Log but don't fail property creation
          console.error('Failed to auto-add property to queue:', err);
        });

        console.log(`🎥 Auto-adding property ${propertyId} to video queue`);
      } catch (error) {
        console.error('Error triggering auto-add to queue:', error);
        // Don't fail property creation if queue add fails
      }
    }

    return NextResponse.json({
      success: true,
      propertyId,
      message: 'Property created successfully'
    });

  } catch (error) {
    await logError('Failed to create manual property', {
      action: 'admin_manual_property_create_error'
    }, error as Error);

    return NextResponse.json(
      { error: 'Failed to create property', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
