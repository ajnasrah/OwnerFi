#!/usr/bin/env python3
"""
Simple script to fill in city and state fields by parsing the Property Address field.
Extracts city and state from addresses in format: "Street, City, State Zip"

Usage: python fill_city_state_from_address.py input.csv output.csv
"""
import csv
import re
import sys
import os

# US State abbreviations for validation
US_STATES = {
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
}

def parse_address(address):
    """
    Parse address in multiple formats to extract city, state, and ZIP.
    Returns tuple: (city, state, zip_code)

    Supports formats:
    - "Street, City, State Zip" -> ("City", "State", "Zip")
    - "Street City State Zip" -> ("City", "State", "Zip")

    Examples:
    "9 Apple Tree Cir, Little Rock, AR 72210" -> ("Little Rock", "AR", "72210")
    "19229 Colonel Glenn Rd Little Rock AR 72210" -> ("Little Rock", "AR", "72210")
    "123 Main St, Dallas, TX 75201" -> ("Dallas", "TX", "75201")
    """
    if not address or not address.strip():
        return None, None, None

    address = address.strip()

    # Pattern to match STATE (2 letters) and optional ZIP (5 digits) at the end
    # Capture everything before the state
    match = re.search(r'^(.*?),?\s+([A-Z]{2})\s*(\d{5})?$', address)

    if not match:
        return None, None, None

    before_state = match.group(1).strip()
    state = match.group(2).upper()
    zip_code = match.group(3) if match.group(3) else None

    # Validate state abbreviation
    if state not in US_STATES:
        return None, None, None

    # Extract city from the part before state
    # Format 1: "Street, City, ST ZIP" -> before_state = "Street, City"
    # Format 2: "Street City ST ZIP" -> before_state = "Street City"
    if ',' in before_state:
        # Split by comma and take the last part as city
        parts = [p.strip() for p in before_state.split(',')]
        # Filter out empty strings
        parts = [p for p in parts if p]
        city = parts[-1] if parts else None
    else:
        # For space-separated format (no commas)
        # Assume the last 1-2 words before state are the city
        # Example: "19229 Colonel Glenn Rd Little Rock" -> city is "Little Rock"
        words = before_state.split()
        if len(words) >= 2:
            # Try last 2 words as city (handles multi-word cities)
            city = ' '.join(words[-2:])
        elif len(words) == 1:
            city = words[0]
        else:
            city = None

    return city, state.lower(), zip_code

def needs_filling(row):
    """Check if row needs city or state filled"""
    city = row.get('Property city', '').strip()
    state = row.get('state', '').strip()
    zip_code = row.get('Zip code', '').strip()
    return not city or not state or not zip_code

def process_csv(input_file, output_file):
    """Process CSV and fill missing city/state fields from Property Address"""

    if not os.path.exists(input_file):
        print(f"Error: Input file '{input_file}' not found")
        return

    filled_count = 0
    skipped_count = 0
    error_count = 0

    rows = []

    with open(input_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames

        for row in reader:
            if needs_filling(row):
                address = row.get('Property Address', '').strip()

                if address:
                    city, state, zip_code = parse_address(address)

                    if city or state or zip_code:
                        # Fill in missing fields
                        if city and not row.get('Property city', '').strip():
                            row['Property city'] = city
                            print(f"Filled city: {city}")

                        if state and not row.get('state', '').strip():
                            row['state'] = state
                            print(f"Filled state: {state}")

                        if zip_code and not row.get('Zip code', '').strip():
                            row['Zip code'] = zip_code
                            print(f"Filled ZIP: {zip_code}")

                        filled_count += 1
                        print(f"✅ Processed: {address}\n")
                    else:
                        error_count += 1
                        print(f"❌ Could not parse: {address}\n")
                else:
                    skipped_count += 1
            else:
                skipped_count += 1

            rows.append(row)

    # Write output CSV
    with open(output_file, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print("\n" + "="*50)
    print("PROCESSING COMPLETE")
    print("="*50)
    print(f"✅ Successfully filled: {filled_count} rows")
    print(f"⏭️  Skipped (already filled): {skipped_count} rows")
    print(f"❌ Could not parse: {error_count} rows")
    print(f"📁 Output saved to: {output_file}")
    print("="*50)

def main():
    if len(sys.argv) != 3:
        print("Usage: python fill_city_state_from_address.py <input.csv> <output.csv>")
        print("\nExample:")
        print("  python fill_city_state_from_address.py opportunities.csv opportunities_filled.csv")
        sys.exit(1)

    input_file = sys.argv[1]
    output_file = sys.argv[2]

    print("="*50)
    print("CSV CITY/STATE FILLER")
    print("="*50)
    print(f"Input:  {input_file}")
    print(f"Output: {output_file}")
    print("="*50 + "\n")

    process_csv(input_file, output_file)

if __name__ == "__main__":
    main()
