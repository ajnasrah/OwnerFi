'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/ui/Header';
import { Footer } from '@/components/ui/Footer';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function SignUp() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

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
      const result = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        isSignUp: 'true',
        redirect: false,
      });

      if (result?.error) {
        if (result.error === 'User already exists') {
          setError('An account with this email already exists');
        } else {
          setError('Failed to create account');
        }
      } else {
        // Redirect to profile setup
        router.push('/dashboard/setup');
      }
    } catch (err) {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-primary-bg flex flex-col">
      <Header />
      
      <div className="flex-1 px-6 py-12">
        <div className="w-full">
          {/* Welcome section */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-primary-text mb-2">Start Your Journey</h1>
            <p className="text-lg text-secondary-text">Create your account to find owner-financed homes</p>
          </div>

          {/* Form */}
          <div className="bg-surface-bg rounded-xl p-6 shadow-soft">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-error-bg border border-accent-primary/20 rounded-lg p-4">
                  <p className="text-accent-primary">{error}</p>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="First name"
                  name="firstName"
                  type="text"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                  placeholder="John"
                />
                <Input
                  label="Last name"
                  name="lastName"
                  type="text"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                  placeholder="Smith"
                />
              </div>

              <Input
                label="Email address"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                required
                autoComplete="email"
                placeholder="your@email.com"
              />

              <Input
                label="Password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                required
                placeholder="Choose a strong password"
              />
              <p className="text-sm text-secondary-text -mt-2">Must be at least 6 characters</p>

              <Input
                label="Confirm password"
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                placeholder="Confirm your password"
              />

              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={loading}
                className="w-full font-semibold text-lg py-5"
              >
                {loading ? 'Creating Account...' : 'Create My Account'}
              </Button>
            </form>
          </div>

          {/* Sign in option */}
          <div className="mt-8">
            <div className="text-center mb-6">
              <p className="text-lg font-medium text-primary-text">Already have an account?</p>
            </div>
            
            <Button
              variant="outline"
              size="lg"
              href="/auth/signin"
              className="w-full font-semibold text-lg py-5"
            >
              Sign In Instead
            </Button>
          </div>

          {/* Footer link */}
          <div className="mt-8 text-center">
            <Link href="/" className="text-accent-primary hover:text-accent-hover">
              ← Back to home page
            </Link>
          </div>
        </div>
      </div>
      
      <Footer />
    </div>
  );
}