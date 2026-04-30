'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ArrowLeft, Users, Star, Phone, Globe, ExternalLink, Loader2, Heart, X } from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  phone: string;
  website: string;
  address: string;
  rating: number;
  reviewCount: number;
  photo?: string;
  googleMapsUrl: string;
  specializations: string[];
  isFeatured: boolean;
  placeId: string;
  businessProfileImage?: string;
}

interface ProfileData {
  city: string;
  state: string;
}

export default function RealtorsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [likedAgents, setLikedAgents] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const AGENTS_PER_PAGE = 3;

  // Auth check
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/auth');
    }
  }, [status, router]);

  // Load profile and agents
  useEffect(() => {
    if (status === 'authenticated') {
      loadData();
    }
  }, [status]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get profile
      const profileRes = await fetch('/api/buyer/profile');
      const profileData = await profileRes.json();

      if (!profileData.profile) {
        router.replace('/auth/setup');
        return;
      }

      const userProfile = {
        city: profileData.profile.preferredCity || profileData.profile.city || 'Memphis',
        state: profileData.profile.preferredState || profileData.profile.state || 'TN'
      };

      setProfile(userProfile);
      
      // Search for agents
      await searchAgents(userProfile.city, userProfile.state, 0);
      
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const searchAgents = async (city: string, state: string, offset: number) => {
    try {
      const searchParams = new URLSearchParams({
        city: city.trim(),
        state: state.trim().toUpperCase(),
        limit: (AGENTS_PER_PAGE * 2).toString(), // Load extra for smoother pagination
        offset: offset.toString()
      });
      
      const response = await fetch(`/api/agents/search-live?${searchParams}`);
      
      if (!response.ok) {
        throw new Error(`Failed to search agents: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        const validAgents = (data.agents || []).filter((agent: Agent) => 
          agent.name && agent.name.trim() !== ''
        );
        
        if (offset === 0) {
          setAgents(validAgents);
        } else {
          setAgents(prev => [...prev, ...validAgents]);
        }
        
        setHasMore(data.hasMore);
      } else {
        throw new Error(data.error || 'Failed to search agents');
      }
    } catch (err: any) {
      console.error('Error searching agents:', err);
      setError(err.message || 'Failed to search agents. Please try again.');
    }
  };

  const loadMore = async () => {
    if (hasMore && !loading && profile) {
      await searchAgents(profile.city, profile.state, agents.length);
    }
  };

  const toggleLike = (agentId: string) => {
    setLikedAgents(prev => {
      const newLiked = new Set(prev);
      if (newLiked.has(agentId)) {
        newLiked.delete(agentId);
      } else {
        newLiked.add(agentId);
      }
      return newLiked;
    });
  };

  const getCurrentPageAgents = () => {
    const startIndex = currentPage * AGENTS_PER_PAGE;
    return agents.slice(startIndex, startIndex + AGENTS_PER_PAGE);
  };

  const totalPages = Math.ceil(agents.length / AGENTS_PER_PAGE);
  const currentPageAgents = getCurrentPageAgents();

  if (loading && agents.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-spin" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">Finding Top Agents</h3>
          <p className="text-gray-600">
            Searching for the best real estate professionals in {profile?.city || 'your area'}...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <X className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h3>
          <p className="text-red-700 mb-4">{error}</p>
          <Button onClick={loadData} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                onClick={() => router.back()}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Find Realtors</h1>
                <p className="text-gray-600">
                  Top-rated agents in {profile?.city}, {profile?.state}
                </p>
              </div>
            </div>
            <div className="text-right text-sm text-gray-600">
              {agents.length} agents found • {likedAgents.size} liked
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {agents.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No agents found</h3>
            <p className="text-gray-600 mb-4">
              Try searching in a different area or check back later.
            </p>
            <Button onClick={loadData}>Search Again</Button>
          </div>
        ) : (
          <>
            {/* Agents Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {currentPageAgents.map((agent) => (
                <Card key={agent.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="relative">
                    {/* Agent Photo */}
                    <div className="h-48 bg-gradient-to-b from-blue-500 to-blue-600 flex items-center justify-center">
                      {agent.photo ? (
                        <img
                          src={agent.photo}
                          alt={agent.name}
                          className="w-full h-full object-cover"
                        />
                      ) : agent.businessProfileImage ? (
                        <img
                          src={agent.businessProfileImage}
                          alt={`${agent.name} business`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Users className="w-16 h-16 text-white" />
                      )}
                    </div>
                    
                    {/* Like Button */}
                    <button
                      onClick={() => toggleLike(agent.id)}
                      className={`absolute top-3 right-3 w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                        likedAgents.has(agent.id)
                          ? 'bg-red-500 text-white'
                          : 'bg-white/90 text-gray-600 hover:bg-white'
                      }`}
                    >
                      <Heart className={`w-5 h-5 ${likedAgents.has(agent.id) ? 'fill-current' : ''}`} />
                    </button>
                    
                    {/* Featured Badge */}
                    {agent.isFeatured && (
                      <div className="absolute top-3 left-3 bg-yellow-500 text-white px-2 py-1 rounded-full text-xs font-semibold">
                        ⭐ Top Rated
                      </div>
                    )}
                  </div>
                  
                  {/* Agent Info */}
                  <div className="p-4">
                    <h3 className="text-lg font-bold text-gray-900 mb-2">{agent.name}</h3>
                    
                    {/* Rating */}
                    <div className="flex items-center mb-3">
                      <Star className="w-4 h-4 text-yellow-400 fill-current" />
                      <span className="ml-1 text-sm font-semibold text-gray-900">
                        {agent.rating.toFixed(1)}
                      </span>
                      <span className="ml-1 text-sm text-gray-600">
                        ({agent.reviewCount} reviews)
                      </span>
                    </div>
                    
                    {/* Specializations */}
                    <div className="flex flex-wrap gap-1 mb-4">
                      {agent.specializations.slice(0, 2).map((spec) => (
                        <span
                          key={spec}
                          className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                        >
                          {spec}
                        </span>
                      ))}
                    </div>
                    
                    {/* Actions */}
                    <div className="space-y-2">
                      {agent.phone && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-start"
                          onClick={() => window.open(`tel:${agent.phone}`, '_self')}
                        >
                          <Phone className="w-4 h-4 mr-2" />
                          Call Now
                        </Button>
                      )}
                      <Button
                        size="sm"
                        className="w-full justify-start bg-blue-600 hover:bg-blue-700"
                        onClick={() => window.open(agent.googleMapsUrl, '_blank')}
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        View Profile
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
            
            {/* Pagination */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Button
                  variant="outline"
                  onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                  disabled={currentPage === 0}
                >
                  Previous
                </Button>
                <span className="text-sm text-gray-600">
                  Page {currentPage + 1} of {Math.max(1, totalPages)}
                </span>
                <Button
                  variant="outline"
                  onClick={() => {
                    const nextPage = currentPage + 1;
                    if (nextPage >= totalPages && hasMore) {
                      loadMore();
                    }
                    setCurrentPage(nextPage);
                  }}
                  disabled={currentPage >= totalPages - 1 && !hasMore}
                >
                  Next
                </Button>
              </div>
              
              {hasMore && (
                <Button
                  variant="outline"
                  onClick={loadMore}
                  disabled={loading}
                  className="flex items-center space-x-2"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Load More</span>
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}