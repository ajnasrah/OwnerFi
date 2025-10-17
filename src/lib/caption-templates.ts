/**
 * Caption Templates for A/B Testing
 * Each template optimized for different content types and engagement goals
 */

export interface CaptionTemplate {
  name: string;
  description: string;
  bestFor: string;
  expectedMetrics: {
    engagement: 'high' | 'medium' | 'low';
    saves: 'high' | 'medium' | 'low';
    shares: 'high' | 'medium' | 'low';
    comments: 'high' | 'medium' | 'low';
  };
  template: string;
}

export const CAPTION_TEMPLATES: Record<string, CaptionTemplate> = {
  CONTROVERSY_HOOK: {
    name: 'Controversy Hook',
    description: 'Shocking claim that challenges common beliefs',
    bestFor: 'Breaking news, exposés, controversial topics',
    expectedMetrics: {
      engagement: 'high',
      saves: 'medium',
      shares: 'high',
      comments: 'high'
    },
    template: `🚨 [SHOCKING_CLAIM]

Here's what [AUTHORITY_FIGURE] doesn't want you to know:
• [SECRET_1]
• [SECRET_2]
• [SECRET_3]

Don't get played! [CTA] 💰

[HASHTAGS]`
  },

  VALUE_BOMB: {
    name: 'Value Bomb',
    description: 'Actionable tips that deliver immediate value',
    bestFor: 'Educational content, how-tos, tips',
    expectedMetrics: {
      engagement: 'medium',
      saves: 'high',
      shares: 'high',
      comments: 'medium'
    },
    template: `Save [BENEFIT] with these [NUMBER] [INDUSTRY] hacks 🔥

✅ [TIP_1]
✅ [TIP_2]
✅ [TIP_3]

Which one are you trying first? 👇

[HASHTAGS]`
  },

  STORYTELLING: {
    name: 'Storytelling',
    description: 'Narrative-driven with emotional arc',
    bestFor: 'Case studies, personal experiences, testimonials',
    expectedMetrics: {
      engagement: 'high',
      saves: 'medium',
      shares: 'high',
      comments: 'medium'
    },
    template: `I couldn't believe my eyes when [DRAMATIC_EVENT] 😱

[MINI_STORY]

The lesson? [KEY_TAKEAWAY]. Share if this helped! 🙏

[HASHTAGS]`
  },

  QUESTION_HOOK: {
    name: 'Question Hook',
    description: 'Curiosity-driven question that demands an answer',
    bestFor: 'Educational reveals, industry secrets, myth-busting',
    expectedMetrics: {
      engagement: 'high',
      saves: 'medium',
      shares: 'medium',
      comments: 'high'
    },
    template: `Why do [TARGET_AUDIENCE] [SURPRISING_BEHAVIOR]? 🤔

The answer will shock you:

[EXPLANATION]

Comment if you didn't know this! 💬

[HASHTAGS]`
  },

  LISTICLE_TEASE: {
    name: 'Listicle Tease',
    description: 'Numbered list with curiosity gap',
    bestFor: 'Beginner content, common mistakes, checklists',
    expectedMetrics: {
      engagement: 'medium',
      saves: 'high',
      shares: 'medium',
      comments: 'medium'
    },
    template: `The [NUMBER] [INDUSTRY] rules everyone breaks:

1️⃣ [RULE_1]
2️⃣ [RULE_2]
3️⃣ [RULE_3]

(Most people mess up #2) 👀

Tag someone who needs this!

[HASHTAGS]`
  }
};

/**
 * Generate caption from template with dynamic content
 */
export function generateCaption(
  templateKey: keyof typeof CAPTION_TEMPLATES,
  variables: Record<string, string>
): string {
  const template = CAPTION_TEMPLATES[templateKey];
  if (!template) {
    throw new Error(`Template ${templateKey} not found`);
  }

  let caption = template.template;

  // Replace all variables
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `[${key.toUpperCase()}]`;
    caption = caption.replace(new RegExp(placeholder, 'g'), value);
  }

  // Ensure caption is under 280 characters (including hashtags)
  // NOTE: Hashtags should always be at the END after "\n\n", not in the middle
  if (caption.length > 280) {
    // Split caption into text and hashtags (hashtags should be after last "\n\n")
    const parts = caption.split('\n\n');
    const hashtags = parts[parts.length - 1].startsWith('#') ? parts.pop() : '';
    const textParts = parts;
    const text = textParts.join('\n\n');

    if (hashtags) {
      // Truncate text, keep hashtags
      const maxTextLength = 280 - hashtags.length - 5; // -5 for "\n\n..."
      if (text.length > maxTextLength) {
        caption = text.substring(0, maxTextLength).trim() + '...\n\n' + hashtags;
      } else {
        caption = text + '\n\n' + hashtags;
      }
    } else {
      // No hashtags, just truncate
      caption = caption.substring(0, 277).trim() + '...';
    }
  }

  return caption;
}

/**
 * Get random template for A/B testing
 */
export function getRandomTemplate(): keyof typeof CAPTION_TEMPLATES {
  const keys = Object.keys(CAPTION_TEMPLATES) as Array<keyof typeof CAPTION_TEMPLATES>;
  return keys[Math.floor(Math.random() * keys.length)];
}

/**
 * Get template based on content category
 */
export function getTemplateForCategory(category: string): keyof typeof CAPTION_TEMPLATES {
  const categoryMap: Record<string, keyof typeof CAPTION_TEMPLATES> = {
    'breaking_news': 'CONTROVERSY_HOOK',
    'tips': 'VALUE_BOMB',
    'how_to': 'VALUE_BOMB',
    'story': 'STORYTELLING',
    'case_study': 'STORYTELLING',
    'secret': 'QUESTION_HOOK',
    'myth': 'QUESTION_HOOK',
    'list': 'LISTICLE_TEASE',
    'mistakes': 'LISTICLE_TEASE'
  };

  return categoryMap[category.toLowerCase()] || 'VALUE_BOMB';
}

/**
 * Platform-specific hashtag strategies
 */
export function getPlatformHashtags(
  brand: 'carz' | 'ownerfi',
  platform: string,
  topic: string
): string {
  const baseHashtags = {
    carz: ['Cars', 'Automotive', 'CarTips'],
    ownerfi: ['RealEstate', 'Housing', 'HomeOwnership']
  };

  const platformStrategies = {
    instagram: 5, // 5 niche hashtags
    tiktok: 4, // 1-2 trending + 2-3 niche
    youtube: 7, // 5-7 descriptive keywords
    linkedin: 5, // 3-5 professional tags
    twitter: 2, // 1-2 trending only
    facebook: 3,
    threads: 4,
    bluesky: 3
  };

  const count = platformStrategies[platform as keyof typeof platformStrategies] || 4;

  // Mix base hashtags with topic-specific ones
  const hashtags = [
    ...baseHashtags[brand],
    ...topic.split(' ').slice(0, 2).map(word => word.replace(/[^a-zA-Z0-9]/g, ''))
  ].slice(0, count);

  return hashtags.map(tag => `#${tag}`).join(' ');
}
