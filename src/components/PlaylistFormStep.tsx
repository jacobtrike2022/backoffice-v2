/**
 * PlaylistFormStep — Shown after all tracks in a playlist are complete
 * when the playlist has a required_form_id with mode 'required' or 'required_before_completion'.
 *
 * Loads the form via getFormById, renders it using FormRenderer, and on submit
 * saves the submission with playlist context then calls onComplete.
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import {
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ClipboardCheck,
} from 'lucide-react';
import { FormRenderer, type FormBlockData, type ScoringResult } from './forms/shared/FormRenderer';
import { getFormById, submitFormResponse } from '../lib/crud/forms';
import { updateAssignmentProgress } from '../lib/crud/progressCalculations';
import { toast } from 'sonner';

interface PlaylistFormStepProps {
  /** The playlist ID (for metadata on the submission) */
  playlistId: string;
  /** The required form ID to load and render */
  formId: string;
  /** Title of the form (optional, for display before loading) */
  formTitle?: string;
  /** The completion mode — determines messaging */
  mode: 'required' | 'required_before_completion';
  /** Current user ID for the submission */
  userId: string;
  /** Assignment ID if applicable — triggers progress recalculation on submit */
  assignmentId?: string;
  /** Called after the form is successfully submitted */
  onComplete: () => void;
  /** Called if the user wants to skip (only if mode is 'required', not 'required_before_completion') */
  onSkip?: () => void;
}

export function PlaylistFormStep({
  playlistId,
  formId,
  formTitle,
  mode,
  userId,
  assignmentId,
  onComplete,
  onSkip,
}: PlaylistFormStepProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    title: string;
    description?: string;
    blocks: FormBlockData[];
    settings?: { scoring_enabled?: boolean; pass_threshold?: number };
  } | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadForm();
  }, [formId]);

  async function loadForm() {
    try {
      setLoading(true);
      setError(null);

      const form = await getFormById(formId);
      if (!form) {
        setError('Form not found');
        return;
      }

      setFormData({
        title: form.title,
        description: form.description,
        blocks: (form.form_blocks || []) as FormBlockData[],
        settings: form.settings,
      });
    } catch (err) {
      console.error('Error loading playlist form:', err);
      setError(err instanceof Error ? err.message : 'Failed to load form');
    } finally {
      setLoading(false);
    }
  }

  async function handleFormSubmit(answers: Record<string, unknown>, scoring?: ScoringResult) {
    if (submitting) return;
    setSubmitting(true);

    try {
      // Submit with playlist context in the response data
      const responseWithContext = {
        ...answers,
        _playlist_id: playlistId,
        _submitted_via: 'playlist_completion',
      };

      await submitFormResponse(
        formId,
        responseWithContext,
        userId,
        scoring ? {
          score_percentage: scoring.score_percentage,
          passed: scoring.passed,
          total_score: scoring.earned_weight,
          max_possible_score: scoring.total_weight,
        } : undefined
      );

      // If we have an assignment, recalculate its progress (now form is done, it may mark complete)
      if (assignmentId) {
        try {
          await updateAssignmentProgress(assignmentId);
        } catch (progressErr) {
          console.error('Error recalculating assignment progress after form submission:', progressErr);
        }
      }

      setSubmitted(true);
      toast.success(t('playlists.formSubmittedSuccess', 'Form submitted successfully'));

      // Brief delay so the user sees the success state
      setTimeout(() => {
        onComplete();
      }, 1500);
    } catch (err) {
      console.error('Error submitting playlist form:', err);
      toast.error(t('playlists.formSubmitFailed', 'Failed to submit form. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  }

  // Success state
  if (submitted) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="p-12 text-center">
          <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">
            {t('playlists.formCompleted', 'Form Completed')}
          </h2>
          <p className="text-muted-foreground">
            {t('playlists.playlistNowComplete', 'Your playlist is now marked as complete. Great work!')}
          </p>
        </CardContent>
      </Card>
    );
  }

  // Loading state
  if (loading) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="p-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">
            {t('playlists.loadingForm', 'Loading required form...')}
          </p>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="p-12 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="font-semibold mb-2">
            {t('playlists.formLoadError', 'Could not load form')}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Button variant="outline" onClick={loadForm}>
            {t('common.retry', 'Retry')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!formData) return null;

  const canSkip = mode === 'required' && onSkip;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header banner */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <ClipboardCheck className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold mb-1">
                {t('playlists.completeRequiredForm', 'Complete Required Form')}
              </h2>
              <p className="text-sm text-muted-foreground">
                {mode === 'required_before_completion'
                  ? t(
                      'playlists.formRequiredBeforeCompletion',
                      'This playlist requires you to complete the following form before it can be marked as done.'
                    )
                  : t(
                      'playlists.formRequiredForCompletion',
                      'Please complete the following form to finalize this playlist.'
                    )}
              </p>
              <Badge variant="secondary" className="mt-2 gap-1">
                <FileText className="h-3 w-3" />
                {mode === 'required_before_completion'
                  ? t('playlists.blocksCompletion', 'Blocks completion')
                  : t('playlists.required', 'Required')}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Form card */}
      <Card>
        <CardHeader>
          <CardTitle>{formData.title}</CardTitle>
          {formData.description && (
            <CardDescription>{formData.description}</CardDescription>
          )}
        </CardHeader>
        <Separator />
        <CardContent className="pt-6">
          <FormRenderer
            blocks={formData.blocks}
            formId={formId}
            onSubmit={handleFormSubmit}
            scoringEnabled={formData.settings?.scoring_enabled}
            passThreshold={formData.settings?.pass_threshold}
          />
        </CardContent>
      </Card>

      {/* Skip option for 'required' mode (not 'required_before_completion') */}
      {canSkip && (
        <div className="text-center">
          <Button variant="ghost" onClick={onSkip} className="text-muted-foreground">
            {t('playlists.skipFormForNow', 'Skip for now')}
          </Button>
          <p className="text-xs text-muted-foreground mt-1">
            {t(
              'playlists.skipFormNote',
              'You can complete this form later, but the playlist will remain incomplete until it is submitted.'
            )}
          </p>
        </div>
      )}

      {/* Submitting overlay */}
      {submitting && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span>{t('playlists.submittingForm', 'Submitting form...')}</span>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
