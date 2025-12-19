

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export function Card({ children, className = '', hover = false }: CardProps) {
  const baseClasses = 'bg-white rounded-xl p-6 shadow-light';
  const hoverClasses = hover ? 'hover:shadow-medium transition-shadow duration-200' : '';
  
  return (
    <div className={`${baseClasses} ${hoverClasses} ${className}`}>
      {children}
    </div>
  );
}

interface CardImageProps {
  src?: string;
  alt?: string;
  placeholder?: React.ReactNode;
  className?: string;
}

export function CardImage({ src, alt, placeholder, className = '' }: CardImageProps) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt || ''}
        className={`w-full h-48 object-cover rounded-lg mb-4 ${className}`}
      />
    );
  }
  
  return (
    <div className={`w-full h-48 bg-gradient-to-br from-blue-400 to-purple-500 rounded-lg mb-4 flex items-center justify-center text-white ${className}`}>
      {placeholder || (
        <div className="text-center">
          <div className="text-4xl mb-2">🏠</div>
          <p className="text-sm">Photo Coming Soon</p>
        </div>
      )}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  className?: string;
}

export function CardHeader({ title, subtitle, className = '' }: CardHeaderProps) {
  return (
    <div className={`mb-4 ${className}`}>
      <h3 className="text-2xl font-semibold text-primary-text mb-2 leading-tight">
        {title}
      </h3>
      {subtitle && (
        <p className="text-gray-600 text-base">
          {subtitle}
        </p>
      )}
    </div>
  );
}

interface CardContentProps {
  children: React.ReactNode;
  className?: string;
}

export function CardContent({ children, className = '' }: CardContentProps) {
  return (
    <div className={`text-gray-600 leading-relaxed ${className}`}>
      {children}
    </div>
  );
}

interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function CardFooter({ children, className = '' }: CardFooterProps) {
  return (
    <div className={`mt-6 pt-4 border-t border-gray-100 ${className}`}>
      {children}
    </div>
  );
}