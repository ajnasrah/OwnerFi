import React from 'react';
import Link from 'next/link';

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
}

export function Button({ 
  children, 
  variant = 'primary', 
  size = 'md',
  href, 
  onClick, 
  disabled, 
  className = '',
  type = 'button'
}: ButtonProps) {
  const baseClasses = 'inline-flex items-center justify-center font-medium transition-all duration-200 ease-in-out focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed';
  
  const variantClasses = {
    primary: 'bg-accent-primary text-surface-bg hover:bg-accent-hover hover:shadow-medium focus:shadow-medium transform hover:scale-[1.02] active:scale-[0.98]',
    secondary: 'bg-accent-warm text-surface-bg hover:bg-accent-warm-hover hover:shadow-medium focus:shadow-medium transform hover:scale-[1.02] active:scale-[0.98]',
    outline: 'border-2 border-accent-primary text-accent-primary bg-transparent hover:bg-accent-primary hover:text-surface-bg focus:bg-accent-primary focus:text-surface-bg transform hover:scale-[1.02] active:scale-[0.98]',
    ghost: 'text-accent-primary bg-transparent hover:bg-accent-light hover:text-primary-text focus:bg-accent-light'
  };
  
  const sizeClasses = {
    sm: 'px-6 py-4 text-base min-h-[48px]',      // Comfortable mobile touch
    md: 'px-8 py-5 text-lg min-h-[52px]',        // Large mobile touch target  
    lg: 'px-10 py-6 text-xl min-h-[56px]'        // Extra large for primary actions
  };
  
  const classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} rounded-xl ${className}`;
  
  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }
  
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={classes}
    >
      {children}
    </button>
  );
}