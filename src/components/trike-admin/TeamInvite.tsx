import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Loader2, UserPlus, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { createUser } from '../../lib/crud/users';

interface TeamInviteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId?: string;
}

interface InviteResult {
  email: string;
  success: boolean;
  error?: string;
}

// Roles allowed for prospect team invites
const ALLOWED_ROLE_NAMES = ['Team Member', 'Store Manager'];
const MAX_INVITES = 10;

export function TeamInvite({ open, onOpenChange, organizationId }: TeamInviteProps) {
  const [emailsText, setEmailsText] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [roles, setRoles] = useState<Array<{ id: string; name: string }>>([]);
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<InviteResult[]>([]);
  const [done, setDone] = useState(false);

  // Fetch available roles when dialog opens
  useEffect(() => {
    if (!open || !organizationId) return;
    fetchRoles();
  }, [open, organizationId]);

  async function fetchRoles() {
    const { data } = await supabase
      .from('roles')
      .select('id, name')
      .eq('organization_id', organizationId!);

    if (data) {
      const filtered = data.filter((r) =>
        ALLOWED_ROLE_NAMES.some((allowed) =>
          r.name.toLowerCase() === allowed.toLowerCase()
        )
      );
      setRoles(filtered);
      if (filtered.length > 0 && !selectedRoleId) {
        setSelectedRoleId(filtered[0].id);
      }
    }
  }

  function parseEmails(text: string): string[] {
    return text
      .split(/[,\n;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes('@') && e.length > 3);
  }

  async function handleSendInvites() {
    const emails = parseEmails(emailsText);
    if (emails.length === 0 || !selectedRoleId) return;

    const toInvite = emails.slice(0, MAX_INVITES);
    setSending(true);
    setResults([]);

    const inviteResults: InviteResult[] = [];

    for (const email of toInvite) {
      try {
        // Derive placeholder name from email prefix
        const namePart = email.split('@')[0];
        const firstName = namePart.split(/[._-]/)[0] || 'Invited';
        const lastName = namePart.split(/[._-]/)[1] || 'User';

        await createUser({
          email,
          first_name: firstName.charAt(0).toUpperCase() + firstName.slice(1),
          last_name: lastName.charAt(0).toUpperCase() + lastName.slice(1),
          role_id: selectedRoleId,
          organization_id: organizationId,
        });

        inviteResults.push({ email, success: true });
      } catch (err: any) {
        inviteResults.push({
          email,
          success: false,
          error: err.message || 'Failed to invite',
        });
      }
    }

    setResults(inviteResults);
    setDone(true);
    setSending(false);
  }

  function handleClose() {
    onOpenChange(false);
    setTimeout(() => {
      setEmailsText('');
      setSelectedRoleId(roles[0]?.id || '');
      setResults([]);
      setDone(false);
    }, 300);
  }

  const emails = parseEmails(emailsText);
  const emailCount = emails.length;
  const overLimit = emailCount > MAX_INVITES;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Invite Team Members
          </DialogTitle>
        </DialogHeader>

        {done ? (
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              {results.map((r) => (
                <div
                  key={r.email}
                  className="flex items-center gap-2 text-sm"
                >
                  {r.success ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600 shrink-0" />
                  )}
                  <span className="truncate">{r.email}</span>
                  {r.error && (
                    <span className="text-red-600 text-xs ml-auto">
                      {r.error}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="text-sm text-muted-foreground">
              {results.filter((r) => r.success).length} of {results.length}{' '}
              invites sent successfully
            </div>
            <Button onClick={handleClose} className="w-full">
              Done
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-4 py-2">
              <div>
                <Label htmlFor="invite-emails">
                  Email Addresses{' '}
                  <span className="text-muted-foreground font-normal">
                    (comma or newline separated)
                  </span>
                </Label>
                <Textarea
                  id="invite-emails"
                  placeholder={'jane@company.com\njohn@company.com'}
                  value={emailsText}
                  onChange={(e) => setEmailsText(e.target.value)}
                  rows={4}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {emailCount} email{emailCount !== 1 ? 's' : ''} detected
                  {overLimit && (
                    <span className="text-amber-600">
                      {' '}
                      (max {MAX_INVITES}, extras will be skipped)
                    </span>
                  )}
                </p>
              </div>

              <div>
                <Label htmlFor="invite-role">Role</Label>
                {roles.length > 0 ? (
                  <Select
                    value={selectedRoleId || roles[0]?.id}
                    onValueChange={setSelectedRoleId}
                  >
                    <SelectTrigger id="invite-role" className="mt-1">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-muted-foreground mt-1">
                    Loading roles...
                  </p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleSendInvites}
                disabled={emailCount === 0 || !selectedRoleId || sending}
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Send {emailCount > 0 ? emailCount : ''} Invite
                {emailCount !== 1 ? 's' : ''}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
