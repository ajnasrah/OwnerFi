'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { X, Users, ArrowRight, MapPin, Star } from 'lucide-react';

interface RealtorDiscoveryCardProps {
  city?: string;
  state?: string;
  onClose: () => void;
  onExplore: () => void;
}

export function RealtorDiscoveryCard({ 
  city = 'Memphis', 
  state = 'TN',
  onClose, 
  onExplore 
}: RealtorDiscoveryCardProps) {
  const [isMinimized, setIsMinimized] = useState(false);

  if (isMinimized) {
    return (
      <div className="fixed bottom-20 md:bottom-4 right-4 z-40">
        <button
          onClick={() => setIsMinimized(false)}
          className="bg-blue-600 text-white rounded-full p-3 shadow-xl hover:bg-blue-700 transition-all"
        >
          <Users className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-20 md:bottom-4 right-4 z-40 max-w-sm">
      <Card className="bg-gradient-to-br from-blue-50 to-green-50 border-blue-200 shadow-xl">
        <div className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center space-x-2">
              <div className="bg-blue-100 rounded-full p-2">
                <Users className="w-4 h-4 text-blue-600" />
              </div>
              <h3 className="font-bold text-gray-900 text-sm">Looking for a realtor?</h3>
            </div>
            <div className="flex space-x-1">
              <button 
                onClick={() => setIsMinimized(true)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <span className="text-xs">−</span>
              </button>
              <button 
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="space-y-3">
            <p className="text-gray-700 text-sm">
              We found top-rated real estate agents in your area who can help you with your home buying journey.
            </p>

            {/* Quick Preview */}
            <div className="bg-white rounded-lg p-3 border border-blue-100">
              <div className="flex items-center space-x-2">
                <MapPin className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-900">{city}, {state}</span>
              </div>
              <div className="flex items-center space-x-2 mt-1">
                <Star className="w-4 h-4 text-yellow-400 fill-current" />
                <span className="text-sm text-gray-600">Top-rated professionals</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={onClose}
                className="flex-1 text-xs"
              >
                Maybe Later
              </Button>
              <Button 
                size="sm"
                onClick={onExplore}
                className="flex-1 text-xs bg-blue-600 hover:bg-blue-700"
              >
                Find Realtors <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}