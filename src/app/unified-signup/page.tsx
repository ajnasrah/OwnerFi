'use client';

import { useState, useEffect, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function UnifiedSignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(1); // 1: Role selection, 2: Form, 3: Success
  const [userType, setUserType] = useState<'buyer' | 'realtor' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Common form data
  const [formData, setFormData] = useState({
    // Basic fields (both)
    firstName: '',
    lastName: '', 
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    
    // Buyer specific
    languages: ['English'] as string[],
    
    // Realtor specific
    company: '',
    licenseState: '',
  });

  // Check for userType parameter and skip role selection if provided
  useEffect(() => {
    const userTypeParam = searchParams.get('userType');
    if (userTypeParam === 'buyer' || userTypeParam === 'realtor') {
      setUserType(userTypeParam);
      setStep(2);
    }
  }, [searchParams]);

  const handleRoleSelection = (role: 'buyer' | 'realtor') => {
    setUserType(role);
    setStep(2);
    setError('');
  };

  const handleInputChange = (field: string, value: string | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
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
      // Use appropriate API based on user type
      const apiEndpoint = userType === 'realtor' ? '/api/realtor/signup' : '/api/auth/signup';
      
      const signupData = {
        name: `${formData.firstName} ${formData.lastName}`.trim(),
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        password: formData.password,
        role: userType,
        phone: formData.phone,
        ...(userType === 'buyer' && { languages: formData.languages }),
        ...(userType === 'realtor' && { 
          company: formData.company,
          licenseState: formData.licenseState 
        })
      };

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signupData),
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
        setLoading(false);
        return;
      }

      // Auto-signin after successful signup
      const signinResult = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        redirect: false,
      });

      if (signinResult?.error) {
        setError('Account created but signin failed. Please try signing in manually.');
        setLoading(false);
        return;
      }

      // Route to appropriate destination
      if (userType === 'realtor') {
        router.push('/realtor/setup'); // Realtor needs to complete profile
      } else {
        router.push('/dashboard/setup'); // Buyer needs questionnaire
      }

    } catch (err) {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-primary-bg flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <Link href="/">
            <h1 className="text-4xl font-bold text-primary-text mb-2 hover:text-accent-primary transition-colors cursor-pointer">
              🏠 OwnerFi
            </h1>
          </Link>
          <h2 className="text-2xl font-bold text-accent-primary mb-2">
            {step === 1 ? 'Join OwnerFi' : userType === 'realtor' ? 'Realtor Account' : 'Find Your Home'}
          </h2>
          <p className="text-secondary-text">
            {step === 1 ? 'Choose your account type' : 
             userType === 'realtor' ? 'Access qualified owner-financing leads' : 
             'Discover owner-financed properties'}
          </p>
        </div>

        <div className="bg-surface-bg rounded-lg shadow-medium p-8">
          {/* Step 1: Role Selection */}
          {step === 1 && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold text-primary-text text-center mb-6">
                What brings you to OwnerFi?
              </h3>
              
              <div className="space-y-4">
                <button
                  onClick={() => handleRoleSelection('buyer')}
                  className="w-full p-6 border-2 border-neutral-border rounded-xl hover:border-accent-primary hover:bg-accent-primary/5 transition-all text-left group"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-accent-primary/10 rounded-lg flex items-center justify-center group-hover:bg-accent-primary/20">
                      <svg className="w-6 h-6 text-accent-primary" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-semibold text-primary-text text-lg">I&apos;m looking to buy a home</div>
                      <div className="text-secondary-text text-sm">Browse owner-financed properties in your area</div>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => handleRoleSelection('realtor')}
                  className="w-full p-6 border-2 border-neutral-border rounded-xl hover:border-accent-success hover:bg-accent-success/5 transition-all text-left group"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-accent-success/10 rounded-lg flex items-center justify-center group-hover:bg-accent-success/20">
                      <svg className="w-6 h-6 text-accent-success" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-semibold text-primary-text text-lg">I&apos;m a real estate agent</div>
                      <div className="text-secondary-text text-sm">Access qualified buyer leads ready for owner financing</div>
                    </div>
                  </div>
                </button>
              </div>

              <div className="text-center mt-6">
                <p className="text-secondary-text text-sm">
                  Already have an account?{' '}
                  <Link href="/auth/signin" className="text-accent-primary hover:text-accent-hover font-medium">
                    Sign In
                  </Link>
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Registration Form */}
          {step === 2 && userType && (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-accent-danger/10 border border-accent-danger/20 rounded-md p-4">
                  <p className="text-accent-danger text-sm">{error}</p>
                </div>
              )}

              {/* Basic Info - Both Users */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-text mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                    className="w-full p-3 border border-neutral-border rounded-md focus:ring-accent-primary focus:border-accent-primary"
                    placeholder="John"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary-text mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) => handleInputChange('lastName', e.target.value)}
                    className="w-full p-3 border border-neutral-border rounded-md focus:ring-accent-primary focus:border-accent-primary"
                    placeholder="Smith"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-text mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="w-full p-3 border border-neutral-border rounded-md focus:ring-accent-primary focus:border-accent-primary"
                  placeholder="john@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-text mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  className="w-full p-3 border border-neutral-border rounded-md focus:ring-accent-primary focus:border-accent-primary"
                  placeholder="(555) 123-4567"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-text mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    className="w-full p-3 border border-neutral-border rounded-md focus:ring-accent-primary focus:border-accent-primary"
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary-text mb-1">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    required
                    value={formData.confirmPassword}
                    onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                    className="w-full p-3 border border-neutral-border rounded-md focus:ring-accent-primary focus:border-accent-primary"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {/* Realtor-Specific Fields */}
              {userType === 'realtor' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-primary-text mb-1">
                      Company/Brokerage
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.company}
                      onChange={(e) => handleInputChange('company', e.target.value)}
                      className="w-full p-3 border border-neutral-border rounded-md focus:ring-accent-primary focus:border-accent-primary"
                      placeholder="ABC Realty"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-primary-text mb-1">
                      License State
                    </label>
                    <select
                      required
                      value={formData.licenseState}
                      onChange={(e) => handleInputChange('licenseState', e.target.value)}
                      className="w-full p-3 border border-neutral-border rounded-md focus:ring-accent-primary focus:border-accent-primary"
                    >
                      <option value="">Select license state...</option>
                      <option value="AL">Alabama</option>
                      <option value="AK">Alaska</option>
                      <option value="AZ">Arizona</option>
                      <option value="AR">Arkansas</option>
                      <option value="CA">California</option>
                      <option value="CO">Colorado</option>
                      <option value="CT">Connecticut</option>
                      <option value="DE">Delaware</option>
                      <option value="FL">Florida</option>
                      <option value="GA">Georgia</option>
                      <option value="HI">Hawaii</option>
                      <option value="ID">Idaho</option>
                      <option value="IL">Illinois</option>
                      <option value="IN">Indiana</option>
                      <option value="IA">Iowa</option>
                      <option value="KS">Kansas</option>
                      <option value="KY">Kentucky</option>
                      <option value="LA">Louisiana</option>
                      <option value="ME">Maine</option>
                      <option value="MD">Maryland</option>
                      <option value="MA">Massachusetts</option>
                      <option value="MI">Michigan</option>
                      <option value="MN">Minnesota</option>
                      <option value="MS">Mississippi</option>
                      <option value="MO">Missouri</option>
                      <option value="MT">Montana</option>
                      <option value="NE">Nebraska</option>
                      <option value="NV">Nevada</option>
                      <option value="NH">New Hampshire</option>
                      <option value="NJ">New Jersey</option>
                      <option value="NM">New Mexico</option>
                      <option value="NY">New York</option>
                      <option value="NC">North Carolina</option>
                      <option value="ND">North Dakota</option>
                      <option value="OH">Ohio</option>
                      <option value="OK">Oklahoma</option>
                      <option value="OR">Oregon</option>
                      <option value="PA">Pennsylvania</option>
                      <option value="RI">Rhode Island</option>
                      <option value="SC">South Carolina</option>
                      <option value="SD">South Dakota</option>
                      <option value="TN">Tennessee</option>
                      <option value="TX">Texas</option>
                      <option value="UT">Utah</option>
                      <option value="VT">Vermont</option>
                      <option value="VA">Virginia</option>
                      <option value="WA">Washington</option>
                      <option value="WV">West Virginia</option>
                      <option value="WI">Wisconsin</option>
                      <option value="WY">Wyoming</option>
                    </select>
                  </div>
                </>
              )}

              {/* Buyer-Specific Fields */}
              {userType === 'buyer' && (
                <div>
                  <label className="block text-sm font-medium text-primary-text mb-1">
                    Preferred Languages
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {['English', 'Spanish', 'French', 'German'].map(lang => (
                      <label key={lang} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={formData.languages.includes(lang)}
                          onChange={(e) => {
                            const newLanguages = e.target.checked 
                              ? [...formData.languages, lang]
                              : formData.languages.filter(l => l !== lang);
                            handleInputChange('languages', newLanguages);
                          }}
                          className="rounded border-neutral-border text-accent-primary focus:ring-accent-primary"
                        />
                        <span className="text-sm text-primary-text">{lang}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-accent-primary text-surface-bg py-3 px-4 rounded-md hover:bg-accent-hover transition-colors font-medium disabled:bg-neutral-border disabled:cursor-not-allowed"
              >
                {loading ? 'Creating Account...' : `Create ${userType} Account`}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-secondary-text hover:text-primary-text text-sm"
                >
                  ← Back to role selection
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer Links */}
        <div className="text-center space-y-3">
          <p className="text-xs text-secondary-text">
            By creating an account, you agree to our{' '}
            <Link href="/terms" className="text-accent-primary hover:text-accent-hover underline">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="text-accent-primary hover:text-accent-hover underline">
              Privacy Policy
            </Link>
          </p>
          
          <Link href="/" className="text-secondary-text hover:text-primary-text text-sm">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function UnifiedSignup() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-primary-bg flex items-center justify-center py-12 px-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary"></div>
      </div>
    }>
      <UnifiedSignupContent />
    </Suspense>
  );
}