'use client';

import { Language } from '@/lib/translations';

interface LanguageToggleProps {
  currentLanguage: Language;
  onLanguageChange: (lang: Language) => void;
}

export function LanguageToggle({ currentLanguage, onLanguageChange }: LanguageToggleProps) {
  return (
    <button
      onClick={() => onLanguageChange(currentLanguage === 'en' ? 'es' : 'en')}
      className="fixed top-20 left-4 z-50 bg-gradient-to-r from-[#00BC7D] to-[#3B82F6] hover:from-[#00d68f] hover:to-[#60a5fa] text-white px-4 py-2.5 rounded-full font-bold text-sm shadow-2xl hover:scale-105 transition-all duration-300 border-2 border-white/20 backdrop-blur-sm flex items-center gap-2"
      aria-label="Toggle language"
    >
      <span className="text-xl">🌐</span>
      <span>{currentLanguage === 'en' ? 'Español' : 'English'}</span>
    </button>
  );
}
