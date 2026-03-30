import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Zap, Check, X, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import * as crud from '../lib/crud';
import * as tagsCrud from '../lib/crud/tags';

interface AISuggestion {
  id: string;
  track_id: string;
  suggested_tag_name: string;
  suggested_parent_category: string;
  suggested_description?: string;  // Contextual description for what content belongs in this tag
  reasoning: string;  // Justification for why the tag is needed
  confidence: number;
  status: 'pending' | 'accepted' | 'rejected' | 'auto_created';
  created_at: string;
  track?: {
    title: string;
    type: string;
  };
}

interface AIReviewProps {
  onBack?: () => void;
}

export function AIReview({ onBack }: AIReviewProps) {
  const { t } = useTranslation();
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchSuggestions();
  }, []);

  const fetchSuggestions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('ai_tag_suggestions')
        .select(`
          *,
          track:track_id (
            title,
            type
          )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSuggestions(data || []);
    } catch (err: any) {
      console.error('Error fetching suggestions:', err);
      toast.error(t('contentAuthoring.failedLoadSuggestions'));
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (suggestion: AISuggestion) => {
    try {
      setProcessingId(suggestion.id);

      // 1. Get track current tags from junction table (source of truth)
      const currentTags = await tagsCrud.getTrackTagNames(suggestion.track_id);

      if (!currentTags.includes(suggestion.suggested_tag_name)) {
        // 2. Add the new tag using assignTrackTagsByName (writes to junction + syncs legacy column)
        const newTags = [...currentTags, suggestion.suggested_tag_name];
        await tagsCrud.assignTrackTagsByName(suggestion.track_id, newTags, true);
      }

      // 3. Mark suggestion as accepted
      const { error: suggestionError } = await supabase
        .from('ai_tag_suggestions')
        .update({
          status: 'accepted',
          reviewed_at: new Date().toISOString()
        })
        .eq('id', suggestion.id);

      if (suggestionError) throw suggestionError;

      setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
      toast.success(`Tag "${suggestion.suggested_tag_name}" added to track`);
    } catch (err: any) {
      console.error('Error accepting suggestion:', err);
      toast.error(t('contentAuthoring.failedAcceptSuggestion'));
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (suggestion: AISuggestion) => {
    try {
      setProcessingId(suggestion.id);
      const { error } = await supabase
        .from('ai_tag_suggestions')
        .update({ 
          status: 'rejected',
          reviewed_at: new Date().toISOString()
        })
        .eq('id', suggestion.id);

      if (error) throw error;

      setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
      toast.success(t('contentAuthoring.suggestionRejected'));
    } catch (err: any) {
      console.error('Error rejecting suggestion:', err);
      toast.error(t('contentAuthoring.failedRejectSuggestion'));
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="text-muted-foreground">{t('contentAuthoring.loadingAiRecommendations')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t('contentAuthoring.backToTags')}
            </Button>
          )}
          <div>
            <h1 className="text-3xl">{t('contentAuthoring.aiReviewTitle')}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t('contentAuthoring.aiReviewSubtitle')}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchSuggestions}>
            {t('contentAuthoring.refresh')}
          </Button>
        </div>
      </div>

      {suggestions.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <div className="flex flex-col items-center gap-2">
                  <Zap className="h-12 w-12 text-muted-foreground/50 fill-current" />
                  <h3 className="font-semibold">{t('contentAuthoring.allCaughtUp')}</h3>
              <p className="text-sm text-muted-foreground">
                {t('contentAuthoring.noPendingAiSuggestions')}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('contentAuthoring.colContent')}</TableHead>
                <TableHead>{t('contentAuthoring.colSuggestedTag')}</TableHead>
                <TableHead>{t('contentAuthoring.colConfidence')}</TableHead>
                <TableHead>{t('contentAuthoring.colReasoning')}</TableHead>
                <TableHead className="text-right">{t('contentAuthoring.colActions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suggestions.map((sug) => (
                <TableRow key={sug.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{sug.track?.title}</span>
                      <span className="text-xs text-muted-foreground capitalize">{sug.track?.type}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge variant="secondary" className="w-fit">
                        {sug.suggested_tag_name}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        {sug.suggested_parent_category}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${
                            sug.confidence >= 85 ? 'bg-green-500' :
                            sug.confidence >= 70 ? 'bg-yellow-500' : 'bg-gray-400'
                          }`}
                          style={{ width: `${sug.confidence}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium">{sug.confidence}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <p className="text-sm text-muted-foreground line-clamp-2" title={sug.reasoning}>
                      {sug.reasoning}
                    </p>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleReject(sug)}
                        disabled={processingId === sug.id}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-green-600 hover:text-green-700 hover:bg-green-50"
                        onClick={() => handleAccept(sug)}
                        disabled={processingId === sug.id}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

