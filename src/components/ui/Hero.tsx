
import { Button } from './Button';

interface HeroProps {
  backgroundImage?: string;
  title: string;
  subtitle: string;
  ctaText?: string;
  ctaHref?: string;
  ctaOnClick?: () => void;
  showUserTypeButtons?: boolean;
  className?: string;
}

export function Hero({ 
  backgroundImage, 
  title, 
  subtitle, 
  ctaText, 
  ctaHref, 
  ctaOnClick, 
  showUserTypeButtons = false,
  className = '' 
}: HeroProps) {
  return (
    <section className={`bg-gradient-to-br from-accent-light via-surface-bg to-neutral-hover ${className}`}>
      {/* Mobile-first hero content */}
      <div className="px-6 py-16">
        <div className="text-center max-w-2xl mx-auto">
          {/* Mobile-optimized heading */}
          <h1 className="text-4xl font-bold text-primary-text mb-6 leading-tight">
            {title}
          </h1>
          
          {/* Mobile-friendly subtitle */}
          <div className="text-lg text-secondary-text mb-12 leading-relaxed" dangerouslySetInnerHTML={{ __html: subtitle }}>
          </div>
          
          {/* Mobile-optimized buttons */}
          {showUserTypeButtons ? (
            <div className="space-y-4">
              <Button 
                variant="primary" 
                size="lg"
                href="/unified-signup?userType=buyer"
                className="w-full text-lg py-5 font-semibold min-h-[56px] shadow-medium"
              >
                🏠 I Need a Home (Start Here)
              </Button>
              <Button 
                variant="outline" 
                size="lg"
                href="/unified-signup?userType=realtor"
                className="w-full text-lg py-5 font-semibold min-h-[56px]"
              >
                💼 I Help Families Find Homes
              </Button>
              <p className="text-sm text-muted-text mt-4">
                Free to start • No credit check required • Real human support
              </p>
            </div>
          ) : (
            <div>
              <Button 
                variant="primary" 
                size="lg"
                href={ctaHref}
                onClick={ctaOnClick}
                className="w-full text-lg py-5 font-semibold min-h-[56px] shadow-medium"
              >
                {ctaText}
              </Button>
              <p className="text-sm text-muted-text mt-4">
                Free to start • No credit check required • Real human support
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}