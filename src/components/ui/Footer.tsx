
import Link from 'next/link';

interface FooterProps {
  className?: string;
}

export function Footer({ className = '' }: FooterProps) {
  return (
    <footer className={`bg-accent-primary text-surface-bg py-8 px-6 ${className}`}>
      {/* Mobile-first simplified footer */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center space-x-3 mb-4">
          <div className="w-10 h-10 bg-surface-bg rounded-xl flex items-center justify-center text-2xl">
            🏠
          </div>
          <h3 className="text-2xl font-bold">OwnerFi</h3>
        </div>
        <p className="text-accent-light text-lg leading-relaxed">
          Your trusted partner on the path to homeownership
        </p>
      </div>
      
      {/* Mobile-friendly links */}
      <div className="flex justify-center space-x-8 mb-8">
        <Link href="/privacy" className="text-accent-light hover:text-surface-bg transition-colors text-base">
          Privacy
        </Link>
        <Link href="/terms" className="text-accent-light hover:text-surface-bg transition-colors text-base">
          Terms
        </Link>
        <Link href="/unified-signup" className="text-accent-light hover:text-surface-bg transition-colors text-base">
          Get Started
        </Link>
      </div>
      
      {/* Copyright */}
      <div className="text-center">
        <p className="text-accent-light text-base">
          © 2024 OwnerFi. Made with ❤️ for dreamers.
        </p>
      </div>
    </footer>
  );
}