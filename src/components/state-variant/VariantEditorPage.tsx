// ============================================================================
// VARIANT EDITOR PAGE
// ============================================================================
// Standalone page for editing a variant draft
// Accessed via URL: ?draftId=xxx or ?track=xxx&variant=xxx
// Provides resilience to page refresh
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, AlertTriangle, ArrowLeft } from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';

import { VariantEditorLayout } from './VariantEditorLayout';
import {
  getDraft,
  getTrackById,
  type VariantDraft
} from '../../lib/crud/trackRelationships';
import { getTrackById as getTrack } from '../../lib/crud/tracks';

interface VariantEditorPageProps {
  draftId?: string;
  onClose: () => void;
  onPublish?: (draft: VariantDraft) => void;
}

export function VariantEditorPage({
  draftId: propDraftId,
  onClose,
  onPublish,
}: VariantEditorPageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<VariantDraft | null>(null);
  const [sourceContent, setSourceContent] = useState<string>('');
  const [contractId, setContractId] = useState<string | undefined>();
  const [extractionId, setExtractionId] = useState<string | undefined>();

  // Get draft ID from props or URL
  const getDraftIdFromUrl = useCallback(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return propDraftId || urlParams.get('draftId') || null;
  }, [propDraftId]);

  // Load draft and source content
  useEffect(() => {
    const loadDraft = async () => {
      const draftId = getDraftIdFromUrl();
      if (!draftId) {
        setError('No draft ID provided');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // Fetch draft
        const draftData = await getDraft(draftId);
        setDraft(draftData);
        setContractId(draftData.contractId);
        setExtractionId(draftData.extractionId);

        // Fetch source track content
        if (draftData.sourceTrackId) {
          try {
            const track = await getTrack(draftData.sourceTrackId);
            if (track) {
              setSourceContent(
                track.content_text || track.transcript || track.description || ''
              );
            }
          } catch (trackError) {
            // Use sourceContent from draft if track fetch fails
            setSourceContent(draftData.sourceContent || '');
          }
        } else {
          setSourceContent(draftData.sourceContent || '');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load draft');
        toast.error('Failed to load draft', { description: err.message });
      } finally {
        setIsLoading(false);
      }
    };

    loadDraft();
  }, [getDraftIdFromUrl]);

  // Handle draft updates
  const handleDraftUpdate = useCallback((updatedDraft: VariantDraft) => {
    setDraft(updatedDraft);
  }, []);

  // Handle publish
  const handlePublish = useCallback(() => {
    if (draft && onPublish) {
      onPublish(draft);
    }
    onClose();
  }, [draft, onPublish, onClose]);

  // Loading state
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading draft...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !draft) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-md px-4">
          <div className="p-4 rounded-full bg-red-500/10 w-fit mx-auto">
            <AlertTriangle className="w-12 h-12 text-red-500" />
          </div>
          <h2 className="text-xl font-semibold">Failed to Load Draft</h2>
          <p className="text-muted-foreground">
            {error || 'The draft could not be found or has been deleted.'}
          </p>
          <Button onClick={onClose} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  // Render editor
  return (
    <VariantEditorLayout
      draft={draft}
      sourceContent={sourceContent}
      onDraftUpdate={handleDraftUpdate}
      onPublish={handlePublish}
      onClose={onClose}
      contractId={contractId}
      extractionId={extractionId}
    />
  );
}

export default VariantEditorPage;
