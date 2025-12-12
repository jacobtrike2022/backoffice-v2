import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

interface LinkAuthUserModalProps {
  onClose: () => void;
  onLink?: () => void;
}

export function LinkAuthUserModal({ onClose, onLink }: LinkAuthUserModalProps) {
  const [authUserId, setAuthUserId] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    loadCurrentUser();
    loadUsers();
  }, []);

  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setAuthUserId(user.id);
      setEmail(user.email || '');
    }
  };

  const loadUsers = async () => {
    const { data } = await supabase
      .from('users')
      .select('id, first_name, last_name, email, auth_user_id')
      .order('first_name');
    
    if (data) {
      setUsers(data);
    }
  };

  const handleLink = async () => {
    if (!selectedUserId || !authUserId) {
      toast.error('Please select a user');
      return;
    }

    setLinking(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ auth_user_id: authUserId })
        .eq('id', selectedUserId);

      if (error) throw error;

      toast.success('Successfully linked your account!');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      if (onLink) {
        onLink();
      }
    } catch (error: any) {
      console.error('Error linking account:', error);
      toast.error(`Failed to link: ${error.message}`);
    } finally {
      setLinking(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-card rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col border border-border">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-foreground font-semibold">Link Auth User to Profile</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Connect your authentication account to your user profile
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Current Auth User */}
          <div className="bg-accent/50 rounded-lg p-4 border border-border">
            <h3 className="font-medium text-foreground mb-2">Your Auth Account:</h3>
            <div className="text-sm space-y-1">
              <p className="text-muted-foreground">
                <span className="font-medium">Email:</span> {email}
              </p>
              <p className="text-muted-foreground font-mono text-xs">
                <span className="font-medium">Auth ID:</span> {authUserId}
              </p>
            </div>
          </div>

          {/* User Selection */}
          <div>
            <h3 className="font-medium text-foreground mb-3">Select Your User Profile:</h3>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {users.map((user) => (
                <button
                  key={user.id}
                  onClick={() => setSelectedUserId(user.id)}
                  className={`w-full text-left p-4 rounded-lg border transition-colors ${
                    selectedUserId === user.id
                      ? 'border-primary bg-accent'
                      : 'border-border hover:border-primary hover:bg-accent'
                  } ${user.auth_user_id ? 'opacity-50' : ''}`}
                  disabled={!!user.auth_user_id}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-foreground">
                        {user.first_name} {user.last_name}
                      </p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                      {user.auth_user_id && (
                        <p className="text-xs text-yellow-600 mt-1">
                          ⚠️ Already linked to another auth account
                        </p>
                      )}
                    </div>
                    {selectedUserId === user.id && (
                      <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              <strong>Note:</strong> This will permanently link your authentication account to the selected user profile. 
              This action is needed because your user was created without being linked to your Supabase Auth account.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={linking}>
            Cancel
          </Button>
          <Button onClick={handleLink} disabled={!selectedUserId || linking}>
            {linking ? 'Linking...' : 'Link Account'}
          </Button>
        </div>
      </div>
    </div>
  );
}