# Zillow Scraper & GHL Export Guide

## How to Stop the Scraper

The scraper now supports graceful stopping! To stop the import process:

**Create a stop file:**
```bash
touch .stop-scraper
```

The scraper will check for this file between batches and stop gracefully. Your progress will be saved to Firebase.

**To resume after stopping:**
```bash
rm .stop-scraper
# Then run the import script again
npx tsx scripts/import-to-firebase.ts
```

---

## What's in the GHL Export

When you download the "Export to GHL Format" Excel file, it includes ALL these fields:

### Property Core Info
- `property_id` - Unique ID
- `property_address` - Street address
- `property_city` - City
- `property_state` - State
- `property_zip` - Zip code
- `property_price` - Listing price
- `full_address` - Complete formatted address

### Property Details
- `property_bedrooms` - Number of bedrooms
- `property_bathrooms` - Number of bathrooms
- `property_sqft` - Square footage
- `building_type` - Property type (Single Family, Condo, etc.)
- `year_built` - Year built
- `lot_sqft` - Lot size in square feet

### Financial Information
- `estimate` - Zillow Zestimate
- `hoa` - Monthly HOA fee
- `annual_tax` - Annual tax amount ✅
- `recent_property_taxes` - Recent property tax assessment ✅

### Agent Information ✅
- `agent_name` - Listing agent name
- `agent_phone` - Agent phone number
- `broker_name` - Brokerage name
- `broker_phone` - Broker phone number

### Images ✅
- `property_image_url` - Primary property image
- `all_images` - All property images (pipe-separated: image1.jpg|image2.jpg|image3.jpg)

### Additional
- `description` - Property description
- `url` - Original Zillow URL
- `source` - Data source (apify-zillow)
- `imported_at` - When imported to Firebase

---

## Where the Data Comes From

The GHL export pulls data from the `zillow_imports` collection in Firestore.

This collection is populated by the import script (`scripts/import-to-firebase.ts`) which:
1. Takes URLs from your CSV/Excel file
2. Scrapes full property details using Apify
3. Saves to Firestore with all fields including agent info, images, and taxes

### Data Flow

```
Zillow URLs (CSV/Excel)
    ↓
Apify Scraper (maxcopell/zillow-detail-scraper)
    ↓
Transform Data (import-to-firebase.ts)
    ↓
Save to Firestore (zillow_imports collection)
    ↓
Export to GHL Format (Excel download)
```

---

## Confirming Your Data

To verify agent info, images, and taxes are being captured:

1. **Check Firebase Console:**
   - Go to Firestore > `zillow_imports`
   - Open any property document
   - Look for fields: `agentName`, `agentPhoneNumber`, `propertyImages`, `annualTaxAmount`

2. **Check the Excel Export:**
   - Download "Export to GHL Format"
   - Look for columns: `agent_name`, `agent_phone`, `property_image_url`, `all_images`, `annual_tax`

---

## Phone Number Validation (NEW!)

**Every imported property is GUARANTEED to have a contact phone number.**

The import script now:
1. ✅ **Has Agent Phone** → Uses agent phone number
2. ✅ **Has Only Broker Phone** → Uses broker phone as agent phone (fallback)
3. ❌ **Has No Phone Numbers** → SKIPS the property entirely

**Test Results:**
Based on your sample data (50 properties):
- **70%** have agent phone → imported with agent phone
- **10%** have only broker phone → imported with broker phone as agent
- **20%** have no phones → SKIPPED (not imported)

**To check which properties will be skipped:**
```bash
npx tsx scripts/test-phone-validation.ts your-apify-data.json
```

---

## Troubleshooting

**Q: Some properties aren't importing?**
- They likely have no agent or broker phone number
- Run the phone validation test to see which will be skipped
- This is intentional - we only want properties with contact info

**Q: Agent info is blank but broker info exists?**
- The agent phone number will show the broker's phone (fallback)
- This ensures you always have a contact number

**Q: Images are missing?**
- Only the first image is included in the export
- If completely blank, the property may not have photos on Zillow

**Q: Annual taxes are $0?**
- Check the `annual_tax_paid` column (actual tax paid)
- Also check `tax_assessment_value` column (assessed value)
- Zillow may not have tax records for all properties

---

## Quick Commands

**Stop the scraper:**
```bash
touch .stop-scraper
```

**Resume scraping:**
```bash
rm .stop-scraper
npx tsx scripts/import-to-firebase.ts
```

**Check Firestore data:**
- Visit: https://console.firebase.google.com
- Navigate to: Firestore Database > zillow_imports

**Download GHL export:**
- Admin dashboard > Zillow Imports section > "Export to GHL Format" button
