/**
 * OG Image Generation API
 *
 * Generates Open Graph images and social media images using @vercel/og
 */

import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { getBrandColors } from '@/lib/blog-og-generator';
import { Brand } from '@/config/constants';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Extract parameters
    const type = searchParams.get('type') as 'blog-hero' | 'carousel-slide' | 'quote-card' | 'faq-card' || 'blog-hero';
    const brand = (searchParams.get('brand') || 'ownerfi') as Brand;
    const title = searchParams.get('title') || 'Blog Post';
    const subtitle = searchParams.get('subtitle');
    const content = searchParams.get('content');
    const slideNumber = searchParams.get('slide') ? parseInt(searchParams.get('slide')!) : undefined;
    const totalSlides = searchParams.get('total') ? parseInt(searchParams.get('total')!) : undefined;

    const colors = getBrandColors(brand);

    // Brand display names
    const brandNames: Record<string, string> = {
      ownerfi: 'OwnerFi',
      carz: 'Carz Inc',
      abdullah: 'Abdullah',
      benefit: 'Benefit',
      personal: 'Personal',
      gaza: 'Gaza Relief',
    };
    const brandName = brandNames[brand] || brand.charAt(0).toUpperCase() + brand.slice(1);
    const brandInitial = brand[0].toUpperCase();

    // Generate different image types
    if (type === 'blog-hero') {
      return new ImageResponse(
        (
          <div
            style={{
              height: '100%',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              background: `linear-gradient(135deg, ${colors.background} 0%, ${colors.primary} 100%)`,
              padding: '60px',
              color: colors.text,
              fontFamily: 'Inter, sans-serif',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}>
              <h1 style={{ fontSize: '72px', fontWeight: 'bold', margin: '0 0 24px 0', lineHeight: 1.1 }}>
                {title}
              </h1>
              {subtitle && (
                <p style={{ fontSize: '36px', opacity: 0.9, margin: 0 }}>{subtitle}</p>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: 'auto' }}>
              <div style={{ width: '48px', height: '48px', background: colors.accent, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '24px' }}>
                {brandInitial}
              </div>
              <span style={{ fontSize: '32px', fontWeight: '600' }}>{brandName}</span>
            </div>
          </div>
        ),
        {
          width: 1200,
          height: 630,
        }
      );
    }

    if (type === 'carousel-slide') {
      const isFirstSlide = slideNumber === 1;

      return new ImageResponse(
        (
          <div
            style={{
              height: '100%',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              background: colors.background,
              padding: '60px',
              color: colors.text,
              fontFamily: 'Inter, sans-serif',
              position: 'relative',
            }}
          >
            {!isFirstSlide && slideNumber && totalSlides && (
              <div style={{ position: 'absolute', top: '40px', right: '60px', background: colors.primary, color: 'white', padding: '12px 24px', borderRadius: '999px', fontSize: '24px', fontWeight: 'bold' }}>
                {slideNumber} / {totalSlides}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}>
              {isFirstSlide ? (
                <h1 style={{ fontSize: '64px', fontWeight: 'bold', margin: '0 0 24px 0', lineHeight: 1.1, color: colors.accent }}>
                  {title}
                </h1>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                  <div style={{ width: '64px', height: '64px', background: colors.primary, borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '36px' }}>
                    {slideNumber! - 1}
                  </div>
                  <h2 style={{ fontSize: '48px', fontWeight: 'bold', margin: 0 }}>{title}</h2>
                </div>
              )}

              <p style={{ fontSize: isFirstSlide ? '42px' : '36px', lineHeight: 1.5, margin: 0, opacity: isFirstSlide ? 0.9 : 1 }}>
                {content}
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: 'auto' }}>
              <div style={{ width: '40px', height: '40px', background: colors.accent, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '20px' }}>
                {brandInitial}
              </div>
              <span style={{ fontSize: '28px', fontWeight: '600' }}>{brandName}</span>
            </div>
          </div>
        ),
        {
          width: 1080,
          height: 1920,
        }
      );
    }

    if (type === 'quote-card') {
      return new ImageResponse(
        (
          <div
            style={{
              height: '100%',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
              padding: '60px',
              color: colors.text,
              fontFamily: 'Inter, sans-serif',
              justifyContent: 'center',
              alignItems: 'center',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '120px', opacity: 0.3, marginBottom: '-40px' }}>"</div>
            <p style={{ fontSize: '48px', lineHeight: 1.4, margin: '0 0 40px 0', maxWidth: '900px', fontWeight: '500' }}>
              {content || title}
            </p>
            <div style={{ width: '100px', height: '4px', background: colors.accent, borderRadius: '2px', marginBottom: '32px' }}></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', background: colors.accent, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '24px' }}>
                {brandInitial}
              </div>
              <span style={{ fontSize: '32px', fontWeight: '600' }}>{brandName}</span>
            </div>
          </div>
        ),
        {
          width: 1080,
          height: 1080,
        }
      );
    }

    if (type === 'faq-card') {
      return new ImageResponse(
        (
          <div
            style={{
              height: '100%',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              background: colors.background,
              padding: '60px',
              color: colors.text,
              fontFamily: 'Inter, sans-serif',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '48px' }}>
              <div style={{ width: '56px', height: '56px', background: colors.primary, borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '32px' }}>
                ?
              </div>
              <h2 style={{ fontSize: '52px', fontWeight: 'bold', margin: 0, color: colors.accent }}>{title}</h2>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <p style={{ fontSize: '38px', lineHeight: 1.6, margin: 0 }}>{content}</p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: 'auto' }}>
              <div style={{ width: '40px', height: '40px', background: colors.accent, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '20px' }}>
                {brandInitial}
              </div>
              <span style={{ fontSize: '28px', fontWeight: '600' }}>{brandName}</span>
            </div>
          </div>
        ),
        {
          width: 1080,
          height: 1080,
        }
      );
    }

    // Default fallback
    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            background: colors.background,
            padding: '60px',
            color: colors.text,
            fontFamily: 'Inter, sans-serif',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <h1 style={{ fontSize: '72px', fontWeight: 'bold' }}>{title}</h1>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (error) {
    console.error('OG Image generation error:', error);
    return new Response('Failed to generate image', { status: 500 });
  }
}
