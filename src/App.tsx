import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from './lib/hooks/useAuth';
import Login from './components/Login';
import { DashboardLayout } from "./components/DashboardLayout";
import { Dashboard } from "./components/Dashboard";
import { reindexAllTracks, backfillBrainIndex } from './lib/utils/brainIndexer';
import { getCurrentUserOrgId } from './lib/supabase';

// Expose brain indexing utilities globally for console access
// Usage: window.brainUtils.reindexAll() or window.brainUtils.backfill()
if (typeof window !== 'undefined') {
  (window as any).brainUtils = {
    reindexAll: async () => {
      const orgId = await getCurrentUserOrgId();
      if (!orgId) {
        console.error('Not logged in or no organization found');
        return;
      }
      console.log(`Starting re-index for org: ${orgId}`);
      return reindexAllTracks(orgId);
    },
    backfill: async () => {
      const orgId = await getCurrentUserOrgId();
      if (!orgId) {
        console.error('Not logged in or no organization found');
        return;
      }
      console.log(`Starting backfill for org: ${orgId}`);
      return backfillBrainIndex(orgId);
    },
    reindexAllTracks,
    backfillBrainIndex,
  };
  console.log('[Brain] Utils available at window.brainUtils - use window.brainUtils.reindexAll() to re-index all content');
}
import { Reports } from "./components/Reports";
import { Analytics } from "./components/Analytics";
import { ContentAssignmentWizard } from "./components/ContentAssignmentWizard";
import { ComplianceDashboard } from "./components/ComplianceDashboard";
import { ComplianceAudit } from "./components/ComplianceAudit";
import { People } from "./components/People";
import { Units } from "./components/Units";
import { NewUnit } from "./components/NewUnit";
import { Organization } from "./components/Organization";
import { ContentAuthoring } from "./components/ContentAuthoring";
import { ContentLibrary } from "./components/ContentLibrary";
import { AIReview } from "./components/AIReview";
import { Playlists } from "./components/Playlists";
import { PlaylistWizard } from "./components/PlaylistWizard";
import { KnowledgeBaseRevamp } from "./components/KnowledgeBaseRevamp";
import { Forms } from "./components/Forms";
import { Settings } from "./components/Settings";
import { SuperAdminPasswordDialog } from "./components/SuperAdminPasswordDialog";
import { UnsavedChangesDialog } from "./components/UnsavedChangesDialog";
import { SupabaseDiagnostics } from "./components/SupabaseDiagnostics";
import { PublicKBViewer } from "./components/PublicKBViewer";
import { OnboardingPage } from "./components/Onboarding";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { PlaybookBuildView } from "./components/playbook";
import { Toaster } from "./components/ui/sonner";
import { toast } from "sonner@2.0.3";
import { checkServerHealth } from "./lib/serverHealth";

type UserRole =
  | "admin"
  | "district-manager"
  | "store-manager"
  | "trike-super-admin";
type AppView =
  | "dashboard"
  | "reports"
  | "analytics"
  | "compliance"
  | "compliance-audit"
  | "content"
  | "assignments"
  | "assignment"
  | "playlist-wizard"
  | "playbook-build"
  | "people"
  | "units"
  | "new-unit"
  | "organization"
  | "authoring"
  | "ai-review"
  | "forms"
  | "knowledge-base"
  | "settings";

export default function App() {
  const { user, loading: authLoading } = useAuth();

  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
  const [currentRole, setCurrentRole] = useState<UserRole>(
    () => {
      // Check localStorage on mount
      const savedRole = localStorage.getItem(
        "trike_current_role",
      );
      return (savedRole as UserRole) || "admin";
    },
  );
  const [darkMode, setDarkMode] = useState(true);
  const [currentView, setCurrentView] =
    useState<AppView>("dashboard");
  const [showAssignmentWizard, setShowAssignmentWizard] =
    useState(false);
  const [editingArticle, setEditingArticle] =
    useState<any>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<
    string | undefined
  >(undefined);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<
    string | undefined
  >(undefined);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);
  const [editingPlaylistId, setEditingPlaylistId] = useState<
    string | undefined
  >(undefined);
  const [initialTrackId, setInitialTrackId] = useState<
    string | undefined
  >(undefined); // For URL-based track loading
  const [initialMode, setInitialMode] = useState<
    "create-article" | null
  >(null);
  const [previousView, setPreviousView] =
    useState<AppView | null>(null); // Track where user came from
  const [contentLibraryKey, setContentLibraryKey] = useState(0); // Key to force ContentLibrary reset
  const [knowledgeBaseKey, setKnowledgeBaseKey] = useState(0); // Key to force KnowledgeBase reset
  const [playbookSourceFileId, setPlaybookSourceFileId] = useState<string | null>(null); // For playbook build view
  const [
    isSuperAdminAuthenticated,
    setIsSuperAdminAuthenticated,
  ] = useState<boolean>(() => {
    // Check localStorage on mount
    return (
      localStorage.getItem("trike_super_admin_auth") === "true"
    );
  });
  const [showPasswordPrompt, setShowPasswordPrompt] =
    useState(false);
  const [pendingRole, setPendingRole] =
    useState<UserRole | null>(null);

  // Unsaved changes tracking
  const [hasUnsavedChangesRef, setHasUnsavedChangesRef] =
    useState<(() => boolean) | null>(null);
  const [pendingNavigationView, setPendingNavigationView] =
    useState<AppView | null>(null);

  // Persist role changes to localStorage
  useEffect(() => {
    localStorage.setItem("trike_current_role", currentRole);
  }, [currentRole]);

  // Persist super admin auth state
  useEffect(() => {
    localStorage.setItem(
      "trike_super_admin_auth",
      isSuperAdminAuthenticated ? "true" : "false",
    );
  }, [isSuperAdminAuthenticated]);

  // Apply dark mode to document
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Server health check on mount (silent - warnings are logged to console only)
  useEffect(() => {
    checkServerHealth().catch(() => {
      // Silent catch - health check already logs warnings internally
    });
  }, []);

  // URL parsing for direct deep links (e.g. /?track=abc&type=article)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const trackId = urlParams.get("track");
    const trackType = urlParams.get("type") as
      | "article"
      | "video"
      | "checkpoint"
      | "story"
      | null;

    if (trackId && trackType) {
      // Dynamically import crud to avoid circular dependencies
      import("./lib/crud").then((crud) => {
        crud
          .getTracks({
            ids: [trackId],
            includeAllVersions: true,
          })
          .then((tracks) => {
            if (tracks && tracks.length > 0) {
              setEditingArticle(tracks[0]);

              // Route to appropriate view
              if (
                trackType === "article" ||
                trackType === "video"
              ) {
                setCurrentView("content");
                setInitialTrackId(trackId);
              } else if (
                trackType === "checkpoint" ||
                trackType === "story"
              ) {
                setCurrentView("authoring");
                setInitialTrackId(trackId);
              }

              // Clear URL params after routing
              window.history.replaceState(
                {},
                "",
                window.location.pathname,
              );
            }
          });
      });
    }

    // Check for create-article mode
    const mode = urlParams.get("mode");
    if (mode === "create-article") {
      setInitialMode("create-article");
      setCurrentView("content");

      // Clear URL params
      window.history.replaceState(
        {},
        "",
        window.location.pathname,
      );
    }

    // Check for tab=sources navigation (deep link to source document)
    const tab = urlParams.get("tab");
    if (tab === "sources") {
      setCurrentView("organization");
      // Don't clear params here - Organization component will handle sourceFileId
    }
  }, []);

  // Additional URL routing for tracks created from playlists
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const trackId = urlParams.get("track");
    const trackType = urlParams.get("type") as
      | "article"
      | "video"
      | "checkpoint"
      | "story"
      | null;
    const playlistId = urlParams.get("playlist");

    if (trackId && trackType && playlistId) {
      import("./lib/crud").then((crud) => {
        crud
          .getTracks({
            ids: [trackId],
            includeAllVersions: true,
          })
          .then((tracks) => {
            if (tracks && tracks.length > 0) {
              setEditingArticle(tracks[0]);

              // Route to appropriate view based on track type
              if (
                trackType === "article" ||
                trackType === "video"
              ) {
                setCurrentView("content");
                setInitialTrackId(trackId);
              } else if (
                trackType === "checkpoint" ||
                trackType === "story"
              ) {
                setCurrentView("authoring");
                setInitialTrackId(trackId);
              }

              // Store the playlist ID for back navigation
              setSelectedPlaylistId(playlistId);

              // Clear URL params after routing
              window.history.replaceState(
                {},
                "",
                window.location.pathname,
              );
            }
          })
          .catch(() => {
            // Silent catch
          });
      });
    }
  }, []);

  const requestNavigate = (view: AppView) => {
    // Check if there are unsaved changes
    if (hasUnsavedChangesRef && hasUnsavedChangesRef()) {
      setPendingNavigationView(view);
      return;
    }

    // No unsaved changes, navigate immediately
    handleNavigate(view);
  };

  const handleNavigate = (view: AppView) => {
    // Clear editing context when navigating away from content/authoring
    if (
      currentView === "content" ||
      currentView === "authoring"
    ) {
      setEditingArticle(null);
      setInitialTrackId(undefined);
      setInitialMode(null);
    }

    // Clear playlist wizard state when navigating away from playlist-wizard
    if (currentView === "playlist-wizard") {
      setEditingPlaylistId(undefined);
    }

    // Clear album/playlist selection when navigating away from assignments
    if (currentView === "assignments" && view !== "assignments") {
      setSelectedPlaylistId(undefined);
      setSelectedAlbumId(null);
    }

    // When navigating to content view, increment key to force ContentLibrary reset
    if (view === "content" && initialTrackId === undefined) {
      setContentLibraryKey(prev => prev + 1);
    }

    // When navigating to knowledge-base view, increment key to force reset
    if (view === "knowledge-base") {
      setKnowledgeBaseKey(prev => prev + 1);
    }

    // Store previous view for back navigation
    setPreviousView(currentView);
    setCurrentView(view);
  };

  const handleRoleChange = (newRole: UserRole) => {
    if (
      newRole === "trike-super-admin" &&
      !isSuperAdminAuthenticated
    ) {
      setPendingRole(newRole);
      setShowPasswordPrompt(true);
    } else {
      setCurrentRole(newRole);
    }
  };

  const handleSuperAdminAuth = (success: boolean) => {
    setShowPasswordPrompt(false);

    if (success) {
      setIsSuperAdminAuthenticated(true);
      if (pendingRole) {
        setCurrentRole(pendingRole);
        setPendingRole(null);
      }
      toast.success("Super Admin access granted");
    } else {
      setPendingRole(null);
      toast.error("Invalid super admin password");
    }
  };

  const handleEditTrack = (track: any) => {
    setEditingArticle(track);
    setInitialTrackId(track.id);

    // Route to appropriate view based on track type
    if (track.type === "article" || track.type === "video") {
      setPreviousView(currentView);
      setCurrentView("content");
    } else if (
      track.type === "checkpoint" ||
      track.type === "story"
    ) {
      setPreviousView(currentView);
      setCurrentView("authoring");
    }
  };

  const handleBackFromContentAuthoring = () => {
    // Return to previous view or default to dashboard
    const targetView = previousView || "dashboard";

    // Clear editing state
    setEditingArticle(null);
    setInitialTrackId(undefined);
    setInitialMode(null);
    setPreviousView(null);

    setCurrentView(targetView);
  };

  const handleRegisterUnsavedChangesCheck = useCallback((checkFn: (() => boolean) | null) => {
    setHasUnsavedChangesRef(() => checkFn);
  }, []);

  const renderContent = () => {
    switch (currentView) {
      case "dashboard":
        return (
          <Dashboard
            currentRole={currentRole}
            onNavigate={requestNavigate}
          />
        );
      case "reports":
        return <Reports role={currentRole} />;
      case "analytics":
        return <Analytics role={currentRole} />;
      case "compliance":
        return (
          <ComplianceDashboard
            currentRole={currentRole}
            onNavigate={requestNavigate}
          />
        );
      case "compliance-audit":
        return <ComplianceAudit role={currentRole} />;
      case "content":
        return (
          <ContentLibrary
            key={`content-library-${contentLibraryKey}`}
            currentRole={currentRole}
            isSuperAdminAuthenticated={isSuperAdminAuthenticated}
            initialTrackId={initialTrackId}
            onBackToLibrary={handleBackFromContentAuthoring}
            registerUnsavedChangesCheck={handleRegisterUnsavedChangesCheck}
            onNavigateToPlaylist={(playlistId: string) => {
              setSelectedPlaylistId(playlistId);
              setPreviousView('content');
              requestNavigate("assignments");
            }}
            onNavigateToAlbum={(albumId: string) => {
              setSelectedAlbumId(albumId);
              setPreviousView('content');
              requestNavigate("assignments");
            }}
            onNavigate={(view: string, trackId?: string) => {
              if (view === 'authoring') {
                setPreviousView('content');
                setInitialMode(null);
                // If trackId provided, open that track for editing; otherwise clear for new content
                setInitialTrackId(trackId || undefined);
                requestNavigate('authoring');
              }
            }}
          />
        );
      case "assignments":
        return (
          <Playlists
            currentRole={currentRole}
            onOpenPlaylistWizard={() => {
              setEditingPlaylistId(undefined);
              requestNavigate("playlist-wizard");
            }}
            onEditPlaylist={(playlistId: string) => {
              setEditingPlaylistId(playlistId);
              requestNavigate("playlist-wizard");
            }}
            selectedPlaylistId={selectedPlaylistId || undefined}
            selectedAlbumId={selectedAlbumId || undefined}
            initialTab={selectedAlbumId ? 'albums' : 'playlists'}
            previousView={previousView}
            onBackToPreviousView={() => {
              setSelectedPlaylistId(undefined);
              setSelectedAlbumId(null);
              setPreviousView(null);
            }}
          />
        );
      case "assignment":
        return (
          <Playlists
            currentRole={currentRole}
            onOpenPlaylistWizard={() => {
              setEditingPlaylistId(undefined);
              requestNavigate("playlist-wizard");
            }}
            onEditPlaylist={(playlistId: string) => {
              setEditingPlaylistId(playlistId);
              requestNavigate("playlist-wizard");
            }}
          />
        );
      case "playlist-wizard":
        return (
          <PlaylistWizard
            mode={editingPlaylistId ? 'edit' : 'create'}
            existingPlaylistId={editingPlaylistId}
            onClose={() => {
              setEditingPlaylistId(undefined);
              requestNavigate("assignments");
            }}
            registerUnsavedChangesCheck={(checkFn) =>
              setHasUnsavedChangesRef(() => checkFn)
            }
          />
        );
      case "playbook-build":
        console.log('[App] playbook-build view - playbookSourceFileId:', playbookSourceFileId);
        return playbookSourceFileId ? (
          <PlaybookBuildView
            sourceFileId={playbookSourceFileId}
            onBack={() => {
              setPlaybookSourceFileId(null);
              requestNavigate("organization");
            }}
            onComplete={(albumId: string) => {
              setPlaybookSourceFileId(null);
              setSelectedAlbumId(albumId);
              requestNavigate("assignments");
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500">No source file selected</p>
          </div>
        );
      case "people":
        return <People currentRole={currentRole} onBackToDashboard={() => requestNavigate("dashboard")} />;
      case "units":
        return (
          <Units
            role={currentRole}
            selectedStoreId={selectedStoreId}
            onStoreSelect={(storeId) => {
              setSelectedStoreId(storeId);
              requestNavigate("assignment");
            }}
            onNavigate={requestNavigate}
          />
        );
      case "new-unit":
        return (
          <NewUnit
            onBack={() => requestNavigate("units")}
            onSuccess={() => requestNavigate("units")}
          />
        );
      case "organization":
        return (
          <Organization
            role={currentRole}
            onNavigate={requestNavigate}
            onStartPlaybook={(sourceFileId: string) => {
              console.log('[App] onStartPlaybook called with sourceFileId:', sourceFileId);
              setPlaybookSourceFileId(sourceFileId);
              requestNavigate("playbook-build");
            }}
            onNavigateToTrack={(trackId: string) => {
              setInitialTrackId(trackId);
              setPreviousView('organization');
              requestNavigate("content");
            }}
          />
        );
      case "authoring":
        return (
          <ContentAuthoring
            currentRole={currentRole}
            editingArticle={editingArticle}
            onClearEditingArticle={() => setEditingArticle(null)}
            initialTrackId={initialTrackId}
            initialMode={initialMode}
            onBackClick={handleBackFromContentAuthoring}
            previousView={previousView}
            onRegisterUnsavedChangesCheck={handleRegisterUnsavedChangesCheck}
            onNavigateToLibrary={() => requestNavigate("content")}
          />
        );
      case "ai-review":
        return <AIReview onBack={() => requestNavigate("organization")} />;
      case "forms":
        return <Forms role={currentRole} />;
      case "knowledge-base":
        return (
          <KnowledgeBaseRevamp
            key={`knowledge-base-${knowledgeBaseKey}`}
            currentRole={currentRole}
            onEditTrack={handleEditTrack}
            onCreateArticle={() => {
              setPreviousView("knowledge-base");
              setInitialMode("create-article");
              setCurrentView("authoring");
            }}
          />
        );
      case "settings":
        return <Settings role={currentRole} />;
      default:
        return (
          <Dashboard
            currentRole={currentRole}
            onNavigate={requestNavigate}
          />
        );
    }
  };

  // Check if this is a public KB viewer request (NO AUTH REQUIRED)
  const urlParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  const slug = urlParams.get("slug") || hashParams.get("slug");
  const isPublicKBView = !!slug || window.location.pathname.includes("kb-public");

  // Check if this is the onboarding flow (NO AUTH REQUIRED)
  const isOnboardingView = window.location.pathname.includes("onboarding") ||
    urlParams.get("view") === "onboarding" ||
    hashParams.get("view") === "onboarding";

  // If public KB view, show it immediately without auth check
  if (isPublicKBView) {
    return <PublicKBViewer />;
  }

  // If onboarding view, show it without auth check
  if (isOnboardingView) {
    return <OnboardingPage />;
  }

  return (
    <ErrorBoundary>
      {/* Show loading state while checking auth */}
      {authLoading && (
        <div style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#111827',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '48px',
              height: '48px',
              border: '4px solid #374151',
              borderTopColor: '#667eea',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px',
            }} />
            <p style={{ color: '#9ca3af', fontSize: '14px' }}>Loading...</p>
          </div>
        </div>
      )}

      {/* Show login if not authenticated */}
      {!authLoading && !user && <Login />}

      {/* Normal authenticated dashboard view */}
      {!authLoading && user && (() => {

        return (
          <>
            <DashboardLayout
              currentView={currentView}
              onNavigate={requestNavigate}
              currentRole={currentRole}
              onRoleChange={handleRoleChange}
              darkMode={darkMode}
              onDarkModeToggle={() => setDarkMode(!darkMode)}
              isSuperAdminAuthenticated={isSuperAdminAuthenticated}
            >
              {renderContent()}
            </DashboardLayout>

            {showPasswordPrompt && (
              <SuperAdminPasswordDialog
                onClose={() => setShowPasswordPrompt(false)}
                onAuthenticate={handleSuperAdminAuth}
              />
            )}

            <UnsavedChangesDialog
              isOpen={pendingNavigationView !== null}
              onDiscard={() => {
                if (pendingNavigationView) {
                  // Clear unsaved changes state
                  setHasUnsavedChangesRef(null);
                  handleNavigate(pendingNavigationView);
                  setPendingNavigationView(null);
                }
              }}
              onCancel={() => setPendingNavigationView(null)}
            />

            <Toaster />
          </>
        );
      })()}
    </ErrorBoundary>
  );
}