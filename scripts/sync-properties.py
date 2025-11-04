#!/usr/bin/env python3
"""
Sync all "exported to website" properties from GHL CSV to Firebase
"""

import csv
import json
import os
from datetime import datetime
import firebase_admin
from firebase_admin import credentials, firestore

# Initialize Firebase
cred_dict = json.loads(os.environ.get('FIREBASE_SERVICE_ACCOUNT', '{}'))
if not firebase_admin._apps:
    cred = credentials.Certificate(cred_dict)
    firebase_admin.initialize_app(cred)

db = firestore.client()

def parse_float(value):
    """Safely parse float from string"""
    if not value:
        return 0
    try:
        return float(str(value).replace(',', '').strip())
    except:
        return 0

def parse_int(value):
    """Safely parse int from string"""
    if not value:
        return 0
    try:
        return int(str(value).replace(',', '').strip())
    except:
        return 0

def parse_date(value):
    """Convert ISO date string to timestamp"""
    if not value:
        return firestore.SERVER_TIMESTAMP
    try:
        return datetime.fromisoformat(value.replace('Z', '+00:00'))
    except:
        return firestore.SERVER_TIMESTAMP

def sync_properties():
    print('🔄 Syncing GHL properties to Firebase...\n')

    csv_path = '/Users/abdullahabunasrah/Downloads/opportunities.csv'
    properties = []

    # Read CSV
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)

        for row in reader:
            # Only process "exported to website"
            if row.get('stage', '').strip().lower() != 'exported to website':
                continue

            opp_id = row.get('Opportunity ID', '').strip()
            address = row.get('Property Address', '').strip()

            if not opp_id or not address:
                continue

            property_data = {
                'opportunityId': opp_id,
                'contactId': row.get('Contact ID', '').strip(),
                'contactName': row.get('Contact Name', '').strip(),
                'address': address,
                'city': row.get('Property city', '').strip(),
                'state': row.get('State ', '').strip(),
                'zipCode': row.get('zip code ', '').strip(),
                'fullAddress': f"{address} {row.get('Property city', '')} {row.get('State ', '')} {row.get('zip code ', '')}".strip(),
                'price': parse_float(row.get('Price ', '0')),
                'bedrooms': parse_int(row.get('bedrooms', '0')),
                'bathrooms': parse_float(row.get('bathrooms', '0')),
                'livingArea': parse_int(row.get('livingArea', '0')),
                'homeType': row.get('homeType', '').strip(),
                'yearBuilt': parse_int(row.get('yearBuilt', '0')),
                'description': (row.get('New Description ', '') or row.get('description ', '')).strip(),
                'imageUrl': row.get('Image link', '').strip(),
                'balloon': parse_float(row.get('Balloon ', '0')),
                'interestRate': parse_float(row.get('Interest rate ', '0')),
                'downPaymentPercent': parse_float(row.get('down payment %', '0')),
                'monthlyPayment': parse_float(row.get('Monthly payment', '0')),
                'lotSize': parse_float(row.get('lot sizes', '0')),
                'taxAmount': parse_float(row.get('Tax amount ', '0')),
                'hoa': parse_float(row.get('hoa ', '0')),
                'zestimate': parse_float(row.get('zestimate ', '0')),
                'phone': row.get('phone', '').strip(),
                'email': row.get('email', '').strip(),
                'stage': row.get('stage', '').strip(),
                'createdAt': parse_date(row.get('Created on', '')),
                'updatedAt': parse_date(row.get('Updated on', '')),
            }

            properties.append(property_data)

    print(f'📊 Found {len(properties)} properties to sync\n')

    # Get existing properties
    existing_props = {}
    props_ref = db.collection('properties')
    for doc in props_ref.stream():
        data = doc.to_dict()
        if data.get('opportunityId'):
            existing_props[data['opportunityId']] = doc.id

    print(f'📦 Found {len(existing_props)} existing properties in Firebase\n')

    # Sync properties
    added = 0
    updated = 0
    errors = 0

    batch = db.batch()
    batch_count = 0

    for prop in properties:
        try:
            opp_id = prop['opportunityId']

            if opp_id in existing_props:
                # Update existing
                doc_ref = props_ref.document(existing_props[opp_id])
                batch.update(doc_ref, prop)
                updated += 1
            else:
                # Add new
                doc_ref = props_ref.document()
                batch.set(doc_ref, prop)
                added += 1

            batch_count += 1

            # Commit every 500
            if batch_count >= 500:
                batch.commit()
                print(f'   ✅ Committed batch (Added: {added}, Updated: {updated})')
                batch = db.batch()
                batch_count = 0

        except Exception as e:
            print(f'   ❌ Error processing {prop["address"]}: {e}')
            errors += 1

    # Commit remaining
    if batch_count > 0:
        batch.commit()
        print(f'   ✅ Committed final batch\n')

    print('=' * 80)
    print('📊 SYNC RESULTS')
    print('=' * 80)
    print(f'✅ Added: {added}')
    print(f'🔄 Updated: {updated}')
    print(f'❌ Errors: {errors}')
    print(f'📦 Total: {added + updated}')
    print('=' * 80)

    # Verify
    final_count = len(list(props_ref.stream()))
    print(f'\n✅ Final Firebase count: {final_count} properties')
    print(f'✅ GHL "exported to website" count: {len(properties)} properties\n')

    if final_count >= len(properties):
        print('🎉 SUCCESS! All properties are now synced!\n')
    else:
        print(f'⚠️  Mismatch: {len(properties) - final_count} properties difference\n')

if __name__ == '__main__':
    sync_properties()
