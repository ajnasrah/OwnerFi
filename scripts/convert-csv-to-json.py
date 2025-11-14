#!/usr/bin/env python3
"""
Convert GoHighLevel CSV to JSON
This properly handles quoted fields with commas and ensures correct column alignment
"""

import csv
import json

csv_path = '/Users/abdullahabunasrah/Downloads/opportunities.csv'
json_path = '/Users/abdullahabunasrah/Downloads/opportunities.json'

properties = []

with open(csv_path, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        # Only export properties with stage = "exported to website"
        if row.get('stage', '').lower().strip() == 'exported to website':
            properties.append(row)

print(f"Found {len(properties)} properties with 'exported to website' stage")

# Write to JSON
with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(properties, f, indent=2)

print(f"Wrote JSON to: {json_path}")
print(f"\nFirst property sample:")
if properties:
    p = properties[0]
    print(f"  Address: {p.get('Property Address')}")
    print(f"  City: {p.get('Property city')}")
    print(f"  State: {p.get('State ')}")
    print(f"  Zip: {p.get('zip code ')}")
    print(f"  Price: {p.get('Price ')}")
    print(f"  Down Payment: {p.get('down payment amount ')}")
    print(f"  Monthly Payment: {p.get('Monthly payment')}")
