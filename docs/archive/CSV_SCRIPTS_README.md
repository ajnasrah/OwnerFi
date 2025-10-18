# CSV Address Processing Scripts

This directory contains two Python scripts for filling in city and state fields in your opportunities CSV files.

## Scripts Available

### 1. `fill_city_state_from_address.py` (Simple & Fast)

**Best for:** When your addresses already contain city and state, but the separate city/state columns are empty.

**What it does:**
- Parses the "Property Address" field (e.g., "9 Apple Tree Cir, Little Rock, AR 72210")
- Extracts city, state, and ZIP code from the address
- Fills in the "Property city", "state", and "Zip code" columns
- **No API calls needed** - works offline and instantly

**Usage:**
```bash
python3 fill_city_state_from_address.py input.csv output.csv
```

**Example:**
```bash
# Process a CSV file from Downloads
python3 fill_city_state_from_address.py ~/Downloads/opportunities.csv opportunities_filled.csv

# Or use the existing CSV in the project root
python3 fill_city_state_from_address.py opportunities_filled.csv opportunities_filled_v3.csv
```

**Requirements:** Python 3 only (no external packages needed)

---

### 2. `fill_missing_geocoding.py` (Advanced with API)

**Best for:** When addresses are incomplete or you need to verify/correct location data using geocoding.

**What it does:**
- Uses geocoding APIs (Google Maps or OpenStreetMap) to look up addresses
- Fills in missing state and ZIP code data
- Can correct improperly formatted addresses
- More accurate but requires API setup and is slower

**Usage:**
```bash
# Install requirements first (one time)
pip install requests python-dotenv

# Run the script
python3 fill_missing_geocoding.py input.csv output.csv
```

**Requirements:**
- Python 3
- External packages: `requests`, `python-dotenv`, `csv-parser`
- Optional: Google Maps API key (uses free OpenStreetMap if not provided)

---

## Which Script Should I Use?

### Use `fill_city_state_from_address.py` if:
- ✅ Your addresses already have city and state in them (like "Street, City, ST ZIP")
- ✅ You just need to populate the separate city/state columns
- ✅ You want instant results without API calls
- ✅ You've run this script before and know it works

### Use `fill_missing_geocoding.py` if:
- ✅ Addresses are incomplete or poorly formatted
- ✅ You need to verify/validate addresses against real geocoding data
- ✅ You're willing to set up API keys and wait for API responses

---

## Common Workflow

The user has been running these scripts multiple times. The typical workflow is:

1. Download fresh `opportunities.csv` from GoHighLevel
2. Run the simple parser to fill in city/state:
   ```bash
   python3 fill_city_state_from_address.py ~/Downloads/opportunities.csv opportunities_filled.csv
   ```
3. Review the output
4. If needed, run the geocoding script for any remaining issues

---

## File Locations

- **Scripts:** `/Users/abdullahabunasrah/Desktop/ownerfi/fill_*.py`
- **Input CSV:** Usually in `~/Downloads/opportunities.csv`
- **Output CSV:** Usually saved as `opportunities_filled.csv` or `opportunities_filled_v2.csv`

---

## Quick Reference

```bash
# Simple address parsing (MOST COMMON)
python3 fill_city_state_from_address.py ~/Downloads/opportunities.csv opportunities_filled.csv

# Advanced geocoding (when needed)
python3 fill_missing_geocoding.py ~/Downloads/opportunities.csv opportunities_filled.csv
```
