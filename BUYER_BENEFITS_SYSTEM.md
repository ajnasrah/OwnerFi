# 🏠 OwnerFi Buyer Benefits Video System

## Overview

This system generates **buyer-focused** video scripts for social media automation. It uses a refined ChatGPT prompt to create engaging, educational content for people who can't qualify for traditional bank loans.

**⚠️ BUYER-ONLY SYSTEM**: This system explicitly rejects seller benefits and only works with buyer-focused content.

---

## 🎯 System Prompt Features

### Core Purpose
- Help renters realize they can become homeowners through owner financing
- Create 30-second videos (~90 words) that stop the scroll
- Educate buyers who think homeownership is out of reach

### Voice & Tone
- **Friendly, confident, motivational** — like a big brother giving real talk
- **5th-grade reading level** — short, clear, natural sentences
- **No hype, no jargon** — conversational and authentic
- **Copyright-safe** — 100% original content

### Structure
All scripts follow this pattern:
```
🎯 Hook (3-5 seconds) - Shock/surprise/emotion
💡 Main message (15-20 seconds) - Insight/story
🏁 Soft CTA (5 seconds) - "See what's possible at OwnerFi.ai"
```

---

## 📅 Daily Theme System

Each day has a specific content focus to ensure variety:

| Day | Theme | Description |
|-----|-------|-------------|
| **Monday** | Credit Myths | Debunk credit score myths that stop people from trying |
| **Tuesday** | Real Stories | Share inspiring transformation stories of renters → homeowners |
| **Wednesday** | How It Works | Explain owner financing process in simple terms |
| **Thursday** | Money Mindset | Challenge limiting beliefs about homeownership |
| **Friday** | Quick Wins | Share actionable tips buyers can implement immediately |
| **Saturday** | Comparison | Show owner financing vs traditional bank loans |
| **Sunday** | Vision & Hope | Paint the picture of homeownership lifestyle |

The system automatically applies the correct theme based on the current day.

---

## 🚫 Banned Phrases

The system is programmed to **NEVER** use:
- "Let me tell you..."
- "You won't believe this..."
- "I'm going to share..."
- "Today I'm going to..."
- Any salesy/corporate language

---

## ✅ Required Elements

Every script must include:
1. **Hook** that creates shock/surprise/emotion (first 3 seconds)
2. **Value** in the form of insight or story
3. **CTA** with "OwnerFi.ai" mentioned naturally
4. **No guarantees** — never promise approvals, prices, or specific outcomes
5. **90-word target** — scripts should be 70-110 words

---

## 🛠️ Technical Implementation

### Location
`/podcast/lib/benefit-video-generator.ts`

### Key Functions

#### `generateScript(benefit: BenefitPoint): Promise<string>`
- **Input**: Buyer benefit point
- **Output**: 30-second video script
- **AI Model**: GPT-4o-mini (via OpenAI API)
- **Enforcement**: Throws error if audience is not 'buyer'

#### `generateBenefitVideo(benefit, workflowId, customAvatar?): Promise<string>`
- **Input**: Buyer benefit, workflow ID, optional avatar config
- **Output**: HeyGen video ID
- **Enforcement**: Throws error if audience is not 'buyer'

### Environment Variables Required

```bash
# OpenAI API (for script generation)
OPENAI_API_KEY=sk-...

# HeyGen API (for video generation)
HEYGEN_API_KEY=...

# Avatar Configuration (buyer-only)
BENEFIT_BUYER_AVATAR_ID=...
BENEFIT_BUYER_VOICE_ID=...
BENEFIT_BUYER_SCALE=1.4
BENEFIT_BUYER_BG_COLOR=#059669  # Green background
```

---

## 📦 Content Library

### Available Buyer Benefits
Located in `/podcast/lib/benefit-content.ts`

**10 buyer benefits** covering:
- ✅ Homeownership without bank approval
- ✅ Building equity while building credit
- ✅ Fast closing (days vs months)
- ✅ Flexible terms and negotiation
- ✅ Lower down payment requirements
- ✅ No PMI or excessive fees
- ✅ Access to unique properties
- ✅ Investment without perfect credit
- ✅ Flexible qualification process
- ✅ Start building wealth today

### Benefit Categories
- **Financial** - Money savings, equity building
- **Flexibility** - Custom terms, qualification
- **Speed** - Fast closing process
- **Market** - Unique property access
- **Investment** - Wealth building opportunities

---

## 🧪 Testing

### Run Test Script
```bash
npx tsx scripts/test-buyer-benefit-script.ts
```

This will:
1. Generate 3 sample scripts using the ChatGPT prompt
2. Display daily theme
3. Show word count and estimated duration
4. Verify required elements (CTA, hook, length)
5. Test buyer-only enforcement (reject seller benefits)

### Expected Output Example
```
🎬 SCRIPT 1/3
────────────────────────────────────────────────────────────
📋 Benefit: Become a Homeowner Without Bank Approval
💡 Description: Owner financing lets you buy a home...
🎯 Category: flexibility

⏳ Generating script...

✅ GENERATED SCRIPT:
────────────────────────────────────────────────────────────
🎯 "Think you need perfect credit to buy a home? Nope — that's the old way."
💡 "With owner financing, you can buy directly from the seller. No bank hoops, no long waits, just steady income and a down payment. It's how thousands of families finally got keys in their hands."
🏁 "Search owner-finance homes near you — free at OwnerFi.ai."
────────────────────────────────────────────────────────────

📊 Stats:
   - Word count: 87 words
   - Estimated duration: 29 seconds
   - Target: 30 seconds (≈90 words)
   ✅ Script length is perfect!

✓ Checklist:
   ✅ Contains OwnerFi.ai CTA
   ✅ Contains question/hook
   ✅ Within 90-word target
```

---

## 🚀 Usage in Production

### Automated Social Media Content

The system integrates with:
- **HeyGen** - Video generation with avatar
- **Submagic** - Caption/subtitle generation (optional)
- **Metricool** - Social media scheduling (optional)

### Workflow
1. System picks a buyer benefit (avoiding recently used)
2. Generates script using ChatGPT with daily theme
3. Creates video with HeyGen API
4. (Optional) Adds captions with Submagic
5. (Optional) Schedules to social media

### Daily 5-Video Engine
Configure the system to generate **5 videos per day**:
- All videos use the **same daily theme**
- Different buyer benefits each video
- Variety through different benefit categories
- Consistent voice but fresh angles

---

## 📋 Content Guidelines

### DO:
✅ Focus on education and inspiration
✅ Use simple, conversational language
✅ Include emotional hooks
✅ Share real insights about owner financing
✅ End with soft, natural CTA
✅ Stay within 30-second limit

### DON'T:
❌ Promise approvals or guarantees
❌ Use corporate/salesy language
❌ Mention specific prices
❌ Use trademarked phrases
❌ Copy content from other sources
❌ Make unrealistic claims

---

## 🔒 Buyer-Only Enforcement

The system **actively prevents** seller content:

```typescript
// In generateScript()
if (benefit.audience !== 'buyer') {
  throw new Error('This system is BUYER-ONLY. Seller benefits are not supported.');
}

// In generateBenefitVideo()
if (benefit.audience !== 'buyer') {
  throw new Error('This system is BUYER-ONLY. Seller benefits are not supported.');
}
```

Any attempt to use seller benefits will fail immediately with a clear error message.

---

## 📊 Success Metrics

Track these KPIs:
- **Hook rate** - Do people watch past 3 seconds?
- **Completion rate** - Do they watch to the end?
- **Click-through rate** - Do they visit OwnerFi.ai?
- **Engagement** - Likes, comments, shares
- **Lead generation** - How many sign up?

---

## 🎨 Example Scripts by Day

### Monday (Credit Myths)
> "Bad credit? So what. Most people don't know that owner financing doesn't care about your credit score like banks do. What matters is stable income and commitment. Stop letting a number stop you from homeownership. Find homes that work with YOUR situation at OwnerFi.ai."

### Tuesday (Real Stories)
> "Meet Sarah. Denied by 5 banks. Owned her home in 3 weeks through owner financing. She had steady income but medical debt tanked her credit. The seller saw her commitment, not her score. Now she's building equity every month. See stories like Sarah's at OwnerFi.ai."

### Wednesday (How It Works)
> "Here's how owner financing works: You buy directly from the seller. They become your bank. You make monthly payments to them, not Chase or Wells Fargo. They hold the deed until you pay it off. Simple. Fast. Flexible. Search homes today at OwnerFi.ai."

---

## 🔧 Troubleshooting

### Script too long?
- AI is set to target 90 words
- If consistently over, adjust `temperature` parameter (currently 0.85)
- Check prompt clarity

### Script not engaging?
- Verify daily theme is being applied
- Check that benefit description is compelling
- Review recent outputs for patterns

### Error: "BUYER-ONLY"
- ✅ This is intentional!
- System is rejecting seller benefits
- Only use buyer benefits from the content library

---

## 📝 Changelog

### Version 2.0 (October 2025)
- ✅ Implemented buyer-only enforcement
- ✅ Added daily theme guidance system
- ✅ Refined ChatGPT prompt for better engagement
- ✅ Simplified CTA to "OwnerFi.ai"
- ✅ Updated to 5th-grade reading level
- ✅ Added copyright-safe content requirements
- ✅ Created comprehensive test script

### Version 1.0
- Initial implementation with Abdullah Brand
- Supported both buyers and sellers
- Used longer, more complex prompts

---

## 🤝 Support

For issues or questions:
1. Check test script output: `npx tsx scripts/test-buyer-benefit-script.ts`
2. Review this documentation
3. Check environment variables are set correctly
4. Verify OpenAI API key has credits

---

**Last Updated**: October 2025
**System Status**: ✅ Production Ready
**Focus**: Buyer-Only Content
**Goal**: Help renters become homeowners through owner financing
