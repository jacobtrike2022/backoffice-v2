import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Check } from 'lucide-react';
import { cn } from './ui/utils';

interface SmartProfileCardProps {
  title: string;
  matchPercentage: number;
  alternativeTitles: string[];
  isSelected: boolean;
  onPreview: () => void;
  onSelect: () => void;
  showSelectButton?: boolean; // Legacy prop - no longer used
  isApplied?: boolean; // If true, show applied indicator
  showMatchBadge?: boolean; // If false, hides the match badge (used when already applied)
}

export function SmartProfileCard({
  title,
  matchPercentage,
  alternativeTitles,
  isSelected,
  onPreview,
  onSelect,
  showSelectButton = false,
  isApplied = false,
  showMatchBadge = true,
}: SmartProfileCardProps) {
  const { t } = useTranslation();

  const getMatchColor = (percentage: number) => {
    if (percentage >= 80) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    if (percentage >= 60) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400';
  };

  const displayAlternatives = alternativeTitles.slice(0, 3).join(', ');

  return (
    <Card
      className={cn(
        'transition-all hover:shadow-md cursor-pointer',
        isSelected && 'ring-2 ring-[#F64A05] border-[#F64A05]',
        isApplied && 'ring-2 ring-[#F64A05] border-[#F64A05] bg-gradient-to-br from-orange-50/50 to-transparent dark:from-orange-950/20'
      )}
      onClick={(e) => {
        // Clicking the card opens preview (doesn't auto-apply)
        onPreview();
      }}
    >
      <CardContent className="p-4 space-y-2">
        {/* Match Badge row (only when not applied) */}
        {showMatchBadge && !isApplied && (
          <Badge
            className={cn(
              'font-semibold text-xs',
              getMatchColor(matchPercentage)
            )}
          >
            {t('people.smartProfileMatch', { percentage: matchPercentage })}
          </Badge>
        )}

        {/* Title row with Applied indicator right-justified */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-sm leading-tight line-clamp-2">
            {title}
          </h3>
          {isApplied && (
            <div className="flex-shrink-0 w-5 h-5 rounded-full bg-gradient-to-r from-[#F64A05] to-[#FF733C] flex items-center justify-center">
              <Check className="w-3 h-3 text-white" />
            </div>
          )}
        </div>

        {/* Alternative Titles - hidden when applied */}
        {displayAlternatives && !isApplied && (
          <p className="text-xs text-muted-foreground line-clamp-1">
            {t('people.smartProfileAlso')}: {displayAlternatives}
            {alternativeTitles.length > 3 && '...'}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

