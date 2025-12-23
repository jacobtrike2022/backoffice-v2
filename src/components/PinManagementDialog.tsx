import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Eye, EyeOff, RefreshCw, Key } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { getUserPin, setUserPin, generateUserPin, checkPinUniqueness } from '../lib/crud/pinAuth';
import { getCurrentUserOrgId } from '../lib/supabase';

interface PinManagementDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
}

export function PinManagementDialog({ isOpen, onClose, userId, userName }: PinManagementDialogProps) {
  const [currentPin, setCurrentPin] = useState<string | null>(null);
  const [showPin, setShowPin] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingPin, setFetchingPin] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && userId) {
      fetchCurrentPin();
      fetchOrganizationId();
      // Reset form when dialog opens
      setNewPin('');
      setConfirmPin('');
      setShowPin(false);
    }
  }, [isOpen, userId]);

  const fetchOrganizationId = async () => {
    const orgId = await getCurrentUserOrgId();
    setOrganizationId(orgId);
  };

  const fetchCurrentPin = async () => {
    setFetchingPin(true);
    try {
      const pin = await getUserPin(userId);
      setCurrentPin(pin);
    } catch (error) {
      console.error('Error fetching PIN:', error);
      toast.error('Failed to load PIN');
    } finally {
      setFetchingPin(false);
    }
  };

  const handleRevealPin = async () => {
    if (currentPin === null) {
      await fetchCurrentPin();
    }
    setShowPin(true);
  };

  const handleGeneratePin = async () => {
    setLoading(true);
    try {
      const generatedPin = await generateUserPin(userId);
      if (generatedPin) {
        setCurrentPin(generatedPin);
        setShowPin(true);
        toast.success('New PIN generated successfully', {
          description: `PIN: ${generatedPin}`
        });
      } else {
        toast.error('Failed to generate PIN');
      }
    } catch (error: any) {
      console.error('Error generating PIN:', error);
      toast.error('Failed to generate PIN', {
        description: error.message || 'Please try again'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSetCustomPin = async () => {
    // Validate PIN format
    if (!/^\d{4}$/.test(newPin)) {
      toast.error('Invalid PIN', {
        description: 'PIN must be exactly 4 digits'
      });
      return;
    }

    // Check if PINs match
    if (newPin !== confirmPin) {
      toast.error('PINs do not match', {
        description: 'Please ensure both PIN fields match'
      });
      return;
    }

    // Check for common PINs
    const commonPins = ['0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999', '1234'];
    if (commonPins.includes(newPin)) {
      toast.error('PIN too common', {
        description: 'Please choose a less common PIN'
      });
      return;
    }

    setLoading(true);
    try {
      if (!organizationId) {
        throw new Error('Organization ID not found');
      }

      // Check uniqueness
      const isUnique = await checkPinUniqueness(newPin, organizationId, userId);
      if (!isUnique) {
        toast.error('PIN already in use', {
          description: 'This PIN is already used by another employee in your organization'
        });
        setLoading(false);
        return;
      }

      // Set the PIN
      const success = await setUserPin(userId, newPin, organizationId);
      if (success) {
        setCurrentPin(newPin);
        setShowPin(true);
        setNewPin('');
        setConfirmPin('');
        toast.success('PIN updated successfully', {
          description: `New PIN: ${newPin}`
        });
      } else {
        toast.error('Failed to update PIN');
      }
    } catch (error: any) {
      console.error('Error setting PIN:', error);
      toast.error('Failed to update PIN', {
        description: error.message || 'Please try again'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Manage PIN for {userName}
          </DialogTitle>
          <DialogDescription>
            View, reveal, or reset the employee's 4-digit PIN used for KB viewer access
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Current PIN Section */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Current PIN</Label>
            <div className="flex items-center gap-2">
              {fetchingPin ? (
                <div className="flex-1 h-10 bg-muted animate-pulse rounded-md" />
              ) : currentPin === null ? (
                <div className="flex-1 h-10 px-3 py-2 border rounded-md text-muted-foreground flex items-center">
                  No PIN set
                </div>
              ) : (
                <>
                  <Input
                    type={showPin ? 'text' : 'password'}
                    value={showPin ? currentPin : '••••'}
                    readOnly
                    className="flex-1 font-mono text-lg tracking-widest text-center"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowPin(!showPin)}
                    className="shrink-0"
                  >
                    {showPin ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </>
              )}
            </div>
            {currentPin === null && (
              <p className="text-xs text-muted-foreground">
                No PIN has been set for this employee yet
              </p>
            )}
          </div>

          {/* Quick Actions */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Quick Actions</Label>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleRevealPin}
                disabled={fetchingPin || currentPin === null}
                className="flex-1"
              >
                <Eye className="h-4 w-4 mr-2" />
                Reveal PIN
              </Button>
              <Button
                variant="outline"
                onClick={handleGeneratePin}
                disabled={loading || fetchingPin}
                className="flex-1"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Generate New
              </Button>
            </div>
          </div>

          {/* Set Custom PIN Section */}
          <div className="space-y-3 border-t pt-4">
            <Label className="text-sm font-medium">Set Custom PIN</Label>
            <div className="space-y-2">
              <div>
                <Label htmlFor="new-pin" className="text-xs text-muted-foreground">
                  New PIN (4 digits)
                </Label>
                <Input
                  id="new-pin"
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={newPin}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    setNewPin(value);
                  }}
                  placeholder="0000"
                  className="font-mono text-lg tracking-widest text-center"
                />
              </div>
              <div>
                <Label htmlFor="confirm-pin" className="text-xs text-muted-foreground">
                  Confirm PIN
                </Label>
                <Input
                  id="confirm-pin"
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={confirmPin}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    setConfirmPin(value);
                  }}
                  placeholder="0000"
                  className="font-mono text-lg tracking-widest text-center"
                />
              </div>
              <Button
                onClick={handleSetCustomPin}
                disabled={loading || newPin.length !== 4 || confirmPin.length !== 4}
                className="w-full"
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Key className="h-4 w-4 mr-2" />
                    Save Custom PIN
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

