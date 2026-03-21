/**
 * Ownerfi Globe Logo — SVG component
 * Renders the brand globe/orbital icon with the Cash Green → Blue Ocean gradient.
 * Use this component or inline SVG globe everywhere instead of an img tag.
 */

interface OwnerfiLogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
  textClassName?: string;
}

export function OwnerfiLogo({ size = 32, className = '', showText = false, textClassName = '' }: OwnerfiLogoProps) {
  const id = `grad-${size}`;
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0"
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00BC7D" />
            <stop offset="100%" stopColor="#3B82F6" />
          </linearGradient>
        </defs>
        {/* Outer circle */}
        <circle cx="50" cy="50" r="45" stroke={`url(#${id})`} strokeWidth="7" fill="none" />
        {/* Horizontal ellipse */}
        <ellipse cx="50" cy="50" rx="42" ry="22" stroke={`url(#${id})`} strokeWidth="5.5" fill="none" transform="rotate(-25 50 50)" />
        {/* Vertical ellipse */}
        <ellipse cx="50" cy="50" rx="22" ry="42" stroke={`url(#${id})`} strokeWidth="5.5" fill="none" transform="rotate(-25 50 50)" />
      </svg>
      {showText && (
        <span className={`font-bold text-white ${textClassName}`}>Ownerfi</span>
      )}
    </span>
  );
}
