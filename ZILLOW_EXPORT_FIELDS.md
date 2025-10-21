# Complete List of Fields in GHL Export

## Your GHL Export Now Includes 42 Fields:

### Property IDs (3)
1. `property_id` - Firebase document ID
2. `zpid` - Zillow Property ID
3. `mls_id` - MLS listing ID
4. `parcel_id` - County parcel/APN number

### Address (7)
5. `property_address` - Street address
6. `property_city` - City
7. `property_state` - State
8. `property_zip` - Zip code
9. `county` - County name
10. `subdivision` - Subdivision name
11. `neighborhood` - Neighborhood name

### Property Details (8)
12. `property_price` - Listing price
13. `property_bedrooms` - Number of bedrooms
14. `property_bathrooms` - Number of bathrooms
15. `property_sqft` - Living area square feet
16. `lot_sqft` - Lot size square feet
17. `year_built` - Year built
18. `building_type` - Property type dimension
19. `home_type` - SINGLE_FAMILY, CONDO, etc.
20. `home_status` - FOR_SALE, etc.

### Location (2)
21. `latitude` - GPS latitude
22. `longitude` - GPS longitude

### Financial (7)
23. `zestimate` - Zillow home value estimate
24. `rent_estimate` - Zillow rent estimate
25. `hoa` - Monthly HOA fee
26. `annual_tax_paid` - **ACTUAL TAX AMOUNT PAID** ✅
27. `tax_assessment_value` - Tax assessed value
28. `property_tax_rate` - Tax rate percentage
29. `annual_insurance` - Annual homeowners insurance

### Listing Info (3)
30. `days_on_zillow` - Days listed on Zillow
31. `date_posted` - Date listing posted
32. `listing_source` - Listing data source

### Agent Info (6)
33. `agent_name` - Listing agent name ✅
34. `agent_phone` - Agent phone number ✅
35. `agent_email` - Agent email
36. `agent_license` - Agent license number
37. `broker_name` - Brokerage name ✅
38. `broker_phone` - Broker phone number ✅

### URLs & Media (3)
39. `zillow_url` - Full Zillow property URL
40. `virtual_tour_url` - Virtual tour URL (if available)
41. `property_image_url` - **FIRST PROPERTY IMAGE URL** ✅

### Description & Metadata (4)
42. `description` - Property description
43. `full_address` - Complete formatted address
44. `source` - Data source (apify-zillow)
45. `imported_at` - Import timestamp

---

## Key Improvements:

### ✅ Fixed Missing Data Issues:
- **Agent Info** now extracts from `attributionInfo` object
- **Images** now extracts from `responsivePhotos` array
- **Tax Amount** now gets actual tax PAID (not assessment)

### ✅ Added 18 New Fields:
- Property IDs (ZPID, MLS, Parcel)
- Location details (County, Subdivision, Neighborhood, GPS)
- Complete financial data (Rent estimate, Tax rate, Insurance)
- Listing details (Days on market, Date posted, Source)
- Agent details (Email, License)
- URLs (Zillow link, Virtual tour)

### ❌ Removed Per Your Request:
- Schools
- All images pipe-separated list (kept only first image)

---

## Next Steps to Get the Data:

1. **Re-import your properties** with the new field mapping:
   ```bash
   npx tsx scripts/import-to-firebase.ts
   ```

2. **Download the updated export**:
   - Go to Admin Dashboard
   - Click "Export to GHL Format"
   - All 42 fields will be in the Excel file

3. **Verify the data**:
   ```bash
   npx tsx scripts/check-excel-columns.ts ~/Downloads/zillow_imports_ghl_2025-10-21.xlsx
   ```

---

## Important Notes:

- **Tax Amount**: Now extracts the ACTUAL tax paid from `taxHistory[].taxPaid`
- **Tax Assessment**: Separate field showing assessed value
- **Images**: Only first image URL (no pipe-separated list)
- **Agent/Broker**: All contact info now properly extracted
- **Schools**: Removed - not included in import or export
