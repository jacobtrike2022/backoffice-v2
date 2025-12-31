import React, { useState } from 'react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Check, Zap, Plus, Lightbulb, X, Info, ThumbsUp, ThumbsDown } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';

interface TagRecommendation {
  tag_id: string;
  tag_name: string;
  tag_color: string | null;
  parent_category: string;
  confidence: number;
  reasoning: string;
  auto_select: boolean;
}

interface NewTagSuggestion {
  suggested_name: string;
  suggested_parent: string;
  reasoning: string;
}

interface TagRecommendationPanelProps {
  recommendations: TagRecommendation[];
  newTagSuggestions: NewTagSuggestion[];
  analysisSummary: string;
  selectedTags: string[];
  onToggleTag: (tagName: string) => void;
  onCreateNewTag: (suggestion: NewTagSuggestion) => void;
  onDismiss: () => void;
  onFeedback?: (tagName: string, feedback: 'positive' | 'negative') => void;
  isLoading?: boolean;
}

export function TagRecommendationPanel({
  recommendations,
  newTagSuggestions,
  analysisSummary,
  selectedTags,
  onToggleTag,
  onCreateNewTag,
  onDismiss,
  onFeedback,
  isLoading = false,
}: TagRecommendationPanelProps) {
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, 'positive' | 'negative'>>({});

  const handleFeedback = (e: React.MouseEvent, tagName: string, feedback: 'positive' | 'negative') => {
    e.stopPropagation();
    if (feedbackGiven[tagName]) return;
    
    setFeedbackGiven(prev => ({ ...prev, [tagName]: feedback }));
    if (onFeedback) onFeedback(tagName, feedback);
  };
  
  const getConfidenceBadgeStyle = (confidence: number) => {
    if (confidence >= 85) {
      return 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700';
    } else if (confidence >= 70) {
      return 'bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700';
    } else {
      return 'bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600';
    }
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 85) return 'High';
    if (confidence >= 70) return 'Medium';
    return 'Low';
  };

  // Group recommendations by parent category
  const groupedRecommendations = recommendations.reduce((acc, rec) => {
    const category = rec.parent_category;
    if (!acc[category]) acc[category] = [];
    acc[category].push(rec);
    return acc;
  }, {} as Record<string, TagRecommendation[]>);

  if (isLoading) {
    return (
      <div className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 border border-orange-200 dark:border-orange-800 rounded-lg p-6">
        <div className="flex items-center justify-center gap-3">
          <div className="relative">
            <Zap className="h-5 w-5 text-orange-500 animate-pulse fill-current" />
            <div className="absolute inset-0 animate-ping">
              <Zap className="h-5 w-5 text-orange-500 opacity-30 fill-current" />
            </div>
          </div>
          <span className="text-sm font-medium text-orange-700 dark:text-orange-300">
            Analyzing content and finding relevant tags...
          </span>
        </div>
      </div>
    );
  }

  if (recommendations.length === 0 && newTagSuggestions.length === 0) {
    return (
      <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <Info className="h-4 w-4" />
            <span className="text-sm">No strong tag matches found. Try adding more content or select tags manually.</span>
          </div>
          <Button variant="ghost" size="sm" onClick={onDismiss}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-orange-500 fill-current" />
          <h4 className="font-semibold text-orange-900 dark:text-orange-100">
            AI Tag Suggestions
          </h4>
          <Badge variant="outline" className="text-xs bg-white dark:bg-gray-800">
            {recommendations.length} found
          </Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={onDismiss} className="h-8 w-8 p-0">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Analysis Summary */}
      {analysisSummary && (
        <p className="text-sm text-orange-800 dark:text-orange-200 bg-white/50 dark:bg-black/20 rounded px-3 py-2">
          {analysisSummary}
        </p>
      )}

      {/* Recommendations grouped by category */}
      <div className="space-y-3">
        {Object.entries(groupedRecommendations).map(([category, categoryRecs]) => (
          <div key={category} className="space-y-2">
            <div className="text-xs font-medium text-orange-700 dark:text-orange-300 uppercase tracking-wide">
              {category}
            </div>
            <div className="flex flex-wrap gap-2">
              <TooltipProvider>
                {categoryRecs.map((rec) => {
                  const isSelected = selectedTags.includes(rec.tag_name);
                  const tagColor = rec.tag_color || '#F74A05';
                  
                  return (
                    <Tooltip key={rec.tag_id}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => onToggleTag(rec.tag_name)}
                          className={`
                            group relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full 
                            cursor-pointer border transition-all duration-200
                            ${isSelected 
                              ? 'border-transparent text-white shadow-md scale-105' 
                              : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border-gray-200 dark:border-gray-600'
                            }
                          `}
                          style={isSelected ? {
                            background: `linear-gradient(135deg, ${tagColor} 0%, ${tagColor}dd 100%)`,
                          } : undefined}
                        >
                          {isSelected && <Check className="h-3.5 w-3.5" />}
                          <span className="text-sm font-medium">{rec.tag_name}</span>
                          <Badge 
                            variant="outline" 
                            className={`text-xs ml-1 ${getConfidenceBadgeStyle(rec.confidence)}`}
                          >
                            {rec.confidence}%
                          </Badge>
                          {rec.auto_select && !isSelected && (
                            <span className="absolute -top-1 -right-1 h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                          )}
                          
                          {/* Feedback buttons (visible on hover or if feedback given) */}
                          <div className={`
                            flex items-center gap-0.5 ml-1 border-l pl-1
                            ${feedbackGiven[rec.tag_name] ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 transition-opacity'}
                          `}>
                            <button
                              onClick={(e) => handleFeedback(e, rec.tag_name, 'positive')}
                              className={`p-0.5 rounded hover:bg-black/10 ${feedbackGiven[rec.tag_name] === 'positive' ? 'text-green-600' : ''}`}
                              title="Helpful"
                            >
                              <ThumbsUp className="h-3 w-3" />
                            </button>
                            <button
                              onClick={(e) => handleFeedback(e, rec.tag_name, 'negative')}
                              className={`p-0.5 rounded hover:bg-black/10 ${feedbackGiven[rec.tag_name] === 'negative' ? 'text-red-600' : ''}`}
                              title="Not relevant"
                            >
                              <ThumbsDown className="h-3 w-3" />
                            </button>
                          </div>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium ${
                              rec.confidence >= 85 ? 'text-green-600' :
                              rec.confidence >= 70 ? 'text-yellow-600' : 'text-gray-600'
                            }`}>
                              {getConfidenceLabel(rec.confidence)} confidence
                            </span>
                          </div>
                          <p className="text-sm">{rec.reasoning}</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </TooltipProvider>
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-orange-700 dark:text-orange-300 pt-2 border-t border-orange-200 dark:border-orange-700">
        <div className="flex items-center gap-1">
          <span className="h-2 w-2 bg-green-500 rounded-full" />
          <span>Auto-suggested (85%+)</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="h-2 w-2 bg-yellow-500 rounded-full" />
          <span>Likely match (70-84%)</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="h-2 w-2 bg-gray-400 rounded-full" />
          <span>Possible (50-69%)</span>
        </div>
      </div>

      {/* New Tag Suggestions */}
      {newTagSuggestions.length > 0 && (
        <div className="pt-3 border-t border-orange-200 dark:border-orange-700 space-y-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-purple-500" />
            <span className="text-sm font-medium text-purple-800 dark:text-purple-200">
              Suggested New Tags
            </span>
          </div>
          <div className="space-y-2">
            {newTagSuggestions.map((suggestion, index) => (
              <div 
                key={index}
                className="flex items-start justify-between gap-3 p-3 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-purple-900 dark:text-purple-100">
                      "{suggestion.suggested_name}"
                    </span>
                    <Badge variant="outline" className="text-xs bg-purple-100 dark:bg-purple-900 border-purple-300">
                      → {suggestion.suggested_parent}
                    </Badge>
                  </div>
                  <p className="text-xs text-purple-700 dark:text-purple-300 mt-1">
                    {suggestion.reasoning}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 border-purple-300 text-purple-700 hover:bg-purple-100 dark:border-purple-700 dark:text-purple-300 dark:hover:bg-purple-900"
                  onClick={() => onCreateNewTag(suggestion)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Create
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

