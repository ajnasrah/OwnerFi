'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Buyer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  minPrice?: number;
  maxPrice: number;
  minBedrooms?: number;
  minBathrooms?: number;
  minSquareFeet?: number;
  preferredStates: string[];
  preferredCities?: string[];
  maxDownPayment: number;
  createdAt: string;
  hasBeenSold: boolean;
  matchedProperties: any[];
}

interface Agent {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  credits: number;
}

export default function AgentPortal() {
  const [currentAgent, setCurrentAgent] = useState<Agent | null>(null);
  const [availableLeads, setAvailableLeads] = useState<Buyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Registration form for new agents
  const [showRegistration, setShowRegistration] = useState(false);
  const [registrationData, setRegistrationData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    company: '',
    licenseNumber: '',
    serviceStates: [] as string[],
  });

  useEffect(() => {
    // For demo purposes, we'll simulate agent login
    // In production, this would use proper authentication
    const agentEmail = localStorage.getItem('agentEmail');
    if (agentEmail) {
      fetchAgentData(agentEmail);
    } else {
      setShowRegistration(true);
      setLoading(false);
    }
  }, []);

  const fetchAgentData = async (email: string) => {
    try {
      const response = await fetch(`/api/agent/profile?email=${encodeURIComponent(email)}`);
      const data = await response.json();
      
      if (data.agent) {
        setCurrentAgent(data.agent);
        fetchAvailableLeads();
      } else {
        setShowRegistration(true);
      }
    } catch (err) {
      setError('Failed to load agent data');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableLeads = async () => {
    try {
      const response = await fetch('/api/agent/leads');
      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
      } else {
        setAvailableLeads(data.leads || []);
      }
    } catch (err) {
      setError('Failed to load leads');
    }
  };

  const handleRegistration = async () => {
    if (!registrationData.firstName || !registrationData.lastName || !registrationData.email) {
      setError('Please fill in all required fields');
      return;
    }

    if (registrationData.serviceStates.length === 0) {
      setError('Please select at least one service state');
      return;
    }

    try {
      const response = await fetch('/api/agent/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registrationData),
      });

      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
      } else {
        localStorage.setItem('agentEmail', registrationData.email);
        setCurrentAgent(data.agent);
        setShowRegistration(false);
        fetchAvailableLeads();
        setError(null);
      }
    } catch (err) {
      setError('Registration failed');
    }
  };

  const handleStateChange = (state: string) => {
    setRegistrationData(prev => ({
      ...prev,
      serviceStates: prev.serviceStates.includes(state)
        ? prev.serviceStates.filter(s => s !== state)
        : [...prev.serviceStates, state]
    }));
  };

  const purchaseLead = async (buyerId: string) => {
    if (!currentAgent) return;
    
    const confirmed = window.confirm(
      'Purchase this lead for 1 credit? You will get the buyer\'s contact information and matched properties.'
    );
    
    if (!confirmed) return;

    try {
      const response = await fetch('/api/agent/purchase-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          agentId: currentAgent.id,
          buyerId: buyerId,
        }),
      });

      const data = await response.json();
      
      if (data.error) {
        alert('Error: ' + data.error);
      } else {
        alert('Lead purchased successfully! Check your email for buyer contact details.');
        // Update agent credits and remove purchased lead
        setCurrentAgent(prev => prev ? { ...prev, credits: prev.credits - 1 } : null);
        setAvailableLeads(prev => prev.filter(lead => lead.id !== buyerId));
      }
    } catch (err) {
      alert('Purchase failed. Please try again.');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading agent portal...</p>
        </div>
      </div>
    );
  }

  if (showRegistration) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            {/* Header */}
            <div className="bg-green-600 px-6 py-8 text-center">
              <div className="text-white">
                <h1 className="text-3xl font-bold mb-2">🏡 Agent Portal</h1>
                <p className="text-green-100">Register to access quality owner-finance leads</p>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">Agent Registration</h2>
              
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                  <div className="text-red-800 text-sm">{error}</div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={registrationData.firstName}
                    onChange={(e) => setRegistrationData(prev => ({ ...prev, firstName: e.target.value }))}
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                    placeholder="John"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={registrationData.lastName}
                    onChange={(e) => setRegistrationData(prev => ({ ...prev, lastName: e.target.value }))}
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                    placeholder="Smith"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={registrationData.email}
                  onChange={(e) => setRegistrationData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                  placeholder="john.smith@realty.com"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={registrationData.phone}
                    onChange={(e) => setRegistrationData(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                    placeholder="(555) 123-4567"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    License Number
                  </label>
                  <input
                    type="text"
                    value={registrationData.licenseNumber}
                    onChange={(e) => setRegistrationData(prev => ({ ...prev, licenseNumber: e.target.value }))}
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                    placeholder="TX-123456"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company
                </label>
                <input
                  type="text"
                  value={registrationData.company}
                  onChange={(e) => setRegistrationData(prev => ({ ...prev, company: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                  placeholder="ABC Realty"
                />
              </div>

              {/* Service States */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Service States * (Select all where you're licensed)
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {['TX', 'FL', 'GA'].map(state => (
                    <label key={state} className="flex items-center p-3 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={registrationData.serviceStates.includes(state)}
                        onChange={() => handleStateChange(state)}
                        className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm font-medium text-gray-700">
                        {state === 'TX' ? 'Texas' : state === 'FL' ? 'Florida' : 'Georgia'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                onClick={handleRegistration}
                className="w-full bg-green-600 text-white py-3 px-6 rounded-md hover:bg-green-700 transition-colors font-medium"
              >
                Register as Agent
              </button>

              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 mb-2">How It Works</h3>
                <ul className="text-blue-800 text-sm space-y-1">
                  <li>• View qualified buyer leads looking for owner-financed homes</li>
                  <li>• See exactly which properties they're matched to</li>
                  <li>• Purchase leads for 1 credit each</li>
                  <li>• Get full buyer contact info and property details</li>
                  <li>• Start with 5 free credits, then buy more as needed</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="text-center mt-6">
            <Link href="/" className="text-blue-600 hover:text-blue-700 text-sm">
              ← Back to Property Listings
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">🏡 Agent Portal</h1>
              <p className="text-gray-600 mt-1">
                Welcome back, {currentAgent?.firstName} {currentAgent?.lastName}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                💳 {currentAgent?.credits || 0} Credits
              </div>
              <Link
                href="/"
                className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
              >
                View Properties
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
            <div className="text-red-800">{error}</div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <div className="text-2xl">👥</div>
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-gray-900">{availableLeads.length}</div>
                <div className="text-gray-600">Available Leads</div>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg">
                <div className="text-2xl">💳</div>
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-gray-900">{currentAgent?.credits || 0}</div>
                <div className="text-gray-600">Credits Remaining</div>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-lg">
                <div className="text-2xl">🏠</div>
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-gray-900">
                  {availableLeads.reduce((total, lead) => total + lead.matchedProperties.length, 0)}
                </div>
                <div className="text-gray-600">Total Property Matches</div>
              </div>
            </div>
          </div>
        </div>

        {/* Available Leads */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Available Buyer Leads</h2>
            <p className="text-gray-600 text-sm mt-1">
              Purchase leads for 1 credit each to get full buyer contact information
            </p>
          </div>

          {availableLeads.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 text-6xl mb-4">👥</div>
              <p className="text-gray-600">No available leads at this time.</p>
              <p className="text-sm text-gray-500 mt-2">
                New buyer leads will appear here as they register.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {availableLeads.map((lead) => (
                <div key={lead.id} className="p-6 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      {/* Buyer Info */}
                      <div className="flex items-center mb-3">
                        <div className="bg-blue-100 rounded-full h-10 w-10 flex items-center justify-center">
                          <span className="text-blue-600 font-medium">
                            {lead.firstName[0]}{lead.lastName[0]}
                          </span>
                        </div>
                        <div className="ml-3">
                          <div className="font-medium text-gray-900">
                            {lead.firstName} {lead.lastName[0]}.
                          </div>
                          <div className="text-sm text-gray-500">
                            Registered {formatDate(lead.createdAt)}
                          </div>
                        </div>
                      </div>

                      {/* Search Criteria */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                          <div className="text-sm font-medium text-gray-700">Budget</div>
                          <div className="text-sm text-gray-600">
                            {lead.minPrice ? formatCurrency(lead.minPrice) : 'Any'} - {formatCurrency(lead.maxPrice)}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-700">Down Payment</div>
                          <div className="text-sm text-gray-600">
                            Up to {formatCurrency(lead.maxDownPayment)}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-700">Location</div>
                          <div className="text-sm text-gray-600">
                            {lead.preferredStates.join(', ')}
                            {lead.preferredCities && lead.preferredCities.length > 0 && 
                              ` (${lead.preferredCities.join(', ')})`
                            }
                          </div>
                        </div>
                      </div>

                      {/* Property Requirements */}
                      <div className="flex items-center space-x-4 text-sm text-gray-600 mb-4">
                        {lead.minBedrooms && <span>{lead.minBedrooms}+ bed</span>}
                        {lead.minBathrooms && <span>{lead.minBathrooms}+ bath</span>}
                        {lead.minSquareFeet && <span>{lead.minSquareFeet.toLocaleString()}+ sqft</span>}
                      </div>

                      {/* Matched Properties Preview */}
                      <div className="bg-gray-50 rounded-lg p-3 mb-4">
                        <div className="text-sm font-medium text-gray-700 mb-2">
                          📋 Matched to {lead.matchedProperties.length} Properties:
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-600">
                          {lead.matchedProperties.slice(0, 4).map((property, index) => (
                            <div key={index} className="flex justify-between">
                              <span>{property.address}, {property.city}</span>
                              <span>{formatCurrency(property.listPrice)}</span>
                            </div>
                          ))}
                          {lead.matchedProperties.length > 4 && (
                            <div className="col-span-full text-center text-gray-500">
                              +{lead.matchedProperties.length - 4} more properties
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Purchase Button */}
                    <div className="ml-6">
                      <button
                        onClick={() => purchaseLead(lead.id)}
                        disabled={(currentAgent?.credits || 0) < 1}
                        className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
                      >
                        Purchase Lead
                        <div className="text-xs opacity-90 mt-1">1 Credit</div>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Credit Purchase CTA */}
        {(currentAgent?.credits || 0) < 3 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mt-6">
            <div className="flex items-center">
              <div className="text-yellow-600 text-2xl mr-3">⚡</div>
              <div>
                <div className="font-medium text-yellow-800">Running low on credits?</div>
                <div className="text-yellow-700 text-sm">Purchase more credits to continue accessing quality leads.</div>
              </div>
              <button className="ml-auto bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700">
                Buy Credits
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}