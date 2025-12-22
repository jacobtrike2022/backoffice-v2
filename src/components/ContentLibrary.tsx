import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Footer } from './Footer';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Skeleton } from './ui/skeleton';
import { 
  Play, 
  Search, 
  Grid3x3, 
  List, 
  Filter,
  Calendar,
  Clock,
  Tag,
  Users,
  Eye,
  TrendingUp,
  FileText,
  Album as AlbumIcon,
  BookOpen,
  Video,
  X,
  ChevronLeft,
  ArrowUpDown,
  CheckCircle2,
  Lock,
  Edit,
  Save,
  Trash2,
  Copy,
  MoreVertical,
  Archive
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Separator } from './ui/separator';
import { Textarea } from './ui/textarea';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './ui/popover';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from './ui/hover-card';
import { TrackDetailEdit } from './TrackDetailEdit';
import { ArticleDetailEdit } from './ArticleDetailEdit';
import { CheckpointEditor } from './content-authoring/CheckpointEditor';
import { StoryEditor } from './content-authoring/StoryEditor';
import { UnsavedChangesDialog } from './UnsavedChangesDialog';
import { useTracks } from '../lib/hooks/useSupabase';
import * as crud from '../lib/crud';
import * as tagsCrud from '../lib/crud/tags';
import * as trackRelCrud from '../lib/crud/trackRelationships';
import { toast } from 'sonner@2.0.3';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import defaultThumbnail from 'figma:asset/d284bc7ee411198fb15ff6e1e42fef256815e21f.png';

interface ContentLibraryProps {
  currentRole?: 'admin' | 'district-manager' | 'store-manager' | 'trike-super-admin';
  isSuperAdminAuthenticated?: boolean;
  initialTrackId?: string; // Track ID to open on mount
  onNavigateToPlaylist?: (playlistId: string) => void;
  onBackToLibrary?: () => void; // Callback to notify parent when returning to library
  registerUnsavedChangesCheck?: (checkFn: (() => boolean) | null) => void; // Register with App for global navigation
}

// Calculate reading time based on word count (200 words per minute)
const calculateReadingTime = (htmlContent: string): number => {
  if (!htmlContent) return 0;
  
  // Strip HTML tags and get plain text
  const plainText = htmlContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  
  // Count words
  const wordCount = plainText.split(/\s+/).filter(word => word.length > 0).length;
  
  // Calculate reading time (200 words per minute)
  const readingTime = Math.ceil(wordCount / 200);
  
  return readingTime || 1; // Minimum 1 minute
};

export function ContentLibrary({ currentRole = 'admin', isSuperAdminAuthenticated = false, initialTrackId, onNavigateToPlaylist, onBackToLibrary, registerUnsavedChangesCheck }: ContentLibraryProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedTrack, setSelectedTrack] = useState<any | null>(null);
  const [sortBy, setSortBy] = useState<'recent' | 'title' | 'views'>('recent');
  const [hasLoadedInitialTrack, setHasLoadedInitialTrack] = useState(false); // Track if initial load is done
  const [statusFilter, setStatusFilter] = useState<'published' | 'drafts' | 'archived' | 'in-kb'>('published'); // Status filter
  const [orgTags, setOrgTags] = useState<tagsCrud.Tag[]>([]); // Organization tags with colors
  const [archiveWarningDialog, setArchiveWarningDialog] = useState<{
    open: boolean;
    track: any | null;
    relationships: trackRelCrud.TrackRelationship[];
  }>({
    open: false,
    track: null,
    relationships: []
  });
  
  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editFormData, setEditFormData] = useState<any>({});
  
  // Unsaved changes tracking
  const [hasUnsavedChangesRef, setHasUnsavedChangesRef] = useState<(() => boolean) | null>(null);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
  const [showNavigationWarning, setShowNavigationWarning] = useState(false);

  // Register unsaved changes check from child editors
  const registerUnsavedChangesCheckLocal = useCallback((checkFn: (() => boolean) | null) => {
    console.log('📝 ContentLibrary: Registering unsaved changes check:', !!checkFn);
    setHasUnsavedChangesRef(() => checkFn);
    if (registerUnsavedChangesCheck) {
      registerUnsavedChangesCheck(checkFn);
    }
  }, [registerUnsavedChangesCheck]);

  // Check for unsaved changes before navigation
  const checkUnsavedBeforeNavigate = (navigationFn: () => void): boolean => {
    console.log('🔍 Checking for unsaved changes...', { hasRef: !!hasUnsavedChangesRef });
    
    if (hasUnsavedChangesRef && hasUnsavedChangesRef()) {
      console.log('⚠️ Unsaved changes detected, showing warning');
      setPendingNavigation(() => navigationFn);
      setShowNavigationWarning(true);
      return false; // Navigation blocked
    }
    
    console.log('✅ No unsaved changes, allowing navigation');
    return true; // Navigation allowed
  };

  // Handle discard from navigation warning
  const handleDiscardAndNavigate = () => {
    setShowNavigationWarning(false);
    if (pendingNavigation) {
      pendingNavigation();
      setPendingNavigation(null);
    }
    setHasUnsavedChangesRef(() => null);
  };

  // Handle save from navigation warning - removed, use editor's own save button
  // const handleSaveAndNavigate = () => { ... }

  // Fetch tracks from Supabase
  const { tracks, loading, error, refetch } = useTracks({
    status: statusFilter, // Use dynamic status filter
    type: selectedType !== 'all' ? selectedType as any : undefined,
    search: searchQuery || undefined
  });

  // Debug logging
  console.log('ContentLibrary - tracks:', tracks);
  console.log('ContentLibrary - loading:', loading);
  console.log('ContentLibrary - error:', error);

  // Load initial track from URL if provided - ONLY ONCE
  useEffect(() => {
    if (initialTrackId && !selectedTrack && !hasLoadedInitialTrack) {
      console.log('📍 ContentLibrary: Loading initial track from URL:', initialTrackId);
      setHasLoadedInitialTrack(true); // Mark as loaded immediately to prevent re-runs
      crud.getTrackByIdOrLatest(initialTrackId).then(({ track, isLatest, latestTrackId }) => {
        if (track) {
          console.log('📍 ContentLibrary: Initial track loaded:', track);
          setSelectedTrack(track);
          
          // If we redirected to a newer version, update the URL
          if (!isLatest && latestTrackId !== initialTrackId) {
            const newUrl = `/${track.type}/${latestTrackId}`;
            console.log('🔄 Redirected to latest version, updating URL to:', newUrl);
            window.history.pushState({ trackId: latestTrackId, trackType: track.type }, '', newUrl);
          }
        }
      }).catch(error => {
        console.error('📍 ContentLibrary: Failed to load initial track:', error);
      });
    }
  }, [initialTrackId, selectedTrack, hasLoadedInitialTrack]);

  // Listen for initialTrackId being undefined to clear the selected track
  useEffect(() => {
    if (initialTrackId === undefined && selectedTrack) {
      console.log('📍 ContentLibrary: Clearing selected track (initialTrackId is undefined)');
      setSelectedTrack(null);
      setHasLoadedInitialTrack(false);
    }
  }, [initialTrackId]);

  // Fetch organization tags on mount to get colors
  useEffect(() => {
    async function fetchOrgTags() {
      try {
        const tags = await tagsCrud.getAllTags(true);
        setOrgTags(tags);
        console.log('Fetched organization tags:', tags);
      } catch (error) {
        console.error('Failed to fetch organization tags:', error);
      }
    }
    fetchOrgTags();
  }, []);

  const handleDuplicateTrack = async (track: any, e?: React.MouseEvent) => {
    e?.stopPropagation(); // Prevent card click
    
    try {
      const newTrack = await crud.duplicateTrack(track.id);
      
      // Show persistent toast with link to view the duplicated track
      toast.success(`"${track.title}" duplicated successfully!`, {
        description: `New draft: "${newTrack.title}"`,
        duration: Infinity, // Stay visible until dismissed
        action: {
          label: 'View Copy',
          onClick: async () => {
            // Load and view the duplicated track
            const freshTrack = await crud.getTrackById(newTrack.id);
            setSelectedTrack(freshTrack);
          }
        }
      });
      
      await refetch(); // Refresh the list
    } catch (error: any) {
      console.error('Failed to duplicate track:', error);
      toast.error(`Failed to duplicate: ${error.message}`);
    }
  };

  const handleEditTrack = async (track: any, e?: React.MouseEvent) => {
    e?.stopPropagation();
    await handleViewTrack(track);
  };

  const handleMoveToDrafts = async (track: any, e?: React.MouseEvent) => {
    e?.stopPropagation();
    
    try {
      await crud.updateTrack({ id: track.id, status: 'draft' });
      toast.success(`"${track.title}" moved to drafts`);
      await refetch();
    } catch (error: any) {
      console.error('Failed to move to drafts:', error);
      toast.error(`Failed to move to drafts: ${error.message}`);
    }
  };

  const handleArchiveTrack = async (track: any, e?: React.MouseEvent) => {
    e?.stopPropagation();
    
    console.log('🔍 [Archive] Checking relationships for track:', track.id, track.title);
    
    try {
      // Check for related tracks before archiving (optional check - don't fail if endpoint unavailable)
      // We check both directions independently so if one fails, we still check the other
      const allRelationships: trackRelCrud.TrackRelationship[] = [];
      const sourceRelationships: trackRelCrud.TrackRelationship[] = [];
      
      // Check 1: Fetch relationships where this track is the source (tracks derived FROM this track)
      try {
        console.log('🔍 [Archive] Fetching all derived tracks for:', track.id);
        const derived = await trackRelCrud.getDerivedTracks(track.id);
        if (derived && Array.isArray(derived)) {
          allRelationships.push(...derived);
        }
        console.log('📊 [Archive] Found derived relationships:', derived?.length || 0);
      } catch (derivedError: any) {
        console.warn('⚠️ [Archive] Could not fetch derived tracks, trying stats endpoint:', derivedError?.message);
        // Fallback: Try using getTrackRelationshipStats which might have better auth
        try {
          const stats = await trackRelCrud.getTrackRelationshipStats(track.id) as any;
          if (stats?.derived && Array.isArray(stats.derived)) {
            allRelationships.push(...stats.derived);
            console.log('📊 [Archive] Found relationships via stats endpoint:', stats.derived.length);
          }
        } catch (statsError: any) {
          console.warn('⚠️ [Archive] Stats endpoint also failed:', statsError?.message);
        }
      }
      
      // Check 2: Fetch relationships where this track is derived FROM another track
      try {
        console.log('🔍 [Archive] Checking if track has a source...');
        const sourceTypes: Array<'source' | 'prerequisite' | 'related'> = ['source', 'prerequisite', 'related'];
        for (const relType of sourceTypes) {
          try {
            const source = await trackRelCrud.getSourceTrack(track.id, relType);
            if (source && source.source_track) {
              // Convert source relationship to the same format as derived relationships for display
              // The source relationship shows this track is derived FROM source_track
              // For the dialog, we want to show source_track as the "related" track
              sourceRelationships.push({
                id: source.id,
                source_track_id: source.source_track_id,
                derived_track_id: source.derived_track_id,
                relationship_type: source.relationship_type,
                created_at: source.created_at,
                // Show the source track (parent) as the "derived_track" for display purposes
                derived_track: {
                  id: source.source_track.id,
                  title: source.source_track.title,
                  type: source.source_track.type,
                  thumbnail_url: source.source_track.thumbnail_url,
                  status: source.source_track.status
                }
              } as trackRelCrud.TrackRelationship);
              break; // Found one, no need to check other types
            }
          } catch (err) {
            // Continue checking other types
          }
        }
        console.log('📊 [Archive] Found source relationships:', sourceRelationships.length);
      } catch (sourceError: any) {
        console.warn('⚠️ [Archive] Could not fetch source track:', sourceError?.message);
        // Continue even if this fails
      }
      
      // Combine both directions: tracks derived FROM this track, and tracks this track is derived FROM
      const allCombinedRelationships = [
        ...allRelationships,
        ...sourceRelationships
      ];
      
      console.log('📊 [Archive] Total relationships found:', allCombinedRelationships.length);
      
      // Show warning if this track has ANY relationships (either direction)
      if (allCombinedRelationships.length > 0) {
        console.log('⚠️ [Archive] Relationships found, showing warning dialog');
        // Show warning dialog with relationships
        setArchiveWarningDialog({
          open: true,
          track,
          relationships: allCombinedRelationships
        });
        return; // Wait for user confirmation in dialog
      } else {
        console.log('✅ [Archive] No relationships found, proceeding with archive');
      }
      
      // No relationships found, proceed directly with archiving
      console.log('💾 [Archive] Proceeding with archive');
      await performArchive(track.id, track.title);
    } catch (error: any) {
      console.error('❌ [Archive] Failed to archive:', error);
      toast.error(`Failed to archive: ${error.message || 'Unknown error'}`);
    }
  };

  const performArchive = async (trackId: string, trackTitle: string) => {
    try {
      await crud.archiveTrack(trackId);
      toast.success(`"${trackTitle}" archived`);
      await refetch();
      setArchiveWarningDialog({ open: false, track: null, relationships: [] });
    } catch (error: any) {
      console.error('Failed to archive:', error);
      toast.error(`Failed to archive: ${error.message || 'Unknown error'}`);
    }
  };

  const handleConfirmArchive = () => {
    if (archiveWarningDialog.track) {
      performArchive(archiveWarningDialog.track.id, archiveWarningDialog.track.title);
    }
  };

  const handleNavigateToRelatedTrack = async (trackId: string) => {
    setArchiveWarningDialog({ open: false, track: null, relationships: [] });
    
    // Fetch the full track data before navigating
    try {
      const { track: fullTrack, isLatest, latestTrackId } = await crud.getTrackByIdOrLatest(trackId);
      if (fullTrack) {
        setSelectedTrack(fullTrack);
        
        // Update URL to match the track
        const trackType = fullTrack.type;
        const urlToUse = isLatest ? latestTrackId : trackId;
        const newUrl = `/${trackType}/${urlToUse}`;
        window.history.pushState({}, '', newUrl);
        console.log('🔗 Navigated to related track:', fullTrack.title, newUrl);
      } else {
        console.error('Failed to load track:', trackId);
        toast.error('Failed to load track');
      }
    } catch (error) {
      console.error('Error loading related track:', error);
      toast.error('Failed to load track');
    }
  };

  const handleMoveToPublished = async (track: any, e?: React.MouseEvent) => {
    e?.stopPropagation();
    
    try {
      await crud.updateTrack({ id: track.id, status: 'published' });
      toast.success(`"${track.title}" moved to published`);
      await refetch();
    } catch (error: any) {
      console.error('Failed to move to published:', error);
      toast.error(`Failed to move to published: ${error.message}`);
    }
  };

  const handleDeletePermanently = async (track: any, e?: React.MouseEvent) => {
    e?.stopPropagation();
    
    try {
      // Check for playlist assignments or activity
      // TODO: Implement activity checking when analytics are available
      const hasActivity = false; // Placeholder for actual activity check
      
      if (hasActivity) {
        toast.error(
          `Cannot delete "${track.title}" because it has associated activity. Tracks with user engagement must be kept for data integrity.`,
          { duration: 6000 }
        );
        return;
      }
      
      // Check for derived tracks
      const stats = await trackRelCrud.getTrackRelationshipStats(track.id);
      
      if (stats.derivedCount > 0) {
        const derivedTracks = await trackRelCrud.getDerivedTracks(track.id, 'source');
        const derivedTitles = derivedTracks
          .map(rel => `• ${rel.derived_track?.title || 'Untitled'} (${rel.derived_track?.type})`)
          .join('\n');
        
        toast.error(
          `Cannot delete "${track.title}" because it is used as source material for ${stats.derivedCount} other track(s):\n\n${derivedTitles}`,
          { duration: 8000 }
        );
        return;
      }
      
      // Show confirmation dialog
      const confirmed = window.confirm(
        `⚠️ PERMANENT DELETE\n\nAre you sure you want to permanently delete "${track.title}"?\n\nThis action CANNOT be undone. The ${track.type} and all its data will be permanently removed from the database.\n\nType "DELETE" to confirm.`
      );
      
      if (!confirmed) {
        return;
      }
      
      // Additional confirmation for system content
      if (track.is_system_content && !isSuperAdminAuthenticated) {
        toast.error('Only Super Admins can delete system content');
        return;
      }
      
      await crud.deleteTrack(track.id);
      toast.success(`"${track.title}" permanently deleted`);
      await refetch();
    } catch (error: any) {
      console.error('Failed to delete track:', error);
      toast.error(`Failed to delete: ${error.message}`);
    }
  };

  const handleViewTrack = async (track: any) => {
    console.log('Viewing track:', track);
    
    // Check for unsaved changes before navigating
    const navigationFn = async () => {
      // Fetch fresh track data and redirect to latest version if needed
      try {
        const { track: freshTrack, isLatest, latestTrackId } = await crud.getTrackByIdOrLatest(track.id);
        setSelectedTrack(freshTrack);
        console.log('Loaded fresh track data:', freshTrack);
        
        // Update URL without page reload
        const trackType = freshTrack.type;
        const newUrl = `/${trackType}/${latestTrackId}`;
        window.history.pushState({ trackId: latestTrackId, trackType }, '', newUrl);
        
        if (!isLatest) {
          console.log('🔄 Redirected from old version to latest version:', latestTrackId);
        }
      } catch (error) {
        console.error('Failed to load track:', error);
        // Fallback to cached data if fetch fails
        setSelectedTrack(track);
      }
      
      // Try to increment view count in the background (non-blocking)
      try {
        await crud.incrementTrackViews(track.id);
      } catch (error) {
        // Silently fail - don't prevent the page from opening
        console.warn('Failed to increment view count:', error);
      }
    };
    
    // Check for unsaved changes and block navigation if needed
    if (!checkUnsavedBeforeNavigate(navigationFn)) {
      return; // Navigation blocked, dialog will be shown
    }
    
    // No unsaved changes, navigate immediately
    await navigationFn();
  };
  
  // Handle version navigation smoothly without page reload
  const handleVersionClick = async (versionTrackId: string) => {
    console.log('🔍 Version clicked, loading version:', versionTrackId);
    try {
      console.log('📍 Fetching track data for version:', versionTrackId);
      const versionTrack = await crud.getTrackById(versionTrackId);
      
      if (!versionTrack) {
        console.error('❌ Version track not found:', versionTrackId);
        toast.error('Version not found');
        return;
      }
      
      console.log('✅ Version track loaded:', versionTrack);
      console.log('📊 Version details:', {
        id: versionTrack.id,
        version_number: versionTrack.version_number,
        is_latest_version: versionTrack.is_latest_version,
        title: versionTrack.title
      });
      
      setSelectedTrack(versionTrack);
      
      // Update URL without page reload
      const trackType = versionTrack.type;
      const newUrl = `/${trackType}/${versionTrackId}`;
      console.log('🔗 Updating URL to:', newUrl);
      window.history.pushState({ trackId: versionTrackId, trackType }, '', newUrl);
      
      console.log('✅ Version loaded successfully');
    } catch (error) {
      console.error('❌ Failed to load version:', error);
      toast.error('Failed to load this version');
    }
  };
  
  // Handle back to library
  const handleBackToLibrary = () => {
    console.log('🔙 Returning to content library');
    setSelectedTrack(null);
    
    // Update URL to content library without page reload
    window.history.pushState({}, '', '/content-library');
    
    // Notify parent component if provided
    if (onBackToLibrary) {
      onBackToLibrary();
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'video': return <Video className="h-4 w-4" />;
      case 'story': return <BookOpen className="h-4 w-4" />;
      case 'article': return <FileText className="h-4 w-4" />;
      case 'checkpoint': return <CheckCircle2 className="h-4 w-4" />;
      default: return <Play className="h-4 w-4" />;
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'video': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
      case 'story': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
      case 'article': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
      case 'checkpoint': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300';
      default: return '';
    }
  };

  // Sort tracks
  const sortedTracks = [...(tracks || [])].sort((a, b) => {
    if (sortBy === 'title') return a.title.localeCompare(b.title);
    if (sortBy === 'views') return (b.view_count || 0) - (a.view_count || 0);
    return new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime();
  });

  // Loading state - only show skeleton on initial load, not on refetch
  if (loading && (!tracks || tracks.length === 0)) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-80" />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-8 bg-red-50 border border-red-200 rounded-lg">
        <h2 className="text-xl font-semibold text-red-700 mb-2">Error Loading Content</h2>
        <p className="text-red-600 mb-4">{error.message}</p>
        <Button onClick={() => refetch()}>Retry</Button>
      </div>
    );
  }

  // Detail view for selected track
  if (selectedTrack) {
    const handleUpdate = async (newTrackId?: string) => {
      console.log('ContentLibrary - handleUpdate called, fetching updated track...');
      console.log('ContentLibrary - newTrackId:', newTrackId);
      // If a new track ID is provided (e.g., after version creation), use that
      // Otherwise, refetch the current selected track
      const trackIdToFetch = newTrackId || selectedTrack.id;
      console.log('ContentLibrary - fetching track ID:', trackIdToFetch);
      const updatedTrack = await crud.getTrackById(trackIdToFetch);
      setSelectedTrack(updatedTrack);
      console.log('ContentLibrary - updated track:', updatedTrack);
      
      // If we're loading a new version, update the URL
      if (newTrackId) {
        const newUrl = `/${updatedTrack.type}/${newTrackId}`;
        console.log('ContentLibrary - updating URL to:', newUrl);
        window.history.pushState({ trackId: newTrackId, trackType: updatedTrack.type }, '', newUrl);
      }
    };

    const handleBack = async () => {
      console.log('ContentLibrary - Back clicked, refetching list...');
      // Wait for refetch to complete before clearing selected track
      await refetch();
      console.log('ContentLibrary - Refetch complete, clearing selected track');
      setSelectedTrack(null);
    };

    return (
      <>
        {selectedTrack.type === 'article' ? (
          <ArticleDetailEdit
            track={selectedTrack}
            onBack={handleBackToLibrary}
            onUpdate={handleUpdate}
            onVersionClick={handleVersionClick}
            isSuperAdminAuthenticated={isSuperAdminAuthenticated}
            onNavigateToPlaylist={onNavigateToPlaylist}
            registerUnsavedChangesCheck={registerUnsavedChangesCheckLocal}
          />
        ) : selectedTrack.type === 'checkpoint' ? (
          <CheckpointEditor
            track={selectedTrack}
            onBack={handleBackToLibrary}
            onUpdate={handleUpdate}
            onVersionClick={handleVersionClick}
            isSuperAdminAuthenticated={isSuperAdminAuthenticated}
            onNavigateToPlaylist={onNavigateToPlaylist}
            registerUnsavedChangesCheck={registerUnsavedChangesCheckLocal}
          />
        ) : selectedTrack.type === 'story' ? (
          <StoryEditor
            track={selectedTrack}
            onBack={handleBackToLibrary}
            onUpdate={handleUpdate}
            onVersionClick={handleVersionClick}
            isSuperAdminAuthenticated={isSuperAdminAuthenticated}
            onNavigateToPlaylist={onNavigateToPlaylist}
            registerUnsavedChangesCheck={registerUnsavedChangesCheckLocal}
          />
        ) : (
          <TrackDetailEdit
            track={selectedTrack}
            onBack={handleBackToLibrary}
            onUpdate={handleUpdate}
            onVersionClick={handleVersionClick}
            isSuperAdminAuthenticated={isSuperAdminAuthenticated}
            onNavigateToPlaylist={onNavigateToPlaylist}
            registerUnsavedChangesCheck={registerUnsavedChangesCheckLocal}
          />
        )}
        
        <Footer />
        
        {/* Unsaved Changes Dialog */}
        <UnsavedChangesDialog
          open={showNavigationWarning}
          onOpenChange={(open) => setShowNavigationWarning(open)}
          onDiscard={handleDiscardAndNavigate}
        />
        
        {/* Archive Warning Dialog */}
        <Dialog open={archiveWarningDialog.open} onOpenChange={(open) => {
          if (!open) {
            setArchiveWarningDialog({ open: false, track: null, relationships: [] });
          }
        }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                Archive Track with Relationships
              </DialogTitle>
              <DialogDescription>
                This track has relationships with other tracks. Archiving it will not delete the related tracks, but the relationships may be affected.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div>
                <p className="text-sm font-medium mb-2">
                  You are about to archive: <span className="font-semibold text-foreground">"{archiveWarningDialog.track?.title}"</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  This {archiveWarningDialog.track?.type} has relationships with {archiveWarningDialog.relationships.length} other track(s):
                </p>
              </div>
              
              <div className="border border-border rounded-lg p-4 max-h-64 overflow-y-auto">
                <div className="space-y-3">
                  {archiveWarningDialog.relationships.map((rel) => {
                    const derivedTrack = rel.derived_track;
                    if (!derivedTrack) return null;
                    
                    const getTypeColor = (type: string) => {
                      switch (type) {
                        case 'checkpoint': return 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400';
                        case 'video': return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400';
                        case 'article': return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400';
                        case 'story': return 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400';
                        default: return 'bg-gray-100 text-gray-700 border-gray-200';
                      }
                    };
                    
                    return (
                      <div 
                        key={rel.id} 
                        className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                        onClick={() => handleNavigateToRelatedTrack(derivedTrack.id)}
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <Badge variant="outline" className={getTypeColor(derivedTrack.type)}>
                            {derivedTrack.type}
                          </Badge>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">{derivedTrack.title || 'Untitled'}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Relationship: {rel.relationship_type}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleNavigateToRelatedTrack(derivedTrack.id);
                          }}
                          className="ml-2"
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>Note:</strong> Archiving this track will not delete the related tracks above, but they will lose their source reference. The related tracks will continue to function independently.
                </p>
              </div>
            </div>
            
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setArchiveWarningDialog({ open: false, track: null, relationships: [] })}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmArchive}
                className="bg-red-600 hover:bg-red-700"
              >
                <Archive className="h-4 w-4 mr-2" />
                Archive Anyway
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Main library view
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground">Content Library</h1>
          <p className="text-muted-foreground mt-1">
            Browse and edit your published content.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            <Grid3x3 className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filters & Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tracks by title, description, or tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* View Filter (combining Type and Status) */}
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="View" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Content</SelectItem>
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Content Types</div>
                <SelectItem value="video">
                  <div className="flex items-center gap-2">
                    <Video className="h-4 w-4" />
                    Videos
                  </div>
                </SelectItem>
                <SelectItem value="article">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Articles
                  </div>
                </SelectItem>
                <SelectItem value="story">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    Stories
                  </div>
                </SelectItem>
                <SelectItem value="checkpoint">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Checkpoints
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={(val: any) => setStatusFilter(val)}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="published">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Published
                  </div>
                </SelectItem>
                <SelectItem value="drafts">
                  <div className="flex items-center gap-2">
                    <Edit className="h-4 w-4" />
                    Drafts
                  </div>
                </SelectItem>
                <SelectItem value="archived">
                  <div className="flex items-center gap-2">
                    <Archive className="h-4 w-4" />
                    Archived
                  </div>
                </SelectItem>
                <SelectItem value="in-kb">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    In Knowledge Base
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Sort - Icon only with popover */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="w-auto">
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48" align="end">
                <div className="space-y-1">
                  <div className="px-2 py-1.5 text-xs font-semibold">Sort by</div>
                  <Button
                    variant={sortBy === 'recent' ? 'secondary' : 'ghost'}
                    className="w-full justify-start"
                    onClick={() => setSortBy('recent')}
                  >
                    <Clock className="h-4 w-4 mr-2" />
                    Most Recent
                  </Button>
                  <Button
                    variant={sortBy === 'title' ? 'secondary' : 'ghost'}
                    className="w-full justify-start"
                    onClick={() => setSortBy('title')}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Title (A-Z)
                  </Button>
                  <Button
                    variant={sortBy === 'views' ? 'secondary' : 'ghost'}
                    className="w-full justify-start"
                    onClick={() => setSortBy('views')}
                  >
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Most Viewed
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      {/* Results Count */}
      <div className="text-sm text-muted-foreground">
        {sortedTracks.length} {sortedTracks.length === 1 ? 'track' : 'tracks'} found
      </div>

      {/* Track Grid/List */}
      {sortedTracks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="flex flex-col items-center gap-2">
              <FileText className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="font-semibold">No tracks found</h3>
              <p className="text-sm text-muted-foreground">
                Try adjusting your search or filters
              </p>
            </div>
          </CardContent>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedTracks.map((track) => (
            <Card
              key={track.id}
              className="cursor-pointer hover:shadow-lg transition-shadow group"
              onClick={() => handleViewTrack(track)}
            >
              <CardContent className="p-0">
                {/* Thumbnail */}
                <div className="relative aspect-video bg-muted overflow-hidden">
                  <img
                    src={track.thumbnail_url && track.thumbnail_url !== '/default-thumbnail.png' ? track.thumbnail_url : defaultThumbnail}
                    alt={track.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                  <div className="absolute top-2 right-2">
                    <Badge className={getTypeBadgeColor(track.type)}>
                      {getTypeIcon(track.type)}
                      <span className="ml-1 capitalize">{track.type}</span>
                    </Badge>
                  </div>
                  {/* Actions Menu (shows on hover) */}
                  <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-8 w-8 p-0 shadow-md"
                          onClick={(e) => e.stopPropagation()}
                          title="More actions"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-48 p-1" align="start">
                        <div className="flex flex-col">
                          <Button
                            variant="ghost"
                            className="justify-start h-9"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditTrack(track);
                            }}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            className="justify-start h-9"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDuplicateTrack(track);
                            }}
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            Duplicate
                          </Button>
                          {statusFilter === 'archived' ? (
                            <>
                              <Button
                                variant="ghost"
                                className="justify-start h-9"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMoveToDrafts(track);
                                }}
                              >
                                <FileText className="h-4 w-4 mr-2" />
                                Move to Drafts
                              </Button>
                              <Button
                                variant="ghost"
                                className="justify-start h-9"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMoveToPublished(track);
                                }}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                Move to Published
                              </Button>
                              <Separator className="my-1" />
                              <Button
                                variant="ghost"
                                className="justify-start h-9 text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeletePermanently(track);
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete Permanently
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                className="justify-start h-9"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMoveToDrafts(track);
                                }}
                              >
                                <FileText className="h-4 w-4 mr-2" />
                                Move to Drafts
                              </Button>
                              <Button
                                variant="ghost"
                                className="justify-start h-9"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleArchiveTrack(track);
                                }}
                              >
                                <Archive className="h-4 w-4 mr-2" />
                                Archive
                              </Button>
                            </>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  {/* Duration/Reading Time Badge */}
                  {(track.duration_minutes || (track.type === 'article' && track.transcript)) && (
                    <div className="absolute bottom-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
                      {track.type === 'article' 
                        ? calculateReadingTime(track.transcript || '')
                        : track.duration_minutes
                      } min
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold line-clamp-2 flex-1">{track.title}</h3>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {track.version_number && track.version_number > 1 && (
                        <Badge variant="outline" className="text-xs">
                          V{track.version_number}
                        </Badge>
                      )}
                      {track.is_system_content && (
                        <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                          <Lock className="h-3 w-3" />
                        </Badge>
                      )}
                    </div>
                  </div>
                  {/* Stats */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2">
                    <div className="flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {track.view_count || 0}
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(track.updated_at).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Tags - 2 line limit with popover for overflow */}
                  {(() => {
                    // Build complete tag list with metadata
                    const allTags: Array<{ name: string; color?: string; isSystem: boolean }> = [];
                    
                    // Debug logging
                    if (track.track_tags) {
                      console.log('Track tags for', track.title, ':', track.track_tags);
                    }
                    
                    // Get tags from track_tags (with color info) - NEW SYSTEM
                    if (track.track_tags && Array.isArray(track.track_tags)) {
                      track.track_tags.forEach((tt: any) => {
                        if (tt.tags && tt.tags.name && tt.tags.name !== 'system:show_in_knowledge_base') {
                          allTags.push({ 
                            name: tt.tags.name, 
                            color: tt.tags.color,
                            isSystem: false
                          });
                        }
                      });
                    }
                    
                    // FALLBACK: Get tags from legacy tags array and match with orgTags for colors
                    if (allTags.length === 0 && track.tags && Array.isArray(track.tags)) {
                      track.tags.forEach((tagName: string) => {
                        if (tagName !== 'system:show_in_knowledge_base') {
                          // Find matching org tag for color
                          const orgTag = orgTags.find(t => t.name === tagName);
                          allTags.push({ 
                            name: tagName,
                            color: orgTag?.color,
                            isSystem: false
                          });
                        }
                      });
                    }
                    
                    // Add system:show_in_knowledge_base tag as "In Knowledge Base" if present
                    const hasKBTag = (track.tags || []).includes('system:show_in_knowledge_base') || track.show_in_knowledge_base;
                    if (hasKBTag) {
                      allTags.unshift({
                        name: 'In Knowledge Base',
                        isSystem: true
                      });
                    }
                    
                    console.log('All tags for', track.title, ':', allTags);
                    
                    // Limit to first ~4 tags (approximating 2 lines)
                    const displayTags = allTags.slice(0, 4);
                    const overflowTags = allTags.slice(4);
                    
                    return allTags.length > 0 ? (
                      <div className="flex flex-wrap gap-1 pt-2">
                        {displayTags.map((tag, idx) => (
                          <Badge 
                            key={idx} 
                            variant="outline" 
                            className={tag.isSystem ? "text-xs bg-gray-100 text-gray-700 border-gray-300" : "text-xs"}
                            style={tag.isSystem ? {} : (tag.color ? { 
                              backgroundColor: tag.color, 
                              borderColor: tag.color,
                              color: '#fff'
                            } : {})}
                          >
                            {tag.name}
                          </Badge>
                        ))}
                        {overflowTags.length > 0 && (
                          <HoverCard openDelay={200}>
                            <HoverCardTrigger asChild>
                              <Badge 
                                variant="outline" 
                                className="text-xs bg-orange-500 text-white border-orange-500 hover:bg-orange-600 cursor-default"
                              >
                                +{overflowTags.length}
                              </Badge>
                            </HoverCardTrigger>
                            <HoverCardContent className="w-auto p-2" align="start" side="bottom">
                              <div className="flex flex-col gap-1">
                                {overflowTags.map((tag, idx) => (
                                  <Badge 
                                    key={idx} 
                                    variant="outline" 
                                    className={tag.isSystem ? "text-xs justify-start bg-gray-100 text-gray-700 border-gray-300" : "text-xs justify-start"}
                                    style={tag.isSystem ? {} : (tag.color ? { 
                                      backgroundColor: tag.color, 
                                      borderColor: tag.color,
                                      color: '#fff'
                                    } : {})}
                                  >
                                    {tag.name}
                                  </Badge>
                                ))}
                              </div>
                            </HoverCardContent>
                          </HoverCard>
                        )}
                      </div>
                    ) : null;
                  })()}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {sortedTracks.map((track) => (
            <Card
              key={track.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => handleViewTrack(track)}
            >
              <CardContent className="p-4">
                <div className="flex gap-4">
                  {/* Thumbnail */}
                  <div className="w-48 h-28 flex-shrink-0 bg-muted rounded overflow-hidden">
                    <img
                      src={track.thumbnail_url && track.thumbnail_url !== '/default-thumbnail.png' ? track.thumbnail_url : defaultThumbnail}
                      alt={track.title}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-2 flex-1">
                        <h3 className="font-semibold">{track.title}</h3>
                        {track.version_number && track.version_number > 1 && (
                          <Badge variant="outline" className="text-xs">
                            V{track.version_number}
                          </Badge>
                        )}
                        {track.is_system_content && (
                          <Badge className="bg-amber-100 text-amber-800 border-amber-200 flex-shrink-0">
                            <Lock className="h-3 w-3 mr-1" />
                            Trike Library
                          </Badge>
                        )}
                      </div>
                      <Badge className={getTypeBadgeColor(track.type)}>
                        {getTypeIcon(track.type)}
                        <span className="ml-1 capitalize">{track.type}</span>
                      </Badge>
                    </div>
                    {track.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {track.description}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Eye className="h-4 w-4" />
                        {track.view_count || 0} views
                      </div>
                      {(track.duration_minutes || (track.type === 'article' && track.transcript)) && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {track.type === 'article' 
                            ? calculateReadingTime(track.transcript || '')
                            : track.duration_minutes
                          } min
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {new Date(track.updated_at).toLocaleDateString()}
                      </div>
                    </div>

                    {(() => {
                      // Build complete tag list with metadata
                      const allTags: Array<{ name: string; color?: string; isSystem: boolean }> = [];
                      
                      // Get tags from track_tags (with color info) - NEW SYSTEM
                      if (track.track_tags && Array.isArray(track.track_tags)) {
                        track.track_tags.forEach((tt: any) => {
                          if (tt.tags && tt.tags.name && tt.tags.name !== 'system:show_in_knowledge_base') {
                            allTags.push({ 
                              name: tt.tags.name, 
                              color: tt.tags.color,
                              isSystem: false
                            });
                          }
                        });
                      }
                      
                      // FALLBACK: Get tags from legacy tags array and match with orgTags for colors
                      if (allTags.length === 0 && track.tags && Array.isArray(track.tags)) {
                        track.tags.forEach((tagName: string) => {
                          if (tagName !== 'system:show_in_knowledge_base') {
                            // Find matching org tag for color
                            const orgTag = orgTags.find(t => t.name === tagName);
                            allTags.push({ 
                              name: tagName,
                              color: orgTag?.color,
                              isSystem: false
                            });
                          }
                        });
                      }
                      
                      // Add system:show_in_knowledge_base tag as "In Knowledge Base" if present
                      const hasKBTag = (track.tags || []).includes('system:show_in_knowledge_base') || track.show_in_knowledge_base;
                      if (hasKBTag) {
                        allTags.unshift({
                          name: 'In Knowledge Base',
                          isSystem: true
                        });
                      }
                      
                      // Limit to first ~6 tags (approximating 2 lines in list view)
                      const displayTags = allTags.slice(0, 6);
                      const overflowTags = allTags.slice(6);
                      
                      return allTags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {displayTags.map((tag, idx) => (
                            <Badge 
                              key={idx} 
                              variant="outline" 
                              className={tag.isSystem ? "text-xs bg-gray-100 text-gray-700 border-gray-300" : "text-xs"}
                              style={tag.isSystem ? {} : (tag.color ? { 
                                backgroundColor: tag.color, 
                                borderColor: tag.color,
                                color: '#fff'
                              } : {})}
                            >
                              {tag.name}
                            </Badge>
                          ))}
                          {overflowTags.length > 0 && (
                            <HoverCard openDelay={200}>
                              <HoverCardTrigger asChild>
                                <Badge 
                                  variant="outline" 
                                  className="text-xs bg-orange-500 text-white border-orange-500 hover:bg-orange-600 cursor-default"
                                >
                                  +{overflowTags.length}
                                </Badge>
                              </HoverCardTrigger>
                              <HoverCardContent className="w-auto p-2" align="start" side="bottom">
                                <div className="flex flex-col gap-1">
                                  {overflowTags.map((tag, idx) => (
                                    <Badge 
                                      key={idx} 
                                      variant="outline" 
                                      className={tag.isSystem ? "text-xs justify-start bg-gray-100 text-gray-700 border-gray-300" : "text-xs justify-start"}
                                      style={tag.isSystem ? {} : (tag.color ? { 
                                        backgroundColor: tag.color, 
                                        borderColor: tag.color,
                                        color: '#fff'
                                      } : {})}
                                    >
                                      {tag.name}
                                    </Badge>
                                  ))}
                                </div>
                              </HoverCardContent>
                            </HoverCard>
                          )}
                        </div>
                      ) : null;
                    })()}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Archive Warning Dialog - must be outside selectedTrack conditional */}
      <Dialog open={archiveWarningDialog.open} onOpenChange={(open) => {
        if (!open) {
          setArchiveWarningDialog({ open: false, track: null, relationships: [] });
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              Archive Track with Relationships
            </DialogTitle>
            <DialogDescription>
              This track has relationships with other tracks. Archiving it will not delete the related tracks, but the relationships may be affected.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <p className="text-sm font-medium mb-2">
                You are about to archive: <span className="font-semibold text-foreground">"{archiveWarningDialog.track?.title}"</span>
              </p>
              <p className="text-sm text-muted-foreground">
                This {archiveWarningDialog.track?.type} has relationships with {archiveWarningDialog.relationships.length} other track(s):
              </p>
            </div>
            
            <div className="border border-border rounded-lg p-4 max-h-64 overflow-y-auto">
              <div className="space-y-3">
                {archiveWarningDialog.relationships.map((rel) => {
                  const derivedTrack = rel.derived_track;
                  if (!derivedTrack) return null;
                  
                  const getTypeColor = (type: string) => {
                    switch (type) {
                      case 'checkpoint': return 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400';
                      case 'video': return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400';
                      case 'article': return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400';
                      case 'story': return 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400';
                      default: return 'bg-gray-100 text-gray-700 border-gray-200';
                    }
                  };
                  
                  return (
                    <div 
                      key={rel.id} 
                      className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                      onClick={() => handleNavigateToRelatedTrack(derivedTrack.id)}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <Badge variant="outline" className={getTypeColor(derivedTrack.type)}>
                          {derivedTrack.type}
                        </Badge>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">{derivedTrack.title || 'Untitled'}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Relationship: {rel.relationship_type}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNavigateToRelatedTrack(derivedTrack.id);
                        }}
                        className="ml-2"
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Note:</strong> Archiving this track will not delete the related tracks above, but they will lose their source reference. The related tracks will continue to function independently.
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setArchiveWarningDialog({ open: false, track: null, relationships: [] })}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmArchive}
              className="bg-red-600 hover:bg-red-700"
            >
              <Archive className="h-4 w-4 mr-2" />
              Archive Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
}