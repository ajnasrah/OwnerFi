'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { BottomTabBar } from '@/components/navigation/BottomTabBar';
import { getBuyerTabs, getInvestorTabs, getRealtorTabs, getAdminTabs } from '@/components/navigation/tab-configs';
import { ExtendedSession } from '@/types/session';
import Chatbot from '@/components/ui/Chatbot';
import FloatingChatbotButton from '@/components/ui/FloatingChatbotButton';

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

      {/* Chatbot — available on all dashboard pages, pushed above mobile tab bar */}
      {isChatbotOpen ? (
        <Chatbot isOpen={isChatbotOpen} onClose={() => setIsChatbotOpen(false)} bottomClass="bottom-6 md:bottom-6 max-md:bottom-20" initialMessage={chatPrefill} />
      ) : (
        <FloatingChatbotButton onClick={(prefill) => { setChatPrefill(prefill); setIsChatbotOpen(true); }} bottomClass="bottom-6 md:bottom-6 max-md:bottom-20" />
      )}
    </>
  );
}
