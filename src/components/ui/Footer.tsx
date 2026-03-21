
import Link from 'next/link';
import { OwnerfiLogo } from './OwnerfiLogo';

interface FooterProps {
  className?: string;
}

export function Footer({ className = '' }: FooterProps) {
  return (
    <footer className={`bg-[#111625] text-white py-8 px-6 border-t border-white/[0.06] ${className}`}>
      {/* Mobile-first simplified footer */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-4">
          <OwnerfiLogo size={36} />
          <h3 className="text-2xl font-bold">Ownerfi</h3>
        </div>
        <p className="text-slate-400 text-lg leading-relaxed">
          Your last stop for modern home buying
        </p>
      </div>

      {/* Mobile-friendly links */}
      <div className="flex justify-center space-x-8 mb-8">
        <Link href="/privacy" className="text-slate-400 hover:text-[#00BC7D] transition-colors text-base">
          Privacy
        </Link>
        <Link href="/terms" className="text-slate-400 hover:text-[#00BC7D] transition-colors text-base">
          Terms
        </Link>
        <Link href="/auth" className="text-slate-400 hover:text-[#00BC7D] transition-colors text-base">
          Get Started
        </Link>
      </div>

      {/* Copyright */}
      <div className="text-center">
        <p className="text-slate-500 text-base">
          &copy; 2024 Ownerfi. Made with &hearts; for dreamers.
        </p>
      </div>
    </footer>
  );
}
