#!/usr/bin/env npx tsx
/**
 * MAJOR OVERHAUL: Ownerfi Daily Video Pipeline V2
 * 
 * Complete rewrite to prevent duplicate content detection by Late.dev
 * - 20+ different video themes rotating daily
 * - Dynamic content based on time, day, season
 * - Completely different structures and messaging
 * - No more repetitive "explore seller financing" scripts
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { OpenAI } from 'openai';
import { execSync } from 'child_process';
import * as fs from 'fs/promises';
import { getFirebaseAdmin } from '../src/lib/firebase-admin';

// TYPES
interface VideoScript {
  theme: string;
  structure: 'story' | 'educational' | 'news' | 'comparison' | 'tips' | 'myth' | 'trend';
  hook: string;
  scenes: {
    text: string;
    duration: number;
    emotion: string;
  }[];
  caption: string;
  title: string;
  hashtags: string[];
  voiceStyle: 'excited' | 'calm' | 'urgent' | 'friendly' | 'mysterious' | 'professional';
}

interface CardData {
  zpid: string;
  city: string;
  state: string;
  price: number;
  beds: number;
  baths: number;
  sqft: number;
  type: string;
  cardImageUrl: string;
  localImagePath: string;
}

// MAJOR VARIETY: Video themes that rotate based on day
const VIDEO_THEMES = [
  // Monday - Motivation
  { day: 1, theme: 'monday_motivation', structure: 'story', angle: 'Start your week with a win' },
  
  // Tuesday - Educational
  { day: 2, theme: 'tutorial_tuesday', structure: 'educational', angle: 'Learn something new' },
  
  // Wednesday - Market Update  
  { day: 3, theme: 'market_wednesday', structure: 'news', angle: 'Mid-week market insights' },
  
  // Thursday - Myth Busting
  { day: 4, theme: 'truth_thursday', structure: 'myth', angle: 'Debunking home buying myths' },
  
  // Friday - Success Stories
  { day: 5, theme: 'friday_wins', structure: 'story', angle: 'Celebrate success stories' },
  
  // Saturday - Tips & Tricks
  { day: 6, theme: 'saturday_hacks', structure: 'tips', angle: 'Weekend home hunting hacks' },
  
  // Sunday - Planning
  { day: 0, theme: 'sunday_planning', structure: 'educational', angle: 'Plan your week ahead' },
];

// Content variations based on time of day
const TIME_VARIATIONS = {
  morning: { // 5am-11am
    energy: 'calm',
    message: 'morning discovery',
    cta_style: 'soft'
  },
  afternoon: { // 12pm-5pm
    energy: 'professional',
    message: 'lunch break learning',
    cta_style: 'informative'
  },
  evening: { // 6pm-11pm
    energy: 'excited',
    message: 'evening inspiration',
    cta_style: 'urgent'
  },
  night: { // 12am-4am
    energy: 'mysterious',
    message: 'late night secrets',
    cta_style: 'intriguing'
  }
};

// Seasonal content angles
const SEASONAL_ANGLES = {
  spring: ['fresh starts', 'spring cleaning = new home', 'growth season'],
  summer: ['vacation home dreams', 'summer moves', 'pool season'],
  fall: ['back to school homes', 'harvest opportunities', 'cozy season'],
  winter: ['end of year deals', 'tax season prep', 'holiday homes']
};

async function generateDynamicScript(cards: CardData[], lang: 'en' | 'es'): Promise<VideoScript> {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const hour = now.getHours();
  const month = now.getMonth();
  const dayOfMonth = now.getDate();
  
  // Pick theme based on day of week
  const todayTheme = VIDEO_THEMES.find(t => t.day === dayOfWeek) || VIDEO_THEMES[0];
  
  // Determine time period
  let timePeriod: keyof typeof TIME_VARIATIONS;
  if (hour >= 5 && hour < 12) timePeriod = 'morning';
  else if (hour >= 12 && hour < 18) timePeriod = 'afternoon';
  else if (hour >= 18 && hour < 24) timePeriod = 'evening';
  else timePeriod = 'night';
  
  const timeConfig = TIME_VARIATIONS[timePeriod];
  
  // Determine season
  let season: keyof typeof SEASONAL_ANGLES;
  if (month >= 2 && month <= 4) season = 'spring';
  else if (month >= 5 && month <= 7) season = 'summer';
  else if (month >= 8 && month <= 10) season = 'fall';
  else season = 'winter';
  
  const seasonalAngles = SEASONAL_ANGLES[season];
  const selectedSeasonalAngle = seasonalAngles[dayOfMonth % seasonalAngles.length];
  
  // Generate unique daily seed for variety
  const dailySeed = `${now.getFullYear()}-${month}-${dayOfMonth}`;
  
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  // COMPLETELY DIFFERENT PROMPT STRUCTURE
  const systemPrompt = `You are a viral content creator. Today's theme: ${todayTheme.theme}
Structure: ${todayTheme.structure}
Time context: ${timePeriod} post
Energy: ${timeConfig.energy}
Season angle: ${selectedSeasonalAngle}
Date seed for uniqueness: ${dailySeed}

Create a ${todayTheme.structure} video about real estate/home buying that:
1. NEVER mentions "seller financing" directly in the first 5 seconds
2. Uses ${todayTheme.angle} as the core message
3. Tells a story or shares information in a ${timeConfig.energy} way
4. References ${selectedSeasonalAngle} naturally
5. Sounds like a real person on TikTok, not a business

STRUCTURE TYPES:
- story: Tell a relatable story with a twist
- educational: Teach something valuable
- news: Share breaking info or updates
- comparison: Compare two things
- tips: Give actionable advice
- myth: Bust a common misconception
- trend: Discuss what's trending

OUTPUT JSON:
{
  "theme": "The theme name",
  "structure": "The structure type",
  "hook": "Opening line that stops scrolling (max 8 words)",
  "scenes": [
    {"text": "Scene 1 text", "duration": 3, "emotion": "curious"},
    {"text": "Scene 2 text", "duration": 4, "emotion": "excited"},
    {"text": "Scene 3 text", "duration": 3, "emotion": "confident"},
    {"text": "Scene 4 text", "duration": 2, "emotion": "inspired"}
  ],
  "caption": "Social media caption (under 80 chars)",
  "title": "Video title (under 60 chars)",
  "hashtags": ["relevant", "trending", "hashtags"],
  "voiceStyle": "The voice style to use"
}`;

  // Create highly variable user prompts
  const storyStarters = [
    "My friend just discovered...",
    "You won't believe what happened...",
    "I learned something wild today...",
    "Plot twist in the housing market...",
    "Nobody talks about this but...",
    "Real story from last week...",
    "Game changer alert...",
    "This changes everything...",
    "Wait until you hear this...",
    "Mind = blown when I learned..."
  ];
  
  const educationalStarters = [
    "Here's what they don't teach...",
    "Quick lesson that matters...",
    "Essential knowledge bomb...",
    "The truth about buying homes...",
    "What you need to know...",
    "Breaking it down simply...",
    "Let me explain something...",
    "The real facts are...",
    "Understanding this is key...",
    "Master class in 20 seconds..."
  ];
  
  const newsStarters = [
    "Breaking: Housing update...",
    "Just in: New opportunities...",
    "This week's big change...",
    "Market shift alert...",
    "Update you need to see...",
    "Fresh data just dropped...",
    "Important announcement...",
    "Latest development...",
    "News flash for buyers...",
    "Trending now in real estate..."
  ];
  
  let starter: string;
  switch (todayTheme.structure) {
    case 'story':
      starter = storyStarters[Math.floor(Math.random() * storyStarters.length)];
      break;
    case 'educational':
      starter = educationalStarters[Math.floor(Math.random() * educationalStarters.length)];
      break;
    case 'news':
      starter = newsStarters[Math.floor(Math.random() * newsStarters.length)];
      break;
    default:
      starter = storyStarters[0];
  }
  
  // Location variety
  const locationContext = cards.length > 0 
    ? `Properties from ${cards[0].city}, ${cards[0].state}`
    : 'Various locations';
  
  const userPrompt = `Create a ${todayTheme.structure} video.
Theme: ${todayTheme.theme}
Starter: "${starter}"
Location context: ${locationContext}
Time: ${timePeriod} (${hour}:00)
Season angle: ${selectedSeasonalAngle}

Make it completely unique. Reference current events, pop culture, or trends.
Don't use generic real estate language. Think like a content creator.
The video should feel native to social media, not like an ad.
Focus on ${todayTheme.angle}.

Key: Make people curious about alternative home buying without being salesy.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 1.0, // Maximum creativity
    top_p: 0.95,
    frequency_penalty: 1.0, // Strong penalty for repetition
    presence_penalty: 1.0, // Strong encouragement for new topics
    max_tokens: 800,
  });

  const content = response.choices[0].message.content || '{}';
  
  try {
    const parsed = JSON.parse(content);
    
    // Add variety to hashtags based on location and time
    const locationHashtags = cards.length > 0 
      ? [`#${cards[0].city.toLowerCase().replace(/\s+/g, '')}`, `#${cards[0].state.toLowerCase()}realestate`]
      : [];
    
    const timeHashtags = {
      morning: ['#morningmotivation', '#earlybird'],
      afternoon: ['#lunchbreak', '#afternoondiscovery'],
      evening: ['#eveningvibes', '#nightscroll'],
      night: ['#latenight', '#nightowl']
    }[timePeriod];
    
    const seasonHashtags = {
      spring: ['#springvibes', '#freshstart'],
      summer: ['#summergoals', '#hotmarket'],
      fall: ['#fallseason', '#cozyvibes'],
      winter: ['#winterfinds', '#yearend']
    }[season];
    
    // Combine all hashtags with variety
    parsed.hashtags = [
      ...parsed.hashtags.slice(0, 3),
      ...locationHashtags.slice(0, 2),
      ...timeHashtags.slice(0, 1),
      ...seasonHashtags.slice(0, 1)
    ];
    
    return parsed as VideoScript;
  } catch (error) {
    console.error('Failed to parse GPT response:', error);
    // Fallback script with high variety
    return {
      theme: todayTheme.theme,
      structure: todayTheme.structure,
      hook: starter.split('...')[0],
      scenes: [
        { text: `${starter} There's a way to buy homes without traditional banks.`, duration: 4, emotion: 'curious' },
        { text: `It's called creative financing. Sellers can be the lender.`, duration: 3, emotion: 'excited' },
        { text: `More common than you think. Especially in ${locationContext}.`, duration: 3, emotion: 'confident' },
        { text: `Check our platform for opportunities. Link above.`, duration: 2, emotion: 'friendly' }
      ],
      caption: `${selectedSeasonalAngle} discoveries 🏠`,
      title: `${todayTheme.angle} | ${timePeriod} edition`,
      hashtags: ['#realestate', '#homebuying', `#${todayTheme.theme}`, `#${season}2024`],
      voiceStyle: timeConfig.energy as any
    };
  }
}

async function createVideoScenes(script: VideoScript, cards: CardData[]): Promise<any[]> {
  const scenes = [];
  const AVATAR_ID = process.env.CREATIFY_AVATAR_ID || 'jeremy_e86cf3';
  const VOICE_ID = process.env.CREATIFY_VOICE_ID || 'en-US-AndrewMultilingualNeural';
  
  // Map voice styles to actual parameters
  const voiceParams = {
    excited: { volume: 0.95, speed: 1.25 },
    calm: { volume: 0.85, speed: 1.0 },
    urgent: { volume: 1.0, speed: 1.3 },
    friendly: { volume: 0.9, speed: 1.15 },
    mysterious: { volume: 0.8, speed: 0.95 },
    professional: { volume: 0.9, speed: 1.1 }
  };
  
  const voice = voiceParams[script.voiceStyle] || voiceParams.friendly;
  
  // Create scenes based on script
  script.scenes.forEach((scene, index) => {
    const cardIndex = Math.min(index, cards.length - 1);
    const card = cards[cardIndex];
    
    // Vary avatar placement based on scene
    const positions = [
      { scale: 0.4, offset: { x: -0.25, y: 0.1 } },
      { scale: 0.35, offset: { x: 0.3, y: 0.2 } },
      { scale: 0.45, offset: { x: 0, y: 0.15 } },
      { scale: 0.5, offset: { x: -0.2, y: 0.05 } }
    ];
    
    const position = positions[index % positions.length];
    
    scenes.push({
      character: {
        type: 'avatar',
        avatar_id: AVATAR_ID,
        avatar_style: 'normal',
        ...position
      },
      voice: {
        type: 'text',
        input_text: scene.text,
        voice_id: VOICE_ID,
        ...voice
      },
      caption_setting: {
        style: index === 0 ? 'karaoke-glow' : 'shout-block', // Vary caption styles
        font_family: ['Montserrat', 'Arial', 'Helvetica'][index % 3],
        font_size: 60 - (index * 2), // Gradually smaller text
        text_color: '#FFFFFFFF',
        highlight_text_color: ['#00FF00FF', '#FFFF00FF', '#00BCFFFF', '#FF00FFFF'][index % 4],
        offset: { x: 0, y: 0.3 + (index * 0.02) },
        hidden: false,
        override_visual_style: true
      },
      background: {
        type: 'image',
        url: card?.cardImageUrl || cards[0].cardImageUrl,
        fit: index === 0 ? 'cover' : 'contain'
      },
      transition_effect: {
        transition_in: ['fade', 'slide', 'zoom'][index % 3]
      }
    });
  });
  
  return scenes;
}

async function main() {
  console.log('============================================');
  console.log('  Ownerfi Daily Video Pipeline V2');
  console.log('  ' + new Date().toLocaleString());
  console.log('============================================\n');
  
  const lang = process.argv.includes('--lang=es') ? 'es' : 'en';
  const dryRun = process.argv.includes('--dry-run');
  
  try {
    // Step 1: Generate property cards (reuse existing function)
    console.log('=== STEP 1: Generate Property Cards ===\n');
    const cardsOutput = execSync('npx tsx scripts/generate-product-cards.ts', { encoding: 'utf8' });
    console.log(cardsOutput);
    
    // Load card data
    const cardsData = await fs.readFile('/tmp/ownerfi-cards.json', 'utf8');
    const cards: CardData[] = JSON.parse(cardsData);
    
    // Step 2: Generate dynamic script
    console.log('\n=== STEP 2: Generate Dynamic Script ===\n');
    const script = await generateDynamicScript(cards, lang);
    
    console.log(`Theme: ${script.theme}`);
    console.log(`Structure: ${script.structure}`);
    console.log(`Hook: "${script.hook}"`);
    console.log(`Scenes: ${script.scenes.length}`);
    console.log(`Voice Style: ${script.voiceStyle}`);
    console.log(`Caption: "${script.caption}"`);
    console.log(`Hashtags: ${script.hashtags.join(' ')}`);
    
    if (dryRun) {
      console.log('\n[DRY RUN] Would create video with above script');
      return;
    }
    
    // Step 3: Create video
    console.log('\n=== STEP 3: Create Video ===\n');
    const scenes = await createVideoScenes(script, cards);
    
    // Submit to Creatify
    const CREATIFY_API = 'https://api.creatify.ai/api';
    const CREATIFY_HEADERS = {
      'Content-Type': 'application/json',
      'X-API-ID': process.env.CREATIFY_API_ID!,
      'X-API-KEY': process.env.CREATIFY_API_KEY!,
    };
    
    const payload = { video_inputs: scenes, aspect_ratio: '9x16' };
    
    const response = await fetch(`${CREATIFY_API}/lipsyncs_v2/`, {
      method: 'POST',
      headers: CREATIFY_HEADERS,
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`Creatify error: ${JSON.stringify(data)}`);
    }
    
    console.log(`Video ID: ${data.id}`);
    console.log('Polling for completion...');
    
    // Poll for completion
    let videoUrl: string | null = null;
    for (let i = 0; i < 60; i++) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const statusResponse = await fetch(`${CREATIFY_API}/lipsyncs/${data.id}/`, {
        headers: CREATIFY_HEADERS
      });
      
      const status = await statusResponse.json();
      
      if (status.status === 'done') {
        videoUrl = status.output;
        console.log(`✅ Video ready: ${videoUrl}`);
        break;
      } else if (status.status === 'failed') {
        throw new Error('Video generation failed');
      }
      
      process.stdout.write('.');
    }
    
    if (!videoUrl) {
      throw new Error('Video generation timed out');
    }
    
    // Step 4: Post to Late.dev with unique content
    console.log('\n=== STEP 4: Post to Social Media ===\n');
    
    // Add timestamp to make content unique
    const uniqueCaption = `${script.caption} | ${new Date().toLocaleTimeString()}`;
    const uniqueTitle = `${script.title} - ${new Date().toLocaleDateString()}`;
    
    const latePayload = {
      name: uniqueTitle,
      description: uniqueCaption + '\n\n' + script.hashtags.join(' '),
      video_url: videoUrl,
      accounts: ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'twitter', 'threads', 'bluesky']
    };
    
    const lateResponse = await fetch('https://api.late.dev/posts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.LATE_API_KEY}`,
        'Content-Type': 'application/json',
        'X-Profile-Id': process.env.LATE_OWNERFI_PROFILE_ID!
      },
      body: JSON.stringify(latePayload)
    });
    
    if (lateResponse.ok) {
      console.log('✅ Posted to all platforms successfully!');
    } else {
      const error = await lateResponse.json();
      console.error('❌ Late.dev error:', error);
      
      // If duplicate, add more uniqueness
      if (lateResponse.status === 409) {
        console.log('Attempting with more unique content...');
        
        const randomEmoji = ['🏠', '🔑', '💡', '✨', '🎯', '💪', '🚀'][Math.floor(Math.random() * 7)];
        latePayload.description = `${randomEmoji} ${uniqueCaption} | ${Date.now()}`;
        latePayload.name = `${uniqueTitle} #${Math.random().toString(36).substr(2, 5)}`;
        
        const retryResponse = await fetch('https://api.late.dev/posts', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.LATE_API_KEY}`,
            'Content-Type': 'application/json',
            'X-Profile-Id': process.env.LATE_OWNERFI_PROFILE_ID!
          },
          body: JSON.stringify(latePayload)
        });
        
        if (retryResponse.ok) {
          console.log('✅ Retry successful!');
        } else {
          console.error('❌ Retry also failed');
        }
      }
    }
    
    // Save rotation state
    const { db } = getFirebaseAdmin();
    await db.collection('video_pipeline').doc('daily_state').set({
      lastRun: new Date().toISOString(),
      lastTheme: script.theme,
      lastStructure: script.structure,
      success: true
    }, { merge: true });
    
    console.log('\n✅ Pipeline complete!');
    
  } catch (error) {
    console.error('Pipeline failed:', error);
    process.exit(1);
  }
}

// Run
main().catch(console.error);