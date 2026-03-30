import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Separator } from '../ui/separator';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { TagSelectorDialog } from '../TagSelectorDialog';
import { VersionHistory } from './VersionHistory';
import { AssociatedPlaylists } from './AssociatedPlaylists';
import { TrackRelationships } from './TrackRelationships';
import { VersionDecisionModal } from './VersionDecisionModal';
import { UnsavedChangesDialog } from '../UnsavedChangesDialog';
import { StoryPreview } from './StoryPreview';
import { StoryTranscript } from './StoryTranscript';
import {
  ArrowLeft,
  Save,
  Upload,
  Shield,
  Image as ImageIcon,
  Video as VideoIcon,
  X,
  Smartphone,
  Edit,
  Calendar,
  Tag as TagIcon,
  Lock,
  BookOpen,
  Plus,
  GripVertical,
  Trash2,
  ChevronLeft,
  ChevronRight,
  PlayCircle,
  Loader2,
  History,
  Zap,
  CheckCircle2,
  Eye,
  ThumbsUp,
  Clock,
  MoreVertical,
  Copy,
  Archive,
  GitBranch,
  Download
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover';
import { toast } from 'sonner@2.0.3';
import { downloadKbTrackAsPdf } from '../../lib/utils/kbPdfExport';
import * as crud from '../../lib/crud';
import * as factsCrud from '../../lib/crud/facts';
import * as trackRelCrud from '../../lib/crud/trackRelationships';
import * as tagsCrud from '../../lib/crud/tags';
import { compressVideo, shouldCompressVideo } from '../../utils/video-compressor';
import { projectId, publicAnonKey, getServerUrl } from '../../utils/supabase/info';

interface Slide {
  id: string;
  name: string;
  type: 'image' | 'video';
  url: string;
  order: number;
  duration?: number; // Duration in seconds (for videos) or default for images
  transcript?: {
    text: string;
    words?: any[];
    utterances?: any[];
    confidence?: number;
    audio_duration?: number;
  };
}

interface StoryEditorProps {
  onClose?: () => void;
  trackId?: string;
  track?: any;
  isNewContent?: boolean;
  currentRole?: string;
  onBack?: () => void;
  onUpdate?: () => void;
  onVersionClick?: (versionTrackId: string) => void; // Optional version navigation callback
  isSuperAdminAuthenticated?: boolean;
  onNavigateToPlaylist?: (playlistId: string) => void;
  registerUnsavedChangesCheck?: (checkFn: (() => boolean) | null) => void; // Register unsaved changes check
  onArchive?: (track: any) => void; // Archive callback
  onDuplicate?: (track: any) => void; // Duplicate callback
  onCreateVariant?: (track: any) => void; // Create variant callback
}

export function StoryEditor({
  onClose,
  trackId,
  track,
  isNewContent = false,
  currentRole,
  onBack,
  onUpdate,
  onVersionClick,
  isSuperAdminAuthenticated,
  onNavigateToPlaylist,
  registerUnsavedChangesCheck,
  onArchive,
  onDuplicate,
  onCreateVariant
}: StoryEditorProps) {
  const { t } = useTranslation();
  const [isEditMode, setIsEditMode] = useState(isNewContent);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [existingTrack, setExistingTrack] = useState<any>(null);
  const [isSystemContentLocal, setIsSystemContentLocal] = useState(false);
  
  // Compression state
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const [compressionStage, setCompressionStage] = useState('');
  const [compressingFileName, setCompressingFileName] = useState('');
  const [compressingFileSizeMB, setCompressingFileSizeMB] = useState(0);
  
  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [slides, setSlides] = useState<Slide[]>([]);
  const [objectives, setObjectives] = useState<any[]>(['']);
  const [originalObjectivesFromDB, setOriginalObjectivesFromDB] = useState<any[]>([]);
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [isTagSelectorOpen, setIsTagSelectorOpen] = useState(false);
  const [tagSelectorConfig, setTagSelectorConfig] = useState<{
    systemCategory: any;
    restrictToParentName?: string;
  }>({ systemCategory: 'content' });
  const [showInKnowledgeBase, setShowInKnowledgeBase] = useState(false);

  // Ref to track pending KB modal open (persists across re-renders from onUpdate)
  const pendingKBModalOpen = useRef(false);
  const [kbTagNames, setKbTagNames] = useState<Set<string>>(new Set());
  
  // Preview state
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [draggedSlideId, setDraggedSlideId] = useState<string | null>(null);
  const [showBottomAddButton, setShowBottomAddButton] = useState(false);
  
  // Versioning state
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<any>(null);
  
  // Unsaved changes dialog
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);

  // Actions menu popover state
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);

  // Track initial state for unsaved changes detection
  const [initialState, setInitialState] = useState<any>(null);
  
  // AI Key Facts generation
  const [isGeneratingKeyFacts, setIsGeneratingKeyFacts] = useState(false);

  const currentTrackId = trackId || track?.id;
  const isSuperAdmin = isSuperAdminAuthenticated || currentRole === 'Trike Super Admin';
  const isSystemContent = existingTrack?.is_system_content && !isSuperAdmin;
  
  // Calculate story duration - only sum video slide durations (ignore images)
  const calculateStoryDuration = () => {
    if (slides.length === 0) return 0; // No slides yet
    
    // Filter to only video slides
    const videoSlides = slides.filter((slide: any) => slide.type === 'video' && slide.url);
    
    if (videoSlides.length === 0) return 0;
    
    // Sum up video durations (in seconds)
    const totalSeconds = videoSlides.reduce((total: number, slide: any) => {
      if (slide.duration && !isNaN(slide.duration) && slide.duration > 0) {
        return total + slide.duration;
      }
      // If video has URL but no duration, skip it (should have duration from upload)
      return total;
    }, 0);
    
    if (totalSeconds === 0) return 0;
    
    // Convert to minutes, minimum 1 minute for valid content
    const minutes = Math.max(1, Math.round(totalSeconds / 60));
    console.log('Story duration calculation (videos only):', {
      totalSlides: slides.length,
      videoSlides: videoSlides.length,
      totalSeconds,
      minutes,
      videoSlidesDetails: videoSlides.map(s => ({ type: s.type, duration: s.duration, hasUrl: !!s.url }))
    });
    return minutes;
  };
  
  const storyDuration = calculateStoryDuration();

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

  // Load existing story
  useEffect(() => {
    if (track) {
      setExistingTrack(track);
      loadStoryData(track);
    } else if (trackId) {
      loadStory();
    }
  }, [trackId, track]);

  // Auto-refresh transcripts for story videos that don't have them yet
  useEffect(() => {
    // Only poll if:
    // 1. It's a story track
    // 2. Has slides with videos
    // 3. Not in edit mode (to avoid conflicts)
    // 4. Has video slides without transcripts
    const videoSlides = slides.filter(s => s.type === 'video' && s.url);
    const slidesWithoutTranscripts = videoSlides.filter(s => !s.transcript?.text);
    const shouldPoll = 
      track?.type === 'story' && 
      videoSlides.length > 0 &&
      slidesWithoutTranscripts.length > 0 &&
      !isEditMode &&
      trackId;

    if (!shouldPoll) return;

    console.log(`[StoryEditor] Starting transcript polling for ${slidesWithoutTranscripts.length} video slides...`);
    
    // Poll every 5 seconds for up to 3 minutes (36 attempts - stories take longer)
    let attempts = 0;
    const maxAttempts = 36;
    const pollInterval = 5000; // 5 seconds

    const pollForTranscripts = async () => {
      attempts++;
      
      try {
        // Fetch fresh track data
        const freshTrack = await crud.getTrackById(trackId!);
        
        if (!freshTrack || !freshTrack.transcript) {
          // Continue polling if track doesn't exist yet or no transcript field
          if (attempts < maxAttempts) {
            setTimeout(pollForTranscripts, pollInterval);
          }
          return;
        }

        // Parse story data
        let storyData: any;
        try {
          storyData = typeof freshTrack.transcript === 'string' 
            ? JSON.parse(freshTrack.transcript) 
            : freshTrack.transcript;
        } catch (e) {
          // Not valid JSON yet, continue polling
          if (attempts < maxAttempts) {
            setTimeout(pollForTranscripts, pollInterval);
          }
          return;
        }

        // Check if any video slides now have transcripts
        const updatedVideoSlides = (storyData.slides || []).filter((s: any) => 
          s.type === 'video' && s.url && s.transcript?.text
        );

        if (updatedVideoSlides.length > 0) {
          console.log(`[StoryEditor] ✓ Found ${updatedVideoSlides.length} video transcripts! Refreshing UI...`);
          // Reload story data to show transcripts
          loadStoryData(freshTrack);
          // Also trigger parent update if available
          if (onUpdate) {
            await onUpdate();
          }
          return; // Stop polling
        }

        // Continue polling if we haven't hit max attempts
        if (attempts < maxAttempts) {
          setTimeout(pollForTranscripts, pollInterval);
        } else {
          console.log('[StoryEditor] Polling timeout after 3 minutes - transcripts may still be processing');
        }
      } catch (error: any) {
        console.error('[StoryEditor] Error in transcript polling:', error);
        // Continue polling on error (might be transient network issue)
        if (attempts < maxAttempts) {
          setTimeout(pollForTranscripts, pollInterval);
        }
      }
    };

    // Start polling after a short delay (give server time to start processing)
    const timeoutId = setTimeout(pollForTranscripts, 3000);

    // Cleanup on unmount or when conditions change
    return () => {
      clearTimeout(timeoutId);
    };
  }, [trackId, track?.type, slides, isEditMode, onUpdate]);

  // Load facts for view mode
  useEffect(() => {
    if (!isEditMode && (track?.id || trackId)) {
      const loadViewModeFacts = async () => {
        try {
          const id = track?.id || trackId;
          const dbFacts = await factsCrud.getFactsForTrack(id);
          
          // Preserve full fact metadata for view mode grouping
          const factsFromDB = dbFacts.map((f: any) => {
            // If fact has usage metadata with media source, preserve it
            if (f.usage && f.usage.length > 0) {
              const usage = f.usage[0]; // First usage record
              
              // Try to find the slide by media URL or ID
              let slideName = null;
              let slideIndex = usage.display_order || 0;
              
              if (usage.source_media_id) {
                // Parse story data from transcript
                let storySlides: any[] = [];
                if (existingTrack?.transcript) {
                  try {
                    const storyData = JSON.parse(existingTrack.transcript);
                    storySlides = storyData.slides || [];
                  } catch (e) {
                    console.warn('Could not parse story transcript');
                  }
                }
                
                const slide = storySlides.find((s: any) => s.id === usage.source_media_id);
                if (slide) {
                  slideName = slide.name || `Slide ${slideIndex + 1}`;
                }
              }
              
              // If we have media source info, return enriched fact
              if (slideName || usage.source_media_id) {
                return {
                  fact: f.content || f.title,
                  title: f.title,
                  type: f.type,
                  slideId: usage.source_media_id,
                  slideName: slideName || 'Unknown Slide',
                  slideIndex: slideIndex
                };
              }
            }
            // Fallback to simple text
            return f.content || f.fact || f.title;
          });
          setObjectives(factsFromDB.length > 0 ? factsFromDB : ['']);
          console.log(`📊 View mode: Loaded ${factsFromDB.length} facts from DB`, factsFromDB);
        } catch (error) {
          console.warn('Could not fetch facts for story view mode:', error);
        }
      };
      loadViewModeFacts();
    }
  }, [isEditMode, track?.id, trackId]);

  // Load facts from DB when entering edit mode
  useEffect(() => {
    if (isEditMode && currentTrackId) {
      const loadEditModeFacts = async () => {
        try {
          const dbFacts = await factsCrud.getFactsForTrack(currentTrackId);
          
          if (dbFacts.length > 0) {
            // Map DB facts to objectives format with IDs and metadata
            const factsWithIds = dbFacts.map((f: any) => {
              const factObj: any = {
                _dbId: f.id,
                fact: f.content || f.title,
                title: f.title,
                type: f.type,
              };
              
              // Preserve slide association if it exists
              if (f.usage && f.usage.length > 0) {
                const usage = f.usage[0];
                if (usage.source_media_id) {
                  factObj.slideId = usage.source_media_id;
                  factObj.slideIndex = usage.display_order || 0;
                  
                  // Try to find slide name
                  if (slides.length > 0) {
                    const slide = slides.find((s: any) => s.id === usage.source_media_id);
                    if (slide) {
                      factObj.slideName = slide.name || `Slide ${factObj.slideIndex + 1}`;
                    }
                  }
                }
              }
              
              return factObj;
            });
            
            setObjectives(factsWithIds);
            console.log(`📊 Edit mode: Loaded ${factsWithIds.length} facts from DB with IDs`);
          } else {
            // No DB facts, keep existing objectives (might be from transcript JSON)
            console.log(`📊 Edit mode: No DB facts found, keeping existing objectives`);
          }
        } catch (error) {
          console.warn('Could not fetch facts for edit mode:', error);
        }
      };
      
      loadEditModeFacts();
    }
  }, [isEditMode, currentTrackId]);

  const loadStory = async () => {
    if (!trackId) return;
    
    setIsLoading(true);
    try {
      const loadedTrack = await crud.getTrackById(trackId);
      setExistingTrack(loadedTrack);
      loadStoryData(loadedTrack);
    } catch (error: any) {
      console.error('Error loading story:', error);
      toast.error(t('contentAuthoring.failedLoadStory'));
    } finally {
      setIsLoading(false);
    }
  };

  const loadStoryData = async (trackData: any) => {
    setTitle(trackData.title || '');
    setDescription(trackData.description || '');

    // Load tags from junction table (source of truth)
    let tagNames: string[] = trackData.tags || [];
    if (trackData.id) {
      try {
        tagNames = await tagsCrud.getTrackTagNames(trackData.id);
        console.log(`🏷️ Loaded ${tagNames.length} tags from track_tags junction table`);
      } catch (tagError) {
        console.warn('Could not fetch tags from junction table, falling back to track.tags:', tagError);
        tagNames = trackData.tags || [];
      }
    }
    setTags(tagNames);
    setThumbnailUrl(trackData.thumbnail_url || '');
    setIsSystemContentLocal(trackData.is_system_content || false);
    setNotes(trackData.content_text || '');
    setShowInKnowledgeBase(tagNames.includes('system:show_in_knowledge_base') || trackData.show_in_knowledge_base || false);
    
    // Parse story data from transcript field
    let parsedSlides: any[] = [];
    let parsedObjectives: string[] = [];
    console.log('📖 [loadStoryData] Loading story, transcript field exists:', !!trackData.transcript);
    if (trackData.transcript) {
      console.log('📖 [loadStoryData] Transcript preview:', trackData.transcript.substring(0, 200) + '...');
      try {
        const storyData = JSON.parse(trackData.transcript);
        console.log('📖 [loadStoryData] Parsed storyData, slides count:', storyData.slides?.length || 0);
        if (storyData.slides && Array.isArray(storyData.slides)) {
          storyData.slides.forEach((slide: any, i: number) => {
            console.log(`  📸 Loaded Slide ${i + 1}: type=${slide.type}, hasUrl=${!!slide.url}, name=${slide.name}`);
            if (slide.url) console.log(`     URL: ${slide.url.substring(0, 80)}...`);
          });
          setSlides(storyData.slides);
          parsedSlides = storyData.slides;
        }
        if (storyData.objectives) {
          setObjectives(storyData.objectives);
          parsedObjectives = storyData.objectives;
        }
      } catch (e) {
        console.error('Error parsing story data:', e);
      }
    } else {
      console.warn('⚠️ [loadStoryData] No transcript field found in track data!');
    }
    
    // Load objectives from facts table for comparison
    if (trackData.id) {
      try {
        const dbFacts = await factsCrud.getFactsForTrack(trackData.id);
        const factsFromDB = dbFacts.map((f: any) => f.content || f.fact || f.title);
        setOriginalObjectivesFromDB(factsFromDB);
        console.log(`📊 Loaded ${factsFromDB.length} facts from DB for story comparison`);
      } catch (error) {
        console.warn('Could not fetch facts for story:', error);
        setOriginalObjectivesFromDB([]);
      }
    }
    
    // Save initial state for unsaved changes detection
    setInitialState({
      title: trackData.title || '',
      description: trackData.description || '',
      tags: tagNames,
      thumbnailUrl: trackData.thumbnail_url || '',
      notes: trackData.content_text || '',
      slides: parsedSlides,
      objectives: parsedObjectives,
    });
  };

  // Check if there are unsaved changes
  const hasUnsavedChanges = useCallback(() => {
    if (!initialState || !isEditMode) return false;
    
    const arraysEqual = (a: any[], b: any[]) => {
      if (a.length !== b.length) return false;
      return JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
    };
    
    return (
      title !== initialState.title ||
      description !== initialState.description ||
      !arraysEqual(tags, initialState.tags) ||
      thumbnailUrl !== initialState.thumbnailUrl ||
      isSystemContentLocal !== initialState.isSystemContent ||
      notes !== initialState.notes ||
      JSON.stringify(slides) !== JSON.stringify(initialState.slides) ||
      JSON.stringify(objectives) !== JSON.stringify(initialState.objectives)
    );
  }, [initialState, isEditMode, title, description, tags, thumbnailUrl, notes, slides, objectives]);

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
  }, [isEditMode, initialState, title, description, tags, thumbnailUrl, notes, slides, objectives]);

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

  const handleMediaUpload = async (file: File, type: 'image' | 'video', slideId?: string) => {
    if (!file) return;

    // File size validation (100MB limit before compression)
    const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
    if (file.size > MAX_FILE_SIZE) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      toast.error(
        `File too large (${sizeMB}MB). Maximum size is 100MB.`,
        { duration: 5000 }
      );
      return null;
    }
    
    let fileToUpload: File | Blob = file;
    let originalSizeMB = file.size / (1024 * 1024);
    let wasCompressed = false;
    
    // Extract video duration BEFORE compression (from original file)
    let videoDuration: number | undefined = undefined;
    if (type === 'video') {
      try {
        console.log('Starting video duration extraction from original file...');
        const videoElement = document.createElement('video');
        const objectUrl = URL.createObjectURL(file); // Use original file
        videoElement.preload = 'metadata';
        
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Timeout loading video metadata'));
          }, 10000); // 10 second timeout
          
          videoElement.onloadedmetadata = () => {
            clearTimeout(timeout);
            videoDuration = Math.round(videoElement.duration); // Duration in seconds
            console.log('Video duration extracted successfully:', videoDuration, 'seconds (', Math.round(videoDuration / 60), 'minutes)');
            URL.revokeObjectURL(objectUrl);
            resolve();
          };
          videoElement.onerror = (e) => {
            clearTimeout(timeout);
            console.error('Video element error:', e);
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Failed to load video metadata'));
          };
          videoElement.src = objectUrl;
        });
      } catch (error) {
        console.error('Error extracting video duration:', error);
        // Continue without duration
      }
    }
    
    // Compress video if needed (client-side)
    if (type === 'video' && shouldCompressVideo(file, 15)) {
      setIsCompressing(true);
      setCompressingFileName(file.name);
      setCompressingFileSizeMB(originalSizeMB);
      setCompressionProgress(0);
      setCompressionStage('Starting compression...');
      
      try {
        const result = await compressVideo(
          file,
          {
            maxSizeMB: 15,
            maxWidth: 1080,
            maxHeight: 1920,
          },
          (progress, stage) => {
            setCompressionProgress(progress);
            setCompressionStage(stage);
          }
        );
        
        fileToUpload = result.blob;
        wasCompressed = true;
        
        toast.success(
          `Video compressed: ${result.originalSizeMB.toFixed(1)}MB → ${result.compressedSizeMB.toFixed(1)}MB`,
          { duration: 4000 }
        );
      } catch (error: any) {
        console.error('Compression error:', error);
        toast.error(`Compression failed: ${error.message}. Using original file.`);
        // Continue with original file
      } finally {
        setIsCompressing(false);
      }
    }
    
    setIsUploading(true);
    try {
      const { projectId, publicAnonKey } = await import('../../utils/supabase/info');
      const uploadUrl = `${getServerUrl()}/upload-media`;
      
      const formData = new FormData();
      formData.append('file', fileToUpload, file.name);
      
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }
      
      const data = await response.json();
      
      if (slideId) {
        // Update existing slide with URL, type, and duration
        console.log('Updating slide with duration:', { slideId, type, videoDuration });
        setSlides(slides.map(slide => 
          slide.id === slideId ? { ...slide, url: data.url, type, duration: videoDuration } : slide
        ));
      }
      
      toast.success(t(type === 'video' ? 'contentAuthoring.videoUploadedSuccessfully' : 'contentAuthoring.imageUploadedSuccessfully'));
      
      return data.url;
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(`Upload failed: ${error.message}`);
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const addSlide = () => {
    const newSlide: Slide = {
      id: `slide-${Date.now()}`,
      name: `Slide ${slides.length + 1}`,
      type: 'image',
      url: '',
      order: slides.length
    };
    setSlides([...slides, newSlide]);
    setCurrentSlideIndex(slides.length);
  };

  const removeSlide = (slideId: string) => {
    if (slides.length === 1) {
      toast.error(t('contentAuthoring.storyNeedsSlide'));
      return;
    }
    const newSlides = slides.filter(s => s.id !== slideId)
      .map((s, idx) => ({ ...s, order: idx }));
    setSlides(newSlides);
    if (currentSlideIndex >= newSlides.length) {
      setCurrentSlideIndex(Math.max(0, newSlides.length - 1));
    }
  };

  const updateSlideName = (slideId: string, name: string) => {
    setSlides(slides.map(slide => 
      slide.id === slideId ? { ...slide, name } : slide
    ));
  };

  const handleDragStart = (slideId: string) => {
    setDraggedSlideId(slideId);
  };

  const handleDragOver = (e: React.DragEvent, targetSlideId: string) => {
    e.preventDefault();
    if (!draggedSlideId || draggedSlideId === targetSlideId) return;

    const draggedIdx = slides.findIndex(s => s.id === draggedSlideId);
    const targetIdx = slides.findIndex(s => s.id === targetSlideId);
    
    if (draggedIdx === -1 || targetIdx === -1) return;

    const newSlides = [...slides];
    const [draggedSlide] = newSlides.splice(draggedIdx, 1);
    newSlides.splice(targetIdx, 0, draggedSlide);
    
    // Update order
    newSlides.forEach((slide, idx) => {
      slide.order = idx;
    });
    
    setSlides(newSlides);
  };

  const handleDragEnd = () => {
    setDraggedSlideId(null);
  };

  // Handler for opening content tags modal (not KB category picker)
  const handleAddTag = () => {
    setTagSelectorConfig({
      systemCategory: 'content',
      restrictToParentName: undefined
    });
    setIsTagSelectorOpen(true);
  };

  const handleKBToggle = async (checked: boolean) => {
    if (isEditMode) {
      // In edit mode, open modal immediately and update local state
      if (checked) {
        setTagSelectorConfig({
          systemCategory: 'knowledge-base',
          restrictToParentName: 'KB Category'
        });
        setIsTagSelectorOpen(true);
      }
      setShowInKnowledgeBase(checked);
    } else {
      // In view mode, update the track directly in the database
      // Set the ref BEFORE the async operation so the modal opens after onUpdate refreshes the component
      if (checked) {
        pendingKBModalOpen.current = true;
      }

      try {
        const currentTrackId = track?.id || trackId;
        if (!currentTrackId) return;

        // Update tags array to include/remove the system tag
        const currentTags = new Set<string>(track?.tags || []);
        if (checked) {
          currentTags.add('system:show_in_knowledge_base');
        } else {
          currentTags.delete('system:show_in_knowledge_base');
        }

        await crud.updateTrack({
          id: currentTrackId,
          show_in_knowledge_base: checked,
          tags: Array.from(currentTags)
        });

        toast.success(checked ? t('contentAuthoring.trackAddedToKb') : t('contentAuthoring.trackRemovedFromKb'));

        // Update local state to reflect the change
        setShowInKnowledgeBase(checked);
        setTags(Array.from(currentTags));

        // Refresh the track data - the useEffect watching 'track' will open the modal
        if (onUpdate) {
          onUpdate();
        }
      } catch (error: any) {
        console.error('Error updating KB toggle:', error);
        pendingKBModalOpen.current = false; // Reset on error
        toast.error(t('contentAuthoring.failedUpdateKbSetting'), {
          description: error.message || 'Please try again'
        });
      }
    }
  };

  const areArraysEqual = (a: any[] | undefined | null, b: any[] | undefined | null) => {
    const arr1 = a || [];
    const arr2 = b || [];
    if (arr1.length !== arr2.length) return false;
    const sorted1 = [...arr1].sort();
    const sorted2 = [...arr2].sort();
    return sorted1.every((val, idx) => val === sorted2[idx]);
  };

  // Handle back button with unsaved changes check
  const handleBackWithCheck = () => {
    const backFn = onBack || onClose;
    if (!backFn) return;
    
    console.log('🔍 handleBackWithCheck called', {
      isEditMode,
      hasChanges: hasUnsavedChanges(),
      initialState,
      currentState: { title, description, tags, thumbnailUrl, notes, slides, objectives }
    });
    
    if (hasUnsavedChanges()) {
      setPendingNavigation(() => backFn);
      setShowUnsavedDialog(true);
    } else {
      backFn();
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
    if (isSystemContent) {
      toast.error(t('contentAuthoring.cannotEditTrikeLibrary'));
      setShowUnsavedDialog(false);
      return;
    }

    if (!validateStory()) {
      setShowUnsavedDialog(false);
      return;
    }

    setIsSaving(true);
    try {
      const storyData = {
        slides,
        objectives: objectives.filter((o: any) => {
          if (typeof o === 'string') return o.trim() !== '';
          if (typeof o === 'object' && o?.fact) return o.fact.trim() !== '';
          return false;
        })
      };

      // Prepare tags including the system KB tag
      const currentTags = new Set<string>(tags || []);
      if (showInKnowledgeBase) {
        currentTags.add('system:show_in_knowledge_base');
      } else {
        currentTags.delete('system:show_in_knowledge_base');
      }

      const trackData = {
        title,
        description,
        type: 'story' as const,
        transcript: JSON.stringify(storyData),
        content_text: notes,
        duration_minutes: calculateStoryDuration(),
        tags: Array.from(currentTags),
        // Use thumbnailUrl as-is (even if empty) - don't auto-fallback to slide URL
        // This respects when user explicitly removes the thumbnail
        thumbnail_url: thumbnailUrl,
        is_system_content: isSystemContentLocal
      };

      if (currentTrackId) {
        await crud.updateTrack({ id: currentTrackId, ...trackData });
        toast.success(t('contentAuthoring.changesSaved'));
      } else {
        await crud.createTrack({ ...trackData, status: 'draft' as const });
        toast.success(t('contentAuthoring.storyCreatedAsDraft'));
      }

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
      console.error('Error saving story:', error);
      toast.error(t('contentAuthoring.failedSaveStory'));
      setShowUnsavedDialog(false);
      setIsSaving(false);
    }
  };

  // Handle transcripts generated from StoryTranscript component
  const handleTranscriptsGenerated = async (transcripts: any[]) => {
    console.log('📝 Transcripts generated, updating slides:', transcripts);
    console.log('📝 Current slides before update:', slides.length, 'slides');
    
    // Update slides with transcript data
    const updatedSlides = slides.map(slide => {
      // Find matching transcript by slide ID
      const matchingTranscript = transcripts.find(t => t.slideId === slide.id);
      
      if (matchingTranscript && matchingTranscript.transcript) {
        console.log(`📝 Adding transcript to slide ${slide.id}`);
        return {
          ...slide,
          transcript: matchingTranscript.transcript
        };
      }
      
      return slide;
    });
    
    console.log('📝 Updated slides:', updatedSlides.length, 'slides');
    console.log('📝 Slides with transcripts:', updatedSlides.filter(s => s.transcript).length);
    
    // Update state
    setSlides(updatedSlides);
    
    // IMMEDIATELY persist to database (don't wait for manual save)
    try {
      console.log('💾 Immediately saving transcripts to database...');
      console.log('💾 Track ID:', currentTrackId);
      console.log('💾 Saving transcript with', updatedSlides.length, 'slides');
      
      // Story data needs to match the format used in handleSave
      const storyData = {
        slides: updatedSlides,
        objectives: objectives.filter((o: any) => {
          if (typeof o === 'string') return o.trim() !== '';
          if (typeof o === 'object' && o?.fact) return o.fact.trim() !== '';
          return false;
        })
      };
      
      const storyDataString = JSON.stringify(storyData);
      console.log('💾 transcript length:', storyDataString.length, 'characters');
      
      // For stories, save to transcript field (stories store their data in transcript)
      await crud.updateTrack({
        id: currentTrackId,
        transcript: storyDataString
      });
      
      toast.success('Transcripts generated and saved successfully!');
      console.log('✅ Transcripts persisted to database');
    } catch (error: any) {
      console.error('❌ Failed to save transcripts:', error);
      console.error('❌ Error details:', error.message, error.stack);
      toast.error('Transcripts generated but failed to save. Please save the story manually.');
    }
  };

  const handleSave = async () => {
    if (isSystemContent) {
      toast.error(t('contentAuthoring.cannotEditTrikeLibrary'));
      return;
    }

    if (!validateStory()) return;

    setIsSaving(true);
    try {
      const storyData = {
        slides,
        objectives: objectives.filter((o: any) => {
          if (typeof o === 'string') return o.trim() !== '';
          if (typeof o === 'object' && o?.fact) return o.fact.trim() !== '';
          return false;
        })
      };

      // Debug: Log what we're saving
      console.log('📝 [handleSave] Saving story with', slides.length, 'slides');
      slides.forEach((slide, i) => {
        console.log(`  📸 Slide ${i + 1}: type=${slide.type}, hasUrl=${!!slide.url}, name=${slide.name}`);
        if (slide.url) console.log(`     URL: ${slide.url.substring(0, 80)}...`);
      });

      // Prepare tags including the system KB tag
      const currentTags = new Set<string>(tags || []);
      if (showInKnowledgeBase) {
        currentTags.add('system:show_in_knowledge_base');
      } else {
        currentTags.delete('system:show_in_knowledge_base');
      }

      const trackData = {
        title,
        description,
        type: 'story' as const,
        transcript: JSON.stringify(storyData),
        content_text: notes,
        duration_minutes: calculateStoryDuration(), // Use actual calculated duration
        tags: Array.from(currentTags),
        // Use thumbnailUrl as-is (even if empty) - don't auto-fallback to slide URL
        // This respects when user explicitly removes the thumbnail
        thumbnail_url: thumbnailUrl,
        is_system_content: isSystemContentLocal
      };

      if (currentTrackId) {
        // Check for meaningful content changes that require versioning
        const contentChanged = 
          trackData.title !== existingTrack.title ||
          trackData.description !== existingTrack.description ||
          trackData.transcript !== existingTrack.transcript ||
          trackData.content_text !== (existingTrack.content_text || '') ||
          trackData.duration_minutes !== (existingTrack.duration_minutes || 0) ||
          trackData.thumbnail_url !== (existingTrack.thumbnail_url || '') ||
          !areArraysEqual(storyData.objectives || [], originalObjectivesFromDB || []);

        const tagsChanged = !areArraysEqual(trackData.tags, existingTrack.tags);
        
        const wasInKb = (existingTrack.tags || []).includes('system:show_in_knowledge_base') || existingTrack.show_in_knowledge_base;
        const kbChanged = showInKnowledgeBase !== wasInKb;

        console.log('Changes detected:', { contentChanged, tagsChanged, kbChanged });

        // Check for related tracks if content changed
        if (contentChanged) {
          try {
            const stats = await trackRelCrud.getTrackRelationshipStats(currentTrackId) as any;
            
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
              let warningMessage = `⚠️ This ${existingTrack.type} has relationships with ${stats.derivedCount} other track(s):\n\n`;
              
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
        if (existingTrack?.status === 'published' && contentChanged) {
          const stats = await crud.getTrackAssignmentStats(currentTrackId);
          
          if (stats.playlistCount > 0) {
            // Show version decision modal instead of saving directly
            console.log('Track is in playlists and content changed, showing version decision modal. Stats:', stats);
            setPendingChanges({ id: currentTrackId, ...trackData });
            setIsVersionModalOpen(true);
            setIsSaving(false);
            return;
          }
        }
        
        // If no assignments or not published OR only metadata changed, update normally
        console.log('💾 [handleSave] About to call crud.updateTrack with:', {
          id: currentTrackId,
          title: trackData.title,
          transcriptLength: trackData.transcript?.length,
          transcriptPreview: trackData.transcript?.substring(0, 200),
          hasSlides: trackData.transcript?.includes('slides'),
        });
        await crud.updateTrack({ id: currentTrackId, ...trackData });
        console.log('✅ [handleSave] crud.updateTrack completed successfully');
        toast.success(contentChanged ? 'Changes saved!' : 'Settings updated!');
        
        setIsEditMode(false);
        
        if (onUpdate) {
          await onUpdate();
        } else {
          await loadStory();
        }

        // Auto-generate key facts if this is the first save and no facts exist (for stories)
        try {
          const { getFactsForTrack } = await import('../../lib/crud/facts');
          const { projectId, publicAnonKey } = await import('../../utils/supabase/info');
          const existingFacts = await getFactsForTrack(currentTrackId);
          
          // Extract text from story slides (notes and slide content)
          let storyText = notes || '';
          slides.forEach((slide: any) => {
            if (slide.notes) storyText += ' ' + slide.notes;
            if (slide.text) storyText += ' ' + slide.text;
          });
          storyText = storyText.trim();
          
          const hasContent = storyText && storyText.length > 150;
          
          // Check if no facts exist and there's content
          if (existingFacts.length === 0 && hasContent) {
            console.log('🤖 Auto-generating key facts for story first save...');
            
            const response = await fetch(
              `${getServerUrl()}/generate-key-facts`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${publicAnonKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  title: title || 'Untitled Story',
                  content: storyText,
                  description: description || '',
                  trackType: 'story',
                  trackId: currentTrackId,
                  companyId: existingTrack?.company_id,
                }),
              }
            );
            
            if (response.ok) {
              const data = await response.json();
              console.log(`✅ Auto-generated ${data.enriched?.length || 0} key facts`);
              toast.success(`✨ Auto-generated ${data.enriched?.length || 0} key facts from your story`);
            } else {
              console.error('Failed to auto-generate key facts:', await response.json());
            }
          }
        } catch (factsError) {
          console.error('Error auto-generating key facts:', factsError);
          // Don't show error to user - this is a background operation
        }
      } else {
        const newTrack = await crud.createTrack({ ...trackData, status: 'draft' as const });
        toast.success(t('contentAuthoring.storyCreatedAsDraft'));
        const backFn = onBack || onClose;
        if (backFn) backFn();
      }
    } catch (error: any) {
      console.error('Error saving story:', error);
      toast.error(t('contentAuthoring.failedSaveStory'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (currentTrackId) {
      setIsEditMode(false);
      if (track) {
        loadStoryData(track);
      } else {
        loadStory();
      }
    } else {
      const backFn = onBack || onClose;
      if (backFn) backFn();
    }
  };

  const validateStory = () => {
    if (!title.trim()) {
      toast.error(t('contentAuthoring.titleRequiredError'));
      return false;
    }
    if (slides.length === 0) {
      toast.error(t('contentAuthoring.storyNeedsSlide'));
      return false;
    }
    const emptySlides = slides.filter(s => !s.url);
    if (emptySlides.length > 0) {
      toast.error(t('contentAuthoring.allSlidesNeedContent'));
      return false;
    }
    return true;
  };

  const addObjective = () => {
    setObjectives([...objectives, '']);
  };

  const updateObjective = (index: number, value: string) => {
    const updated = [...objectives];
    updated[index] = value;
    setObjectives(updated);
  };

  const removeObjective = async (index: number) => {
    if (objectives.length === 1) {
      toast.error(t('contentAuthoring.storyNeedsObjective'));
      return;
    }
    
    const factToRemove = objectives[index];
    
    // If fact has a database ID and track exists, delete from database
    if (factToRemove && typeof factToRemove === 'object' && factToRemove._dbId && currentTrackId) {
      try {
        console.log(`🗑️ Deleting fact ${factToRemove._dbId} from database...`);
        await factsCrud.deleteFactFromTrack(factToRemove._dbId, currentTrackId);
        toast.success(t('contentAuthoring.keyFactRemoved'));
      } catch (error: any) {
        console.error('Failed to delete fact:', error);
        toast.error(t('contentAuthoring.failedRemoveFact'));
        return; // Don't remove from UI if database delete failed
      }
    }
    
    // Remove from UI state (always remove, even if no DB ID - might be unsaved fact)
    setObjectives(objectives.filter((_, i) => i !== index));
  };

  const nextSlide = () => {
    setCurrentSlideIndex((prev) => (prev + 1) % slides.length);
  };

  const prevSlide = () => {
    setCurrentSlideIndex((prev) => (prev - 1 + slides.length) % slides.length);
  };

  // AI: Generate Key Facts from story video transcripts - ONE PER SLIDE
  const handleGenerateKeyFacts = async () => {
    // First, check if there are any video slides
    const videoSlides = slides.filter(slide => slide.type === 'video' && slide.url);
    
    if (videoSlides.length === 0) {
      toast.error('Please add at least one video slide with audio to generate key facts');
      return;
    }

    // Confirmation dialog if facts already exist
    const existingFactsCount = objectives.filter((o: any) => {
      if (typeof o === 'string') return o.trim().length > 0;
      if (typeof o === 'object' && o?.fact) return o.fact.trim().length > 0;
      return false;
    }).length;
    
    const hasExistingFacts = existingFactsCount > 0;
    if (hasExistingFacts) {
      const action = confirm(
        `You currently have ${existingFactsCount} key fact(s).\n\nWhat would you like to do?\n\nOK = Replace all existing facts\nCancel = Add to existing facts`
      );
      
      const shouldReplace = action;
      
      setIsGeneratingKeyFacts(true);
      
      try {
        // If replacing, delete all existing facts from database first
        if (shouldReplace && currentTrackId) {
          console.log('🗑️ Deleting existing facts before replacing...');
          
          for (const existingFact of objectives) {
            if (existingFact && typeof existingFact === 'object' && existingFact._dbId) {
              try {
                await factsCrud.deleteFactFromTrack(existingFact._dbId, currentTrackId);
                console.log(`   ✓ Deleted fact: ${existingFact._dbId}`);
              } catch (error) {
                console.error('Error deleting fact:', error);
                // Continue with others
              }
            }
          }
          
          console.log('✅ Old facts deleted, generating new ones...');
        }
        
        console.log('🎬 Step 1: Transcribing all story videos...');
        
        // Step 1: Transcribe all videos in the story
        const transcribeResponse = await fetch(
          `${getServerUrl()}/transcribe-story`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              trackId: currentTrackId,
              slides,
            }),
          }
        );
        
        if (!transcribeResponse.ok) {
          const error = await transcribeResponse.json();
          throw new Error(error.error || 'Failed to transcribe story videos');
        }
        
        const transcribeData = await transcribeResponse.json();
        console.log('✅ Transcription complete:', transcribeData);
        
        if (transcribeData.successCount === 0) {
          throw new Error('No videos could be transcribed');
        }
        
        // Step 2: Combine all transcripts into one text
        const combinedTranscript = transcribeData.transcripts
          .filter((t: any) => !t.error && t.transcript)
          .map((t: any) => {
            const title = `[${t.slideName}]`;
            const text = t.transcript.text || '';
            return `${title}\n${text}`;
          })
          .join('\n\n');
        
        console.log('📝 Combined transcript length:', combinedTranscript.length);
        
        if (combinedTranscript.length < 100) {
          toast.error('Transcripts are too short to generate meaningful key facts');
          setIsGeneratingKeyFacts(false);
          return;
        }
        
        // Step 3: Generate key facts from combined transcript
        console.log('🤖 Step 2: Generating key facts from transcripts...');
        
        const factsResponse = await fetch(
          `${getServerUrl()}/generate-key-facts`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              title: title || 'Untitled Story',
              transcript: combinedTranscript,
              description: description || '',
              trackType: 'story',
              trackId: currentTrackId,
              companyId: existingTrack?.company_id,
            }),
          }
        );
        
        if (!factsResponse.ok) {
          const error = await factsResponse.json();
          throw new Error(error.error || 'Failed to generate key facts');
        }
        
        const factsData = await factsResponse.json();
        const newFacts = factsData.enriched || factsData.simple || [];
        
        if (newFacts.length === 0) {
          toast.error('No key facts could be generated from the story transcripts');
          return;
        }
        
        // Add database IDs to new facts (returned from API)
        const newFactsWithIds = newFacts.map((fact: any, index: number) => ({
          ...fact,
          _dbId: factsData.factIds?.[index], // Add the database UUID
          fact: fact.content || fact.fact || fact.title, // Normalize to 'fact' property
        }));
        
        const updatedFacts = shouldReplace 
          ? newFactsWithIds
          : [...objectives.filter((o: any) => {
              if (typeof o === 'string') return o.trim();
              if (typeof o === 'object' && o?.fact) return o.fact.trim();
              return false;
            }), ...newFactsWithIds];
        
        setObjectives(updatedFacts);
        
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
        console.log('🎬 Step 1: Transcribing all story videos...');
        
        // Step 1: Transcribe all videos
        const transcribeResponse = await fetch(
          `${getServerUrl()}/transcribe-story`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              trackId: currentTrackId,
              slides,
            }),
          }
        );
        
        if (!transcribeResponse.ok) {
          const error = await transcribeResponse.json();
          throw new Error(error.error || 'Failed to transcribe story videos');
        }
        
        const transcribeData = await transcribeResponse.json();
        
        if (transcribeData.successCount === 0) {
          throw new Error('No videos could be transcribed');
        }
        
        // Step 2: Combine transcripts
        const combinedTranscript = transcribeData.transcripts
          .filter((t: any) => !t.error && t.transcript)
          .map((t: any) => {
            const title = `[${t.slideName}]`;
            const text = t.transcript.text || '';
            return `${title}\n${text}`;
          })
          .join('\n\n');
        
        if (combinedTranscript.length < 100) {
          toast.error('Transcripts are too short to generate meaningful key facts');
          setIsGeneratingKeyFacts(false);
          return;
        }
        
        // Step 3: Generate key facts
        console.log('🤖 Step 2: Generating key facts from transcripts...');
        
        const factsResponse = await fetch(
          `${getServerUrl()}/generate-key-facts`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              title: title || 'Untitled Story',
              transcript: combinedTranscript,
              description: description || '',
              trackType: 'story',
              trackId: currentTrackId,
              companyId: existingTrack?.company_id,
            }),
          }
        );
        
        if (!factsResponse.ok) {
          const error = await factsResponse.json();
          throw new Error(error.error || 'Failed to generate key facts');
        }
        
        const factsData = await factsResponse.json();
        const newFacts = factsData.enriched || factsData.simple || [];
        
        if (newFacts.length === 0) {
          toast.error('No key facts could be generated from the story transcripts');
          return;
        }
        
        // Add database IDs to new facts (returned from API)
        const newFactsWithIds = newFacts.map((fact: any, index: number) => ({
          ...fact,
          _dbId: factsData.factIds?.[index], // Add the database UUID
          fact: fact.content || fact.fact || fact.title, // Normalize to 'fact' property
        }));
        
        setObjectives(newFactsWithIds);
        
        toast.success(`✨ Generated ${newFactsWithIds.length} key fact${newFactsWithIds.length > 1 ? 's' : ''}!`);
        
      } catch (error: any) {
        console.error('❌ Error generating key facts:', error);
        toast.error(error.message || 'Failed to generate key facts');
      } finally {
        setIsGeneratingKeyFacts(false);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">{t('contentAuthoring.loadingStory')}</p>
        </div>
      </div>
    );
  }

  // View Mode
  if (!isEditMode && existingTrack) {
    return (
      <>
      <div className="space-y-6">
        {/* Old Version Banner - Show when viewing a non-latest version */}
        {existingTrack.version_number && !existingTrack.is_latest_version && (
          <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                  <History className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-blue-900 dark:text-blue-100">
                    {t('contentAuthoring.viewingVersion', { version: existingTrack.version_number })}
                  </p>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    {t('contentAuthoring.olderVersionNote')}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onBack}
                  className="border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-300"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  {t('common.back')}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="sm" onClick={handleBackWithCheck}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('common.back')}
            </Button>
            <div>
              <div className="flex items-center space-x-2 mb-1">
                <h1 className="text-foreground">{title}</h1>
              </div>
              <div className="flex items-center space-x-2 flex-wrap">
                <Badge className="bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-900/30 dark:text-pink-400">
                  <Smartphone className="h-3 w-3 mr-1" />
                  {t('contentAuthoring.storyBadge')}
                </Badge>
                <Badge variant="outline" className="text-muted-foreground">
                  {storyDuration} {storyDuration === 1 ? t('contentAuthoring.minSingular') : t('contentAuthoring.minPlural')}
                </Badge>
                <Badge
                  variant="outline"
                  className={`${
                    existingTrack.status === 'published'
                      ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400'
                  }`}
                >
                  {existingTrack.status === 'published' ? t('common.published') : t('common.draft')}
                </Badge>
                {isSystemContent && (
                  <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400">
                    <Lock className="h-3 w-3 mr-1" />
                    {t('contentAuthoring.trikeLibraryBadge')}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          {(!isSystemContent || isSuperAdmin) && (
            <div className="flex items-center gap-2">
              <Button onClick={() => setIsEditMode(true)} className="hero-primary">
                <Edit className="h-4 w-4 mr-2" />
                {t('contentAuthoring.editTrack')}
                {isSystemContent && isSuperAdmin && (
                  <Badge className="ml-2 bg-orange-100 text-orange-800">
                    {t('contentAuthoring.superAdmin')}
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
                    title={t('contentAuthoring.moreActions')}
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
                        const t = existingTrack || track;
                        await downloadKbTrackAsPdf(t, { toast });
                      }}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      {t('contentAuthoring.downloadPdf')}
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
                          onDuplicate(existingTrack || track);
                        }}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        {t('contentAuthoring.duplicate')}
                      </Button>
                    )}
                    {onCreateVariant && (
                      <Button
                        variant="ghost"
                        className="justify-start h-9"
                        onClick={() => {
                          setIsActionsMenuOpen(false);
                          onCreateVariant(existingTrack || track);
                        }}
                      >
                        <GitBranch className="h-4 w-4 mr-2" />
                        {t('contentAuthoring.createVariant')}
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
                          onArchive(existingTrack || track);
                        }}
                      >
                        <Archive className="h-4 w-4 mr-2" />
                        {t('contentAuthoring.archive')}
                      </Button>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Story Preview */}
            <Card>
              <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl">{title}</CardTitle>
                    {description && (
                      <p className="text-muted-foreground mt-2">{description}</p>
                    )}
                  </div>
                  <Badge className="bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-900/30 dark:text-pink-400">
                    <Smartphone className="h-3 w-3 mr-1" />
                    {t('contentAuthoring.storyBadge')} • {t('contentAuthoring.slidesCount', { count: slides.length })}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="flex justify-center">
                  <div className="w-full max-w-sm">
                    <StoryPreview slides={slides} />
                  </div>
                </div>

                {notes && (
                  <div className="mt-6 p-4 bg-accent/30 rounded-lg">
                    <h3 className="font-medium mb-2">{t('contentAuthoring.additionalNotes')}</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Video Transcripts */}
            {currentTrackId && (
              <StoryTranscript
                storyData={slides}
                trackId={currentTrackId}
                projectId={projectId}
                publicAnonKey={publicAnonKey}
                onTranscriptsGenerated={handleTranscriptsGenerated}
              />
            )}

            {/* Key Facts */}
            {(() => {
              const validObjectives = objectives.filter((o: any) => {
                if (typeof o === 'string') return o.trim().length > 0;
                if (typeof o === 'object' && o?.fact) return o.fact.trim().length > 0;
                return false;
              });
              
              if (validObjectives.length === 0) return null;
              
              // Group facts by slide
              const factsBySlide: Record<string, { slideName: string; facts: any[] }> = {};
              const ungroupedFacts: any[] = [];
              
              validObjectives.forEach((objective: any) => {
                if (typeof objective === 'object' && objective?.slideId) {
                  const slideId = objective.slideId;
                  if (!factsBySlide[slideId]) {
                    factsBySlide[slideId] = {
                      slideName: objective.slideName || `Slide ${objective.slideIndex + 1}`,
                      facts: []
                    };
                  }
                  factsBySlide[slideId].facts.push(objective);
                } else {
                  ungroupedFacts.push(objective);
                }
              });
              
              return (
                <Card>
                  <CardHeader>
                    <CardTitle>{t('contentAuthoring.keyFacts')}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Grouped facts by slide */}
                    {Object.entries(factsBySlide).map(([slideId, { slideName, facts }]) => (
                      <div key={slideId} className="space-y-3">
                        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                          <VideoIcon className="h-4 w-4 text-[#F74A05]" />
                          {slideName}
                        </h4>
                        <ul className="space-y-2 pl-2">
                          {facts.map((fact, idx) => {
                            const displayText = typeof fact === 'object' ? fact.fact : fact;
                            return (
                              <li key={idx} className="flex items-start space-x-3">
                                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-[#F74A05] to-[#FF733C] flex items-center justify-center text-xs font-semibold text-white mt-0.5 shadow-sm">
                                  {idx + 1}
                                </div>
                                <span className="text-muted-foreground leading-relaxed pt-0.5 text-sm">{displayText}</span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                    
                    {/* Ungrouped facts */}
                    {ungroupedFacts.length > 0 && (
                      <div className="space-y-3">
                        {Object.keys(factsBySlide).length > 0 && (
                          <h4 className="text-sm font-semibold text-foreground border-b pb-2">{t('contentAuthoring.otherFacts')}</h4>
                        )}
                        <ul className="space-y-2 pl-2">
                          {ungroupedFacts.map((fact, idx) => {
                            const displayText = typeof fact === 'string' ? fact : fact.fact || '';
                            return (
                              <li key={idx} className="flex items-start space-x-3">
                                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-[#F74A05] to-[#FF733C] flex items-center justify-center text-xs font-semibold text-white mt-0.5 shadow-sm">
                                  {idx + 1}
                                </div>
                                <span className="text-muted-foreground leading-relaxed pt-0.5 text-sm">{displayText}</span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })()}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Super Admin Settings */}
            {isSuperAdmin && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="h-4 w-4 text-orange-500" />
                    {t('contentAuthoring.superAdminSettings')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="system-content-view" className="text-sm font-medium">{t('contentAuthoring.systemTemplate')}</Label>
                      <p className="text-xs text-muted-foreground">
                        {t('contentAuthoring.markAsTrikeLibrary')}
                      </p>
                    </div>
                    <Switch
                      id="system-content-view"
                      checked={isEditMode ? isSystemContentLocal : (existingTrack?.is_system_content || isSystemContentLocal)}
                      onCheckedChange={(checked) => {
                        if (isEditMode) {
                          setIsSystemContentLocal(checked);
                        } else if (currentTrackId) {
                          crud.updateTrack({ id: currentTrackId, is_system_content: checked })
                            .then(() => {
                              toast.success(checked ? t('contentAuthoring.markedAsSystemContent') : t('contentAuthoring.removedFromTrikeLibrary'));
                              if (onUpdate) onUpdate();
                            });
                        }
                      }}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Publishing Status */}
            {(!isSystemContent || isSuperAdmin) && currentTrackId && existingTrack && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t('contentAuthoring.publishingStatus')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{t('common.status')}</span>
                    <Badge 
                      variant="outline"
                      className={`cursor-pointer transition-colors ${
                        existingTrack.status === 'published'
                          ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200'
                          : 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 hover:bg-yellow-200'
                      }`}
                      onClick={async () => {
                        const newStatus = existingTrack.status === 'published' ? 'draft' : 'published';
                        try {
                          await crud.updateTrack({ id: currentTrackId, status: newStatus });
                          toast.success(newStatus === 'published' ? t('contentAuthoring.storyPublishedStatus') : t('contentAuthoring.storyMovedToDrafts'));
                          setExistingTrack({ ...existingTrack, status: newStatus });
                          if (onUpdate) {
                            await onUpdate();
                          }
                        } catch (error: any) {
                          console.error('Error updating status:', error);
                          toast.error(t('contentAuthoring.failedUpdateStatus'));
                        }
                      }}
                    >
                      {existingTrack.status === 'published' ? t('common.published') : t('common.draft')}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {existingTrack.status === 'published' ? t('contentAuthoring.clickBadgeToDraft') : t('contentAuthoring.clickBadgeToPublish')}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Knowledge Base - Only show for published tracks */}
            {existingTrack?.status === 'published' && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    {t('contentAuthoring.knowledgeBase')}
                  </CardTitle>
                </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="show-in-kb-view" className="text-sm">{t('contentAuthoring.showInKb')}</Label>
                    <p className="text-xs text-muted-foreground">
                      {t('contentAuthoring.availableInKb')}
                    </p>
                  </div>
                  <Switch
                    id="show-in-kb-view"
                    checked={showInKnowledgeBase}
                    onCheckedChange={handleKBToggle}
                  />
                </div>

                {showInKnowledgeBase && (
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
                      <TagIcon className="h-4 w-4 mr-2" />
                      {t('contentAuthoring.manageKbTags')}
                    </Button>

                    <div>
                      <p className="text-xs font-medium mb-2 text-muted-foreground">{t('contentAuthoring.selectedCategories')}</p>
                      <div className="flex flex-wrap gap-2">
                        {tags
                          .filter((t: string) => kbTagNames.has(t))
                          .map((tag: string) => (
                            <Badge key={tag} variant="secondary" className="bg-blue-50 text-blue-700 border-blue-100">
                              {tag}
                            </Badge>
                        ))}
                        {tags.filter((t: string) => kbTagNames.has(t)).length === 0 && (
                          <span className="text-xs text-muted-foreground italic">{t('contentAuthoring.noCategoriesSelected')}</span>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground mt-2">
                      {t('contentAuthoring.kbCategoryHint')}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
            )}

            {/* Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('contentAuthoring.details')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex items-start space-x-3">
                  <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-muted-foreground text-xs">{t('contentAuthoring.created')}</p>
                    <p className="font-medium">{new Date(existingTrack.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <Separator />
                <div className="flex items-start space-x-3">
                  <Smartphone className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-muted-foreground text-xs">{t('contentAuthoring.formatLabel')}</p>
                    <p className="font-medium">{t('contentAuthoring.portraitFormat')} • {t('contentAuthoring.slidesCount', { count: slides.length })}</p>
                  </div>
                </div>
                <Separator />
                <div className="flex items-start space-x-3">
                  <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-muted-foreground text-xs">{t('contentAuthoring.estDuration')}</p>
                    <p className="font-medium">
                      {t('contentAuthoring.minutesCount', { count: existingTrack.duration_minutes || storyDuration })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tags */}
            {tags.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center">
                    <TagIcon className="h-4 w-4 mr-2" />
                    {t('contentAuthoring.tags')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag, index) => (
                      <Badge key={index} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Associated Playlists */}
            {currentTrackId && (
              <AssociatedPlaylists 
                trackId={currentTrackId}
                onPlaylistClick={onNavigateToPlaylist}
              />
            )}
            
            {/* Track Relationships */}
            {currentTrackId && (
              <TrackRelationships
                trackId={currentTrackId}
                trackType="story"
                onNavigateToTrack={onVersionClick}
              />
            )}
            
            {/* Version History */}
            {currentTrackId && (
              <VersionHistory
                trackId={currentTrackId}
                currentVersion={existingTrack?.version_number || 1}
                onVersionClick={async (versionTrackId) => {
                  console.log('🔍 Version clicked, loading version:', versionTrackId);
                  if (onVersionClick) {
                    onVersionClick(versionTrackId);
                  } else {
                    // Fallback to URL navigation if prop not provided
                    window.location.href = `/story/${versionTrackId}`;
                  }
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Tag Selector Dialog for View Mode */}
      <TagSelectorDialog
        isOpen={isTagSelectorOpen}
        onClose={() => {
          setIsTagSelectorOpen(false);
          loadKBTags();
        }}
        selectedTags={tags}
        onTagsChange={async (newTags) => {
          // In view mode, save directly to database
          try {
            const currentTrackId = existingTrack?.id || trackId;
            if (!currentTrackId) return;

            await crud.updateTrack({
              id: currentTrackId,
              tags: newTags
            });
            setTags(newTags);
            toast.success(t('contentAuthoring.kbCategoriesUpdated'));
            if (onUpdate) {
              onUpdate();
            }
          } catch (error: any) {
            console.error('Error updating tags:', error);
            toast.error(t('contentAuthoring.failedUpdateKbCategories'), {
              description: error.message || 'Please try again'
            });
          }
          loadKBTags();
        }}
        systemCategory={tagSelectorConfig.systemCategory}
        restrictToParentName={tagSelectorConfig.restrictToParentName}
        showAISuggest={tagSelectorConfig.systemCategory === 'content'}
        contentContext={{
          title: existingTrack?.title || '',
          description: existingTrack?.description || '',
          transcript: existingTrack?.transcript || '',
          keyFacts: existingTrack?.learning_objectives || [],
        }}
      />
      </>
    );
  }

  // Edit Mode
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="sm" onClick={handleBackWithCheck}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('common.back')}
          </Button>
          <div>
            <div className="flex items-center space-x-2 mb-1">
              <h1 className="text-foreground">
                {currentTrackId ? title || t('contentAuthoring.editStory') : t('contentAuthoring.createNewStory')}
              </h1>
            </div>
            <div className="flex items-center space-x-2 flex-wrap">
              <Badge className="bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-900/30 dark:text-pink-400">
                <Smartphone className="h-3 w-3 mr-1" />
                {t('contentAuthoring.storyBadge')}
              </Badge>
              {storyDuration > 0 && (
                <Badge variant="outline" className="text-muted-foreground">
                  {storyDuration} {storyDuration === 1 ? t('contentAuthoring.minSingular') : t('contentAuthoring.minPlural')}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {currentTrackId && (
            <>
              <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
                <X className="h-4 w-4 mr-2" />
                {t('common.cancel')}
              </Button>
              <Button onClick={handleSave} disabled={isSaving} className="hero-primary">
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? t('common.saving') : t('common.saveChanges')}
              </Button>
            </>
          )}
          {!currentTrackId && (
            <Button variant="outline" onClick={handleSave} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? t('common.saving') : t('contentAuthoring.saveDraft')}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">
        <div className="space-y-6">
          {/* Story Details */}
          <Card>
            <CardHeader>
              <CardTitle>{t('contentAuthoring.storyDetailsTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">{t('contentAuthoring.storyTitleLabel')}</Label>
                <Input
                  id="title"
                  placeholder={t('contentAuthoring.storyTitlePlaceholder')}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="description">{t('contentAuthoring.description')}</Label>
                <Textarea
                  id="description"
                  placeholder={t('contentAuthoring.storyDescriptionPlaceholder')}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-2"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Story Slides */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  <Smartphone className="h-5 w-5 mr-2 text-primary" />
                  {t('contentAuthoring.storySlidesTitle')}
                </CardTitle>
                <Button onClick={addSlide} size="sm" className="hero-primary">
                  <Plus className="h-4 w-4 mr-2" />
                  {t('contentAuthoring.addSlide')}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {slides.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-border rounded-lg">
                  <Smartphone className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">{t('contentAuthoring.noSlidesYet')}</p>
                  <Button onClick={addSlide} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    {t('contentAuthoring.addFirstSlide')}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {slides.map((slide, index) => (
                    <div
                      key={slide.id}
                      draggable
                      onDragStart={() => handleDragStart(slide.id)}
                      onDragOver={(e) => handleDragOver(e, slide.id)}
                      onDragEnd={handleDragEnd}
                      className={`border rounded-lg p-4 transition-all ${
                        draggedSlideId === slide.id ? 'opacity-50' : ''
                      } ${currentSlideIndex === index ? 'ring-2 ring-primary' : ''} hover:border-primary cursor-move`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 mt-2">
                          <GripVertical className="h-5 w-5 text-muted-foreground" />
                        </div>
                        
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center space-x-3">
                            <Badge variant="outline" className="font-mono">
                              {index + 1}
                            </Badge>
                            <Input
                              placeholder={t('contentAuthoring.slideNamePlaceholder')}
                              value={slide.name}
                              onChange={(e) => updateSlideName(slide.id, e.target.value)}
                              className="flex-1"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeSlide(slide.id)}
                              disabled={slides.length === 1}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>

                          {slide.url ? (
                            <div className="relative w-full max-w-[200px]">
                              <div className="aspect-[9/16] rounded-lg overflow-hidden bg-black">
                                {slide.type === 'image' ? (
                                  <img src={slide.url} alt={slide.name} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="relative w-full h-full">
                                    <video src={slide.url} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                      <PlayCircle className="h-12 w-12 text-white" />
                                    </div>
                                  </div>
                                )}
                              </div>
                              <Button
                                variant="destructive"
                                size="sm"
                                className="absolute -top-2 -right-2"
                                onClick={() => {
                                  setSlides(slides.map(s => 
                                    s.id === slide.id ? { ...s, url: '' } : s
                                  ));
                                }}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <label className="flex-1">
                                <div className="border-2 border-dashed border-border rounded-lg p-4 hover:bg-accent/50 transition-colors cursor-pointer">
                                  <div className="flex items-center justify-center space-x-2">
                                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
<span className="text-sm text-muted-foreground">{t('contentAuthoring.uploadImage')}</span>
                                  </div>
                                </div>
                                <input
                                  type="file"
                                  className="hidden"
                                  accept="image/*"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      const url = await handleMediaUpload(file, 'image', slide.id);
                                    }
                                  }}
                                  disabled={isUploading}
                                />
                              </label>
                              
                              <label className="flex-1">
                                <div className="border-2 border-dashed border-border rounded-lg p-4 hover:bg-accent/50 transition-colors cursor-pointer">
                                  <div className="flex items-center justify-center space-x-2">
                                    <VideoIcon className="h-5 w-5 text-muted-foreground" />
<span className="text-sm text-muted-foreground">{t('contentAuthoring.uploadVideo')}</span>
                                  </div>
                                </div>
                                <input
                                  type="file"
                                  className="hidden"
                                  accept="video/*"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      const url = await handleMediaUpload(file, 'video', slide.id);
                                    }
                                  }}
                                  disabled={isUploading}
                                />
                              </label>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {/* Bottom Add Slide Button - Show when slides > 3 */}
                  {slides.length > 3 && (
                    <div className="pt-2">
                      <Button onClick={addSlide} size="sm" className="hero-primary w-full">
                        <Plus className="h-4 w-4 mr-2" />
                        {t('contentAuthoring.addSlide')}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle>{t('contentAuthoring.additionalNotes')}</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder={t('contentAuthoring.additionalNotesPlaceholder')}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
              />
            </CardContent>
          </Card>

          {/* Key Facts */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  {t('contentAuthoring.keyFacts')}
                </CardTitle>
                <div className="flex items-center gap-2">
                  {/* AI Generate Button with Neon Orange Glow */}
                  <button
                    onClick={handleGenerateKeyFacts}
                    disabled={isGeneratingKeyFacts || slides.filter(s => s.type === 'video').length === 0}
                    className="group relative p-2 rounded-lg transition-all duration-300 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    title={t('contentAuthoring.generateKeyFactsTitle')}
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
                    onClick={addObjective}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>
              </div>
              {isGeneratingKeyFacts && (
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-2">
                  <span className="inline-block h-1 w-1 rounded-full bg-[#F74A05] animate-pulse" />
                  {t('contentAuthoring.aiAnalyzingStory')}
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {(() => {
                // Group facts by slide
                const factsBySlide: Record<string, { slideName: string; facts: { index: number; value: any }[] }> = {};
                const ungroupedFacts: { index: number; value: any }[] = [];
                
                objectives.forEach((objective, index) => {
                  if (typeof objective === 'object' && objective?.slideId) {
                    const slideId = objective.slideId;
                    if (!factsBySlide[slideId]) {
                      factsBySlide[slideId] = {
                        slideName: objective.slideName || `Slide ${objective.slideIndex + 1}`,
                        facts: []
                      };
                    }
                    factsBySlide[slideId].facts.push({ index, value: objective });
                  } else {
                    ungroupedFacts.push({ index, value: objective });
                  }
                });
                
                return (
                  <>
                    {/* Grouped facts by slide */}
                    {Object.entries(factsBySlide).map(([slideId, { slideName, facts }]) => (
                      <div key={slideId} className="space-y-2">
                        <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                          <VideoIcon className="h-4 w-4" />
                          {slideName}
                        </h4>
                        <div className="space-y-2 pl-6">
                          {facts.map(({ index, value }) => {
                            const displayValue = typeof value === 'object' ? value.fact : value;
                            return (
                              <div key={index} className="flex items-start space-x-2">
                                <Input
                                  placeholder={t('contentAuthoring.keyFactPlaceholder')}
                                  value={displayValue || ''}
                                  onChange={(e) => {
                                    const updated = [...objectives];
                                    if (typeof value === 'object') {
                                      updated[index] = { ...value, fact: e.target.value };
                                    } else {
                                      updated[index] = e.target.value;
                                    }
                                    setObjectives(updated);
                                  }}
                                  className="flex-1"
                                />
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={async () => {
                                    await removeObjective(index);
                                  }}
                                  className="flex-shrink-0"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    
                    {/* Ungrouped facts (manually added or old format) */}
                    {ungroupedFacts.length > 0 && (
                      <div className="space-y-2">
                        {Object.keys(factsBySlide).length > 0 && (
                          <h4 className="text-sm font-semibold text-muted-foreground">Other Facts</h4>
                        )}
                        <div className={Object.keys(factsBySlide).length > 0 ? "space-y-2 pl-6" : "space-y-2"}>
                          {ungroupedFacts.map(({ index, value }) => {
                            // Handle both string and object formats
                            const displayValue = typeof value === 'object' ? (value.fact || '') : (value || '');
                            return (
                              <div key={index} className="flex items-start space-x-2">
                                <Input
                                  placeholder={t('contentAuthoring.keyFactPlaceholder')}
                                  value={displayValue}
                                  onChange={(e) => {
                                    const updated = [...objectives];
                                    // Preserve object structure if it exists
                                    if (typeof value === 'object') {
                                      updated[index] = { ...value, fact: e.target.value };
                                    } else {
                                      updated[index] = e.target.value;
                                    }
                                    setObjectives(updated);
                                  }}
                                  className="flex-1"
                                />
                                {objectives.length > 1 && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={async () => {
                                      await removeObjective(index);
                                    }}
                                    className="flex-shrink-0"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </CardContent>
          </Card>

          {/* Tags */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('contentAuthoring.tags')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {/* System Knowledge Base Badge - Always shown when KB toggle is on */}
                {(showInKnowledgeBase || (existingTrack?.tags || []).includes('system:show_in_knowledge_base') || existingTrack?.show_in_knowledge_base) && (
                  <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
                    <BookOpen className="h-3 w-3 mr-1" />
{t('contentAuthoring.inKnowledgeBase')}
                  </Badge>
                )}
                {tags.filter((t: string) => t !== 'system:show_in_knowledge_base').map((tag, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                  >
                    {tag}
                  </Badge>
                ))}
                {tags.filter((t: string) => t !== 'system:show_in_knowledge_base').length === 0 && !showInKnowledgeBase && (
<p className="text-sm text-muted-foreground">{t('contentAuthoring.noTagsAdded')}</p>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddTag}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
{t('contentAuthoring.addTags')}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Live Preview Sidebar */}
        <div className="xl:sticky xl:top-6 xl:h-[calc(100vh-3rem)] xl:overflow-y-auto space-y-6">
          {/* Super Admin Settings */}
          {isSuperAdmin && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4 text-orange-500" />
                  {t('contentAuthoring.superAdminSettings')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="system-content-edit" className="text-sm font-medium">{t('contentAuthoring.systemTemplate')}</Label>
                    <p className="text-xs text-muted-foreground">
                      {t('contentAuthoring.markAsTrikeLibrary')}
                    </p>
                  </div>
                  <Switch
                    id="system-content-edit"
                    checked={isSystemContentLocal}
                    onCheckedChange={(checked) => {
                      setIsSystemContentLocal(checked);
                      if (!isEditMode && currentTrackId) {
                        crud.updateTrack({ id: currentTrackId, is_system_content: checked })
                          .then(() => {
                            toast.success(checked ? t('contentAuthoring.markedAsSystemContent') : t('contentAuthoring.removedFromTrikeLibrary'));
                            if (onUpdate) onUpdate();
                          });
                      }
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Publishing Status - Always show for new content */}
          {(!isSystemContent || isSuperAdmin) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('contentAuthoring.publishingStatus')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {currentTrackId && existingTrack ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{t('common.status')}</span>
                      <Badge 
                        variant="outline"
                        className={`cursor-pointer transition-colors ${
                          existingTrack.status === 'published'
                            ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200'
                            : 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 hover:bg-yellow-200'
                        }`}
                        onClick={async () => {
                          const newStatus = existingTrack.status === 'published' ? 'draft' : 'published';
                          try {
                            await crud.updateTrack({ id: currentTrackId, status: newStatus });
                            toast.success(newStatus === 'published' ? t('contentAuthoring.storyPublishedStatus') : t('contentAuthoring.storyMovedToDrafts'));
                            setExistingTrack({ ...existingTrack, status: newStatus });
                            if (onUpdate) {
                              await onUpdate();
                            }
                          } catch (error: any) {
                            console.error('Error updating status:', error);
                            toast.error(t('contentAuthoring.failedUpdateStatus'));
                          }
                        }}
                      >
                        {existingTrack.status === 'published' ? t('common.published') : t('common.draft')}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {existingTrack.status === 'published' ? t('contentAuthoring.clickBadgeToDraft') : t('contentAuthoring.clickBadgeToPublish')}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{t('common.status')}</span>
                      <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400">
                        {t('common.draft')}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t('contentAuthoring.storyWillBeSavedAsDraft')}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Knowledge Base */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                {t('contentAuthoring.knowledgeBase')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="show-in-kb-edit" className="text-sm">{t('contentAuthoring.showInKb')}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t('contentAuthoring.availableInKb')}
                  </p>
                </div>
                <Switch
                  id="show-in-kb-edit"
                  checked={showInKnowledgeBase}
                  onCheckedChange={handleKBToggle}
                />
              </div>

              {showInKnowledgeBase && (
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
                    <TagIcon className="h-4 w-4 mr-2" />
                    {t('contentAuthoring.manageKbTags')}
                  </Button>

                  {/* Selected KB Tags Display */}
                  <div>
                    <p className="text-xs font-medium mb-2 text-muted-foreground">{t('contentAuthoring.selectedCategories')}</p>
                    <div className="flex flex-wrap gap-2">
                      {tags
                        .filter((t: string) => kbTagNames.has(t))
                        .map((tag: string) => (
                          <Badge key={tag} variant="secondary" className="bg-blue-50 text-blue-700 border-blue-100">
                            {tag}
                          </Badge>
                      ))}
                      {tags.filter((t: string) => kbTagNames.has(t)).length === 0 && (
                        <span className="text-xs text-muted-foreground italic">{t('contentAuthoring.noCategoriesSelected')}</span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground mt-2">
                    {t('contentAuthoring.kbCategoryHint')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Story Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('contentAuthoring.storyDetails')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-start space-x-3">
                <Smartphone className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-muted-foreground text-xs">{t('contentAuthoring.formatLabel')}</p>
                  <p className="font-medium">{t('contentAuthoring.portraitFormat')}</p>
                </div>
              </div>
              <Separator />
              <div className="flex items-start space-x-3">
                <ImageIcon className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-muted-foreground text-xs">{t('contentAuthoring.totalSlides')}</p>
                  <p className="font-medium">{t('contentAuthoring.slidesCount', { count: slides.length })}</p>
                </div>
              </div>
              <Separator />
              <div className="flex items-start space-x-3">
                <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-muted-foreground text-xs">{t('contentAuthoring.estDuration')}</p>
                  <p className="font-medium">{t('contentAuthoring.minutesCount', { count: storyDuration })}</p>
                </div>
              </div>
              {currentTrackId && existingTrack && (
                <>
                  <Separator />
                  <div className="flex items-start space-x-3">
                    <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-muted-foreground text-xs">{t('contentAuthoring.created')}</p>
                      <p className="font-medium">{new Date(existingTrack.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Performance Metrics */}
          {currentTrackId && existingTrack && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('contentAuthoring.performanceMetrics')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <Eye className="h-4 w-4" />
{t('contentAuthoring.views')}
                  </span>
                  <span className="font-semibold">{existingTrack.view_count || 0}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <ThumbsUp className="h-4 w-4" />
{t('contentAuthoring.likes')}
                  </span>
                  <span className="font-semibold">{existingTrack.likes_count || 0}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tags */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('contentAuthoring.tags')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {/* System Knowledge Base Badge - Always shown when KB toggle is on */}
                {((existingTrack?.tags || []).includes('system:show_in_knowledge_base') || existingTrack?.show_in_knowledge_base) && (
                  <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
                    <BookOpen className="h-3 w-3 mr-1" />
{t('contentAuthoring.inKnowledgeBase')}
                  </Badge>
                )}
                {(existingTrack?.tags || []).filter((t: string) => t !== 'system:show_in_knowledge_base').map((tag, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                  >
                    {tag}
                  </Badge>
                ))}
                {(existingTrack?.tags || []).filter((t: string) => t !== 'system:show_in_knowledge_base').length === 0 && !((existingTrack?.tags || []).includes('system:show_in_knowledge_base') || existingTrack?.show_in_knowledge_base) && (
<p className="text-sm text-muted-foreground">{t('contentAuthoring.noTagsAdded')}</p>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddTag}
                  className="w-full mt-2"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t('contentAuthoring.addTags')}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Live Preview */}
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10">
            <CardHeader>
              <CardTitle className="text-base flex items-center">
                <Smartphone className="h-4 w-4 mr-2" />
                {t('contentAuthoring.livePreview')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {slides.length === 0 ? (
                <div className="aspect-[9/16] rounded-lg bg-accent/50 flex items-center justify-center border-2 border-dashed border-border">
                  <div className="text-center p-6">
                    <Smartphone className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
<p className="text-sm text-muted-foreground">{t('contentAuthoring.addSlidesToPreview')}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Preview Display */}
                  <div className="relative aspect-[9/16] rounded-lg overflow-hidden bg-black">
                    {slides[currentSlideIndex]?.url ? (
                      <>
                        {slides[currentSlideIndex].type === 'image' ? (
                          <img 
                            src={slides[currentSlideIndex].url} 
                            alt={slides[currentSlideIndex].name} 
                            className="w-full h-full object-cover" 
                          />
                        ) : (
                          <video 
                            src={slides[currentSlideIndex].url} 
                            className="w-full h-full object-cover" 
                            controls
                            key={slides[currentSlideIndex].id}
                          />
                        )}
                        <div className="absolute top-3 left-3 right-3">
                          <Badge variant="outline" className="bg-black/60 text-white border-white/20">
                            {slides[currentSlideIndex].name}
                          </Badge>
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="text-center text-white/60">
                          <Upload className="h-12 w-12 mx-auto mb-2" />
<p className="text-sm">{t('contentAuthoring.uploadContentForSlide')}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Navigation Controls */}
                  <div className="flex items-center justify-between bg-accent/50 rounded-lg p-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={prevSlide}
                      disabled={slides.length <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    
                    <div className="text-sm font-medium">
                      {currentSlideIndex + 1} / {slides.length}
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={nextSlide}
                      disabled={slides.length <= 1}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Slide Thumbnails */}
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {slides.map((slide, index) => (
                      <button
                        key={slide.id}
                        onClick={() => setCurrentSlideIndex(index)}
                        className={`flex-shrink-0 w-12 h-16 rounded border-2 transition-all overflow-hidden ${
                          currentSlideIndex === index
                            ? 'border-primary ring-2 ring-primary/20'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        {slide.url ? (
                          slide.type === 'image' ? (
                            <img src={slide.url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-black flex items-center justify-center">
                              <PlayCircle className="h-4 w-4 text-white" />
                            </div>
                          )
                        ) : (
                          <div className="w-full h-full bg-accent flex items-center justify-center">
                            <span className="text-xs text-muted-foreground">{index + 1}</span>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Thumbnail Upload/Edit */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center">
                <ImageIcon className="h-4 w-4 mr-2" />
                {t('contentAuthoring.thumbnail')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {thumbnailUrl ? (
                <div className="space-y-3">
                  <div className="relative aspect-video rounded-lg overflow-hidden bg-black">
                    <img 
                      src={thumbnailUrl} 
                      alt={t('contentAuthoring.storyThumbnailAlt')} 
                      className="w-full h-full object-cover" 
                    />
                  </div>
                  <div className="flex gap-2">
                    <label className="flex-1">
                      <Button variant="outline" size="sm" className="w-full" asChild>
                        <span>
                          <Upload className="h-4 w-4 mr-2" />
                          {t('contentAuthoring.replace')}
                        </span>
                      </Button>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file && currentTrackId) {
                            try {
                              setIsUploading(true);
                              const url = await crud.uploadTrackMedia(currentTrackId, file, 'thumbnail');
                              setThumbnailUrl(url);
                              toast.success(t('contentAuthoring.thumbnailUpdated'));
                            } catch (error: any) {
                              console.error('Error uploading thumbnail:', error);
                              toast.error(t('contentAuthoring.failedUploadThumbnail'));
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
                      onClick={() => setThumbnailUrl('')}
                      disabled={isUploading}
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
                      <p className="text-sm text-muted-foreground mb-1">{t('contentAuthoring.uploadThumbnail')}</p>
                      <p className="text-xs text-muted-foreground">{t('contentAuthoring.thumbnailAspectHint')}</p>
                    </div>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file && currentTrackId) {
                        try {
                          setIsUploading(true);
                          const url = await crud.uploadTrackMedia(currentTrackId, file, 'thumbnail');
                          setThumbnailUrl(url);
                          toast.success(t('contentAuthoring.thumbnailUploaded'));
                        } catch (error: any) {
                          console.error('Error uploading thumbnail:', error);
                          toast.error(t('contentAuthoring.failedUploadThumbnail'));
                        } finally {
                          setIsUploading(false);
                        }
                      }
                    }}
                    disabled={isUploading || !currentTrackId}
                  />
                </label>
              )}
              <p className="text-xs text-muted-foreground">
{currentTrackId ? t('contentAuthoring.thumbnailUsedInPlaylists') : t('contentAuthoring.saveFirstToUploadThumbnailStory')}
              </p>
            </CardContent>
          </Card>

          {/* Quick Tips */}
          <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
            <CardHeader>
              <CardTitle className="text-sm text-blue-900 dark:text-blue-100">{t('contentAuthoring.quickTips')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-blue-800 dark:text-blue-200">
              <p>• {t('contentAuthoring.storyQuickTip1')}</p>
              <p>• {t('contentAuthoring.storyQuickTip2')}</p>
              <p>• {t('contentAuthoring.storyQuickTip3')}</p>
              <p>• {t('contentAuthoring.storyQuickTip4')}</p>
            </CardContent>
          </Card>
          
          {/* Associated Playlists */}
          {currentTrackId && (
            <AssociatedPlaylists 
              trackId={currentTrackId}
              onPlaylistClick={onNavigateToPlaylist}
            />
          )}
          
          {/* Track Relationships */}
          {currentTrackId && (
            <TrackRelationships
              trackId={currentTrackId}
              trackType="story"
              onNavigateToTrack={onVersionClick}
            />
          )}
          
          {/* Version History */}
          {currentTrackId && (
            <VersionHistory
              trackId={currentTrackId}
              currentVersion={existingTrack?.version_number || 1}
              onVersionClick={async (versionTrackId) => {
                console.log('🔍 Version clicked, loading version:', versionTrackId);
                if (onVersionClick) {
                  onVersionClick(versionTrackId);
                } else {
                  // Fallback to URL navigation if prop not provided
                  window.location.href = `/story/${versionTrackId}`;
                }
              }}
            />
          )}
        </div>
      </div>

      <TagSelectorDialog
        isOpen={isTagSelectorOpen}
        onClose={() => {
          setIsTagSelectorOpen(false);
          // Refresh KB tags in case new tags were created
          loadKBTags();
        }}
        selectedTags={tags}
        onTagsChange={async (newTags) => {
          if (isEditMode) {
            setTags(newTags);
          } else {
            // In view mode, save directly to database
            try {
              const currentTrackId = track?.id || trackId;
              if (!currentTrackId) return;

              await crud.updateTrack({
                id: currentTrackId,
                tags: newTags
              });
              setTags(newTags); // Update local state
              toast.success(t('contentAuthoring.kbCategoriesUpdated'));
              if (onUpdate) {
                onUpdate(); // Refresh track data
              }
            } catch (error: any) {
              console.error('Error updating tags:', error);
              toast.error(t('contentAuthoring.failedUpdateKbCategories'), {
                description: error.message || 'Please try again'
              });
            }
          }
          // Refresh KB tags to include any newly created tags
          loadKBTags();
        }}
        systemCategory={tagSelectorConfig.systemCategory}
        restrictToParentName={tagSelectorConfig.restrictToParentName}
        // AI Recommendation props
        showAISuggest={tagSelectorConfig.systemCategory === 'content'}
        contentContext={{
          title: isEditMode ? title : (existingTrack?.title || ''),
          description: isEditMode ? description : (existingTrack?.description || ''),
          transcript: (() => {
            // For stories, extract transcript text from slides
            if (isEditMode) {
              // In edit mode, combine transcripts from all video slides
              const videoSlides = slides.filter((s: any) => s.type === 'video' && s.transcript?.text);
              return videoSlides.map((s: any) => s.transcript.text).join('\n\n');
            } else if (existingTrack?.transcript) {
              // In view mode, parse story data and extract transcripts
              try {
                const storyData = typeof existingTrack.transcript === 'string' 
                  ? JSON.parse(existingTrack.transcript) 
                  : existingTrack.transcript;
                const videoSlides = (storyData.slides || []).filter((s: any) => s.type === 'video' && s.transcript?.text);
                return videoSlides.map((s: any) => s.transcript.text).join('\n\n');
              } catch (e) {
                return '';
              }
            }
            return '';
          })(),
          keyFacts: isEditMode ? objectives.filter((o: any) => o && typeof o === 'object' ? o.fact || o.title : o) : (existingTrack?.learning_objectives || []),
          trackId: currentTrackId,
          organizationId: existingTrack?.organization_id,
        }}
      />
      
      {/* Version Decision Modal */}
      <VersionDecisionModal
        isOpen={isVersionModalOpen}
        onClose={() => {
          setIsVersionModalOpen(false);
          setPendingChanges(null);
        }}
        trackId={currentTrackId || ''}
        trackTitle={title}
        currentVersion={existingTrack?.version_number || 1}
        pendingChanges={pendingChanges}
        onVersionCreated={async (newTrackId, strategy) => {
          console.log('📍 StoryEditor: onVersionCreated callback triggered');
          console.log('✅ Version created! New track ID:', newTrackId);
          console.log('📝 Strategy:', strategy);
          
          toast.success(`Version ${(existingTrack?.version_number || 1) + 1} created with ${strategy} strategy!`);
          
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
        onOpenChange={(open) => setShowUnsavedDialog(open)}
        onDiscard={handleDiscardChanges}
        onSave={handleSaveAndNavigate}
      />
      
      {/* Compression Progress Overlay */}
      {isCompressing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Loader2 className="h-5 w-5 mr-2 animate-spin text-primary" />
                {t('contentAuthoring.processingVideo')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-muted-foreground">{compressionStage}</span>
                  <span className="font-medium">{Math.round(compressionProgress)}%</span>
                </div>
                <div className="w-full bg-accent rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-primary h-full transition-all duration-300 ease-out"
                    style={{ width: `${compressionProgress}%` }}
                  ></div>
                </div>
              </div>

              <div className="pt-2 border-t border-border space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('contentAuthoring.fileLabel')}</span>
                  <span className="font-medium truncate ml-2 max-w-[200px]" title={compressingFileName}>
                    {compressingFileName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('contentAuthoring.originalSize')}</span>
                  <span className="font-medium">{compressingFileSizeMB.toFixed(1)} MB</span>
                </div>
              </div>

              <p className="text-xs text-muted-foreground text-center pt-2">
                {t('contentAuthoring.compressionWaitNote')}
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}