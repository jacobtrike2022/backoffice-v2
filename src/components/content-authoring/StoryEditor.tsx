import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Separator } from '../ui/separator';
import { Badge } from '../ui/badge';
import { TagSelectorDialog } from '../TagSelectorDialog';
import { VersionHistory } from './VersionHistory';
import { AssociatedPlaylists } from './AssociatedPlaylists';
import { VersionDecisionModal } from './VersionDecisionModal';
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
  Plus,
  GripVertical,
  Trash2,
  ChevronLeft,
  ChevronRight,
  PlayCircle,
  Loader2,
  History
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import * as crud from '../../lib/crud';
import { compressVideo, shouldCompressVideo } from '../../utils/video-compressor';

interface Slide {
  id: string;
  name: string;
  type: 'image' | 'video';
  url: string;
  order: number;
  duration?: number; // Duration in seconds (for videos) or default for images
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
  onNavigateToPlaylist
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
  const [objectives, setObjectives] = useState<string[]>(['']);
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [isTagSelectorOpen, setIsTagSelectorOpen] = useState(false);
  
  // Preview state
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [draggedSlideId, setDraggedSlideId] = useState<string | null>(null);
  const [showBottomAddButton, setShowBottomAddButton] = useState(false);
  
  // Versioning state
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<any>(null);

  const currentTrackId = trackId || track?.id;
  const isSuperAdmin = isSuperAdminAuthenticated || currentRole === 'Trike Super Admin';
  const isSystemContent = existingTrack?.is_system_content && !isSuperAdmin;
  const handleBackClick = onBack || onClose;
  
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

  // Load existing story
  useEffect(() => {
    if (track) {
      setExistingTrack(track);
      loadStoryData(track);
    } else if (trackId) {
      loadStory();
    }
  }, [trackId, track]);

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

  const loadStoryData = (trackData: any) => {
    setTitle(trackData.title || '');
    setDescription(trackData.description || '');
    setTags(trackData.tags || []);
    setThumbnailUrl(trackData.thumbnail_url || '');
    setNotes(trackData.content_text || '');
    
    // Parse story data from transcript field
    if (trackData.transcript) {
      try {
        const storyData = JSON.parse(trackData.transcript);
        if (storyData.slides && Array.isArray(storyData.slides)) {
          setSlides(storyData.slides);
        }
        if (storyData.objectives) {
          setObjectives(storyData.objectives);
        }
      } catch (e) {
        console.error('Error parsing story data:', e);
      }
    }
  };

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
        objectives: objectives.filter(o => o.trim() !== '')
      };

      const trackData = {
        title,
        description,
        type: 'story' as const,
        transcript: JSON.stringify(storyData),
        content_text: notes,
        duration_minutes: calculateStoryDuration(), // Use actual calculated duration
        tags,
        thumbnail_url: thumbnailUrl || (slides.length > 0 ? slides[0].url : '')
      };

      if (currentTrackId) {
        // Check if track is published and has assignments
        if (existingTrack?.status === 'published') {
          const stats = await crud.getTrackAssignmentStats(currentTrackId);
          
          if (stats.totalAssignments > 0) {
            // Show version decision modal instead of saving directly
            console.log('Track has assignments, showing version decision modal. Stats:', stats);
            setPendingChanges({ id: currentTrackId, ...trackData });
            setIsVersionModalOpen(true);
            setIsSaving(false);
            return;
          }
        }
        
        // If no assignments or not published, update normally
        await crud.updateTrack({ id: currentTrackId, ...trackData });
        toast.success('Changes saved!');
        
        setIsEditMode(false);
        
        if (onUpdate) {
          await onUpdate();
        } else {
          await loadStory();
        }
      } else {
        const newTrack = await crud.createTrack({ ...trackData, status: 'draft' as const });
        toast.success('Story created as draft!');
        if (handleBackClick) handleBackClick();
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
      if (handleBackClick) handleBackClick();
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
            <Button variant="outline" size="sm" onClick={handleBackClick}>
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
                  <div className="w-full max-w-sm space-y-4">
                    {slides.map((slide, index) => (
                      <div key={slide.id} className="relative">
                        <div className="absolute top-2 left-2 z-10">
                          <Badge variant="outline" className="bg-black/60 text-white border-white/20">
                            {index + 1}. {slide.name}
                          </Badge>
                        </div>
                        <div className="relative aspect-[9/16] rounded-lg overflow-hidden bg-black">
                          {slide.type === 'image' ? (
                            <img src={slide.url} alt={slide.name} className="w-full h-full object-cover" />
                          ) : (
                            <video src={slide.url} className="w-full h-full object-cover" controls />
                          )}
                        </div>
                      </div>
                    ))}
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

            {/* Learning Objectives */}
            {objectives.filter(o => o.trim()).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Learning Objectives</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {objectives.filter(o => o.trim()).map((objective, index) => (
                      <li key={index} className="flex items-start space-x-3">
                        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-[#F74A05] to-[#FF733C] flex items-center justify-center text-xs font-semibold text-white mt-0.5 shadow-sm">
                          {index + 1}
                        </div>
                        <span className="text-muted-foreground leading-relaxed pt-1">{objective}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
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
          <Button variant="outline" size="sm" onClick={handleBackClick}>
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

          {/* Learning Objectives */}
          <Card>
            <CardHeader>
              <CardTitle>Learning Objectives</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {objectives.map((objective, index) => (
                <div key={index} className="flex items-start space-x-2">
                  <Input
                    placeholder={`Objective ${index + 1}`}
                    value={objective}
                    onChange={(e) => updateObjective(index, e.target.value)}
                    className="flex-1"
                  />
                  {objectives.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeObjective(index)}
                      className="flex-shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={addObjective}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Objective
              </Button>
            </CardContent>
          </Card>

          {/* Tags */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tags</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {tags.map((tag, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => setTags(tags.filter((_, i) => i !== index))}
                  >
                    {tag}
                    <X className="h-3 w-3 ml-1" />
                  </Badge>
                ))}
                {tags.length === 0 && (
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
                {tags.map((tag, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => setTags(tags.filter((_, i) => i !== index))}
                  >
                    {tag}
                    <X className="h-3 w-3 ml-1" />
                  </Badge>
                ))}
                {tags.length === 0 && (
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
          
          {/* Associated Playlists */}
          {currentTrackId && (
            <AssociatedPlaylists 
              trackId={currentTrackId}
              onPlaylistClick={onNavigateToPlaylist}
            />
          )}
        </div>
      </div>

      <TagSelectorDialog
        isOpen={isTagSelectorOpen}
        onClose={() => setIsTagSelectorOpen(false)}
        selectedTags={tags}
        onTagsChange={setTags}
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
          console.log('✅ Version created! New track ID:', newTrackId);
          toast.success(`Version ${(existingTrack?.version_number || 1) + 1} created with ${strategy} strategy!`);
          setIsVersionModalOpen(false);
          setIsEditMode(false);
          
          // Small delay to let modal close gracefully before navigation
          setTimeout(() => {
            window.location.href = `/story/${newTrackId}`;
          }, 300);
        }}
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