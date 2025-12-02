/**
 * Viral Hooks Library System
 *
 * Manages a queue of 2-3 second viral hook videos that are prepended to content.
 * Sources hooks from:
 * 1. Apify TikTok scraper (trending content)
 * 2. Manual uploads
 * 3. AI-generated hooks (HeyGen avatars)
 *
 * Each hook has:
 * - Video URL (stored in R2)
 * - Category/emotion tags
 * - Usage count (for rotation)
 * - Performance metrics
 */

import { Brand } from '@/config/constants';

// ============================================================================
// Types
// ============================================================================

export type HookCategory =
  | 'attention'      // "Wait for this...", "Stop scrolling"
  | 'curiosity'      // "You won't believe...", "Nobody talks about this"
  | 'urgency'        // "Before it's too late...", "Breaking news"
  | 'emotional'      // Sad music, dramatic pause
  | 'funny'          // Comedic hooks, memes
  | 'educational'    // "Here's what nobody tells you..."
  | 'controversial'  // "Hot take:", "Unpopular opinion"
  | 'relatable'      // "POV:", "When you realize..."
  | 'news'           // Breaking news style hooks
  | 'humanitarian';  // Aid/donation focused hooks

export type HookMood =
  | 'excited'        // High energy, enthusiasm
  | 'serious'        // Professional, news-like
  | 'funny'          // Comedic, lighthearted
  | 'sad'            // Emotional, touching
  | 'dramatic'       // Intense, gripping
  | 'neutral'        // Balanced, informative
  | 'urgent'         // Time-sensitive, alarming
  | 'inspiring';     // Motivational, uplifting

export type ContentType =
  | 'news'           // Breaking news, current events
  | 'educational'    // Tips, tutorials, how-tos
  | 'entertainment'  // Fun, engaging content
  | 'humanitarian'   // Charity, donations, aid
  | 'product'        // Product showcases
  | 'lifestyle';     // Personal, relatable content

export type HookSource = 'apify' | 'manual' | 'ai_generated';

export type HookStyle = 'text_overlay' | 'avatar_speaking' | 'sound_effect' | 'mixed';

export interface ViralHook {
  id: string;

  // Content
  videoUrl: string;           // R2 URL of the hook video
  thumbnailUrl?: string;      // Preview image
  duration: number;           // Duration in seconds (2-3s ideal)
  transcript?: string;        // What is said/shown

  // Categorization
  category: HookCategory;
  style: HookStyle;
  mood: HookMood;             // Emotional tone of the hook
  contentType: ContentType;   // Type of content this hook works for

  // Targeting
  brands: Brand[];            // Which brands can use this hook
  topics?: string[];          // Topic keywords for matching
  keywords?: string[];        // Content matching keywords
  excludeKeywords?: string[]; // Keywords to avoid matching

  // Source tracking
  source: HookSource;
  sourceUrl?: string;         // Original TikTok/IG URL
  sourceUsername?: string;    // Creator username
  sourceLikes?: number;       // Original engagement
  sourceViews?: number;

  // Usage tracking
  usageCount: number;
  lastUsedAt?: number;
  usageByBrand?: Record<string, number>;  // Track usage per brand

  // Performance (after posting)
  avgViewDuration?: number;   // How long viewers watch videos with this hook
  avgEngagement?: number;     // Engagement rate for videos using this hook
  performanceByBrand?: Record<string, {   // Track performance per brand
    avgViews: number;
    avgEngagement: number;
    usageCount: number;
  }>;

  // Status
  isActive: boolean;
  needsReview: boolean;       // For scraped hooks before approval
  priority?: number;          // 1-10, higher = more likely to be selected

  // Timestamps
  createdAt: number;
  updatedAt: number;
}

export interface HookUsageLog {
  hookId: string;
  workflowId: string;
  brand: Brand;
  usedAt: number;
  videoUrl?: string;          // Final video with hook
  performance?: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    avgWatchTime: number;
  };
}

// ============================================================================
// Hook Selection Strategy
// ============================================================================

export interface HookSelectionCriteria {
  brand: Brand;
  category?: HookCategory;
  style?: HookStyle;
  mood?: HookMood;                // Match emotional tone
  contentType?: ContentType;      // Match content type
  contentKeywords?: string[];     // Keywords from the content to match
  excludeRecentlyUsed?: boolean;  // Don't repeat hooks within X days
  minPerformance?: number;        // Only use hooks with proven engagement
  minPriority?: number;           // Minimum priority level
}

// Brand-specific hook preferences
export const BRAND_HOOK_PREFERENCES: Record<string, {
  preferredMoods: HookMood[];
  preferredCategories: HookCategory[];
  preferredContentTypes: ContentType[];
  defaultPriority: number;
}> = {
  gaza: {
    preferredMoods: ['serious', 'urgent', 'sad', 'dramatic'],
    preferredCategories: ['news', 'humanitarian', 'urgency', 'emotional'],
    preferredContentTypes: ['news', 'humanitarian'],
    defaultPriority: 8,
  },
  ownerfi: {
    preferredMoods: ['excited', 'inspiring', 'neutral'],
    preferredCategories: ['educational', 'curiosity', 'attention'],
    preferredContentTypes: ['educational', 'news', 'lifestyle'],
    defaultPriority: 7,
  },
  carz: {
    preferredMoods: ['excited', 'dramatic', 'neutral'],
    preferredCategories: ['attention', 'curiosity', 'educational'],
    preferredContentTypes: ['news', 'product', 'educational'],
    defaultPriority: 7,
  },
  vassdistro: {
    preferredMoods: ['neutral', 'serious', 'excited'],
    preferredCategories: ['educational', 'attention', 'news'],
    preferredContentTypes: ['news', 'educational'],
    defaultPriority: 6,
  },
  abdullah: {
    preferredMoods: ['excited', 'inspiring', 'funny'],
    preferredCategories: ['attention', 'relatable', 'educational'],
    preferredContentTypes: ['lifestyle', 'educational', 'entertainment'],
    defaultPriority: 8,
  },
  property: {
    preferredMoods: ['excited', 'inspiring', 'neutral'],
    preferredCategories: ['attention', 'urgency', 'curiosity'],
    preferredContentTypes: ['product', 'lifestyle'],
    defaultPriority: 7,
  },
  'property-spanish': {
    preferredMoods: ['excited', 'inspiring', 'neutral'],
    preferredCategories: ['attention', 'urgency', 'curiosity'],
    preferredContentTypes: ['product', 'lifestyle'],
    defaultPriority: 7,
  },
};

/**
 * Select the best hook for a video based on criteria
 * Uses weighted scoring with mood and content matching
 *
 * Scoring breakdown:
 * - Mood match: 0-25 points (matching brand's preferred mood)
 * - Content type match: 0-20 points
 * - Category match: 0-15 points
 * - Performance: 0-15 points (proven engagement)
 * - Freshness: 0-15 points (less used = higher)
 * - Priority: 0-10 points (manual boost)
 */
export async function selectHook(criteria: HookSelectionCriteria): Promise<ViralHook | null> {
  const { getAdminDb } = await import('@/lib/firebase-admin');
  const adminDb = await getAdminDb();

  // Get brand preferences
  const brandPrefs = BRAND_HOOK_PREFERENCES[criteria.brand] || {
    preferredMoods: ['neutral'],
    preferredCategories: ['attention'],
    preferredContentTypes: ['entertainment'],
    defaultPriority: 5,
  };

  // Get all active hooks for this brand
  let query = adminDb
    .collection('viral_hooks')
    .where('isActive', '==', true)
    .where('needsReview', '==', false)
    .where('brands', 'array-contains', criteria.brand);

  const snapshot = await query.limit(100).get();

  if (snapshot.empty) {
    console.log(`⚠️  No hooks available for brand ${criteria.brand}`);
    return null;
  }

  let hooks = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as ViralHook[];

  console.log(`📊 Found ${hooks.length} hooks for ${criteria.brand}`);

  // Filter by explicit criteria
  if (criteria.category) {
    const filtered = hooks.filter(h => h.category === criteria.category);
    if (filtered.length > 0) hooks = filtered;
  }

  if (criteria.style) {
    const filtered = hooks.filter(h => h.style === criteria.style);
    if (filtered.length > 0) hooks = filtered;
  }

  if (criteria.mood) {
    const filtered = hooks.filter(h => h.mood === criteria.mood);
    if (filtered.length > 0) hooks = filtered;
  }

  if (criteria.contentType) {
    const filtered = hooks.filter(h => h.contentType === criteria.contentType);
    if (filtered.length > 0) hooks = filtered;
  }

  if (criteria.minPriority) {
    const filtered = hooks.filter(h => (h.priority || 5) >= criteria.minPriority!);
    if (filtered.length > 0) hooks = filtered;
  }

  // Filter out recently used (last 7 days)
  if (criteria.excludeRecentlyUsed) {
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const filtered = hooks.filter(h => !h.lastUsedAt || h.lastUsedAt < sevenDaysAgo);
    if (filtered.length > 0) hooks = filtered;
  }

  // Keyword matching (if provided)
  if (criteria.contentKeywords && criteria.contentKeywords.length > 0) {
    const keywordsLower = criteria.contentKeywords.map(k => k.toLowerCase());

    hooks = hooks.map(hook => {
      // Check for keyword matches
      const hookKeywords = [...(hook.keywords || []), ...(hook.topics || [])].map(k => k.toLowerCase());
      const matchCount = keywordsLower.filter(k => hookKeywords.some(hk => hk.includes(k) || k.includes(hk))).length;

      // Check for exclude keywords
      const excludeMatch = (hook.excludeKeywords || []).some(ek =>
        keywordsLower.some(k => k.includes(ek.toLowerCase()))
      );

      return { ...hook, _keywordScore: excludeMatch ? -100 : matchCount };
    }).filter(h => (h as any)._keywordScore >= 0);
  }

  if (hooks.length === 0) {
    console.log(`⚠️  No hooks match criteria for ${criteria.brand}`);
    return null;
  }

  // Score hooks with comprehensive matching
  const scoredHooks = hooks.map(hook => {
    let score = 0;
    const reasons: string[] = [];

    // Mood match (0-25 points)
    const moodToMatch = criteria.mood || brandPrefs.preferredMoods[0];
    if (hook.mood === moodToMatch) {
      score += 25;
      reasons.push(`mood:${hook.mood}`);
    } else if (brandPrefs.preferredMoods.includes(hook.mood)) {
      const moodIndex = brandPrefs.preferredMoods.indexOf(hook.mood);
      score += Math.max(0, 20 - (moodIndex * 5));
      reasons.push(`mood-alt:${hook.mood}`);
    }

    // Content type match (0-20 points)
    const contentToMatch = criteria.contentType || brandPrefs.preferredContentTypes[0];
    if (hook.contentType === contentToMatch) {
      score += 20;
      reasons.push(`content:${hook.contentType}`);
    } else if (brandPrefs.preferredContentTypes.includes(hook.contentType)) {
      score += 10;
    }

    // Category match (0-15 points)
    const categoryToMatch = criteria.category || brandPrefs.preferredCategories[0];
    if (hook.category === categoryToMatch) {
      score += 15;
      reasons.push(`cat:${hook.category}`);
    } else if (brandPrefs.preferredCategories.includes(hook.category)) {
      score += 8;
    }

    // Performance score (0-15 points)
    if (hook.avgEngagement && hook.avgEngagement > 0) {
      score += Math.min(hook.avgEngagement * 3, 15);
      reasons.push(`perf:${hook.avgEngagement.toFixed(1)}`);
    }

    // Brand-specific performance (bonus 0-10 points)
    const brandPerf = hook.performanceByBrand?.[criteria.brand];
    if (brandPerf && brandPerf.avgEngagement > 2) {
      score += Math.min(brandPerf.avgEngagement * 2, 10);
      reasons.push(`brand-perf:${brandPerf.avgEngagement.toFixed(1)}`);
    }

    // Freshness score (0-15 points) - less used = higher score
    const brandUsage = hook.usageByBrand?.[criteria.brand] || 0;
    const freshnessScore = Math.max(0, 15 - (brandUsage * 3));
    score += freshnessScore;
    if (freshnessScore > 10) reasons.push('fresh');

    // Priority boost (0-10 points)
    const priority = hook.priority || brandPrefs.defaultPriority;
    score += priority;
    if (priority >= 8) reasons.push(`priority:${priority}`);

    // Keyword match boost
    const keywordScore = (hook as any)._keywordScore || 0;
    if (keywordScore > 0) {
      score += keywordScore * 5;
      reasons.push(`keywords:${keywordScore}`);
    }

    // Source quality bonus (viral content)
    if (hook.sourceLikes && hook.sourceLikes > 100000) {
      score += 5;
      reasons.push('viral');
    }

    return { hook, score, reasons };
  });

  // Sort by score
  scoredHooks.sort((a, b) => b.score - a.score);

  // Log top candidates
  console.log(`🎯 Top hook candidates for ${criteria.brand}:`);
  scoredHooks.slice(0, 3).forEach((sh, i) => {
    console.log(`   ${i + 1}. ${sh.hook.id} (score: ${sh.score}) [${sh.reasons.join(', ')}]`);
  });

  // Select from top 3-5 with weighted randomness (higher scores more likely)
  const topHooks = scoredHooks.slice(0, Math.min(5, scoredHooks.length));
  const totalScore = topHooks.reduce((sum, h) => sum + h.score, 0);
  let random = Math.random() * totalScore;

  for (const candidate of topHooks) {
    random -= candidate.score;
    if (random <= 0) {
      console.log(`🎣 Selected hook: ${candidate.hook.id} (score: ${candidate.score})`);
      return candidate.hook;
    }
  }

  // Fallback to highest scorer
  const selected = scoredHooks[0];
  console.log(`🎣 Selected hook (fallback): ${selected.hook.id} (score: ${selected.score})`);
  return selected.hook;
}

/**
 * Mark hook as used and update stats
 */
export async function markHookUsed(hookId: string, workflowId: string, brand: Brand): Promise<void> {
  const { getAdminDb } = await import('@/lib/firebase-admin');
  const adminDb = await getAdminDb();

  const now = Date.now();

  // Update hook usage count
  await adminDb.collection('viral_hooks').doc(hookId).update({
    usageCount: (await import('firebase-admin/firestore')).FieldValue.increment(1),
    lastUsedAt: now,
    updatedAt: now
  });

  // Log usage
  await adminDb.collection('hook_usage_logs').add({
    hookId,
    workflowId,
    brand,
    usedAt: now
  });

  console.log(`📝 Logged hook usage: ${hookId} for workflow ${workflowId}`);
}

// ============================================================================
// Hook Management
// ============================================================================

/**
 * Add a new hook to the library
 */
export async function addHook(hook: Omit<ViralHook, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>): Promise<string> {
  const { getAdminDb } = await import('@/lib/firebase-admin');
  const adminDb = await getAdminDb();

  const now = Date.now();

  // Set defaults for new fields
  const hookData = {
    ...hook,
    mood: hook.mood || 'neutral',
    contentType: hook.contentType || 'entertainment',
    usageCount: 0,
    usageByBrand: {},
    priority: hook.priority || 5,
    createdAt: now,
    updatedAt: now
  };

  const docRef = await adminDb.collection('viral_hooks').add(hookData);

  console.log(`✅ Added hook: ${docRef.id} (mood: ${hookData.mood}, type: ${hookData.contentType})`);
  return docRef.id;
}

/**
 * Get hooks pending review (from scraper)
 */
export async function getHooksForReview(limit: number = 50): Promise<ViralHook[]> {
  const { getAdminDb } = await import('@/lib/firebase-admin');
  const adminDb = await getAdminDb();

  const snapshot = await adminDb
    .collection('viral_hooks')
    .where('needsReview', '==', true)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as ViralHook[];
}

/**
 * Approve or reject a hook
 */
export async function reviewHook(hookId: string, approved: boolean): Promise<void> {
  const { getAdminDb } = await import('@/lib/firebase-admin');
  const adminDb = await getAdminDb();

  if (approved) {
    await adminDb.collection('viral_hooks').doc(hookId).update({
      needsReview: false,
      isActive: true,
      updatedAt: Date.now()
    });
    console.log(`✅ Approved hook: ${hookId}`);
  } else {
    await adminDb.collection('viral_hooks').doc(hookId).delete();
    console.log(`🗑️  Rejected and deleted hook: ${hookId}`);
  }
}

/**
 * Get hook library stats
 */
export async function getHookStats(): Promise<{
  total: number;
  active: number;
  pendingReview: number;
  byCategory: Record<string, number>;
  bySource: Record<string, number>;
}> {
  const { getAdminDb } = await import('@/lib/firebase-admin');
  const adminDb = await getAdminDb();

  const snapshot = await adminDb.collection('viral_hooks').get();

  const hooks = snapshot.docs.map(doc => doc.data()) as ViralHook[];

  const stats = {
    total: hooks.length,
    active: hooks.filter(h => h.isActive && !h.needsReview).length,
    pendingReview: hooks.filter(h => h.needsReview).length,
    byCategory: {} as Record<string, number>,
    bySource: {} as Record<string, number>
  };

  for (const hook of hooks) {
    stats.byCategory[hook.category] = (stats.byCategory[hook.category] || 0) + 1;
    stats.bySource[hook.source] = (stats.bySource[hook.source] || 0) + 1;
  }

  return stats;
}

// ============================================================================
// Viral Hook Text Templates (for AI generation)
// ============================================================================

export const HOOK_TEMPLATES: Record<HookCategory, string[]> = {
  attention: [
    "Wait for this...",
    "Stop scrolling, this is important",
    "You need to see this",
    "I can't believe what I just found",
    "This changes everything"
  ],
  curiosity: [
    "Nobody talks about this but...",
    "Here's what they don't want you to know",
    "I discovered something crazy",
    "You won't believe what happened",
    "This is what nobody tells you"
  ],
  urgency: [
    "Breaking news just in",
    "This is happening right now",
    "Before it's too late, watch this",
    "You need to know this today",
    "This just happened"
  ],
  emotional: [
    "This hit me hard...",
    "I wasn't ready for this",
    "This is heartbreaking",
    "I'm still processing this",
    "This changed my perspective"
  ],
  funny: [
    "POV: You just realized...",
    "Tell me why this is so accurate",
    "Not me finding out...",
    "When you finally understand...",
    "The accuracy of this..."
  ],
  educational: [
    "Here's a tip nobody shares",
    "Let me teach you something",
    "Most people don't know this",
    "Quick lesson for you",
    "What I wish I knew earlier"
  ],
  controversial: [
    "Hot take incoming...",
    "Unpopular opinion but...",
    "I don't care who disagrees",
    "This might upset some people",
    "Controversial but true"
  ],
  relatable: [
    "POV: You're scrolling at 3am",
    "When you realize...",
    "That feeling when...",
    "Just me or...",
    "Real ones understand this"
  ]
};

/**
 * Get matching hook template for content
 */
export function getHookTemplateForContent(
  content: string,
  defaultCategory: HookCategory = 'attention'
): { category: HookCategory; template: string } {
  // Simple keyword matching for category detection
  const contentLower = content.toLowerCase();

  let category: HookCategory = defaultCategory;

  if (contentLower.includes('breaking') || contentLower.includes('urgent') || contentLower.includes('just')) {
    category = 'urgency';
  } else if (contentLower.includes('sad') || contentLower.includes('tragic') || contentLower.includes('heartbreak')) {
    category = 'emotional';
  } else if (contentLower.includes('learn') || contentLower.includes('tip') || contentLower.includes('how to')) {
    category = 'educational';
  } else if (contentLower.includes('opinion') || contentLower.includes('controversial')) {
    category = 'controversial';
  }

  const templates = HOOK_TEMPLATES[category];
  const template = templates[Math.floor(Math.random() * templates.length)];

  return { category, template };
}
