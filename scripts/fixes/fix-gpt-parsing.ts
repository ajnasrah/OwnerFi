// Fix for GPT JSON parsing issues in ownerfi-daily-video-v2.ts

import { OpenAI } from 'openai';

// IMPROVED VERSION WITH JSON MODE
export async function generateDynamicScriptFixed(
  cards: any[], 
  lang: 'en' | 'es',
  openai: OpenAI
): Promise<any> {
  const systemPrompt = `You are a video script generator. 
Return ONLY valid JSON matching this exact structure:
{
  "theme": "string",
  "structure": "story|educational|news|comparison|tips|myth|trend",
  "hook": "string (max 8 words)",
  "scenes": [
    {"text": "string", "duration": number, "emotion": "string"}
  ],
  "caption": "string (under 80 chars)",
  "title": "string (under 60 chars)", 
  "hashtags": ["string"],
  "voiceStyle": "excited|calm|urgent|friendly|mysterious|professional"
}`;

  const userPrompt = `Create a video script about real estate/home buying.
Location: ${cards[0]?.city}, ${cards[0]?.state}
Make it unique and engaging.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.9,
      response_format: { type: "json_object" }, // FORCE JSON MODE
      max_tokens: 800,
    });

    const content = response.choices[0].message.content || '{}';
    const parsed = JSON.parse(content);
    
    // Validate and fix voiceStyle
    if (!parsed.voiceStyle || !['excited', 'calm', 'urgent', 'friendly', 'mysterious', 'professional'].includes(parsed.voiceStyle)) {
      parsed.voiceStyle = 'friendly';
    }
    
    return parsed;
  } catch (error) {
    console.error('Script generation error:', error);
    // Return a valid fallback
    return {
      theme: 'daily_discovery',
      structure: 'educational',
      hook: 'Check this out',
      scenes: [
        { text: 'Discover amazing homes in your area', duration: 3, emotion: 'excited' },
        { text: 'Creative financing makes it possible', duration: 3, emotion: 'confident' },
        { text: 'Start your journey today', duration: 2, emotion: 'inspiring' }
      ],
      caption: 'New homes available now 🏠',
      title: 'Home Discovery',
      hashtags: ['#realestate', '#homes'],
      voiceStyle: 'friendly'
    };
  }
}