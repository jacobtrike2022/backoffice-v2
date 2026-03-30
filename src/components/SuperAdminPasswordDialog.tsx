import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Shield } from 'lucide-react';

interface SuperAdminPasswordDialogProps {
  onClose: () => void;
  onAuthenticate: (success: boolean) => void;
}

// Super admin password - in production this should be in environment variables
const SUPER_ADMIN_PASSWORD = 'simple2';

export function SuperAdminPasswordDialog({
  onClose,
  onAuthenticate
}: SuperAdminPasswordDialogProps) {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const isValid = password === SUPER_ADMIN_PASSWORD;
    onAuthenticate(isValid);
    setPassword(''); // Clear password after submission
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <DialogTitle>{t('common.superAdminAccessTitle')}</DialogTitle>
          </div>
          <DialogDescription>
            {t('common.superAdminAccessDesc')}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="password">{t('common.password')}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('common.enterSuperAdminPassword')}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit">
              {t('common.authenticate')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
