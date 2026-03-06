import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { TagSelectorDialog } from './TagSelectorDialog';
import { VersionHistory } from './content-authoring/VersionHistory';
import { AssociatedPlaylists } from './content-authoring/AssociatedPlaylists';
import { TrackRelationships } from './content-authoring/TrackRelationships';
import { VersionDecisionModal } from './content-authoring/VersionDecisionModal';
import { UnsavedChangesDialog } from './UnsavedChangesDialog';
import TrackScopeSelector from './TrackScopeSelector';
import {
  Play,
  Calendar,
  Clock,
  Tag,
  Eye,
  Video,
  BookOpen,
  FileText,
  CheckCircle2,
  Lock,
  Edit,
  Save,
  X,
  ChevronLeft,
  Trash2,
  Plus,
  Upload,
  Link as LinkIcon,
  History,
  Zap,
  ThumbsUp,
  MoreVertical,
  Copy,
  Archive,
  GitBranch,
  Image as ImageIcon
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './ui/popover';
import * as crud from '../lib/crud';
import * as factsCrud from '../lib/crud/facts';
import * as trackRelCrud from '../lib/crud/trackRelationships';
import * as tagsCrud from '../lib/crud/tags';
import { toast } from 'sonner@2.0.3';
import { InteractiveTranscript } from './InteractiveTranscript';
import { projectId, publicAnonKey, getServerUrl } from '../utils/supabase/info';

interface TrackDetailEditProps {
  track: any;
  onBack: () => void;
  onUpdate: () => void;
  onVersionClick?: (versionTrackId: string) => void; // Optional version navigation callback
  isSuperAdminAuthenticated?: boolean;
  isNewContent?: boolean;
  onNavigateToPlaylist?: (playlistId: string) => void;
  registerUnsavedChangesCheck?: (checkFn: (() => boolean) | null) => void; // Register unsaved changes check
  onArchive?: (track: any) => void; // Archive callback - navigates back after archive
  onDuplicate?: (track: any) => void; // Duplicate callback
  onCreateVariant?: (track: any) => void; // Create variant callback
}

export function TrackDetailEdit({ track, onBack, onUpdate, onVersionClick, isSuperAdminAuthenticated = false, isNewContent = false, onNavigateToPlaylist, registerUnsavedChangesCheck, onArchive, onDuplicate, onCreateVariant }: TrackDetailEditProps) {
  const [isEditMode, setIsEditMode] = useState(isNewContent); // Start in edit mode for new content
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const youtubePlayerRef = useRef<any>(null);
  const [isTagSelectorOpen, setIsTagSelectorOpen] = useState(false);
  const [tagSelectorConfig, setTagSelectorConfig] = useState<{
    systemCategory: any;
    restrictToParentName?: string;
  }>({ systemCategory: 'content' });

  // Ref to track pending KB modal open (persists across re-renders from onUpdate)
  const pendingKBModalOpen = useRef(false);
  
  // Versioning state
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<any>(null);
  
  // Unsaved changes dialog
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
  
  // AI Key Facts generation
  const [isGeneratingKeyFacts, setIsGeneratingKeyFacts] = useState(false);

  // Actions menu popover state
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);

  // Facts loaded from database (for view mode)
  const [viewModeFacts, setViewModeFacts] = useState<any[]>([]);
  const [factsLoading, setFactsLoading] = useState(false);
  const [factsLoadedForTrackId, setFactsLoadedForTrackId] = useState<string | null>(null);

  // Original facts loaded from DB (for edit mode comparison)
  const [originalFacts, setOriginalFacts] = useState<any[]>([]);

  // Track if user has explicitly modified the thumbnail
  // This is loaded from DB (thumbnail_user_set) and persisted across sessions
  // Prevents auto-extraction from overwriting user's thumbnail preference
  const [thumbnailUserSet, setThumbnailUserSet] = useState(track.thumbnail_user_set || false);

  const [editFormData, setEditFormData] = useState<any>({
    title: '',
    description: '',
    duration_minutes: '',
    transcript: '',
    transcript_data: null, // For structured transcript with word-level timestamps
    learning_objectives: [],
    tags: [],
    content_url: '',
    thumbnail_user_set: false, // Persisted flag for user thumbnail preference
    is_system_content: false,
  });

  const [kbTagNames, setKbTagNames] = useState<Set<string>>(new Set());

  // View mode transcript state (updated by polling when transcript becomes available)
  const [viewModeTranscript, setViewModeTranscript] = useState<string | null>(track.transcript || null);
  const [viewModeTranscriptData, setViewModeTranscriptData] = useState<any>(track.transcript_data || null);

  const isSystemContent = track.is_system_content;

  // Compute if track is ready to publish (real-time check based on current state)
  // This enables the publish button as soon as content/transcript is ready
  const canPublish = React.useMemo(() => {
    if (track.status === 'published') return true; // Already published, can always unpublish

    const trackType = isEditMode ? editFormData.type : track.type;

    switch (trackType) {
      case 'video':
        // Videos need transcript - check both view mode state and track data
        const hasTranscript = isEditMode
          ? (editFormData.transcript && editFormData.transcript.trim().length > 20)
          : (viewModeTranscript && viewModeTranscript.trim().length > 20) || (track.transcript && track.transcript.trim().length > 20);
        return hasTranscript;

      case 'article':
        // Articles store body in content_text (primary) or transcript (fallback)
        const articleContent = isEditMode
          ? (editFormData.content_text || editFormData.transcript)
          : (track.content_text || track.transcript);
        return articleContent && articleContent.trim().length > 20;

      case 'story':
        // Stories need slide data in transcript
        const transcriptData = isEditMode ? editFormData.transcript : track.transcript;
        if (!transcriptData) return false;
        try {
          const storyData = typeof transcriptData === 'string' ? JSON.parse(transcriptData) : transcriptData;
          return storyData.slides && Array.isArray(storyData.slides) && storyData.slides.length > 0;
        } catch {
          return false;
        }

      case 'checkpoint':
        // Checkpoints are always ready
        return true;

      default:
        return true;
    }
  }, [track.status, track.type, track.transcript, track.content_text, isEditMode, editFormData.type, editFormData.transcript, editFormData.content_text, viewModeTranscript]);

  // Reset facts cache when track changes
  useEffect(() => {
    if (track.id !== factsLoadedForTrackId) {
      setFactsLoadedForTrackId(null);
      setViewModeFacts([]);
    }
  }, [track.id]);

  // Function to load KB tags - extracted so it can be called on demand
  const loadKBTags = useCallback(async () => {
    try {
      const hierarchy = await crud.getTagHierarchy('knowledge-base');
      const names = new Set<string>();
      const traverse = (nodes: any[]) => {
        for (const node of nodes) {
          names.add(node.name);
          if (node.children) traverse(node.children);
        }
      };
      traverse(hierarchy);
      setKbTagNames(names);
    } catch (e) {
      console.error("Failed to load KB tags", e);
    }
  }, []);

  // Load KB tags on mount
  useEffect(() => {
    loadKBTags();
  }, [loadKBTags]);

  // Effect to open KB modal after track data refreshes (handles view mode toggle)
  useEffect(() => {
    if (pendingKBModalOpen.current) {
      pendingKBModalOpen.current = false;
      // Small delay to ensure render is complete
      setTimeout(() => {
        setTagSelectorConfig({
          systemCategory: 'knowledge-base',
          restrictToParentName: 'KB Category'
        });
        setIsTagSelectorOpen(true);
      }, 100);
    }
  }, [track]); // Runs when track data changes (after onUpdate)

  // Sync view mode transcript state when track prop changes
  useEffect(() => {
    console.log('[TrackDetailEdit] Sync transcript useEffect fired:', {
      hasTrackTranscript: !!track.transcript,
      hasTrackTranscriptData: !!track.transcript_data,
      trackTranscriptDataKeys: track.transcript_data ? Object.keys(track.transcript_data) : []
    });
    if (track.transcript) {
      setViewModeTranscript(track.transcript);
    }
    if (track.transcript_data) {
      setViewModeTranscriptData(track.transcript_data);
    }
  }, [track.transcript, track.transcript_data]);

  // Auto-refresh transcript for video tracks that don't have one yet
  useEffect(() => {
    // Only poll if:
    // 1. It's a video track
    // 2. Has a content URL
    // 3. Doesn't have a transcript yet (check editFormData in edit mode, track prop otherwise)
    // Note: We poll in BOTH edit and view mode now - transcript should auto-display like key facts do
    const hasTranscript = isEditMode ? editFormData.transcript : track.transcript;
    const shouldPoll =
      track.type === 'video' &&
      (track.content_url || editFormData.content_url) &&
      !hasTranscript;

    if (!shouldPoll) return;

    console.log('[TrackDetailEdit] Starting transcript polling...');
    
    // Poll every 5 seconds for up to 2 minutes (24 attempts)
    let attempts = 0;
    const maxAttempts = 24;
    const pollInterval = 5000; // 5 seconds

    const pollForTranscript = async () => {
      attempts++;
      
      try {
        // Fetch fresh track data
        const freshTrack = await crud.getTrackById(track.id);
        
        if (!freshTrack) {
          console.error('[TrackDetailEdit] Track not found during polling');
          // Stop polling if track doesn't exist
          return;
        }

        // If transcript appeared, refresh the UI
        if (freshTrack.transcript) {
          console.log('[TrackDetailEdit] ✓ Transcript found! Refreshing UI...');
          // Update local state so the transcript shows immediately
          if (isEditMode) {
            setEditFormData(prev => ({
              ...prev,
              transcript: freshTrack.transcript || '',
              transcript_data: freshTrack.transcript_data || null,
            }));
          } else {
            // In view mode, update local transcript state
            setViewModeTranscript(freshTrack.transcript || null);
            setViewModeTranscriptData(freshTrack.transcript_data || null);
          }
          await onUpdate();
          return; // Stop polling
        }

        // Continue polling if we haven't hit max attempts
        if (attempts < maxAttempts) {
          setTimeout(pollForTranscript, pollInterval);
        } else {
          console.log('[TrackDetailEdit] Polling timeout after 2 minutes - transcript may still be processing');
        }
      } catch (error: any) {
        console.error('[TrackDetailEdit] Error in transcript polling:', error);
        // Continue polling on error (might be transient network issue)
        if (attempts < maxAttempts) {
          setTimeout(pollForTranscript, pollInterval);
        }
      }
    };

    // Start polling after a short delay (give server time to start processing)
    const timeoutId = setTimeout(pollForTranscript, 3000);

    // Cleanup on unmount or when conditions change
    return () => {
      clearTimeout(timeoutId);
    };
  }, [track.id, track.type, track.content_url, track.transcript, editFormData.content_url, editFormData.transcript, isEditMode, onUpdate]);

  // Helper function to detect and extract YouTube video ID
  const getYouTubeVideoId = (url: string): string | null => {
    if (!url) return null;
    
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /^([a-zA-Z0-9_-]{11})$/ // Direct video ID
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    return null;
  };

  const isYouTubeUrl = (url: string): boolean => {
    return getYouTubeVideoId(url) !== null;
  };

  // Helper function to detect and extract Vimeo video ID
  const getVimeoVideoId = (url: string): string | null => {
    if (!url) return null;
    
    const patterns = [
      /vimeo\.com\/(\d+)/,
      /player\.vimeo\.com\/video\/(\d+)/,
      /^(\d+)$/ // Direct video ID
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    return null;
  };

  const isVimeoUrl = (url: string): boolean => {
    return getVimeoVideoId(url) !== null;
  };

  // Helper function to get YouTube thumbnail URL
  const getYouTubeThumbnail = (url: string): string | null => {
    const videoId = getYouTubeVideoId(url);
    if (!videoId) return null;
    // Use maxresdefault for best quality, fallback to hqdefault if not available
    return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  };

  // Helper function to get Vimeo thumbnail URL
  const getVimeoThumbnail = async (url: string): Promise<string | null> => {
    const videoId = getVimeoVideoId(url);
    if (!videoId) return null;
    
    try {
      const response = await fetch(`https://vimeo.com/api/oembed.json?url=https://vimeo.com/${videoId}`);
      if (!response.ok) return null;
      const data = await response.json();
      return data.thumbnail_url || null;
    } catch (error) {
      console.error('Error fetching Vimeo thumbnail:', error);
      return null;
    }
  };

  // Helper function to extract thumbnail from video URL
  const extractThumbnailFromUrl = async (url: string): Promise<string | null> => {
    if (isYouTubeUrl(url)) {
      return getYouTubeThumbnail(url);
    } else if (isVimeoUrl(url)) {
      return await getVimeoThumbnail(url);
    }
    return null;
  };

  // Initialize form data when entering edit mode
  useEffect(() => {
    if (isEditMode) {
      const loadTrackData = async () => {
        setFactsLoading(true);

        // Fetch facts AND tags in parallel for better performance
        const [factsResult, tagsResult] = await Promise.allSettled([
          factsCrud.getFactsForTrack(track.id),
          tagsCrud.getTrackTagNames(track.id)
        ]);

        // Process facts result
        let facts: any[] = [];
        if (factsResult.status === 'fulfilled' && factsResult.value) {
          facts = factsResult.value.map((f: any) => ({
            title: f.title,
            fact: f.content,
            content: f.content,
            type: f.type,
            steps: f.steps || [],
            contexts: [f.context?.specificity || 'universal'],
            _dbId: f.id,
            _extractedBy: f.extracted_by,
          }));
          console.log(`📊 Loaded ${facts.length} facts from database for track ${track.id}`);
        } else if (factsResult.status === 'rejected') {
          console.warn('Could not fetch facts from database:', factsResult.reason);
        }

        // Store original facts for comparison and also set view mode facts
        setOriginalFacts(facts);
        setViewModeFacts(facts);
        setFactsLoadedForTrackId(track.id);
        setFactsLoading(false);

        // Process tags result
        let tagNames: string[] = track.tags || [];
        if (tagsResult.status === 'fulfilled' && tagsResult.value) {
          tagNames = tagsResult.value;
          console.log(`🏷️ Loaded ${tagNames.length} tags from track_tags junction table`);
        } else if (tagsResult.status === 'rejected') {
          console.warn('Could not fetch tags from junction table, falling back to track.tags:', tagsResult.reason);
        }

        setEditFormData({
          title: String(track.title || ''),
          description: String(track.description || ''),
          duration_minutes: String(track.duration_minutes || ''),
          transcript: String(track.transcript || ''),
          transcript_data: track.transcript_data || null,
          learning_objectives: facts,
          tags: tagNames,
          content_url: String(track.content_url || ''),
          thumbnail_url: String(track.thumbnail_url || ''),
          thumbnail_user_set: track.thumbnail_user_set || false, // Load persisted user preference
          type: track.type || 'video',
          show_in_knowledge_base: tagNames.includes('system:show_in_knowledge_base') || track.show_in_knowledge_base || false,
          is_system_content: track.is_system_content || false,
        });
        // Also update the component state from DB
        setThumbnailUserSet(track.thumbnail_user_set || false);
      };

      loadTrackData();
    }
  }, [isEditMode, track]);

  // Load facts for view mode
  useEffect(() => {
    // Only load facts when NOT in edit mode
    if (isEditMode) {
      return;
    }

    if (track.id) {
      // Skip fetch if facts were already loaded for this track (e.g., from edit mode)
      if (factsLoadedForTrackId === track.id && viewModeFacts.length > 0) {
        console.log(`📊 Using cached ${viewModeFacts.length} facts for view mode`);
        return;
      }

      // Use editFormData.learning_objectives as fallback if available (just exited edit mode)
      const fallbackFacts = (editFormData.learning_objectives || []).length > 0
        ? editFormData.learning_objectives
        : null;

      if (fallbackFacts) {
        setViewModeFacts(fallbackFacts);
        setFactsLoadedForTrackId(track.id);
        console.log(`📊 Using ${fallbackFacts.length} facts from editFormData`);
        return;
      }

      const loadViewModeFacts = async () => {
        setFactsLoading(true);
        try {
          const dbFacts = await factsCrud.getFactsForTrack(track.id);

          const facts = dbFacts.map((f: any) => ({
            title: f.title,
            fact: f.content,
            content: f.content,
            type: f.type,
            steps: f.steps || [],
            contexts: [f.context?.specificity || 'universal'],
          }));

          setViewModeFacts(facts);
          setFactsLoadedForTrackId(track.id);
          console.log(`📊 Loaded ${facts.length} facts for view mode`);
        } catch (error) {
          console.warn('Could not fetch facts for view mode:', error);
          setViewModeFacts([]);
        } finally {
          setFactsLoading(false);
        }
      };

      loadViewModeFacts();
    }
  }, [isEditMode, track.id, factsLoadedForTrackId]);

  // Debug: Log when editFormData changes
  useEffect(() => {
    console.log('editFormData changed:', editFormData);
  }, [editFormData]);

  const areArraysEqual = (a: any[] | undefined | null, b: any[] | undefined | null) => {
    const arr1 = a || [];
    const arr2 = b || [];
    if (arr1.length !== arr2.length) return false;
    const sorted1 = [...arr1].sort();
    const sorted2 = [...arr2].sort();
    return sorted1.every((val, idx) => val === sorted2[idx]);
  };

  // Check if there are unsaved changes
  const hasUnsavedChanges = useCallback(() => {
    if (!isEditMode) {
      return false;
    }
    
    const hasChanges = (
      editFormData.title !== (track.title || '') ||
      editFormData.description !== (track.description || '') ||
      editFormData.duration_minutes !== (track.duration_minutes || '') ||
      editFormData.content_url !== (track.content_url || '') ||
      editFormData.thumbnail_url !== (track.thumbnail_url || '') ||
      !areArraysEqual(editFormData.learning_objectives, originalFacts) ||
      !areArraysEqual(editFormData.tags, track.tags)
    );
    
    return hasChanges;
  }, [isEditMode, editFormData, track, originalFacts]);

  // Warn user before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges()) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isEditMode, editFormData, track]);

  // Register unsaved changes check with parent
  useEffect(() => {
    if (registerUnsavedChangesCheck) {
      if (isEditMode) {
        registerUnsavedChangesCheck(hasUnsavedChanges);
      } else {
        registerUnsavedChangesCheck(null);
      }
    }
    
    // Cleanup on unmount
    return () => {
      if (registerUnsavedChangesCheck) {
        registerUnsavedChangesCheck(null);
      }
    };
  }, [isEditMode, registerUnsavedChangesCheck, hasUnsavedChanges]);

  const handleSave = async () => {
    if (!editFormData.title.trim()) {
      toast.error('Title is required');
      return;
    }

    setIsSaving(true);
    try {
      // Prepare tags including the system KB tag
      const currentTags = new Set<string>(editFormData.tags || []);
      if (editFormData.show_in_knowledge_base) {
        currentTags.add('system:show_in_knowledge_base');
      } else {
        currentTags.delete('system:show_in_knowledge_base');
      }

      const saveData = {
        id: track.id,
        title: editFormData.title || track.title,
        description: editFormData.description || track.description,
        content_url: editFormData.content_url || track.content_url,
        duration_minutes: parseInt(editFormData.duration_minutes) || track.duration_minutes || 0,
        // learning_objectives removed - facts are now stored in the facts table
        tags: Array.from(currentTags),
        thumbnail_url: editFormData.thumbnail_url || track.thumbnail_url,
        thumbnail_user_set: editFormData.thumbnail_user_set || false, // Persist user's thumbnail preference
        type: editFormData.type,
        transcript_data: editFormData.transcript_data || track.transcript_data || null,
        is_system_content: editFormData.is_system_content,
      };

      console.log('Saving track with data:', saveData);
      console.log('Transcript data being saved:', JSON.stringify(saveData.transcript_data, null, 2));

      // Check for meaningful content changes that require versioning
      const contentChanged = 
        saveData.title !== track.title ||
        saveData.description !== track.description ||
        saveData.duration_minutes !== (track.duration_minutes || 0) ||
        saveData.content_url !== (track.content_url || '') ||
        saveData.thumbnail_url !== (track.thumbnail_url || '') ||
        saveData.type !== track.type ||
        JSON.stringify(saveData.transcript_data) !== JSON.stringify(track.transcript_data || null) ||
        !areArraysEqual(editFormData.learning_objectives, originalFacts);

      const tagsChanged = !areArraysEqual(saveData.tags, track.tags);
      
      const wasInKb = (track.tags || []).includes('system:show_in_knowledge_base') || track.show_in_knowledge_base;
      const kbChanged = editFormData.show_in_knowledge_base !== wasInKb;

      console.log('Changes detected:', { contentChanged, tagsChanged, kbChanged });

      // Phase 4: Pre-publish guardrails
      const isPublishing = track.status === 'published' || (isNewContent && saveData.title);
      // Only offer AI tag suggestions if:
      // 1. No tags exist
      // 2. Publishing
      // 3. For video/audio tracks: transcript must exist (AI needs transcript to analyze content)
      const isMediaTrack = saveData.type === 'video' || saveData.type === 'audio';
      const hasTranscriptForTagging = !isMediaTrack || (editFormData.transcript || track.transcript);

      if (saveData.tags.length === 0 && isPublishing && hasTranscriptForTagging) {
        const confirmTagging = window.confirm(
          "✨ AI Recommendation:\nThis content doesn't have any training topic tags. " +
          "Proper tagging helps with reporting and search.\n\n" +
          "Would you like to run AI tag suggestions before saving?"
        );
        if (confirmTagging) {
          setIsSaving(false);
          setIsTagSelectorOpen(true);
          return;
        }
      }

      // Check for related tracks if content changed
      if (contentChanged) {
        try {
          const stats = await trackRelCrud.getTrackRelationshipStats(track.id) as any;
          
          // Check if this track has ANY derived/related tracks
          if (stats.derivedCount > 0 && stats.derived) {
            // Group relationships by type for clearer messaging
            const relationshipsByType: Record<string, any[]> = {};
            stats.derived.forEach((rel: any) => {
              const type = rel.relationship_type || 'related';
              if (!relationshipsByType[type]) {
                relationshipsByType[type] = [];
              }
              relationshipsByType[type].push(rel);
            });
            
            // Build warning message
            let warningMessage = `⚠️ This ${track.type} has relationships with ${stats.derivedCount} other track(s):\n\n`;
            
            Object.entries(relationshipsByType).forEach(([relType, rels]) => {
              const typeLabel = relType === 'source' ? 'Derived from this content' 
                : relType === 'prerequisite' ? 'Has this as prerequisite'
                : 'Related';
              
              warningMessage += `${typeLabel}:\n`;
              rels.forEach((rel: any) => {
                const trackInfo = rel.derived_track;
                if (trackInfo) {
                  warningMessage += `  • ${trackInfo.title || 'Untitled'} (${trackInfo.type})\n`;
                }
              });
              warningMessage += '\n';
            });
            
            warningMessage += 'Your changes may affect these related tracks.\n\n';
            warningMessage += 'Continue with saving?';
            
            const confirmed = window.confirm(warningMessage);
            
            if (!confirmed) {
              setIsSaving(false);
              return;
            }
          }
        } catch (error) {
          console.error('Error checking for track relationships:', error);
          // Continue with save even if relationship check fails
        }
      }

      // Check if track is published and has assignments AND has content changes
      if (track.status === 'published' && contentChanged) {
        const stats = await crud.getTrackAssignmentStats(track.id);
        
        // Trigger versioning if track is in ANY playlist (even if not assigned to users yet)
        if (stats.playlistCount > 0) {
          // Show version decision modal instead of saving directly
          console.log('Track is in playlists and content changed, showing version decision modal. Stats:', stats);
          setPendingChanges(saveData);
          setIsVersionModalOpen(true);
          setIsSaving(false);
          return;
        }
      }

      // If no assignments or not published OR only metadata changed, just update normally
      await crud.updateTrack(saveData);

      console.log('Track updated successfully, calling onUpdate...');
      toast.success(contentChanged ? 'Track updated successfully!' : 'Settings updated!');
      
      setIsEditMode(false);
      
      // Call onUpdate to trigger refetch
      try {
        await onUpdate();
        console.log('Refetch complete');
      } catch (refetchError: any) {
        console.error('Refetch error (non-fatal):', refetchError);
        // Don't fail the whole operation if refetch fails
      }

      // Auto-generate key facts if this is the first save and no facts exist (for videos)
      if (track.type === 'video') {
        try {
          const { getFactsForTrack } = await import('../lib/crud/facts');
          const { projectId, publicAnonKey } = await import('../utils/supabase/info');
          const existingFacts = await getFactsForTrack(track.id);
          
          // Extract transcript text
          let transcriptText = '';
          if (editFormData.transcript_data && editFormData.transcript_data.words) {
            transcriptText = editFormData.transcript_data.words
              .map((w: any) => w.word || w.text || '')
              .join(' ')
              .trim();
          } else if (editFormData.transcript) {
            transcriptText = editFormData.transcript;
          }
          
          const hasContent = transcriptText && transcriptText.length > 150;
          
          // Check if no facts exist and there's transcript content
          if (existingFacts.length === 0 && hasContent) {
            console.log('🤖 Auto-generating key facts for video first save...');
            
            const response = await fetch(
              `${getServerUrl()}/generate-key-facts`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${publicAnonKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  title: editFormData.title || track.title || 'Untitled Video',
                  transcript: transcriptText,
                  description: editFormData.description || track.description || '',
                  trackType: 'video',
                  trackId: track.id,
                  companyId: track.company_id,
                }),
              }
            );
            
            if (response.ok) {
              const data = await response.json();
              console.log(`✅ Auto-generated ${data.enriched?.length || 0} key facts`);
              toast.success(`✨ Auto-generated ${data.enriched?.length || 0} key facts from transcript`);
            } else {
              console.error('Failed to auto-generate key facts:', await response.json());
            }
          }
        } catch (factsError) {
          console.error('Error auto-generating key facts:', factsError);
          // Don't show error to user - this is a background operation
        }
      }
    } catch (error: any) {
      console.error('Error updating track:', error);
      toast.error(`Failed to update track: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditMode(false);
    setEditFormData({});
  };

  const handleAddLearningObjective = () => {
    setEditFormData({
      ...editFormData,
      learning_objectives: [...(editFormData.learning_objectives || []), '']
    });
  };

  const handleUpdateLearningObjective = (index: number, value: string) => {
    const newObjectives = [...editFormData.learning_objectives];
    newObjectives[index] = value;
    setEditFormData({ ...editFormData, learning_objectives: newObjectives });
  };

  const handleRemoveLearningObjective = async (index: number) => {
    const factToRemove = editFormData.learning_objectives[index];
    
    // If fact has a database ID, delete from database
    if (factToRemove._dbId) {
      try {
        console.log(`🗑️ Deleting fact ${factToRemove._dbId} from database...`);
        await factsCrud.deleteFactFromTrack(factToRemove._dbId, track.id);
        toast.success('Key fact removed');
      } catch (error: any) {
        console.error('Failed to delete fact:', error);
        toast.error('Failed to remove fact from database');
        return; // Don't remove from UI if database delete failed
      }
    }
    
    // Remove from UI state
    const newObjectives = editFormData.learning_objectives.filter((_: any, i: number) => i !== index);
    setEditFormData({ ...editFormData, learning_objectives: newObjectives });
  };

  // AI: Generate Key Facts from video transcript
  const handleGenerateKeyFacts = async () => {
    // Extract text from transcript_data
    let transcriptText = '';
    
    if (editFormData.transcript_data && editFormData.transcript_data.words) {
      // Extract text from word-level transcript
      transcriptText = editFormData.transcript_data.words
        .map((w: any) => w.word || w.text || '')
        .join(' ')
        .trim();
    } else if (editFormData.transcript) {
      // Fallback to plain transcript
      transcriptText = editFormData.transcript;
    }
    
    // Validation
    if (!transcriptText || transcriptText.length < 100) {
      toast.error('Please add a transcript first (at least 100 characters)');
      return;
    }

    // Confirmation dialog if facts already exist
    const hasExistingFacts = editFormData.learning_objectives && editFormData.learning_objectives.length > 0;
    if (hasExistingFacts) {
      const action = confirm(
        `You currently have ${editFormData.learning_objectives.length} key fact(s).\n\nWhat would you like to do?\n\nOK = Replace all existing facts\nCancel = Add to existing facts`
      );
      
      const shouldReplace = action;
      
      setIsGeneratingKeyFacts(true);
      
      try {
        // If replacing, delete all existing facts from database first
        if (shouldReplace && editFormData.learning_objectives) {
          console.log('🗑️ Deleting existing facts before replacing...');
          
          for (const existingFact of editFormData.learning_objectives) {
            if (existingFact._dbId) {
              try {
                await factsCrud.deleteFactFromTrack(existingFact._dbId, track.id);
                console.log(`   ✓ Deleted fact: ${existingFact._dbId}`);
              } catch (error) {
                console.error('Error deleting fact:', error);
                // Continue with others
              }
            }
          }
          
          console.log('✅ Old facts deleted, generating new ones...');
        }
        
        console.log('🤖 Calling AI to generate key facts from transcript...');
        
        const response = await fetch(
          `${getServerUrl()}/generate-key-facts`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              title: editFormData.title || 'Untitled Video',
              transcript: transcriptText,
              description: editFormData.description || '',
              trackType: 'video',
              trackId: track.id,
              companyId: track.company_id,
            }),
          }
        );
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to generate key facts');
        }
        
        const data = await response.json();
        // Use enriched KeyFact objects (with type, steps, etc.) instead of simple strings
        const newFacts = data.enriched || data.simple || [];
        
        if (newFacts.length === 0) {
          toast.error('No key facts could be generated from this transcript');
          return;
        }
        
        // Add database IDs to new facts (returned from API)
        const newFactsWithIds = newFacts.map((fact: any, index: number) => ({
          ...fact,
          _dbId: data.factIds?.[index], // Add the database UUID
        }));
        
        const updatedFacts = shouldReplace 
          ? newFactsWithIds
          : [...editFormData.learning_objectives, ...newFactsWithIds];
        
        setEditFormData({
          ...editFormData,
          learning_objectives: updatedFacts,
        });
        
        toast.success(`✨ Generated ${newFacts.length} key fact${newFacts.length > 1 ? 's' : ''}!`);
        
      } catch (error: any) {
        console.error('❌ Error generating key facts:', error);
        toast.error(error.message || 'Failed to generate key facts');
      } finally {
        setIsGeneratingKeyFacts(false);
      }
    } else {
      // No existing facts, just generate
      setIsGeneratingKeyFacts(true);
      
      try {
        const response = await fetch(
          `${getServerUrl()}/generate-key-facts`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              title: editFormData.title || 'Untitled Video',
              transcript: transcriptText,
              description: editFormData.description || '',
              trackType: 'video',
              trackId: track.id,
              companyId: track.company_id,
            }),
          }
        );
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to generate key facts');
        }
        
        const data = await response.json();
        // Use enriched KeyFact objects (with type, steps, etc.) instead of simple strings
        const newFacts = data.enriched || data.simple || [];
        
        if (newFacts.length === 0) {
          toast.error('No key facts could be generated from this transcript');
          return;
        }
        
        // Add database IDs to new facts (returned from API)
        const newFactsWithIds = newFacts.map((fact: any, index: number) => ({
          ...fact,
          _dbId: data.factIds?.[index], // Add the database UUID
        }));
        
        setEditFormData({
          ...editFormData,
          learning_objectives: newFactsWithIds,
        });
        
        toast.success(`✨ Generated ${newFacts.length} key fact${newFacts.length > 1 ? 's' : ''}!`);
        
      } catch (error: any) {
        console.error('❌ Error generating key facts:', error);
        toast.error(error.message || 'Failed to generate key facts');
      } finally {
        setIsGeneratingKeyFacts(false);
      }
    }
  };

  const handleAddTag = () => {
    setTagSelectorConfig({
      systemCategory: 'content',
      restrictToParentName: undefined
    });
    setIsTagSelectorOpen(true);
  };

  const handleRemoveTag = (index: number) => {
    const newTags = editFormData.tags.filter((_: any, i: number) => i !== index);
    setEditFormData({ ...editFormData, tags: newTags });
  };

  const handleKBToggle = async (checked: boolean) => {
    if (isEditMode) {
      // In edit mode, open modal immediately and update form data
      if (checked) {
        setTagSelectorConfig({
          systemCategory: 'knowledge-base',
          restrictToParentName: 'KB Category'
        });
        setIsTagSelectorOpen(true);
      }
      setEditFormData({ ...editFormData, show_in_knowledge_base: checked });
    } else {
      // In view mode, update the track directly in the database
      // Set the ref BEFORE the async operation so the modal opens after onUpdate refreshes the component
      if (checked) {
        pendingKBModalOpen.current = true;
      }

      try {
        // Update tags array to include/remove the system tag
        const currentTags = new Set<string>(track.tags || []);
        if (checked) {
          currentTags.add('system:show_in_knowledge_base');
        } else {
          currentTags.delete('system:show_in_knowledge_base');
        }

        await crud.updateTrack({
          id: track.id,
          show_in_knowledge_base: checked,
          tags: Array.from(currentTags)
        });

        toast.success(checked ? 'Track added to Knowledge Base' : 'Track removed from Knowledge Base');

        // Refresh the track data - the useEffect watching 'track' will open the modal
        onUpdate();
      } catch (error: any) {
        console.error('Error updating KB toggle:', error);
        pendingKBModalOpen.current = false; // Reset on error
        toast.error('Failed to update Knowledge Base setting', {
          description: error.message || 'Please try again'
        });
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['video/mp4', 'video/webm', 'video/ogg', 'audio/mpeg', 'audio/wav', 'audio/ogg'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload a valid video or audio file');
      return;
    }

    // Validate file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      toast.error('File size must be less than 50MB');
      return;
    }

    setIsUploading(true);
    try {
      // Extract metadata from the file
      const isVideo = file.type.startsWith('video/');
      const isAudio = file.type.startsWith('audio/');
      
      // Extract duration and thumbnail
      let duration = 0;
      let thumbnailBlob: Blob | null = null;
      
      if (isVideo || isAudio) {
        const mediaElement = document.createElement(isVideo ? 'video' : 'audio') as HTMLVideoElement | HTMLAudioElement;
        const objectUrl = URL.createObjectURL(file);
        
        await new Promise<void>((resolve, reject) => {
          mediaElement.onloadedmetadata = async () => {
            // Convert seconds to minutes, but keep at least 1 minute
            const durationSeconds = mediaElement.duration;
            duration = Math.max(1, Math.round(durationSeconds / 60)); // At least 1 minute
            
            console.log('Media duration:', durationSeconds, 'seconds =', duration, 'minutes');
            
            // Generate thumbnail for video
            if (isVideo && 'videoWidth' in mediaElement) {
              const video = mediaElement as HTMLVideoElement;
              video.currentTime = Math.min(2, video.duration / 2); // Seek to 2 seconds or halfway
              
              await new Promise<void>((resolveSeek) => {
                video.onseeked = () => resolveSeek();
              });
              
              const canvas = document.createElement('canvas');
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(video, 0, 0);
                canvas.toBlob((blob) => {
                  thumbnailBlob = blob;
                  console.log('Thumbnail generated:', blob?.size, 'bytes');
                  resolve();
                }, 'image/jpeg', 0.8);
                return;
              }
            }
            resolve();
          };
          mediaElement.onerror = () => reject(new Error('Failed to load media'));
          mediaElement.src = objectUrl;
        });
        
        URL.revokeObjectURL(objectUrl);
      }
      
      console.log('Extracted metadata:', { duration, hasThumbnail: !!thumbnailBlob, type: isVideo ? 'video' : 'audio' });

      const formData = new FormData();
      formData.append('file', file);

      // Import Supabase info
      const { projectId, publicAnonKey } = await import('../utils/supabase/info');
      
      const uploadUrl = `${getServerUrl()}/upload-media`;
      console.log('Uploading to:', uploadUrl);
      console.log('File info:', { name: file.name, type: file.type, size: file.size });
      
      // First test if server is reachable
      try {
        const healthCheck = await fetch(
          `${getServerUrl()}/health`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
            },
          }
        );
        console.log('Health check response:', healthCheck.status, await healthCheck.text());
      } catch (healthError) {
        console.error('Health check failed:', healthError);
        throw new Error('Cannot reach server. Please make sure the Edge Function is deployed.');
      }
      
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: formData,
      });

      console.log('Upload response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Upload error response:', errorText);
        
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          throw new Error(`Upload failed with status ${response.status}: ${errorText}`);
        }
        
        throw new Error(errorData.error || `Upload failed with status ${response.status}`);
      }

      const data = await response.json();
      console.log('Upload successful:', data);

      // Upload thumbnail if we have one AND user hasn't explicitly set their preference
      // This respects user's thumbnail choice (including explicitly removing it)
      // thumbnailUserSet is persisted in DB, so it survives across sessions
      let thumbnailUrl = editFormData.thumbnail_url;
      const shouldAutoExtractThumbnail = thumbnailBlob && !thumbnailUserSet && !editFormData.thumbnail_url;

      if (shouldAutoExtractThumbnail) {
        console.log('Auto-extracting thumbnail (no user preference set, no existing thumbnail)...');
        const thumbnailFormData = new FormData();
        thumbnailFormData.append('file', thumbnailBlob, 'thumbnail.jpg');

        const thumbnailResponse = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
          body: thumbnailFormData,
        });

        if (thumbnailResponse.ok) {
          const thumbnailData = await thumbnailResponse.json();
          thumbnailUrl = thumbnailData.url;
          console.log('Thumbnail auto-extracted:', thumbnailUrl);
        }
      } else if (thumbnailBlob) {
        console.log('Skipping auto-extract: thumbnailUserSet=', thumbnailUserSet, ', existingThumbnail=', !!editFormData.thumbnail_url);
      }

      // Update form with all metadata
      setEditFormData({
        ...editFormData,
        content_url: data.url,
        duration_minutes: duration, // Always use extracted duration (don't fallback to old value)
        thumbnail_url: thumbnailUrl,
        type: isVideo ? 'video' : isAudio ? 'audio' : editFormData.type,
      });

      console.log('Updated form with metadata:', { duration, thumbnailUrl, type: isVideo ? 'video' : 'audio' });
      toast.success('Media file uploaded successfully! Click \"Save Changes\" to persist.');
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(`Upload failed: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleTranscribe = async () => {
    if (!editFormData.content_url && !track.content_url) {
      toast.error('Please upload a video or audio file first');
      return;
    }

    setIsTranscribing(true);
    try {
      const { projectId, publicAnonKey } = await import('../utils/supabase/info');
      
      const transcribeUrl = `${getServerUrl()}/transcribe`;
      const contentUrl = editFormData.content_url || track.content_url;
      console.log('Transcribing:', contentUrl);
      
      toast.info('Transcription started... This may take 30-60 seconds.');
      
      const response = await fetch(transcribeUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audioUrl: contentUrl,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Transcription failed with status ${response.status}`);
      }

      const data = await response.json();
      console.log('Transcription successful:', data);

      // Normalize transcript data - extract transcript_json if nested (from media_transcripts)
      let transcriptData = data.transcript;
      if (transcriptData && transcriptData.transcript_json) {
        transcriptData = transcriptData.transcript_json;
      }

      // Auto-save the transcript directly to database (without requiring edit mode)
      await crud.updateTrack({
        id: track.id,
        transcript: transcriptData.text,
        transcript_data: transcriptData,
      });

      // Update editFormData so UI shows transcript immediately (works in both edit and view mode)
      setEditFormData(prev => ({
        ...prev,
        transcript: transcriptData.text,
        transcript_data: transcriptData,
      }));

      toast.success('Transcript generated and saved!');

      // Trigger refetch to sync track prop (transcript already shows via editFormData.transcript_data)
      await onUpdate();
    } catch (error: any) {
      console.error('Transcription error:', error);
      toast.error(`Transcription failed: ${error.message}`);
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleVideoTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const newTime = e.currentTarget.currentTime;
    setCurrentTime(newTime);
  };

  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      videoRef.current.play();
    }
  };

  const handleTranscriptEdit = (editedText: string) => {
    // Update the transcript_data with the edited text
    // Keep the word-level timestamps intact, just update the display text
    setEditFormData((prev: any) => {
      const updatedTranscriptData = {
        ...(prev.transcript_data || track.transcript_data),
        text: editedText, // Store edited text for display
      };
      console.log('handleTranscriptEdit - Updating transcript_data:', updatedTranscriptData);
      return {
        ...prev,
        transcript_data: updatedTranscriptData
      };
    });
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

  // Handle back button with unsaved changes check
  const handleBackClick = () => {
    console.log('🔍 TrackDetailEdit - handleBackClick called', {
      isEditMode,
      hasChanges: hasUnsavedChanges(),
      trackData: { title: track.title, description: track.description, tags: track.tags },
      editFormData: { title: editFormData.title, description: editFormData.description, tags: editFormData.tags }
    });
    
    if (hasUnsavedChanges()) {
      setPendingNavigation(() => onBack);
      setShowUnsavedDialog(true);
    } else {
      onBack();
    }
  };

  // Handle discard from dialog
  const handleDiscardChanges = () => {
    setShowUnsavedDialog(false);
    if (pendingNavigation) {
      pendingNavigation();
      setPendingNavigation(null);
    }
  };

  // Handle save and navigate
  const handleSaveAndNavigate = async () => {
    if (!editFormData.title.trim()) {
      toast.error('Title is required');
      setShowUnsavedDialog(false);
      return;
    }

    setIsSaving(true);
    try {
      // Prepare tags including the system KB tag
      const currentTags = new Set<string>(editFormData.tags || []);
      if (editFormData.show_in_knowledge_base) {
        currentTags.add('system:show_in_knowledge_base');
      } else {
        currentTags.delete('system:show_in_knowledge_base');
      }

      const saveData = {
        id: track.id,
        title: editFormData.title || track.title,
        description: editFormData.description || track.description,
        content_url: editFormData.content_url || track.content_url,
        duration_minutes: parseInt(editFormData.duration_minutes) || track.duration_minutes || 0,
        // learning_objectives removed - facts are now stored in the facts table
        tags: Array.from(currentTags),
        thumbnail_url: editFormData.thumbnail_url || track.thumbnail_url,
        thumbnail_user_set: editFormData.thumbnail_user_set || false, // Persist user's thumbnail preference
        type: editFormData.type,
        transcript_data: editFormData.transcript_data || track.transcript_data || null,
      };

      // Check for meaningful content changes
      const contentChanged =
        saveData.title !== track.title ||
        saveData.description !== track.description ||
        saveData.duration_minutes !== (track.duration_minutes || 0) ||
        saveData.content_url !== (track.content_url || '') ||
        saveData.thumbnail_url !== (track.thumbnail_url || '') ||
        saveData.type !== track.type ||
        JSON.stringify(saveData.transcript_data) !== JSON.stringify(track.transcript_data || null) ||
        !areArraysEqual(editFormData.learning_objectives, originalFacts);

      // Check for related tracks if content changed
      if (contentChanged) {
        try {
          const stats = await trackRelCrud.getTrackRelationshipStats(track.id) as any;
          
          // Check if this track has ANY derived/related tracks
          if (stats.derivedCount > 0 && stats.derived) {
            // Group relationships by type for clearer messaging
            const relationshipsByType: Record<string, any[]> = {};
            stats.derived.forEach((rel: any) => {
              const type = rel.relationship_type || 'related';
              if (!relationshipsByType[type]) {
                relationshipsByType[type] = [];
              }
              relationshipsByType[type].push(rel);
            });
            
            // Build warning message
            let warningMessage = `⚠️ This ${track.type} has relationships with ${stats.derivedCount} other track(s):\n\n`;
            
            Object.entries(relationshipsByType).forEach(([relType, rels]) => {
              const typeLabel = relType === 'source' ? 'Derived from this content' 
                : relType === 'prerequisite' ? 'Has this as prerequisite'
                : 'Related';
              
              warningMessage += `${typeLabel}:\n`;
              rels.forEach((rel: any) => {
                const trackInfo = rel.derived_track;
                if (trackInfo) {
                  warningMessage += `  • ${trackInfo.title || 'Untitled'} (${trackInfo.type})\n`;
                }
              });
              warningMessage += '\n';
            });
            
            warningMessage += 'Your changes may affect these related tracks.\n\n';
            warningMessage += 'Continue with saving?';
            
            const confirmed = window.confirm(warningMessage);
            
            if (!confirmed) {
              setShowUnsavedDialog(false);
              setIsSaving(false);
              return;
            }
          }
        } catch (error) {
          console.error('Error checking for track relationships:', error);
          // Continue with save even if relationship check fails
        }
      }

      await crud.updateTrack(saveData);
      toast.success('Track updated successfully!');

      // Close dialog and navigate
      setShowUnsavedDialog(false);
      setIsSaving(false);
      
      if (pendingNavigation) {
        setTimeout(() => {
          if (pendingNavigation) {
            pendingNavigation();
            setPendingNavigation(null);
          }
        }, 100);
      }
    } catch (error: any) {
      console.error('Error updating track:', error);
      toast.error(`Failed to update track: ${error.message || 'Unknown error'}`);
      setShowUnsavedDialog(false);
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Back Button and Edit/Save */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            onClick={handleBackClick}
            className="flex items-center"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Library
          </Button>
          <div>
            {isEditMode ? (
              <Input
                value={editFormData.title}
                onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                className="text-2xl font-bold"
              />
            ) : (
              <h1 className="text-foreground">{track.title}</h1>
            )}
            <div className="flex items-center space-x-2 text-sm text-muted-foreground mt-1">
              {isSystemContent && (
                <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200">
                  <Lock className="h-3 w-3 mr-1" />
                  Trike Library
                </Badge>
              )}
              <Badge className={getTypeBadgeColor(track.type)}>
                {getTypeIcon(track.type)}
                <span className="ml-1 capitalize">{track.type}</span>
              </Badge>
              <span>•</span>
              <span>{track.duration_minutes ? `${track.duration_minutes} min` : 'N/A'}</span>
              <span>•</span>
              <span>Version {track.version || '1.0'}</span>
            </div>
          </div>
        </div>

        {/* Edit/Save/Cancel Buttons - show for non-system content OR super admin with system content */}
        {(!isSystemContent || isSuperAdminAuthenticated) && (
          <div className="flex items-center gap-2">
            {isEditMode ? (
              <>
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isSaving}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="hero-primary"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </>
            ) : (
              <>
                <Button
                  onClick={() => setIsEditMode(true)}
                  className="hero-primary"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Track
                  {isSystemContent && isSuperAdminAuthenticated && (
                    <Badge className="ml-2 bg-orange-100 text-orange-800">
                      Super Admin
                    </Badge>
                  )}
                </Button>
                {/* Actions Menu */}
                <Popover open={isActionsMenuOpen} onOpenChange={setIsActionsMenuOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10"
                      title="More actions"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-1" align="end">
                    <div className="flex flex-col">
                      {onDuplicate && (
                        <Button
                          variant="ghost"
                          className="justify-start h-9"
                          onClick={() => {
                            setIsActionsMenuOpen(false);
                            onDuplicate(track);
                          }}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate
                        </Button>
                      )}
                      {onCreateVariant && (
                        <Button
                          variant="ghost"
                          className="justify-start h-9"
                          onClick={() => {
                            setIsActionsMenuOpen(false);
                            onCreateVariant(track);
                          }}
                        >
                          <GitBranch className="h-4 w-4 mr-2" />
                          Create Variant
                        </Button>
                      )}
                      {(onDuplicate || onCreateVariant) && onArchive && (
                        <Separator className="my-1" />
                      )}
                      {onArchive && (
                        <Button
                          variant="ghost"
                          className="justify-start h-9"
                          onClick={() => {
                            setIsActionsMenuOpen(false);
                            onArchive(track);
                          }}
                        >
                          <Archive className="h-4 w-4 mr-2" />
                          Archive
                        </Button>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-6">
          {/* Old Version Banner - Show when viewing a non-latest version */}
          {track.version_number && !track.is_latest_version && (
            <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                    <History className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-blue-900 dark:text-blue-100">
                      Viewing Version {track.version_number}
                    </p>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      This is an older version. Changes made here won't be saved.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.history.back()}
                    className="border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-300"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Back
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Video/Media Preview */}
          <Card>
            <CardContent className="p-0">
              {track.content_url ? (
                <div className="relative aspect-video bg-black rounded-t-lg overflow-hidden">
                  {isYouTubeUrl(track.content_url) ? (
                    // YouTube embed player
                    <iframe
                      className="w-full h-full"
                      src={`https://www.youtube.com/embed/${getYouTubeVideoId(track.content_url)}?enablejsapi=1`}
                      title={track.title}
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  ) : isVimeoUrl(track.content_url) ? (
                    // Vimeo embed player
                    <iframe
                      className="w-full h-full"
                      src={`https://player.vimeo.com/video/${getVimeoVideoId(track.content_url)}?title=0&byline=0&portrait=0`}
                      title={track.title}
                      frameBorder="0"
                      allow="autoplay; fullscreen; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (track.type === 'video' || track.content_url.match(/\.(mp4|webm|ogg)$/i)) ? (
                    <video
                      ref={videoRef}
                      controls
                      className="w-full h-full"
                      poster={track.thumbnail_url || undefined}
                      src={track.content_url}
                      onTimeUpdate={handleVideoTimeUpdate}
                    >
                      Your browser does not support the video tag.
                    </video>
                  ) : (track.type === 'audio' || track.content_url.match(/\.(mp3|wav|ogg)$/i)) ? (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/20 dark:to-orange-800/20">
                      {track.thumbnail_url && (
                        <img 
                          src={track.thumbnail_url} 
                          alt={track.title}
                          className="w-48 h-48 object-cover rounded-lg mb-4"
                        />
                      )}
                      <audio
                        controls
                        className="w-full max-w-md"
                        src={track.content_url}
                      >
                        Your browser does not support the audio tag.
                      </audio>
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/20 dark:to-orange-800/20">
                      <div className="text-center">
                        <div className="text-primary opacity-40 scale-150 mb-4">
                          {getTypeIcon(track.type)}
                        </div>
                        <p className="text-sm text-muted-foreground">Preview not available for this content type</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative aspect-video bg-muted rounded-t-lg overflow-hidden">
                  {track.thumbnail_url ? (
                    <img 
                      src={track.thumbnail_url} 
                      alt={track.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/20 dark:to-orange-800/20">
                      <div className="text-primary opacity-40 scale-150">
                        {getTypeIcon(track.type)}
                      </div>
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <Button size="lg" className="rounded-full h-16 w-16 hero-primary" disabled>
                      <Play className="h-8 w-8 text-white fill-white ml-1" />
                    </Button>
                  </div>
                  {track.duration_minutes && (
                    <div className="absolute bottom-4 right-4 bg-black/70 text-white px-2 py-1 rounded text-sm">
                      {track.duration_minutes} min
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Transcript Section - Moved under video player */}
          {track.type !== 'article' && (() => {
            // Determine which transcript data to use
            const transcriptData = isEditMode
              ? (editFormData.transcript_data || track.transcript_data)
              : (viewModeTranscriptData || track.transcript_data);

            console.log('[TrackDetailEdit] Transcript render:', {
              isEditMode,
              hasEditFormTranscriptData: !!editFormData.transcript_data,
              hasTrackTranscriptData: !!track.transcript_data,
              hasViewModeTranscriptData: !!viewModeTranscriptData,
              finalTranscriptData: !!transcriptData,
              transcriptDataKeys: transcriptData ? Object.keys(transcriptData) : []
            });

            return (
            <InteractiveTranscript
              transcript={transcriptData}
              currentTime={currentTime}
              onSeek={handleSeek}
              canTranscribe={
                !!track.content_url &&
                !transcriptData &&
                !isYouTubeUrl(track.content_url) &&
                !isVimeoUrl(track.content_url)
              }
              onTranscribe={handleTranscribe}
              isTranscribing={isTranscribing}
              isEditMode={isEditMode}
              onTranscriptEdit={handleTranscriptEdit}
              contentUrl={track.content_url}
            />
            );
          })()}

          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle className="font-bold">Description</CardTitle>
            </CardHeader>
            <CardContent>
              {isEditMode ? (
                <Textarea
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                  rows={4}
                  placeholder="Enter track description..."
                />
              ) : (
                <p className="text-muted-foreground leading-relaxed">
                  {track.description || 'No description provided'}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Tags */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="font-bold">Tags</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {/* System Knowledge Base Badge - Always shown when KB toggle is on */}
                {(isEditMode ? editFormData.show_in_knowledge_base : ((track.tags || []).includes('system:show_in_knowledge_base') || track.show_in_knowledge_base)) && (
                  <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
                    In Knowledge Base
                  </Badge>
                )}
                {isEditMode ? (
                  <>
                    {(editFormData.tags || []).filter((t: string) => t !== 'system:show_in_knowledge_base').map((tag: string, index: number) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => handleRemoveTag((editFormData.tags || []).indexOf(tag))}
                      >
                        {tag}
                        <X className="h-3 w-3 ml-1" />
                      </Badge>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAddTag}
                      className="h-6"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Tag
                    </Button>
                  </>
                ) : (
                  <>
                    {(track.tags || []).filter((t: string) => t !== 'system:show_in_knowledge_base').map((tag: string, index: number) => (
                      <Badge key={index} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                    {(track.tags || []).filter((t: string) => t !== 'system:show_in_knowledge_base').length === 0 && !(track.tags || []).includes('system:show_in_knowledge_base') && (
                      <p className="text-sm text-muted-foreground">No tags</p>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAddTag}
                      className="h-6"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Tag
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Content Scope */}
          {track?.id && (
            <TrackScopeSelector
              trackId={track.id}
              currentScope={track.content_scope || 'universal'}
              readOnly={!isEditMode}
            />
          )}

          {/* Key Facts */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="font-bold">Key Facts</CardTitle>
                {isEditMode && (
                  <div className="flex items-center gap-2">
                    {/* AI Generate Button with Neon Orange Glow */}
                    <button
                      onClick={handleGenerateKeyFacts}
                      disabled={isGeneratingKeyFacts}
                      className="group relative p-2 rounded-lg transition-all duration-300 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                      title="Generate Key Facts with AI"
                    >
                      {/* Neon glow background - understated but noticeable */}
                      <div className="absolute inset-0 bg-gradient-to-r from-[#F74A05] to-[#FF6B35] rounded-lg opacity-20 blur-md group-hover:opacity-40 group-hover:blur-lg transition-all duration-300" />
                      
                      {/* Lightning bolt icon with gradient fill */}
                      <Zap 
                        className={`relative h-5 w-5 transition-all duration-300 ${
                          isGeneratingKeyFacts 
                            ? 'animate-pulse text-[#F74A05]' 
                            : 'text-[#F74A05] group-hover:drop-shadow-[0_0_8px_rgba(247,74,5,0.6)]'
                        }`}
                        fill="currentColor"
                      />
                      
                      {/* Loading state animation - radiating pulses */}
                      {isGeneratingKeyFacts && (
                        <>
                          <div className="absolute inset-0 animate-ping rounded-lg bg-[#F74A05] opacity-20" />
                          <div className="absolute inset-0 animate-pulse rounded-lg bg-[#F74A05] opacity-10" />
                        </>
                      )}
                    </button>
                    
                    <Button size="sm" variant="outline" onClick={handleAddLearningObjective}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isEditMode ? (
                <div className="space-y-2">
                  {(editFormData.learning_objectives || []).map((objective: any, index: number) => {
                    // Parse if stored as JSON string
                    let parsed = objective;
                    if (typeof objective === 'string' && objective.startsWith('{')) {
                      try {
                        parsed = JSON.parse(objective);
                      } catch (e) {
                        // If parsing fails, treat as plain string
                        parsed = objective;
                      }
                    }
                    
                    // Check if this is an enriched KeyFact object
                    const isEnriched = typeof parsed === 'object' && parsed !== null && 'fact' in parsed;
                    const displayValue = isEnriched ? parsed.fact : parsed;
                    const isProcedure = isEnriched && parsed.type === 'Procedure';
                    
                    return (
                      <div key={index} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-brand-gradient flex items-center justify-center text-white text-xs flex-shrink-0">
                            {index + 1}
                          </div>
                          <Input
                            value={displayValue}
                            onChange={(e) => handleUpdateLearningObjective(index, e.target.value)}
                            placeholder="Key fact..."
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRemoveLearningObjective(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        {isProcedure && parsed.steps && (
                          <div className="ml-10 pl-4 border-l-2 border-orange-200 space-y-1 text-xs text-muted-foreground">
                            {parsed.steps.map((step: string, stepIdx: number) => (
                              <div key={stepIdx} className="flex gap-2">
                                <span className="text-orange-500 font-semibold">{stepIdx + 1}.</span>
                                <span>{step}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {(!editFormData.learning_objectives || editFormData.learning_objectives.length === 0) && (
                    <p className="text-sm text-muted-foreground">No key facts yet. Click "Add" to create one.</p>
                  )}
                </div>
              ) : (
                <ul className="space-y-2">
                  {viewModeFacts && viewModeFacts.length > 0 ? (
                    viewModeFacts.map((objective: any, index: number) => {
                      // Parse if stored as JSON string
                      let parsed = objective;
                      if (typeof objective === 'string' && objective.startsWith('{')) {
                        try {
                          parsed = JSON.parse(objective);
                        } catch (e) {
                          // If parsing fails, treat as plain string
                          parsed = objective;
                        }
                      }
                      
                      // Check if this is an enriched KeyFact object with type and steps
                      const isEnriched = typeof parsed === 'object' && parsed !== null && 'type' in parsed;
                      const isProcedure = isEnriched && parsed.type === 'Procedure' && parsed.steps;
                      const displayText = isEnriched ? parsed.fact : parsed;
                      
                      return (
                        <li key={index} className="flex items-start space-x-2">
                          <div className="h-6 w-6 rounded-full bg-brand-gradient flex items-center justify-center text-white text-xs mt-0.5 flex-shrink-0">
                            {index + 1}
                          </div>
                          <div className="flex-1 pt-0.5">
                            <span className="text-muted-foreground leading-relaxed">{displayText}</span>
                            {isProcedure && (
                              <ul className="mt-2 ml-4 space-y-1 text-xs text-muted-foreground border-l-2 border-orange-200 pl-3">
                                {parsed.steps.map((step: string, stepIndex: number) => (
                                  <li key={stepIndex} className="flex items-start gap-2">
                                    <span className="text-orange-500 font-semibold">{stepIndex + 1}.</span>
                                    <span>{step}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </li>
                      );
                    })
                  ) : (
                    <p className="text-sm text-muted-foreground">No key facts defined</p>
                  )}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* REMOVED: Duplicate transcript section - keeping the one under video player */}
        </div>

        {/* Sidebar - Metadata */}
        <div className="space-y-6">
          {/* Publishing Status */}
          {(!isSystemContent || isSuperAdminAuthenticated) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Publishing Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  {/* Show popover with "Processing..." when trying to publish but not ready */}
                  {track.status !== 'published' && !canPublish ? (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Badge
                          variant="outline"
                          className="cursor-not-allowed opacity-60 bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400"
                        >
                          Draft
                        </Badge>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-2 text-xs" side="left">
                        Processing...
                      </PopoverContent>
                    </Popover>
                  ) : (
                    <Badge
                      variant="outline"
                      className={`cursor-pointer transition-colors ${
                        track.status === 'published'
                          ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200'
                          : 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 hover:bg-yellow-200'
                      }`}
                      onClick={async () => {
                        const newStatus = track.status === 'published' ? 'draft' : 'published';
                        try {
                          await crud.updateTrack({ id: track.id, status: newStatus });
                          toast.success(`Track ${newStatus === 'published' ? 'published' : 'moved to drafts'}!`);
                          await onUpdate();
                        } catch (error: any) {
                          console.error('Error updating status:', error);
                          toast.error(error.message || 'Failed to update status');
                        }
                      }}
                    >
                      {track.status === 'published' ? 'Published' : 'Draft'}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {track.status === 'published'
                    ? 'Click the status badge to move to drafts'
                    : canPublish
                      ? 'Click the status badge to publish'
                      : 'Waiting for content to finish processing...'}
                </p>
              </CardContent>
            </Card>
          )}
          
          {/* Knowledge Base Settings - Only show for published tracks */}
          {['article', 'video', 'story'].includes(isEditMode ? editFormData.type : track.type) && track.status === 'published' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Knowledge Base
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="show-in-kb" className="text-base">Show in KB</Label>
                    <p className="text-xs text-muted-foreground">
                      Available in Knowledge Base
                    </p>
                  </div>
                  <Switch
                    id="show-in-kb"
                    checked={isEditMode ? editFormData.show_in_knowledge_base : ((track.tags || []).includes('system:show_in_knowledge_base') || track.show_in_knowledge_base)}
                    onCheckedChange={handleKBToggle}
                  />
                </div>
                
                {(isEditMode ? editFormData.show_in_knowledge_base : ((track.tags || []).includes('system:show_in_knowledge_base') || track.show_in_knowledge_base)) && (
                  <div className="pt-2">
                     <Button
                        variant="outline"
                        size="sm"
                        className="w-full mb-3"
                        onClick={() => {
                          setTagSelectorConfig({
                             systemCategory: 'knowledge-base',
                             restrictToParentName: 'KB Category'
                          });
                          setIsTagSelectorOpen(true);
                        }}
                     >
                       <Tag className="h-4 w-4 mr-2" />
                       Manage KB Tags
                     </Button>

                     {/* Selected KB Tags Display */}
                     <div>
                       <p className="text-xs font-medium mb-2 text-muted-foreground">Selected Categories:</p>
                       <div className="flex flex-wrap gap-2">
                         {(isEditMode ? editFormData.tags : track.tags || [])
                           .filter((t: string) => kbTagNames.has(t))
                           .map((tag: string) => (
                             <Badge key={tag} variant="secondary" className="bg-blue-50 text-blue-700 border-blue-100">
                               {tag}
                             </Badge>
                         ))}
                         {(isEditMode ? editFormData.tags : track.tags || [])
                           .filter((t: string) => kbTagNames.has(t)).length === 0 && (
                           <span className="text-xs text-muted-foreground italic">No categories selected</span>
                         )}
                       </div>
                     </div>

                     <p className="text-xs text-muted-foreground mt-2">
                       Select "KB Category" tags to organize this content in the Knowledge Base.
                     </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          
          {/* Super Admin Settings */}
          {isSuperAdminAuthenticated && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4 text-orange-500" />
                  Super Admin Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="system-content" className="text-sm font-medium">System Template</Label>
                    <p className="text-xs text-muted-foreground">
                      Mark as Trike Library content
                    </p>
                  </div>
                  <Switch
                    id="system-content"
                    checked={isEditMode ? editFormData.is_system_content : track.is_system_content}
                    onCheckedChange={(checked) => {
                      if (isEditMode) {
                        setEditFormData({ ...editFormData, is_system_content: checked });
                      } else {
                        crud.updateTrack({ id: track.id, is_system_content: checked })
                          .then(() => {
                            toast.success(checked ? 'Marked as system content' : 'Removed from Trike Library');
                            onUpdate();
                          });
                      }
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Performance Metrics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Views
                </span>
                <span className="font-semibold">{track.view_count || 0}</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <ThumbsUp className="h-4 w-4" />
                  Likes
                </span>
                <span className="font-semibold">{track.likes_count || 0}</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Published
                </span>
                <span className="text-sm">
                  {track.published_at 
                    ? new Date(track.published_at).toLocaleDateString()
                    : 'N/A'}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Last Updated
                </span>
                <span className="text-sm">
                  {track.updated_at 
                    ? new Date(track.updated_at).toLocaleDateString()
                    : 'N/A'}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Duration */}
          {isEditMode && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Duration</CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  type="number"
                  value={editFormData.duration_minutes}
                  onChange={(e) => setEditFormData({ ...editFormData, duration_minutes: e.target.value })}
                  placeholder="Duration in minutes"
                />
              </CardContent>
            </Card>
          )}

          {/* Media Upload - only in edit mode for non-system content */}
          {isEditMode && !isSystemContent && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Media File</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Current Media URL */}
                {editFormData.content_url && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Current Media URL:</p>
                    <p className="text-xs font-mono break-all">{editFormData.content_url}</p>
                  </div>
                )}

                {/* URL Input */}
                <div className="space-y-2">
                  <label className="text-sm flex items-center gap-2">
                    <LinkIcon className="h-4 w-4" />
                    Enter Media URL
                  </label>
                  <Input
                    type="url"
                    value={editFormData.content_url}
                    onChange={async (e) => {
                      const newUrl = e.target.value;
                      setEditFormData({ ...editFormData, content_url: newUrl });

                      // Auto-extract thumbnail for YouTube/Vimeo URLs
                      // Only if user hasn't explicitly set thumbnail preference AND no existing thumbnail
                      if (newUrl && (isYouTubeUrl(newUrl) || isVimeoUrl(newUrl)) && !thumbnailUserSet && !editFormData.thumbnail_url) {
                        const thumbnailUrl = await extractThumbnailFromUrl(newUrl);
                        if (thumbnailUrl) {
                          setEditFormData((prev: any) => ({ ...prev, thumbnail_url: thumbnailUrl }));
                          toast.success('Thumbnail auto-extracted from video URL!');
                        }
                      }
                    }}
                    placeholder="https://example.com/video.mp4"
                  />
                  <p className="text-xs text-muted-foreground">
                    Supports YouTube, Vimeo, and direct file URLs. Note: Auto-transcription only works with uploaded files or direct media URLs, not YouTube/Vimeo links.
                  </p>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <Separator />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Or</span>
                  </div>
                </div>

                {/* File Upload */}
                <div className="space-y-2">
                  <label className="text-sm flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    Upload File
                  </label>
                  <Input
                    type="file"
                    accept="video/*,audio/*"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                    className="cursor-pointer"
                  />
                  {isUploading && (
                    <p className="text-xs text-muted-foreground">Uploading... Please wait.</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Supported formats: MP4, WebM, OGG (video), MP3, WAV, OGG (audio)
                    <br />
                    Max size: 50MB
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Thumbnail - edit mode only */}
          {isEditMode && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center">
                  <ImageIcon className="h-4 w-4 mr-2" />
                  Thumbnail
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {editFormData.thumbnail_url ? (
                  <div className="space-y-3">
                    <div className="relative aspect-video rounded-lg overflow-hidden bg-black">
                      <img
                        src={editFormData.thumbnail_url}
                        alt="Track thumbnail"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex gap-2">
                      <label className="flex-1">
                        <Button variant="outline" size="sm" className="w-full" asChild disabled={isUploading}>
                          <span>
                            <Upload className="h-4 w-4 mr-2" />
                            Replace
                          </span>
                        </Button>
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              try {
                                setIsUploading(true);
                                const result = await crud.uploadTrackFile(track.id, file);
                                setEditFormData((prev: any) => ({
                                  ...prev,
                                  thumbnail_url: result.url,
                                  thumbnail_user_set: true // User explicitly set thumbnail
                                }));
                                setThumbnailUserSet(true); // Update component state too
                                toast.success('Thumbnail updated!');
                              } catch (error: any) {
                                console.error('Error uploading thumbnail:', error);
                                toast.error('Failed to upload thumbnail');
                              } finally {
                                setIsUploading(false);
                              }
                            }
                          }}
                          disabled={isUploading}
                        />
                      </label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditFormData((prev: any) => ({
                            ...prev,
                            thumbnail_url: '',
                            thumbnail_user_set: true // User explicitly removed thumbnail
                          }));
                          setThumbnailUserSet(true); // Update component state too
                        }}
                        disabled={isUploading}
                        title="Remove thumbnail"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <label>
                    <div className="border-2 border-dashed border-border rounded-lg p-6 hover:bg-accent/50 transition-colors cursor-pointer">
                      <div className="text-center">
                        <ImageIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground mb-1">Upload Thumbnail</p>
                        <p className="text-xs text-muted-foreground">16:9 recommended</p>
                      </div>
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            setIsUploading(true);
                            const result = await crud.uploadTrackFile(track.id, file);
                            setEditFormData((prev: any) => ({
                              ...prev,
                              thumbnail_url: result.url,
                              thumbnail_user_set: true // User explicitly uploaded thumbnail
                            }));
                            setThumbnailUserSet(true); // Update component state too
                            toast.success('Thumbnail uploaded!');
                          } catch (error: any) {
                            console.error('Error uploading thumbnail:', error);
                            toast.error('Failed to upload thumbnail');
                          } finally {
                            setIsUploading(false);
                          }
                        }
                      }}
                      disabled={isUploading}
                    />
                  </label>
                )}
                <p className="text-xs text-muted-foreground">
                  Used in playlists, library views, and video player poster
                </p>
              </CardContent>
            </Card>
          )}

          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Type:</span>
                <span className="ml-2 capitalize">{track.type}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Status:</span>
                <span className="ml-2 capitalize">{track.status}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Version:</span>
                <span className="ml-2">{track.version || '1.0'}</span>
              </div>
              {track.passing_score && (
                <div>
                  <span className="text-muted-foreground">Passing Score:</span>
                  <span className="ml-2">{track.passing_score}%</span>
                </div>
              )}
              {track.max_attempts && (
                <div>
                  <span className="text-muted-foreground">Max Attempts:</span>
                  <span className="ml-2">{track.max_attempts}</span>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Associated Playlists */}
          <AssociatedPlaylists 
            trackId={track.id}
            onPlaylistClick={onNavigateToPlaylist}
          />
          
          {/* Track Relationships */}
          <TrackRelationships
            trackId={track.id}
            trackType={track.type}
            onNavigateToTrack={onVersionClick}
          />
          
          {/* Version History */}
          <VersionHistory
            trackId={track.id}
            currentVersion={track.version_number || 1}
            onVersionClick={async (versionTrackId) => {
              console.log('🔍 Version clicked, loading version:', versionTrackId);
              if (onVersionClick) {
                onVersionClick(versionTrackId);
              } else {
                // Fallback to URL navigation if prop not provided
                window.location.href = `/video/${versionTrackId}`;
              }
            }}
          />
        </div>
      </div>

      {/* Tag Selector Dialog */}
      <TagSelectorDialog
        isOpen={isTagSelectorOpen}
        onClose={() => {
          setIsTagSelectorOpen(false);
          // Refresh KB tags in case new tags were created
          loadKBTags();
        }}
        selectedTags={isEditMode ? (editFormData.tags || []) : (track.tags || [])}
        onTagsChange={async (tags) => {
          if (isEditMode) {
            setEditFormData({ ...editFormData, tags });
          } else {
            // In view mode, save directly to database using junction table
            try {
              // Use assignTrackTagsByName which writes to junction table AND syncs legacy column
              const { unrecognizedNames } = await tagsCrud.assignTrackTagsByName(track.id, tags, true);
              if (unrecognizedNames.length > 0) {
                console.warn('Some tags were not recognized:', unrecognizedNames);
              }
              toast.success('Tags updated');
              onUpdate(); // Refresh track data
            } catch (error: any) {
              console.error('Error updating tags:', error);
              toast.error('Failed to update tags', {
                description: error.message || 'Please try again'
              });
            }
          }
          // Refresh KB tags to include any newly created tags
          loadKBTags();
        }}
        systemCategory={tagSelectorConfig.systemCategory}
        restrictToParentName={tagSelectorConfig.restrictToParentName}
        // NEW: Pass content context for AI suggestions
        showAISuggest={tagSelectorConfig.systemCategory === 'content'}
        contentContext={{
          title: isEditMode ? editFormData.title : track.title,
          description: isEditMode ? editFormData.description : track.description,
          transcript: isEditMode 
            ? (editFormData.transcript_data?.text || editFormData.transcript)
            : (track.transcript_data?.text || track.transcript),
          keyFacts: isEditMode ? editFormData.learning_objectives : viewModeFacts,
          trackId: track.id,
          organizationId: track.organization_id,
        }}
      />
      
      {/* Version Decision Modal */}
      <VersionDecisionModal
        isOpen={isVersionModalOpen}
        onClose={() => {
          setIsVersionModalOpen(false);
          setPendingChanges(null);
        }}
        trackId={track.id}
        trackTitle={track.title}
        currentVersion={track.version_number || 1}
        pendingChanges={pendingChanges}
        onVersionCreated={async (newTrackId, strategy) => {
          console.log('📍 TrackDetailEdit: onVersionCreated callback triggered');
          console.log('✅ Version created! New track ID:', newTrackId);
          console.log('📝 Strategy:', strategy);
          
          toast.success(`Version ${(track.version_number || 1) + 1} created with ${strategy} strategy!`);
          
          console.log('🔄 Closing modal and resetting state...');
          setIsVersionModalOpen(false);
          setPendingChanges(null); // CRITICAL: Clear pending changes
          setIsSaving(false); // Reset saving state
          
          console.log('🔄 Exiting edit mode...');
          
          setIsEditMode(false);
          
          console.log('⏳ Waiting 300ms before refreshing data...');
          // Small delay to let modal close gracefully
          setTimeout(async () => {
            console.log('🔄 Calling onUpdate with new track ID:', newTrackId);
            // Pass the new track ID to onUpdate so it loads the new version
            await onUpdate(newTrackId);
            console.log('✅ Track data refreshed with new version');
          }, 300);
        }}
      />
      
      {/* Unsaved Changes Dialog */}
      <UnsavedChangesDialog
        open={showUnsavedDialog}
        onOpenChange={setShowUnsavedDialog}
        onDiscard={handleDiscardChanges}
        onSave={handleSaveAndNavigate}
      />
    </div>
  );
}