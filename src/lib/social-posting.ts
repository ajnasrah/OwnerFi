import { Brand } from '@/config/constants';

interface PostingParams {
  workflowId: string;
  brand: Brand;
  videoUrl: string;
  caption?: string;
  title?: string;
}

/**
 * Trigger posting to Late.dev
 */
export async function triggerLatePosting(params: PostingParams): Promise<boolean> {
  const { workflowId, brand, videoUrl, caption, title } = params;
  
  const LATE_API_KEY = process.env.LATE_API_KEY;
  const LATE_PROFILE_ID = process.env[`LATE_${brand.toUpperCase()}_PROFILE_ID`] || process.env.LATE_OWNERFI_PROFILE_ID;
  
  if (!LATE_API_KEY || !LATE_PROFILE_ID) {
    console.error(`[Late Posting] Missing credentials for brand ${brand}`);
    return false;
  }

  try {
    // Get profile to check connected platforms
    const profileRes = await fetch(`https://getlate.dev/api/v1/profiles/${LATE_PROFILE_ID}`, {
      headers: {
        'Authorization': `Bearer ${LATE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!profileRes.ok) {
      console.error(`[Late Posting] Failed to get profile: ${profileRes.status}`);
      return false;
    }

    const profile = await profileRes.json();
    const platforms = profile.accounts?.filter((a: any) => a.connected) || [];
    
    if (platforms.length === 0) {
      console.error('[Late Posting] No connected platforms');
      return false;
    }

    console.log(`[Late Posting] Posting to ${platforms.map((p: any) => p.platform).join(', ')}`);

    // Create post
    const postData = {
      profileId: LATE_PROFILE_ID,
      content: caption || '',
      media: [{
        type: 'video',
        url: videoUrl,
        caption: title || ''
      }],
      platforms: platforms.map((p: any) => p.platform),
      scheduleAt: null, // Post immediately
      metadata: {
        workflowId,
        brand,
        source: 'webhook_trigger'
      }
    };

    const postRes = await fetch('https://getlate.dev/api/v1/posts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LATE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(postData)
    });

    if (!postRes.ok) {
      const error = await postRes.text();
      console.error(`[Late Posting] Failed to create post: ${error}`);
      return false;
    }

    const post = await postRes.json();
    console.log(`[Late Posting] Post created: ${post.id || 'success'}`);
    return true;

  } catch (error) {
    console.error('[Late Posting] Error:', error);
    return false;
  }
}