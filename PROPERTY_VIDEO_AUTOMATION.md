# Automated Property Showcase Video System

## Overview
Automatically generate viral property videos for owner-financed homes with under $15k down payment using HeyGen avatar overlay on property images.

---

## System Architecture

```
New Property Added (< $15k down)
    ↓
Trigger: Check if eligible
    ↓
Generate Video Script (with disclaimers)
    ↓
HeyGen: Avatar + Property Image Background
    ↓
Submagic: Add captions
    ↓
Late.dev: Post to social media
    ↓
Published across all platforms
```

---

## Video Format

### Visual Layout:
```
┌─────────────────────────────┐
│                             │
│    Property Image (BG)      │
│                             │
│  ┌──────────────┐          │
│  │              │          │
│  │   Avatar     │          │  <- Your avatar overlay (bottom-right)
│  │   (You)      │          │     Showing off the property
│  │              │          │
│  └──────────────┘          │
│                             │
│  Deal Info Overlay (Top)    │  <- Text overlay: Price, Down, Monthly
└─────────────────────────────┘
```

### Technical Specs:
- **Dimensions**: 1080x1920 (vertical for mobile)
- **Duration**: 15-30 seconds
- **Avatar**: Bottom-right corner, scaled to 0.6 (smaller than main videos)
- **Background**: Property's first image (or best exterior shot)
- **Text Overlays**: Price, down payment, monthly payment

---

## Script Formula

### Standard Script Template:
```
"We just found this Owner Finance deal for sale!

[ADDRESS] in [CITY], [STATE]

[BEDROOMS] bed, [BATHROOMS] bath, [SQFT] square feet

Only $[DOWN_PAYMENT] down
$[MONTHLY_PAYMENT] per month
[INTEREST_RATE]% interest for [TERM] years

[ONE HIGHLIGHT - biggest selling point]

Visit ownerfi.ai to see the full listing and apply.

*This is not financial or legal advice. We are a marketing platform connecting buyers with owner-financed properties. All deals are subject to seller approval and terms may change.*"
```

### Example Output:
```
"We just found this Owner Finance deal for sale!

123 Main Street in Houston, Texas

3 bed, 2 bath, 1,450 square feet

Only $10,000 down
$1,450 per month
8% interest for 30 years

Brand new kitchen and hardwood floors throughout!

Visit ownerfi.ai to see the full listing and apply.

*This is not financial or legal advice. We are a marketing platform connecting buyers with owner-financed properties. All deals are subject to seller approval and terms may change.*"
```

---

## Legal Disclaimers

### Required Disclaimers (Must Include):

**In Video Script:**
- "This is not financial or legal advice"
- "We are a marketing platform"
- "Subject to seller approval"
- "Terms may change"

**In Caption:**
```
🏡 New Owner Finance Deal! Only $[DOWN] down

[City, State] | [Beds]BD [Baths]BA | $[Monthly]/mo

We connect buyers with sellers offering owner financing. This is a marketing platform - not financial/legal advice. All deals subject to seller approval. Terms may vary. Always consult professionals before purchasing.

#OwnerFinancing #RealEstate #[City] #HomeOwnership #OwnerFi
```

### Legal Protection:
- Clear we're a marketplace/platform
- Not offering advice
- Deals must be verified with seller
- Encourage professional consultation

---

## Eligibility Criteria

### Auto-Generate Video If:
- ✅ `downPaymentAmount` < $15,000
- ✅ `status === 'active'`
- ✅ `isActive === true`
- ✅ `imageUrls.length > 0` (has at least one image)
- ✅ Property added/updated within last 24 hours (for new properties)

### Skip Video If:
- ❌ Down payment >= $15,000
- ❌ Property inactive or sold
- ❌ No images available
- ❌ Already generated video for this property

---

## HeyGen Configuration

### API Call Structure:
```typescript
{
  video_inputs: [{
    character: {
      type: 'talking_photo',
      talking_photo_id: '31c6b2b6306b47a2ba3572a23be09dbc', // Your avatar
      scale: 0.6,  // Smaller - bottom corner
      position: 'bottom-right',
      talking_photo_style: 'circle', // Round avatar frame
      talking_style: 'expressive'
    },
    voice: {
      type: 'text',
      input_text: generatedScript,
      voice_id: '9070a6c2dbd54c10bb111dc8c655bff7',
      speed: 1.0
    },
    background: {
      type: 'image',
      url: property.imageUrls[0] // First property image
    }
  }],
  dimension: { width: 1080, height: 1920 },
  title: `${property.address} - Owner Finance`,
  callback_id: `property_${property.id}`
}
```

### Avatar Positioning:
- **Position**: Bottom-right corner
- **Size**: 60% of normal (scale: 0.6)
- **Style**: Circular frame to look like PiP overlay
- **Effect**: Looks like you're presenting the property

---

## Database Schema

### New Collection: `property_videos`

```typescript
interface PropertyVideo {
  id: string;                      // property_video_{timestamp}_{random}
  propertyId: string;              // Reference to PropertyListing.id

  // Property Snapshot (at time of video)
  address: string;
  city: string;
  state: string;
  downPayment: number;
  monthlyPayment: number;

  // Video Generation
  script: string;
  caption: string;
  status: 'generating' | 'heygen_processing' | 'submagic_processing' | 'posting' | 'completed' | 'failed';

  // Video IDs
  heygenVideoId?: string;
  submagicProjectId?: string;
  finalVideoUrl?: string;
  latePostId?: string;

  // Metadata
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  error?: string;
}
```

---

## Implementation Plan

### Phase 1: Core Video Generation
1. Create `/api/property/generate-video` endpoint
2. Build property video script generator
3. Integrate HeyGen with property image backgrounds
4. Add disclaimers to all scripts

### Phase 2: Automation Triggers
1. Firebase Cloud Function on property create/update
2. Filter: Only < $15k down
3. Auto-trigger video generation
4. Store in `property_videos` collection

### Phase 3: Posting Integration
1. Connect to existing HeyGen → Submagic → Late pipeline
2. Use OwnerFi Late profile
3. Auto-post to social media
4. Track performance per property

### Phase 4: Queue Management
1. Limit to X property videos per day
2. Prioritize newest/best deals
3. Avoid flooding feed with too many properties
4. Mix with existing content (viral, podcast, benefits)

---

## Cron Schedule

### Property Video Cron
```json
{
  "path": "/api/property/video-cron",
  "schedule": "0 11,17,23 * * *"
}
```

**Runs 3x daily:**
- 11 AM EST (offset from main content)
- 5 PM EST (evening engagement)
- 11 PM EST (late night)

**Generates:**
- 1-3 property videos per run
- Maximum 9 property videos per day
- Filters best deals under $15k

---

## Video Variations

### Hook Variations:
1. "We just found this Owner Finance deal for sale!"
2. "STOP scrolling! Check out this low down payment deal:"
3. "You can own this home for only $[DOWN] down!"
4. "This Owner Finance property just hit the market:"
5. "Looking for a home with low money down? Check this out:"

### Highlight Selection Priority:
1. Unique features (pool, view, remodeled)
2. Location benefits (great schools, downtown)
3. Financial benefits (low payment, short term)
4. Property condition (move-in ready, updated)

---

## Caption Template

```
🏡 New Owner Finance Deal in [CITY]!

💰 Only $[DOWN_PAYMENT] down
🏠 [BEDS]BD | [BATHS]BA | [SQFT] sq ft
💵 $[MONTHLY]/mo at [RATE]%

[One-line highlight about property]

We connect buyers with owner-financed homes. This is a marketing platform - not financial/legal advice. All deals subject to seller approval. Always consult professionals.

Apply at ownerfi.ai

#OwnerFinancing #[City]RealEstate #LowDownPayment #HomeOwnership #OwnerFi #RealEstate
```

---

## Success Metrics

### Track Per Property Video:
- Views
- Engagement rate
- Click-through to ownerfi.ai
- Applications submitted
- Properties marked as favorite

### Optimize For:
- Properties that get most engagement
- Best performing price ranges
- Most viral locations/cities
- Optimal posting times

---

## Cost Analysis

**Per Property Video:**
- HeyGen: $0.15
- Submagic: Included
- Late API: Included
- R2 Storage: ~$0.01
- **Total: ~$0.16/video**

**Monthly (9 videos/day):**
- 9 videos/day × 30 days = 270 videos
- 270 × $0.16 = **$43.20/month**

---

## Future Enhancements

### V2 Features:
1. **Multiple property images** - Show 2-3 photos in video
2. **Location-specific hooks** - Custom scripts per city
3. **Price range targeting** - Different styles for different budgets
4. **Virtual tour integration** - Link to 3D tours
5. **A/B test hooks** - Test different opening lines
6. **Seller testimonials** - Add social proof clips

### V3 Features:
1. **AI-generated highlights** - Auto-detect best features
2. **Neighborhood data** - School ratings, crime stats
3. **Comparison videos** - "Rent vs Own this property"
4. **Deal alerts** - "Price drop!" or "New listing!"
5. **Multi-language** - Spanish property videos

---

## Legal Review Checklist

Before launching, verify:
- [ ] Disclaimers reviewed by attorney
- [ ] Platform status clearly stated (marketing, not lender)
- [ ] No misleading claims about financing
- [ ] Compliance with Real Estate regulations
- [ ] Fair Housing compliance
- [ ] Truth in Lending Act considerations
- [ ] State-specific real estate advertising laws

---

## Next Steps

1. **Build Core System** (Week 1)
   - Property video script generator
   - HeyGen integration with image backgrounds
   - Testing with 5 properties

2. **Automation Layer** (Week 2)
   - Auto-trigger on new properties < $15k
   - Queue management
   - Error handling

3. **Launch & Monitor** (Week 3)
   - Generate first batch
   - Track engagement
   - Optimize scripts based on performance

4. **Scale** (Week 4+)
   - Increase volume if performing well
   - Add variations
   - Expand to higher down payment properties

---

**Version**: 1.0
**Last Updated**: October 2025
**Status**: Ready for Development
