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

## Troubleshooting

**Q: Agent info is blank?**
- The Apify scraper extracts this from Zillow's listing page
- Some properties don't have agent info listed publicly
- Check the original Zillow URL to confirm if agent info exists

**Q: Images are missing?**
- Check `all_images` column - it has all images pipe-separated
- `property_image_url` only shows the first image
- If completely blank, the property may not have photos on Zillow

**Q: Annual taxes are $0?**
- Some properties don't have tax data on Zillow
- Check both `annual_tax` and `recent_property_taxes` columns
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
