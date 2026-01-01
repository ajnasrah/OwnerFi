/**
 * AI Blog Content Generator
 *
 * Auto-generates complete blog posts from topics using OpenAI
 */

import { Brand } from '@/config/constants';
import { BlogSection, CONTENT_PILLARS } from './blog-models';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Blog generation request
 */
export interface BlogGenerationRequest {
  brand: Brand;
  topic: string; // e.g., "How to buy a house with bad credit using owner financing in Dallas"
  pillar?: string; // Optional: auto-detect if not provided
  tone?: 'professional' | 'casual' | 'educational'; // Optional: brand default if not provided
  targetLength?: 'short' | 'medium' | 'long'; // Optional: medium default
}

/**
 * Blog generation result
 */
export interface BlogGenerationResult {
  title: string;
  subtitle: string;
  author: string;
  sections: BlogSection[];
  pillar: string;
  focusKeyword: string;
  tags: string[];
  estimatedReadTime: number; // minutes
}

/**
 * Get tone for brand
 */
function getBrandTone(brand: Brand): 'professional' | 'casual' | 'educational' {
  switch (brand) {
    case 'ownerfi':
    case 'carz':
    case 'benefit':
      return 'professional';
    case 'abdullah':
    case 'personal':
      return 'casual';
    case 'gaza':
      return 'educational';
    default:
      return 'educational';
  }
}

/**
 * Get brand context for AI
 */
function getBrandContext(brand: Brand): string {
  switch (brand) {
    case 'ownerfi':
      return 'OwnerFi is a platform for owner-financed real estate. We help buyers with bad credit find homes through seller financing, subject-to deals, and contract-for-deed arrangements. Our audience is primarily credit-challenged buyers looking for alternative home financing in Texas, Florida, and Georgia.';
    case 'carz':
      return 'Carz Inc is a wholesale car dealership. We share insider tips about car buying, auction secrets, and how wholesale pricing really works. Our audience includes car buyers looking to save money and people interested in car flipping as a side hustle.';
    case 'abdullah':
      return 'Abdullah is a real estate and car entrepreneur who runs multiple businesses using automation and AI. His audience wants real talk about money, entrepreneurship, deal-making, and building businesses without a traditional W-2 job.';
    case 'benefit':
      return 'Benefit content focuses on emotional benefits of homeownership for renters considering owner financing.';
    case 'personal':
      return 'Personal brand content featuring authentic stories and experiences.';
    case 'gaza':
      return 'Gaza humanitarian news coverage providing updates on the humanitarian situation in Gaza.';
    default:
      return '';
  }
}

/**
 * Auto-detect pillar from topic
 */
function detectPillar(brand: Brand, topic: string): string {
  const topicLower = topic.toLowerCase();
  const pillars = CONTENT_PILLARS[brand] || [];

  // Simple keyword matching
  for (const pillar of pillars) {
    const keywords = pillar.id.split('-');
    if (keywords.some(keyword => topicLower.includes(keyword))) {
      return pillar.id;
    }
  }

  // Default to first pillar
  return pillars[0]?.id || 'general';
}

/**
 * Generate blog content using AI
 */
export async function generateBlogContent(request: BlogGenerationRequest): Promise<BlogGenerationResult> {
  const { brand, topic, pillar, tone, targetLength = 'medium' } = request;

  const brandContext = getBrandContext(brand);
  const brandTone = tone || getBrandTone(brand);
  const detectedPillar = pillar || detectPillar(brand, topic);

  // Word count targets
  const wordCounts = {
    short: '800-1000',
    medium: '1200-1500',
    long: '2000-2500',
  };

  const systemPrompt = `You are an expert content writer for ${brand}. ${brandContext}

Write in a ${brandTone} tone. Use simple language (5th grade reading level). Be specific with numbers and examples.

Your goal: Create SEO-optimized blog posts that rank on Google AND convert into engaging social media carousels.`;

  const userPrompt = `Write a complete blog post about: "${topic}"

Target length: ${wordCounts[targetLength]} words

Structure it in exactly 6 sections:

1. HOOK (Introduction) - 3-5 sentences that grab attention. Call out the pain point and promise a solution.

2. PROBLEM (The Challenge) - Explain the situation in simple terms. Why is this a problem? Who faces it?

3. STEPS (How It Works / Framework) - This is THE MOST IMPORTANT section. Provide 5-7 clear, actionable bullet points. Each bullet should be 1-2 sentences. These will become carousel slides on Instagram.

4. EXAMPLE (Real Story / Case Study) - Share a specific example with real numbers. Make it feel authentic and relatable.

5. FAQ (Common Questions) - Answer 3-5 frequently asked questions. Be direct and helpful.

6. CTA (Next Steps) - Clear call to action that directs readers to ${brand === 'ownerfi' ? 'OwnerFi.ai to browse properties' : brand === 'carz' ? 'our wholesale inventory' : brand === 'abdullah' ? 'follow for more content' : 'our platform'}.

Format your response as JSON:
{
  "title": "SEO-optimized title (60 chars max, include main keyword)",
  "subtitle": "Compelling subtitle (120 chars max)",
  "hook": "3-5 sentence hook",
  "problem": "Problem explanation (150-200 words)",
  "steps": [
    "Step 1: ...",
    "Step 2: ...",
    "Step 3: ...",
    "Step 4: ...",
    "Step 5: ..."
  ],
  "stepsIntro": "Brief intro before steps (1 sentence)",
  "example": "Real example with numbers (150-200 words)",
  "faq": [
    "Q: Question 1? A: Answer 1",
    "Q: Question 2? A: Answer 2",
    "Q: Question 3? A: Answer 3"
  ],
  "cta": "CTA paragraph (50-75 words)",
  "focusKeyword": "main SEO keyword (2-4 words)",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"]
}`;

  console.log('🤖 Generating blog content with AI...');
  console.log(`Topic: ${topic}`);
  console.log(`Brand: ${brand}, Pillar: ${detectedPillar}, Tone: ${brandTone}`);

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    const responseContent = completion.choices[0].message.content;
    if (!responseContent) {
      throw new Error('No content generated from OpenAI');
    }

    const generated = JSON.parse(responseContent);

    // Build sections array
    const sections: BlogSection[] = [
      {
        type: 'hook',
        heading: 'Introduction',
        content: generated.hook,
      },
      {
        type: 'problem',
        heading: 'The Challenge',
        content: generated.problem,
      },
      {
        type: 'steps',
        heading: 'How It Works',
        content: generated.stepsIntro || '',
        bullets: generated.steps || [],
      },
      {
        type: 'example',
        heading: 'Real Example',
        content: generated.example,
      },
      {
        type: 'faq',
        heading: 'Common Questions',
        content: generated.faq.join('\n\n'),
        bullets: generated.faq,
      },
      {
        type: 'cta',
        heading: 'Next Steps',
        content: generated.cta,
      },
    ];

    // Calculate estimated read time (250 words per minute)
    const totalWords = sections.reduce((sum, section) => {
      const contentWords = section.content.split(/\s+/).length;
      const bulletWords = (section.bullets || []).join(' ').split(/\s+/).length;
      return sum + contentWords + bulletWords;
    }, 0);
    const estimatedReadTime = Math.ceil(totalWords / 250);

    // Determine author
    const authors: Record<string, string> = {
      ownerfi: 'OwnerFi Team',
      carz: 'Carz Inc Team',
      abdullah: 'Abdullah',
      benefit: 'OwnerFi Team',
      personal: 'Abdullah',
      gaza: 'Gaza Relief Team',
    };
    const author = authors[brand] || `${brand} Team`;

    const result: BlogGenerationResult = {
      title: generated.title,
      subtitle: generated.subtitle,
      author,
      sections,
      pillar: detectedPillar,
      focusKeyword: generated.focusKeyword,
      tags: generated.tags || [],
      estimatedReadTime,
    };

    console.log('✅ Blog content generated successfully');
    console.log(`   Title: ${result.title}`);
    console.log(`   Steps: ${generated.steps.length}`);
    console.log(`   Words: ~${totalWords}`);
    console.log(`   Read time: ${estimatedReadTime} min`);

    return result;
  } catch (error) {
    console.error('❌ Failed to generate blog content:', error);
    throw new Error(`Failed to generate blog content: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate multiple blog ideas for a brand
 */
export async function generateBlogIdeas(brand: Brand, count: number = 10): Promise<string[]> {
  const brandContext = getBrandContext(brand);
  const pillars = CONTENT_PILLARS[brand] || [];

  const systemPrompt = `You are a content strategist for ${brand}. ${brandContext}

Generate blog topic ideas that:
1. Target specific SEO keywords
2. Solve real problems
3. Include locations or specific numbers when relevant
4. Are clickable and engaging`;

  const userPrompt = `Generate ${count} blog topic ideas across these content pillars:
${pillars.map(p => `- ${p.label}: ${p.description}`).join('\n')}

Format as JSON:
{
  "topics": [
    "Topic 1 (specific, SEO-friendly, includes keyword)",
    "Topic 2...",
    ...
  ]
}

Make them specific and actionable. Include cities, numbers, or specific scenarios.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.8,
    });

    const responseContent = completion.choices[0].message.content;
    if (!responseContent) {
      throw new Error('No ideas generated from OpenAI');
    }

    const generated = JSON.parse(responseContent);
    return generated.topics || [];
  } catch (error) {
    console.error('Failed to generate blog ideas:', error);
    throw new Error(`Failed to generate blog ideas: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
