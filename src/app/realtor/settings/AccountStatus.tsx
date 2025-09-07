import React from 'react';

interface AccountStatusProps {
  profile: any;
  setError: (error: string) => void;
  setSuccess: (message: string) => void;
  setSaving: (saving: boolean) => void;
  loadProfile: () => void;
}

export default function AccountStatus({ profile, setError, setSuccess, setSaving, loadProfile }: AccountStatusProps) {
  const getAccountType = () => {
    if (profile?.isOnTrial) return 'trial';
    if (profile?.subscription?.status === 'active') return 'subscription';
    return 'no_subscription';
  };

  const getDaysRemaining = () => {
    if (!profile?.trialEndDate) return 0;
    const endDate = new Date(profile.trialEndDate);
    const now = new Date();
    return Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  };

  const accountType = getAccountType();

  return (
    <div className="bg-surface-bg rounded-xl shadow-soft border border-neutral-border p-6 mb-6">
      <h3 className="text-xl font-bold text-primary-text mb-4">Account Status</h3>
      
      {accountType === 'trial' && (
        <>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-4">
            <div className="flex items-center space-x-2 mb-2">
              <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <span className="font-semibold text-blue-600">Free Trial Active</span>
            </div>
            <div className="text-sm text-secondary-text space-y-1">
              <p><span className="font-medium">Account Type:</span> Trial Period</p>
              <p><span className="font-medium">Days Remaining:</span> {getDaysRemaining()} days</p>
              <p><span className="font-medium">Trial Ends:</span> {new Date(profile.trialEndDate).toLocaleDateString()}</p>
              <p><span className="font-medium">Credits Available:</span> {profile.credits}</p>
            </div>
          </div>
          <p className="text-sm text-secondary-text mb-4">
            You're on a free trial. Upgrade below to continue after your trial ends.
          </p>
        </>
      )}

      {accountType === 'subscription' && (
        <>
          <div className="bg-accent-success/10 border border-accent-success/20 rounded-lg p-4 mb-4">
            <div className="flex items-center space-x-2 mb-2">
              <svg className="w-5 h-5 text-accent-success" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="font-semibold text-accent-success">Active Subscription</span>
            </div>
            <div className="text-sm text-secondary-text space-y-1">
              <p><span className="font-medium">Plan:</span> {profile.subscription?.plan || 'Professional'}</p>
              <p><span className="font-medium">Status:</span> Active</p>
              <p><span className="font-medium">Next billing:</span> {
                profile.subscription?.currentPeriodEnd 
                  ? new Date(profile.subscription.currentPeriodEnd).toLocaleDateString()
                  : 'N/A'
              }</p>
              <p><span className="font-medium">Credits Available:</span> {profile.credits}</p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={async () => {
                try {
                  const response = await fetch('/api/stripe/billing-portal', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                  });
                  const data = await response.json();
                  if (data.url) {
                    window.location.href = data.url;
                  } else {
                    setError(data.error || 'Failed to open billing portal');
                  }
                } catch (err) {
                  setError('Failed to open billing portal');
                }
              }}
              className="bg-accent-primary text-surface-bg px-6 py-3 rounded-lg font-semibold hover:bg-accent-hover transition-colors"
            >
              🔗 Manage Billing
            </button>
            <button
              onClick={async () => {
                if (confirm('Are you sure you want to cancel your subscription?')) {
                  try {
                    setSaving(true);
                    console.log('Calling cancel subscription API...');
                    const response = await fetch('/api/stripe/cancel-subscription', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                    });
                    const data = await response.json();
                    if (data.error) {
                      setError(data.error);
                    } else {
                      setSuccess('Subscription cancelled successfully.');
                      loadProfile();
                    }
                  } catch (err) {
                    setError('Failed to cancel subscription');
                  } finally {
                    setSaving(false);
                  }
                }
              }}
              className="bg-accent-danger/10 text-accent-danger border border-accent-danger/20 px-6 py-3 rounded-lg font-semibold hover:bg-accent-danger/20 transition-colors"
            >
              ❌ Cancel Subscription
            </button>
          </div>
        </>
      )}

      {accountType === 'no_subscription' && (
        <>
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-4">
            <div className="flex items-center space-x-2 mb-2">
              <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="font-semibold text-yellow-600">No Active Subscription</span>
            </div>
            <div className="text-sm text-secondary-text space-y-1">
              <p>Your trial has ended or you don't have an active subscription.</p>
              <p><span className="font-medium">Credits Available:</span> {profile.credits || 0}</p>
            </div>
          </div>
          <p className="text-sm text-secondary-text">
            Purchase a subscription below or buy credits to continue using the service.
          </p>
        </>
      )}
    </div>
  );
}