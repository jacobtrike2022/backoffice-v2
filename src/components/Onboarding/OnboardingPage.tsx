import React from 'react';
import { Box, Container, useTheme, useMediaQuery } from '@mui/material';
import { OnboardingChat } from './OnboardingChat';

/**
 * Standalone onboarding page - accessible without authentication
 * Used for:
 * - Self-service demo signups
 * - Sales-assisted demos
 * - Inbound lead capture
 */
export const OnboardingPage: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

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
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        py: isMobile ? 2 : 4,
      }}
    >
      <Container maxWidth="md">
        <Box
          sx={{
            bgcolor: 'white',
            borderRadius: 3,
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            overflow: 'hidden',
            minHeight: isMobile ? 'calc(100vh - 32px)' : 'calc(100vh - 64px)',
          }}
        >
          <OnboardingChat onComplete={handleComplete} />
        </Box>
      </Container>
    </Box>
  );
};

export default OnboardingPage;
