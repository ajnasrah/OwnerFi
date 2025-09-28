'use client'

import { useState } from 'react'
import Chatbot from '@/components/ui/ChatbotiPhone'
import FloatingChatbotButton from '@/components/ui/FloatingChatbotButton'

export default function HomePageClient() {
  const [isChatbotOpen, setIsChatbotOpen] = useState(false)

  return (
    <>
      {/* Chatbot Components */}
      {isChatbotOpen && (
        <Chatbot
          isChatbotOpen={isChatbotOpen}
          setIsChatbotOpen={setIsChatbotOpen}
        />
      )}
      <FloatingChatbotButton
        isChatbotOpen={isChatbotOpen}
        setIsChatbotOpen={setIsChatbotOpen}
      />
    </>
  )
}