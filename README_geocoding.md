# Address Geocoding Script

This script fills missing state and ZIP code data in your opportunities.csv file using geocoding APIs.

## Quick Setup

1. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Optional - Set up Google Maps API (recommended):**
   - Get API key: https://developers.google.com/maps/documentation/geocoding/get-api-key
   - Set environment variable:
     - macOS/Linux: `export GOOGLE_MAPS_API_KEY="YOUR_KEY"`
     - Windows PowerShell: `setx GOOGLE_MAPS_API_KEY "YOUR_KEY"`

3. **Run the script:**
   ```bash
   python fill_missing_geocoding.py /Users/abdullahabunasrah/Downloads/opportunities.csv opportunities_filled.csv
   ```

## What it does

- ✅ Reads your opportunities.csv file
- ✅ Identifies rows with missing state or ZIP code data
- ✅ Uses geocoding to fill missing data:
  - Google Maps API (if API key provided)
  - OpenStreetMap Nominatim (free fallback)
- ✅ Updates address format to: "Street, City, ST ZIP"
- ✅ Preserves existing correct addresses
- ✅ Saves results to new file

## Output

The script will show progress and create `opportunities_filled.csv` with:
- Missing states and ZIP codes filled in
- Properly formatted addresses
- All original data preserved

**Note:** Without Google API key, it uses free OpenStreetMap service with rate limiting (slower but works fine).