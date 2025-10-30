# 🎤 Property Video Script Parsing Fix

## Problem

The HeyGen avatar was reading out loud **metadata labels** like "CAPTION_15:" and hashtags that were meant for social media captions, not for the voiceover.

### What Was Happening:
When you watched the video for **1346 San Marco Rd**, the avatar would say:
> "Stop scrolling — this 4-bedroom gem... CAPTION_15: 🌅 Own a piece of paradise... #OwnerFi #RealEstate..."

This made the video sound unprofessional and confusing.

### Root Cause:
The OpenAI API returns scripts in this format:
```
TITLE_15: 🌊 Own in Marco Island!
SCRIPT_15: Stop scrolling — this 4-bedroom gem...

CAPTION_15: 🌅 Own a piece of paradise with owner financing!...
```

The regex parser was supposed to extract **only the script text** but was incorrectly capturing everything including the caption.

---

## The Fix

### File Modified:
`/src/lib/property-video-generator.ts` - Line 530-539

### Before (Broken Regex):
```typescript
const script15Match = content.match(/SCRIPT_15:\s*"?([^"]+)"?\s*(?=CAPTION_15|$)/is);
```

**Problem:** The pattern `[^"]+` (match anything except quotes) was too greedy and captured newlines and the "CAPTION_15:" label.

### After (Fixed Regex):
```typescript
const script15Match = content.match(/SCRIPT_15:\s*(.+?)(?=\n\s*CAPTION_15|$)/is);
```

**Solution:**
- Changed to `(.+?)` with non-greedy matching
- Added explicit lookahead for `\n\s*CAPTION_15` (newline + whitespace + CAPTION_15)
- Now stops capturing **before** the caption line

### Also Fixed:
- `SCRIPT_30` regex (same issue)
- `CAPTION_30` regex (for consistency)

---

## Test Results

Created test script: `/scripts/test-script-parsing.ts`

### Old Regex Output (Broken):
```
Stop scrolling — this 4-bedroom gem in Marco Island...

CAPTION_15: 🌅 Own a piece of paradise with owner financing!... #OwnerFi #RealEstate...
```
❌ Includes metadata that gets read aloud

### New Regex Output (Fixed):
```
Stop scrolling — this 4-bedroom gem in Marco Island might just be your dream home! It's listed at $1,795,000 with great owner financing options. See more free listings near you at Owner-Fy dot A Eye — prices and terms can change anytime. Follow Abdullah for the real estate game. Would you buy this if you qualified?
```
✅ Clean script only - no metadata

---

## Impact

### What This Fixes:
✅ HeyGen avatars will now speak **only the script text**
✅ No more "CAPTION_15:" being read aloud
✅ No more hashtags in the voiceover
✅ Professional, clean video narration

### What Stays the Same:
- Captions are still saved correctly to Firestore
- Social media posts still get hashtags
- Both 30-sec and 15-sec variants still generated
- All other functionality unchanged

---

## Next Videos

All **future property videos** generated will use the fixed regex and will sound professional.

### For Existing Videos:
The video for **1346 San Marco Rd** (HeyGen ID: `4bc6df9b488b4a61a6c8d7fb43cd81fc`) was already generated with the broken script and is currently processing in HeyGen.

**Options:**
1. Wait for it to complete and manually delete/regenerate
2. Let it finish and just know future videos are fixed
3. Cancel it in HeyGen dashboard if still processing

---

## Verification

To test the fix is working:
```bash
# Run the test
npx tsx scripts/test-script-parsing.ts

# Generate a new property video
# The script sent to HeyGen will be clean
```

Check any new property video workflow in Firestore `property_videos` collection - the `script` field should NOT contain "CAPTION_15:" or hashtags.

---

## Technical Details

**Regex Pattern Breakdown:**

```typescript
/SCRIPT_15:\s*(.+?)(?=\n\s*CAPTION_15|$)/is
```

- `SCRIPT_15:` - Match the label
- `\s*` - Optional whitespace after colon
- `(.+?)` - Capture group (non-greedy) - gets the actual script text
- `(?=\n\s*CAPTION_15|$)` - Positive lookahead: stop when you see newline + CAPTION_15 OR end of string
- `i` - Case insensitive
- `s` - Dot matches newlines (allows multi-line scripts)

The key fix was adding `\n\s*` to explicitly look for a newline before CAPTION_15, preventing the script from bleeding into the caption.

---

**Status:** ✅ Fixed in `/src/lib/property-video-generator.ts`
**Date:** 2025-10-30
**Affects:** All future property video generations (30-sec and 15-sec variants)
