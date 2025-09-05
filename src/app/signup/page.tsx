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
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(2); // Skip user type selection - go straight to buyer signup

  const [formData, setFormData] = useState({
    userType: 'buyer', // Default to buyer since this is /signup
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    languages: ['English'] as string[], // Default to English
  });

  const AVAILABLE_LANGUAGES = [
    'English',
    'Spanish',
    'French', 
    'Mandarin',
    'Portuguese',
    'German',
    'Italian',
    'Russian',
    'Arabic',
    'Japanese',
    'Korean',
    'Hindi',
    'Vietnamese',
    'Tagalog',
    'Polish',
    'Other'
  ];

  const handleUserTypeSelect = (type: 'buyer' | 'realtor') => {
    setFormData(prev => ({ ...prev, userType: type }));
    setStep(2);
  };

  const handleLanguageToggle = (language: string) => {
    setFormData(prev => {
      const newLanguages = prev.languages.includes(language)
        ? prev.languages.filter(l => l !== language)
        : [...prev.languages, language];
      
      // Ensure at least one language is selected
      return {
        ...prev,
        languages: newLanguages.length > 0 ? newLanguages : ['English']
      };
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

    if (formData.languages.length === 0) {
      setError('Please select at least one language');
      setLoading(false);
      return;
    }

    try {
      // Use appropriate signup endpoint based on user type
      const signupEndpoint = formData.userType === 'realtor' ? '/api/realtor/signup' : '/api/auth/signup';
      
      const response = await fetch(signupEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role: formData.userType,
          languages: formData.languages
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

      // Redirect based on user type
      if (formData.userType === 'realtor') {
        router.push('/realtor/setup');
      } else {
        router.push('/dashboard/setup');
      }
      
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
          {step === 1 ? (
            // Step 1: Buyer focus with realtor redirect
            <div className="text-center">
              <h1 className="text-2xl font-bold text-primary-text mb-4">
                Your Home is Out There ✨
              </h1>
              <p className="text-base text-secondary-text mb-8 leading-relaxed">
                We know this journey hasn't been easy. Traditional banks have their rules, but we believe in giving people real chances. Let's find you a home that works with your life, not against it.
              </p>

              {/* Clear buyer focus */}
              <div className="bg-surface-bg rounded-xl p-6 shadow-soft mb-6 border border-accent-success/20">
                <div className="text-center mb-6">
                  <div className="w-20 h-20 bg-gradient-to-br from-accent-primary to-accent-success rounded-full flex items-center justify-center text-4xl mx-auto mb-4">
                    🏠
                  </div>
                  <h2 className="text-xl font-semibold text-primary-text mb-2">Find Your Perfect Home</h2>
                  <p className="text-secondary-text">
                    No perfect credit? No problem. Let's find a home that believes in you.
                  </p>
                </div>
                
                <Button
                  onClick={() => handleUserTypeSelect('buyer')}
                  variant="primary"
                  size="lg"
                  className="w-full font-semibold text-lg py-5 min-h-[56px] shadow-medium"
                >
                  Start My Home Search 🔍
                </Button>
                
                <div className="mt-4 bg-accent-light rounded-lg p-3">
                  <div className="flex justify-center space-x-6 text-sm text-muted-text">
                    <span>✓ Free to use</span>
                    <span>✓ No credit checks</span>
                    <span>✓ Real support</span>
                  </div>
                </div>
              </div>

              {/* Clear realtor redirect */}
              <div className="bg-neutral-hover border border-neutral-border rounded-xl p-4">
                <div className="text-center">
                  <p className="text-primary-text font-medium mb-2">
                    🤝 Helping Families Find Homes?
                  </p>
                  <p className="text-secondary-text text-sm mb-4">
                    Join our network of compassionate real estate professionals
                  </p>
                  <Button
                    variant="outline"
                    size="md"
                    href="/realtor/signup"
                    className="w-full font-medium min-h-[48px]"
                  >
                    Partner with OwnerFi
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            // Step 2: Account Details & Languages
            <div>
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-br from-accent-primary to-accent-success rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
                  🏠
                </div>
                <h1 className="text-2xl font-bold text-primary-text mb-2">
                  Let's Get You Home
                </h1>
                <p className="text-base text-secondary-text mb-4">
                  Just a few quick details so we can find the perfect matches for you
                </p>
                <div className="bg-accent-light rounded-lg p-3">
                  <p className="text-sm text-primary-text">
                    <strong>Helping others find homes?</strong>{' '}
                    <Link href="/realtor/signup" className="text-accent-primary hover:text-accent-hover underline font-medium">
                      Join as a partner instead
                    </Link>
                  </p>
                </div>
              </div>

              <div className="bg-surface-bg rounded-xl p-6 shadow-soft mb-8">
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
                    placeholder="john@example.com"
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

              {/* Languages Section */}
              <div>
                <label className="block text-lg font-medium text-primary-text mb-3">
                  What languages do you speak?
                </label>
                <p className="text-sm text-secondary-text mb-4">Select all that apply - scroll down to see more options</p>
                
                <div className="border border-neutral-border rounded-xl bg-primary-bg">
                  <div className="grid grid-cols-2 gap-3 max-h-48 overflow-y-scroll p-4">
                    {AVAILABLE_LANGUAGES.map(language => (
                      <label key={language} className="flex items-center space-x-2 cursor-pointer py-2">
                        <input
                          type="checkbox"
                          checked={formData.languages.includes(language)}
                          onChange={() => handleLanguageToggle(language)}
                          className="text-accent-primary focus:ring-accent-primary border-neutral-border rounded"
                        />
                        <span className="text-secondary-text">{language}</span>
                      </label>
                    ))}
                  </div>
                  
                  {/* Scroll indicator */}
                  <div className="bg-accent-light border-t border-neutral-border p-2 text-center">
                    <p className="text-xs text-secondary-text">↕️ Scroll to see all languages</p>
                  </div>
                </div>
                
                {formData.languages.length > 0 && (
                  <div className="mt-3 p-3 bg-accent-light rounded-lg">
                    <p className="text-primary-text">
                      <strong>Selected:</strong> {formData.languages.join(', ')}
                    </p>
                  </div>
                )}
              </div>

              {/* Benefits */}
              <div className="bg-gradient-to-br from-accent-light to-surface-bg border border-accent-success/20 rounded-xl p-5">
                <h3 className="font-semibold text-primary-text mb-4 text-center">💙 Here's What We Promise You</h3>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-6 h-6 bg-accent-success rounded-full flex items-center justify-center text-white text-xs font-bold">✓</div>
                    <p className="text-secondary-text">Homes that work with your actual budget</p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-6 h-6 bg-accent-success rounded-full flex items-center justify-center text-white text-xs font-bold">✓</div>
                    <p className="text-secondary-text">No judgment about your past or credit</p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-6 h-6 bg-accent-success rounded-full flex items-center justify-center text-white text-xs font-bold">✓</div>
                    <p className="text-secondary-text">Real people who want to help, not algorithms</p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-6 h-6 bg-accent-success rounded-full flex items-center justify-center text-white text-xs font-bold">✓</div>
                    <p className="text-secondary-text">Direct path to homeownership, no banks</p>
                  </div>
                </div>
              </div>

              {/* Terms agreement */}
              <div className="text-center">
                <p className="text-sm text-secondary-text leading-relaxed">
                  By creating your account, you agree to our{' '}
                  <Link href="/terms" className="text-accent-primary hover:text-accent-hover underline font-medium">
                    Terms of Service
                  </Link>{' '}
                  and{' '}
                  <Link href="/privacy" className="text-accent-primary hover:text-accent-hover underline font-medium">
                    Privacy Policy
                  </Link>
                </p>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={loading}
                className="w-full font-semibold text-lg py-5 min-h-[56px] shadow-medium"
              >
                {loading ? 'Getting everything ready... 🏠' : 'Find My Perfect Home! ✨'}
              </Button>
            </form>
          </div>
          
          {/* Sign in link */}
          <div className="mt-8 text-center">
            <p className="text-lg text-primary-text mb-3">
              Already have an account?
            </p>
            <Link href="/auth/signin" className="text-accent-primary hover:text-accent-hover font-medium">
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
          )}
        </div>
      </div>
      
      <Footer />
    </div>
  );
}