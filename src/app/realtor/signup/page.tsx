'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/ui/Header';
import { Footer } from '@/components/ui/Footer';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function RealtorSignUp() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    try {
      // Create realtor account
      const response = await fetch('/api/realtor/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role: 'realtor'
        }),
      });

      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
        setLoading(false);
        return;
      }

      // Auto-sign in after successful registration
      const signInResult = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        redirect: false,
      });

      if (signInResult?.error) {
        setError('Account created but sign-in failed. Please try signing in manually.');
        setLoading(false);
        return;
      }

      // Redirect to realtor setup
      router.push('/realtor/setup');
      
    } catch (err) {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  return (
    <div className="min-h-screen bg-primary-bg flex flex-col">
      <Header />
      
      <div className="flex-1 px-6 py-12">
        <div className="w-full">
          {/* Welcome section */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-primary-text mb-2">Join Our Network</h1>
            <p className="text-lg text-secondary-text">Create your realtor account to access quality buyer leads</p>
          </div>

          {/* Form */}
          <div className="bg-surface-bg rounded-xl p-6 shadow-soft">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-error-bg border border-accent-primary/20 rounded-lg p-4">
                  <p className="text-accent-primary">{error}</p>
                </div>
              )}

              <Input
                label="Full Name"
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                required
                placeholder="John Smith"
              />

              <Input
                label="Email Address"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                required
                placeholder="john@realestate.com"
              />

              <Input
                label="Password"
                type="password"
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                required
                placeholder="Choose a strong password"
              />

              <Input
                label="Confirm Password"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                required
                placeholder="Confirm your password"
              />

              <div className="bg-accent-light border border-accent-primary/20 rounded-xl p-4">
                <h3 className="font-semibold text-primary-text mb-3">🎉 What You Get:</h3>
                <ul className="text-secondary-text space-y-2">
                  <li>• 7-day free trial</li>
                  <li>• 3 free buyer leads</li>
                  <li>• Access to qualified buyer matches</li>
                  <li>• Lead management dashboard</li>
                </ul>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={loading}
                className="w-full font-semibold text-lg py-5"
              >
                {loading ? 'Creating Account...' : 'Join Our Network'}
              </Button>
            </form>
          </div>

          {/* Sign in link */}
          <div className="mt-8 text-center">
            <p className="text-lg text-primary-text mb-3">
              Already have an account?
            </p>
            <Link href="/realtor/signin" className="text-accent-primary hover:text-accent-hover font-medium">
              Sign In →
            </Link>
          </div>

          {/* Home link */}
          <div className="mt-6 text-center">
            <Link href="/" className="text-secondary-text hover:text-primary-text">
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
      
      <Footer />
    </div>
  );
}