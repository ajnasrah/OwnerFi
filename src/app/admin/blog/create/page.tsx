/**
 * Blog Create Page
 *
 * Simple form to create blog posts with AI assistance
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Brand } from '@/config/constants';
import { CONTENT_PILLARS, BlogSection } from '@/lib/blog-models';

export default function CreateBlogPage() {
  const router = useRouter();
  const [brand, setBrand] = useState<Brand>('ownerfi');
  const [pillar, setPillar] = useState('');
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [author, setAuthor] = useState('OwnerFi Team');
  const [sections, setSections] = useState<BlogSection[]>([
    { type: 'hook', heading: 'Introduction', content: '', bullets: [] },
    { type: 'problem', heading: 'The Challenge', content: '', bullets: [] },
    { type: 'steps', heading: 'How It Works', content: '', bullets: [''] },
    { type: 'example', heading: 'Real Example', content: '', bullets: [] },
    { type: 'faq', heading: 'Common Questions', content: '', bullets: [] },
    { type: 'cta', heading: 'Next Steps', content: '', bullets: [] },
  ]);
  const [focusKeyword, setFocusKeyword] = useState('');
  const [tags, setTags] = useState('');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [loading, setLoading] = useState(false);

  const brands: Brand[] = ['ownerfi', 'carz', 'abdullah', 'benefit', 'gaza'];

  const updateSection = (index: number, field: keyof BlogSection, value: string) => {
    const newSections = [...sections];
    newSections[index][field] = value as never;
    setSections(newSections);
  };

  const addBullet = (sectionIndex: number) => {
    const newSections = [...sections];
    if (!newSections[sectionIndex].bullets) {
      newSections[sectionIndex].bullets = [];
    }
    newSections[sectionIndex].bullets!.push('');
    setSections(newSections);
  };

  const updateBullet = (sectionIndex: number, bulletIndex: number, value: string) => {
    const newSections = [...sections];
    newSections[sectionIndex].bullets![bulletIndex] = value;
    setSections(newSections);
  };

  const removeBullet = (sectionIndex: number, bulletIndex: number) => {
    const newSections = [...sections];
    newSections[sectionIndex].bullets!.splice(bulletIndex, 1);
    setSections(newSections);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/blog/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand,
          title,
          subtitle,
          author,
          sections: sections.filter(s => s.content || (s.bullets && s.bullets.length > 0 && s.bullets[0])),
          pillar,
          tags: tags.split(',').map(t => t.trim()).filter(Boolean),
          focusKeyword,
          status,
        }),
      });

      if (response.ok) {
        alert('Blog post created successfully!');
        router.push('/admin/blog');
      } else {
        const data = await response.json();
        alert(`Failed to create blog: ${data.error}`);
      }
    } catch (error) {
      console.error('Error creating blog:', error);
      alert('Failed to create blog post');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Create Blog Post</h1>
          <p className="text-slate-400">Fill in the sections below to create a new blog post with auto-generated social images</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Brand & Basic Info */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6 space-y-4">
            <h2 className="text-xl font-bold text-white mb-4">Basic Information</h2>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Brand</label>
                <select
                  value={brand}
                  onChange={(e) => {
                    setBrand(e.target.value as Brand);
                    setPillar('');
                  }}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  required
                >
                  {brands.map(b => (
                    <option key={b} value={b}>
                      {b === 'ownerfi' && 'OwnerFi'}
                      {b === 'carz' && 'Carz Inc'}
                      {b === 'abdullah' && 'Abdullah'}
                      {b === 'benefit' && 'Benefit'}
                      {b === 'gaza' && 'Gaza'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Content Pillar</label>
                <select
                  value={pillar}
                  onChange={(e) => setPillar(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  required
                >
                  <option value="">Select pillar...</option>
                  {CONTENT_PILLARS[brand]?.map(p => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Title (SEO-optimized)</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., How to Buy a House With Bad Credit Using Owner Financing in Dallas"
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Subtitle (optional)</label>
              <input
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="Brief description that appears under the title"
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Author</label>
                <input
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Focus Keyword (SEO)</label>
                <input
                  type="text"
                  value={focusKeyword}
                  onChange={(e) => setFocusKeyword(e.target.value)}
                  placeholder="e.g., owner financing bad credit"
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Tags (comma-separated)</label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="e.g., owner finance, real estate, texas"
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Sections */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white">Content Sections</h2>

            {sections.map((section, sectionIndex) => (
              <div key={sectionIndex} className="bg-slate-800/50 rounded-xl border border-slate-700 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-emerald-400">
                    {sectionIndex + 1}. {section.heading} ({section.type})
                  </h3>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Section Heading</label>
                  <input
                    type="text"
                    value={section.heading}
                    onChange={(e) => updateSection(sectionIndex, 'heading', e.target.value)}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>

                {section.type === 'steps' ? (
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Steps (for carousel slides)</label>
                    {section.bullets?.map((bullet, bulletIndex) => (
                      <div key={bulletIndex} className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={bullet}
                          onChange={(e) => updateBullet(sectionIndex, bulletIndex, e.target.value)}
                          placeholder={`Step ${bulletIndex + 1}`}
                          className="flex-1 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        />
                        <button
                          type="button"
                          onClick={() => removeBullet(sectionIndex, bulletIndex)}
                          className="px-3 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => addBullet(sectionIndex)}
                      className="mt-2 text-sm text-emerald-400 hover:text-emerald-300"
                    >
                      + Add Step
                    </button>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Content</label>
                    <textarea
                      value={section.content}
                      onChange={(e) => updateSection(sectionIndex, 'content', e.target.value)}
                      rows={4}
                      placeholder={`Write the ${section.type} content here...`}
                      className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Submit */}
          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={loading}
              className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white px-8 py-3 rounded-lg font-semibold transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : status === 'published' ? 'Publish Blog' : 'Save as Draft'}
            </button>

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'draft' | 'published')}
              className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            >
              <option value="draft">Save as Draft</option>
              <option value="published">Publish Now</option>
            </select>

            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-3 text-slate-300 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
