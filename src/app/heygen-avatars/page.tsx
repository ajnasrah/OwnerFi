export const dynamic = "force-dynamic";
'use client';

import React, { useState } from 'react';
import HeyGenAvatarSelector from '@/components/ui/HeyGenAvatarSelector';

export default function HeyGenAvatarsPage() {
  const [selectedAvatar, setSelectedAvatar] = useState<{ id: string; name: string } | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<{ id: string; name: string } | null>(null);

  const handleAvatarSelect = (avatarId: string, avatarName: string) => {
    setSelectedAvatar({ id: avatarId, name: avatarName });
    setSelectedPhoto(null);
    console.log('Selected Avatar:', { avatarId, avatarName });
  };

  const handlePhotoSelect = (photoId: string, photoName: string) => {
    setSelectedPhoto({ id: photoId, name: photoName });
    setSelectedAvatar(null);
    console.log('Selected Talking Photo:', { photoId, photoName });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">
            HeyGen Avatar Gallery
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Browse and select from our collection of AI avatars and talking photos to bring your content to life
          </p>
        </div>

        {/* Selection Display */}
        {(selectedAvatar || selectedPhoto) && (
          <div className="mb-8 bg-blue-50 border-2 border-blue-200 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-blue-600 uppercase tracking-wide mb-1">
                  Currently Selected
                </h3>
                <p className="text-2xl font-bold text-slate-900">
                  {selectedAvatar ? selectedAvatar.name : selectedPhoto?.name}
                </p>
                <p className="text-sm text-slate-600 mt-1">
                  {selectedAvatar ? (
                    <>Avatar ID: <code className="bg-white px-2 py-1 rounded">{selectedAvatar.id}</code></>
                  ) : (
                    <>Talking Photo ID: <code className="bg-white px-2 py-1 rounded">{selectedPhoto?.id}</code></>
                  )}
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedAvatar(null);
                  setSelectedPhoto(null);
                }}
                className="px-4 py-2 bg-white text-blue-600 border-2 border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
              >
                Clear Selection
              </button>
            </div>
          </div>
        )}

        {/* Avatar Selector Component */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <HeyGenAvatarSelector
            onSelectAvatar={handleAvatarSelect}
            onSelectTalkingPhoto={handlePhotoSelect}
          />
        </div>

        {/* Info Section */}
        <div className="mt-12 bg-white rounded-xl p-6 border border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">How to Use</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <h3 className="font-medium text-slate-800 mb-2">📸 Avatars</h3>
              <p className="text-sm text-slate-600">
                Professional AI avatars with realistic movements and expressions. Perfect for corporate presentations, educational content, and professional communications.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-slate-800 mb-2">🎭 Talking Photos</h3>
              <p className="text-sm text-slate-600">
                Transform any photo into a talking avatar. Great for personalized messages, social media content, and creative storytelling.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-slate-800 mb-2">🎙️ Voices</h3>
              <p className="text-sm text-slate-600">
                Choose from a variety of AI voices in multiple languages and genders. Add natural-sounding narration to your videos with emotion support.
              </p>
            </div>
          </div>
        </div>

        {/* API Info */}
        <div className="mt-8 bg-slate-50 rounded-xl p-6 border border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">Integration Info</h2>
          <div className="space-y-3">
            <div>
              <span className="text-sm font-medium text-slate-700">API Endpoint:</span>
              <code className="ml-2 text-sm bg-white px-3 py-1 rounded border border-slate-200">
                GET /api/heygen/avatars
              </code>
            </div>
            <div>
              <span className="text-sm font-medium text-slate-700">Component:</span>
              <code className="ml-2 text-sm bg-white px-3 py-1 rounded border border-slate-200">
                {`<HeyGenAvatarSelector />`}
              </code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
