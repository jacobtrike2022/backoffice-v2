import React, { useState, useEffect } from "react";
import { DashboardLayout } from "./components/DashboardLayout";
import { Dashboard } from "./components/Dashboard";
import { Reports } from "./components/Reports";
import { Analytics } from "./components/Analytics";
import { ContentAssignmentWizard } from "./components/ContentAssignmentWizard";
import { ComplianceDashboard } from "./components/ComplianceDashboard";
import { ComplianceAudit } from "./components/ComplianceAudit";
import { People } from "./components/People";
import { Units } from "./components/Units";
import { Organization } from "./components/Organization";
import { ContentAuthoring } from "./components/ContentAuthoring";
import { ContentLibrary } from "./components/ContentLibrary";
import { Playlists } from "./components/Playlists";
import { PlaylistWizard } from "./components/PlaylistWizard";
import { KnowledgeBaseRevamp } from "./components/KnowledgeBaseRevamp";
import { Forms } from "./components/Forms";
import { Settings } from "./components/Settings";
import { SuperAdminPasswordDialog } from "./components/SuperAdminPasswordDialog";
import { UnsavedChangesDialog } from "./components/UnsavedChangesDialog";
import { SupabaseDiagnostics } from "./components/SupabaseDiagnostics";
import { PublicKBViewer } from "./components/PublicKBViewer";
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
  | "people"
  | "units"
  | "organization"
  | "authoring"
  | "forms"
  | "knowledge-base"
  | "settings";

export default function App() {
  // Check if this is a public KB viewer request (before any other state)
  // Try both query params AND hash for maximum compatibility
  const urlParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  const slug = urlParams.get("slug") || hashParams.get("slug");
  const isPublicKBView = !!slug || window.location.pathname.includes("kb-public");
  
  console.log('🔍🔍🔍 App.tsx routing check:', {
    href: window.location.href,
    search: window.location.search,
    hash: window.location.hash,
    pathname: window.location.pathname,
    hasSlugQuery: urlParams.has("slug"),
    hasSlugHash: hashParams.has("slug"),
    slug: slug,
    isPublicKBView,
    timestamp: Date.now()
  });
  
  // If public KB view, render only that component
  if (isPublicKBView) {
    console.log('✅✅✅ Rendering PublicKBViewer for slug:', slug);
    return <PublicKBViewer />;
  }
  
  console.log('❌ NOT rendering PublicKBViewer, showing dashboard');

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

  // Server health check on mount
  useEffect(() => {
    checkServerHealth()
      .then((healthy) => {
        if (!healthy) {
          console.warn("Server health check failed");
          toast.error(
            "Server connection issues detected. Some features may not work properly.",
          );
        }
      })
      .catch((err) => {
        console.error("Server health check error:", err);
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
      console.log(
        `📍 URL params detected: trackId=${trackId}, type=${trackType}`,
      );

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
      console.log("📍 Create article mode detected");
      setInitialMode("create-article");
      setCurrentView("content");

      // Clear URL params
      window.history.replaceState(
        {},
        "",
        window.location.pathname,
      );
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
      console.log(
        `📍 Playlist-sourced track detected: trackId=${trackId}, type=${trackType}, playlistId=${playlistId}`,
      );

      import("./lib/crud").then((crud) => {
        crud
          .getTracks({
            ids: [trackId],
            includeAllVersions: true,
          })
          .then((tracks) => {
            if (tracks && tracks.length > 0) {
              console.log(
                `📍 URL routing: ${trackType} loaded, switching to view`,
              );
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
          .catch((err) => {
            console.error("Error loading track from URL:", err);
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

  const renderContent = () => {
    switch (currentView) {
      case "dashboard":
        return (
          <Dashboard
            role={currentRole}
            onNavigate={requestNavigate}
            onEditTrack={handleEditTrack}
          />
        );
      case "reports":
        return <Reports role={currentRole} />;
      case "analytics":
        return <Analytics role={currentRole} />;
      case "compliance":
        return (
          <ComplianceDashboard
            role={currentRole}
            onNavigateToAudit={() =>
              requestNavigate("compliance-audit")
            }
          />
        );
      case "compliance-audit":
        return <ComplianceAudit role={currentRole} />;
      case "content":
        return (
          <ContentLibrary
            role={currentRole}
            onNavigate={requestNavigate}
            editingArticle={editingArticle}
            onClearEditingArticle={() => setEditingArticle(null)}
            initialTrackId={initialTrackId}
            onBackClick={handleBackFromContentAuthoring}
            previousView={previousView}
            initialMode={initialMode}
            onRegisterUnsavedChangesCheck={(checkFn) =>
              setHasUnsavedChangesRef(() => checkFn)
            }
          />
        );
      case "assignments":
        return (
          <Playlists
            role={currentRole}
            onNavigate={requestNavigate}
            selectedPlaylistId={selectedPlaylistId}
            onClearSelection={() => setSelectedPlaylistId(undefined)}
            onEditTrack={handleEditTrack}
          />
        );
      case "assignment":
        return (
          <Playlists
            role={currentRole}
            onNavigate={requestNavigate}
            selectedStoreId={selectedStoreId}
            onClearStoreSelection={() =>
              setSelectedStoreId(undefined)
            }
          />
        );
      case "playlist-wizard":
        return (
          <PlaylistWizard
            role={currentRole}
            editingPlaylistId={editingPlaylistId}
            onClose={() => {
              setEditingPlaylistId(undefined);
              requestNavigate("assignments");
            }}
          />
        );
      case "people":
        return <People role={currentRole} />;
      case "units":
        return (
          <Units
            role={currentRole}
            selectedStoreId={selectedStoreId}
            onStoreSelect={(storeId) => {
              setSelectedStoreId(storeId);
              requestNavigate("assignment");
            }}
          />
        );
      case "organization":
        return <Organization role={currentRole} />;
      case "authoring":
        return (
          <ContentAuthoring
            role={currentRole}
            editingArticle={editingArticle}
            onClearEditingArticle={() => setEditingArticle(null)}
            initialTrackId={initialTrackId}
            onBackClick={handleBackFromContentAuthoring}
            previousView={previousView}
            onRegisterUnsavedChangesCheck={(checkFn) =>
              setHasUnsavedChangesRef(() => checkFn)
            }
          />
        );
      case "forms":
        return <Forms role={currentRole} />;
      case "knowledge-base":
        return (
          <KnowledgeBaseRevamp
            currentRole={currentRole}
            onEditTrack={handleEditTrack}
          />
        );
      case "settings":
        return <Settings role={currentRole} />;
      default:
        return (
          <Dashboard
            role={currentRole}
            onNavigate={requestNavigate}
            onEditTrack={handleEditTrack}
          />
        );
    }
  };

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
}