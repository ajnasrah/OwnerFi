import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { ExtendedSession } from '@/types/session';
import * as XLSX from 'xlsx';

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

    // Transform data to GHL format
    const ghlData = snapshot.docs.map(doc => {
      const data = doc.data();

      // Format address
      const fullAddress = data.fullAddress || `${data.streetAddress || ''}, ${data.city || ''}, ${data.state || ''} ${data.zipCode || ''}`.trim();

      // Get first image or empty string
      const imageUrl = Array.isArray(data.propertyImages) && data.propertyImages.length > 0
        ? data.propertyImages[0]
        : '';

      return {
        // GHL Custom Fields
        'property_id': doc.id,
        'property_address': data.streetAddress || data.fullAddress || '',
        'property_city': data.city || '',
        'property_state': data.state || '',
        'property_zip': data.zipCode || '',
        'property_price': data.price || 0,
        'property_bedrooms': data.bedrooms || 0,
        'property_bathrooms': data.bathrooms || 0,
        'property_sqft': data.squareFoot || 0,
        'property_image_url': imageUrl,

        // Additional property details for reference
        'full_address': fullAddress,
        'building_type': data.buildingType || '',
        'year_built': data.yearBuilt || '',
        'lot_sqft': data.lotSquareFoot || 0,
        'estimate': data.estimate || 0,
        'hoa': data.hoa || 0,
        'annual_tax': data.annualTaxAmount || 0,
        'recent_property_taxes': data.recentPropertyTaxes || 0,
        'description': data.description || '',
        'agent_name': data.agentName || '',
        'agent_phone': data.agentPhoneNumber || '',
        'broker_name': data.brokerName || '',
        'broker_phone': data.brokerPhoneNumber || '',
        'url': data.url || '',
        'source': data.source || '',
        'imported_at': data.importedAt?.toDate?.()?.toISOString() || data.importedAt || '',
        'all_images': Array.isArray(data.propertyImages) ? data.propertyImages.join('|') : '',
      };
    });

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(ghlData);

    // Set column widths
    const colWidths = [
      { wch: 20 }, // property_id
      { wch: 40 }, // property_address
      { wch: 20 }, // property_city
      { wch: 10 }, // property_state
      { wch: 10 }, // property_zip
      { wch: 12 }, // property_price
      { wch: 10 }, // property_bedrooms
      { wch: 10 }, // property_bathrooms
      { wch: 12 }, // property_sqft
      { wch: 50 }, // property_image_url
      { wch: 50 }, // full_address
      { wch: 20 }, // building_type
      { wch: 10 }, // year_built
      { wch: 12 }, // lot_sqft
      { wch: 12 }, // estimate
      { wch: 10 }, // hoa
      { wch: 12 }, // annual_tax
      { wch: 12 }, // recent_property_taxes
      { wch: 50 }, // description
      { wch: 20 }, // agent_name
      { wch: 15 }, // agent_phone
      { wch: 20 }, // broker_name
      { wch: 15 }, // broker_phone
      { wch: 50 }, // url
      { wch: 15 }, // source
      { wch: 20 }, // imported_at
      { wch: 80 }, // all_images
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
