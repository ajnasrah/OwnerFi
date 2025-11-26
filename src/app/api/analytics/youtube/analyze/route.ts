import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface VideoData {
  videoId: string;
  title: string;
  views: number;
  likes: number;
  comments: number;
  engagement: number;
  duration: number;
  publishedAt: string;
}

interface AnalysisRequest {
  selectedVideos: VideoData[];
  allVideos: VideoData[];
  brandAvgViews: number;
  brandAvgEngagement: number;
}

interface AIAnalysisResult {
  uniquePatterns: {
    hooks: string[];
    topics: string[];
    emotionalTriggers: string[];
    structuralElements: string[];
  };
  keyDifferentiators: string[];
  recommendations: string[];
  promptTemplate: string;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * POST /api/analytics/youtube/analyze
 *
 * Uses AI to deeply analyze what makes selected videos unique/successful
 */
export async function POST(request: NextRequest) {
  try {
    const body: AnalysisRequest = await request.json();
    const { selectedVideos, allVideos, brandAvgViews, brandAvgEngagement } = body;

    if (!selectedVideos || selectedVideos.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No videos selected for analysis',
      }, { status: 400 });
    }

    console.log(`🧠 [AI Analysis] Analyzing ${selectedVideos.length} videos...`);

    // Calculate stats for selected vs non-selected
    const nonSelectedVideos = allVideos.filter(
      v => !selectedVideos.find(s => s.videoId === v.videoId)
    );

    const selectedAvgViews = selectedVideos.reduce((sum, v) => sum + v.views, 0) / selectedVideos.length;
    const selectedAvgEngagement = selectedVideos.reduce((sum, v) => sum + v.engagement, 0) / selectedVideos.length;
    const selectedAvgDuration = selectedVideos.reduce((sum, v) => sum + v.duration, 0) / selectedVideos.length;

    const nonSelectedAvgViews = nonSelectedVideos.length > 0
      ? nonSelectedVideos.reduce((sum, v) => sum + v.views, 0) / nonSelectedVideos.length
      : 0;
    const nonSelectedAvgEngagement = nonSelectedVideos.length > 0
      ? nonSelectedVideos.reduce((sum, v) => sum + v.engagement, 0) / nonSelectedVideos.length
      : 0;

    // Build comparison context
    const selectedTitles = selectedVideos
      .sort((a, b) => b.views - a.views)
      .map((v, i) => `${i + 1}. "${v.title}" (${v.views.toLocaleString()} views, ${v.engagement.toFixed(2)}% eng, ${v.duration}s)`)
      .join('\n');

    const nonSelectedTitles = nonSelectedVideos
      .sort((a, b) => b.views - a.views)
      .slice(0, 10)
      .map((v, i) => `${i + 1}. "${v.title}" (${v.views.toLocaleString()} views, ${v.engagement.toFixed(2)}% eng, ${v.duration}s)`)
      .join('\n');

    const prompt = `You are a viral content analyst specializing in YouTube Shorts. Analyze these selected high-performing videos and identify EXACTLY what makes them different from the other videos.

## SELECTED VIDEOS (User marked these as their best):
${selectedTitles}

## OTHER VIDEOS FROM THE CHANNEL (for comparison):
${nonSelectedTitles || 'No comparison videos available'}

## PERFORMANCE METRICS:
- Selected videos avg views: ${selectedAvgViews.toLocaleString()}
- Other videos avg views: ${nonSelectedAvgViews.toLocaleString()}
- Selected videos avg engagement: ${selectedAvgEngagement.toFixed(2)}%
- Other videos avg engagement: ${nonSelectedAvgEngagement.toFixed(2)}%
- Selected videos avg duration: ${selectedAvgDuration.toFixed(0)} seconds
- Channel overall avg views: ${brandAvgViews.toLocaleString()}
- Channel overall avg engagement: ${brandAvgEngagement.toFixed(2)}%

## YOUR ANALYSIS TASK:
1. Identify the SPECIFIC patterns in the selected videos' titles/hooks that set them apart
2. Find common topics, themes, or angles that appear in the selected videos
3. Identify emotional triggers (curiosity, controversy, urgency, etc.)
4. Note any structural patterns (question format, number lists, etc.)
5. Determine what the selected videos do differently from the non-selected ones
6. Provide actionable recommendations for future content

## IMPORTANT GUIDELINES:
- Be SPECIFIC, not generic. Don't say "use attention-grabbing hooks" - say exactly WHAT makes these hooks work
- Compare and contrast with the non-selected videos to find the differentiators
- Focus on replicable patterns, not one-off successes
- Base your confidence level on how clear and consistent the patterns are

Return a JSON object with this exact structure:
{
  "uniquePatterns": {
    "hooks": ["Specific hook pattern 1", "Specific hook pattern 2"],
    "topics": ["Topic/angle that works", "Another topic pattern"],
    "emotionalTriggers": ["Specific emotion 1", "Specific emotion 2"],
    "structuralElements": ["Format pattern 1", "Format pattern 2"]
  },
  "keyDifferentiators": [
    "What selected videos do that others don't - be specific",
    "Another key difference"
  ],
  "recommendations": [
    "Actionable recommendation 1",
    "Actionable recommendation 2",
    "Actionable recommendation 3"
  ],
  "promptTemplate": "A specific prompt template incorporating these patterns that can be used to generate similar content",
  "confidence": "high|medium|low"
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert viral content analyst. Provide deep, specific analysis - never generic advice. Always return valid JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const responseText = completion.choices[0].message.content?.trim() || '{}';

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    const jsonText = jsonMatch ? jsonMatch[0] : responseText;

    let analysis: AIAnalysisResult;
    try {
      analysis = JSON.parse(jsonText);
    } catch {
      console.error('Failed to parse AI response:', responseText);
      return NextResponse.json({
        success: false,
        error: 'Failed to parse AI analysis',
      }, { status: 500 });
    }

    console.log(`✅ [AI Analysis] Complete. Confidence: ${analysis.confidence}`);

    return NextResponse.json({
      success: true,
      analysis,
      stats: {
        selectedCount: selectedVideos.length,
        comparisonCount: nonSelectedVideos.length,
        selectedAvgViews: Math.round(selectedAvgViews),
        selectedAvgEngagement: parseFloat(selectedAvgEngagement.toFixed(2)),
        selectedAvgDuration: Math.round(selectedAvgDuration),
        performanceMultiplier: nonSelectedAvgViews > 0
          ? parseFloat((selectedAvgViews / nonSelectedAvgViews).toFixed(2))
          : null,
      },
      analyzedAt: Date.now(),
    });

  } catch (error) {
    console.error('Error in AI video analysis:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
