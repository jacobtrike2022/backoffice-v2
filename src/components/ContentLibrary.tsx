import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  Archive,
  Plus,
  Zap,
  FolderOpen
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
import { ContentLibrarySidebar } from './ContentLibrarySidebar';
import { useTracks, useCurrentUser, useAITagSuggestionsCount } from '../lib/hooks/useSupabase';
import * as crud from '../lib/crud';
import * as tagsCrud from '../lib/crud/tags';
import * as trackRelCrud from '../lib/crud/trackRelationships';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { AlertTriangle, ExternalLink, GitBranch } from 'lucide-react';
import { CreateVariantModal } from './content-authoring/CreateVariantModal';

// Default thumbnail from public folder
const defaultThumbnail = '/default-thumbnail.png';

interface ContentLibraryProps {
  currentRole?: 'admin' | 'district-manager' | 'store-manager' | 'trike-super-admin';
  isSuperAdminAuthenticated?: boolean;
  initialTrackId?: string; // Track ID to open on mount
  onNavigateToPlaylist?: (playlistId: string) => void;
  onNavigateToAlbum?: (albumId: string) => void;  // NEW
  onNavigateToPlaylistsTab?: () => void;  // Navigate to playlists tab (no specific playlist)
  onNavigateToAlbumsTab?: () => void;     // Navigate to albums tab (no specific album)
  onBackToLibrary?: () => void; // Callback to notify parent when returning to library
  registerUnsavedChangesCheck?: (checkFn: (() => boolean) | null) => void; // Register with App for global navigation
  onNavigate?: (view: string, trackId?: string) => void; // Navigation callback for creating/editing content
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

export function ContentLibrary({ currentRole = 'admin', isSuperAdminAuthenticated = false, initialTrackId, onNavigateToPlaylist, onNavigateToAlbum, onNavigateToPlaylistsTab, onNavigateToAlbumsTab, onBackToLibrary, registerUnsavedChangesCheck, onNavigate }: ContentLibraryProps) {
  const { user: currentUser } = useCurrentUser();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedTrack, setSelectedTrack] = useState<any | null>(null);
  const [selectedAlbum, setSelectedAlbum] = useState<any | null>(null);
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

  // Create Variant modal state
  const [createVariantModal, setCreateVariantModal] = useState<{
    open: boolean;
    track: any | null;
  }>({
    open: false,
    track: null
  });

  // Track which popover is open (by track ID)
  const [openPopoverId, setOpenPopoverId] = useState<string | null>(null);

  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editFormData, setEditFormData] = useState<any>({});
  
  // Unsaved changes tracking
  const [hasUnsavedChangesRef, setHasUnsavedChangesRef] = useState<(() => boolean) | null>(null);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
  const [showNavigationWarning, setShowNavigationWarning] = useState(false);
  const [filterByPlaylistId, setFilterByPlaylistId] = useState<string | null>(null);
  const [filterPlaylistTracks, setFilterPlaylistTracks] = useState<string[]>([]);
  const [filterPlaylistTitle, setFilterPlaylistTitle] = useState<string>('');
  const [filterByAlbumId, setFilterByAlbumId] = useState<string | null>(null);
  const [filterAlbumTracks, setFilterAlbumTracks] = useState<string[]>([]);
  const [filterAlbumTitle, setFilterAlbumTitle] = useState<string>('');

  // Memoize filter Sets for O(1) lookups instead of O(n) array.includes()
  const filterPlaylistTracksSet = useMemo(() => new Set(filterPlaylistTracks), [filterPlaylistTracks]);
  const filterAlbumTracksSet = useMemo(() => new Set(filterAlbumTracks), [filterAlbumTracks]);

  // Register unsaved changes check from child editors
  // Use a ref to store the parent callback to avoid infinite loops
  const registerUnsavedChangesCheckRef = useRef(registerUnsavedChangesCheck);
  useEffect(() => {
    registerUnsavedChangesCheckRef.current = registerUnsavedChangesCheck;
  }, [registerUnsavedChangesCheck]);

  const registerUnsavedChangesCheckLocal = useCallback((checkFn: (() => boolean) | null) => {
    setHasUnsavedChangesRef(() => checkFn);
    if (registerUnsavedChangesCheckRef.current) {
      registerUnsavedChangesCheckRef.current(checkFn);
    }
  }, []); // Empty deps - we use ref to access latest parent callback

  // Check for unsaved changes before navigation
  const checkUnsavedBeforeNavigate = (navigationFn: () => void): boolean => {
    if (hasUnsavedChangesRef && hasUnsavedChangesRef()) {
      setPendingNavigation(() => navigationFn);
      setShowNavigationWarning(true);
      return false; // Navigation blocked
    }
    
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

  // Debug logging (disabled for performance - enable only when needed)
  // console.log('ContentLibrary - tracks:', tracks);
  // console.log('ContentLibrary - loading:', loading);
  // console.log('ContentLibrary - error:', error);

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
  // This ensures that when navigating back to library view, the selected track is cleared
  useEffect(() => {
    if (initialTrackId === undefined && selectedTrack) {
      console.log('📍 ContentLibrary: Clearing selected track (returning to library view)');
      setSelectedTrack(null);
      setHasLoadedInitialTrack(false);
      // Also clear the URL if we're returning to library view
      if (window.location.pathname.startsWith('/video/') || 
          window.location.pathname.startsWith('/article/') ||
          window.location.pathname.startsWith('/story/') ||
          window.location.pathname.startsWith('/checkpoint/')) {
        window.history.replaceState({}, '', '/');
      }
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
      toast.success(`"${(track as { title?: string }).title ?? 'Track'}" duplicated successfully!`, {
        description: `New draft: "${(newTrack as { title?: string }).title ?? 'Untitled'}"`,
        duration: Infinity, // Stay visible until dismissed
        action: {
          label: 'View Copy',
          onClick: async () => {
            // Load and view the duplicated track
            // Fix: newTrack may be typed as 'never' or missing id, assert type or use type guard
            if (!newTrack || typeof newTrack !== "object" || !("id" in newTrack)) {
              toast.error("Unable to load duplicated track (missing ID).");
              return;
            }
            const trackId = String((newTrack as { id: string | number }).id);
            const freshTrack = await crud.getTrackById(trackId);
            setSelectedTrack(freshTrack);
            await refetch(); // Refresh the list
          }
        }
      });
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
      // Check for related tracks before archiving - run ALL checks in parallel for speed
      const allRelationships: trackRelCrud.TrackRelationship[] = [];
      const sourceRelationships: trackRelCrud.TrackRelationship[] = [];

      // Run all relationship checks in parallel
      const sourceTypes: Array<'source' | 'prerequisite' | 'related'> = ['source', 'prerequisite', 'related'];

      const [derivedResult, ...sourceResults] = await Promise.allSettled([
        // Check 1: Fetch relationships where this track is the source (tracks derived FROM this track)
        trackRelCrud.getDerivedTracks(track.id),
        // Check 2: Fetch source relationships in parallel (all 3 types at once)
        ...sourceTypes.map(relType => trackRelCrud.getSourceTrack(track.id, relType))
      ]);

      // Process derived tracks result
      if (derivedResult.status === 'fulfilled' && derivedResult.value && Array.isArray(derivedResult.value)) {
        allRelationships.push(...derivedResult.value);
        console.log('📊 [Archive] Found derived relationships:', derivedResult.value.length);
      } else if (derivedResult.status === 'rejected') {
        console.warn('⚠️ [Archive] Could not fetch derived tracks:', derivedResult.reason?.message);
      }

      // Process source relationship results
      for (let i = 0; i < sourceResults.length; i++) {
        const result = sourceResults[i];
        if (result.status === 'fulfilled' && result.value && result.value.source_track) {
          const source = result.value;
          sourceRelationships.push({
            id: source.id,
            source_track_id: source.source_track_id,
            derived_track_id: source.derived_track_id,
            relationship_type: source.relationship_type,
            created_at: source.created_at,
            derived_track: {
              id: source.source_track.id,
              title: source.source_track.title,
              type: source.source_track.type,
              thumbnail_url: source.source_track.thumbnail_url,
              status: source.source_track.status
            }
          } as trackRelCrud.TrackRelationship);
          break; // Found one source, no need to add duplicates
        }
      }
      console.log('📊 [Archive] Found source relationships:', sourceRelationships.length);

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
        console.log('Loaded fresh track data:', freshTrack);
        console.log('Fresh track transcript_data keys:', freshTrack.transcript_data ? Object.keys(freshTrack.transcript_data) : 'null');
        setSelectedTrack(freshTrack);
        
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
      // Pass userId for activity tracking if available
      try {
        await crud.incrementTrackViews(track.id, currentUser?.id || undefined);
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
      const versionTrack = await crud.getTrackById(versionTrackId) as any;
      
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
    
    // Don't call onBackToLibrary() here - that would navigate away from content library
    // We just want to clear the selected track and stay in the library view
  };

  // Handler for album clicks from sidebar (filters content)
  const handleAlbumClick = async (albumId: string) => {
    if (filterByAlbumId === albumId) {
      // Clicking same album clears the filter
      setFilterByAlbumId(null);
      setFilterAlbumTracks([]);
      setFilterAlbumTitle('');
      toast.info('Album filter cleared');
      return;
    }

    try {
      // Fetch album data first (before any state updates)
      // This keeps the old filter active during fetch, preventing a flash of all tracks
      const { getAlbumById } = await import('../lib/crud/albums');
      const album = await getAlbumById(albumId);
      if (!album) {
        toast.error('Album not found');
        return;
      }

      // Extract track IDs from album.tracks
      const trackIds = (album.tracks || []).map(at => at.track_id);

      // Atomically swap filters: clear old + set new in one synchronous batch
      // React 18 automatically batches these state updates in event handlers
      setFilterByPlaylistId(null);
      setFilterPlaylistTracks([]);
      setFilterPlaylistTitle('');
      setFilterByAlbumId(albumId);
      setFilterAlbumTracks(trackIds);
      setFilterAlbumTitle(album.title || 'Album');

      if (trackIds.length === 0) {
        toast.info(`"${album.title}" has no tracks yet`);
      } else {
        toast.success(`Filtering by "${album.title}" (${trackIds.length} tracks)`);
      }
    } catch (error) {
      console.error('Failed to load album:', error);
      toast.error('Failed to load album');
    }
  };

  // Handler for edit album navigation
  const handleEditAlbum = (albumId: string) => {
    if (onNavigateToAlbum) {
      onNavigateToAlbum(albumId);
    }
  };

  // Handler for edit playlist navigation
  const handleEditPlaylist = (playlistId: string) => {
    if (onNavigateToPlaylist) {
      onNavigateToPlaylist(playlistId);
    }
  };

  // Handler for playlist clicks from sidebar (filters content)
  const handlePlaylistClick = async (playlistId: string) => {
    if (filterByPlaylistId === playlistId) {
      // Clicking same playlist clears the filter
      setFilterByPlaylistId(null);
      setFilterPlaylistTracks([]);
      setFilterPlaylistTitle('');
      toast.info('Playlist filter cleared');
      return;
    }

    try {
      // Fetch playlist data first (before any state updates)
      // This keeps the old filter active during fetch, preventing a flash of all tracks
      const { getPlaylistTrackIds } = await import('../lib/crud/playlists');
      const playlistData = await getPlaylistTrackIds(playlistId);
      
      if (!playlistData) {
        toast.error('Playlist not found');
        return;
      }

      const trackIds = playlistData.track_ids || [];

      // Atomically swap filters: clear old + set new in one synchronous batch
      // React 18 automatically batches these state updates in event handlers
      setFilterByAlbumId(null);
      setFilterAlbumTracks([]);
      setFilterAlbumTitle('');
      setFilterByPlaylistId(playlistId);
      setFilterPlaylistTracks(trackIds);
      setFilterPlaylistTitle(playlistData.title || 'Playlist');

      if (trackIds.length === 0) {
        toast.info(`"${playlistData.title}" has no tracks yet`);
      } else {
        toast.success(`Filtering by "${playlistData.title}" (${trackIds.length} tracks)`);
      }
    } catch (error) {
      console.error('Failed to load playlist:', error);
      toast.error('Failed to load playlist');
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

  // Memoize sorted tracks to avoid re-sorting on every render
  const sortedTracks = useMemo(() => {
    if (!tracks || tracks.length === 0) return [];
    return [...tracks].sort((a, b) => {
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      if (sortBy === 'views') return (b.view_count || 0) - (a.view_count || 0);
      return new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime();
    });
  }, [tracks, sortBy]);

  // Memoize filtered tracks with Set-based lookups for O(1) performance
  const filteredTracks = useMemo(() => {
    if (filterByPlaylistId && filterPlaylistTracksSet.size > 0) {
      return sortedTracks.filter(track => filterPlaylistTracksSet.has(track.id));
    } else if (filterByAlbumId && filterAlbumTracksSet.size > 0) {
      return sortedTracks.filter(track => filterAlbumTracksSet.has(track.id));
    }
    return sortedTracks;
  }, [sortedTracks, filterByPlaylistId, filterPlaylistTracksSet, filterByAlbumId, filterAlbumTracksSet]);

  const trackIds = useMemo(() => filteredTracks.map(t => t.id), [filteredTracks]);
  const { counts: aiSuggestionCounts } = useAITagSuggestionsCount(trackIds);

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
      
      // Refetch the tracks list first to ensure it's up to date when user goes back
      console.log('ContentLibrary - refetching tracks list...');
      await refetch();
      
      // Then update the selected track
      const updatedTrack = await crud.getTrackById(trackIdToFetch) as any;
      console.log('ContentLibrary - updated track:', updatedTrack);
      console.log('ContentLibrary - updated track transcript_data keys:', updatedTrack?.transcript_data ? Object.keys(updatedTrack.transcript_data) : 'null');
      setSelectedTrack(updatedTrack);
      
      // If we're loading a new version, update the URL
      if (newTrackId && updatedTrack) {
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
            onArchive={async (track) => {
              await handleArchiveTrack(track);
            }}
            onDuplicate={async (track) => {
              await handleDuplicateTrack(track);
            }}
            onCreateVariant={(track) => {
              setCreateVariantModal({ open: true, track });
            }}
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
            onArchive={async (track) => {
              await handleArchiveTrack(track);
            }}
            onDuplicate={async (track) => {
              await handleDuplicateTrack(track);
            }}
            onCreateVariant={(track) => {
              setCreateVariantModal({ open: true, track });
            }}
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
            onArchive={async (track) => {
              await handleArchiveTrack(track);
            }}
            onDuplicate={async (track) => {
              await handleDuplicateTrack(track);
            }}
            onCreateVariant={(track) => {
              setCreateVariantModal({ open: true, track });
            }}
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
            onArchive={async (track) => {
              await handleArchiveTrack(track);
              // Note: handleArchiveTrack may show a dialog, so we only navigate back
              // if no dialog was shown (no relationships). The dialog handles navigation itself.
            }}
            onDuplicate={async (track) => {
              await handleDuplicateTrack(track);
              // handleDuplicateTrack navigates to the new track automatically
            }}
            onCreateVariant={(track) => {
              setCreateVariantModal({ open: true, track });
            }}
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
    <div className="flex gap-6">
      {/* Main content area */}
      <div className="flex-1 space-y-6 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground">Content Library</h1>
          <p className="text-muted-foreground mt-1">
            Browse and edit your published content.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {onNavigate && (
            <Button 
              className="bg-brand-gradient" 
              onClick={() => onNavigate('authoring')}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Content
            </Button>
          )}
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
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {filteredTracks.length} {filteredTracks.length === 1 ? 'track' : 'tracks'} found
        </span>
        {filterByPlaylistId && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="flex items-center gap-1">
              <Play className="h-3 w-3" />
              Filtered by: {filterPlaylistTitle}
              <button
                onClick={() => {
                  setFilterByPlaylistId(null);
                  setFilterPlaylistTracks([]);
                  setFilterPlaylistTitle('');
                }}
                className="text-xs text-destructive hover:text-destructive/80"
                aria-label="Clear playlist filter"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          </div>
        )}
        {filterByAlbumId && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="flex items-center gap-1">
              <FolderOpen className="h-3 w-3" />
              Filtered by: {filterAlbumTitle}
              <button
                onClick={() => {
                  setFilterByAlbumId(null);
                  setFilterAlbumTracks([]);
                  setFilterAlbumTitle('');
                }}
                className="text-xs text-destructive hover:text-destructive/80"
                aria-label="Clear album filter"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          </div>
        )}
      </div>

      {/* Track Grid/List */}
      {filteredTracks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="flex flex-col items-center gap-2">
              <FileText className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="font-semibold">No tracks found</h3>
              <p className="text-sm text-muted-foreground">
                {filterByPlaylistId && filterPlaylistTracks.length > 0
                  ? `The playlist "${filterPlaylistTitle}" has ${filterPlaylistTracks.length} track(s), but none match the current "${statusFilter}" filter. Try changing the status filter above.`
                  : filterByPlaylistId
                  ? `"${filterPlaylistTitle}" has no tracks yet.`
                  : filterByAlbumId && filterAlbumTracks.length > 0
                  ? `The album "${filterAlbumTitle}" has ${filterAlbumTracks.length} track(s), but none match the current "${statusFilter}" filter. Try changing the status filter above.`
                  : filterByAlbumId
                  ? `"${filterAlbumTitle}" has no tracks yet.`
                  : 'Try adjusting your search or filters'
                }
              </p>
              {(filterByPlaylistId || filterByAlbumId) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => {
                    setFilterByPlaylistId(null);
                    setFilterPlaylistTracks([]);
                    setFilterPlaylistTitle('');
                    setFilterByAlbumId(null);
                    setFilterAlbumTracks([]);
                    setFilterAlbumTitle('');
                  }}
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear filter
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTracks.map((track) => (
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
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      if (target.src !== defaultThumbnail) {
                        target.src = defaultThumbnail;
                      }
                    }}
                  />
                  <div className="absolute top-2 right-2">
                    <Badge className={getTypeBadgeColor(track.type)}>
                      {getTypeIcon(track.type)}
                      <span className="ml-1 capitalize">{track.type}</span>
                    </Badge>
                  </div>
                  {/* AI Suggestions Badge */}
                  {aiSuggestionCounts[track.id] > 0 && (
                    <div className="absolute bottom-2 left-2">
                      <Badge className="bg-orange-500 hover:bg-orange-600 text-white animate-pulse border-none shadow-md flex items-center gap-1">
                        <Zap className="h-3 w-3 fill-current" />
                        {aiSuggestionCounts[track.id]} AI Suggestion{aiSuggestionCounts[track.id] > 1 ? 's' : ''}
                      </Badge>
                    </div>
                  )}
                  {/* Actions Menu (shows on hover) */}
                  <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Popover 
                      open={openPopoverId === track.id} 
                      onOpenChange={(open) => {
                        setOpenPopoverId(open ? track.id : null);
                      }}
                    >
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
                              setOpenPopoverId(null);
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
                              setOpenPopoverId(null);
                              handleDuplicateTrack(track);
                            }}
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            Duplicate
                          </Button>
                          <Button
                            variant="ghost"
                            className="justify-start h-9"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenPopoverId(null);
                              setCreateVariantModal({ open: true, track });
                            }}
                          >
                            <GitBranch className="h-4 w-4 mr-2" />
                            Create Variant
                          </Button>
                          <Separator className="my-1" />
                          {statusFilter === 'archived' ? (
                            <>
                              <Button
                                variant="ghost"
                                className="justify-start h-9"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenPopoverId(null);
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
                                  setOpenPopoverId(null);
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
                                  setOpenPopoverId(null);
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
                                  setOpenPopoverId(null);
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
                                  setOpenPopoverId(null);
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
                  {(track.duration_minutes || (track.type === 'article' && track.transcript) || (track.type === 'checkpoint' && track.transcript)) && (
                    <div className="absolute bottom-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
                      {track.type === 'article' 
                        ? calculateReadingTime(track.transcript || '')
                        : track.duration_minutes || 0
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

                    // Get tags from tags array and match with orgTags for colors
                    if (track.tags && Array.isArray(track.tags)) {
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
          {filteredTracks.map((track) => (
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
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        if (target.src !== defaultThumbnail) {
                          target.src = defaultThumbnail;
                        }
                      }}
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
                      {/* Actions Menu for List View */}
                      <Popover
                        open={openPopoverId === `list-${track.id}`}
                        onOpenChange={(open) => {
                          setOpenPopoverId(open ? `list-${track.id}` : null);
                        }}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={(e) => e.stopPropagation()}
                            title="More actions"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-48 p-1" align="end">
                          <div className="flex flex-col">
                            <Button
                              variant="ghost"
                              className="justify-start h-9"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenPopoverId(null);
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
                                setOpenPopoverId(null);
                                handleDuplicateTrack(track);
                              }}
                            >
                              <Copy className="h-4 w-4 mr-2" />
                              Duplicate
                            </Button>
                            <Button
                              variant="ghost"
                              className="justify-start h-9"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenPopoverId(null);
                                setCreateVariantModal({ open: true, track });
                              }}
                            >
                              <GitBranch className="h-4 w-4 mr-2" />
                              Create Variant
                            </Button>
                            <Separator className="my-1" />
                            {statusFilter === 'archived' ? (
                              <>
                                <Button
                                  variant="ghost"
                                  className="justify-start h-9"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenPopoverId(null);
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
                                    setOpenPopoverId(null);
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
                                    setOpenPopoverId(null);
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
                                    setOpenPopoverId(null);
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
                                    setOpenPopoverId(null);
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
                            : track.duration_minutes || 0
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

                      // Get tags from tags array and match with orgTags for colors
                      if (track.tags && Array.isArray(track.tags)) {
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

      {/* Create Variant Modal */}
      <CreateVariantModal
        isOpen={createVariantModal.open}
        onClose={() => setCreateVariantModal({ open: false, track: null })}
        sourceTrack={createVariantModal.track ? {
          id: createVariantModal.track.id,
          title: createVariantModal.track.title,
          type: createVariantModal.track.type,
          thumbnail_url: createVariantModal.track.thumbnail_url
        } : undefined}
        onVariantCreated={(newTrackId) => {
          setCreateVariantModal({ open: false, track: null });
          // Navigate to Content Authoring to edit the new variant track
          if (onNavigate) {
            toast.success('Variant created! Opening editor...');
            onNavigate('authoring', newTrackId);
          } else {
            // Fallback: refresh tracks list then select new track
            refetch().then(() => {
              const newTrack = tracks.find(t => t.id === newTrackId);
              if (newTrack) {
                setSelectedTrack(newTrack);
              }
            });
            toast.success('Variant created successfully');
          }
        }}
      />

        <Footer />
      </div>

      {/* Sidebar wrapper for sticky positioning */}
      <div className="hidden lg:block w-64 flex-shrink-0 relative">
        <div className="sticky top-0">
          <ContentLibrarySidebar
            onPlaylistClick={handlePlaylistClick}
            onAlbumClick={handleAlbumClick}
            onEditPlaylist={onNavigateToPlaylist ? handleEditPlaylist : undefined}
            onEditAlbum={onNavigateToAlbum ? handleEditAlbum : undefined}
            onPlaylistsHeaderClick={onNavigateToPlaylistsTab}
            onAlbumsHeaderClick={onNavigateToAlbumsTab}
            activePlaylistFilter={filterByPlaylistId}
            activeAlbumFilter={filterByAlbumId}
          />
        </div>
      </div>
    </div>
  );
}