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

    // No-Bank Options Section
    document.querySelectorAll('[data-translate="noBankOptions.title"]').forEach(el => {
      el.textContent = t.noBankOptions.title
    })
    document.querySelectorAll('[data-translate="noBankOptions.subtitle"]').forEach(el => {
      el.textContent = t.noBankOptions.subtitle
    })
    document.querySelectorAll('[data-translate="noBankOptions.option1Title"]').forEach(el => {
      el.textContent = t.noBankOptions.option1Title
    })
    document.querySelectorAll('[data-translate="noBankOptions.option1Point1"]').forEach(el => {
      el.textContent = t.noBankOptions.option1Point1
    })
    document.querySelectorAll('[data-translate="noBankOptions.option1Point2"]').forEach(el => {
      el.textContent = t.noBankOptions.option1Point2
    })
    document.querySelectorAll('[data-translate="noBankOptions.option1Point3"]').forEach(el => {
      el.textContent = t.noBankOptions.option1Point3
    })
    document.querySelectorAll('[data-translate="noBankOptions.option1Point4"]').forEach(el => {
      el.textContent = t.noBankOptions.option1Point4
    })
    document.querySelectorAll('[data-translate="noBankOptions.option2Title"]').forEach(el => {
      el.textContent = t.noBankOptions.option2Title
    })
    document.querySelectorAll('[data-translate="noBankOptions.option2Point1"]').forEach(el => {
      el.textContent = t.noBankOptions.option2Point1
    })
    document.querySelectorAll('[data-translate="noBankOptions.option2Point2"]').forEach(el => {
      el.textContent = t.noBankOptions.option2Point2
    })
    document.querySelectorAll('[data-translate="noBankOptions.option2Point3"]').forEach(el => {
      el.textContent = t.noBankOptions.option2Point3
    })
    document.querySelectorAll('[data-translate="noBankOptions.option2Point4"]').forEach(el => {
      el.textContent = t.noBankOptions.option2Point4
    })
    document.querySelectorAll('[data-translate="noBankOptions.option3Title"]').forEach(el => {
      el.textContent = t.noBankOptions.option3Title
    })
    document.querySelectorAll('[data-translate="noBankOptions.option3Point1"]').forEach(el => {
      el.textContent = t.noBankOptions.option3Point1
    })
    document.querySelectorAll('[data-translate="noBankOptions.option3Point2"]').forEach(el => {
      el.textContent = t.noBankOptions.option3Point2
    })
    document.querySelectorAll('[data-translate="noBankOptions.option3Point3"]').forEach(el => {
      el.textContent = t.noBankOptions.option3Point3
    })
    document.querySelectorAll('[data-translate="noBankOptions.option3Point4"]').forEach(el => {
      el.textContent = t.noBankOptions.option3Point4
    })
    document.querySelectorAll('[data-translate="noBankOptions.option4Title"]').forEach(el => {
      el.textContent = t.noBankOptions.option4Title
    })
    document.querySelectorAll('[data-translate="noBankOptions.option4Point1"]').forEach(el => {
      el.textContent = t.noBankOptions.option4Point1
    })
    document.querySelectorAll('[data-translate="noBankOptions.option4Point2"]').forEach(el => {
      el.textContent = t.noBankOptions.option4Point2
    })
    document.querySelectorAll('[data-translate="noBankOptions.option4Point3"]').forEach(el => {
      el.textContent = t.noBankOptions.option4Point3
    })
    document.querySelectorAll('[data-translate="noBankOptions.option4Point4"]').forEach(el => {
      el.textContent = t.noBankOptions.option4Point4
    })
    document.querySelectorAll('[data-translate="noBankOptions.specialtyText"]').forEach(el => {
      el.textContent = t.noBankOptions.specialtyText
    })
    document.querySelectorAll('[data-translate="noBankOptions.specialtyDescription"]').forEach(el => {
      el.textContent = t.noBankOptions.specialtyDescription
    })
    document.querySelectorAll('[data-translate="noBankOptions.learnMore"]').forEach(el => {
      el.textContent = t.noBankOptions.learnMore
    })

    // Benefits Section
    document.querySelectorAll('[data-translate="benefits.title"]').forEach(el => {
      el.textContent = t.benefits.title
    })
    document.querySelectorAll('[data-translate="benefits.benefit1Title"]').forEach(el => {
      el.textContent = t.benefits.benefit1Title
    })
    document.querySelectorAll('[data-translate="benefits.benefit1Text"]').forEach(el => {
      el.textContent = t.benefits.benefit1Text
    })
    document.querySelectorAll('[data-translate="benefits.benefit2Title"]').forEach(el => {
      el.textContent = t.benefits.benefit2Title
    })
    document.querySelectorAll('[data-translate="benefits.benefit2Text"]').forEach(el => {
      el.textContent = t.benefits.benefit2Text
    })
    document.querySelectorAll('[data-translate="benefits.benefit3Title"]').forEach(el => {
      el.textContent = t.benefits.benefit3Title
    })
    document.querySelectorAll('[data-translate="benefits.benefit3Text"]').forEach(el => {
      el.textContent = t.benefits.benefit3Text
    })
    document.querySelectorAll('[data-translate="benefits.benefit4Title"]').forEach(el => {
      el.textContent = t.benefits.benefit4Title
    })
    document.querySelectorAll('[data-translate="benefits.benefit4Text"]').forEach(el => {
      el.textContent = t.benefits.benefit4Text
    })

    // Locations Section
    document.querySelectorAll('[data-translate="locations.title"]').forEach(el => {
      el.textContent = t.locations.title
    })
    document.querySelectorAll('[data-translate="locations.texasSubtitle"]').forEach(el => {
      el.textContent = t.locations.texasSubtitle
    })
    document.querySelectorAll('[data-translate="locations.texasProperties"]').forEach(el => {
      el.textContent = t.locations.texasProperties
    })
    document.querySelectorAll('[data-translate="locations.floridaSubtitle"]').forEach(el => {
      el.textContent = t.locations.floridaSubtitle
    })
    document.querySelectorAll('[data-translate="locations.floridaProperties"]').forEach(el => {
      el.textContent = t.locations.floridaProperties
    })
    document.querySelectorAll('[data-translate="locations.georgiaSubtitle"]').forEach(el => {
      el.textContent = t.locations.georgiaSubtitle
    })
    document.querySelectorAll('[data-translate="locations.georgiaProperties"]').forEach(el => {
      el.textContent = t.locations.georgiaProperties
    })
    document.querySelectorAll('[data-translate="locations.nationwideTitle"]').forEach(el => {
      el.textContent = t.locations.nationwideTitle
    })
    document.querySelectorAll('[data-translate="locations.nationwideSubtitle"]').forEach(el => {
      el.textContent = t.locations.nationwideSubtitle
    })
    document.querySelectorAll('[data-translate="locations.viewAllCta"]').forEach(el => {
      el.textContent = t.locations.viewAllCta
    })
    document.querySelectorAll('[data-translate="locations.alternativeTitle"]').forEach(el => {
      el.textContent = t.locations.alternativeTitle
    })
    document.querySelectorAll('[data-translate="locations.rentToOwnTitle"]').forEach(el => {
      el.textContent = t.locations.rentToOwnTitle
    })
    document.querySelectorAll('[data-translate="locations.rentToOwnText"]').forEach(el => {
      el.textContent = t.locations.rentToOwnText
    })
    document.querySelectorAll('[data-translate="locations.badCreditTitle"]').forEach(el => {
      el.textContent = t.locations.badCreditTitle
    })
    document.querySelectorAll('[data-translate="locations.badCreditText"]').forEach(el => {
      el.textContent = t.locations.badCreditText
    })
    document.querySelectorAll('[data-translate="locations.noCreditTitle"]').forEach(el => {
      el.textContent = t.locations.noCreditTitle
    })
    document.querySelectorAll('[data-translate="locations.noCreditText"]').forEach(el => {
      el.textContent = t.locations.noCreditText
    })
  }, [language])

  return (
    <>
      {/* Language Toggle Button */}
      <LanguageToggle currentLanguage={language} onLanguageChange={setLanguage} />

      {/* Chatbot Components */}
      {isChatbotOpen ? (
        <Chatbot
          isOpen={isChatbotOpen}
          onClose={() => setIsChatbotOpen(false)}
        />
      ) : (
        <FloatingChatbotButton
          onClick={() => setIsChatbotOpen(true)}
        />
      )}
    </>
  )
}