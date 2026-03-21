'use client';

import { useState, useEffect, useRef } from 'react';
import { trackEvent } from '@/components/analytics/AnalyticsProvider';

interface TutorialProps {
  onComplete: () => void;
  isVisible: boolean;
}

const tutorialSteps = [
  {
    title: "Welcome to Ownerfi",
    subtitle: "Home buying, simplified.",
    content: "We show you homes that may offer owner financing — no bank approval, no mortgage hassle. When you find one you like, we refer you to a licensed buying agent in your area.",
    visual: (
      <div className="flex items-center justify-center gap-2 sm:gap-3 my-4">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-red-500/20 rounded-xl flex items-center justify-center border border-red-500/30">
            <span className="text-xl sm:text-2xl">🏦</span>
          </div>
          <span className="text-[10px] text-red-400 mt-1 font-medium line-through">Bank</span>
        </div>
        <svg className="w-5 h-5 sm:w-6 sm:h-6 text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[#00BC7D]/20 rounded-xl flex items-center justify-center border border-[#00BC7D]/30">
            <span className="text-xl sm:text-2xl">🤝</span>
          </div>
          <span className="text-[10px] text-[#00BC7D] mt-1 font-medium">Direct</span>
        </div>
        <svg className="w-5 h-5 sm:w-6 sm:h-6 text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-blue-500/20 rounded-xl flex items-center justify-center border border-blue-500/30">
            <span className="text-xl sm:text-2xl">🏠</span>
          </div>
          <span className="text-[10px] text-blue-400 mt-1 font-medium">Home</span>
        </div>
      </div>
    ),
  },
  {
    title: "Browse & Save",
    subtitle: "It's simple.",
    content: "Swipe through properties in your area. Like the ones you're interested in — skip the rest.",
    visual: (
      <div className="space-y-3 my-4">
        <div className="flex items-center gap-3 bg-[#00BC7D]/10 border border-[#00BC7D]/20 rounded-xl px-4 py-3">
          <div className="w-10 h-10 bg-[#00BC7D]/50 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </div>
          <div>
            <div className="text-white font-bold text-sm">Tap the heart</div>
            <div className="text-slate-400 text-xs">Save properties you like</div>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <div>
            <div className="text-white font-bold text-sm">Tap the X</div>
            <div className="text-slate-400 text-xs">Skip and move on</div>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3">
          <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 border border-blue-500/30">
            <span className="text-lg">👆</span>
          </div>
          <div>
            <div className="text-white font-bold text-sm">Swipe left or right</div>
            <div className="text-slate-400 text-xs">Navigate between properties</div>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "Got Questions?",
    subtitle: "Sarah's here to help.",
    content: "Tap the chat bubble anytime to ask about properties, financing, or how to get started. Sarah knows everything about Ownerfi.",
    visual: (
      <div className="my-4 flex flex-col items-center">
        <div className="bg-[#00BC7D] rounded-2xl px-5 py-3 max-w-[240px] relative mb-3">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-sm">👩</span>
            <span className="text-[11px] font-semibold text-white">Sarah</span>
            <div className="w-1.5 h-1.5 bg-green-300 rounded-full animate-pulse"></div>
          </div>
          <p className="text-white text-sm leading-snug">
            Hi! I can help you browse homes, explain owner financing, or answer any questions.
          </p>
          <div className="absolute -bottom-1.5 left-8 w-3 h-3 bg-[#00BC7D] transform rotate-45"></div>
        </div>
        <div className="flex items-center gap-2 text-slate-400 text-xs">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 13l-7 7-7-7m14-8l-7 7-7-7" />
          </svg>
          <span>Look for the chat bubble in the bottom-right corner</span>
        </div>
      </div>
    ),
  },
];

export default function Tutorial({ onComplete, isVisible }: TutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const hasTrackedStart = useRef(false);

  useEffect(() => {
    if (!isVisible) {
      setCurrentStep(0);
      hasTrackedStart.current = false;
    } else if (!hasTrackedStart.current) {
      hasTrackedStart.current = true;
      trackEvent('tutorial_start', { total_steps: tutorialSteps.length });
    }
  }, [isVisible]);

  const handleNext = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete(false);
    }
  };

  const handleSkip = () => {
    handleComplete(true);
  };

  const handleComplete = (skipped: boolean) => {
    if (skipped) {
      trackEvent('tutorial_skip', { skipped_at_step: currentStep + 1 });
    } else {
      trackEvent('tutorial_complete', { total_steps: tutorialSteps.length });
    }

    localStorage.setItem('buyerTutorialCompleted', 'true');
    localStorage.setItem('tutorialLoginCount', '0');
    onComplete();
  };

  if (!isVisible) return null;

  const currentTutorial = tutorialSteps[currentStep];

  return (
    <>
      {/* Dark overlay */}
      <div className="fixed inset-0 bg-black/80 z-40" onClick={handleSkip} />

      {/* Tutorial modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 px-4 py-6 overflow-y-auto">
        <div className="bg-slate-800 text-white rounded-2xl shadow-2xl max-w-md w-full p-5 sm:p-6 relative animate-fadeInScale border border-slate-700/50">
          {/* Progress bar */}
          <div className="flex gap-1.5 mb-5">
            {tutorialSteps.map((_, index) => (
              <div
                key={index}
                className={`h-1 rounded-full flex-1 transition-all duration-300 ${
                  index <= currentStep
                    ? 'bg-[#00BC7D]'
                    : 'bg-slate-700'
                }`}
              />
            ))}
          </div>

          {/* Content */}
          <div className="text-center mb-1">
            <h3 className="text-2xl font-black mb-1">
              {currentTutorial.title}
            </h3>
            <p className="text-[#00BC7D] font-semibold text-sm">
              {currentTutorial.subtitle}
            </p>
          </div>

          {/* Visual */}
          {currentTutorial.visual}

          {/* Description */}
          <p className="text-slate-300 text-center text-sm leading-relaxed mb-6">
            {currentTutorial.content}
          </p>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleSkip}
              className="flex-1 px-4 py-3.5 text-slate-400 hover:text-white active:text-white transition-colors font-medium text-sm active:scale-95"
            >
              Skip
            </button>
            <button
              onClick={handleNext}
              className="flex-1 px-4 py-3.5 bg-[#00BC7D]/50 hover:bg-[#00BC7D] active:bg-[#009B66] text-white rounded-xl font-bold transition-all text-sm active:scale-95"
            >
              {currentStep === tutorialSteps.length - 1 ? "Let's Go!" : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
