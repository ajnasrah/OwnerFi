/**
 * Blog Admin Dashboard
 *
 * Manage all blog posts across all brands
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Brand } from '@/config/constants';

interface BlogPost {
  id: string;
  brand: Brand;
  title: string;
  slug: string;
  author: string;
  status: 'draft' | 'published' | 'archived';
  pillar: string;
  createdAt: Date;
  publishedAt?: Date;
  views?: number;
}

export default function BlogAdminPage() {
  const [selectedBrand, setSelectedBrand] = useState<Brand>('ownerfi');
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  const brands: Brand[] = ['ownerfi', 'carz', 'abdullah', 'vassdistro'];

  useEffect(() => {
    fetchPosts();
  }, [selectedBrand]);

  async function fetchPosts() {
    setLoading(true);
    try {
      const response = await fetch(`/api/blog/list?brand=${selectedBrand}`);
      if (response.ok) {
        const data = await response.json();
        setPosts(data.posts || []);
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  }

  async function deletePost(id: string) {
    if (!confirm('Are you sure you want to delete this post?')) return;

    try {
      const response = await fetch(`/api/blog/${id}?brand=${selectedBrand}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        alert('Post deleted successfully');
        fetchPosts();
      } else {
        alert('Failed to delete post');
      }
    } catch (error) {
      console.error('Error deleting post:', error);
      alert('Failed to delete post');
    }
  }

  return (
    <div className="h-screen overflow-hidden bg-slate-900 text-white flex flex-col">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Blog Management</h1>
            <p className="text-slate-400">Create and manage blog posts for all brands</p>
          </div>
          <Link
            href="/admin/blog/create"
            className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white px-6 py-3 rounded-lg font-semibold transition-all duration-300 hover:scale-105"
          >
            + Create New Post
          </Link>
        </div>

        {/* Brand Tabs */}
        <div className="flex gap-2 mb-6 border-b border-slate-700">
          {brands.map(brand => (
            <button
              key={brand}
              onClick={() => setSelectedBrand(brand)}
              className={`px-4 py-2 font-medium transition-colors ${
                selectedBrand === brand
                  ? 'text-emerald-400 border-b-2 border-emerald-400'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {brand === 'ownerfi' && 'OwnerFi'}
              {brand === 'carz' && 'Carz Inc'}
              {brand === 'abdullah' && 'Abdullah'}
              {brand === 'vassdistro' && 'Vass Distro'}
            </button>
          ))}
        </div>

        {/* Posts List */}
        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
            <p className="mt-4 text-slate-400">Loading posts...</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20 bg-slate-800/50 rounded-xl border border-slate-700">
            <p className="text-slate-400 text-lg mb-4">No blog posts yet for {selectedBrand}</p>
            <Link
              href="/admin/blog/create"
              className="inline-block text-emerald-400 hover:text-emerald-300 font-medium"
            >
              Create your first post →
            </Link>
          </div>
        ) : (
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-700/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Pillar
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Views
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {posts.map((post) => (
                  <tr key={post.id} className="hover:bg-slate-700/30">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-white">{post.title}</div>
                      <div className="text-xs text-slate-400">/{post.slug}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        post.status === 'published' ? 'bg-emerald-500/20 text-emerald-400' :
                        post.status === 'draft' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-slate-500/20 text-slate-400'
                      }`}>
                        {post.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300">
                      {post.pillar?.replace(/-/g, ' ')}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300">
                      {post.views || 0}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-400">
                      {new Date(post.publishedAt || post.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/${selectedBrand}/blog/${post.slug}`}
                          target="_blank"
                          className="text-blue-400 hover:text-blue-300"
                        >
                          View
                        </Link>
                        <Link
                          href={`/admin/blog/edit/${post.id}?brand=${selectedBrand}`}
                          className="text-emerald-400 hover:text-emerald-300"
                        >
                          Edit
                        </Link>
                        <button
                          onClick={() => deletePost(post.id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
