'use client';

import { useEffect, useState, useCallback } from 'react';

interface Deal {
  id: string;
  address: string;
  city: string;
  state: string;
  price: number;
  zestimate: number;
  percentOfArv: number;
  url: string;
  addedAt: string;
}

const POLL_INTERVAL = 30000; // Check every 30 seconds
const CLIENT_ID = typeof window !== 'undefined' ? `client_${Date.now()}` : 'server';

// Generate a notification beep using Web Audio API
function playNotificationSound() {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);

    // Play a second beep
    setTimeout(() => {
      const osc2 = audioContext.createOscillator();
      const gain2 = audioContext.createGain();
      osc2.connect(gain2);
      gain2.connect(audioContext.destination);
      osc2.frequency.value = 1000;
      osc2.type = 'sine';
      gain2.gain.setValueAtTime(0.3, audioContext.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      osc2.start(audioContext.currentTime);
      osc2.stop(audioContext.currentTime + 0.3);
    }, 150);
  } catch (e) {
    console.log('Could not play notification sound');
  }
}

export default function DealAlerts() {
  const [newDeals, setNewDeals] = useState<Deal[]>([]);
  const [showToast, setShowToast] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);

      if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          setNotificationPermission(permission);
        });
      }
    }
  }, []);

  // Show browser notification
  const showBrowserNotification = useCallback((deals: Deal[]) => {
    if (notificationPermission !== 'granted') return;

    const title = `${deals.length} New Deal${deals.length > 1 ? 's' : ''} Found!`;
    const body = deals.map(d => `${d.address} - ${d.percentOfArv}% ARV ($${d.price.toLocaleString()})`).join('\n');

    const notification = new Notification(title, {
      body,
      icon: '/favicon.ico',
      tag: 'deal-alert',
      requireInteraction: true,
    });

    notification.onclick = () => {
      window.focus();
      if (deals.length === 1) {
        window.open(deals[0].url, '_blank');
      }
      notification.close();
    };

    // Play sound
    playNotificationSound();
  }, [notificationPermission]);

  // Poll for new deals
  useEffect(() => {
    const checkForDeals = async () => {
      try {
        const res = await fetch(`/api/admin/deal-alerts?clientId=${CLIENT_ID}&lookback=5`);
        const data = await res.json();

        if (data.deals && data.deals.length > 0) {
          setNewDeals(data.deals);
          setShowToast(true);
          showBrowserNotification(data.deals);
        }
      } catch (error) {
        console.error('[DealAlerts] Error checking for deals:', error);
      }
    };

    // Initial check after 5 seconds (give page time to load)
    const initialTimeout = setTimeout(checkForDeals, 5000);

    // Then poll every 30 seconds
    const interval = setInterval(checkForDeals, POLL_INTERVAL);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [showBrowserNotification]);

  // Auto-hide toast after 30 seconds
  useEffect(() => {
    if (showToast) {
      const timeout = setTimeout(() => setShowToast(false), 30000);
      return () => clearTimeout(timeout);
    }
  }, [showToast]);

  if (!showToast || newDeals.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md animate-slide-in">
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 rounded-lg shadow-2xl border border-emerald-500 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-emerald-800/50">
          <div className="flex items-center gap-2">
            <span className="text-2xl animate-pulse">🔔</span>
            <span className="font-bold text-white">
              {newDeals.length} New Deal{newDeals.length > 1 ? 's' : ''} Found!
            </span>
          </div>
          <button
            onClick={() => setShowToast(false)}
            className="text-emerald-200 hover:text-white p-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Deals list */}
        <div className="max-h-80 overflow-y-auto">
          {newDeals.map((deal) => (
            <a
              key={deal.id}
              href={deal.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block px-4 py-3 hover:bg-emerald-600/50 border-t border-emerald-500/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-white truncate">{deal.address}</div>
                  <div className="text-sm text-emerald-200">{deal.city}, {deal.state}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-lg font-bold text-yellow-300">{deal.percentOfArv}%</div>
                  <div className="text-xs text-emerald-200">${deal.price.toLocaleString()}</div>
                </div>
              </div>
            </a>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-emerald-800/50 text-center">
          <span className="text-xs text-emerald-200">
            Memphis area • Under 80% ARV • Click to view on Zillow
          </span>
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
