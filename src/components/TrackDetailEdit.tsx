import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { TagSelectorDialog } from './TagSelectorDialog';
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
  Sparkles
} from 'lucide-react';
import * as crud from '../lib/crud';
import { toast } from 'sonner@2.0.3';
import { InteractiveTranscript } from './InteractiveTranscript';

interface TrackDetailEditProps {
  track: any;
  onBack: () => void;
  onUpdate: () => void;
  isSuperAdminAuthenticated?: boolean;
  isNewContent?: boolean;
}

export function TrackDetailEdit({ track, onBack, onUpdate, isSuperAdminAuthenticated = false, isNewContent = false }: TrackDetailEditProps) {
  const [isEditMode, setIsEditMode] = useState(isNewContent); // Start in edit mode for new content
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const youtubePlayerRef = useRef<any>(null);
  const [isTagSelectorOpen, setIsTagSelectorOpen] = useState(false);
  const [editFormData, setEditFormData] = useState<any>({
    title: '',
    description: '',
    duration_minutes: '',
    transcript: '',
    transcript_data: null, // For structured transcript with word-level timestamps
    learning_objectives: [],
    tags: [],
    content_url: '',
  });

  const isSystemContent = track.is_system_content;

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
      setEditFormData({
        title: track.title || '',
        description: track.description || '',
        duration_minutes: track.duration_minutes || '',
        transcript: track.transcript || '',
        transcript_data: track.transcript_data || null, // Initialize from track
        learning_objectives: track.learning_objectives || [],
        tags: track.tags || [],
        content_url: track.content_url || '',
        thumbnail_url: track.thumbnail_url || '',
        type: track.type || 'video',
      });
    }
  }, [isEditMode, track]);

  // Debug: Log when editFormData changes
  useEffect(() => {
    console.log('editFormData changed:', editFormData);
  }, [editFormData]);

  const handleSave = async () => {
    if (!editFormData.title.trim()) {
      toast.error('Title is required');
      return;
    }

    setIsSaving(true);
    try {
      const saveData = {
        id: track.id,
        title: editFormData.title || track.title,
        description: editFormData.description || track.description,
        content_url: editFormData.content_url || track.content_url,
        duration_minutes: parseInt(editFormData.duration_minutes) || track.duration_minutes || 0,
        learning_objectives: editFormData.learning_objectives || track.learning_objectives || [],
        tags: editFormData.tags || track.tags || [],
        thumbnail_url: editFormData.thumbnail_url || track.thumbnail_url,
        type: editFormData.type,
        transcript_data: editFormData.transcript_data || track.transcript_data || null,
      };

      console.log('Saving track with data:', saveData);
      console.log('Transcript data being saved:', JSON.stringify(saveData.transcript_data, null, 2));

      await crud.updateTrack(saveData);

      console.log('Track updated successfully, calling onUpdate...');
      toast.success('Track updated successfully!');
      setIsEditMode(false);
      
      // Call onUpdate to trigger refetch
      try {
        await onUpdate();
        console.log('Refetch complete');
      } catch (refetchError: any) {
        console.error('Refetch error (non-fatal):', refetchError);
        // Don't fail the whole operation if refetch fails
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

  const handleRemoveLearningObjective = (index: number) => {
    const newObjectives = editFormData.learning_objectives.filter((_: any, i: number) => i !== index);
    setEditFormData({ ...editFormData, learning_objectives: newObjectives });
  };

  const handleAddTag = () => {
    const newTag = prompt('Enter new tag:');
    if (newTag && newTag.trim()) {
      setEditFormData({
        ...editFormData,
        tags: [...(editFormData.tags || []), newTag.trim()]
      });
    }
  };

  const handleRemoveTag = (index: number) => {
    const newTags = editFormData.tags.filter((_: any, i: number) => i !== index);
    setEditFormData({ ...editFormData, tags: newTags });
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
      
      const uploadUrl = `https://${projectId}.supabase.co/functions/v1/make-server-2858cc8b/upload-media`;
      console.log('Uploading to:', uploadUrl);
      console.log('File info:', { name: file.name, type: file.type, size: file.size });
      
      // First test if server is reachable
      try {
        const healthCheck = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-2858cc8b/health`,
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
      
      // Upload thumbnail if we have one
      let thumbnailUrl = editFormData.thumbnail_url;
      if (thumbnailBlob) {
        console.log('Uploading thumbnail...');
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
          console.log('Thumbnail uploaded:', thumbnailUrl);
        }
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
      
      const transcribeUrl = `https://${projectId}.supabase.co/functions/v1/make-server-2858cc8b/transcribe`;
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
      
      // Auto-save the transcript directly to database (without requiring edit mode)
      await crud.updateTrack({
        id: track.id,
        transcript: data.transcript.text,
        transcript_data: data.transcript,
      });
      
      toast.success('Transcript generated and saved!');
      
      // Trigger refetch to update UI
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

  return (
    <div className="space-y-6">
      {/* Header with Back Button and Edit/Save */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            onClick={onBack}
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
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-6">
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

          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
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
                <CardTitle>Tags</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {isEditMode ? (
                  <>
                    {(editFormData.tags || []).map((tag: string, index: number) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => handleRemoveTag(index)}
                      >
                        {tag}
                        <X className="h-3 w-3 ml-1" />
                      </Badge>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsTagSelectorOpen(true)}
                      className="h-6"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Tag
                    </Button>
                  </>
                ) : (
                  <>
                    {track.tags && track.tags.length > 0 ? (
                      track.tags.map((tag: string, index: number) => (
                        <Badge key={index} variant="secondary">
                          {tag}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No tags</p>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Learning Objectives */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Learning Objectives</CardTitle>
                {isEditMode && (
                  <Button size="sm" variant="outline" onClick={handleAddLearningObjective}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isEditMode ? (
                <div className="space-y-2">
                  {(editFormData.learning_objectives || []).map((objective: string, index: number) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-brand-gradient flex items-center justify-center text-white text-xs flex-shrink-0">
                        {index + 1}
                      </div>
                      <Input
                        value={objective}
                        onChange={(e) => handleUpdateLearningObjective(index, e.target.value)}
                        placeholder="Enter learning objective..."
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveLearningObjective(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {(!editFormData.learning_objectives || editFormData.learning_objectives.length === 0) && (
                    <p className="text-sm text-muted-foreground">No learning objectives yet. Click "Add" to create one.</p>
                  )}
                </div>
              ) : (
                <ul className="space-y-2">
                  {track.learning_objectives && track.learning_objectives.length > 0 ? (
                    track.learning_objectives.map((objective: string, index: number) => (
                      <li key={index} className="flex items-start space-x-2">
                        <div className="h-6 w-6 rounded-full bg-brand-gradient flex items-center justify-center text-white text-xs mt-0.5 flex-shrink-0">
                          {index + 1}
                        </div>
                        <span className="text-muted-foreground leading-relaxed pt-0.5">{objective}</span>
                      </li>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No learning objectives defined</p>
                  )}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Interactive Transcript - Always show for video/audio tracks */}
          {(track.type === 'video' || track.type === 'audio' || track.content_url?.match(/\\.(mp4|webm|ogg|mp3|wav)$/i)) && (
            <InteractiveTranscript
              transcript={track.transcript_data}
              currentTime={currentTime}
              onSeek={handleSeek}
              canTranscribe={!!track.content_url && !track.transcript_data}
              onTranscribe={handleTranscribe}
              isTranscribing={isTranscribing}
              isEditMode={isEditMode}
              onTranscriptEdit={handleTranscriptEdit}
            />
          )}
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
                      if (newUrl && (isYouTubeUrl(newUrl) || isVimeoUrl(newUrl))) {
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
                    Supports YouTube, Vimeo, and direct file URLs
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
        </div>
      </div>

      {/* Tag Selector Dialog */}
      <TagSelectorDialog
        isOpen={isTagSelectorOpen}
        onClose={() => setIsTagSelectorOpen(false)}
        selectedTags={editFormData.tags || []}
        onTagsChange={(tags) => setEditFormData({ ...editFormData, tags })}
      />
    </div>
  );
}