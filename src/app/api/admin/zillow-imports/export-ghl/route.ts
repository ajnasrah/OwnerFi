import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { ExtendedSession } from '@/types/session';
import * as XLSX from 'xlsx';
import { sanitizeDescription } from '@/lib/description-sanitizer';

// Initialize Firebase Admin (if not already initialized)
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    }),
  });
}

const db = getFirestore();

export async function GET(request: NextRequest) {
  try {
    // Admin access control
    const session = await getServerSession(authOptions as any) as ExtendedSession | null;

    if (!session?.user || (session as ExtendedSession).user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Access denied. Admin access required.' },
        { status: 403 }
      );
    }

    // Fetch all properties from zillow_imports collection
    const snapshot = await db.collection('zillow_imports').orderBy('importedAt', 'desc').get();

    // Filter properties with agent OR broker phone number, then transform to GHL format
    const ghlData = snapshot.docs
      .filter(doc => {
        const data = doc.data();
        const hasAgentPhone = !!data.agentPhoneNumber;
        const hasBrokerPhone = !!data.brokerPhoneNumber;
        return hasAgentPhone || hasBrokerPhone;
      })
      .map(doc => {
        const data = doc.data();

        // Format address
        const fullAddress = data.fullAddress || `${data.streetAddress || ''}, ${data.city || ''}, ${data.state || ''} ${data.zipCode || ''}`.trim();

        // Get first image - use firstPropertyImage field (main hero image) with fallback
        const imageUrl = data.firstPropertyImage
          || (Array.isArray(data.propertyImages) && data.propertyImages.length > 0 ? data.propertyImages[0] : '')
          || '';

        return {
          // GHL Custom Fields
          'property_id': doc.id,
          'zpid': data.zpid || '',
          'mls_id': data.mlsId || '',
          'parcel_id': data.parcelId || '',
          'property_address': data.streetAddress || data.fullAddress || '',
          'property_city': data.city || '',
          'property_state': data.state || '',
          'property_zip': data.zipCode || '',
          'county': data.county || '',
          'subdivision': data.subdivision || '',
          'neighborhood': data.neighborhood || '',
          'property_price': data.price || 0,
          'property_bedrooms': data.bedrooms || 0,
          'property_bathrooms': data.bathrooms || 0,
          'property_sqft': data.squareFoot || 0,
          'lot_sqft': data.lotSquareFoot || 0,
          'year_built': data.yearBuilt || '',
          'building_type': data.buildingType || '',
          'home_type': data.homeType || '',
          'home_status': data.homeStatus || '',

          // Location
          'latitude': data.latitude || 0,
          'longitude': data.longitude || 0,

          // Financial
          'zestimate': data.estimate || 0,
          'rent_estimate': data.rentEstimate || 0,
          'hoa': data.hoa || 0,
          'annual_tax_paid': data.annualTaxAmount || 0,
          'tax_assessment_value': data.recentPropertyTaxes || 0,
          'property_tax_rate': data.propertyTaxRate || 0,
          'annual_insurance': data.annualHomeownersInsurance || 0,

          // Listing Info
          'days_on_zillow': data.daysOnZillow || 0,
          'date_posted': data.datePostedString || '',
          'listing_source': data.listingDataSource || '',

          // Agent/Broker
          'agent_name': data.agentName || '',
          'agent_phone': data.agentPhoneNumber || '',
          'agent_email': data.agentEmail || '',
          'agent_license': data.agentLicenseNumber || '',
          'broker_name': data.brokerName || '',
          'broker_phone': data.brokerPhoneNumber || '',

          // URLs
          'zillow_url': data.url || '',
          'virtual_tour_url': data.virtualTourUrl || '',

          // Images
          'property_image_url': imageUrl,

          // Description (sanitized for GHL compatibility)
          'description': sanitizeDescription(data.description),

          // Metadata
          'full_address': fullAddress,
          'source': data.source || '',
          'imported_at': data.importedAt?.toDate?.()?.toISOString() || data.importedAt || '',
        };
      });

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(ghlData);

    // Auto-size columns based on content
    const colWidths = [
      { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 40 }, { wch: 20 },
      { wch: 10 }, { wch: 10 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 12 },
      { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 20 },
      { wch: 20 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
      { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
      { wch: 20 }, { wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 20 }, { wch: 15 },
      { wch: 50 }, { wch: 50 }, { wch: 50 }, { wch: 80 }, { wch: 60 }, { wch: 50 },
      { wch: 15 }, { wch: 20 }
    ];
    ws['!cols'] = colWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Zillow Imports - GHL Format');

    // Generate buffer
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Create filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `zillow_imports_ghl_${timestamp}.xlsx`;

    // Return Excel file
    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    });

  } catch (error: any) {
    console.error('Failed to export zillow_imports to GHL format:', error);
    return NextResponse.json(
      { error: 'Failed to export properties' },
      { status: 500 }
    );
  }
}
