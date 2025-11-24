# Add Host Profile to Podcast Config

## Problem
Podcast workflows are failing because there's no HOST profile in the Firestore `podcast_config/main` document.

The podcast cron calls `getHostProfile()` which returns NULL, causing the error:
```
"Host profile not found in Firestore"
```

## Solution

You need to add a `host` object to your `podcast_config/main` document in Firestore.

### Using Firebase Console

1. Go to **Firestore Database** in Firebase Console
2. Navigate to collection: `podcast_config`
3. Open document: `main`
4. Add a new field called `host` with this structure:

```json
{
  "host": {
    "name": "Abdullah",
    "avatar_type": "avatar",
    "avatar_id": "Wayne_20240711",
    "voice_id": "bVMeCyTHy58xNoL34h3p",
    "scale": 1.4,
    "background_color": "#f5f5f5",
    "description": "Host of the OwnerFi & Carz podcast"
  }
}
```

### Avatar & Voice IDs

Use the same avatar/voice you use for social media "me" videos:
- **Avatar ID**: `Wayne_20240711` (the "me" avatar)
- **Voice ID**: `bVMeCyTHy58xNoL34h3p` (Josh - professional voice)

OR if you want a different avatar for podcasts, use:
- **Avatar ID**: `Shawn_Business_Front_public` (professional look)
- **Voice ID**: `d2f4f24783d04e22ab49ee8fdc3715e0` (Alex - tech voice)

### After Adding Host Profile

1. Save the changes in Firestore
2. Go to `/admin/social-dashboard`
3. Click the **Podcast** tab
4. Click **"Generate Episode Now"**
5. The podcast should now successfully create a HeyGen video!

## Verification

After adding the host profile, test it:

```bash
curl -X GET "https://ownerfi.ai/api/podcast/profiles" | python3 -m json.tool
```

You should see the host profile in the response.
