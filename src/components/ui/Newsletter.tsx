import React, { useState } from 'react';
import { Button } from './Button';
import { Input } from './Input';

interface NewsletterProps {
  className?: string;
}

export function Newsletter({ className = '' }: NewsletterProps) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    
    // Simulate API call
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setStatus('success');
      setEmail('');
    } catch {
      setStatus('error');
    }
  };

  return (
    <section className={`py-12 px-6 bg-surface-bg ${className}`}>
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-primary-text mb-4">
          Don&apos;t Miss Out
        </h2>
        <p className="text-lg text-secondary-text leading-relaxed">
          New homes get added daily. Be the first to know when something perfect for you becomes available.
        </p>
      </div>
      
      <div className="bg-primary-bg rounded-xl p-6 shadow-soft">
        {status === 'success' ? (
          <div className="text-center">
            <div className="text-4xl mb-4">✨</div>
            <p className="text-accent-primary text-xl font-semibold">
              You&apos;re all set! We&apos;ll be in touch.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              placeholder="Your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={status === 'loading'}
            />
            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={status === 'loading' || !email}
              className="w-full font-semibold text-lg py-5"
            >
              {status === 'loading' ? 'Adding You...' : 'Stay Updated'}
            </Button>
            {status === 'error' && (
              <p className="text-accent-primary text-sm mt-2">
                Oops! Please try again.
              </p>
            )}
          </form>
        )}
      </div>
    </section>
  );
}