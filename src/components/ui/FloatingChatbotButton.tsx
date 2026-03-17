'use client';

import { useState, useEffect, useRef } from 'react';

const ATTENTION_QUESTIONS = [
  "Buy a home without a bank?",
  "Bad credit? No problem!",
  "How does owner financing work?",
  "Skip the mortgage hassle",
  "What homes are in your city?",
  "Get started in 2 minutes",
  "$0 bank fees — really",
  "See flexible payment options",
  "Browse homes for free",
  "Ask me anything about OwnerFi",
];

interface FloatingChatbotButtonProps {
  onClick: () => void;
  /** Extra bottom offset class for pages with bottom tab bars (e.g. "bottom-24") */
  bottomClass?: string;
}

export default function FloatingChatbotButton({ onClick, bottomClass }: FloatingChatbotButtonProps) {
  const [showQuestion, setShowQuestion] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const usedQuestionsRef = useRef<Set<number>>(new Set());

  const hideQuestion = () => {
    setShowQuestion(false);
    setIsAnimating(false);
  };

  useEffect(() => {
    const getRandomQuestion = () => {
      const used = usedQuestionsRef.current;
      const availableQuestions = ATTENTION_QUESTIONS.map((_, index) => index)
        .filter(index => !used.has(index));

      if (availableQuestions.length === 0) {
        usedQuestionsRef.current = new Set();
        return Math.floor(Math.random() * ATTENTION_QUESTIONS.length);
      }

      const randomIndex = Math.floor(Math.random() * availableQuestions.length);
      return availableQuestions[randomIndex];
    };

    let hideTimer: NodeJS.Timeout;
    const initialTimer: NodeJS.Timeout = setTimeout(() => {
      const questionIndex = getRandomQuestion();
      usedQuestionsRef.current.add(questionIndex);
      setCurrentQuestion(questionIndex);
      setIsAnimating(true);
      setShowQuestion(true);
      hideTimer = setTimeout(hideQuestion, 10000);
    }, 4000);

    const interval: NodeJS.Timeout = setInterval(() => {
      const questionIndex = getRandomQuestion();
      usedQuestionsRef.current.add(questionIndex);
      setCurrentQuestion(questionIndex);
      setIsAnimating(true);
      setShowQuestion(true);
      hideTimer = setTimeout(hideQuestion, 10000);
    }, 12000);

    return () => {
      clearTimeout(initialTimer);
      clearTimeout(hideTimer);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className={`fixed ${bottomClass || 'bottom-6'} right-6 z-floating-button`}>
      {/* Chat Bubble */}
      {showQuestion && (
        <div
          className={`absolute bottom-16 right-0 w-fit min-w-[170px] max-w-[250px] bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-lg transform transition-all duration-300 cursor-pointer ${
            showQuestion ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-95'
          }`}
          onClick={onClick}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs">👩</span>
              <span className="text-[10px] font-semibold">Sarah</span>
              <div className="w-1.5 h-1.5 bg-green-300 rounded-full animate-pulse"></div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); hideQuestion(); }} className="text-white/80 hover:text-white -mr-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="text-sm leading-snug font-medium">
            {ATTENTION_QUESTIONS[currentQuestion]}
          </div>

          {/* Tail */}
          <div className="absolute -bottom-1 right-4 w-3 h-3 bg-emerald-600 transform rotate-45"></div>
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={onClick}
        className={`relative group bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white p-4 rounded-full shadow-2xl transform transition-all duration-300 hover:scale-105 focus:outline-none focus:ring-4 focus:ring-emerald-500/30 ${
          isAnimating ? 'animate-bounce' : ''
        }`}
      >
        {/* Pulse rings */}
        <div className={`absolute inset-0 rounded-full bg-emerald-500/30 animate-ping ${isAnimating ? 'opacity-100' : 'opacity-0'}`}></div>
        <div className={`absolute inset-0 rounded-full bg-emerald-500/20 animate-ping animation-delay-75 ${isAnimating ? 'opacity-100' : 'opacity-0'}`}></div>

        {/* Chat icon */}
        <svg className="w-6 h-6 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>

        {/* Notification badge */}
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
        </div>

        {/* Hover tooltip */}
        <div className="absolute bottom-16 right-0 bg-slate-800 text-white px-3 py-2 rounded-lg text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transform group-hover:translate-y-0 translate-y-2 transition-all duration-200 shadow-lg pointer-events-none">
          Chat with Sarah
          <div className="absolute top-full right-4 w-2 h-2 bg-slate-800 transform rotate-45"></div>
        </div>
      </button>
    </div>
  );
}
