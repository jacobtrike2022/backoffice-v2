import React, { useState, useEffect } from 'react';
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
  Sparkles,
  Zap,
  CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import * as crud from '../../lib/crud';
import * as factsCrud from '../../lib/crud/facts';
import * as trackRelCrud from '../../lib/crud/trackRelationships';
import { compressVideo, shouldCompressVideo } from '../../utils/video-compressor';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

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
  registerUnsavedChangesCheck
}: StoryEditorProps) {
  const [isEditMode, setIsEditMode] = useState(isNewContent);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [existingTrack, setExistingTrack] = useState<any>(null);
  
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
  
  // Track initial state for unsaved changes detection
  const [initialState, setInitialState] = useState<any>(null);
  
  // AI Key Facts generation
  const [isGeneratingKeyFacts, setIsGeneratingKeyFacts] = useState(false);

  const currentTrackId = trackId || track?.id;
  const isSuperAdmin = isSuperAdminAuthenticated || currentRole === 'Trike Super Admin';
  const isSystemContent = existingTrack?.is_system_content && !isSuperAdmin;
  
  // Calculate story duration
  const calculateStoryDuration = () => {
    if (slides.length === 0) return 0; // No slides yet
    
    // Sum up all slide durations
    const totalSeconds = slides.reduce((total, slide) => {
      if (slide.duration && !isNaN(slide.duration)) {
        return total + slide.duration;
      } else if (slide.url) {
        // If slide has content but no duration, use default 10 seconds
        return total + 10;
      } else {
        // Slide has no content yet, don't count it
        return total;
      }
    }, 0);
    
    if (totalSeconds === 0) return 0; // No valid content yet
    
    // Convert to minutes, minimum 1 minute for valid content
    const minutes = Math.max(1, Math.round(totalSeconds / 60));
    console.log('Story duration calculation:', {
      slideCount: slides.length,
      totalSeconds,
      minutes,
      slides: slides.map(s => ({ type: s.type, duration: s.duration, hasUrl: !!s.url }))
    });
    return minutes;
  };
  
  const storyDuration = calculateStoryDuration();

  // Load KB tags
  useEffect(() => {
    const loadKBTags = async () => {
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
    };
    loadKBTags();
  }, []);

  // Load existing story
  useEffect(() => {
    if (track) {
      setExistingTrack(track);
      loadStoryData(track);
    } else if (trackId) {
      loadStory();
    }
  }, [trackId, track]);

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

  const loadStory = async () => {
    if (!trackId) return;
    
    setIsLoading(true);
    try {
      const loadedTrack = await crud.getTrackById(trackId);
      setExistingTrack(loadedTrack);
      loadStoryData(loadedTrack);
    } catch (error: any) {
      console.error('Error loading story:', error);
      toast.error('Failed to load story');
    } finally {
      setIsLoading(false);
    }
  };

  const loadStoryData = async (trackData: any) => {
    setTitle(trackData.title || '');
    setDescription(trackData.description || '');
    setTags(trackData.tags || []);
    setThumbnailUrl(trackData.thumbnail_url || '');
    setNotes(trackData.content_text || '');
    setShowInKnowledgeBase((trackData.tags || []).includes('system:show_in_knowledge_base') || trackData.show_in_knowledge_base || false);
    
    // Parse story data from transcript field
    let parsedSlides: any[] = [];
    let parsedObjectives: string[] = [];
    if (trackData.transcript) {
      try {
        const storyData = JSON.parse(trackData.transcript);
        if (storyData.slides && Array.isArray(storyData.slides)) {
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
      tags: trackData.tags || [],
      thumbnailUrl: trackData.thumbnail_url || '',
      notes: trackData.content_text || '',
      slides: parsedSlides,
      objectives: parsedObjectives,
    });
  };

  // Check if there are unsaved changes
  const hasUnsavedChanges = () => {
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
      notes !== initialState.notes ||
      JSON.stringify(slides) !== JSON.stringify(initialState.slides) ||
      JSON.stringify(objectives) !== JSON.stringify(initialState.objectives)
    );
  };

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
        console.log('📝 StoryEditor: Registering hasUnsavedChanges function');
        registerUnsavedChangesCheck(hasUnsavedChanges);
      } else {
        console.log('📝 StoryEditor: Unregistering hasUnsavedChanges function');
        registerUnsavedChangesCheck(null);
      }
    }
    
    // Cleanup on unmount
    return () => {
      if (registerUnsavedChangesCheck) {
        registerUnsavedChangesCheck(null);
      }
    };
  }, [isEditMode, registerUnsavedChangesCheck]);

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
      const uploadUrl = `https://${projectId}.supabase.co/functions/v1/make-server-2858cc8b/upload-media`;
      
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
      
      toast.success(`${type === 'video' ? 'Video' : 'Image'} uploaded successfully!`);
      
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
      toast.error('Story must have at least one slide');
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

  const handleKBToggle = async (checked: boolean) => {
    if (isEditMode) {
      // In edit mode, update the local state
      setShowInKnowledgeBase(checked);
      
      if (checked) {
        setTagSelectorConfig({
          systemCategory: 'knowledge-base',
          restrictToParentName: 'KB Category'
        });
        setIsTagSelectorOpen(true);
      }
    } else {
      // In view mode, update the track directly in the database
      try {
        const currentTrackId = track?.id || trackId;
        if (!currentTrackId) return;
        
        await crud.updateTrack({
          id: currentTrackId,
          show_in_knowledge_base: checked
        });
        
        toast.success(checked ? 'Track added to Knowledge Base' : 'Track removed from Knowledge Base');
        
        // Update local state to reflect the change
        setShowInKnowledgeBase(checked);
        
        // Refresh the track data
        if (onUpdate) {
          onUpdate();
        }
        
        if (checked) {
          setTagSelectorConfig({
            systemCategory: 'knowledge-base',
            restrictToParentName: 'KB Category'
          });
          setIsTagSelectorOpen(true);
        }
      } catch (error: any) {
        console.error('Error updating KB toggle:', error);
        toast.error('Failed to update Knowledge Base setting', {
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
      toast.error('Cannot edit Trike Library content');
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
        thumbnail_url: thumbnailUrl || (slides.length > 0 ? slides[0].url : '')
      };

      if (currentTrackId) {
        await crud.updateTrack({ id: currentTrackId, ...trackData });
        toast.success('Changes saved!');
      } else {
        await crud.createTrack({ ...trackData, status: 'draft' as const });
        toast.success('Story created as draft!');
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
      toast.error('Failed to save story');
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
      toast.error('Cannot edit Trike Library content');
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
        thumbnail_url: thumbnailUrl || (slides.length > 0 ? slides[0].url : '')
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
        await crud.updateTrack({ id: currentTrackId, ...trackData });
        toast.success(contentChanged ? 'Changes saved!' : 'Settings updated!');
        
        setIsEditMode(false);
        
        if (onUpdate) {
          await onUpdate();
        } else {
          await loadStory();
        }
      } else {
        const newTrack = await crud.createTrack({ ...trackData, status: 'draft' as const });
        toast.success('Story created as draft!');
        const backFn = onBack || onClose;
        if (backFn) backFn();
      }
    } catch (error: any) {
      console.error('Error saving story:', error);
      toast.error('Failed to save story');
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
      toast.error('Please add a title');
      return false;
    }
    if (slides.length === 0) {
      toast.error('Please add at least one slide');
      return false;
    }
    const emptySlides = slides.filter(s => !s.url);
    if (emptySlides.length > 0) {
      toast.error('All slides must have content uploaded');
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

  const removeObjective = (index: number) => {
    if (objectives.length === 1) {
      toast.error('Story must have at least one learning objective');
      return;
    }
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
        `You currently have ${objectives.filter(o => o.trim()).length} key fact(s).\n\nWhat would you like to do?\n\nOK = Replace all existing facts\nCancel = Add to existing facts`
      );
      
      const shouldReplace = action;
      
      setIsGeneratingKeyFacts(true);
      
      try {
        console.log('🎬 Step 1: Transcribing all story videos...');
        
        // Step 1: Transcribe all videos in the story
        const transcribeResponse = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-2858cc8b/transcribe-story`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              storyData: slides,
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
          `https://${projectId}.supabase.co/functions/v1/make-server-2858cc8b/generate-key-facts`,
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
        
        const updatedFacts = shouldReplace 
          ? newFacts
          : [...objectives.filter((o: any) => {
              if (typeof o === 'string') return o.trim();
              if (typeof o === 'object' && o?.fact) return o.fact.trim();
              return false;
            }), ...newFacts];
        
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
          `https://${projectId}.supabase.co/functions/v1/make-server-2858cc8b/transcribe-story`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              storyData: slides,
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
          `https://${projectId}.supabase.co/functions/v1/make-server-2858cc8b/generate-key-facts`,
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
        
        setObjectives(newFacts);
        
        toast.success(`✨ Generated ${newFacts.length} key fact${newFacts.length > 1 ? 's' : ''}!`);
        
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
          <p className="text-muted-foreground">Loading story...</p>
        </div>
      </div>
    );
  }

  // View Mode
  if (!isEditMode && existingTrack) {
    return (
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
                    Viewing Version {existingTrack.version_number}
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
        
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="sm" onClick={handleBackWithCheck}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <div className="flex items-center space-x-2 mb-1">
                <h1 className="text-foreground">{title}</h1>
              </div>
              <div className="flex items-center space-x-2 flex-wrap">
                <Badge className="bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-900/30 dark:text-pink-400">
                  <Smartphone className="h-3 w-3 mr-1" />
                  Story
                </Badge>
                <Badge variant="outline" className="text-muted-foreground">
                  {storyDuration} {storyDuration === 1 ? 'min' : 'mins'}
                </Badge>
                <Badge 
                  variant="outline"
                  className={`${
                    existingTrack.status === 'published'
                      ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400'
                  }`}
                >
                  {existingTrack.status === 'published' ? 'Published' : 'Draft'}
                </Badge>
                {isSystemContent && (
                  <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400">
                    <Lock className="h-3 w-3 mr-1" />
                    Trike Library
                  </Badge>
                )}
              </div>
            </div>
          </div>
          {(!isSystemContent || isSuperAdmin) && (
            <Button onClick={() => setIsEditMode(true)} className="hero-primary">
              <Edit className="h-4 w-4 mr-2" />
              Edit Track
              {isSystemContent && isSuperAdmin && (
                <Badge className="ml-2 bg-orange-100 text-orange-800">
                  Super Admin
                </Badge>
              )}
            </Button>
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
                    Story • {slides.length} Slides
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
                    <h3 className="font-medium mb-2">Additional Notes</h3>
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
                    <CardTitle>Key Facts</CardTitle>
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
                          <h4 className="text-sm font-semibold text-foreground border-b pb-2">Other Facts</h4>
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
            {/* Publishing Status */}
            {(!isSystemContent || isSuperAdmin) && currentTrackId && existingTrack && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Publishing Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
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
                          toast.success(`Story ${newStatus === 'published' ? 'published' : 'moved to drafts'}!`);
                          setExistingTrack({ ...existingTrack, status: newStatus });
                          if (onUpdate) {
                            await onUpdate();
                          }
                        } catch (error: any) {
                          console.error('Error updating status:', error);
                          toast.error('Failed to update status');
                        }
                      }}
                    >
                      {existingTrack.status === 'published' ? 'Published' : 'Draft'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Click the status badge to {existingTrack.status === 'published' ? 'move to drafts' : 'publish'}
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
                    Knowledge Base
                  </CardTitle>
                </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="show-in-kb-view" className="text-sm">Show in KB</Label>
                    <p className="text-xs text-muted-foreground">
                      Available in Knowledge Base
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
                    <div>
                      <p className="text-xs font-medium mb-2 text-muted-foreground">Selected Categories:</p>
                      <div className="flex flex-wrap gap-2">
                        {tags
                          .filter((t: string) => kbTagNames.has(t))
                          .map((tag: string) => (
                            <Badge key={tag} variant="secondary" className="bg-blue-50 text-blue-700 border-blue-100">
                              {tag}
                            </Badge>
                        ))}
                        {tags.filter((t: string) => kbTagNames.has(t)).length === 0 && (
                          <span className="text-xs text-muted-foreground italic">No categories selected</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            )}

            {/* Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex items-start space-x-3">
                  <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-muted-foreground text-xs">Created</p>
                    <p className="font-medium">{new Date(existingTrack.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <Separator />
                <div className="flex items-start space-x-3">
                  <Smartphone className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-muted-foreground text-xs">Format</p>
                    <p className="font-medium">Portrait (9:16) • {slides.length} Slides</p>
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
                    Tags
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
    );
  }

  // Edit Mode
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="sm" onClick={handleBackWithCheck}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <div className="flex items-center space-x-2 mb-1">
              <h1 className="text-foreground">
                {currentTrackId ? title || 'Edit Story' : 'Create New Story'}
              </h1>
            </div>
            <div className="flex items-center space-x-2 flex-wrap">
              <Badge className="bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-900/30 dark:text-pink-400">
                <Smartphone className="h-3 w-3 mr-1" />
                Story
              </Badge>
              {storyDuration > 0 && (
                <Badge variant="outline" className="text-muted-foreground">
                  {storyDuration} {storyDuration === 1 ? 'min' : 'mins'}
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
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving} className="hero-primary">
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </>
          )}
          {!currentTrackId && (
            <Button variant="outline" onClick={handleSave} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save Draft'}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">
        <div className="space-y-6">
          {/* Story Details */}
          <Card>
            <CardHeader>
              <CardTitle>Story Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">Story Title *</Label>
                <Input
                  id="title"
                  placeholder="Enter story title..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Brief description of this story..."
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
                  Story Slides (Portrait Mode)
                </CardTitle>
                <Button onClick={addSlide} size="sm" className="hero-primary">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Slide
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {slides.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-border rounded-lg">
                  <Smartphone className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">No slides yet</p>
                  <Button onClick={addSlide} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Slide
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
                              placeholder="Slide name..."
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
                                    <span className="text-sm text-muted-foreground">Upload Image</span>
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
                                    <span className="text-sm text-muted-foreground">Upload Video</span>
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
                        Add Slide
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
              <CardTitle>Additional Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Add any additional notes or instructions for learners..."
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
                  Key Facts
                </CardTitle>
                <div className="flex items-center gap-2">
                  {/* AI Generate Button with Neon Orange Glow */}
                  <button
                    onClick={handleGenerateKeyFacts}
                    disabled={isGeneratingKeyFacts || slides.filter(s => s.type === 'video').length === 0}
                    className="group relative p-2 rounded-lg transition-all duration-300 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    title="Generate Key Facts with AI from video transcripts"
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
                  AI is analyzing your story videos and extracting key facts...
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
                                  placeholder={`Key fact...`}
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
                                  onClick={() => {
                                    setObjectives(objectives.filter((_, i) => i !== index));
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
                                  placeholder={`Key fact...`}
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
                                    onClick={() => {
                                      setObjectives(objectives.filter((_, i) => i !== index));
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
              <CardTitle className="text-base">Tags</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {/* System Knowledge Base Badge - Always shown when KB toggle is on */}
                {showInKnowledgeBase && (
                  <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
                    <BookOpen className="h-3 w-3 mr-1" />
                    In Knowledge Base
                  </Badge>
                )}
                {tags.filter((t: string) => t !== 'system:show_in_knowledge_base').map((tag, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => setTags(tags.filter((t) => t !== tag))}
                  >
                    {tag}
                    <X className="h-3 w-3 ml-1" />
                  </Badge>
                ))}
                {tags.filter((t: string) => t !== 'system:show_in_knowledge_base').length === 0 && !showInKnowledgeBase && (
                  <p className="text-sm text-muted-foreground">No tags added</p>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsTagSelectorOpen(true)}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Tags
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Live Preview Sidebar */}
        <div className="xl:sticky xl:top-6 xl:h-[calc(100vh-3rem)] xl:overflow-y-auto space-y-6">
          {/* Publishing Status - Always show for new content */}
          {(!isSystemContent || isSuperAdmin) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Publishing Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {currentTrackId && existingTrack ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Status</span>
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
                            toast.success(`Story ${newStatus === 'published' ? 'published' : 'moved to drafts'}!`);
                            setExistingTrack({ ...existingTrack, status: newStatus });
                            if (onUpdate) {
                              await onUpdate();
                            }
                          } catch (error: any) {
                            console.error('Error updating status:', error);
                            toast.error('Failed to update status');
                          }
                        }}
                      >
                        {existingTrack.status === 'published' ? 'Published' : 'Draft'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Click the status badge to {existingTrack.status === 'published' ? 'move to drafts' : 'publish'}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Status</span>
                      <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400">
                        Draft
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Story will be saved as a draft. You can publish it later.
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
                Knowledge Base
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="show-in-kb-edit" className="text-sm">Show in KB</Label>
                  <p className="text-xs text-muted-foreground">
                    Available in Knowledge Base
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
                    Manage KB Tags
                  </Button>
                  
                  {/* Selected KB Tags Display */}
                  <div>
                    <p className="text-xs font-medium mb-2 text-muted-foreground">Selected Categories:</p>
                    <div className="flex flex-wrap gap-2">
                      {tags
                        .filter((t: string) => kbTagNames.has(t))
                        .map((tag: string) => (
                          <Badge key={tag} variant="secondary" className="bg-blue-50 text-blue-700 border-blue-100">
                            {tag}
                          </Badge>
                      ))}
                      {tags.filter((t: string) => kbTagNames.has(t)).length === 0 && (
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

          {/* Story Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Story Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-start space-x-3">
                <Smartphone className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-muted-foreground text-xs">Format</p>
                  <p className="font-medium">Portrait (9:16)</p>
                </div>
              </div>
              <Separator />
              <div className="flex items-start space-x-3">
                <ImageIcon className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-muted-foreground text-xs">Total Slides</p>
                  <p className="font-medium">{slides.length} {slides.length === 1 ? 'Slide' : 'Slides'}</p>
                </div>
              </div>
              <Separator />
              <div className="flex items-start space-x-3">
                <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-muted-foreground text-xs">Est. Duration</p>
                  <p className="font-medium">{storyDuration} {storyDuration === 1 ? 'minute' : 'minutes'}</p>
                </div>
              </div>
              {currentTrackId && existingTrack && (
                <>
                  <Separator />
                  <div className="flex items-start space-x-3">
                    <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-muted-foreground text-xs">Created</p>
                      <p className="font-medium">{new Date(existingTrack.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Tags */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tags</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {/* System Knowledge Base Badge - Always shown when KB toggle is on */}
                {showInKnowledgeBase && (
                  <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
                    <BookOpen className="h-3 w-3 mr-1" />
                    In Knowledge Base
                  </Badge>
                )}
                {tags.filter((t: string) => t !== 'system:show_in_knowledge_base').map((tag, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => setTags(tags.filter((t) => t !== tag))}
                  >
                    {tag}
                    <X className="h-3 w-3 ml-1" />
                  </Badge>
                ))}
                {tags.filter((t: string) => t !== 'system:show_in_knowledge_base').length === 0 && !showInKnowledgeBase && (
                  <p className="text-sm text-muted-foreground">No tags added</p>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsTagSelectorOpen(true)}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Tags
              </Button>
            </CardContent>
          </Card>

          {/* Live Preview */}
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10">
            <CardHeader>
              <CardTitle className="text-base flex items-center">
                <Smartphone className="h-4 w-4 mr-2" />
                Live Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              {slides.length === 0 ? (
                <div className="aspect-[9/16] rounded-lg bg-accent/50 flex items-center justify-center border-2 border-dashed border-border">
                  <div className="text-center p-6">
                    <Smartphone className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Add slides to preview</p>
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
                          <p className="text-sm">Upload content for this slide</p>
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
                Thumbnail
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {thumbnailUrl ? (
                <div className="space-y-3">
                  <div className="relative aspect-video rounded-lg overflow-hidden bg-black">
                    <img 
                      src={thumbnailUrl} 
                      alt="Story thumbnail" 
                      className="w-full h-full object-cover" 
                    />
                  </div>
                  <div className="flex gap-2">
                    <label className="flex-1">
                      <Button variant="outline" size="sm" className="w-full" asChild>
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
                          if (file && currentTrackId) {
                            try {
                              setIsUploading(true);
                              const url = await crud.uploadTrackMedia(currentTrackId, file, 'thumbnail');
                              setThumbnailUrl(url);
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
                      if (file && currentTrackId) {
                        try {
                          setIsUploading(true);
                          const url = await crud.uploadTrackMedia(currentTrackId, file, 'thumbnail');
                          setThumbnailUrl(url);
                          toast.success('Thumbnail uploaded!');
                        } catch (error: any) {
                          console.error('Error uploading thumbnail:', error);
                          toast.error('Failed to upload thumbnail');
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
                {currentTrackId ? 'Used in playlists and library views' : 'Save story first to upload thumbnail'}
              </p>
            </CardContent>
          </Card>

          {/* Quick Tips */}
          <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
            <CardHeader>
              <CardTitle className="text-sm text-blue-900 dark:text-blue-100">Quick Tips</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-blue-800 dark:text-blue-200">
              <p>• Drag slides to reorder them</p>
              <p>• Each slide can be an image or video</p>
              <p>• Portrait format (9:16) recommended</p>
              <p>• Click slide thumbnails to preview</p>
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
        onClose={() => setIsTagSelectorOpen(false)}
        selectedTags={tags}
        onTagsChange={setTags}
        systemCategory={tagSelectorConfig.systemCategory}
        restrictToParentName={tagSelectorConfig.restrictToParentName}
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
                Compressing Video
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
                  <span className="text-muted-foreground">File:</span>
                  <span className="font-medium truncate ml-2 max-w-[200px]" title={compressingFileName}>
                    {compressingFileName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Original Size:</span>
                  <span className="font-medium">{compressingFileSizeMB.toFixed(1)} MB</span>
                </div>
              </div>
              
              <p className="text-xs text-muted-foreground text-center pt-2">
                Please wait while we compress your video. This may take a minute or two for larger files.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}