'use client'

import { useState, useEffect } from 'react'
import Chatbot from '@/components/ui/ChatbotiPhone'
import FloatingChatbotButton from '@/components/ui/FloatingChatbotButton'
import { LanguageToggle } from '@/components/ui/LanguageToggle'
import { Language, translations } from '@/lib/translations'

export default function HomePageClient() {
  const [isChatbotOpen, setIsChatbotOpen] = useState(false)
  const [language, setLanguage] = useState<Language>('en')

  // Apply translations to the page when language changes
  useEffect(() => {
    const t = translations[language]

    // Update all translatable elements on the page
    // Navigation
    document.querySelectorAll('[data-translate="nav.howItWorks"]').forEach(el => {
      el.textContent = t.nav.howItWorks
    })
    document.querySelectorAll('[data-translate="nav.signIn"]').forEach(el => {
      el.textContent = t.nav.signIn
    })
    document.querySelectorAll('[data-translate="nav.goToDashboard"]').forEach(el => {
      el.textContent = t.nav.goToDashboard
    })

    // Hero Section
    document.querySelectorAll('[data-translate="hero.trustBadge"]').forEach(el => {
      el.textContent = t.hero.trustBadge
    })
    document.querySelectorAll('[data-translate="hero.title1"]').forEach(el => {
      el.textContent = t.hero.title1
    })
    document.querySelectorAll('[data-translate="hero.title2"]').forEach(el => {
      el.textContent = t.hero.title2
    })
    document.querySelectorAll('[data-translate="hero.subtitle"]').forEach(el => {
      el.textContent = t.hero.subtitle
    })
    document.querySelectorAll('[data-translate="hero.subtitleBold"]').forEach(el => {
      el.textContent = t.hero.subtitleBold
    })
    document.querySelectorAll('[data-translate="hero.subtitleEnd"]').forEach(el => {
      el.textContent = t.hero.subtitleEnd
    })
    document.querySelectorAll('[data-translate="hero.ctaPrimary"]').forEach(el => {
      el.textContent = t.hero.ctaPrimary
    })
    document.querySelectorAll('[data-translate="hero.ctaSecondary"]').forEach(el => {
      el.textContent = t.hero.ctaSecondary
    })
    document.querySelectorAll('[data-translate="hero.scrollText"]').forEach(el => {
      el.textContent = t.hero.scrollText
    })
    document.querySelectorAll('[data-translate="hero.stat1"]').forEach(el => {
      el.textContent = t.hero.stat1
    })
    document.querySelectorAll('[data-translate="hero.stat2"]').forEach(el => {
      el.textContent = t.hero.stat2
    })

    // Why Choose Section
    document.querySelectorAll('[data-translate="whyChoose.title"]').forEach(el => {
      el.textContent = t.whyChoose.title
    })
    document.querySelectorAll('[data-translate="whyChoose.subtitle"]').forEach(el => {
      el.textContent = t.whyChoose.subtitle
    })
    document.querySelectorAll('[data-translate="whyChoose.benefit1Title"]').forEach(el => {
      el.textContent = t.whyChoose.benefit1Title
    })
    document.querySelectorAll('[data-translate="whyChoose.benefit1Text"]').forEach(el => {
      el.textContent = t.whyChoose.benefit1Text
    })
    document.querySelectorAll('[data-translate="whyChoose.benefit2Title"]').forEach(el => {
      el.textContent = t.whyChoose.benefit2Title
    })
    document.querySelectorAll('[data-translate="whyChoose.benefit2Text"]').forEach(el => {
      el.textContent = t.whyChoose.benefit2Text
    })
    document.querySelectorAll('[data-translate="whyChoose.benefit3Title"]').forEach(el => {
      el.textContent = t.whyChoose.benefit3Title
    })
    document.querySelectorAll('[data-translate="whyChoose.benefit3Text"]').forEach(el => {
      el.textContent = t.whyChoose.benefit3Text
    })
    document.querySelectorAll('[data-translate="whyChoose.socialFollow"]').forEach(el => {
      el.textContent = t.whyChoose.socialFollow
    })
    document.querySelectorAll('[data-translate="whyChoose.socialText"]').forEach(el => {
      el.textContent = t.whyChoose.socialText
    })

    // How It Works Section
    document.querySelectorAll('[data-translate="howItWorks.title"]').forEach(el => {
      el.textContent = t.howItWorks.title
    })
    document.querySelectorAll('[data-translate="howItWorks.subtitle"]').forEach(el => {
      el.textContent = t.howItWorks.subtitle
    })
    document.querySelectorAll('[data-translate="howItWorks.step1Title"]').forEach(el => {
      el.textContent = t.howItWorks.step1Title
    })
    document.querySelectorAll('[data-translate="howItWorks.step1Text"]').forEach(el => {
      el.textContent = t.howItWorks.step1Text
    })
    document.querySelectorAll('[data-translate="howItWorks.step2Title"]').forEach(el => {
      el.textContent = t.howItWorks.step2Title
    })
    document.querySelectorAll('[data-translate="howItWorks.step2Text"]').forEach(el => {
      el.textContent = t.howItWorks.step2Text
    })
    document.querySelectorAll('[data-translate="howItWorks.step3Title"]').forEach(el => {
      el.textContent = t.howItWorks.step3Title
    })
    document.querySelectorAll('[data-translate="howItWorks.step3Text"]').forEach(el => {
      el.textContent = t.howItWorks.step3Text
    })

    // Testimonials Section
    document.querySelectorAll('[data-translate="testimonials.title"]').forEach(el => {
      el.textContent = t.testimonials.title
    })
    document.querySelectorAll('[data-translate="testimonials.subtitle"]').forEach(el => {
      el.textContent = t.testimonials.subtitle
    })
    document.querySelectorAll('[data-translate="testimonials.testimonial1"]').forEach(el => {
      el.textContent = t.testimonials.testimonial1
    })
    document.querySelectorAll('[data-translate="testimonials.name1"]').forEach(el => {
      el.textContent = t.testimonials.name1
    })
    document.querySelectorAll('[data-translate="testimonials.location1"]').forEach(el => {
      el.textContent = t.testimonials.location1
    })
    document.querySelectorAll('[data-translate="testimonials.testimonial2"]').forEach(el => {
      el.textContent = t.testimonials.testimonial2
    })
    document.querySelectorAll('[data-translate="testimonials.name2"]').forEach(el => {
      el.textContent = t.testimonials.name2
    })
    document.querySelectorAll('[data-translate="testimonials.location2"]').forEach(el => {
      el.textContent = t.testimonials.location2
    })
    document.querySelectorAll('[data-translate="testimonials.testimonial3"]').forEach(el => {
      el.textContent = t.testimonials.testimonial3
    })
    document.querySelectorAll('[data-translate="testimonials.name3"]').forEach(el => {
      el.textContent = t.testimonials.name3
    })
    document.querySelectorAll('[data-translate="testimonials.location3"]').forEach(el => {
      el.textContent = t.testimonials.location3
    })
    document.querySelectorAll('[data-translate="testimonials.stat1"]').forEach(el => {
      el.textContent = t.testimonials.stat1
    })
    document.querySelectorAll('[data-translate="testimonials.stat2"]').forEach(el => {
      el.textContent = t.testimonials.stat2
    })
    document.querySelectorAll('[data-translate="testimonials.stat3"]').forEach(el => {
      el.textContent = t.testimonials.stat3
    })
    document.querySelectorAll('[data-translate="testimonials.stat4"]').forEach(el => {
      el.textContent = t.testimonials.stat4
    })
  }, [language])

  return (
    <>
      {/* Language Toggle Button */}
      <LanguageToggle currentLanguage={language} onLanguageChange={setLanguage} />

      {/* Chatbot Components */}
      {isChatbotOpen && (
        <Chatbot
          isOpen={isChatbotOpen}
          onClose={() => setIsChatbotOpen(false)}
        />
      )}
      <FloatingChatbotButton
        onClick={() => {
          console.log('Chatbot button clicked, current state:', isChatbotOpen)
          setIsChatbotOpen(!isChatbotOpen)
        }}
      />
    </>
  )
}