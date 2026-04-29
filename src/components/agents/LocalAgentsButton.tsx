'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { MapPin, Phone, Globe, Star, Users, ExternalLink, Loader2 } from 'lucide-react';

// Simple Badge component
const Badge = ({ children, variant = 'default', className = '' }: { children: React.ReactNode; variant?: 'default' | 'secondary' | 'outline'; className?: string }) => {
  const baseClasses = 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium';
  const variantClasses = {
    default: 'bg-blue-100 text-blue-800',
    secondary: 'bg-gray-100 text-gray-800',
    outline: 'border border-gray-300 text-gray-700'
  };
  
  return (
    <span className={`${baseClasses} ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  );
};

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
}

interface LocalAgentsButtonProps {
  city?: string;
  state?: string;
  className?: string;
}

export default function LocalAgentsButton({ 
  city = 'Memphis', 
  state = 'TN',
  className = '' 
}: LocalAgentsButtonProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAgents, setShowAgents] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchLocalAgents = async () => {
    // Input validation
    if (!city || !state) {
      setError('City and state are required');
      return;
    }
    
    if (city.length < 2 || state.length !== 2) {
      setError('Please enter a valid city and 2-letter state code');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const searchParams = new URLSearchParams({
        city: city.trim(),
        state: state.trim().toUpperCase(),
        limit: '6'
      });
      
      const response = await fetch(`/api/agents/search-live?${searchParams}`);
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Please log in to search for agents');
        } else if (response.status === 429) {
          throw new Error('Too many requests. Please try again in a moment');
        } else if (response.status >= 500) {
          throw new Error('Server error. Please try again later');
        }
        throw new Error(`Failed to search agents: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        const validAgents = (data.agents || []).filter((agent: Agent) => 
          agent.name && agent.name.trim() !== ''
        );
        
        setAgents(validAgents);
        setShowAgents(true);
        
        // Log successful search for analytics
        if (typeof window !== 'undefined' && (window as any).gtag) {
          (window as any).gtag('event', 'agent_search', {
            city: city,
            state: state,
            results_count: validAgents.length
          });
        }
      } else {
        throw new Error(data.error || 'Failed to search agents');
      }
    } catch (err: any) {
      console.error('Error searching agents:', err);
      
      // Set user-friendly error messages
      if (err.message.includes('network') || err.message.includes('fetch')) {
        setError('Network error. Please check your connection and try again.');
      } else if (err.message.includes('timeout')) {
        setError('Request timed out. Please try again.');
      } else {
        setError(err.message || 'Failed to search agents. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (showAgents) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Real Estate Agents in {city}, {state}
            </h2>
            <p className="text-gray-600 mt-1" aria-live="polite">
              Found {agents.length} top-rated agents near you
            </p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => {
              setShowAgents(false);
              setAgents([]);
            }}
          >
            Close
          </Button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4" role="alert">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          {agents.map((agent) => (
            <Card key={agent.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-start space-y-4 sm:space-y-0 sm:space-x-4">
                  {/* Agent Photo */}
                  <div className="flex-shrink-0 mx-auto sm:mx-0">
                    {agent.photo ? (
                      <img
                        src={agent.photo}
                        alt={agent.name}
                        className="w-16 h-16 rounded-full object-cover"
                      />
                    ) : (
                      <div 
                        className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center"
                        aria-label={`${agent.name} profile picture`}
                        role="img"
                      >
                        <Users className="w-8 h-8 text-gray-400" aria-hidden="true" />
                      </div>
                    )}
                  </div>

                  {/* Agent Info */}
                  <div className="flex-1 min-w-0 text-center sm:text-left">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between">
                      <div className="w-full">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-center sm:justify-start">
                          <h4 className="text-lg font-semibold text-gray-900">
                            {agent.name}
                          </h4>
                          {agent.isFeatured && (
                            <Badge variant="secondary" className="mt-1 sm:mt-0 sm:ml-2 mx-auto sm:mx-0 w-fit">
                              Top Rated
                            </Badge>
                          )}
                        </div>
                        
                        {/* Rating */}
                        <div className="flex items-center justify-center sm:justify-start mt-1">
                          <div className="flex items-center" aria-label={`Rating: ${agent.rating.toFixed(1)} out of 5 stars`}>
                            <Star className="w-4 h-4 text-yellow-400 fill-current" aria-hidden="true" />
                            <span className="ml-1 text-sm font-medium text-gray-900">
                              {agent.rating.toFixed(1)}
                            </span>
                          </div>
                          <span className="ml-2 text-sm text-gray-500">
                            ({agent.reviewCount} reviews)
                          </span>
                        </div>

                        {/* Address */}
                        <div className="flex items-center justify-center sm:justify-start mt-2 text-sm text-gray-600">
                          <MapPin className="w-4 h-4 mr-1 flex-shrink-0" aria-hidden="true" />
                          <span className="text-center sm:text-left" aria-label={`Located at ${agent.address}`}>
                            {agent.address}
                          </span>
                        </div>

                        {/* Specializations */}
                        <div className="flex flex-wrap gap-1 mt-2 justify-center sm:justify-start">
                          {agent.specializations.map((spec) => (
                            <Badge key={spec} variant="outline" className="text-xs">
                              {spec}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Contact Actions */}
                    <div className="flex flex-wrap gap-2 mt-4 justify-center sm:justify-start">
                      {agent.phone && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(`tel:${agent.phone}`, '_self')}
                          className="flex items-center"
                          aria-label={`Call ${agent.name} at ${agent.phone}`}
                        >
                          <Phone className="w-4 h-4 mr-1" aria-hidden="true" />
                          Call
                        </Button>
                      )}
                      
                      {agent.website && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(agent.website, '_blank')}
                          className="flex items-center"
                          aria-label={`Visit ${agent.name}'s website`}
                        >
                          <Globe className="w-4 h-4 mr-1" aria-hidden="true" />
                          Website
                        </Button>
                      )}
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(agent.googleMapsUrl, '_blank')}
                        className="flex items-center"
                        aria-label={`View ${agent.name} on Google Maps`}
                      >
                        <ExternalLink className="w-4 h-4 mr-1" aria-hidden="true" />
                        View on Maps
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {agents.length === 0 && !loading && !error && (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No agents found</h3>
            <p className="text-gray-600">
              Try searching in a different area or check back later.
            </p>
          </div>
        )}

        <div className="text-center">
          <Button
            variant="outline"
            onClick={searchLocalAgents}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Refreshing...
              </>
            ) : (
              'Refresh Results'
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`text-center ${className}`}>
      <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-lg p-8">
        <Users className="w-12 h-12 text-blue-600 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-gray-900 mb-2">
          Find Local Real Estate Agents
        </h3>
        <p className="text-gray-600 mb-6 max-w-md mx-auto">
          Connect with top-rated real estate professionals in {city}, {state}. 
          Get ratings, reviews, and contact information instantly.
        </p>
        
        <Button
          onClick={searchLocalAgents}
          disabled={loading}
          size="lg"
          className="bg-blue-600 hover:bg-blue-700 text-white focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Searching...
            </>
          ) : (
            <>
              <MapPin className="w-5 h-5 mr-2" />
              Check Out Your Local Agents
            </>
          )}
        </Button>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4" role="alert">
            <p className="text-red-700">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={searchLocalAgents}
              className="mt-2"
            >
              Try Again
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}