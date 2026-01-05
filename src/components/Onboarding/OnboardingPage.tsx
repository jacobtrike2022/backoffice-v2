import React from 'react';
import { OnboardingChat } from './OnboardingChat';

/**
 * Standalone onboarding page - accessible without authentication
 * Used for:
 * - Self-service demo signups
 * - Sales-assisted demos
 * - Inbound lead capture
 */
export const OnboardingPage: React.FC = () => {
  const handleComplete = (organization: any) => {
    console.log('Onboarding complete:', organization);
    // TODO: Redirect to login or dashboard
    // For now, we'll just show a success state
    // In production, this would:
    // 1. Create an admin user account
    // 2. Send welcome email with login instructions
    // 3. Redirect to the new org's dashboard
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 py-4 sm:py-8">
      <div className="container mx-auto px-4 max-w-3xl">
        <div className="bg-background rounded-2xl shadow-2xl overflow-hidden min-h-[calc(100vh-4rem)]">
          <OnboardingChat onComplete={handleComplete} />
        </div>
      </div>
    </div>
  );
};

export default OnboardingPage;
