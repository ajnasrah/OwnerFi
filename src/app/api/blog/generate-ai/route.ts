/**
 * AI Blog Generation API
 *
 * Generate blog content using AI (for manual use)
 */

import { NextRequest, NextResponse } from 'next/server';
import { Brand } from '@/config/constants';
import { generateBlogContent, generateBlogIdeas } from '@/lib/blog-ai-generator';

// Generate blog content from topic
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { brand, topic, pillar, tone, targetLength } = body as {
      brand: Brand;
      topic: string;
      pillar?: string;
      tone?: 'professional' | 'casual' | 'educational';
      targetLength?: 'short' | 'medium' | 'long';
    };

    if (!brand || !topic) {
      return NextResponse.json(
        { error: 'Missing required fields: brand, topic' },
        { status: 400 }
      );
    }

    const result = await generateBlogContent({
      brand,
      topic,
      pillar,
      tone,
      targetLength,
    });

    return NextResponse.json({
      success: true,
      generated: result,
      message: 'Blog content generated successfully',
    });
  } catch (error) {
    console.error('Error generating blog content:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate blog content',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Generate blog ideas
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const brand = searchParams.get('brand') as Brand;
    const count = parseInt(searchParams.get('count') || '10');

    if (!brand) {
      return NextResponse.json(
        { error: 'Missing required parameter: brand' },
        { status: 400 }
      );
    }

    const ideas = await generateBlogIdeas(brand, count);

    return NextResponse.json({
      success: true,
      brand,
      count: ideas.length,
      ideas,
    });
  } catch (error) {
    console.error('Error generating blog ideas:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate blog ideas',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
