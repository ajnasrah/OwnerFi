'use client';

import { useState, useEffect, useRef } from 'react';
import { trackEvent } from '@/components/analytics/AnalyticsProvider';

interface TutorialProps {
  onComplete: () => void;
  isVisible: boolean;
}

const tutorialSteps = [
  {
    title: "Welcome to OwnerFi!",
    content: "Let's take a quick tour to get you started.",
    icon: "👋"
  },
  {
    title: "Browse Properties",
    content: "Swipe right to see the next property, swipe left to go back.",
    icon: "👆"
  },
  {
    title: "Like Properties",
    content: "Tap the heart button to save properties you're interested in.",
    icon: "❤️"
  },
  {
    title: "Go Back",
    content: "Swipe left to go back to the previous property you were viewing.",
    icon: "⬅️"
  },
  {
    title: "View Liked Properties",
    content: "Access your liked properties anytime from the heart icon at the top.",
    icon: "💖"
  }
];

export default function Tutorial({ onComplete, isVisible }: TutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const hasTrackedStart = useRef(false);

  useEffect(() => {
    if (!isVisible) {
      setCurrentStep(0);
      hasTrackedStart.current = false;
    } else if (!hasTrackedStart.current) {
      // Track tutorial start when it becomes visible
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
    // Track tutorial completion or skip
    if (skipped) {
      trackEvent('tutorial_skip', { skipped_at_step: currentStep + 1 });
    } else {
      trackEvent('tutorial_complete', { total_steps: tutorialSteps.length });
    }

    // Store completion with timestamp and reset login counter
    localStorage.setItem('buyerTutorialCompleted', 'true');
    localStorage.setItem('tutorialLoginCount', '0');
    onComplete();
  };

  if (!isVisible) return null;

  const currentTutorial = tutorialSteps[currentStep];

  return (
    <>
      {/* Dark overlay */}
      <div className="fixed inset-0 bg-black/70 z-40" onClick={handleSkip} />

      {/* Tutorial modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 px-4">
        <div className="bg-gray-800 text-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative animate-fadeInScale">
          {/* Progress dots */}
          <div className="flex justify-center gap-2 mb-6">
            {tutorialSteps.map((_, index) => (
              <div
                key={index}
                className={`h-2 w-2 rounded-full transition-all duration-300 ${
                  index === currentStep
                    ? 'w-8 bg-emerald-400'
                    : index < currentStep
                    ? 'bg-emerald-600'
                    : 'bg-gray-600'
                }`}
              />
            ))}
          </div>

          {/* Icon */}
          <div className="text-5xl text-center mb-4">
            {currentTutorial.icon}
          </div>

          {/* Content */}
          <h3 className="text-2xl font-bold text-center mb-3">
            {currentTutorial.title}
          </h3>
          <p className="text-gray-300 text-center text-lg mb-8">
            {currentTutorial.content}
          </p>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleSkip}
              className="flex-1 px-6 py-3 text-gray-400 hover:text-white transition-colors font-medium"
            >
              Skip Tutorial
            </button>
            <button
              onClick={handleNext}
              className="flex-1 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold transition-colors"
            >
              {currentStep === tutorialSteps.length - 1 ? 'Get Started' : 'Next'}
            </button>
          </div>

          {/* Step indicator */}
          <div className="text-center mt-4 text-sm text-gray-500">
            Step {currentStep + 1} of {tutorialSteps.length}
          </div>
        </div>
      </div>
    </>
  );
}