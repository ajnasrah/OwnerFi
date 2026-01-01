/**
 * Blog System Models
 *
 * Multi-brand blog system with SEO optimization and social media image generation
 */

import { Brand } from '@/config/constants';

/**
 * Blog Post Status
 */
export type BlogStatus = 'draft' | 'published' | 'archived';

/**
 * Content Pillar for each brand
 */
export type ContentPillar = {
  ownerfi: 'owner-finance-101' | 'deal-breakdowns' | 'market-money' | 'agent-playbooks';
  carz: 'dealer-secrets' | 'behind-auction' | 'financing-credit' | 'flipping-cars';
  abdullah: 'real-talk-money' | 'entrepreneurship' | 'systems-automation' | 'mindset';
  benefit: 'seller-benefits' | 'buyer-benefits' | 'owner-finance-101';
  personal: 'lifestyle' | 'business' | 'mindset';
  gaza: 'humanitarian-news' | 'relief-updates' | 'donation-drives';
};

/**
 * Blog Section (for picture post generation)
 */
export interface BlogSection {
  type: 'hook' | 'problem' | 'steps' | 'example' | 'faq' | 'cta';
  heading: string;
  content: string;
  bullets?: string[]; // For steps/framework sections
  imageCaption?: string; // Optional caption for social post
}

/**
 * Social Media Image Template
 */
export interface SocialImage {
  id: string;
  type: 'carousel-slide' | 'quote-card' | 'faq-card' | 'story-card';
  title: string;
  content: string;
  slideNumber?: number; // For carousel slides
  totalSlides?: number; // For carousel slides
  generatedUrl?: string; // URL after image generation
  downloadUrl?: string; // Download URL
}

/**
 * SEO Metadata
 */
export interface BlogSEO {
  metaTitle: string; // Max 60 chars
  metaDescription: string; // Max 160 chars
  focusKeyword: string; // Main SEO keyword
  keywords: string[]; // Additional keywords
  canonicalUrl?: string;
  ogImage?: string; // Open Graph image URL
  schema?: {
    article?: boolean;
    faq?: boolean;
    breadcrumb?: boolean;
  };
}

/**
 * Blog Post Model
 */
export interface BlogPost {
  // Core fields
  id: string;
  brand: Brand;
  slug: string; // URL-friendly slug (e.g., "how-owner-finance-works")

  // Content
  title: string;
  subtitle?: string;
  author: string; // "OwnerFi Team", "Abdullah", "Carz Inc"

  // Sections (structured for social image generation)
  sections: BlogSection[];

  // Social media
  socialImages: SocialImage[]; // Auto-generated from sections

  // SEO
  seo: BlogSEO;

  // Categorization
  pillar: string; // Content pillar (type varies by brand)
  tags: string[];

  // Status
  status: BlogStatus;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;

  // Analytics
  views?: number;
  shares?: number;

  // Internal tracking
  aiGenerated?: boolean; // Was this AI-generated?
  sourceUrl?: string; // If based on RSS article
}

/**
 * Blog Template (for easy blog creation)
 */
export interface BlogTemplate {
  brand: Brand;
  pillar: string;
  sections: Array<{
    type: BlogSection['type'];
    heading: string;
    placeholder: string;
  }>;
}

/**
 * Standard blog templates for each brand
 */
export const BLOG_TEMPLATES: Record<Brand, BlogTemplate[]> = {
  ownerfi: [
    {
      brand: 'ownerfi',
      pillar: 'owner-finance-101',
      sections: [
        { type: 'hook', heading: 'Introduction', placeholder: 'Hook the reader with the problem they face...' },
        { type: 'problem', heading: 'The Challenge', placeholder: 'Explain the situation in simple terms...' },
        { type: 'steps', heading: 'How It Works', placeholder: 'List 3-7 steps or bullet points...' },
        { type: 'example', heading: 'Real Example', placeholder: 'Share a real deal with numbers...' },
        { type: 'faq', heading: 'Common Questions', placeholder: 'Answer 3-5 frequently asked questions...' },
        { type: 'cta', heading: 'Next Steps', placeholder: 'Clear call to action...' },
      ],
    },
    {
      brand: 'ownerfi',
      pillar: 'deal-breakdowns',
      sections: [
        { type: 'hook', heading: 'The Deal', placeholder: 'Introduce the property and situation...' },
        { type: 'problem', heading: 'The Challenge', placeholder: 'What made this deal unique...' },
        { type: 'steps', heading: 'How We Structured It', placeholder: 'Break down the numbers step by step...' },
        { type: 'example', heading: 'The Outcome', placeholder: 'What happened after closing...' },
        { type: 'faq', heading: 'Lessons Learned', placeholder: 'Key takeaways from this deal...' },
        { type: 'cta', heading: 'Find Similar Deals', placeholder: 'CTA to browse properties...' },
      ],
    },
  ],
  carz: [
    {
      brand: 'carz',
      pillar: 'dealer-secrets',
      sections: [
        { type: 'hook', heading: 'Introduction', placeholder: 'What dealers don\'t want you to know...' },
        { type: 'problem', heading: 'Why This Matters', placeholder: 'How this affects buyers...' },
        { type: 'steps', heading: 'What You Need to Know', placeholder: '3-7 insider tips...' },
        { type: 'example', heading: 'Real Example', placeholder: 'Story from the lot...' },
        { type: 'faq', heading: 'Common Questions', placeholder: 'FAQ about car buying...' },
        { type: 'cta', heading: 'Next Steps', placeholder: 'CTA to contact or browse inventory...' },
      ],
    },
  ],
  abdullah: [
    {
      brand: 'abdullah',
      pillar: 'real-talk-money',
      sections: [
        { type: 'hook', heading: 'The Situation', placeholder: 'Set the scene with raw honesty...' },
        { type: 'problem', heading: 'What I Learned', placeholder: 'The hard truth...' },
        { type: 'steps', heading: 'How to Avoid This', placeholder: 'Actionable steps...' },
        { type: 'example', heading: 'My Story', placeholder: 'Personal story with numbers...' },
        { type: 'faq', heading: 'Your Questions', placeholder: 'Common questions I get...' },
        { type: 'cta', heading: 'What to Do Next', placeholder: 'Next action for readers...' },
      ],
    },
  ],
  // Other brands don't have templates yet
  benefit: [],
  personal: [],
  gaza: [],
} as const;

/**
 * Content Pillars by Brand
 */
export const CONTENT_PILLARS: Record<Brand, Array<{ id: string; label: string; description: string }>> = {
  ownerfi: [
    { id: 'owner-finance-101', label: 'Owner Finance 101', description: 'Educational content about owner financing basics' },
    { id: 'deal-breakdowns', label: 'Deal Breakdowns', description: 'Real case studies and deal examples' },
    { id: 'market-money', label: 'Market & Money', description: 'Rates, credit, affordability topics' },
    { id: 'agent-playbooks', label: 'Agent Playbooks', description: 'B2B content for real estate agents' },
  ],
  carz: [
    { id: 'dealer-secrets', label: 'Dealer Secrets', description: 'Insider tips to save money' },
    { id: 'behind-auction', label: 'Behind the Auction', description: 'How wholesale really works' },
    { id: 'financing-credit', label: 'Financing & Credit', description: 'Car financing and credit rebuilding' },
    { id: 'flipping-cars', label: 'Flipping & Side Hustle', description: 'How to flip cars for profit' },
  ],
  abdullah: [
    { id: 'real-talk-money', label: 'Real Talk Money', description: 'Credit, debt, financial mistakes' },
    { id: 'entrepreneurship', label: 'Entrepreneurship & Deals', description: 'Stories and lessons from deals' },
    { id: 'systems-automation', label: 'Systems & Automation', description: 'How to run multiple businesses' },
    { id: 'mindset', label: 'Mindset From the Trenches', description: 'Real stories, no fluff' },
  ],
  benefit: [
    { id: 'seller-benefits', label: 'Seller Benefits', description: 'Benefits of selling with owner financing' },
    { id: 'buyer-benefits', label: 'Buyer Benefits', description: 'Benefits of buying with owner financing' },
    { id: 'owner-finance-101', label: 'Owner Finance 101', description: 'Educational content about owner financing' },
  ],
  personal: [
    { id: 'lifestyle', label: 'Lifestyle', description: 'Personal lifestyle content' },
    { id: 'business', label: 'Business', description: 'Business insights and updates' },
    { id: 'mindset', label: 'Mindset', description: 'Mindset and motivation content' },
  ],
  gaza: [
    { id: 'humanitarian-news', label: 'Humanitarian News', description: 'Gaza humanitarian crisis updates' },
    { id: 'relief-updates', label: 'Relief Updates', description: 'Relief organization updates' },
    { id: 'donation-drives', label: 'Donation Drives', description: 'Donation campaigns and drives' },
  ],
};

/**
 * Helper: Generate slug from title
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Helper: Generate meta description from first section
 */
export function generateMetaDescription(sections: BlogSection[]): string {
  const hookSection = sections.find(s => s.type === 'hook');
  if (hookSection) {
    const desc = hookSection.content.substring(0, 157);
    return desc.length === 157 ? desc + '...' : desc;
  }
  return '';
}

/**
 * Helper: Extract keywords from content
 */
export function extractKeywords(title: string, sections: BlogSection[]): string[] {
  const text = title + ' ' + sections.map(s => s.content).join(' ');
  const words = text.toLowerCase().split(/\W+/);
  const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'can', 'this', 'that', 'these', 'those', 'how', 'what', 'when', 'where', 'why', 'who']);

  const wordFreq = new Map<string, number>();
  words.forEach(word => {
    if (word.length > 3 && !commonWords.has(word)) {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    }
  });

  return Array.from(wordFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

/**
 * Helper: Create social images from blog sections
 */
export function generateSocialImagesFromSections(sections: BlogSection[]): SocialImage[] {
  const images: SocialImage[] = [];

  sections.forEach((section, index) => {
    if (section.type === 'steps' && section.bullets) {
      // Create carousel from steps
      section.bullets.forEach((bullet, bulletIndex) => {
        images.push({
          id: `slide-${bulletIndex + 1}`,
          type: 'carousel-slide',
          title: bulletIndex === 0 ? section.heading : `Step ${bulletIndex}`,
          content: bullet,
          slideNumber: bulletIndex + 1,
          totalSlides: section.bullets!.length + 1, // +1 for CTA slide
        });
      });
    } else if (section.type === 'hook') {
      // Create quote card from hook
      images.push({
        id: 'quote-hook',
        type: 'quote-card',
        title: 'Did You Know?',
        content: section.content,
      });
    } else if (section.type === 'faq') {
      // Create FAQ card
      images.push({
        id: 'faq-card',
        type: 'faq-card',
        title: section.heading,
        content: section.content,
      });
    }
  });

  return images;
}

/**
 * Firestore collection names by brand
 */
export function getBlogCollection(brand: Brand): string {
  return `${brand}_blog_posts`;
}

/**
 * Example blog post topics by brand
 */
export const EXAMPLE_TOPICS = {
  ownerfi: [
    "Can I Buy a House With Bad Credit Using Owner Financing in Dallas?",
    "$15,000 Down: Real Example of How an Owner Finance Deal Was Structured in Houston",
    "5 Mistakes Agents Make With Seller Financing (And How to Fix Them)",
    "How Much Income Do I Need to Afford a $300,000 Owner Finance Home?",
    "Owner Financing vs. Rent-to-Own: Which One Is Better for You?",
  ],
  carz: [
    "How Long Should a Used Car Sit on a Lot Before You Walk Away?",
    "Auction vs Dealer: Who Really Gets the Better Price?",
    "Top 5 Cars We Refuse to Buy Again (And Why)",
    "How to Flip Your First Car Without Getting Burned",
    "What Dealers Don't Tell You About Wholesale Pricing",
  ],
  abdullah: [
    "How I Used Owner Finance & Cars to Build My Portfolio Without a Perfect W-2",
    "What I Learned Losing Money on 3 Deals in a Row",
    "How I Use AI and Automation to Run Multiple Businesses at the Same Time",
    "Why Most People Stay Renting Forever (And How to Not Be One of Them)",
    "The Real Numbers Behind My First Year in Real Estate",
  ],
} as const;
