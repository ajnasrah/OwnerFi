#!/usr/bin/env python3
"""
Analyze which fields have data in the CSV
"""

import json

json_path = '/Users/abdullahabunasrah/Downloads/opportunities.json'

with open(json_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

print('Checking which properties have financial data...\n')

# Sample a few properties
for i, prop in enumerate(data[:10]):
    addr = prop.get('Property Address', 'Unknown')
    price = prop.get('Price ', '')
    down = prop.get('down payment amount ', '')
    monthly = prop.get('Monthly payment', '')
    interest = prop.get('Interest rate ', '')

    print(f'Property {i+1}: {addr}')
    print(f'  Price: "{price}"')
    print(f'  Down Payment: "{down}"')
    print(f'  Monthly Payment: "{monthly}"')
    print(f'  Interest Rate: "{interest}"')
    print()

# Count totals
has_monthly = 0
has_down = 0
has_interest = 0
has_price = 0
total = len(data)

for prop in data:
    if prop.get('Monthly payment', '').strip() and prop.get('Monthly payment', '').strip() != 'undefined':
        has_monthly += 1
    if prop.get('down payment amount ', '').strip() and prop.get('down payment amount ', '').strip() != 'undefined':
        has_down += 1
    if prop.get('Interest rate ', '').strip() and prop.get('Interest rate ', '').strip() != 'undefined':
        has_interest += 1
    if prop.get('Price ', '').strip() and prop.get('Price ', '').strip() != 'undefined':
        has_price += 1

print(f'\nTotals out of {total} properties:')
print(f'  Has Price: {has_price}')
print(f'  Has Down Payment: {has_down}')
print(f'  Has Monthly Payment: {has_monthly}')
print(f'  Has Interest Rate: {has_interest}')
