import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { RichTextEditor } from './RichTextEditor';
import { AttachmentPreviewDialog } from './AttachmentPreviewDialog';
import { TagSelectorDialog } from './TagSelectorDialog';
import { VersionHistory } from './content-authoring/VersionHistory';
import { AssociatedPlaylists } from './content-authoring/AssociatedPlaylists';
import { TrackRelationships } from './content-authoring/TrackRelationships';
import { VersionDecisionModal } from './content-authoring/VersionDecisionModal';
import { TrackScopeModal } from './content-authoring/TrackScopeModal';
import { UnsavedChangesDialog } from './UnsavedChangesDialog';
import { TTSPlayer } from './content/TTSPlayer';
import {
  Calendar,
  Clock,
  Tag,
  Eye,
  FileText,
  CheckCircle2,
  Lock,
  Edit,
  Save,
  X,
  ChevronLeft,
  Plus,
  Upload,
  Link as LinkIcon,
  BookOpen,
  Image as ImageIcon,
  Download,
  Trash2,
  Paperclip,
  ExternalLink,
  History,
  Zap,
  ThumbsUp,
  MoreVertical,
  Copy,
  Archive,
  GitBranch,
  Shield
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './ui/popover';
import * as crud from '../lib/crud';
import { downloadKbTrackAsPdf } from '../lib/utils/kbPdfExport';
import * as attachmentCrud from '../lib/crud/attachments';
import * as factsCrud from '../lib/crud/facts';
import * as trackRelCrud from '../lib/crud/trackRelationships';
import * as tagsCrud from '../lib/crud/tags';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey, getServerUrl } from '../utils/supabase/info';
import { supabase } from '../lib/supabase';
import { getEffectiveThumbnailUrl, DEFAULT_THUMBNAIL_URL } from '../lib/crud/tracks';

interface ArticleDetailEditProps {
  track: any;
  onBack: () => void;
  onUpdate: () => void;
  onVersionClick?: (versionTrackId: string) => void; // Optional version navigation callback
  isSuperAdminAuthenticated?: boolean;
  isNewContent?: boolean;
  onNavigateToPlaylist?: (playlistId: string) => void;
  registerUnsavedChangesCheck?: (checkFn: (() => boolean) | null) => void; // Register unsaved changes check
  onArchive?: (track: any) => void; // Archive callback
  onDuplicate?: (track: any) => void; // Duplicate callback
  onCreateVariant?: (track: any) => void; // Create variant callback
}

export function ArticleDetailEdit({ track, onBack, onUpdate, onVersionClick, isSuperAdminAuthenticated = false, isNewContent = false, onNavigateToPlaylist, registerUnsavedChangesCheck, onArchive, onDuplicate, onCreateVariant }: ArticleDetailEditProps) {
  const [isEditMode, setIsEditMode] = useState(isNewContent); // Start in edit mode for new content
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [attachments, setAttachments] = useState<any[]>([]);
  const [previewAttachment, setPreviewAttachment] = useState<any | null>(null);
  const [isTagSelectorOpen, setIsTagSelectorOpen] = useState(false);
  const [tagSelectorConfig, setTagSelectorConfig] = useState<{
    systemCategory: any;
    restrictToParentName?: string;
  }>({ systemCategory: 'content' });
  const [isFormDataLoaded, setIsFormDataLoaded] = useState(false); // Track if form data is ready

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

  // Track scope modal
  const [isScopeModalOpen, setIsScopeModalOpen] = useState(false);

  // Facts loaded from database (for view mode)
  const [viewModeFacts, setViewModeFacts] = useState<any[]>([]);
  
  // Original facts loaded from DB (for edit mode comparison)
  const [originalFacts, setOriginalFacts] = useState<any[]>([]);
  
  // TTS refresh key - increment this to force TTS player to refresh
  const [ttsRefreshKey, setTtsRefreshKey] = useState(0);

  // Source document info (if track was generated from a source chunk)
  const [sourceDocumentInfo, setSourceDocumentInfo] = useState<{
    sourceFileId: string;
    sourceFileName: string;
    sourceChunkId: string;
    chunkTitle: string;
  } | null>(null);

  const [editFormData, setEditFormData] = useState<any>({
    title: '',
    description: '',
    duration_minutes: '',
    learning_objectives: [],
    tags: [],
    content_url: '',
    article_body: '',
    is_system_content: false,
  });

  const [kbTagNames, setKbTagNames] = useState<Set<string>>(new Set());

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

  const isSystemContent = track.is_system_content;

  // Load attachments only when in edit mode
  useEffect(() => {
    if (!isEditMode) return;
    
    const loadAttachments = async () => {
      try {
        const attachments = await attachmentCrud.getAttachments(track.id);
        setAttachments(attachments);
      } catch (error) {
        console.error('Error loading attachments:', error);
      }
    };
    
    loadAttachments();
  }, [track.id, isEditMode]);

  // Load attachments for view mode
  useEffect(() => {
    const loadAttachments = async () => {
      try {
        const attachments = await attachmentCrud.getAttachments(track.id);
        setAttachments(attachments);
      } catch (error) {
        console.error('Error loading attachments:', error);
      }
    };

    loadAttachments();
  }, [track.id]);

  // Load source document info (if track was generated from a source chunk)
  useEffect(() => {
    const loadSourceDocumentInfo = async () => {
      try {
        // Query track_source_chunks to find the source chunk
        const { data: trackChunks, error: chunkError } = await supabase
          .from('track_source_chunks')
          .select(`
            source_chunk_id,
            source_chunks!inner (
              id,
              title,
              source_file_id,
              source_files!inner (
                id,
                file_name
              )
            )
          `)
          .eq('track_id', track.id)
          .limit(1);

        if (chunkError) {
          // Table might not exist yet - that's fine
          console.log('Could not load source document info:', chunkError.message);
          return;
        }

        if (trackChunks && trackChunks.length > 0) {
          const chunk = trackChunks[0];
          const sourceChunk = chunk.source_chunks as any;
          const sourceFile = sourceChunk?.source_files as any;

          if (sourceFile) {
            setSourceDocumentInfo({
              sourceFileId: sourceFile.id,
              sourceFileName: sourceFile.file_name,
              sourceChunkId: sourceChunk.id,
              chunkTitle: sourceChunk.title || 'Untitled chunk',
            });
          }
        }
      } catch (error) {
        // Silently fail - source document info is optional
        console.log('Source document lookup failed:', error);
      }
    };

    loadSourceDocumentInfo();
  }, [track.id]);

  // Calculate reading time based on word count
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

  // Initialize form data when entering edit mode
  useEffect(() => {
    if (isEditMode) {
      const loadArticleData = async () => {
        // Removed console.log statements that were firing on every render
        
        // Fetch facts from database (new facts table)
        let facts: any[] = [];
        try {
          const dbFacts = await factsCrud.getFactsForTrack(track.id);
          
          // Convert DB facts to frontend format
          facts = dbFacts.map((f: any) => ({
            title: f.title,
            fact: f.content,
            content: f.content,
            type: f.type,
            steps: f.steps || [],
            contexts: [f.context?.specificity || 'universal'],
            _dbId: f.id,
            _extractedBy: f.extracted_by,
          }));
          console.log(`📊 Loaded ${facts.length} facts from database for article ${track.id}`);
        } catch (error) {
          console.warn('Could not fetch facts from database:', error);
        }
        
        // Store original facts for comparison
        setOriginalFacts(facts);

        // Load tags from junction table (source of truth)
        let tagNames: string[] = track.tags || [];
        try {
          tagNames = await tagsCrud.getTrackTagNames(track.id);
          console.log(`🏷️ Loaded ${tagNames.length} tags from track_tags junction table`);
        } catch (tagError) {
          console.warn('Could not fetch tags from junction table, falling back to track.tags:', tagError);
          tagNames = track.tags || [];
        }

        setEditFormData({
          title: track.title || '',
          description: track.description || '',
          duration_minutes: track.duration_minutes || '',
          learning_objectives: facts,
          tags: tagNames,
          content_url: track.content_url || '',
          thumbnail_url: getEffectiveThumbnailUrl(track.thumbnail_url) !== DEFAULT_THUMBNAIL_URL ? (track.thumbnail_url || '') : '',
          type: track.type || 'article',
          article_body: track.transcript || '', // Article body is stored in transcript field
          show_in_knowledge_base: tagNames.includes('system:show_in_knowledge_base') || track.show_in_knowledge_base || false,
          is_system_content: track.is_system_content || false,
        });

        console.log('📝 Form data initialized with article_body:', track.transcript || '');
        setIsFormDataLoaded(true); // Mark form data as loaded
      };

      loadArticleData();
    }
  }, [isEditMode, track]);

  // Load facts for view mode
  useEffect(() => {
    // Only load facts when NOT in edit mode
    if (isEditMode) {
      return;
    }
    
    if (track.id) {
      const loadViewModeFacts = async () => {
        // Use editFormData.learning_objectives as fallback if available (just exited edit mode)
        const fallbackFacts = (editFormData.learning_objectives || []).length > 0 
          ? editFormData.learning_objectives 
          : null;
        
        if (fallbackFacts) {
          setViewModeFacts(fallbackFacts);
        }
        
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
          
          // Only update if API returned facts, or if we don't have fallback facts
          if (facts.length > 0 || !fallbackFacts) {
            setViewModeFacts(facts);
            console.log(`📊 Loaded ${facts.length} facts for article view mode`);
          } else {
            console.log(`📊 API returned 0 facts, keeping ${fallbackFacts.length} fallback facts from editFormData`);
          }
        } catch (error) {
          console.warn('Could not fetch facts for view mode:', error);
          // If we have fallback facts, keep them
          if (!fallbackFacts) {
            setViewModeFacts([]);
          }
        }
      };
      
      loadViewModeFacts();
    }
  }, [isEditMode, track]);

  // Listen for facts regeneration completion (auto-refresh after AI generation)
  useEffect(() => {
    if (!isEditMode) return;
    
    const handleFactsRegenerated = async (event: CustomEvent) => {
      if (event.detail.trackId === track.id) {
        console.log('🔄 Facts regenerated event received, reloading facts...');
        
        // Reload facts from database
        try {
          const dbFacts = await factsCrud.getFactsForTrack(track.id);
          const facts = dbFacts.map((f: any) => ({
            title: f.title,
            fact: f.content,
            content: f.content,
            type: f.type,
            steps: f.steps || [],
            contexts: [f.context?.specificity || 'universal'],
            _dbId: f.id,
            _extractedBy: f.extracted_by,
          }));
          
          console.log(`✅ Reloaded ${facts.length} facts after regeneration`);
          
          // Update the edit form with new facts
          setEditFormData(prev => ({
            ...prev,
            learning_objectives: facts
          }));
          
          // Update original facts to prevent unsaved changes warning
          setOriginalFacts(facts);
          
          toast.success(`✨ Key Facts updated: ${facts.length} facts loaded`);
        } catch (error) {
          console.error('Failed to reload facts:', error);
          toast.error('Failed to reload updated facts');
        }
      }
    };
    
    window.addEventListener('factsRegenerated', handleFactsRegenerated as EventListener);
    
    return () => {
      window.removeEventListener('factsRegenerated', handleFactsRegenerated as EventListener);
    };
  }, [isEditMode, track.id]);

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
    if (!isEditMode || !isFormDataLoaded) return false;
    
    return (
      editFormData.title !== (track.title || '') ||
      editFormData.description !== (track.description || '') ||
      editFormData.duration_minutes !== (track.duration_minutes || '') ||
      editFormData.article_body !== (track.transcript || '') ||
      editFormData.content_url !== (track.content_url || '') ||
      editFormData.thumbnail_url !== (track.thumbnail_url || '') ||
      !areArraysEqual(editFormData.learning_objectives, originalFacts) ||
      !areArraysEqual(editFormData.tags, track.tags)
    );
  }, [isEditMode, isFormDataLoaded, editFormData, track, originalFacts]);

  // Store the latest hasUnsavedChanges function in a ref to avoid infinite loops
  const hasUnsavedChangesRef = useRef(hasUnsavedChanges);
  useEffect(() => {
    hasUnsavedChangesRef.current = hasUnsavedChanges;
  }, [hasUnsavedChanges]);

  // Create a stable wrapper function that uses the ref
  const hasUnsavedChangesStable = useCallback(() => {
    return hasUnsavedChangesRef.current();
  }, []);

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
  }, [isEditMode, isFormDataLoaded, editFormData, track]);

  // Register unsaved changes check with parent
  // Only re-register when isEditMode changes, not when hasUnsavedChanges function changes
  useEffect(() => {
    if (registerUnsavedChangesCheck) {
      if (isEditMode) {
        // Use the stable wrapper function
        registerUnsavedChangesCheck(hasUnsavedChangesStable);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode, registerUnsavedChangesCheck]); // hasUnsavedChangesStable is stable (empty deps), no need to include it

  const handleSave = async () => {
    console.log('💾 handleSave called in ArticleDetailEdit');
    
    if (!editFormData.title.trim()) {
      toast.error('Title is required');
      return;
    }

    console.log('💾 Title validated, setting isSaving to true');
    setIsSaving(true);
    try {
      // Prepare tags including the system KB tag
      const currentTags = new Set<string>(editFormData.tags || []);
      if (editFormData.show_in_knowledge_base) {
        currentTags.add('system:show_in_knowledge_base');
      } else {
        currentTags.delete('system:show_in_knowledge_base');
      }

      // Calculate duration from word count (200 WPM) if article body changed
      let calculatedDuration = parseInt(editFormData.duration_minutes) || track.duration_minutes;
      if (editFormData.article_body && editFormData.article_body !== (track.transcript || '')) {
        // Article content changed, recalculate duration
        const plainText = editFormData.article_body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        const wordCount = plainText.split(/\s+/).filter(word => word.length > 0).length;
        if (wordCount > 0) {
          calculatedDuration = Math.max(1, Math.ceil(wordCount / 200));
        }
      }

      const updateData = {
        id: track.id,
        title: editFormData.title || track.title,
        description: editFormData.description || track.description,
        duration_minutes: calculatedDuration,
        content_url: editFormData.content_url || track.content_url || '',
        thumbnail_url: editFormData.thumbnail_url || track.thumbnail_url || '',
        type: editFormData.type,
        tags: Array.from(currentTags),
        transcript: editFormData.article_body || '', // Store article body as transcript
        is_system_content: editFormData.is_system_content,
        // learning_objectives removed - facts are now stored in the facts table
      };

      console.log('💾 Update data prepared:', updateData);
      console.log('💾 Track status:', track.status);

      // Check for meaningful content changes that require versioning
      const contentChanged = 
        updateData.title !== track.title ||
        updateData.description !== track.description ||
        updateData.duration_minutes !== (track.duration_minutes || 0) ||
        updateData.content_url !== (track.content_url || '') ||
        updateData.thumbnail_url !== (track.thumbnail_url || '') ||
        updateData.type !== track.type ||
        updateData.transcript !== (track.transcript || '') ||
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
              setIsSaving(false);
              return;
            }
          }
        } catch (error) {
          console.error('Error checking for track relationships:', error);
          // Continue with save even if relationship check fails
        }
      }

      const tagsChanged = !areArraysEqual(updateData.tags, track.tags);
      
      const wasInKb = (track.tags || []).includes('system:show_in_knowledge_base') || track.show_in_knowledge_base;
      const kbChanged = editFormData.show_in_knowledge_base !== wasInKb;

      console.log('💾 Changes detected:', { contentChanged, tagsChanged, kbChanged });

      // Check if track is published and has assignments AND has content changes
      if (track.status === 'published' && contentChanged) {
        console.log('💾 Track is published and content changed, checking assignment stats...');
        const stats = await crud.getTrackAssignmentStats(track.id);
        console.log('💾 Assignment stats:', stats);
        
        // Trigger versioning if track is in ANY playlist (even if not assigned to users yet)
        if (stats.playlistCount > 0) {
          // Show version decision modal instead of saving directly
          console.log('🔔 Track is in playlists, showing version decision modal. Stats:', stats);
          // Add show_in_knowledge_base back to pendingChanges for the modal (if it uses it)
          // But actually the modal likely calls save again or creates version.
          // If creating version, we need to ensure the tag is passed.
          // updateData has the correct tags.
          console.log('🔔 Setting pendingChanges:', updateData);
          setPendingChanges(updateData);
          console.log('🔔 Opening version modal...');
          setIsVersionModalOpen(true);
          console.log('🔔 Resetting isSaving to false');
          setIsSaving(false);
          console.log('🔔 Returning from handleSave');
          return;
        }
      }

      console.log('💾 No versioning needed (or only metadata changed), updating track directly...');
      // If no assignments or not published OR only metadata changed, just update normally
      const result = await crud.updateTrack(updateData);
      console.log('Track saved, result:', result);
      toast.success(contentChanged ? 'Article updated successfully!' : 'Settings updated!');
      setIsEditMode(false);
      
      // Force TTS player to refresh ONLY if the actual text content changed
      // TTS is only affected by transcript/content_text changes, not metadata (tags, title, thumbnail, etc.)
      // The backend uses content hashing to determine if regeneration is actually needed,
      // so we just need to trigger a refresh when content changes
      const ttsContentChanged = updateData.transcript !== (track.transcript || '');
      if (ttsContentChanged) {
        console.log('🔊 TTS content changed, forcing TTS refresh (backend will hash-check)...');
        setTtsRefreshKey(prev => prev + 1);
      } else {
        console.log('🔊 TTS content unchanged, skipping TTS refresh (metadata-only change)');
      }
      
      // Call onUpdate to refresh the parent component's data
      console.log('Calling onUpdate to refresh track data...');
      await onUpdate();
      console.log('onUpdate complete, track should be refreshed');

      // Auto-generate key facts only when: no facts in DB AND none in form (first save, user didn't use bolt)
      try {
        const existingFacts = await factsCrud.getFactsForTrack(track.id);
        const hasContent = editFormData.article_body && editFormData.article_body.trim().length > 150;
        const hasFactsInForm = (editFormData.learning_objectives?.length ?? 0) > 0;
        
        if (existingFacts.length === 0 && !hasFactsInForm && hasContent) {
          console.log('🤖 Auto-generating key facts for first save...');
          
          // Strip HTML from article body to get clean text
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = editFormData.article_body;
          const plainText = tempDiv.textContent || tempDiv.innerText || '';
          
          if (plainText.length >= 150) {
            const response = await fetch(
              `${getServerUrl()}/generate-key-facts`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${publicAnonKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  title: editFormData.title || 'Untitled Article',
                  content: plainText,
                  description: editFormData.description || '',
                  trackType: 'article',
                  trackId: track.id,
                  companyId: track.company_id,
                }),
              }
            );
            
            if (response.ok) {
              const data = await response.json();
              if (data.skipped) {
                console.log('✅ Key facts already exist for this track (skipped duplicate generation)');
              } else {
                console.log(`✅ Auto-generated ${data.enriched?.length || 0} key facts`);
                toast.success(`✨ Auto-generated ${data.enriched?.length || 0} key facts from your content`);
              }
              const enriched = data.enriched || [];
              const normalized = enriched.map((f: any) => ({
                ...f,
                title: f.title,
                fact: f.content ?? f.fact ?? f.title ?? '',
                content: f.content ?? f.fact ?? f.title ?? '',
                type: f.type,
                steps: f.steps || [],
                contexts: [f.context?.specificity || 'universal'],
                _dbId: f.id,
                _extractedBy: f.extracted_by,
              }));
              setEditFormData(prev => ({ ...prev, learning_objectives: normalized }));
              setOriginalFacts(normalized);
            } else {
              console.error('Failed to auto-generate key facts:', await response.json());
            }
          }
        }
      } catch (factsError) {
        console.error('Error auto-generating key facts:', factsError);
        // Don't show error to user - this is a background operation
      }
    } catch (error: any) {
      console.error('❌ Error saving track:', error);
      toast.error(error.message || 'Failed to save article');
    } finally {
      console.log('💾 handleSave finally block, resetting isSaving');
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditMode(false);
    setIsFormDataLoaded(false); // Reset the flag
    setEditFormData({
      title: track.title || '',
      description: track.description || '',
      duration_minutes: track.duration_minutes || '',
      learning_objectives: originalFacts || [],
      tags: track.tags || [],
      content_url: track.content_url || '',
      thumbnail_url: track.thumbnail_url || '',
      type: track.type || 'article',
      article_body: track.article_body || track.transcript || '',
      show_in_knowledge_base: (track.tags || []).includes('system:show_in_knowledge_base') || track.show_in_knowledge_base || false,
    });
  };

  const handleAddLearningObjective = () => {
    setEditFormData({
      ...editFormData,
      learning_objectives: [...(editFormData.learning_objectives || []), '']
    });
  };

  const handleUpdateLearningObjective = (index: number, value: string) => {
    const newObjectives = [...(editFormData.learning_objectives || [])];
    const current = newObjectives[index];
    if (typeof current === 'object' && current !== null && !Array.isArray(current)) {
      newObjectives[index] = { ...current, fact: value, content: value };
    } else {
      newObjectives[index] = value;
    }
    setEditFormData({
      ...editFormData,
      learning_objectives: newObjectives
    });
  };

  const handleRemoveLearningObjective = async (index: number) => {
    const factToRemove = (editFormData.learning_objectives || [])[index];
    
    // If fact has a database ID, delete from database
    if (factToRemove?._dbId) {
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
    const newObjectives = (editFormData.learning_objectives || []).filter((_: any, i: number) => i !== index);
    setEditFormData({
      ...editFormData,
      learning_objectives: newObjectives
    });
  };

  // AI: Generate Key Facts from article content
  const handleGenerateKeyFacts = async () => {
    // Validation
    if (!editFormData.article_body || editFormData.article_body.trim().length < 100) {
      toast.error('Please add some article content first (at least 100 characters)');
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
        
        // Strip HTML from article body to get clean text
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = editFormData.article_body;
        const plainText = tempDiv.textContent || tempDiv.innerText || '';
        
        console.log('🤖 Calling AI to generate key facts...');
        
        const response = await fetch(
          `${getServerUrl()}/generate-key-facts`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              title: editFormData.title || 'Untitled Article',
              content: plainText,
              description: editFormData.description || '',
              trackType: 'article',
              trackId: track?.id,
              companyId: track?.company_id,
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
          toast.error('No key facts could be generated from this content');
          return;
        }
        
        // Add database IDs and normalize for display (API returns content/title; UI expects fact)
        const newFactsWithIds = newFacts.map((fact: any, index: number) => ({
          ...fact,
          _dbId: data.factIds?.[index],
          fact: fact.content ?? fact.fact ?? fact.title ?? '',
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
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = editFormData.article_body;
        const plainText = tempDiv.textContent || tempDiv.innerText || '';
        
        const response = await fetch(
          `${getServerUrl()}/generate-key-facts`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              title: editFormData.title || 'Untitled Article',
              content: plainText,
              description: editFormData.description || '',
              trackType: 'article',
              trackId: track?.id,
              companyId: track?.company_id,
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
          toast.error('No key facts could be generated from this content');
          return;
        }
        
        // Add database IDs and normalize for display (API returns content/title; UI expects fact)
        const newFactsWithIds = newFacts.map((fact: any, index: number) => ({
          ...fact,
          _dbId: data.factIds?.[index],
          fact: fact.content ?? fact.fact ?? fact.title ?? '',
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
    const newTags = (editFormData.tags || []).filter((_: any, i: number) => i !== index);
    setEditFormData({
      ...editFormData,
      tags: newTags
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const result = await crud.uploadTrackFile(track.id, file);
      setEditFormData({
        ...editFormData,
        content_url: result.url
      });
      toast.success('File uploaded successfully!');
    } catch (error: any) {
      console.error('Error uploading file:', error);
      toast.error(error.message || 'Failed to upload file');
    } finally {
      setIsUploading(false);
    }
  };

  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size on client side (10MB limit)
    if (file.size > 10485760) {
      toast.error('File too large. Maximum size is 10MB.');
      e.target.value = '';
      return;
    }

    setIsUploading(true);
    try {
      console.log('Uploading attachment for track:', track.id, 'file:', file.name);
      const attachment = await attachmentCrud.uploadAttachment(track.id, file);
      console.log('Attachment uploaded successfully:', attachment);
      
      // Add a placeholder URL if not returned (will be generated on retrieval)
      const attachmentWithUrl = {
        ...attachment,
        url: attachment.url || '#'
      };
      
      setAttachments([...attachments, attachmentWithUrl]);
      toast.success('Attachment uploaded successfully!');
      
      // Reset the input
      e.target.value = '';
    } catch (error: any) {
      console.error('Error uploading attachment:', error);
      console.error('Error details:', error.message, error.stack);
      toast.error(error.message || 'Failed to upload attachment');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!confirm('Are you sure you want to delete this attachment?')) {
      return;
    }

    try {
      await attachmentCrud.deleteAttachment(attachmentId);
      setAttachments(attachments.filter(a => a.id !== attachmentId));
      toast.success('Attachment deleted successfully!');
    } catch (error: any) {
      console.error('Error deleting attachment:', error);
      toast.error(error.message || 'Failed to delete attachment');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (fileType: string) => {
    if (!fileType) return <Paperclip className="h-5 w-5 text-gray-600" />;
    if (fileType.includes('pdf')) return <FileText className="h-5 w-5 text-red-600" />;
    if (fileType.includes('image')) return <ImageIcon className="h-5 w-5 text-blue-600" />;
    if (fileType.includes('word') || fileType.includes('document')) return <FileText className="h-5 w-5 text-blue-700" />;
    return <Paperclip className="h-5 w-5 text-gray-600" />;
  };

  const handleImageUpload = async (file: File): Promise<string> => {
    try {
      const result = await crud.uploadTrackFile(track.id, file);
      toast.success('Image uploaded successfully!');
      return result.url;
    } catch (error: any) {
      console.error('Error uploading image:', error);
      toast.error(error.message || 'Failed to upload image');
      throw error;
    }
  };

  // Store the callback for when image is uploaded
  const pendingImageCallback = React.useRef<((url: string) => void) | null>(null);

  const handleImageUploadClick = (callback: (url: string) => void) => {
    console.log('handleImageUploadClick called with callback:', callback);
    pendingImageCallback.current = callback;
    const input = document.getElementById('image-upload') as HTMLInputElement;
    if (input) {
      input.click();
    } else {
      console.error('Image upload input not found');
    }
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

  const insertFormatting = (before: string, after: string = '') => {
    const textarea = document.querySelector('textarea[name="article-body"]') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = editFormData.article_body.substring(start, end);
    const newText = 
      editFormData.article_body.substring(0, start) +
      before + selectedText + after +
      editFormData.article_body.substring(end);

    setEditFormData({
      ...editFormData,
      article_body: newText
    });

    // Restore cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selectedText.length);
    }, 0);
  };

  // Simple markdown-to-HTML renderer for preview - also handles content that might be markdown
  const renderMarkdown = (content: string) => {
    if (!content) return '<p class="text-muted-foreground">No content</p>';

    // Check if content already has HTML tags
    const hasHtmlTags = /<\/?[a-z][\s\S]*>/i.test(content);
    if (hasHtmlTags) {
      // Already HTML, return as-is
      return content;
    }

    // Convert Markdown to HTML
    let html = content
      // Code blocks (```) - with inline styles for word wrapping
      .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre style="white-space: pre-wrap; word-wrap: break-word; word-break: break-word; overflow-wrap: break-word; max-width: 100%; overflow-x: hidden;"><code class="language-$1" style="white-space: pre-wrap; word-wrap: break-word; word-break: break-word;">$2</code></pre>')
      // Inline code (`) - with inline styles for word wrapping
      .replace(/`([^`]+)`/g, '<code style="white-space: pre-wrap; word-wrap: break-word; word-break: break-word;">$1</code>')
      // Headers
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      // Bold
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.*?)__/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/_(.*?)_/g, '<em>$1</em>')
      // Blockquotes
      .replace(/^>\s+(.*)$/gm, '<blockquote>$1</blockquote>')
      // Unordered Lists
      .replace(/^[-*]\s+(.*)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
      // Ordered Lists
      .replace(/^\d+\.\s+(.*)$/gm, '<li>$1</li>')
      // Images
      .replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1" />')
      // Links
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>')
      // Line breaks
      .replace(/\n\n+/g, '</p><p>')
      .replace(/\n/g, '<br/>');

    // Wrap in paragraph if not already wrapped
    if (!html.startsWith('<')) {
      html = '<p>' + html + '</p>';
    }

    return html;
  };

  // Handle back button with unsaved changes check
  const handleBackClick = () => {
    console.log('🔍 ArticleDetailEdit - handleBackClick called', {
      hasChanges: hasUnsavedChanges(),
      editFormData,
      originalTrack: track
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

      const updateData = {
        id: track.id,
        title: editFormData.title || track.title,
        description: editFormData.description || track.description,
        duration_minutes: parseInt(editFormData.duration_minutes) || track.duration_minutes || 0,
        content_url: editFormData.content_url || track.content_url || '',
        thumbnail_url: editFormData.thumbnail_url || track.thumbnail_url || '',
        type: editFormData.type,
        tags: Array.from(currentTags),
        transcript: editFormData.article_body || '',
        // learning_objectives removed - facts are now stored in the facts table
      };

      // Check for meaningful content changes
      const contentChanged = 
        updateData.title !== track.title ||
        updateData.description !== track.description ||
        updateData.duration_minutes !== (track.duration_minutes || 0) ||
        updateData.content_url !== (track.content_url || '') ||
        updateData.thumbnail_url !== (track.thumbnail_url || '') ||
        updateData.type !== track.type ||
        updateData.transcript !== (track.transcript || '');

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

      await crud.updateTrack(updateData);
      toast.success('Article updated successfully!');

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
      console.error('Error saving track:', error);
      toast.error(error.message || 'Failed to save article');
      setShowUnsavedDialog(false);
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBackClick}
            className="hover:bg-accent"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Library
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Article</span>
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
                  Edit Article
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
                      <Button
                        variant="ghost"
                        className="justify-start h-9"
                        onClick={async () => {
                          setIsActionsMenuOpen(false);
                          await downloadKbTrackAsPdf(track, { toast });
                        }}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download PDF
                      </Button>
                      {(onDuplicate || onCreateVariant || onArchive) && (
                        <Separator className="my-1" />
                      )}
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

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Article Content */}
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
                    onClick={onBack}
                    className="border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-300"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Back
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Title & Tags */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {isEditMode ? (
                    <Input
                      value={editFormData.title}
                      onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                      className="text-2xl font-bold mb-2"
                      placeholder="Article Title"
                    />
                  ) : (
                    <CardTitle className="text-2xl mb-2">{track.title}</CardTitle>
                  )}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {isSystemContent && (
                      <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                        <Lock className="h-3 w-3 mr-1" />
                        Trike Library
                      </Badge>
                    )}
                    {/* System Knowledge Base Badge - Always shown when KB toggle is on */}
                    {(isEditMode ? editFormData.show_in_knowledge_base : ((track.tags || []).includes('system:show_in_knowledge_base') || track.show_in_knowledge_base)) && (
                      <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
                        <BookOpen className="h-3 w-3 mr-1" />
                        In Knowledge Base
                      </Badge>
                    )}
                    {/* Tags */}
                    {isEditMode ? (
                      <>
                        {(editFormData.tags || []).filter((t: string) => t !== 'system:show_in_knowledge_base').map((tag: string, index: number) => (
                          <Badge
                            key={index}
                            variant="secondary"
                            className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                            onClick={() => handleRemoveTag(editFormData.tags.indexOf(tag))}
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
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setTagSelectorConfig({
                              systemCategory: 'content',
                              restrictToParentName: 'Training Topics'
                            });
                            setIsTagSelectorOpen(true);
                          }}
                          className="h-6"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add Tag
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Article Body - WYSIWYG Editor */}
          {isEditMode ? (
            // Only render editor after form data is initialized
            isFormDataLoaded ? (
              <RichTextEditor
                key={`${track.id}-edit`} // Include mode in key to force remount when entering edit mode
                content={editFormData.article_body}
                onChange={(content) =>
                  setEditFormData({ ...editFormData, article_body: content })
                }
              />
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">Loading editor...</p>
                </CardContent>
              </Card>
            )
          ) : (
            <>
              {/* Text-to-Speech Player (View Mode Only) */}
              {track.transcript && (
                <div className="mb-6">
                  <TTSPlayer
                    key={`${track.id}-${ttsRefreshKey}`}
                    trackId={track.id}
                    initialAudioUrl={(track as any).tts_audio_url || undefined}
                    initialVoice={(track as any).tts_voice || 'alloy'}
                    showVoiceSelector={true}
                  />
                </div>
              )}
              
              <Card>
                <CardContent className="p-8">
                  <div
                    className="article-content prose prose-slate dark:prose-invert max-w-none prose-headings:font-bold prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-h4:text-lg prose-p:text-base prose-p:leading-7 prose-ul:list-disc prose-ul:pl-6 prose-ul:my-3 prose-ol:list-decimal prose-ol:pl-6 prose-ol:my-3 prose-li:text-base prose-li:my-0.5 prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono prose-code:whitespace-pre-wrap prose-code:break-words prose-pre:bg-muted prose-pre:p-4 prose-pre:rounded-lg prose-pre:whitespace-pre-wrap prose-pre:break-words prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:pl-4 prose-blockquote:italic prose-strong:font-bold prose-a:text-primary prose-img:rounded-lg [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-3 [&_li]:my-0.5 [&_li>p]:my-0.5"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(track.transcript || '') }}
                  />
                </CardContent>
              </Card>
            </>
          )}

          {/* Learning Objectives */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  Key Facts
                </CardTitle>
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
                          <div className="absolute inset-0 rounded-lg bg-[#F74A05] opacity-30 animate-ping" />
                          <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-[#F74A05] to-[#FF6B35] opacity-20 animate-pulse" />
                        </>
                      )}
                    </button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAddLearningObjective}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </div>
                )}
              </div>
              {isEditMode && isGeneratingKeyFacts && (
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-2">
                  <span className="inline-block h-1 w-1 rounded-full bg-[#F74A05] animate-pulse" />
                  AI is analyzing your article and extracting key facts...
                </p>
              )}
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
                    
                    // Check if this is an enriched KeyFact object (API returns content/title; loaded facts have fact)
                    const isEnriched = typeof parsed === 'object' && parsed !== null && ('fact' in parsed || 'content' in parsed || 'title' in parsed);
                    const displayValue = isEnriched
                      ? (parsed.fact ?? parsed.content ?? parsed.title ?? '')
                      : (typeof parsed === 'string' ? parsed : '');
                    const isProcedure = isEnriched && parsed.type === 'Procedure';
                    
                    return (
                      <div key={index} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Input
                            value={displayValue}
                            onChange={(e) => handleUpdateLearningObjective(index, e.target.value)}
                            placeholder="Key fact..."
                            className="flex-1"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveLearningObjective(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        {isProcedure && parsed.steps && (
                          <div className="ml-6 pl-4 border-l-2 border-orange-200 space-y-1 text-xs text-muted-foreground">
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
                  {(viewModeFacts || []).map((objective: any, index: number) => {
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
                    const isEnriched = typeof parsed === 'object' && parsed !== null && ('type' in parsed || 'content' in parsed);
                    const isProcedure = isEnriched && parsed.type === 'Procedure' && parsed.steps;
                    const displayText = isEnriched
                      ? (parsed.fact ?? parsed.content ?? parsed.title ?? '')
                      : (typeof parsed === 'string' ? parsed : '');
                    
                    return (
                      <li key={index} className="flex items-start gap-3 text-sm">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-orange-600 text-xs text-white flex-shrink-0">
                          {index + 1}
                        </span>
                        <div className="pt-0.5 flex-1">
                          <span>{displayText}</span>
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
                  })}
                  {(!viewModeFacts || viewModeFacts.length === 0) && (
                    <p className="text-sm text-muted-foreground">No key facts defined</p>
                  )}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Metadata */}
        <div className="space-y-6">
          {/* Publishing Status */}
          {(!isSystemContent || isSuperAdminAuthenticated) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Publishing Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
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
                        toast.error('Failed to update status');
                      }
                    }}
                  >
                    {track.status === 'published' ? 'Published' : 'Draft'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Click the status badge to {track.status === 'published' ? 'move to drafts' : 'publish'}
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

          {/* Content scope */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <LinkIcon className="h-4 w-4" />
                Content scope
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Who can see and use this content (Universal, Sector, Industry, State, Company, Program, or Unit).
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              {track.scope ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{track.scope.scope_level}</Badge>
                  {track.scope.sector && <Badge variant="outline">{track.scope.sector}</Badge>}
                  {track.scope.state_name && <Badge variant="outline">{track.scope.state_name}</Badge>}
                  {track.scope.industry_name && <Badge variant="outline">{track.scope.industry_name}</Badge>}
                  {track.scope.company_name && <Badge variant="outline">{track.scope.company_name}</Badge>}
                  {track.scope.program_name && <Badge variant="outline">{track.scope.program_name}</Badge>}
                  {track.scope.unit_name && <Badge variant="outline">{track.scope.unit_name}</Badge>}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No scope set (defaults to Universal).</p>
              )}
              <Button variant="outline" size="sm" onClick={() => setIsScopeModalOpen(true)}>
                {track.scope ? 'Edit scope' : 'Set scope'}
              </Button>
            </CardContent>
          </Card>

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

          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Reading Time - Auto-calculated */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center">
                  <Clock className="h-5 w-5 text-gray-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Reading Time</p>
                  <p className="font-semibold">
                    {isEditMode 
                      ? calculateReadingTime(editFormData.article_body)
                      : calculateReadingTime(track.transcript || '')
                    } min
                  </p>
                </div>
              </div>

              {/* Views */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center">
                  <Eye className="h-5 w-5 text-gray-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Views</p>
                  <p className="font-semibold">{track.view_count || 0}</p>
                </div>
              </div>

              {/* Likes */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center">
                  <ThumbsUp className="h-5 w-5 text-gray-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Likes</p>
                  <p className="font-semibold">{track.likes_count || 0}</p>
                </div>
              </div>

              {/* Completion Rate */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-[#F74A05]" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Completion Rate</p>
                  <p className="font-semibold">{track.completion_rate || 0}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Header Image */}
              {isEditMode && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" />
                    Header Image
                  </label>
                  {editFormData.thumbnail_url && getEffectiveThumbnailUrl(editFormData.thumbnail_url) !== DEFAULT_THUMBNAIL_URL ? (
                    <div className="space-y-2">
                      <div className="relative aspect-video rounded-lg overflow-hidden border">
                        <img
                          src={editFormData.thumbnail_url}
                          alt="Header"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => document.getElementById('header-image-upload')?.click()}
                          disabled={isUploading}
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          Change Image
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditFormData({ ...editFormData, thumbnail_url: '' })}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="relative aspect-video rounded-lg overflow-hidden border">
                        <img
                          src={DEFAULT_THUMBNAIL_URL}
                          alt="Default Header"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <input
                        type="file"
                        id="header-image-upload"
                        className="hidden"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          
                          setIsUploading(true);
                          try {
                            const result = await crud.uploadTrackFile(track.id, file);
                            setEditFormData({
                              ...editFormData,
                              thumbnail_url: result.url
                            });
                            toast.success('Header image uploaded successfully!');
                          } catch (error: any) {
                            console.error('Error uploading image:', error);
                            toast.error(error.message || 'Failed to upload image');
                          } finally {
                            setIsUploading(false);
                          }
                        }}
                      />
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => document.getElementById('header-image-upload')?.click()}
                        disabled={isUploading}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {isUploading ? 'Uploading...' : 'Upload Header Image'}
                      </Button>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    This image will appear as the thumbnail in the Content Library
                  </p>
                </div>
              )}
              
              {/* Preview mode - show header image */}
              {!isEditMode && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" />
                    Header Image
                  </label>
                  <div className="relative aspect-video rounded-lg overflow-hidden border">
                    <img
                      src={getEffectiveThumbnailUrl(track.thumbnail_url)}
                      alt="Header"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              )}
              
              <Separator />
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Created
                </span>
                <span className="font-medium">
                  {track.created_at ? new Date(track.created_at).toLocaleDateString() : 'N/A'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Last Updated
                </span>
                <span className="font-medium">
                  {track.updated_at ? new Date(track.updated_at).toLocaleDateString() : 'N/A'}
                </span>
              </div>

              {/* Source Document Link */}
              {sourceDocumentInfo && (
                <>
                  <Separator />
                  <button
                    onClick={() => {
                      window.location.href = `/organization?tab=sources&sourceFileId=${sourceDocumentInfo.sourceFileId}&chunkId=${sourceDocumentInfo.sourceChunkId}`;
                    }}
                    className="flex items-center gap-2 w-full text-left hover:bg-muted/50 rounded-md p-1 -mx-1 transition-colors"
                  >
                    <span className="text-sm text-muted-foreground flex items-center gap-2 shrink-0">
                      <FileText className="h-4 w-4" />
                      Source Document
                    </span>
                    <span className="text-sm font-medium truncate flex-1 text-right" title={sourceDocumentInfo.sourceFileName}>
                      {sourceDocumentInfo.sourceFileName}
                    </span>
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  </button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Attachments */}
          {isEditMode && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Paperclip className="h-5 w-5" />
                  Attachments
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="relative">
                  <input
                    type="file"
                    id="attachment-upload"
                    className="hidden"
                    onChange={handleAttachmentUpload}
                    multiple
                  />
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => document.getElementById('attachment-upload')?.click()}
                    disabled={isUploading}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {isUploading ? 'Uploading...' : 'Upload Attachment'}
                  </Button>
                </div>
                <div className="space-y-2 mt-4">
                  {attachments.map((attachment: any) => (
                    <div key={attachment.id} className="flex items-center gap-2 p-2 rounded-md border bg-card hover:bg-accent/50 transition-colors">
                      {getFileIcon(attachment.fileType)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{attachment.fileName}</p>
                        <p className="text-xs text-muted-foreground">{formatFileSize(attachment.fileSize)}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteAttachment(attachment.id)}
                        className="flex-shrink-0"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                  {attachments.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No attachments uploaded</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Attachments - View Mode */}
          {!isEditMode && attachments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Paperclip className="h-5 w-5" />
                  Attachments
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {attachments.map((attachment: any) => (
                    <div 
                      key={attachment.id} 
                      className="flex items-center gap-2 p-2 rounded-md border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                      onClick={() => {
                        // Ensure the attachment object matches the expected format
                        // Validate URL before setting preview
                        if (!attachment.url || attachment.url === '#' || attachment.url === '') {
                          console.error('Invalid attachment URL:', attachment);
                          toast.error('Attachment URL is missing. Please refresh the page and try again.');
                          return;
                        }
                        
                        console.log('Opening attachment preview:', {
                          fileName: attachment.fileName,
                          fileType: attachment.fileType,
                          url: attachment.url,
                          fileSize: attachment.fileSize
                        });
                        
                        setPreviewAttachment({
                          fileName: attachment.fileName,
                          fileType: attachment.fileType,
                          url: attachment.url,
                          fileSize: attachment.fileSize
                        });
                      }}
                    >
                      {getFileIcon(attachment.fileType)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{attachment.fileName}</p>
                        <p className="text-xs text-muted-foreground">{formatFileSize(attachment.fileSize)}</p>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          
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
              console.log('🔍 Version clicked, navigating to:', versionTrackId);
              if (onVersionClick) {
                onVersionClick(versionTrackId);
              } else {
                window.location.href = `/article/${versionTrackId}`;
              }
            }}
          />
        </div>
      </div>

      {/* Attachment Preview Dialog */}
      <AttachmentPreviewDialog
        isOpen={!!previewAttachment}
        onClose={() => setPreviewAttachment(null)}
        attachment={previewAttachment}
      />

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
            // In view mode, save directly to database
            try {
              await crud.updateTrack({
                id: track.id,
                tags: tags
              });
              toast.success('KB categories updated');
              onUpdate(); // Refresh track data
            } catch (error: any) {
              console.error('Error updating tags:', error);
              toast.error('Failed to update KB categories', {
                description: error.message || 'Please try again'
              });
            }
          }
          // Refresh KB tags to include any newly created tags
          loadKBTags();
        }}
        systemCategory={tagSelectorConfig.systemCategory}
        restrictToParentName={tagSelectorConfig.restrictToParentName}
        allowManagement={isSuperAdminAuthenticated}
        canManageSystemTags={isSuperAdminAuthenticated}
        // AI Recommendation props
        showAISuggest={tagSelectorConfig.systemCategory === 'content'}
        contentContext={{
          title: isEditMode ? editFormData.title : track.title,
          description: isEditMode ? editFormData.description : track.description,
          transcript: isEditMode 
            ? (editFormData.article_body || editFormData.transcript)
            : (track.transcript || ''),
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
          console.log('📍 ArticleDetailEdit: onVersionCreated callback triggered');
          console.log('✅ Version created! New track ID:', newTrackId);
          console.log('📝 Strategy:', strategy);
          
          toast.success(`Version ${(track.version_number || 1) + 1} created with ${strategy} strategy!`);
          
          console.log('🔄 Closing modal...');
          setIsVersionModalOpen(false);
          console.log('🔄 Exiting edit mode...');
          setIsEditMode(false);
          
          // Force TTS refresh since new version has new content
          console.log('🔊 Forcing TTS refresh for new version...');
          setTtsRefreshKey(prev => prev + 1);
          
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

      <TrackScopeModal
        isOpen={isScopeModalOpen}
        onClose={() => setIsScopeModalOpen(false)}
        trackId={track.id}
        trackTitle={track.title}
        organizationId={track.organization_id}
        allowAllOrgs={isSuperAdminAuthenticated}
        onSaved={onUpdate}
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