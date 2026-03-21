'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { BottomTabBar } from '@/components/navigation/BottomTabBar';
import { getBuyerTabs, getInvestorTabs, getRealtorTabs, getAdminTabs } from '@/components/navigation/tab-configs';
import { ExtendedSession } from '@/types/session';
import Chatbot from '@/components/ui/Chatbot';
import FloatingChatbotButton from '@/components/ui/FloatingChatbotButton';

function HelpBanner({ onOpenChat }: { onOpenChat: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem('helpBannerDismissed');
    if (dismissed) return undefined;

    // Only show for users who already completed (or skipped) the tutorial —
    // new users will see the tutorial first, no need to double up
    const tutorialDone = localStorage.getItem('buyerTutorialCompleted');
    if (!tutorialDone) return undefined;

    const timer = setTimeout(() => setVisible(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem('helpBannerDismissed', 'true');
  };

  if (!visible) return null;

  return (
    <div className="fixed top-14 left-0 right-0 z-[45] px-3 pt-2 md:px-0">
      <div className="max-w-md mx-auto bg-[#00BC7D]/95 backdrop-blur-sm rounded-xl px-3 py-2.5 flex items-center gap-2.5 shadow-lg border border-[#00BC7D]/30 animate-fadeInScale">
        <div className="flex-shrink-0 text-base">👩</div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-[13px] font-medium leading-snug">
            Need help? <button onClick={onOpenChat} className="underline font-bold">Chat with Sarah</button> — she can answer anything.
          </p>
        </div>
        <button
          onClick={dismiss}
          className="flex-shrink-0 text-white/70 hover:text-white active:text-white p-2.5 -mr-1"
          aria-label="Dismiss"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const userRole = (session as unknown as ExtendedSession)?.user?.role;
  const isAdmin = userRole === 'admin';
  const isRealtor = userRole === 'realtor';
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);
  const [chatPrefill, setChatPrefill] = useState<string | undefined>();

  // Determine investor status from profile, not just pathname
  const [isInvestor, setIsInvestor] = useState(pathname.startsWith('/dashboard/investor'));

  useEffect(() => {
    if (status !== 'authenticated' || isAdmin || isRealtor) return;

    fetch('/api/buyer/profile')
      .then(res => res.json())
      .then(data => {
        if (data.profile?.isInvestor === true) {
          setIsInvestor(true);
        }
      })
      .catch(() => {});
  }, [status, isAdmin, isRealtor]);

  // Listen for openChatbot events from child pages (e.g., liked page CTA)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.message) {
        setChatPrefill(detail.message);
      }
      setIsChatbotOpen(true);
    };
    window.addEventListener('openChatbot', handler);
    return () => window.removeEventListener('openChatbot', handler);
  }, []);

  const openChat = useCallback((prefill?: string) => {
    setChatPrefill(prefill);
    setIsChatbotOpen(true);
  }, []);

  // Admins always keep admin tabs so they can navigate back
  // Realtors always see realtor tabs (with Leads, Deals, Settings)
  const tabs = isAdmin
    ? getAdminTabs()
    : isRealtor
      ? getRealtorTabs()
      : isInvestor
        ? getInvestorTabs({ likedCount: 0 })
        : getBuyerTabs({ likedCount: 0 });

  return (
    <>
      {children}
      {/* Don't render tabs until session is loaded to avoid flashing wrong tabs */}
      {status !== 'loading' && <BottomTabBar tabs={tabs} />}

      {/* Help banner for new/confused users */}
      <HelpBanner onOpenChat={() => openChat()} />

      {/* Chatbot — available on all dashboard pages, pushed above mobile tab bar */}
      {isChatbotOpen ? (
        <Chatbot isOpen={isChatbotOpen} onClose={() => setIsChatbotOpen(false)} bottomClass="bottom-6 md:bottom-6 max-md:bottom-20" initialMessage={chatPrefill} />
      ) : (
        <FloatingChatbotButton onClick={(prefill) => openChat(prefill)} bottomClass="bottom-6 md:bottom-6 max-md:bottom-20" />
      )}
    </>
  );
}
