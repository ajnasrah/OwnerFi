/**
 * Brand Blog List Page
 *
 * Displays all blog posts for a specific brand
 */

import { Metadata } from 'next';
import Link from 'next/link';
import { Brand } from '@/config/constants';
import { getBrandConfig } from '@/config/brand-configs';

interface BlogListPageProps {
  params: Promise<{
    brand: Brand;
  }>;
}

export async function generateMetadata({ params }: BlogListPageProps): Promise<Metadata> {
  const { brand } = await params;
  const config = getBrandConfig(brand);

  const titles: Record<Brand, string> = {
    ownerfi: 'Owner Financing Blog - Real Estate Education & Deal Breakdowns',
    carz: 'Car Buying Blog - Dealer Secrets & Industry Insights',
    abdullah: 'Abdullah\'s Blog - Entrepreneurship & Real Talk',
    benefit: 'Owner Finance Benefits Blog',
    personal: 'Personal Blog',
    gaza: 'Gaza Humanitarian Updates',
  };

  const descriptions: Record<Brand, string> = {
    ownerfi: 'Learn about owner financing, seller financing, and alternative home buying methods. Real deal breakdowns, agent playbooks, and market insights.',
    carz: 'Car buying tips, dealer secrets, auction insights, and car flipping guides from industry insiders.',
    abdullah: 'Real stories about entrepreneurship, real estate investing, and building multiple businesses with automation.',
    benefit: 'Educational content about the benefits of owner financing for buyers and sellers.',
    personal: 'Personal stories and lifestyle content.',
    gaza: 'Humanitarian updates and relief information about Gaza.',
  };

  return {
    title: titles[brand],
    description: descriptions[brand],
    openGraph: {
      title: titles[brand],
      description: descriptions[brand],
      type: 'website',
    },
  };
}

export default async function BlogListPage({ params }: BlogListPageProps) {
  const { brand } = await params;
  const config = getBrandConfig(brand);

  // Fetch blog posts
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  let posts = [];

  try {
    const response = await fetch(`${baseUrl}/api/blog/list?brand=${brand}&status=published`, {
      next: { revalidate: 300 }, // Revalidate every 5 minutes
    });

    if (response.ok) {
      const data = await response.json();
      posts = data.posts || [];
    }
  } catch (error) {
    console.error('Error fetching blog posts:', error);
  }

  const brandNames: Record<Brand, string> = {
    ownerfi: 'OwnerFi',
    carz: 'Carz Inc',
    abdullah: 'Abdullah',
    benefit: 'Owner Finance Benefits',
    personal: 'Personal',
    gaza: 'Gaza Relief',
  };

  const brandName = brandNames[brand];

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="bg-slate-800/50 backdrop-blur-lg border-b border-slate-700/50 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">{brand[0].toUpperCase()}</span>
            </div>
            <span className="text-lg font-bold text-white">{brandName}</span>
          </Link>
          <nav>
            <Link
              href="/"
              className="text-slate-300 hover:text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              ← Back to Home
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">{brandName} Blog</h1>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto">
            {brand === 'ownerfi' && 'Educational content about owner financing, real deal breakdowns, and market insights.'}
            {brand === 'carz' && 'Car buying tips, dealer secrets, and industry insights from the inside.'}
            {brand === 'abdullah' && 'Real talk about entrepreneurship, investing, and building businesses.'}
            {brand === 'benefit' && 'Educational content about the benefits of owner financing.'}
            {brand === 'gaza' && 'Humanitarian updates and relief information about Gaza.'}
          </p>
        </div>

        {/* Blog Grid */}
        {posts.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-slate-400 text-lg">No blog posts published yet. Check back soon!</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {posts.map((post: any) => (
              <Link
                key={post.id}
                href={`/${brand}/blog/${post.slug}`}
                className="group bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden hover:border-emerald-500/50 transition-all duration-300 hover:scale-105"
              >
                {/* OG Image */}
                {post.seo?.ogImage && (
                  <div className="aspect-video bg-slate-700/30 overflow-hidden">
                    <img
                      src={post.seo.ogImage}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                  </div>
                )}

                {/* Content */}
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-medium px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded">
                      {post.pillar?.replace(/-/g, ' ').toUpperCase()}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(post.publishedAt).toLocaleDateString()}
                    </span>
                  </div>

                  <h2 className="text-xl font-bold text-white mb-2 group-hover:text-emerald-400 transition-colors">
                    {post.title}
                  </h2>

                  {post.subtitle && (
                    <p className="text-sm text-slate-300 mb-4 line-clamp-2">{post.subtitle}</p>
                  )}

                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>By {post.author}</span>
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      {post.views || 0}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
