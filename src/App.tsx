import React, { useState, useEffect } from 'react';
import { DashboardLayout } from './components/DashboardLayout';
import { Dashboard } from './components/Dashboard';
import { Reports } from './components/Reports';
import { Analytics } from './components/Analytics';
import { ContentAssignmentWizard } from './components/ContentAssignmentWizard';
import { ComplianceDashboard } from './components/ComplianceDashboard';
import { ComplianceAudit } from './components/ComplianceAudit';
import { People } from './components/People';
import { Units } from './components/Units';
import { ContentAuthoring } from './components/ContentAuthoring';
import { ContentLibrary } from './components/ContentLibrary';
import { Playlists } from './components/Playlists';
import { PlaylistWizard } from './components/PlaylistWizard';
import { KnowledgeBase } from './components/KnowledgeBase';
import { Forms } from './components/Forms';
import { Settings } from './components/Settings';
import { SuperAdminPasswordDialog } from './components/SuperAdminPasswordDialog';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner@2.0.3';

type UserRole = 'admin' | 'district-manager' | 'store-manager' | 'trike-super-admin';
type AppView = 'dashboard' | 'reports' | 'analytics' | 'compliance' | 'compliance-audit' | 'content' | 'assignments' | 'assignment' | 'playlist-wizard' | 'people' | 'units' | 'authoring' | 'forms' | 'knowledge-base' | 'settings';

export default function App() {
  const [currentRole, setCurrentRole] = useState<UserRole>(() => {
    // Check localStorage on mount
    const savedRole = localStorage.getItem('trike_current_role');
    return (savedRole as UserRole) || 'admin';
  });
  const [darkMode, setDarkMode] = useState(true);
  const [currentView, setCurrentView] = useState<AppView>('dashboard');
  const [showAssignmentWizard, setShowAssignmentWizard] = useState(false);
  const [editingArticle, setEditingArticle] = useState<any>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string | undefined>(undefined);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | undefined>(undefined);
  const [isSuperAdminAuthenticated, setIsSuperAdminAuthenticated] = useState<boolean>(() => {
    // Check localStorage on mount
    return localStorage.getItem('trike_super_admin_auth') === 'true';
  });
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [pendingRole, setPendingRole] = useState<UserRole | null>(null);

  // Apply dark mode class to document
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const handleRoleChange = (role: UserRole) => {
    const roleLabels = {
      'admin': 'Administrator',
      'district-manager': 'District Manager',
      'store-manager': 'Store Manager',
      'trike-super-admin': 'Trike Super Admin'
    };
    
    if (role === 'trike-super-admin') {
      setPendingRole(role);
      setShowPasswordPrompt(true);
    } else {
      setCurrentRole(role);
      localStorage.setItem('trike_current_role', role);
      
      // Show success toast with role change
      toast.success(`Switched to ${roleLabels[role]} view`, {
        description: 'Dashboard content has been updated to match your role permissions.',
        duration: 3000
      });
    }
  };

  const handleDarkModeToggle = () => {
    setDarkMode(prev => {
      const newMode = !prev;
      toast.success(`Switched to ${newMode ? 'dark' : 'light'} mode`, {
        duration: 2000
      });
      return newMode;
    });
  };

  const handleOpenAssignmentWizard = () => {
    if (currentView === 'assignments') {
      // If we're on playlists page, navigate to playlist wizard
      setCurrentView('playlist-wizard');
      toast.info('Opening playlist wizard...', {
        duration: 2000
      });
    } else {
      // Otherwise, open the old assignment wizard popup
      setShowAssignmentWizard(true);
      toast.info('Opening content assignment wizard...', {
        duration: 2000
      });
    }
  };

  const handleCloseAssignmentWizard = () => {
    setShowAssignmentWizard(false);
  };

  const handleViewReports = () => {
    setCurrentView('reports');
    toast.success('Opening Custom Reports...', {
      description: 'Loading interactive table-based reporting tools.',
      duration: 2000
    });
  };

  const handleViewAnalytics = () => {
    setCurrentView('analytics');
    toast.success('Opening Advanced Analytics...', {
      description: 'Loading comprehensive analytics and insights.',
      duration: 2000
    });
  };

  const handleNavigateToPlaylists = () => {
    setCurrentView('assignments');
    setSelectedPlaylistId(undefined); // Clear selection when going to list view
    toast.info('Opening Playlists...', {
      duration: 2000
    });
  };

  const handleNavigateToPlaylist = (playlistId: string) => {
    setCurrentView('assignments');
    setSelectedPlaylistId(playlistId);
    toast.info('Opening playlist details...', {
      duration: 2000
    });
  };

  const handleNavigateToUnits = (storeId?: string) => {
    setCurrentView('units');
    toast.info('Opening Units Management...', {
      duration: 2000
    });
    // TODO: If storeId is provided (e.g., '5'), navigate to that specific store's detail view
    setSelectedStoreId(storeId);
  };

  const handleBackToDashboard = () => {
    // If we're in playlist wizard, go back to playlists
    if (currentView === 'playlist-wizard') {
      setCurrentView('assignments');
      toast.info('Returning to Playlists', {
        duration: 1500
      });
    } else {
      setCurrentView('dashboard');
      toast.info('Returning to Dashboard', {
        duration: 1500
      });
    }
  };

  const handleEditArticle = (article: any) => {
    setEditingArticle(article);
    setCurrentView('authoring');
    toast.info('Opening article editor...', {
      duration: 2000
    });
  };

  const handleClearEditingArticle = () => {
    setEditingArticle(null);
  };

  const handleSuperAdminPasswordSubmit = (password: string) => {
    // Password check: sandbox2
    if (password === 'sandbox2') {
      localStorage.setItem('trike_super_admin_auth', 'true');
      localStorage.setItem('trike_current_role', pendingRole as UserRole);
      setIsSuperAdminAuthenticated(true);
      setCurrentRole(pendingRole as UserRole);
      toast.success('Super Admin authenticated successfully!', {
        duration: 3000
      });
    } else {
      toast.error('Incorrect password. Please try again.', {
        duration: 3000
      });
    }
    setShowPasswordPrompt(false);
    setPendingRole(null);
  };

  const handlePasswordDialogCancel = () => {
    setShowPasswordPrompt(false);
    setPendingRole(null);
    toast.info('Super Admin login cancelled', {
      duration: 2000
    });
  };

  return (
    <div className="min-h-screen">
      <DashboardLayout
        currentRole={currentRole}
        onRoleChange={handleRoleChange}
        darkMode={darkMode}
        onDarkModeToggle={handleDarkModeToggle}
        currentView={currentView}
        onNavigate={setCurrentView}
      >
        {currentView === 'dashboard' ? (
          <Dashboard 
            currentRole={currentRole} 
            onOpenAssignmentWizard={handleOpenAssignmentWizard}
            onViewReports={handleViewReports}
            onNavigateToPlaylists={handleNavigateToPlaylists}
            onNavigateToUnits={handleNavigateToUnits}
            onNavigateToStore={handleNavigateToUnits}
            onNavigateToPlaylist={handleNavigateToPlaylist}
          />
        ) : currentView === 'reports' ? (
          <Reports 
            currentRole={currentRole}
            onBackToDashboard={handleBackToDashboard}
          />
        ) : currentView === 'analytics' ? (
          <Analytics 
            currentRole={currentRole}
            onBackToDashboard={handleBackToDashboard}
          />
        ) : currentView === 'compliance' ? (
          <ComplianceDashboard 
            currentRole={currentRole}
            onBackToDashboard={handleBackToDashboard}
            onNavigate={setCurrentView}
          />
        ) : currentView === 'compliance-audit' ? (
          <ComplianceAudit 
            currentRole={currentRole}
          />
        ) : currentView === 'content' ? (
          <ContentLibrary 
            currentRole={currentRole}
            isSuperAdminAuthenticated={isSuperAdminAuthenticated}
          />
        ) : currentView === 'assignments' ? (
          <Playlists 
            currentRole={currentRole} 
            onOpenPlaylistWizard={handleOpenAssignmentWizard}
            selectedPlaylistId={selectedPlaylistId}
          />
        ) : currentView === 'playlist-wizard' ? (
          <PlaylistWizard
            isFullPage={true}
            onClose={handleBackToDashboard}
          />
        ) : currentView === 'people' ? (
          <People 
            currentRole={currentRole}
            onBackToDashboard={handleBackToDashboard}
          />
        ) : currentView === 'units' ? (
          <Units 
            currentRole={currentRole}
            onBackToDashboard={handleBackToDashboard}
            initialStoreId={selectedStoreId}
          />
        ) : currentView === 'authoring' ? (
          <ContentAuthoring 
            onNavigateToLibrary={() => setCurrentView('content')}
            currentRole={currentRole}
          />
        ) : currentView === 'forms' ? (
          <Forms 
            currentRole={currentRole}
          />
        ) : currentView === 'knowledge-base' ? (
          <KnowledgeBase 
            onNavigateToAssignment={() => setCurrentView('assignment')}
            onEditArticle={handleEditArticle}
            currentRole={currentRole}
          />
        ) : currentView === 'settings' ? (
          <Settings 
            currentRole={currentRole}
            onBackToDashboard={handleBackToDashboard}
          />
        ) : null}
      </DashboardLayout>

      {/* Content Assignment Wizard */}
      <ContentAssignmentWizard
        isOpen={showAssignmentWizard}
        onClose={handleCloseAssignmentWizard}
      />

      {/* Super Admin Password Dialog */}
      <SuperAdminPasswordDialog
        isOpen={showPasswordPrompt}
        onClose={() => setShowPasswordPrompt(false)}
        onSubmit={handleSuperAdminPasswordSubmit}
        onCancel={handlePasswordDialogCancel}
      />

      {/* Enhanced Toast Notifications */}
      <Toaster 
        position="top-right"
        expand={false}
        richColors
        toastOptions={{
          style: {
            background: 'var(--color-card)',
            color: 'var(--color-card-foreground)',
            border: '1px solid var(--color-border)'
          },
          className: 'font-medium',
          duration: 4000
        }}
      />
    </div>
  );
}