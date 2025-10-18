/**
 * Automatic image quality analysis for new properties
 * Detects Google Street View placeholders and flags them for replacement
 */

export interface ImageQualityResult {
  overallScore: number;
  imageQuality: number;
  professional: number;
  presentation: number;
  relevance: number;
  issues: string[];
  recommendation: 'KEEP' | 'REPLACE';
  reasoning: string;
  analyzedAt: string;
  isStreetView: boolean;
}

/**
 * Detect if image is a Google Street View placeholder
 * This is a fast, free check that runs on every new property
 */
export function detectStreetViewImage(imageUrl: string): ImageQualityResult | null {
  // Check for Google Street View URLs
  if (imageUrl.includes('maps.googleapis.com/maps/api/streetview') ||
      imageUrl.includes('maps.google.com') ||
      imageUrl.includes('streetview')) {
    return {
      overallScore: 1,
      imageQuality: 1,
      professional: 1,
      presentation: 1,
      relevance: 1,
      issues: ['Using Google Street View placeholder - needs real property photo'],
      recommendation: 'REPLACE',
      reasoning: 'Property is using an automated Street View image instead of professional photography. Replace with actual property photos.',
      analyzedAt: new Date().toISOString(),
      isStreetView: true
    };
  }

  // If it's a real image URL, mark it as good by default
  return {
    overallScore: 7,
    imageQuality: 7,
    professional: 7,
    presentation: 7,
    relevance: 7,
    issues: [],
    recommendation: 'KEEP',
    reasoning: 'Property has a real image URL (not Street View)',
    analyzedAt: new Date().toISOString(),
    isStreetView: false
  };
}

/**
 * Optional: Analyze image quality using GPT-4 Vision (costs $)
 * Only use this for manual analysis or special cases
 */
export async function analyzePropertyImage(imageUrl: string, propertyAddress: string): Promise<ImageQualityResult | null> {
  const openaiApiKey = process.env.OPENAI_API_KEY;

  if (!openaiApiKey) {
    console.warn('OpenAI API key not configured - using Street View detection only');
    return detectStreetViewImage(imageUrl);
  }

  // First do the free Street View check
  const streetViewCheck = detectStreetViewImage(imageUrl);
  if (streetViewCheck.isStreetView) {
    return streetViewCheck;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `You are a real estate photography expert. Analyze this property image and rate it on the following criteria:

1. Image Quality (resolution, clarity, lighting)
2. Professional Appearance (composition, angles)
3. Property Presentation (clean, staged, appealing)
4. Relevance (shows the actual property, not generic/stock photos)

Rate each criterion from 1-10 and provide an overall score (1-10).
Identify specific issues if the score is below 7.

Respond in JSON format:
{
  "overallScore": 7,
  "imageQuality": 8,
  "professional": 7,
  "presentation": 6,
  "relevance": 9,
  "issues": ["Low lighting in some areas", "Needs staging"],
  "recommendation": "KEEP" or "REPLACE",
  "reasoning": "Brief explanation"
}`
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl
                }
              }
            ]
          }
        ],
        max_tokens: 500
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI API error:', error);
      return null;
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    // Parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return {
        ...result,
        analyzedAt: new Date().toISOString()
      };
    }

    return null;
  } catch (error) {
    console.error('Error analyzing image:', error);
    return null;
  }
}

/**
 * Analyze property image in the background (non-blocking)
 * Automatically flags Google Street View images
 * Stores the result in Firestore
 */
export async function analyzePropertyImageAsync(
  propertyId: string,
  imageUrl: string,
  address: string,
  updateProperty: (data: { imageQuality?: ImageQualityResult }) => Promise<void>,
  useAI: boolean = false  // Set to true only for full AI analysis (costs $)
): Promise<void> {
  // Run in background - don't await
  setImmediate(async () => {
    try {
      let result: ImageQualityResult | null;

      if (useAI) {
        // Full AI analysis with GPT-4 Vision (costs money)
        result = await analyzePropertyImage(imageUrl, address);
      } else {
        // Free Street View detection (default for new properties)
        result = detectStreetViewImage(imageUrl);
      }

      if (result) {
        await updateProperty({ imageQuality: result });

        if (result.isStreetView) {
          console.log(`⚠️  Street View detected for ${address} - needs real photo`);
        } else {
          console.log(`✅ Real image detected for ${address}`);
        }
      }
    } catch (error) {
      console.error('Background image analysis failed:', error);
    }
  });
}
