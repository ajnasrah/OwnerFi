/**
 * Gaza Article Screenshot Capture
 *
 * Captures screenshots of news articles to use as video backgrounds.
 * Uses a screenshot service or fallback to a dark branded background.
 */

export interface ScreenshotResult {
  success: boolean;
  imageUrl?: string;
  fallbackUsed: boolean;
  error?: string;
}

// Default dark background for Gaza content (somber/serious tone)
const DEFAULT_GAZA_BACKGROUND = '#1a1a2e';

/**
 * Capture a screenshot of an article URL
 *
 * Uses screenshotapi.net or similar service to capture the article page.
 * Falls back to a dark branded background if capture fails.
 */
export async function captureArticleScreenshot(
  articleUrl: string,
  options: {
    width?: number;
    height?: number;
    fullPage?: boolean;
    timeout?: number;
  } = {}
): Promise<ScreenshotResult> {
  const {
    width = 1080,
    height = 1920,
    fullPage = false,
    timeout = 30000,
  } = options;

  // Check for screenshot API key
  const apiKey = process.env.SCREENSHOT_API_KEY;

  if (!apiKey) {
    console.log('⚠️  SCREENSHOT_API_KEY not configured - using default background');
    return {
      success: false,
      fallbackUsed: true,
      error: 'No screenshot API key configured',
    };
  }

  try {
    console.log(`📸 Capturing screenshot: ${articleUrl}`);

    // Use screenshotapi.net (or similar service)
    // This is a common API format - adjust based on your actual provider
    const screenshotUrl = new URL('https://shot.screenshotapi.net/screenshot');
    screenshotUrl.searchParams.set('token', apiKey);
    screenshotUrl.searchParams.set('url', articleUrl);
    screenshotUrl.searchParams.set('width', width.toString());
    screenshotUrl.searchParams.set('height', height.toString());
    screenshotUrl.searchParams.set('full_page', fullPage.toString());
    screenshotUrl.searchParams.set('output', 'image');
    screenshotUrl.searchParams.set('file_type', 'png');
    screenshotUrl.searchParams.set('wait_for_event', 'load');
    screenshotUrl.searchParams.set('delay', '2000'); // Wait 2s for JS to render

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(screenshotUrl.toString(), {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Screenshot API error: ${response.status} - ${errorText}`);
    }

    // Get the screenshot image
    const imageBuffer = await response.arrayBuffer();

    // Upload to R2 for persistent storage
    const { uploadToR2 } = await import('@/lib/video-storage');
    const filename = `gaza/screenshots/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.png`;

    const publicUrl = await uploadToR2(
      Buffer.from(imageBuffer),
      filename,
      'image/png'
    );

    console.log(`✅ Screenshot captured and uploaded: ${publicUrl}`);

    return {
      success: true,
      imageUrl: publicUrl,
      fallbackUsed: false,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.warn(`⚠️  Screenshot capture failed: ${errorMessage}`);
    console.log('   Using default dark background instead');

    return {
      success: false,
      fallbackUsed: true,
      error: errorMessage,
    };
  }
}

/**
 * Get background configuration for HeyGen video
 *
 * If screenshot is available, returns image background config.
 * Otherwise returns solid color background config.
 */
export function getVideoBackgroundConfig(screenshotUrl?: string): {
  type: 'image' | 'color';
  value: string;
  fit?: 'cover' | 'contain' | 'none';
} {
  if (screenshotUrl) {
    return {
      type: 'image',
      value: screenshotUrl,
      fit: 'cover',
    };
  }

  return {
    type: 'color',
    value: DEFAULT_GAZA_BACKGROUND,
  };
}

/**
 * Create a text overlay image for article title
 *
 * This can be used as an alternative to screenshot - shows article title
 * with Gaza branding on a dark background.
 */
export async function createTitleOverlayImage(
  articleTitle: string,
  options: {
    width?: number;
    height?: number;
    brandColor?: string;
    textColor?: string;
  } = {}
): Promise<ScreenshotResult> {
  const {
    width = 1080,
    height = 1920,
    brandColor = '#1a1a2e',
    textColor = '#ffffff',
  } = options;

  try {
    // For now, return fallback - can integrate with image generation service later
    // (e.g., Cloudinary text overlay, Canvas API, or custom service)
    console.log('ℹ️  Title overlay image generation not yet implemented');
    console.log(`   Title: ${articleTitle.substring(0, 50)}...`);

    return {
      success: false,
      fallbackUsed: true,
      error: 'Title overlay generation not implemented',
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      fallbackUsed: true,
      error: errorMessage,
    };
  }
}

/**
 * Get the best available background for an article
 *
 * Tries screenshot first, then title overlay, then fallback color.
 */
export async function getBestBackground(
  articleUrl: string,
  articleTitle: string
): Promise<{ imageUrl?: string; backgroundColor: string }> {
  // Try screenshot first
  const screenshotResult = await captureArticleScreenshot(articleUrl);

  if (screenshotResult.success && screenshotResult.imageUrl) {
    return {
      imageUrl: screenshotResult.imageUrl,
      backgroundColor: DEFAULT_GAZA_BACKGROUND,
    };
  }

  // Fall back to dark color
  console.log('   Using dark background for Gaza video');
  return {
    backgroundColor: DEFAULT_GAZA_BACKGROUND,
  };
}
