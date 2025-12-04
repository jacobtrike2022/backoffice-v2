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
import { Organization } from './components/Organization';
import { ContentAuthoring } from './components/ContentAuthoring';
import { ContentLibrary } from './components/ContentLibrary';
import { Playlists } from './components/Playlists';
import { PlaylistWizard } from './components/PlaylistWizard';
import { KnowledgeBaseRevamp } from './components/KnowledgeBaseRevamp';
import { Forms } from './components/Forms';
import { Settings } from './components/Settings';
import { SuperAdminPasswordDialog } from './components/SuperAdminPasswordDialog';
import { UnsavedChangesDialog } from './components/UnsavedChangesDialog';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner@2.0.3';

type UserRole = 'admin' | 'district-manager' | 'store-manager' | 'trike-super-admin';
type AppView = 'dashboard' | 'reports' | 'analytics' | 'compliance' | 'compliance-audit' | 'content' | 'assignments' | 'assignment' | 'playlist-wizard' | 'people' | 'units' | 'organization' | 'authoring' | 'forms' | 'knowledge-base' | 'settings';

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
  const [editingPlaylistId, setEditingPlaylistId] = useState<string | undefined>(undefined);
  const [initialTrackId, setInitialTrackId] = useState<string | undefined>(undefined); // For URL-based track loading
  const [initialMode, setInitialMode] = useState<'create-article' | null>(null);
  const [previousView, setPreviousView] = useState<AppView | null>(null); // Track where user came from
  const [isSuperAdminAuthenticated, setIsSuperAdminAuthenticated] = useState<boolean>(() => {
    // Check localStorage on mount
    return localStorage.getItem('trike_super_admin_auth') === 'true';
  });
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [pendingRole, setPendingRole] = useState<UserRole | null>(null);

  // Unsaved changes tracking
  const [hasUnsavedChangesRef, setHasUnsavedChangesRef] = useState<(() => boolean) | null>(null);
  const [pendingNavigationView, setPendingNavigationView] = useState<AppView | null>(null);
  const [showUnsavedChangesWarning, setShowUnsavedChangesWarning] = useState(false);

  // Register unsaved changes check from child components
  const registerUnsavedChangesCheck = (checkFn: (() => boolean) | null) => {
    console.log('📝 App: Registering unsaved changes check:', !!checkFn);
    setHasUnsavedChangesRef(() => checkFn);
  };

  // Check for unsaved changes before navigation
  const checkUnsavedBeforeNavigate = (targetView: AppView): boolean => {
    console.log('🔍 App: Checking for unsaved changes before navigating to:', targetView);
    
    if (hasUnsavedChangesRef && hasUnsavedChangesRef()) {
      console.log('⚠️ App: Unsaved changes detected, blocking navigation');
      setPendingNavigationView(targetView);
      setShowUnsavedChangesWarning(true);
      return false; // Navigation blocked
    }
    
    console.log('✅ App: No unsaved changes, allowing navigation');
    return true; // Navigation allowed
  };

  // Handle discard from navigation warning
  const handleDiscardChanges = () => {
    console.log('🗑️ App: Discarding changes and navigating to:', pendingNavigationView);
    setShowUnsavedChangesWarning(false);
    if (pendingNavigationView) {
      setCurrentView(pendingNavigationView);
      setPendingNavigationView(null);
    }
    setHasUnsavedChangesRef(() => null);
  };

  // Handle cancel from navigation warning
  const handleCancelNavigation = () => {
    console.log('❌ App: Navigation cancelled');
    setShowUnsavedChangesWarning(false);
    setPendingNavigationView(null);
  };

  // Navigation helper - use this instead of window.location.href to avoid hard reloads
  const navigateToPlaylist = (playlistId: string) => {
    console.log('📍 Navigation: Going to playlist:', playlistId);
    // Save current view before navigating
    setPreviousView(currentView);
    setSelectedPlaylistId(playlistId);
    setCurrentView('assignments');
    // Update URL without reload
    window.history.pushState({}, '', `/playlist/${playlistId}`);
  };

  const navigateToTrack = (trackId: string, trackType: 'article' | 'video' | 'checkpoint' | 'story') => {
    console.log(`📍 Navigation: Going to ${trackType}:`, trackId);
    
    // Load the track
    import('./lib/crud').then(crud => {
      crud.getTracks({ ids: [trackId], includeAllVersions: true }).then(tracks => {
        if (tracks && tracks.length > 0) {
          setEditingArticle(tracks[0]);
          
          // Route to appropriate view
          if (trackType === 'article' || trackType === 'video') {
            setCurrentView('content');
            setInitialTrackId(trackId);
          } else if (trackType === 'checkpoint' || trackType === 'story') {
            setCurrentView('authoring');
            setInitialTrackId(trackId);
          }
          
          // Update URL without reload
          window.history.pushState({}, '', `/${trackType}/${trackId}`);
        }
      });
    });
  };

  // Apply dark mode class to document
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Handle URL-based routing for direct article links
  useEffect(() => {
    const path = window.location.pathname;
    
    // Check for /article/{id}, /video/{id}, /checkpoint/{id}, /story/{id} patterns
    const articleMatch = path.match(/\/article\/([a-f0-9-]+)/);
    const videoMatch = path.match(/\/video\/([a-f0-9-]+)/);
    const checkpointMatch = path.match(/\/checkpoint\/([a-f0-9-]+)/);
    const storyMatch = path.match(/\/story\/([a-f0-9-]+)/);
    const playlistMatch = path.match(/\/playlist\/([a-f0-9-]+)/);
    
    const trackMatch = articleMatch || videoMatch || checkpointMatch || storyMatch;
    
    if (playlistMatch) {
      const playlistId = playlistMatch[1];
      console.log('📍 URL routing: Detected playlist URL, loading playlist:', playlistId);
      
      // Navigate to playlist detail view
      setSelectedPlaylistId(playlistId);
      setCurrentView('assignments');
      
      return; // Exit early so we don't process track routing
    }
    
    if (trackMatch) {
      const trackId = trackMatch[1];
      const trackType = articleMatch ? 'article' : videoMatch ? 'video' : checkpointMatch ? 'checkpoint' : 'story';
      console.log(`📍 URL routing: Detected ${trackType} URL, loading track:`, trackId);
      
      // Load the track and switch to appropriate view
      import('./lib/crud').then(crud => {
        crud.getTracks({ ids: [trackId], includeAllVersions: true }).then(tracks => {
          if (tracks && tracks.length > 0) {
            console.log(`📍 URL routing: ${trackType} loaded, switching to view`);
            setEditingArticle(tracks[0]);
            
            // Route to appropriate view based on track type
            if (trackType === 'article' || trackType === 'video') {
              setCurrentView('content');
              setInitialTrackId(trackId);
            } else if (trackType === 'checkpoint' || trackType === 'story') {
              setCurrentView('authoring');
              setInitialTrackId(trackId);
            }
          } else {
            console.error(`📍 URL routing: ${trackType} not found`);
            toast.error(`${trackType.charAt(0).toUpperCase() + trackType.slice(1)} not found`);
            // Clear the URL and go back to dashboard
            window.history.replaceState({}, '', '/');
            setCurrentView('dashboard');
          }
        }).catch(error => {
          console.error(`📍 URL routing: Error loading ${trackType}:`, error);
          toast.error(`Failed to load ${trackType}`);
          window.history.replaceState({}, '', '/');
          setCurrentView('dashboard');
        });
      });
    }
  }, []); // Run only once on mount

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
    navigateToPlaylist(playlistId);
  };

  const handleEditPlaylist = (playlistId: string) => {
    setEditingPlaylistId(playlistId);
    setCurrentView('playlist-wizard');
    toast.info('Opening playlist editor...', {
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

  const handleCreateArticle = () => {
    setInitialMode('create-article');
    setEditingArticle(null);
    setInitialTrackId(undefined);
    setCurrentView('authoring');
    toast.info('Starting new article...', { duration: 2000 });
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
        onNavigate={(view) => {
          // Check for unsaved changes before navigation
          if (!checkUnsavedBeforeNavigate(view as AppView)) {
            return; // Navigation blocked, dialog will be shown
          }
          
          // No unsaved changes, proceed with navigation
          setCurrentView(view);
          // Reset track selection when navigating to content library
          if (view === 'content') {
            setInitialTrackId(undefined);
          }
          // Reset track selection when navigating to authoring
          if (view === 'authoring') {
            setInitialTrackId(undefined);
            setInitialMode(null);
          }
        }}
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
            initialTrackId={initialTrackId}
            onNavigateToPlaylist={navigateToPlaylist}
            onBackToLibrary={() => {
              // Reset initialTrackId to ensure library view is shown
              setInitialTrackId(undefined);
            }}
            registerUnsavedChangesCheck={registerUnsavedChangesCheck}
          />
        ) : currentView === 'assignments' ? (
          <Playlists 
            currentRole={currentRole} 
            onOpenPlaylistWizard={handleOpenAssignmentWizard}
            onEditPlaylist={handleEditPlaylist}
            selectedPlaylistId={selectedPlaylistId}
            previousView={previousView}
            onBackToPreviousView={() => {
              if (previousView) {
                console.log('📍 Navigation: Going back to previous view:', previousView);
                setCurrentView(previousView);
                setPreviousView(null);
                setSelectedPlaylistId(undefined);
              } else {
                // Default to playlist list view
                setSelectedPlaylistId(undefined);
              }
            }}
          />
        ) : currentView === 'playlist-wizard' ? (
          <PlaylistWizard
            isFullPage={true}
            onClose={() => {
              setEditingPlaylistId(undefined);
              handleBackToDashboard();
            }}
            mode={editingPlaylistId ? 'edit' : 'create'}
            existingPlaylistId={editingPlaylistId}
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
        ) : currentView === 'organization' ? (
          <Organization 
            currentRole={currentRole}
            onBackToDashboard={handleBackToDashboard}
          />
        ) : currentView === 'authoring' ? (
          <ContentAuthoring 
            onNavigateToLibrary={() => setCurrentView('content')}
            currentRole={currentRole}
            initialTrackId={initialTrackId}
            initialMode={initialMode}
            onNavigateToPlaylist={navigateToPlaylist}
          />
        ) : currentView === 'forms' ? (
          <Forms 
            currentRole={currentRole}
          />
        ) : currentView === 'knowledge-base' ? (
          <KnowledgeBaseRevamp 
            currentRole={currentRole}
            onTrackClick={(trackId) => navigateToTrack(trackId, 'article')}
            onCreateArticle={handleCreateArticle}
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

      {/* Unsaved Changes Dialog */}
      <UnsavedChangesDialog
        open={showUnsavedChangesWarning}
        onOpenChange={setShowUnsavedChangesWarning}
        onDiscard={handleDiscardChanges}
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