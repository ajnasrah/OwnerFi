import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logError, logInfo } from '@/lib/logger';
import { ExtendedSession } from '@/types/session';
import * as XLSX from 'xlsx';

// Export all properties to Excel
export async function GET(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    // Admin access control
    const session = await // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getServerSession(authOptions as any) as ExtendedSession | null;

    if (!session?.user || (session as ExtendedSession).user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Access denied. Admin access required.' },
        { status: 403 }
      );
    }

    // Fetch all properties
    const propertiesQuery = query(
      collection(db, 'properties'),
      orderBy('createdAt', 'asc')
    );

    const propertiesSnapshot = await getDocs(propertiesQuery);
    const properties = propertiesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      // Convert Firestore timestamps
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt
    }));

    // Format data for Excel
    const excelData = properties.map(property => ({
      // Core Identification
      'Property ID': property.id,
      'MLS Number': property.mlsNumber || '',

      // Address & Location
      'Address': property.address,
      'City': property.city,
      'State': property.state,
      'ZIP Code': property.zipCode,
      'County': property.county || '',
      'Neighborhood': property.neighborhood || '',
      'Latitude': property.latitude || '',
      'Longitude': property.longitude || '',

      // Property Details
      'Property Type': property.propertyType,
      'Bedrooms': property.bedrooms,
      'Bathrooms': property.bathrooms,
      'Square Feet': property.squareFeet || '',
      'Lot Size': property.lotSize || '',
      'Year Built': property.yearBuilt || '',
      'Stories': property.stories || '',
      'Garage': property.garage || '',

      // Financial Information
      'List Price': property.listPrice,
      'Down Payment Amount': property.downPaymentAmount,
      'Down Payment Percent': property.downPaymentPercent,
      'Monthly Payment': property.monthlyPayment,
      'Interest Rate': property.interestRate,
      'Term (Years)': property.termYears,
      'Balloon Payment': property.balloonPayment || '',
      'Balloon Years': property.balloonYears || '',

      // Property Features
      'Features': Array.isArray(property.features) ? property.features.join(', ') : '',
      'Appliances': Array.isArray(property.appliances) ? property.appliances.join(', ') : '',
      'Heating': property.heating || '',
      'Cooling': property.cooling || '',
      'Parking': property.parking || '',

      // Media
      'Image URLs': Array.isArray(property.imageUrls) ? property.imageUrls.join(', ') : '',
      'Virtual Tour URL': property.virtualTourUrl || '',
      'Floor Plan URL': property.floorPlanUrl || '',

      // Description
      'Title': property.title || '',
      'Description': property.description || '',
      'Highlights': Array.isArray(property.highlights) ? property.highlights.join(', ') : '',

      // Owner/Contact Information
      'Owner Name': property.ownerName || '',
      'Owner Phone': property.ownerPhone || '',
      'Owner Email': property.ownerEmail || '',
      'Agent Name': property.agentName || '',
      'Agent Phone': property.agentPhone || '',
      'Agent Email': property.agentEmail || '',

      // Listing Management
      'Status': property.status,
      'Is Active': property.isActive ? 'Yes' : 'No',
      'Date Added': property.dateAdded || '',
      'Last Updated': property.lastUpdated || '',
      'Expiration Date': property.expirationDate || '',
      'Priority': property.priority || '',
      'Featured': property.featured ? 'Yes' : 'No',

      // Market Data
      'Estimated Value': property.estimatedValue || '',
      'Price Per Sq Ft': property.pricePerSqFt || '',
      'Days On Market': property.daysOnMarket || '',
      'View Count': property.viewCount || '',
      'Favorite Count': property.favoriteCount || '',

      // HOA & Taxes
      'Has HOA': property.hoa?.hasHOA ? 'Yes' : 'No',
      'HOA Monthly Fee': property.hoa?.monthlyFee || '',
      'Annual Taxes': property.taxes?.annualAmount || '',
      'Assessed Value': property.taxes?.assessedValue || '',

      // Source
      'Source': property.source || '',
      'Source ID': property.sourceId || '',

      // Timestamps
      'Created At': property.createdAt || '',
      'Updated At': property.updatedAt || ''
    }));

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);

    // Set column widths for better readability
    const colWidths = [
      { wch: 15 }, // Property ID
      { wch: 15 }, // MLS Number
      { wch: 30 }, // Address
      { wch: 20 }, // City
      { wch: 10 }, // State
      { wch: 10 }, // ZIP Code
      { wch: 15 }, // County
      { wch: 20 }, // Neighborhood
      { wch: 12 }, // Latitude
      { wch: 12 }, // Longitude
      { wch: 15 }, // Property Type
      { wch: 10 }, // Bedrooms
      { wch: 10 }, // Bathrooms
      { wch: 12 }, // Square Feet
      { wch: 12 }, // Lot Size
      { wch: 10 }, // Year Built
      { wch: 10 }, // Stories
      { wch: 10 }, // Garage
      { wch: 12 }, // List Price
      { wch: 15 }, // Down Payment Amount
      { wch: 15 }, // Down Payment Percent
      { wch: 15 }, // Monthly Payment
      { wch: 12 }, // Interest Rate
      { wch: 10 }, // Term (Years)
      { wch: 15 }, // Balloon Payment
      { wch: 12 }, // Balloon Years
      { wch: 40 }, // Features
      { wch: 30 }, // Appliances
      { wch: 15 }, // Heating
      { wch: 15 }, // Cooling
      { wch: 15 }, // Parking
      { wch: 50 }, // Image URLs
      { wch: 30 }, // Virtual Tour URL
      { wch: 30 }, // Floor Plan URL
      { wch: 30 }, // Title
      { wch: 50 }, // Description
      { wch: 40 }, // Highlights
      { wch: 20 }, // Owner Name
      { wch: 15 }, // Owner Phone
      { wch: 25 }, // Owner Email
      { wch: 20 }, // Agent Name
      { wch: 15 }, // Agent Phone
      { wch: 25 }, // Agent Email
      { wch: 12 }, // Status
      { wch: 10 }, // Is Active
      { wch: 20 }, // Date Added
      { wch: 20 }, // Last Updated
      { wch: 20 }, // Expiration Date
      { wch: 10 }, // Priority
      { wch: 10 }, // Featured
      { wch: 15 }, // Estimated Value
      { wch: 15 }, // Price Per Sq Ft
      { wch: 12 }, // Days On Market
      { wch: 12 }, // View Count
      { wch: 12 }, // Favorite Count
      { wch: 10 }, // Has HOA
      { wch: 15 }, // HOA Monthly Fee
      { wch: 15 }, // Annual Taxes
      { wch: 15 }, // Assessed Value
      { wch: 12 }, // Source
      { wch: 15 }, // Source ID
      { wch: 20 }, // Created At
      { wch: 20 }  // Updated At
    ];
    ws['!cols'] = colWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Properties');

    // Generate buffer
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Log export action
    await logInfo('Properties exported to Excel', {
      action: 'admin_properties_export',
      metadata: {
        count: properties.length,
        exportedBy: session.user.email
      }
    });

    // Create filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `properties_export_${timestamp}.xlsx`;

    // Return Excel file
    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    });

  } catch (error) {
    await logError('Failed to export properties to Excel', {
      action: 'admin_properties_export_error'
    }, error as Error);

    return NextResponse.json(
      { error: 'Failed to export properties' },
      { status: 500 }
    );
  }
}
