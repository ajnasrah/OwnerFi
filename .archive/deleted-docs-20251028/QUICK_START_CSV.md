# Quick Start: Fill City & State in CSV

## The Script You Need

**File:** `/Users/abdullahabunasrah/Desktop/ownerfi/fill_city_state_from_address.py`

## Quick Command

```bash
cd /Users/abdullahabunasrah/Desktop/ownerfi
python3 fill_city_state_from_address.py ~/Downloads/opportunities.csv opportunities_filled.csv
```

## What It Does

Parses the "Property Address" column and fills in:
- **Property city** column
- **state** column
- **Zip code** column

## Example

**Input (Property Address):**
```
9 Apple Tree Cir, Little Rock, AR 72210
```

**Output:**
```
Property city: Little Rock
state: ar
Zip code: 72210
```

## Requirements

- Python 3 (already on your Mac)
- No packages to install
- Works offline

## Common Usage

```bash
# Most common: Process downloaded CSV
python3 fill_city_state_from_address.py ~/Downloads/opportunities.csv opportunities_filled.csv

# Alternative: Process existing file
python3 fill_city_state_from_address.py opportunities_filled.csv opportunities_filled_v3.csv
```

## See Also

- Full documentation: `CSV_SCRIPTS_README.md`
- Advanced geocoding: `fill_missing_geocoding.py` (requires API setup)
