'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { MapPin, Phone, Globe, Star, Users, ExternalLink, Loader2, Heart, X, RotateCcw, ChevronRight } from 'lucide-react';

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
  businessEmbedUrl?: string;
}

interface AgentSwiperProps {
  city?: string;
  state?: string;
  className?: string;
}

export default function AgentSwiper({ 
  city = 'Memphis', 
  state = 'TN',
  className = '' 
}: AgentSwiperProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [currentAgentIndex, setCurrentAgentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [likedAgents, setLikedAgents] = useState<Agent[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [totalAgents, setTotalAgents] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);

  const searchAgents = async (offset: number = 0) => {
    setLoading(true);
    setError(null);
    
    try {
      const searchParams = new URLSearchParams({
        city: city.trim(),
        state: state.trim().toUpperCase(),
        limit: '3',
        offset: offset.toString()
      });
      
      const response = await fetch(`/api/agents/search-live?${searchParams}`);
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Please log in to search for agents');
        } else if (response.status === 429) {
          throw new Error('Too many requests. Please try again in a moment');
        }
        throw new Error(`Failed to search agents: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        const validAgents = (data.agents || []).filter((agent: Agent) => 
          agent.name && agent.name.trim() !== ''
        );
        
        if (offset === 0) {
          setAgents(validAgents);
          setCurrentAgentIndex(0);
        } else {
          setAgents(prev => [...prev, ...validAgents]);
        }
        
        setHasMore(data.hasMore);
        setTotalAgents(data.total);
        setIsInitialized(true);
      } else {
        throw new Error(data.error || 'Failed to search agents');
      }
    } catch (err: any) {
      console.error('Error searching agents:', err);
      setError(err.message || 'Failed to search agents. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadMoreAgents = async () => {
    if (hasMore && !loading) {
      await searchAgents(agents.length);
    }
  };

  const handleLike = () => {
    const currentAgent = agents[currentAgentIndex];
    if (currentAgent) {
      setLikedAgents(prev => [...prev, currentAgent]);
      nextAgent();
    }
  };

  const handleDislike = () => {
    nextAgent();
  };

  const nextAgent = () => {
    const nextIndex = currentAgentIndex + 1;
    
    // If we're near the end and have more agents, load them
    if (nextIndex >= agents.length - 1 && hasMore && !loading) {
      loadMoreAgents();
    }
    
    // Move to next agent or show completion
    if (nextIndex < agents.length) {
      setCurrentAgentIndex(nextIndex);
    } else if (!hasMore) {
      // End of agents - could show liked agents or restart
      setCurrentAgentIndex(agents.length); // Trigger end state
    }
  };

  const restartSwiper = () => {
    setCurrentAgentIndex(0);
    setLikedAgents([]);
  };

  const startSearch = () => {
    searchAgents(0);
  };

  // Initialize search on mount
  useEffect(() => {
    if (!isInitialized) {
      startSearch();
    }
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!currentAgent) return;
      
      switch (e.key) {
        case 'ArrowLeft':
        case 'x':
          e.preventDefault();
          handleDislike();
          break;
        case 'ArrowRight':
        case 'l':
          e.preventDefault();
          handleLike();
          break;
        case 'ArrowUp':
        case 'v':
          e.preventDefault();
          window.open(currentAgent.googleMapsUrl, '_blank');
          break;
        case ' ':
          e.preventDefault();
          handleLike();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentAgent]);

  // Touch gesture handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setTouchEnd({ x: touch.clientX, y: touch.clientY });
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const deltaX = touchEnd.x - touchStart.x;
    const deltaY = touchEnd.y - touchStart.y;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    // Only trigger if horizontal swipe is longer than vertical
    if (absDeltaX > absDeltaY && absDeltaX > 50) {
      if (deltaX > 0) {
        // Swipe right = like
        handleLike();
      } else {
        // Swipe left = dislike
        handleDislike();
      }
    }

    setTouchStart(null);
    setTouchEnd(null);
  };

  // Show liked agents summary
  if (currentAgentIndex >= agents.length && agents.length > 0) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="text-center">
          <Heart className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            You've reviewed all agents!
          </h2>
          <p className="text-gray-600 mb-6">
            {likedAgents.length > 0 
              ? `You liked ${likedAgents.length} agent${likedAgents.length > 1 ? 's' : ''}`
              : 'No agents caught your interest'
            }
          </p>
        </div>

        {likedAgents.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Your Liked Agents:</h3>
            {likedAgents.map((agent) => (
              <Card key={agent.id} className="p-4">
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    {agent.photo ? (
                      <img src={agent.photo} alt={agent.name} className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                        <Users className="w-6 h-6 text-gray-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-lg font-semibold text-gray-900">{agent.name}</h4>
                    <div className="flex items-center">
                      <Star className="w-4 h-4 text-yellow-400 fill-current" />
                      <span className="ml-1 text-sm text-gray-600">
                        {agent.rating.toFixed(1)} ({agent.reviewCount} reviews)
                      </span>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    {agent.phone && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`tel:${agent.phone}`, '_self')}
                      >
                        <Phone className="w-4 h-4" />
                      </Button>
                    )}
                    {agent.website && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(agent.website, '_blank')}
                      >
                        <Globe className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        <div className="flex space-x-4 justify-center">
          <Button onClick={restartSwiper} variant="outline">
            <RotateCcw className="w-4 h-4 mr-2" />
            Start Over
          </Button>
          <Button onClick={startSearch}>
            <ChevronRight className="w-4 h-4 mr-2" />
            Search Again
          </Button>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading && !isInitialized) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-lg p-8">
          <Loader2 className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-spin" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            Finding Top Agents
          </h3>
          <p className="text-gray-600">
            Searching for the best real estate professionals in {city}, {state}...
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !isInitialized) {
    return (
      <div className={`text-center ${className}`}>
        <div className="bg-red-50 border border-red-200 rounded-lg p-8">
          <div className="text-red-600 mb-4">
            <X className="w-12 h-12 mx-auto" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            Search Failed
          </h3>
          <p className="text-red-700 mb-4">{error}</p>
          <Button onClick={startSearch} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // No agents found
  if (agents.length === 0 && isInitialized && !loading) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No agents found</h3>
        <p className="text-gray-600 mb-4">
          Try searching in a different area or check back later.
        </p>
        <Button onClick={startSearch}>Search Again</Button>
      </div>
    );
  }

  const currentAgent = agents[currentAgentIndex];
  if (!currentAgent) return null;

  return (
    <div className={`max-w-md mx-auto space-y-6 ${className}`}>
      {/* Progress indicator */}
      <div className="text-center">
        <p className="text-sm text-gray-600">
          Agent {currentAgentIndex + 1} of {totalAgents} • {likedAgents.length} liked
        </p>
        <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentAgentIndex + 1) / Math.max(totalAgents, 1)) * 100}%` }}
          />
        </div>
      </div>

      {/* Agent Card */}
      <Card 
        className="overflow-hidden shadow-lg select-none"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <CardContent className="p-0">
          {/* Agent Photo/Business Profile */}
          <div className="relative h-48 bg-gradient-to-b from-blue-500 to-blue-600 flex items-center justify-center overflow-hidden">
            {currentAgent.photo ? (
              <img
                src={currentAgent.photo}
                alt={`${currentAgent.name} profile`}
                className="w-full h-full object-cover"
              />
            ) : currentAgent.businessProfileImage ? (
              <img
                src={currentAgent.businessProfileImage}
                alt={`${currentAgent.name} business location`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Hide image if it fails to load
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <div className="text-center">
                <Users className="w-20 h-20 text-white mb-2" />
                <p className="text-white text-sm opacity-75">Real Estate Professional</p>
              </div>
            )}
            {currentAgent.isFeatured && (
              <div className="absolute top-4 right-4 bg-yellow-500 text-white px-2 py-1 rounded-full text-xs font-semibold">
                ⭐ Top Rated
              </div>
            )}
            {/* Agent profile indicator */}
            {currentAgent.photo && (
              <div className="absolute bottom-4 left-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-xs">
                📷 Google Business Photo
              </div>
            )}
          </div>

          {/* Agent Info */}
          <div className="p-6">
            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              {currentAgent.name}
            </h3>
            
            {/* Rating */}
            <div className="flex items-center mb-4">
              <div className="flex items-center">
                <Star className="w-5 h-5 text-yellow-400 fill-current" />
                <span className="ml-1 text-lg font-semibold text-gray-900">
                  {currentAgent.rating.toFixed(1)}
                </span>
              </div>
              <span className="ml-2 text-gray-600">
                ({currentAgent.reviewCount} Google reviews)
              </span>
            </div>

            {/* Address */}
            <div className="flex items-center mb-4 text-gray-700">
              <MapPin className="w-5 h-5 mr-2 flex-shrink-0 text-gray-500" />
              <span>{currentAgent.address}</span>
            </div>

            {/* Specializations */}
            <div className="flex flex-wrap gap-2 mb-6">
              {currentAgent.specializations.map((spec) => (
                <span
                  key={spec}
                  className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
                >
                  {spec}
                </span>
              ))}
            </div>

            {/* Contact Info */}
            <div className="space-y-3">
              {currentAgent.phone && (
                <div className="flex items-center text-gray-700">
                  <Phone className="w-4 h-4 mr-3 text-gray-500" />
                  <span>{currentAgent.phone}</span>
                </div>
              )}
              {currentAgent.website && (
                <div className="flex items-center text-gray-700">
                  <Globe className="w-4 h-4 mr-3 text-gray-500" />
                  <span className="truncate">{currentAgent.website.replace(/^https?:\/\//, '')}</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-center space-x-4">
        <Button
          variant="outline"
          size="lg"
          className="w-16 h-16 rounded-full border-red-300 hover:bg-red-50 hover:border-red-400"
          onClick={handleDislike}
        >
          <X className="w-8 h-8 text-red-500" />
        </Button>
        
        <Button
          variant="outline"
          size="lg"
          className="w-16 h-16 rounded-full border-blue-300 hover:bg-blue-50 hover:border-blue-400"
          onClick={() => window.open(currentAgent.googleMapsUrl, '_blank')}
        >
          <ExternalLink className="w-6 h-6 text-blue-500" />
        </Button>
        
        <Button
          size="lg"
          className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 border-0"
          onClick={handleLike}
        >
          <Heart className="w-8 h-8 text-white" />
        </Button>
      </div>

      {/* Action Labels */}
      <div className="flex justify-center space-x-4 text-sm text-gray-600">
        <span className="w-16 text-center">Skip<br/><kbd className="text-xs bg-gray-100 px-1 rounded">←</kbd></span>
        <span className="w-16 text-center">View<br/><kbd className="text-xs bg-gray-100 px-1 rounded">↑</kbd></span>
        <span className="w-16 text-center">Like<br/><kbd className="text-xs bg-gray-100 px-1 rounded">→</kbd></span>
      </div>

      {/* Swipe Instructions */}
      <div className="text-center text-xs text-gray-500">
        💡 Swipe left to skip • Swipe right to like • Tap ↑ for Google Maps
      </div>

      {/* Loading more indicator */}
      {loading && (
        <div className="text-center py-4">
          <Loader2 className="w-6 h-6 mx-auto animate-spin text-blue-500" />
          <p className="text-sm text-gray-600 mt-2">Loading more agents...</p>
        </div>
      )}
    </div>
  );
}