#!/usr/bin/env python3
"""
Verify Exported Properties

Extracts opportunity IDs from CSV and checks against Firebase database.
"""

import csv
import json
import subprocess

def extract_opportunity_ids(csv_path):
    """Extract opportunity IDs for properties marked 'exported to website'"""
    exported = []

    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            stage = row.get('stage', '').strip().lower()
            if stage == 'exported to website':
                opp_id = row.get('Opportunity ID', '').strip()
                opp_name = row.get('Opportunity Name', '').strip()
                address = row.get('Property Address', '').strip()
                city = row.get('Property city', '').strip()
                state = row.get('State ', '').strip()

                if opp_id:  # Only include if we have an ID
                    exported.append({
                        'id': opp_id,
                        'name': opp_name,
                        'address': f"{address}, {city}, {state}"
                    })

    return exported

if __name__ == '__main__':
    csv_path = '/Users/abdullahabunasrah/Downloads/opportunities.csv'

    print('🔍 Extracting "exported to website" properties from CSV...\n')
    exported_props = extract_opportunity_ids(csv_path)

    print(f'📋 Found {len(exported_props)} properties marked "exported to website"\n')

    # Write to temp file for TypeScript script to read
    with open('/tmp/exported-opportunity-ids.json', 'w') as f:
        json.dump(exported_props, f, indent=2)

    print('✅ Opportunity IDs extracted to /tmp/exported-opportunity-ids.json\n')

    # Show first 10
    print('📄 Sample of extracted IDs:\n')
    for i, prop in enumerate(exported_props[:10], 1):
        print(f"{i}. {prop['id']}")
        print(f"   Name: {prop['name']}")
        print(f"   Address: {prop['address']}\n")
