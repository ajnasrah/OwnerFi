import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { collection, query, getDocs, orderBy, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logError, logInfo } from '@/lib/logger';
import { ExtendedSession } from '@/types/session';
import * as XLSX from 'xlsx';

// Export all properties to Excel
export async function GET(_request: NextRequest) {
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

    // Fetch ALL active owner finance properties from unified properties collection
    console.log('[EXPORT] Starting property export...');

    const propertiesQuery = query(
      collection(db, 'properties'),
      where('isActive', '==', true),
      where('isOwnerFinance', '==', true),
      orderBy('createdAt', 'desc')
    );

    console.log('[EXPORT] Querying properties collection...');
    const propertiesSnapshot = await getDocs(propertiesQuery);
    console.log(`[EXPORT] Found ${propertiesSnapshot.docs.length} properties`);

    if (propertiesSnapshot.empty) {
      console.log('[EXPORT] No properties found');
      return NextResponse.json(
        { error: 'No properties found to export' },
        { status: 404 }
      );
    }

    const properties = propertiesSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        // Convert Firestore timestamps
        foundAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        verifiedAt: data.verifiedAt?.toDate?.()?.toISOString() || data.verifiedAt,
        soldAt: data.soldAt?.toDate?.()?.toISOString() || data.soldAt,
        importedAt: data.importedAt?.toDate?.()?.toISOString() || data.importedAt,
        ghlSentAt: data.ghlSentAt?.toDate?.()?.toISOString() || data.ghlSentAt,
      };
    });

    console.log(`[EXPORT] Formatted ${properties.length} properties for Excel`);

    // Format data for Excel
    const excelData = properties.map(property => {
      const prop = property as any;
      return {
        // Core Identification
        'Property ID': prop.id || '',
        'ZPID': prop.zpid || '',
        'Status': prop.status || 'pending',

        // Address & Location
        'Full Address': prop.fullAddress || '',
        'Street Address': prop.streetAddress || '',
        'City': prop.city || '',
        'State': prop.state || '',
        'ZIP Code': prop.zipCode || '',

        // Property Details
        'Home Type': prop.homeType || '',
        'Home Status': prop.homeStatus || '',
        'Bedrooms': prop.bedrooms || '',
        'Bathrooms': prop.bathrooms || '',
        'Square Feet': prop.squareFoot || '',
        'Lot Square Feet': prop.lotSquareFoot || '',
        'Year Built': prop.yearBuilt || '',

        // Financial Information
        'Price': prop.price || '',
        'Estimate (Zestimate)': prop.estimate || '',
        'Rent Estimate': prop.rentEstimate || '',
        'HOA': prop.hoa || '',
        'Annual Tax Amount': prop.annualTaxAmount || '',

        // Owner Financing Terms
        'Down Payment Amount': prop.downPaymentAmount || 'TBD',
        'Down Payment Percent': prop.downPaymentPercent || 'TBD',
        'Monthly Payment': prop.monthlyPayment || 'TBD',
        'Interest Rate': prop.interestRate || 'TBD',
        'Loan Term Years': prop.loanTermYears || 'TBD',
        'Balloon Payment Years': prop.balloonPaymentYears || 'TBD',

        // Agent/Broker Contact
        'Agent Name': prop.agentName || '',
        'Agent Phone': prop.agentPhoneNumber || '',
        'Broker Name': prop.brokerName || '',
        'Broker Phone': prop.brokerPhoneNumber || '',

        // Owner Finance Keywords
        'Owner Finance Verified': prop.ownerFinanceVerified ? 'Yes' : 'No',
        'Primary Keyword': prop.primaryKeyword || '',
        'All Matched Keywords': Array.isArray(prop.matchedKeywords) ? prop.matchedKeywords.join(', ') : '',

        // Description
        'Description': (prop.description || '').substring(0, 500), // Limit to 500 chars for Excel

        // Media
        'Zillow URL': prop.url || '',
        'First Property Image': prop.firstPropertyImage || '',
        'All Property Images': Array.isArray(prop.propertyImages) ? prop.propertyImages.join(' | ') : '',

        // GHL Integration Status
        'Sent to GHL': prop.sentToGHL ? 'Yes' : 'No',
        'GHL Sent At': prop.ghlSentAt || '',
        'GHL Send Status': prop.ghlSendStatus || '',

        // Timestamps
        'Found At': prop.foundAt || '',
        'Verified At': prop.verifiedAt || '',
        'Sold At': prop.soldAt || '',
        'Imported At': prop.importedAt || '',
      };
    });

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);

    // Set column widths for better readability
    const colWidths = [
      { wch: 25 }, // Property ID
      { wch: 15 }, // ZPID
      { wch: 15 }, // Status
      { wch: 50 }, // Full Address
      { wch: 35 }, // Street Address
      { wch: 20 }, // City
      { wch: 10 }, // State
      { wch: 12 }, // ZIP Code
      { wch: 18 }, // Home Type
      { wch: 15 }, // Home Status
      { wch: 12 }, // Bedrooms
      { wch: 12 }, // Bathrooms
      { wch: 15 }, // Square Feet
      { wch: 18 }, // Lot Square Feet
      { wch: 15 }, // Year Built
      { wch: 15 }, // Price
      { wch: 18 }, // Estimate (Zestimate)
      { wch: 18 }, // Rent Estimate
      { wch: 12 }, // HOA
      { wch: 20 }, // Annual Tax Amount
      { wch: 20 }, // Down Payment Amount
      { wch: 22 }, // Down Payment Percent
      { wch: 18 }, // Monthly Payment
      { wch: 15 }, // Interest Rate
      { wch: 18 }, // Loan Term Years
      { wch: 22 }, // Balloon Payment Years
      { wch: 25 }, // Agent Name
      { wch: 18 }, // Agent Phone
      { wch: 25 }, // Broker Name
      { wch: 18 }, // Broker Phone
      { wch: 20 }, // Owner Finance Verified
      { wch: 25 }, // Primary Keyword
      { wch: 50 }, // All Matched Keywords
      { wch: 60 }, // Description
      { wch: 60 }, // Zillow URL
      { wch: 60 }, // First Property Image
      { wch: 80 }, // All Property Images
      { wch: 15 }, // Sent to GHL
      { wch: 20 }, // GHL Sent At
      { wch: 20 }, // GHL Send Status
      { wch: 20 }, // Found At
      { wch: 20 }, // Verified At
      { wch: 20 }, // Sold At
      { wch: 20 }, // Imported At
    ];
    ws['!cols'] = colWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Properties');

    // Generate buffer
    console.log('[EXPORT] Generating Excel buffer...');
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    console.log(`[EXPORT] Excel buffer generated: ${excelBuffer.length} bytes`);

    // Log export action
    await logInfo('Properties exported to Excel', {
      action: 'admin_properties_export',
      metadata: {
        count: properties.length,
        columns: Object.keys(excelData[0] || {}).length,
        exportedBy: session.user.email
      }
    });

    // Create filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `owner_finance_properties_${timestamp}.xlsx`;

    console.log(`[EXPORT] Sending file: ${filename} (${properties.length} properties, ${excelBuffer.length} bytes)`);

    // Return Excel file
    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': excelBuffer.length.toString(),
      }
    });

  } catch (error) {
    console.error('[EXPORT] Error during export:', error);
    await logError('Failed to export properties to Excel', {
      action: 'admin_properties_export_error'
    }, error as Error);

    return NextResponse.json(
      {
        error: 'Failed to export properties',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
