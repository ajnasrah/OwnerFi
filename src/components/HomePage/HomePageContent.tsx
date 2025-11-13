'use client';

import { useState } from 'react';
import Link from 'next/link';
import HeroVideo from '@/components/ui/HeroVideo';
import { LanguageToggle } from '@/components/ui/LanguageToggle';
import { translations, Language, Translation } from '@/lib/translations';

interface HomePageContentProps {
  hasSession: boolean;
}

export function HomePageContent({ hasSession }: HomePageContentProps) {
  const [language, setLanguage] = useState<Language>('en');
  const t: Translation = translations[language];

  return (
    <>
      {/* Language Toggle - Fixed Position */}
      <LanguageToggle currentLanguage={language} onLanguageChange={setLanguage} />

      {/* SEO-Optimized Header */}
      <header>
        <nav className="bg-slate-800/50 backdrop-blur-lg border-b border-slate-700/50 px-4 lg:px-6 py-4" aria-label="Main navigation">
          <div className="flex justify-between items-center max-w-6xl mx-auto">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">O</span>
              </div>
              <span className="text-lg font-bold text-white">OwnerFi</span>
            </div>

            <div className="flex items-center gap-4">
              <Link
                href="/how-owner-finance-works"
                className="hidden sm:block text-slate-300 hover:text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {t.nav.howItWorks}
              </Link>
              {hasSession ? (
                <Link
                  href="/dashboard"
                  className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white px-4 py-2 rounded-xl font-semibold text-sm transition-all duration-300 hover:scale-105 shadow-lg shadow-emerald-500/25"
                >
                  {t.nav.goToDashboard}
                </Link>
              ) : (
                <Link
                  href="/auth/signin"
                  className="text-slate-300 hover:text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  {t.nav.signIn}
                </Link>
              )}
            </div>
          </div>
        </nav>
      </header>

      <main>
        {/* Section 1: Hero - Full Screen with CTA Only */}
        <section className="min-h-screen flex items-center justify-center px-4 py-16">
          <div className="max-w-7xl mx-auto w-full">
            <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
              {/* Left: Main Message */}
              <div className="text-center lg:text-left">
                {/* Trust Badge */}
                <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-3 py-1.5 mb-4">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                  <span className="text-emerald-400 text-xs font-semibold">{t.hero.trustBadge}</span>
                </div>

                <h1 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-black text-white leading-tight mb-4">
                  {t.hero.title1}
                  <span className="block text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-blue-400 to-purple-400">
                    {t.hero.title2}
                  </span>
                </h1>

                <p className="text-base sm:text-lg lg:text-xl text-slate-300 leading-relaxed mb-6 max-w-xl mx-auto lg:mx-0">
                  {t.hero.subtitle} <span className="text-white font-semibold">{t.hero.subtitleBold}</span> {t.hero.subtitleEnd}
                </p>

                {/* CTA Buttons - Large and Prominent */}
                <div className="flex flex-col gap-3 mb-6 max-w-md mx-auto lg:mx-0">
                  <Link
                    href="/signup"
                    className="group bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white px-6 py-3.5 rounded-xl font-bold text-base transition-all duration-300 hover:scale-[1.02] shadow-xl hover:shadow-2xl text-center flex items-center justify-center gap-2"
                    data-event="cta_click"
                    data-location="hero"
                  >
                    {t.hero.ctaPrimary}
                    <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </Link>

                  <Link
                    href="#how-it-works"
                    className="bg-slate-800/50 hover:bg-slate-700/50 border-2 border-slate-600 hover:border-slate-500 text-white px-6 py-3.5 rounded-xl font-semibold text-base transition-all duration-300 hover:scale-[1.02] text-center"
                  >
                    {t.hero.ctaSecondary}
                  </Link>
                </div>

                {/* Scroll Indicator */}
                <div className="text-center lg:text-left mt-8">
                  <p className="text-slate-400 text-sm mb-2">{t.hero.scrollText}</p>
                  <svg className="w-6 h-6 text-slate-400 animate-bounce mx-auto lg:mx-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>
              </div>

              {/* Right: App Preview / Phone Mockup */}
              <div className="relative">
                {/* Floating Stats */}
                <div className="absolute -top-8 -left-8 bg-slate-800/90 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-4 shadow-2xl z-10 animate-float">
                  <div className="text-3xl font-black text-emerald-400">500+</div>
                  <div className="text-slate-300 text-sm">{t.hero.stat1}</div>
                </div>

                <div className="absolute -bottom-8 -right-8 bg-slate-800/90 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-4 shadow-2xl z-10 animate-float-delayed">
                  <div className="text-3xl font-black text-blue-400">50</div>
                  <div className="text-slate-300 text-sm">{t.hero.stat2}</div>
                </div>

                {/* Phone Mockup */}
                <div className="relative mx-auto w-[320px] h-[640px]">
                  {/* Phone Frame */}
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900 rounded-[3rem] p-3 shadow-2xl border-4 border-slate-700">
                    {/* Notch */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-900 rounded-b-2xl" />

                    {/* Screen Content - App Demo Video */}
                    <div className="relative w-full h-full bg-slate-900 rounded-[2.5rem] overflow-hidden">
                      <HeroVideo />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent"></div>

        {/* Section 2: Why Choose Us / Benefits */}
        <section className="min-h-screen flex items-center justify-center py-16 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white mb-3">
                {t.whyChoose.title}
              </h2>
              <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto">
                {t.whyChoose.subtitle}
              </p>
            </div>

            <div className="grid sm:grid-cols-3 gap-6 mb-12">
              <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 text-center">
                <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-base font-bold text-white mb-2">{t.whyChoose.benefit1Title}</h3>
                <p className="text-sm text-slate-300">{t.whyChoose.benefit1Text}</p>
              </div>

              <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 text-center">
                <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-base font-bold text-white mb-2">{t.whyChoose.benefit2Title}</h3>
                <p className="text-sm text-slate-300">{t.whyChoose.benefit2Text}</p>
              </div>

              <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 text-center">
                <div className="w-12 h-12 bg-purple-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                </div>
                <h3 className="text-base font-bold text-white mb-2">{t.whyChoose.benefit3Title}</h3>
                <p className="text-sm text-slate-300">{t.whyChoose.benefit3Text}</p>
              </div>
            </div>

            {/* Social Media Caption */}
            <div className="p-4 bg-slate-800/30 border border-slate-700/50 rounded-xl text-center">
              <p className="text-slate-300 text-sm">
                {t.whyChoose.socialFollow}{' '}
                <a
                  href="https://www.tiktok.com/@ownerfi.ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 hover:text-emerald-300 font-semibold transition-colors"
                >
                  @OwnerFi.ai
                </a>
                {' '}{t.whyChoose.socialText}
              </p>
            </div>
          </div>
        </section>

        {/* Section Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent"></div>

        {/* Section 3: How It Works */}
        <section id="how-it-works" className="min-h-screen flex items-center justify-center py-16 px-4">
          <div className="max-w-4xl mx-auto w-full">
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white mb-3">
                {t.howItWorks.title}
              </h2>
              <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto">
                {t.howItWorks.subtitle}
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {/* Step 1 */}
              <div className="relative">
                <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-xl p-6 text-center h-full">
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center text-white font-black text-lg shadow-xl">
                    1
                  </div>
                  <div className="text-4xl mb-4 mt-2">📝</div>
                  <h3 className="text-base font-bold text-white mb-2">{t.howItWorks.step1Title}</h3>
                  <p className="text-sm text-slate-300">
                    {t.howItWorks.step1Text}
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="relative">
                <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-xl p-6 text-center h-full">
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-black text-lg shadow-xl">
                    2
                  </div>
                  <div className="text-4xl mb-4 mt-2">👆</div>
                  <h3 className="text-base font-bold text-white mb-2">{t.howItWorks.step2Title}</h3>
                  <p className="text-sm text-slate-300">
                    {t.howItWorks.step2Text}
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="relative">
                <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-xl p-6 text-center h-full">
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center text-white font-black text-lg shadow-xl">
                    3
                  </div>
                  <div className="text-4xl mb-4 mt-2">🏡</div>
                  <h3 className="text-base font-bold text-white mb-2">{t.howItWorks.step3Title}</h3>
                  <p className="text-sm text-slate-300">
                    {t.howItWorks.step3Text}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Continue with remaining sections using translations... */}
        {/* For brevity, I'll create a separate component file for the rest */}
      </main>
    </>
  );
}
