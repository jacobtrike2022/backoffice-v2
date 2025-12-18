/**
 * PIN Login Modal for Knowledge Base Public Viewer
 * Low-friction authentication for QR code access
 */

import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogOverlay, DialogPortal } from '../ui/dialog';
import { Button } from '../ui/button';
import { loginWithPin, getPinSession } from '@/lib/crud';
import { Lock, User, X } from 'lucide-react';

interface PinLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (userId: string, userName: string) => void;
  onContinueAsGuest: () => void;
  organizationId: string;
  allowGuestAccess?: boolean;
}

export function PinLoginModal({
  isOpen,
  onClose,
  onLoginSuccess,
  onContinueAsGuest,
  organizationId,
  allowGuestAccess = true
}: PinLoginModalProps) {
  const [pin, setPin] = useState<string[]>(['', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-focus first input when modal opens
  useEffect(() => {
    if (isOpen && inputRefs.current[0]) {
      // Small delay to ensure modal is fully rendered
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setPin(['', '', '', '']);
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  // Auto-advance to next input and auto-submit on 4th digit
  const handlePinChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) {
      return;
    }

    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);
    setError(null);

    // Auto-advance to next input
    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when 4th digit is entered
    if (value && index === 3) {
      const fullPin = newPin.join('');
      if (fullPin.length === 4) {
        handleSubmit(fullPin);
      }
    }
  };

  // Handle backspace to go to previous input
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Handle paste
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').slice(0, 4);
    if (/^\d{1,4}$/.test(pasted)) {
      const newPin = pasted.split('').concat(['', '', '', '']).slice(0, 4);
      setPin(newPin);
      setError(null);
      
      // Focus the next empty input or the last one
      const nextIndex = Math.min(pasted.length, 3);
      inputRefs.current[nextIndex]?.focus();
      
      // Auto-submit if 4 digits pasted
      if (pasted.length === 4) {
        handleSubmit(pasted);
      }
    }
  };

  const handleSubmit = async (pinValue?: string) => {
    const pinToSubmit = pinValue || pin.join('');
    
    if (pinToSubmit.length !== 4) {
      setError('Please enter a 4-digit PIN');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await loginWithPin(pinToSubmit, organizationId);
      
      if (result.success && result.user) {
        const userName = `${result.user.firstName} ${result.user.lastName}`.trim();
        onLoginSuccess(result.user.id, userName);
        onClose();
      } else {
        setError(result.error || 'Invalid PIN. Please try again.');
        // Clear PIN and refocus first input
        setPin(['', '', '', '']);
        setTimeout(() => {
          inputRefs.current[0]?.focus();
        }, 100);
      }
    } catch (err) {
      setError('Login failed. Please try again.');
      setPin(['', '', '', '']);
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPin = () => {
    alert('Please contact your manager to reset your PIN.');
  };

  if (!isOpen) return null;

  // Prevent modal from being dismissed - only allow via Continue as Guest or successful login
  const handleOpenChange = (open: boolean) => {
    // Do nothing - prevent dismissal by clicking outside or ESC key
    // Modal can only be closed via onContinueAsGuest or onLoginSuccess
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogPortal>
        {/* Glass blur overlay - matching CheckpointPreviewModal */}
        <DialogOverlay className="backdrop-blur-md bg-black/30" />
        <DialogContent 
          className="max-w-md p-0 gap-0 overflow-hidden [&>button]:hidden" 
          aria-describedby={undefined}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogTitle className="sr-only">Enter PIN to Continue</DialogTitle>
          
          <div className="relative flex flex-col">
            {/* Close button removed - modal cannot be dismissed without action */}

            {/* Content */}
            <div className="p-8 sm:p-10">
              {/* Icon and Title */}
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                  <Lock className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  Enter Your PIN
                </h2>
                <p className="text-muted-foreground text-sm">
                  Enter your 4-digit PIN to access this reference material
                </p>
              </div>

              {/* PIN Input */}
              <div className="mb-6">
                <div className="flex justify-center gap-3 mb-4">
                  {pin.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => {
                        inputRefs.current[index] = el;
                      }}
                      type="tel"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handlePinChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      onPaste={index === 0 ? handlePaste : undefined}
                      disabled={isSubmitting}
                      className={`w-14 h-14 sm:w-16 sm:h-16 text-center text-2xl font-semibold border-2 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                        error
                          ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                          : digit
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                      aria-label={`PIN digit ${index + 1}`}
                    />
                  ))}
                </div>

                {/* Error message */}
                {error && (
                  <div className="text-center">
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <Button
                onClick={() => handleSubmit()}
                disabled={pin.join('').length !== 4 || isSubmitting}
                className="w-full hero-primary mb-4"
                size="lg"
              >
                {isSubmitting ? 'Verifying...' : 'Continue'}
              </Button>

              {/* Continue as Guest - Only show if allowed */}
              {allowGuestAccess && (
                <Button
                  onClick={onContinueAsGuest}
                  variant="outline"
                  className="w-full mb-4"
                  size="lg"
                >
                  <User className="h-4 w-4 mr-2" />
                  Continue as Guest
                </Button>
              )}

              {/* Forgot PIN */}
              <div className="text-center">
                <button
                  onClick={handleForgotPin}
                  className="text-sm text-muted-foreground hover:text-foreground underline"
                >
                  Forgot PIN?
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
