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
    const properties = propertiesSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        // Convert Firestore timestamps
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt
      };
    });

    // Format data for Excel
    const excelData = properties.map(property => {
      const prop = property as any;
      return {
      // Core Identification
      'Property ID': prop.id,
      'MLS Number': prop.mlsNumber || '',

      // Address & Location
      'Address': prop.address,
      'City': prop.city,
      'State': prop.state,
      'ZIP Code': prop.zipCode,
      'County': prop.county || '',
      'Neighborhood': prop.neighborhood || '',
      'Latitude': prop.latitude || '',
      'Longitude': prop.longitude || '',

      // Property Details
      'Property Type': prop.propertyType,
      'Bedrooms': prop.bedrooms,
      'Bathrooms': prop.bathrooms,
      'Square Feet': prop.squareFeet || '',
      'Lot Size': prop.lotSize || '',
      'Year Built': prop.yearBuilt || '',
      'Stories': prop.stories || '',
      'Garage': prop.garage || '',

      // Financial Information
      'List Price': prop.listPrice,
      'Down Payment Amount': prop.downPaymentAmount,
      'Down Payment Percent': prop.downPaymentPercent,
      'Monthly Payment': prop.monthlyPayment,
      'Interest Rate': prop.interestRate,
      'Term (Years)': prop.termYears,
      'Balloon Payment': prop.balloonPayment || '',
      'Balloon Years': prop.balloonYears || '',

      // Property Features
      'Features': Array.isArray(prop.features) ? prop.features.join(', ') : '',
      'Appliances': Array.isArray(prop.appliances) ? prop.appliances.join(', ') : '',
      'Heating': prop.heating || '',
      'Cooling': prop.cooling || '',
      'Parking': prop.parking || '',

      // Media
      'Image URLs': Array.isArray(prop.imageUrls) ? prop.imageUrls.join(', ') : '',
      'Virtual Tour URL': prop.virtualTourUrl || '',
      'Floor Plan URL': prop.floorPlanUrl || '',

      // Description
      'Title': prop.title || '',
      'Description': prop.description || '',
      'Highlights': Array.isArray(prop.highlights) ? prop.highlights.join(', ') : '',

      // Owner/Contact Information
      'Owner Name': prop.ownerName || '',
      'Owner Phone': prop.ownerPhone || '',
      'Owner Email': prop.ownerEmail || '',
      'Agent Name': prop.agentName || '',
      'Agent Phone': prop.agentPhone || '',
      'Agent Email': prop.agentEmail || '',

      // Listing Management
      'Status': prop.status,
      'Is Active': prop.isActive ? 'Yes' : 'No',
      'Date Added': prop.dateAdded || '',
      'Last Updated': prop.lastUpdated || '',
      'Expiration Date': prop.expirationDate || '',
      'Priority': prop.priority || '',
      'Featured': prop.featured ? 'Yes' : 'No',

      // Market Data
      'Estimated Value': prop.estimatedValue || '',
      'Price Per Sq Ft': prop.pricePerSqFt || '',
      'Days On Market': prop.daysOnMarket || '',
      'View Count': prop.viewCount || '',
      'Favorite Count': prop.favoriteCount || '',

      // HOA & Taxes
      'Has HOA': prop.hoa?.hasHOA ? 'Yes' : 'No',
      'HOA Monthly Fee': prop.hoa?.monthlyFee || '',
      'Annual Taxes': prop.taxes?.annualAmount || '',
      'Assessed Value': prop.taxes?.assessedValue || '',

      // Source
      'Source': prop.source || '',
      'Source ID': prop.sourceId || '',

      // Timestamps
      'Created At': prop.createdAt || '',
      'Updated At': prop.updatedAt || ''
      };
    });

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
