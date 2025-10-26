# Motion Avatars - Quick Reference

## Avatar IDs

### Abdullah (Carz, OwnerFi, Property, Benefit, Podcast)
```
Avatar ID: f40972493dd74bbe829f30daa09ea1a9
Type: talking_photo
Voice: 9070a6c2dbd54c10bb111dc8c655bff7
```

### VassDistro
```
Avatar ID: 6764a52c1b734750a0fba6ab6caa9cd9
Type: talking_photo
Voice: 9070a6c2dbd54c10bb111dc8c655bff7
```

## Motion Features
- Hand gestures synchronized with speech
- Animated facial expressions (smiles, raised eyebrows)
- Strong engaging eye contact
- Stable natural posture
- Dynamic yet anchored presence

## Test Videos
```bash
# Test Abdullah avatar
npx tsx test-motion-avatar.ts

# Test VassDistro avatar
npx tsx test-vassdistro-motion.ts

# Check video status
npx tsx scripts/check-heygen-status.ts VIDEO_ID
```

## Files Modified
- `src/lib/property-video-generator.ts:290`
- `src/lib/benefit-video-generator.ts:14`
- `src/app/api/workflow/complete-viral/route.ts:115-122`
- `src/app/api/podcast/profiles/init/route.ts:167`
- `podcast/config/guest-profiles.json:157`

## All Brands ✅
- Carz: Motion enabled
- OwnerFi: Motion enabled
- Property: Motion enabled
- Benefit: Motion enabled
- Podcast: Motion enabled
- VassDistro: Motion enabled

**Status**: ALL BRANDS CONFIGURED ✅
