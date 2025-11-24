import React, { useState, useEffect } from 'react';
import { TrackDetailEdit } from './TrackDetailEdit';
import { ArticleDetailEdit } from './ArticleDetailEdit';
import * as crud from '../lib/crud';
import { toast } from 'sonner@2.0.3';
import { Loader2 } from 'lucide-react';

interface ContentCreationWrapperProps {
  contentType: 'article' | 'video';
  onBack: () => void;
  isSuperAdminAuthenticated?: boolean;
}

export function ContentCreationWrapper({ 
  contentType, 
  onBack,
  isSuperAdminAuthenticated = false 
}: ContentCreationWrapperProps) {
  const [track, setTrack] = useState<any>(null);
  const [isCreating, setIsCreating] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    createDraftTrack();
  }, [contentType]);

  const createDraftTrack = async () => {
    setIsCreating(true);
    setError(null);
    
    try {
      // Create a new draft track in the database
      const newTrack = await crud.createTrack({
        title: `Untitled ${contentType === 'article' ? 'Article' : 'Video'}`,
        description: '',
        type: contentType,
        status: 'draft',
        duration_minutes: 0,
        content_url: '',
        thumbnail_url: '',
        tags: [],
        learning_objectives: [],
        transcript: contentType === 'article' ? '' : undefined,
        is_system_content: false,
      });

      console.log('Created draft track:', newTrack);
      setTrack(newTrack);
    } catch (error: any) {
      console.error('Error creating draft track:', error);
      setError(error.message || 'Failed to create draft content');
      toast.error(error.message || 'Failed to create draft content');
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdate = async () => {
    // Reload the track data after save
    if (track?.id) {
      try {
        const updatedTrack = await crud.getTrackById(track.id);
        setTrack(updatedTrack);
      } catch (error) {
        console.error('Error reloading track:', error);
      }
    }
  };

  if (isCreating) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Creating new {contentType}...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <p className="text-destructive">{error}</p>
          <button 
            onClick={onBack}
            className="text-primary hover:underline"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  if (!track) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">No track data available</p>
      </div>
    );
  }

  // Render the appropriate edit component based on content type
  if (contentType === 'article') {
    return (
      <ArticleDetailEdit
        track={track}
        onBack={onBack}
        onUpdate={handleUpdate}
        isSuperAdminAuthenticated={isSuperAdminAuthenticated}
        isNewContent={true}
      />
    );
  } else {
    return (
      <TrackDetailEdit
        track={track}
        onBack={onBack}
        onUpdate={handleUpdate}
        isSuperAdminAuthenticated={isSuperAdminAuthenticated}
        isNewContent={true}
      />
    );
  }
}
