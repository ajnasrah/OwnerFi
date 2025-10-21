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

export async function POST(request: NextRequest) {
  try {
    // Admin access control
    const session = await getServerSession(authOptions as any) as ExtendedSession | null;

    if (!session?.user || (session as ExtendedSession).user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Access denied. Admin access required.' },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Read CSV file
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data: any[] = XLSX.utils.sheet_to_json(worksheet);

    if (data.length === 0) {
      return NextResponse.json({ error: 'No data found in file' }, { status: 400 });
    }

    console.log(`Processing ${data.length} contacted properties`);

    // Process and store each property
    const batch = db.batch();
    let imported = 0;
    let skipped = 0;

    for (const row of data) {
      const propertyAddress = row['Property Address'] || row['property address'] || '';
      const contactName = row['Contact Name'] || row['contact name'] || '';
      const phone = row['phone'] || '';
      const email = row['email'] || '';

      if (!propertyAddress) {
        skipped++;
        continue;
      }

      // Extract street number and first word only for strict matching
      // Example: "1371 S Parkway E" -> "1371 s"
      const addressParts = propertyAddress.trim().toLowerCase().match(/^(\d+)\s+(\w+)/);
      const normalizedAddress = addressParts ? `${addressParts[1]} ${addressParts[2]}` : propertyAddress.trim().toLowerCase();
      const normalizedAgent = contactName.trim().toLowerCase();

      // Create a composite key: address + agent
      const compositeKey = `${normalizedAddress}__${normalizedAgent}`;

      // Store in contacted_properties collection
      const docRef = db.collection('contacted_properties').doc(compositeKey);
      batch.set(docRef, {
        propertyAddress: propertyAddress.trim(),
        normalizedAddress,
        contactName: contactName.trim(),
        normalizedAgent,
        phone: String(phone || '').trim(),
        email: String(email || '').trim(),
        city: String(row['Property city'] || row['city'] || ''),
        state: String(row['State '] || row['state'] || ''),
        zipCode: String(row['zip code '] || row['Zip code'] || ''),
        price: parseFloat(row['Price '] || row['price'] || 0),
        bedrooms: parseInt(row['bedrooms'] || 0),
        bathrooms: parseInt(row['bathrooms'] || 0),
        livingArea: parseInt(row['livingArea'] || 0),
        homeType: String(row['homeType'] || ''),
        yearBuilt: parseInt(row['yearBuilt'] || 0),
        imageLink: String(row['Image link'] || ''),
        taxAmount: parseFloat(row['Tax amount '] || 0),
        hoa: parseFloat(row['hoa '] || 0),
        zestimate: parseFloat(row['zestimate '] || 0),
        opportunityId: String(row['Opportunity ID'] || ''),
        contactId: String(row['Contact ID'] || ''),
        status: String(row['status'] || ''),
        stage: String(row['stage'] || ''),
        createdOn: String(row['Created on'] || ''),
        updatedOn: String(row['Updated on'] || ''),
        importedAt: new Date(),
        source: 'ghl-export'
      });

      imported++;

      // Firestore batch limit is 500
      if (imported % 400 === 0) {
        await batch.commit();
        console.log(`Committed batch: ${imported} properties`);
      }
    }

    // Commit remaining
    if (imported % 400 !== 0) {
      await batch.commit();
    }

    console.log(`Import complete: ${imported} imported, ${skipped} skipped`);

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      total: data.length
    });

  } catch (error: any) {
    console.error('Failed to import contacted properties:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to import' },
      { status: 500 }
    );
  }
}
