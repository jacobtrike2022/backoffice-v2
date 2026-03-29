import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from './lib/hooks/useAuth';
import Login from './components/Login';
import { APP_CONFIG } from './lib/config';
import { DashboardLayout } from "./components/DashboardLayout";
import { Dashboard } from "./components/Dashboard";
import { reindexAllTracks, backfillBrainIndex } from './lib/utils/brainIndexer';
import { supabase, getCurrentUserOrgId, setViewingOrgOverride } from './lib/supabase';

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
      return reindexAllTracks(orgId);
    },
    backfill: async () => {
      const orgId = await getCurrentUserOrgId();
      if (!orgId) {
        console.error('Not logged in or no organization found');
        return;
      }
      return backfillBrainIndex(orgId);
    },
    reindexAllTracks,
    backfillBrainIndex,
  };
}

const FrozenDemoScreen = React.lazy(() =>
  import('./components/prospect/FrozenDemoScreen').then((m) => ({ default: m.FrozenDemoScreen }))
);
const ProspectJourneyView = React.lazy(() =>
  import('./components/prospect/ProspectJourneyView').then((m) => ({ default: m.ProspectJourneyView }))
);
const Reports = React.lazy(() =>
  import('./components/Reports').then((m) => ({ default: m.Reports }))
);
const Analytics = React.lazy(() =>
  import('./components/Analytics').then((m) => ({ default: m.Analytics }))
);
const ComplianceDashboard = React.lazy(() =>
  import('./components/compliance/ComplianceDashboard').then((m) => ({ default: m.ComplianceDashboard }))
);
const ComplianceAudit = React.lazy(() =>
  import('./components/ComplianceAudit').then((m) => ({ default: m.ComplianceAudit }))
);
const ComplianceManagement = React.lazy(() =>
  import('./components/compliance/ComplianceManagement').then((m) => ({ default: m.ComplianceManagement }))
);
const TrikeAdminFunctions = React.lazy(() =>
  import('./components/admin').then((m) => ({ default: m.TrikeAdminFunctions }))
);
const ProgramsManagement = React.lazy(() =>
  import('./components/admin').then((m) => ({ default: m.ProgramsManagement }))
);
const People = React.lazy(() =>
  import('./components/People').then((m) => ({ default: m.People }))
);
const Units = React.lazy(() =>
  import('./components/Units').then((m) => ({ default: m.Units }))
);
const NewUnit = React.lazy(() =>
  import('./components/NewUnit').then((m) => ({ default: m.NewUnit }))
);
const Organization = React.lazy(() =>
  import('./components/Organization').then((m) => ({ default: m.Organization }))
);
const ContentAuthoring = React.lazy(() =>
  import('./components/ContentAuthoring').then((m) => ({ default: m.ContentAuthoring }))
);
const ContentLibrary = React.lazy(() =>
  import('./components/ContentLibrary').then((m) => ({ default: m.ContentLibrary }))
);
const AIReview = React.lazy(() =>
  import('./components/AIReview').then((m) => ({ default: m.AIReview }))
);
const Playlists = React.lazy(() =>
  import('./components/Playlists').then((m) => ({ default: m.Playlists }))
);
const PlaylistWizard = React.lazy(() =>
  import('./components/PlaylistWizard').then((m) => ({ default: m.PlaylistWizard }))
);
const KnowledgeBaseRevamp = React.lazy(() =>
  import('./components/KnowledgeBaseRevamp').then((m) => ({ default: m.KnowledgeBaseRevamp }))
);
const Forms = React.lazy(() =>
  import('./components/Forms').then((m) => ({ default: m.Forms }))
);
const Settings = React.lazy(() =>
  import('./components/Settings').then((m) => ({ default: m.Settings }))
);
const PlaybookBuildView = React.lazy(() =>
  import('./components/playbook').then((m) => ({ default: m.PlaybookBuildView }))
);
const TrikeAdminPage = React.lazy(() =>
  import('./components/trike-admin').then((m) => ({ default: m.TrikeAdminPage }))
);

import { SuperAdminPasswordDialog } from "./components/SuperAdminPasswordDialog";
import { UnsavedChangesDialog } from "./components/UnsavedChangesDialog";
import { PublicKBViewer } from "./components/PublicKBViewer";
import { PublicFormFill } from "./components/forms/PublicFormFill";
import { OnboardingPage } from "./components/Onboarding";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Toaster } from "./components/ui/sonner";
import { toast } from "sonner";
import { checkServerHealth } from "./lib/serverHealth";
import { trackDemoActivityEvent } from "./lib/analytics/demoTracking";

function RouteLoadingFallback() {
  return (
    <div
      className="flex items-center justify-center h-full min-h-[200px]"
      role="status"
      aria-label="Loading"
    >
      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
    </div>
  );
}

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
  | "compliance-management"
  | "programs-management"
  | "trike-admin-functions"
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
  | "settings"
  | "trike-admin";

/**
 * Deep link: /roles/:roleId (and /roles/new). Without a Vercel SPA fallback this path 404s;
 * after rewrite to index.html we still need to open Organization → Roles with the right id.
 */
function getRolePathFromLocation(): { view: AppView; roleId: string | null } {
  if (typeof window === "undefined") return { view: "dashboard", roleId: null };
  const m = window.location.pathname.match(/^\/roles\/([^/]+)\/?$/);
  if (m) return { view: "organization", roleId: m[1] };
  return { view: "dashboard", roleId: null };
}

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
  const [currentView, setCurrentView] = useState<AppView>(
    () => getRolePathFromLocation().view,
  );
  /** One-shot deep link from URL /roles/:id; cleared when leaving Organization */
  const [organizationDeepLinkRoleId, setOrganizationDeepLinkRoleId] = useState<
    string | null
  >(() => getRolePathFromLocation().roleId);
  const [editingArticle, setEditingArticle] =
    useState<any>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<
    string | undefined
  >(undefined);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<
    string | undefined
  >(undefined);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);
  const [assignmentsInitialTab, setAssignmentsInitialTab] = useState<'playlists' | 'albums'>('playlists');
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
  const [playlistsRefreshKey, setPlaylistsRefreshKey] = useState(0); // Key to force Playlists refresh after wizard
  const [playbookSourceFileId, setPlaybookSourceFileId] = useState<string | null>(null); // For playbook build view

  // Org status for prospect/frozen/onboarding detection
  const [orgStatusInfo, setOrgStatusInfo] = useState<{
    status: string | null;
    demoExpiresAt: string | null;
    isProspectOrg: boolean;
    isDemoExpired: boolean;
  }>({ status: null, demoExpiresAt: null, isProspectOrg: false, isDemoExpired: false });

  // Org preview state for Super Admin
  const [viewingOrgId, setViewingOrgId] = useState<string | null>(null);
  const [viewingOrgName, setViewingOrgName] = useState<string | null>(null);

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
  const demoSessionStartedAtRef = useRef<number>(Date.now());
  const demoSessionStartSentRef = useRef<boolean>(false);
  const demoSessionEndSentRef = useRef<boolean>(false);

  const getTrackingContext = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    const demoOrgId = params.get("demo_org_id");
    return {
      organizationId: viewingOrgId || demoOrgId || null,
      organizationName: viewingOrgName || null,
      currentRole,
    };
  }, [currentRole, viewingOrgId, viewingOrgName]);

  const getPreservedOrgQuery = () => {
    const current = new URLSearchParams(window.location.search);
    const preserved = new URLSearchParams();
    const demoOrgId = current.get("demo_org_id");
    if (demoOrgId) {
      preserved.set("demo_org_id", demoOrgId);
    }
    return preserved.toString();
  };

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
    checkServerHealth().catch(() => {});
  }, []);

  // After first successful auth (null → user), apply /roles/:id from URL. Do not re-run on
  // user object reference changes (token refresh) or we would yank users back to /roles/... while on dashboard.
  const hadUserRef = useRef(false);
  useEffect(() => {
    if (user && !hadUserRef.current) {
      const { view, roleId } = getRolePathFromLocation();
      if (roleId) {
        setCurrentView(view);
        setOrganizationDeepLinkRoleId(roleId);
      }
    }
    hadUserRef.current = !!user;
  }, [user]);

  // Read demo_org_id from URL on mount — activates org preview for demo links
  // Works in both authenticated and demo (no-user) mode
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const demoOrgId = params.get('demo_org_id');
    if (!demoOrgId || viewingOrgId === demoOrgId) return;

    (async () => {
      try {
        // Fetch org name for the sidebar
        const { data: org } = await supabase
          .from('organizations')
          .select('name')
          .eq('id', demoOrgId)
          .single();

        if (org) {
          setViewingOrgOverride(demoOrgId);
          setViewingOrgId(demoOrgId);
          setViewingOrgName(org.name);
          window.dispatchEvent(new Event('organization-updated'));
        }
      } catch {
        // Silent — demo_org_id may be invalid
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount — demo_org_id is read from URL, no user required

  // Handle previewing an org as Super Admin
  const handlePreviewOrg = async (orgId: string, orgName: string) => {
    setViewingOrgOverride(orgId);
    setViewingOrgId(orgId);
    setViewingOrgName(orgName);
    window.dispatchEvent(new Event('organization-updated'));
  };

  const handleExitOrgPreview = async () => {
    // Clear demo_org_id from URL
    const url = new URL(window.location.href);
    url.searchParams.delete('demo_org_id');
    window.history.replaceState({}, '', url.pathname + url.search);

    // Return to trike.co (main) — same as clicking "Return to main" for trike.co row
    const trikeCoId = APP_CONFIG.TRIKE_CO_ORG_ID;
    try {
      const { data: org } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', trikeCoId)
        .single();
      setViewingOrgOverride(trikeCoId);
      setViewingOrgId(trikeCoId);
      setViewingOrgName(org?.name ?? 'Trike');
    } catch {
      setViewingOrgOverride(trikeCoId);
      setViewingOrgId(trikeCoId);
      setViewingOrgName('Trike');
    }
    setOrgStatusInfo({ status: null, demoExpiresAt: null, isProspectOrg: false, isDemoExpired: false });
    window.dispatchEvent(new Event('organization-updated'));
  };

  // Fetch org status for prospect/frozen detection
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const orgId = await getCurrentUserOrgId();
        if (!orgId) return;
        const { data: org } = await supabase
          .from('organizations')
          .select('status, demo_expires_at')
          .eq('id', orgId)
          .single();
        if (org) {
          const isProspect = org.status === 'demo';
          const expired = org.demo_expires_at ? new Date(org.demo_expires_at) < new Date() : false;
          setOrgStatusInfo({
            status: org.status,
            demoExpiresAt: org.demo_expires_at,
            isProspectOrg: isProspect,
            isDemoExpired: isProspect && expired,
          });
        }
      } catch {
        // Silent - org status is optional context
      }
    })();
  }, [user, viewingOrgId]);

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
      import("./lib/crud/tracks")
        .then(({ getTracks }) => {
          return getTracks({
            ids: [trackId],
            includeAllVersions: true,
          });
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
              const preservedQuery = getPreservedOrgQuery();
              window.history.replaceState(
                {},
                "",
                preservedQuery
                  ? `${window.location.pathname}?${preservedQuery}`
                  : window.location.pathname,
              );
            }
          });
    }

    // Check for create-article mode
    const mode = urlParams.get("mode");
    if (mode === "create-article") {
      setInitialMode("create-article");
      setCurrentView("content");

      // Clear URL params
      const preservedQuery = getPreservedOrgQuery();
      window.history.replaceState(
        {},
        "",
        preservedQuery
          ? `${window.location.pathname}?${preservedQuery}`
          : window.location.pathname,
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
      import("./lib/crud/tracks")
        .then(({ getTracks }) =>
          getTracks({
            ids: [trackId],
            includeAllVersions: true,
          }),
        )
        .then((tracks) => {
          if (tracks && tracks.length > 0) {
            setEditingArticle(tracks[0]);

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

            setSelectedPlaylistId(playlistId);

            const preservedQuery = getPreservedOrgQuery();
            window.history.replaceState(
              {},
              "",
              preservedQuery
                ? `${window.location.pathname}?${preservedQuery}`
                : window.location.pathname,
            );
          }
        })
        .catch(() => {
          // Silent catch
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
    void trackDemoActivityEvent(
      {
        eventType: "page_view",
        path: `/app/${view}`,
        fromPath: `/app/${currentView}`,
        referrer: document.referrer || undefined,
        metadata: {
          source: "app_navigation",
          fromView: currentView,
          toView: view,
        },
      },
      getTrackingContext()
    );

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
    if (view !== "organization") {
      setOrganizationDeepLinkRoleId(null);
    }
    setCurrentView(view);
  };

  // Session lifecycle events for demo/prospect telemetry.
  useEffect(() => {
    if (demoSessionStartSentRef.current) return;
    demoSessionStartSentRef.current = true;

    void trackDemoActivityEvent(
      {
        eventType: "session_start",
        path: `/app/${currentView}`,
        referrer: document.referrer || undefined,
        metadata: { source: "app_boot" },
      },
      getTrackingContext()
    );
  }, [currentView, getTrackingContext]);

  useEffect(() => {
    const emitSessionEnd = () => {
      if (demoSessionEndSentRef.current) return;
      demoSessionEndSentRef.current = true;
      const durationMs = Math.max(0, Date.now() - demoSessionStartedAtRef.current);

      void trackDemoActivityEvent(
        {
          eventType: "session_end",
          path: `/app/${currentView}`,
          metadata: {
            durationMs,
            source: "app_unload",
          },
        },
        getTrackingContext()
      );
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        emitSessionEnd();
      }
    };

    window.addEventListener("beforeunload", emitSessionEnd);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("beforeunload", emitSessionEnd);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [currentView, getTrackingContext]);

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
    const isTrikeSuperAdmin = currentRole === 'trike-super-admin';

    // Frozen demo: show frozen screen regardless of view
    if (orgStatusInfo.isDemoExpired && !isTrikeSuperAdmin) {
      return <FrozenDemoScreen />;
    }

    if (orgStatusInfo.isProspectOrg && !isTrikeSuperAdmin && currentView === 'dashboard') {
      return <ProspectJourneyView onNavigate={requestNavigate} />;
    }

    // Client onboarding view
    // Live orgs see full dashboard (no separate onboarding status)
    switch (currentView) {
      case "dashboard":
        return (
          <Dashboard
            currentRole={currentRole}
            onNavigate={requestNavigate}
          />
        );
      case "reports":
        return <Reports currentRole={currentRole as 'admin' | 'district-manager' | 'store-manager'} />;
      case "analytics":
        return <Analytics currentRole={currentRole as 'admin' | 'district-manager' | 'store-manager'} />;
      case "compliance":
        return <ComplianceDashboard />;
      case "compliance-audit":
        return <ComplianceAudit currentRole={currentRole} />;
      case "compliance-management":
        // Only Trike Super Admin can access this
        if (currentRole !== 'trike-super-admin') {
          requestNavigate('dashboard');
          return null;
        }
        return (
          <ComplianceManagement
            currentRole={currentRole}
            onNavigate={requestNavigate}
          />
        );
      case "programs-management":
        // Only Trike Super Admin can access this
        if (currentRole !== 'trike-super-admin') {
          requestNavigate('dashboard');
          return null;
        }
        return (
          <ProgramsManagement
            currentRole={currentRole}
            onNavigate={requestNavigate}
          />
        );
      case "trike-admin-functions":
        // Only Trike Super Admin can access this
        if (currentRole !== 'trike-super-admin') {
          requestNavigate('dashboard');
          return null;
        }
        return (
          <TrikeAdminFunctions
            currentRole={currentRole}
            onNavigate={requestNavigate}
          />
        );
      case "content":
        return (
          <ContentLibrary
            key={`content-library-${contentLibraryKey}`}
            currentRole={currentRole}
            isSuperAdminAuthenticated={isSuperAdminAuthenticated}
            initialTrackId={initialTrackId}
            onBackToLibrary={handleBackFromContentAuthoring}
            isProspectOrg={orgStatusInfo.isProspectOrg && currentRole !== 'trike-super-admin'}
            registerUnsavedChangesCheck={handleRegisterUnsavedChangesCheck}
            onNavigateToPlaylist={(playlistId: string) => {
              setSelectedPlaylistId(playlistId);
              setAssignmentsInitialTab('playlists');
              setPreviousView('content');
              requestNavigate("assignments");
            }}
            onNavigateToAlbum={(albumId: string) => {
              setSelectedAlbumId(albumId);
              setAssignmentsInitialTab('albums');
              setPreviousView('content');
              requestNavigate("assignments");
            }}
            onNavigateToPlaylistsTab={() => {
              setSelectedPlaylistId(undefined);
              setSelectedAlbumId(null);
              setAssignmentsInitialTab('playlists');
              setPreviousView('content');
              requestNavigate("assignments");
            }}
            onNavigateToAlbumsTab={() => {
              setSelectedPlaylistId(undefined);
              setSelectedAlbumId(null);
              setAssignmentsInitialTab('albums');
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
            key={`playlists-${playlistsRefreshKey}`}
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
            initialTab={assignmentsInitialTab}
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
            key={`playlists-${playlistsRefreshKey}`}
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
              // Increment refresh key to force Playlists component to re-fetch data
              setPlaylistsRefreshKey(prev => prev + 1);
              // Use handleNavigate directly to bypass unsaved changes check
              // The wizard clears the check before calling onClose, but React state
              // updates are async so requestNavigate might still see stale state
              handleNavigate("assignments");
            }}
            registerUnsavedChangesCheck={(checkFn) =>
              setHasUnsavedChangesRef(() => checkFn)
            }
          />
        );
      case "playbook-build":
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
            initialRoleId={organizationDeepLinkRoleId}
            onNavigate={requestNavigate}
            onStartPlaybook={(sourceFileId: string) => {
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
        return <Forms currentRole={currentRole} orgId={viewingOrgId || ''} />;
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
        return <Settings currentRole={currentRole} />;
      case "trike-admin":
        // Only Trike Super Admin can access this
        if (currentRole !== 'trike-super-admin') {
          requestNavigate('dashboard');
          return null;
        }
        return <TrikeAdminPage onPreviewOrg={handlePreviewOrg} darkMode={darkMode} />;
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

  // Check if this is a public form fill request (NO AUTH REQUIRED)
  const formId = urlParams.get("form_id") || hashParams.get("form_id");
  const isPublicFormFill = !!formId;

  // Check if this is the onboarding flow (NO AUTH REQUIRED)
  const isOnboardingView = window.location.pathname.includes("onboarding") ||
    urlParams.get("view") === "onboarding" ||
    hashParams.get("view") === "onboarding";

  // If public form fill, show it immediately without auth check
  if (isPublicFormFill) {
    return <PublicFormFill />;
  }

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

      {/* Show login if not authenticated (skip in demo mode) */}
      {!authLoading && !user && !APP_CONFIG.DEMO_MODE && <Login />}

      {/* Normal authenticated dashboard view (or demo mode) */}
      {!authLoading && (user || APP_CONFIG.DEMO_MODE) && (() => {

        return (
          <>
            <DashboardLayout
              currentView={currentView}
              onNavigate={requestNavigate}
              currentRole={currentRole}
              onRoleChange={handleRoleChange}
              darkMode={darkMode}
              onDarkModeToggle={() => setDarkMode(!darkMode)}
              orgStatusInfo={orgStatusInfo}
              viewingOrgId={viewingOrgId}
              viewingOrgName={viewingOrgName}
              onExitOrgPreview={handleExitOrgPreview}
            >
              <React.Suspense fallback={<RouteLoadingFallback />}>
                {renderContent()}
              </React.Suspense>
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