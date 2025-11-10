#!/usr/bin/env python3
"""
Geocoding script to fill missing state and ZIP code data in opportunities.csv
"""
import csv
import os
import sys
import time
import requests
from typing import Dict, Optional, Tuple

def load_env_file(env_path: str = '.env.local'):
    """Load environment variables from .env.local file"""
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    # Remove quotes if present
                    value = value.strip('"\'')
                    os.environ[key] = value

def geocode_with_google(address: str, api_key: str) -> Optional[Dict]:
    """Geocode address using Google Maps API"""
    try:
        url = "https://maps.googleapis.com/maps/api/geocode/json"
        params = {
            'address': address,
            'key': api_key
        }
        response = requests.get(url, params=params)
        data = response.json()

        if data['status'] == 'OK' and data['results']:
            return data['results'][0]
        return None
    except Exception as e:
        print(f"Google geocoding error for {address}: {e}")
        return None

def geocode_with_nominatim(address: str) -> Optional[Dict]:
    """Geocode address using OpenStreetMap Nominatim (free)"""
    try:
        url = "https://nominatim.openstreetmap.org/search"
        params = {
            'q': address,
            'format': 'json',
            'addressdetails': 1,
            'limit': 1
        }
        headers = {'User-Agent': 'OwnerFi-Geocoder/1.0'}

        response = requests.get(url, params=params, headers=headers)
        data = response.json()

        if data:
            return data[0]
        return None
    except Exception as e:
        print(f"Nominatim geocoding error for {address}: {e}")
        return None

def extract_location_info(result: Dict, service: str) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """Extract city, state, and ZIP from geocoding result"""
    try:
        if service == 'google':
            city = state = zip_code = None
            for component in result.get('address_components', []):
                types = component.get('types', [])
                if 'locality' in types:
                    city = component['long_name']
                elif 'administrative_area_level_1' in types:
                    state = component['short_name']
                elif 'postal_code' in types:
                    zip_code = component['long_name']
            return city, state, zip_code

        elif service == 'nominatim':
            address = result.get('address', {})
            city = address.get('city') or address.get('town') or address.get('village')
            state = address.get('state')
            zip_code = address.get('postcode')

            # Convert state name to abbreviation if needed
            if state:
                state_abbrev = get_state_abbreviation(state)
                if state_abbrev:
                    state = state_abbrev

            return city, state, zip_code

    except Exception as e:
        print(f"Error extracting location info: {e}")
        return None, None, None

    return None, None, None

def get_state_abbreviation(state_name: str) -> Optional[str]:
    """Convert state name to abbreviation"""
    states = {
        'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
        'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
        'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
        'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
        'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO',
        'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
        'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
        'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
        'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT',
        'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY'
    }
    return states.get(state_name)

def format_full_address(street: str, city: str, state: str, zip_code: str) -> str:
    """Create properly formatted full address"""
    parts = []
    if street and street.strip():
        parts.append(street.strip())
    if city and city.strip():
        parts.append(city.strip())
    if state and state.strip():
        if zip_code and zip_code.strip():
            parts.append(f"{state.strip()} {zip_code.strip()}")
        else:
            parts.append(state.strip())
    elif zip_code and zip_code.strip():
        parts.append(zip_code.strip())

    return ", ".join(parts)

def needs_geocoding(row: Dict) -> bool:
    """Check if row needs geocoding (missing state or ZIP)"""
    state = row.get('state', '').strip()
    zip_code = row.get('Zip code ', '').strip()  # Note trailing space
    return not state or not zip_code

def process_csv(input_file: str, output_file: str):
    """Process the CSV file and fill missing geocoding data"""
    # Load environment variables from .env.local
    load_env_file()

    google_api_key = os.getenv('GOOGLE_MAPS_API_KEY')
    use_google = bool(google_api_key)

    print(f"Using {'Google Maps' if use_google else 'OpenStreetMap Nominatim'} for geocoding")

    geocoded_count = 0
    error_count = 0

    with open(input_file, 'r', encoding='utf-8') as infile:
        reader = csv.DictReader(infile)
        fieldnames = reader.fieldnames

        rows = []
        for row in reader:
            if needs_geocoding(row):
                address = row.get('Property Address ', '').strip()
                city = row.get('Property city ', '').strip()
                state = row.get('state', '').strip()

                if address:
                    # Build complete address for better geocoding
                    full_address = address
                    if city and city not in address:
                        full_address += f", {city}"
                    if state and state not in address:
                        full_address += f", {state}"

                    print(f"Geocoding: {full_address}")

                    # Try geocoding
                    result = None
                    if use_google:
                        result = geocode_with_google(full_address, google_api_key)
                        service = 'google'
                    else:
                        result = geocode_with_nominatim(full_address)
                        service = 'nominatim'
                        time.sleep(1)  # Rate limiting for Nominatim

                    if result:
                        city, state, zip_code = extract_location_info(result, service)

                        # Only update if we got the missing data
                        if state and not row.get('state', '').strip():
                            row['state'] = state
                        if zip_code and not row.get('Zip code ', '').strip():
                            row['Zip code '] = zip_code
                        if city and not row.get('Property city ', '').strip():
                            row['Property city '] = city

                        # Update full address format if needed
                        current_address = row.get('Property Address ', '').strip()
                        if current_address and not (',' in current_address and state in current_address):
                            formatted_address = format_full_address(
                                current_address,
                                row.get('Property city ', '').strip(),
                                row.get('state', '').strip(),
                                row.get('Zip code ', '').strip()
                            )
                            row['Property Address '] = formatted_address

                        geocoded_count += 1
                    else:
                        error_count += 1
                        print(f"  ❌ Could not geocode: {full_address}")

            rows.append(row)

    # Write updated CSV
    with open(output_file, 'w', encoding='utf-8', newline='') as outfile:
        writer = csv.DictWriter(outfile, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"\n✅ Processing complete!")
    print(f"   Successfully geocoded: {geocoded_count}")
    print(f"   Errors: {error_count}")
    print(f"   Output file: {output_file}")

def main():
    if len(sys.argv) != 3:
        print("Usage: python fill_missing_geocoding.py <input_csv> <output_csv>")
        sys.exit(1)

    input_file = sys.argv[1]
    output_file = sys.argv[2]

    if not os.path.exists(input_file):
        print(f"Error: Input file '{input_file}' not found")
        sys.exit(1)

    process_csv(input_file, output_file)

if __name__ == "__main__":
    main()