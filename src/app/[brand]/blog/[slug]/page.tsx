/**
 * Brand Blog Single Post Page
 *
 * Displays a single blog post with SEO optimization and social sharing
 */

import { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';
import { Brand } from '@/config/constants';
import { getBrandConfig } from '@/config/brand-configs';
import { notFound } from 'next/navigation';

interface BlogPostPageProps {
  params: {
    brand: Brand;
    slug: string;
  };
}

async function getPost(brand: Brand, slug: string) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  try {
    // First get list to find post by slug
    const response = await fetch(`${baseUrl}/api/blog/list?brand=${brand}&status=published`, {
      next: { revalidate: 300 },
    });

    if (!response.ok) return null;

    const data = await response.json();
    const post = data.posts?.find((p: any) => p.slug === slug);

    return post || null;
  } catch (error) {
    console.error('Error fetching blog post:', error);
    return null;
  }
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { brand, slug } = params;
  const post = await getPost(brand, slug);

  if (!post) {
    return {
      title: 'Blog Post Not Found',
    };
  }

  return {
    title: post.seo.metaTitle || post.title,
    description: post.seo.metaDescription,
    keywords: post.seo.keywords,
    openGraph: {
      title: post.seo.metaTitle || post.title,
      description: post.seo.metaDescription,
      type: 'article',
      publishedTime: post.publishedAt,
      authors: [post.author],
      tags: post.tags,
      images: post.seo.ogImage ? [post.seo.ogImage] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.seo.metaTitle || post.title,
      description: post.seo.metaDescription,
      images: post.seo.ogImage ? [post.seo.ogImage] : undefined,
    },
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { brand, slug } = params;
  const post = await getPost(brand, slug);

  if (!post) {
    notFound();
  }

  const config = getBrandConfig(brand);

  const brandNames: Record<Brand, string> = {
    ownerfi: 'OwnerFi',
    carz: 'Carz Inc',
    abdullah: 'Abdullah',
    vassdistro: 'Vass Distro',
    benefit: 'Owner Finance Benefits',
    property: 'Property Showcase',
    podcast: 'Podcast',
    personal: 'Personal',
  };

  const brandName = brandNames[brand];

  // Generate schema markup
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": post.title,
    "description": post.seo.metaDescription,
    "image": post.seo.ogImage,
    "author": {
      "@type": "Person",
      "name": post.author
    },
    "publisher": {
      "@type": "Organization",
      "name": brandName,
    },
    "datePublished": post.publishedAt,
    "dateModified": post.updatedAt,
    "keywords": post.seo.keywords.join(', '),
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": `${process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.ai'}`
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Blog",
        "item": `${process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.ai'}/${brand}/blog`
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": post.title,
        "item": `${process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.ai'}/${brand}/blog/${slug}`
      }
    ]
  };

  // FAQ schema if applicable
  const faqSection = post.sections.find((s: any) => s.type === 'faq');
  let faqSchema = null;
  if (faqSection && faqSection.bullets) {
    faqSchema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": faqSection.bullets.map((bullet: string) => {
        const [question, ...answerParts] = bullet.split(':');
        return {
          "@type": "Question",
          "name": question.trim(),
          "acceptedAnswer": {
            "@type": "Answer",
            "text": answerParts.join(':').trim()
          }
        };
      })
    };
  }

  return (
    <>
      {/* Schema Markup */}
      <Script
        id="article-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <Script
        id="breadcrumb-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      {faqSchema && (
        <Script
          id="faq-schema"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      )}

      <div className="min-h-screen bg-slate-900 text-white">
        {/* Header */}
        <header className="bg-slate-800/50 backdrop-blur-lg border-b border-slate-700/50 px-6 py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <Link href={`/${brand}/blog`} className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">{brand[0].toUpperCase()}</span>
              </div>
              <span className="text-lg font-bold text-white">{brandName} Blog</span>
            </Link>
            <nav>
              <Link
                href={`/${brand}/blog`}
                className="text-slate-300 hover:text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                ← All Posts
              </Link>
            </nav>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-4xl mx-auto px-6 py-12">
          {/* Article Header */}
          <article>
            <header className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-sm font-medium px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full">
                  {post.pillar?.replace(/-/g, ' ').toUpperCase()}
                </span>
                <span className="text-sm text-slate-400">
                  {new Date(post.publishedAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
              </div>

              <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
                {post.title}
              </h1>

              {post.subtitle && (
                <p className="text-xl text-slate-300 mb-6">{post.subtitle}</p>
              )}

              <div className="flex items-center gap-4 text-sm text-slate-400">
                <span>By {post.author}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  {post.views || 0} views
                </span>
              </div>
            </header>

            {/* Article Content */}
            <div className="prose prose-invert prose-lg max-w-none">
              {post.sections.map((section: any, index: number) => (
                <section key={index} className="mb-8">
                  <h2 className="text-2xl font-bold text-white mb-4">{section.heading}</h2>

                  <div className="text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {section.content}
                  </div>

                  {section.bullets && section.bullets.length > 0 && (
                    <ul className="mt-4 space-y-2">
                      {section.bullets.map((bullet: string, bulletIndex: number) => (
                        <li key={bulletIndex} className="text-slate-300 flex items-start gap-2">
                          <span className="text-emerald-400 mt-1">•</span>
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {section.type === 'cta' && (
                    <div className="mt-6 p-6 bg-gradient-to-r from-emerald-600/20 to-blue-600/20 rounded-xl border border-emerald-500/30">
                      <div className="flex flex-col gap-4">
                        <Link
                          href={brand === 'ownerfi' ? '/signup' : '/'}
                          className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white py-3 px-8 rounded-xl font-semibold transition-all duration-300 hover:scale-105 shadow-lg text-center"
                        >
                          {brand === 'ownerfi' && 'Browse Properties'}
                          {brand === 'carz' && 'View Inventory'}
                          {brand === 'abdullah' && 'Follow for More'}
                        </Link>
                      </div>
                    </div>
                  )}
                </section>
              ))}
            </div>

            {/* Tags */}
            {post.tags && post.tags.length > 0 && (
              <div className="mt-8 flex flex-wrap gap-2">
                {post.tags.map((tag: string) => (
                  <span key={tag} className="text-xs px-3 py-1 bg-slate-700/50 text-slate-300 rounded-full">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </article>

          {/* Social Sharing */}
          <div className="mt-12 pt-8 border-t border-slate-700/50">
            <p className="text-sm text-slate-400 mb-4">Share this article:</p>
            <div className="flex gap-4">
              <a
                href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(`${process.env.NEXT_PUBLIC_BASE_URL}/${brand}/blog/${slug}`)}&text=${encodeURIComponent(post.title)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Twitter
              </a>
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${process.env.NEXT_PUBLIC_BASE_URL}/${brand}/blog/${slug}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Facebook
              </a>
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(`${process.env.NEXT_PUBLIC_BASE_URL}/${brand}/blog/${slug}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-sm font-medium transition-colors"
              >
                LinkedIn
              </a>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
