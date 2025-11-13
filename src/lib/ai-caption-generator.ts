/**
 * AI-Powered Caption and Hashtag Generation
 *
 * Uses ChatGPT to analyze video transcripts from SubMagic and generate
 * engaging captions and relevant hashtags for social media.
 */

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface CaptionResult {
  caption: string;
  hashtags: string[];
  fullCaption: string; // caption + hashtags combined
}

/**
 * Fetch transcript from SubMagic project
 */
async function getSubmagicTranscript(projectId: string): Promise<string | null> {
  const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;
  if (!SUBMAGIC_API_KEY) {
    console.warn('⚠️  SubMagic API key not configured');
    return null;
  }

  try {
    const response = await fetch(`https://api.submagic.co/v1/projects/${projectId}`, {
      headers: {
        'x-api-key': SUBMAGIC_API_KEY,
      },
    });

    if (!response.ok) {
      console.warn(`⚠️  Failed to fetch SubMagic project: ${response.status}`);
      return null;
    }

    const data = await response.json();

    // Extract words and combine into transcript
    if (data.words && Array.isArray(data.words)) {
      const transcript = data.words
        .map((w: any) => w.word || '')
        .join(' ')
        .trim();

      return transcript.length > 10 ? transcript : null;
    }

    return null;
  } catch (error) {
    console.error('Error fetching SubMagic transcript:', error);
    return null;
  }
}

/**
 * Generate engaging caption and hashtags using ChatGPT
 */
export async function generateCaptionAndHashtags(
  submagicProjectId: string | undefined,
  videoFileName?: string
): Promise<CaptionResult> {
  // Fetch transcript if we have a SubMagic project ID
  const transcript = submagicProjectId
    ? await getSubmagicTranscript(submagicProjectId)
    : null;

  let prompt: string;

  if (transcript) {
    prompt = `You are a social media expert. Based on this video transcript, create an engaging caption and hashtags.

VIDEO TRANSCRIPT:
${transcript}

Requirements:
- Caption should be 150-200 characters
- Start with a hook that grabs attention
- Use conversational, engaging tone
- Include 5-8 relevant hashtags
- Make it suitable for Instagram, TikTok, and YouTube

Return ONLY a JSON object with this structure:
{
  "caption": "engaging caption text here",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3", "hashtag4", "hashtag5"]
}`;
  } else {
    // No transcript - use filename as context
    const context = videoFileName
      ? `The video filename is: ${videoFileName}`
      : 'This is a personal video.';

    prompt = `You are a social media expert. ${context}

Create an engaging, general caption and hashtags for a personal video.

Requirements:
- Caption should be 150-200 characters
- Make it intriguing and curiosity-driven
- Use conversational, engaging tone
- Include 5-8 relevant hashtags for personal/lifestyle content
- Make it suitable for Instagram, TikTok, and YouTube

Return ONLY a JSON object with this structure:
{
  "caption": "engaging caption text here",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3", "hashtag4", "hashtag5"]
}`;
  }

  try {
    console.log(`🤖 Generating AI caption...`);
    if (transcript) {
      console.log(`   Using transcript (${transcript.split(' ').length} words)`);
    } else {
      console.log(`   No transcript available, using general approach`);
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a social media expert who creates viral, engaging captions and hashtags. Always return valid JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.8,
      max_tokens: 300,
    });

    const responseText = completion.choices[0].message.content?.trim() || '{}';

    // Extract JSON from response (in case there's extra text)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    const jsonText = jsonMatch ? jsonMatch[0] : responseText;

    const result = JSON.parse(jsonText);

    // Ensure hashtags have # prefix
    const hashtags = (result.hashtags || []).map((tag: string) =>
      tag.startsWith('#') ? tag : `#${tag}`
    );

    const caption = result.caption || 'Check out this video! 🔥';
    const fullCaption = `${caption}\n\n${hashtags.join(' ')}`;

    console.log(`✅ AI caption generated:`);
    console.log(`   Caption: "${caption.substring(0, 80)}..."`);
    console.log(`   Hashtags: ${hashtags.join(' ')}`);

    return {
      caption,
      hashtags,
      fullCaption,
    };
  } catch (error) {
    console.error('Error generating AI caption:', error);

    // Fallback caption
    return {
      caption: 'Check out this video! 🔥',
      hashtags: ['#viral', '#trending', '#video', '#foryou', '#fyp'],
      fullCaption: 'Check out this video! 🔥\n\n#viral #trending #video #foryou #fyp',
    };
  }
}
