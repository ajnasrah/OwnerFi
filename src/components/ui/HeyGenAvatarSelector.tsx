'use client';

import React, { useState, useEffect } from 'react';
import { HeyGenAvatar, HeyGenTalkingPhoto, HeyGenAvatarsResponse } from '@/types/heygen';

interface HeyGenAvatarSelectorProps {
  onSelectAvatar?: (avatarId: string, avatarName: string) => void;
  onSelectTalkingPhoto?: (photoId: string, photoName: string) => void;
}

export default function HeyGenAvatarSelector({
  onSelectAvatar,
  onSelectTalkingPhoto
}: HeyGenAvatarSelectorProps) {
  const [avatars, setAvatars] = useState<HeyGenAvatar[]>([]);
  const [talkingPhotos, setTalkingPhotos] = useState<HeyGenTalkingPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<'avatars' | 'photos'>('avatars');
  const [selectedAvatarId, setSelectedAvatarId] = useState<string | null>(null);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);

  // Pagination states
  const [avatarPage, setAvatarPage] = useState(1);
  const [photoPage, setPhotoPage] = useState(1);
  const ITEMS_PER_PAGE = 50;

  // Filter states
  const [genderFilter, setGenderFilter] = useState<string>('all');
  const [ageFilter, setAgeFilter] = useState<string>('all');
  const [ethnicityFilter, setEthnicityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    fetchAvatars();
  }, []);

  const fetchAvatars = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/heygen/avatars');

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch avatars');
      }

      const data: HeyGenAvatarsResponse = await response.json();

      setAvatars(data.avatars || []);
      setTalkingPhotos(data.talking_photos || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAvatarSelect = (avatar: HeyGenAvatar) => {
    setSelectedAvatarId(avatar.avatar_id);
    onSelectAvatar?.(avatar.avatar_id, avatar.avatar_name);
  };

  const handlePhotoSelect = (photo: HeyGenTalkingPhoto) => {
    setSelectedPhotoId(photo.talking_photo_id);
    onSelectTalkingPhoto?.(photo.talking_photo_id, photo.talking_photo_name);
  };

  // Helper functions to extract age and ethnicity from avatar names
  // Note: These are estimates based on name patterns as HeyGen API doesn't provide this metadata
  const extractAge = (name: string): string => {
    const nameLower = name.toLowerCase();
    // Young indicators
    if (nameLower.includes('young') || nameLower.includes('teen') || nameLower.includes('kid') ||
        nameLower.includes('child') || nameLower.includes('youth')) return 'young';
    // Senior indicators
    if (nameLower.includes('senior') || nameLower.includes('elderly') || nameLower.includes('old') ||
        nameLower.includes('mature') || nameLower.includes('grandfather') || nameLower.includes('grandmother')) return 'senior';
    // Default to adult
    return 'adult';
  };

  const extractEthnicity = (name: string): string => {
    const nameLower = name.toLowerCase();
    const firstWord = name.split(' ')[0].toLowerCase();

    // Asian names and indicators
    const asianNames = ['aiko', 'kenji', 'yuki', 'sakura', 'mei', 'li', 'wei', 'jin', 'aditya', 'priya', 'raj'];
    if (asianNames.includes(firstWord) || nameLower.includes('asian') || nameLower.includes('chinese') ||
        nameLower.includes('japanese') || nameLower.includes('korean') || nameLower.includes('indian')) {
      return 'asian';
    }

    // Hispanic names and indicators
    const hispanicNames = ['carlos', 'maria', 'jose', 'juan', 'miguel', 'carmen', 'diego', 'sofia', 'pablo'];
    if (hispanicNames.includes(firstWord) || nameLower.includes('hispanic') || nameLower.includes('latino') ||
        nameLower.includes('latina') || nameLower.includes('spanish')) {
      return 'hispanic';
    }

    // African names and indicators
    const africanNames = ['jamal', 'kenya', 'malik', 'zuri', 'kofi', 'amara', 'kwame'];
    if (africanNames.includes(firstWord) || nameLower.includes('african') || nameLower.includes('black')) {
      return 'african';
    }

    // Middle Eastern names and indicators
    const middleEasternNames = ['omar', 'fatima', 'ali', 'hassan', 'aisha', 'mohammed', 'abdullah'];
    if (middleEasternNames.includes(firstWord) || nameLower.includes('middle eastern') ||
        nameLower.includes('arab') || nameLower.includes('persian')) {
      return 'middle-eastern';
    }

    // Default to caucasian (most common in the dataset)
    return 'caucasian';
  };

  // Filter avatars based on selected filters
  const filteredAvatars = avatars.filter(avatar => {
    // Gender filter
    if (genderFilter !== 'all' && avatar.gender !== genderFilter && avatar.gender !== 'unknown') {
      return false;
    }

    // Age filter
    if (ageFilter !== 'all') {
      const age = extractAge(avatar.avatar_name);
      if (age !== ageFilter) return false;
    }

    // Ethnicity filter
    if (ethnicityFilter !== 'all') {
      const ethnicity = extractEthnicity(avatar.avatar_name);
      if (ethnicity !== ethnicityFilter) return false;
    }

    // Search query
    if (searchQuery && !avatar.avatar_name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    return true;
  });

  // Filter talking photos
  const filteredTalkingPhotos = talkingPhotos.filter(photo => {
    if (searchQuery && !photo.talking_photo_name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  // Pagination logic
  const totalAvatarPages = Math.ceil(filteredAvatars.length / ITEMS_PER_PAGE);
  const totalPhotoPages = Math.ceil(filteredTalkingPhotos.length / ITEMS_PER_PAGE);

  const paginatedAvatars = filteredAvatars.slice(
    (avatarPage - 1) * ITEMS_PER_PAGE,
    avatarPage * ITEMS_PER_PAGE
  );

  const paginatedPhotos = filteredTalkingPhotos.slice(
    (photoPage - 1) * ITEMS_PER_PAGE,
    photoPage * ITEMS_PER_PAGE
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-600">Loading HeyGen avatars...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center gap-3 mb-3">
          <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-red-800 font-semibold">Error Loading Avatars</h3>
        </div>
        <p className="text-red-600 text-sm mb-3">{error}</p>
        <button
          onClick={fetchAvatars}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Tab Navigation */}
      <div className="flex border-b border-slate-200 mb-6">
        <button
          onClick={() => setSelectedTab('avatars')}
          className={`px-6 py-3 font-medium transition-colors relative ${
            selectedTab === 'avatars'
              ? 'text-blue-600'
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          Avatars ({avatars.length})
          {selectedTab === 'avatars' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
          )}
        </button>
        <button
          onClick={() => setSelectedTab('photos')}
          className={`px-6 py-3 font-medium transition-colors relative ${
            selectedTab === 'photos'
              ? 'text-blue-600'
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          Talking Photos ({talkingPhotos.length})
          {selectedTab === 'photos' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
          )}
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 bg-slate-50 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Search</label>
            <input
              type="text"
              placeholder="Search by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>

          {/* Gender Filter */}
          {selectedTab === 'avatars' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Gender</label>
              <select
                value={genderFilter}
                onChange={(e) => setGenderFilter(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                <option value="all">All Genders</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
          )}

          {/* Age Filter */}
          {selectedTab === 'avatars' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Age Range <span className="text-xs text-slate-500 font-normal">(estimated)</span>
              </label>
              <select
                value={ageFilter}
                onChange={(e) => setAgeFilter(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                <option value="all">All Ages</option>
                <option value="young">Young</option>
                <option value="adult">Adult</option>
                <option value="senior">Senior</option>
              </select>
            </div>
          )}

          {/* Ethnicity Filter */}
          {selectedTab === 'avatars' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Ethnicity <span className="text-xs text-slate-500 font-normal">(estimated)</span>
              </label>
              <select
                value={ethnicityFilter}
                onChange={(e) => setEthnicityFilter(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                <option value="all">All Ethnicities</option>
                <option value="caucasian">Caucasian</option>
                <option value="asian">Asian</option>
                <option value="african">African</option>
                <option value="hispanic">Hispanic</option>
                <option value="middle-eastern">Middle Eastern</option>
              </select>
            </div>
          )}
        </div>

        {/* Active Filters Display */}
        {(genderFilter !== 'all' || ageFilter !== 'all' || ethnicityFilter !== 'all' || searchQuery) && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-slate-600">Active filters:</span>
            {genderFilter !== 'all' && (
              <button
                onClick={() => setGenderFilter('all')}
                className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs hover:bg-blue-200"
              >
                Gender: {genderFilter}
                <span className="text-blue-500">×</span>
              </button>
            )}
            {ageFilter !== 'all' && (
              <button
                onClick={() => setAgeFilter('all')}
                className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs hover:bg-blue-200"
              >
                Age: {ageFilter}
                <span className="text-blue-500">×</span>
              </button>
            )}
            {ethnicityFilter !== 'all' && (
              <button
                onClick={() => setEthnicityFilter('all')}
                className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs hover:bg-blue-200"
              >
                Ethnicity: {ethnicityFilter}
                <span className="text-blue-500">×</span>
              </button>
            )}
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs hover:bg-blue-200"
              >
                Search: "{searchQuery}"
                <span className="text-blue-500">×</span>
              </button>
            )}
            <button
              onClick={() => {
                setGenderFilter('all');
                setAgeFilter('all');
                setEthnicityFilter('all');
                setSearchQuery('');
              }}
              className="text-xs text-slate-600 hover:text-slate-800 underline"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Avatars Tab */}
      {selectedTab === 'avatars' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
            {paginatedAvatars.length === 0 ? (
              <div className="col-span-full text-center py-8 text-slate-500">
                {avatars.length === 0 ? 'No avatars available' : 'No avatars match your filters'}
              </div>
            ) : (
              paginatedAvatars.map((avatar, index) => (
              <div
                key={`${avatar.avatar_id}-${index}`}
                onClick={() => handleAvatarSelect(avatar)}
                className={`relative group cursor-pointer rounded-xl overflow-hidden border-2 transition-all ${
                  selectedAvatarId === avatar.avatar_id
                    ? 'border-blue-500 shadow-lg'
                    : 'border-slate-200 hover:border-blue-300'
                }`}
              >
                {/* Preview Image */}
                <div className="aspect-[3/4] relative bg-slate-100">
                  <img
                    src={avatar.preview_image_url}
                    alt={avatar.avatar_name}
                    className="w-full h-full object-cover"
                  />

                  {/* Premium Badge */}
                  {avatar.premium && (
                    <div className="absolute top-1 right-1 bg-yellow-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-semibold">
                      Premium
                    </div>
                  )}

                  {/* Selected Checkmark */}
                  {selectedAvatarId === avatar.avatar_id && (
                    <div className="absolute top-1 left-1 bg-blue-500 text-white rounded-full p-0.5">
                      <svg className="w-2 h-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}

                  {/* Hover Overlay with Video Preview */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="text-center text-white">
                      <svg className="w-3 h-3 mx-auto mb-1" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                      <p className="text-xs">Preview</p>
                    </div>
                  </div>
                </div>

                {/* Avatar Info */}
                <div className="p-1.5 bg-white">
                  <h3 className="font-medium text-xs text-slate-800 truncate">{avatar.avatar_name}</h3>
                  <p className="text-xs text-slate-500 capitalize">{avatar.gender}</p>
                </div>
              </div>
            ))
          )}
          </div>

          {/* Pagination Controls for Avatars */}
          {totalAvatarPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => setAvatarPage(Math.max(1, avatarPage - 1))}
                disabled={avatarPage === 1}
                className="px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                Previous
              </button>
              <span className="text-sm text-slate-600">
                Page {avatarPage} of {totalAvatarPages} ({filteredAvatars.length} avatars)
              </span>
              <button
                onClick={() => setAvatarPage(Math.min(totalAvatarPages, avatarPage + 1))}
                disabled={avatarPage === totalAvatarPages}
                className="px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* Talking Photos Tab */}
      {selectedTab === 'photos' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
            {paginatedPhotos.length === 0 ? (
              <div className="col-span-full text-center py-8 text-slate-500">
                {talkingPhotos.length === 0 ? 'No talking photos available' : 'No talking photos match your search'}
              </div>
            ) : (
              paginatedPhotos.map((photo) => (
              <div
                key={photo.talking_photo_id}
                onClick={() => handlePhotoSelect(photo)}
                className={`relative group cursor-pointer rounded-xl overflow-hidden border-2 transition-all ${
                  selectedPhotoId === photo.talking_photo_id
                    ? 'border-blue-500 shadow-lg'
                    : 'border-slate-200 hover:border-blue-300'
                }`}
              >
                {/* Preview Image */}
                <div className="aspect-[3/4] relative bg-slate-100">
                  <img
                    src={photo.preview_image_url}
                    alt={photo.talking_photo_name}
                    className="w-full h-full object-cover"
                  />

                  {/* Selected Checkmark */}
                  {selectedPhotoId === photo.talking_photo_id && (
                    <div className="absolute top-1 left-1 bg-blue-500 text-white rounded-full p-0.5">
                      <svg className="w-2 h-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}

                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="text-center text-white">
                      <svg className="w-3 h-3 mx-auto mb-1" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                      <p className="text-xs">Select</p>
                    </div>
                  </div>
                </div>

                {/* Photo Info */}
                <div className="p-1.5 bg-white">
                  <h3 className="font-medium text-xs text-slate-800 truncate">{photo.talking_photo_name}</h3>
                  <p className="text-xs text-slate-500">Talking Photo</p>
                </div>
              </div>
            ))
          )}
          </div>

          {/* Pagination Controls for Talking Photos */}
          {totalPhotoPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => setPhotoPage(Math.max(1, photoPage - 1))}
                disabled={photoPage === 1}
                className="px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                Previous
              </button>
              <span className="text-sm text-slate-600">
                Page {photoPage} of {totalPhotoPages} ({filteredTalkingPhotos.length} photos)
              </span>
              <button
                onClick={() => setPhotoPage(Math.min(totalPhotoPages, photoPage + 1))}
                disabled={photoPage === totalPhotoPages}
                className="px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
