'use client';

import { useState } from 'react';
import { BottomTabBar } from '@/components/navigation/BottomTabBar';
import { getRealtorTabs } from '@/components/navigation/tab-configs';
import Chatbot from '@/components/ui/Chatbot';
import FloatingChatbotButton from '@/components/ui/FloatingChatbotButton';

export default function RealtorDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);
  const [chatPrefill, setChatPrefill] = useState<string | undefined>();

  return (
    <>
      {children}
      <BottomTabBar tabs={getRealtorTabs()} />

      {/* Chatbot — available on realtor dashboard, pushed above mobile tab bar */}
      {isChatbotOpen ? (
        <Chatbot isOpen={isChatbotOpen} onClose={() => setIsChatbotOpen(false)} bottomClass="bottom-6 md:bottom-6 max-md:bottom-20" initialMessage={chatPrefill} />
      ) : (
        <FloatingChatbotButton onClick={(prefill) => { setChatPrefill(prefill); setIsChatbotOpen(true); }} bottomClass="bottom-6 md:bottom-6 max-md:bottom-20" />
      )}
    </>
  );
}
