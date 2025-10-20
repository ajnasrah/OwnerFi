# Owner Finance Benefit Videos - System Documentation

## Overview

The Owner Finance Benefit Video system automatically generates and posts educational videos about the benefits of owner financing to sellers and buyers. These videos are mixed with the existing podcast content to create a diverse social media feed.

### Key Features
- **Automated daily generation**: 2 videos per day (1 seller + 1 buyer)
- **Content variety**: 10 seller benefits + 10 buyer benefits (20 total)
- **Intelligent rotation**: Avoids repeating recent content
- **Full automation**: HeyGen → Submagic → Late API (social posting)
- **CTA integration**: Every video directs viewers to ownerfi.ai
- **Mixed with podcasts**: Creates diverse content feed

---

## Architecture

### Workflow Pipeline

```
Daily Cron (5x/day)
    ↓
Benefit Scheduler (checks if 2 videos generated today)
    ↓
[Seller Video Path]                [Buyer Video Path]
    ↓                                   ↓
Select random benefit               Select random benefit
(avoid last 5 used)                 (avoid last 5 used)
    ↓                                   ↓
Generate script with CTA            Generate script with CTA
    ↓                                   ↓
HeyGen video generation             HeyGen video generation
    ↓                                   ↓
Webhook: Upload to R2               Webhook: Upload to R2
    ↓                                   ↓
Submagic captions                   Submagic captions
    ↓                                   ↓
Webhook: Post to Late API           Webhook: Post to Late API
    ↓                                   ↓
Published on all platforms          Published on all platforms
```

### File Structure

```
ownerfi/
├── podcast/lib/
│   ├── benefit-content.ts          # Content library (20 benefits)
│   ├── benefit-scheduler.ts        # Daily scheduler
│   └── benefit-video-generator.ts  # HeyGen integration
├── src/
│   ├── app/api/
│   │   ├── benefit/cron/
│   │   │   └── route.ts           # Cron endpoint
│   │   └── webhooks/
│   │       ├── heygen/[brand]/    # HeyGen callbacks
│   │       └── submagic/[brand]/  # Submagic callbacks
│   ├── config/
│   │   ├── brand-configs.ts       # Benefit brand config
│   │   └── constants.ts           # Brand type definition
│   └── lib/
│       └── feed-store-firestore.ts # Benefit workflow DB
└── BENEFIT_VIDEOS_README.md       # This file
```

---

## Content Library

### Seller Benefits (10 total)

1. **Sell Your Home Faster** - Expand buyer pool
2. **Create Passive Income Streams** - Monthly payments
3. **Earn Higher Returns Than Banks** - 6-10% interest
4. **Sell in Any Market Condition** - Competitive advantage
5. **Defer Capital Gains Taxes** - Tax benefits
6. **Set Your Own Terms** - Full flexibility
7. **Keep Property Rights Until Paid** - Security
8. **Avoid Costly Repairs and Staging** - Save money
9. **Build Long-Term Wealth** - Interest income
10. **Skip Real Estate Agent Commissions** - Save 5-6%

### Buyer Benefits (10 total)

1. **Become a Homeowner Without Bank Approval** - Alternative financing
2. **Build Equity While Building Credit** - Dual benefit
3. **Close Faster Than Traditional Loans** - Speed
4. **Negotiate Better Terms** - Flexibility
5. **Lower Down Payment Requirements** - Accessibility
6. **Avoid PMI and Excessive Fees** - Cost savings
7. **Access Unique Properties** - Market advantage
8. **Invest Without Perfect Credit** - Opportunity
9. **Flexible Qualification Process** - Easier approval
10. **Start Building Wealth Today** - Immediate action

---

## Database Schema

### Firestore Collections

#### `benefit_workflow_queue`

```typescript
interface BenefitWorkflowItem {
  id: string;                          // benefit_{timestamp}_{random}
  benefitId: string;                   // seller_1, buyer_3, etc.
  audience: 'seller' | 'buyer';
  benefitTitle: string;
  status: 'heygen_processing' | 'submagic_processing' | 'posting' | 'completed' | 'failed';

  // Video IDs
  heygenVideoId?: string;
  submagicProjectId?: string;
  finalVideoUrl?: string;
  latePostId?: string;

  // Content
  caption?: string;                    // Full caption with CTA
  title?: string;                      // Video title

  // Metadata
  error?: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}
```

#### `benefit_scheduler`

```typescript
interface BenefitSchedulerState {
  recent_seller_benefits: string[];    // Last 5 used
  recent_buyer_benefits: string[];     // Last 5 used
  videos: BenefitVideoRecord[];        // All generated videos
}

interface BenefitVideoRecord {
  benefit_id: string;
  audience: 'seller' | 'buyer';
  generated_at: string;                // ISO timestamp
  video_id: string;
  workflow_id: string;
  published: boolean;
}
```

---

## API Endpoints

### Cron Endpoint

**URL**: `/api/benefit/cron`

**Method**: GET or POST

**Authorization**:
- Vercel Cron (user-agent: `vercel-cron/1.0`)
- Bearer token: `Authorization: Bearer ${CRON_SECRET}`
- Same-origin (dashboard)

**Query Parameters**:
- `force=true` - Force generation (bypass scheduler check)

**Response**:
```json
{
  "success": true,
  "videos": [
    {
      "audience": "seller",
      "benefit_id": "seller_3",
      "benefit_title": "Earn Higher Returns Than Banks",
      "video_id": "heygen_video_id",
      "workflow_id": "benefit_1234_abc"
    },
    {
      "audience": "buyer",
      "benefit_id": "buyer_1",
      "benefit_title": "Become a Homeowner Without Bank Approval",
      "video_id": "heygen_video_id",
      "workflow_id": "benefit_1234_def"
    }
  ],
  "message": "Benefit video generation started...",
  "timestamp": "2025-10-20T12:00:00.000Z"
}
```

### Webhook Endpoints

**HeyGen Webhook**: `/api/webhooks/heygen/benefit`

**Submagic Webhook**: `/api/webhooks/submagic/benefit`

These are automatically configured and receive callbacks from HeyGen and Submagic services.

---

## Setup Instructions

### 1. Environment Variables

Ensure these are set in `.env.local` or Vercel environment:

```bash
# HeyGen API
HEYGEN_API_KEY=your_heygen_api_key

# Submagic API
SUBMAGIC_API_KEY=your_submagic_api_key

# Late API (uses OwnerFi profile)
LATE_API_KEY=your_late_api_key
LATE_OWNERFI_PROFILE_ID=your_ownerfi_profile_id

# Cron Security
CRON_SECRET=your_random_secret_key

# Base URL (for webhooks)
NEXT_PUBLIC_BASE_URL=https://ownerfi.ai
# or for development:
# NEXT_PUBLIC_BASE_URL=https://your-ngrok-url.ngrok.io
```

### 2. Vercel Cron Jobs

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/podcast/cron",
      "schedule": "0 9,12,15,18,21 * * *"
    },
    {
      "path": "/api/benefit/cron",
      "schedule": "30 9,12,15,18,21 * * *"
    }
  ]
}
```

**Schedule**:
- Podcasts: :00 (9 AM, 12 PM, 3 PM, 6 PM, 9 PM CDT)
- Benefits: :30 (9:30 AM, 12:30 PM, 3:30 PM, 6:30 PM, 9:30 PM CDT)

This staggers the content generation for better distribution.

### 3. Firestore Setup

The collections will be created automatically on first run. No manual setup required.

### 4. Testing

**Manual trigger**:
```bash
curl -X POST https://ownerfi.ai/api/benefit/cron?force=true \
  -H "Authorization: Bearer ${CRON_SECRET}"
```

**Check scheduler status**:
```typescript
import { BenefitScheduler } from '@/podcast/lib/benefit-scheduler';

const scheduler = new BenefitScheduler();
await scheduler.loadStateFromFirestore();
console.log(scheduler.getStats());
```

---

## Customization

### Adding New Benefits

Edit `/podcast/lib/benefit-content.ts`:

```typescript
export const SELLER_BENEFITS: BenefitPoint[] = [
  // ... existing benefits
  {
    id: 'seller_11',
    audience: 'seller',
    title: 'Your New Benefit Title',
    shortDescription: 'Your 1-2 sentence description that will be spoken in the video.',
    hashtags: ['#YourHashtag', '#OwnerFinancing', '#OwnerFi'],
    category: 'financial' // or 'flexibility', 'speed', 'market', 'tax', 'investment'
  }
];
```

### Changing Avatars

Edit `/podcast/lib/benefit-video-generator.ts`:

```typescript
const DEFAULT_AVATARS: Record<'seller' | 'buyer', BenefitAvatarConfig> = {
  seller: {
    avatar_type: 'talking_photo',
    avatar_id: 'YOUR_HEYGEN_AVATAR_ID',
    voice_id: 'YOUR_HEYGEN_VOICE_ID',
    scale: 1.4,
    background_color: '#1e3a8a' // Hex color code
  },
  buyer: {
    // ... same structure
  }
};
```

### Changing Posting Schedule

Edit `/src/config/brand-configs.ts`:

```typescript
export const BENEFIT_CONFIG: BrandConfig = {
  // ...
  scheduling: {
    timezone: 'America/Chicago',
    postingHours: [9, 12, 15, 18, 21], // Hours in Central Time
    maxPostsPerDay: 2, // 1 seller + 1 buyer
  },
};
```

### Changing Platforms

Edit `/src/config/brand-configs.ts`:

```typescript
export const BENEFIT_CONFIG: BrandConfig = {
  // ...
  platforms: {
    default: ['instagram', 'tiktok', 'youtube', 'facebook'], // Change these
    all: ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'threads'],
  },
};
```

---

## Monitoring

### Dashboard

Check workflow status in Firestore:
- Collection: `benefit_workflow_queue`
- Collection: `benefit_scheduler`

### Logs

Search Vercel logs for:
- `🏡 Benefit video cron job triggered`
- `📹 Generating SELLER benefit video`
- `📹 Generating BUYER benefit video`
- `✅ Video generation started`
- `✅ Posted to Late!`

### Common Issues

**No videos generated**:
- Check: `needSeller` and `needBuyer` flags in logs
- Verify: Only 2 videos per day limit
- Check: Timezone settings (Central Time)

**HeyGen webhook not received**:
- Verify: `NEXT_PUBLIC_BASE_URL` is correct
- Check: HeyGen webhook URL in dashboard
- Test: Webhook is publicly accessible

**Submagic processing failed**:
- Check: Submagic API key is valid
- Verify: R2 upload succeeded
- Check: Video URL is publicly accessible

**Late API posting failed**:
- Verify: `LATE_OWNERFI_PROFILE_ID` is set
- Check: Profile is connected to platforms
- Verify: Late API key is valid

---

## Cost Estimation

**Per Video**:
- HeyGen: $0.15
- Submagic: Included in subscription
- Late API: Included in subscription
- Cloudflare R2: ~$0.01
- **Total: ~$0.16 per video**

**Monthly**:
- 2 videos/day × 30 days = 60 videos
- 60 × $0.16 = **$9.60/month**

---

## Content Calendar

The system automatically rotates through 20 different benefits (10 seller + 10 buyer), avoiding the last 5 used in each category. This ensures:
- No repeat for ~10 days (5 seller videos × 2 days)
- Fresh content variety
- Balanced seller/buyer messaging

**Example rotation**:
```
Day 1: Seller #3, Buyer #7
Day 2: Seller #1, Buyer #2
Day 3: Seller #8, Buyer #5
Day 4: Seller #4, Buyer #9
Day 5: Seller #6, Buyer #1
Day 6: Seller #3 (OK - not in last 5), Buyer #4
...
```

---

## Mixing with Podcasts

The benefit videos are designed to mix with podcast content:

### Current Schedule

**Daily**:
- 3 podcast episodes (different topics, guests)
- 2 benefit videos (1 seller, 1 buyer)
- **Total: 5 videos/day**

**Time Slots (Central Time)**:
```
9:00 AM - Podcast Episode 1
9:30 AM - Benefit Video (Seller)
12:00 PM - Podcast Episode 2
3:30 PM - Benefit Video (Buyer)
6:00 PM - Podcast Episode 3
```

This creates a balanced, diverse feed that educates viewers while promoting ownerfi.ai.

---

## Call-to-Action (CTA)

Every benefit video includes:

**In Video** (spoken):
> "Visit ownerfi.ai to see owner-financed properties in your area today."

**In Caption**:
> 🏡 See owner-financed properties in your area at ownerfi.ai
>
> #OwnerFinancing #RealEstate #[relevant hashtags]

---

## Future Enhancements

Potential improvements:
1. A/B testing different CTAs
2. Seasonal content (tax season, market conditions)
3. Regional customization (state-specific benefits)
4. Video thumbnails with branded graphics
5. Analytics dashboard for video performance
6. User-generated content integration

---

## Support

For questions or issues:
1. Check Vercel logs
2. Review Firestore collections
3. Test manual trigger with `force=true`
4. Verify environment variables

---

## License

Part of the OwnerFi platform. Internal use only.

---

**Last Updated**: October 2025
**Version**: 1.0.0
