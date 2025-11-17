# Manual Property Upload - Complete Guide

## Overview

Created a dedicated system for uploading **manually verified** owner financing properties from your outreach system.

**Use Case**: When your outreach team contacts an agent on MLS and the agent confirms "Yes, seller will do owner financing" - these properties can be uploaded directly without going through automated filters.

## Access

### Direct URL
```
https://your-domain.com/admin/manual-upload
```

or locally:
```
http://localhost:3000/admin/manual-upload
```

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│  1. Paste Zillow URL                                         │
│     https://www.zillow.com/homedetails/...                   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Scrape via Apify                                         │
│     • Fetches full property details                          │
│     • Gets images, price, bedrooms, bathrooms, etc.          │
│     • Extracts agent contact information                     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Add to Database with Special Flags                       │
│     ✓ manuallyVerified: true                                 │
│     ✓ verifiedBy: 'outreach-team'                           │
│     ✓ verificationSource: 'agent-confirmed'                  │
│     ✓ bypassedFilter: true                                   │
│     ✓ ownerFinanceVerified: true                            │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  4. Immediately Available to Buyers                          │
│     • Appears in buyer dashboard                             │
│     • Marked as "Manually Verified"                          │
│     • Not affected by negative keyword filters               │
└─────────────────────────────────────────────────────────────┘
```

## Key Features

### ✅ Bypasses All Filters

Properties uploaded here **skip** the owner financing filter because YOU'VE already verified with the agent.

**Example**: Even if description says "cash only", it will still be added because you confirmed with the agent that owner financing is available.

### ✅ Duplicate Protection

- Checks if property already exists in database
- Shows error if duplicate (won't re-add)
- Safe to try uploading same property multiple times

### ✅ Full Property Details

Scrapes everything from Zillow:
- Address (street, city, state, zip)
- Price
- Bedrooms / Bathrooms
- Square footage
- Lot size
- Year built
- Property images
- Agent name & phone number
- Property description
- MLS information

### ✅ Special Database Flags

Every manually uploaded property gets marked with:

```typescript
{
  // Verification flags
  manuallyVerified: true,
  verifiedBy: 'outreach-team',
  verifiedAt: new Date(),
  verificationSource: 'agent-confirmed',
  verificationNotes: 'Agent confirmed seller will do owner financing',

  // Filter bypass
  bypassedFilter: true,
  filterBypassReason: 'manually-verified-by-outreach',

  // Owner financing status
  ownerFinanceVerified: true,
  ownerFinancingAvailable: true,

  // Source tracking
  source: 'manual-upload',
  importMethod: 'admin-manual-upload',
}
```

## Usage Example

### Step 1: Your Outreach Process
```
Outreach Team: "Hi, I saw your listing at 5167 Rolling Fields Dr.
                Would the seller consider owner financing?"

Agent: "Yes! The seller is open to owner financing with 20% down."
```

### Step 2: Upload the Property
1. Go to `/admin/manual-upload`
2. Paste Zillow URL: `https://www.zillow.com/homedetails/5167-Rolling-Fields-Dr-Memphis-TN-38134/42277253_zpid/`
3. Click "Upload Property"
4. Wait 10-20 seconds for Apify to scrape
5. ✅ Done! Property added to database

### Step 3: Property is Live
- Immediately visible to buyers
- Marked with purple "Manually Verified" badge
- Includes all property details + agent contact info

## API Endpoint

### POST `/api/admin/manual-upload`

**Request**:
```json
{
  "zillowUrl": "https://www.zillow.com/homedetails/5167-Rolling-Fields-Dr-Memphis-TN-38134/42277253_zpid/"
}
```

**Response (Success)**:
```json
{
  "success": true,
  "property": {
    "id": "42277253",
    "fullAddress": "5167 Rolling Fields Dr, Memphis, TN 38134",
    "price": 250000,
    "bedrooms": 4,
    "bathrooms": 2,
    "manuallyVerified": true,
    "agentPhoneNumber": "555-1234",
    // ... full property data
  },
  "message": "Property added successfully"
}
```

**Response (Duplicate)**:
```json
{
  "error": "Property already exists in database",
  "property": { /* existing property data */ }
}
```

**Response (Error)**:
```json
{
  "error": "Failed to scrape property details from Zillow"
}
```

## Files Created

### 1. Admin UI Page
**File**: `src/app/admin/manual-upload/page.tsx`

Features:
- Clean, simple interface
- Single input for Zillow URL
- Real-time upload status
- Upload history
- Statistics dashboard
- Instructions and tips

### 2. API Endpoint
**File**: `src/app/api/admin/manual-upload/route.ts`

Features:
- Validates Zillow URL
- Checks for duplicates
- Scrapes via Apify
- Transforms property data
- Adds verification flags
- Saves to database

## Testing

### Test URL
```
https://www.zillow.com/homedetails/5167-Rolling-Fields-Dr-Memphis-TN-38134/42277253_zpid/
```

### Expected Result
```
✅ Property Added Successfully!

Address: 5167 Rolling Fields Dr, Memphis, TN 38134
Price: $XXX,XXX
Beds/Baths: Xbd / Xba

🎯 Manually Verified - Bypassed Filters
```

## Integration with Existing Systems

### Works With
- ✅ Buyer Dashboard (properties appear immediately)
- ✅ Admin Property Management
- ✅ GHL Integration (can be sent to GHL)
- ✅ Property Search & Filters
- ✅ Realtor Lead System

### Differences from Regular Properties
1. **manuallyVerified: true** - Shows special badge
2. **bypassedFilter: true** - Not affected by negative keyword filters
3. **verificationSource: 'agent-confirmed'** - Tracked separately in analytics
4. **source: 'manual-upload'** - Easy to identify in reports

## Reporting

### Query Manually Verified Properties

```javascript
// Get all manually verified properties
db.collection('zillow_imports')
  .where('manuallyVerified', '==', true)
  .get()

// Count by verification source
db.collection('zillow_imports')
  .where('verificationSource', '==', 'agent-confirmed')
  .count()
```

### Analytics

Track important metrics:
- Total manually verified properties
- Conversion rate (manual vs auto-scraped)
- Agent response rate
- Properties per outreach campaign

## Best Practices

### ✅ DO
- Upload immediately after agent confirms
- Add notes about agent conversation
- Double-check Zillow URL is correct
- Verify property still available

### ❌ DON'T
- Upload properties without agent confirmation
- Use for bulk uploads (use regular scraper instead)
- Skip checking for duplicates
- Modify the special flags manually

## Troubleshooting

### Issue: "Failed to scrape property"
**Solution**:
- Check URL is correct
- Property might be delisted from Zillow
- Try again in a few minutes (rate limiting)

### Issue: "Property already exists"
**Solution**:
- Property was already added (either manually or via scraper)
- Check admin dashboard to see existing entry
- Update existing entry if needed

### Issue: "Invalid Zillow URL"
**Solution**:
- Make sure URL includes "zillow.com"
- Copy full URL from browser address bar
- Don't use shortened/mobile URLs

## Security

### Access Control
- Only admin users can access `/admin/manual-upload`
- Requires authentication via NextAuth
- API endpoint validates authentication token

### Rate Limiting
- Apify has rate limits (check your plan)
- Add delays between uploads if doing multiple
- Consider batch upload for 10+ properties

## Future Enhancements

Potential additions:
- [ ] Bulk manual upload (paste multiple URLs)
- [ ] Add custom notes per property
- [ ] Track which team member uploaded
- [ ] Integration with CRM system
- [ ] Email notification on upload
- [ ] Weekly report of manually verified properties

## Support

**Questions or Issues?**
1. Check `/admin/manual-upload` page instructions
2. Review this guide
3. Check Apify dashboard for scraping status
4. Contact dev team

---

**Status**: ✅ Live and Ready to Use
**Access**: `/admin/manual-upload`
**API**: `/api/admin/manual-upload`
