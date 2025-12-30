import React from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Eye } from 'lucide-react';
import { cn } from './ui/utils';

interface SmartProfileCardProps {
  title: string;
  matchPercentage: number;
  alternativeTitles: string[];
  isSelected: boolean;
  onPreview: () => void;
  onSelect: () => void;
  showSelectButton?: boolean; // If true, show "Select Profile" instead of "Preview"
  isApplied?: boolean; // If true, show gradient orange button to indicate it's applied
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
}: SmartProfileCardProps) {
  const getMatchColor = (percentage: number) => {
    if (percentage >= 80) return 'bg-green-100 text-green-800 border-green-300';
    if (percentage >= 60) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    return 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const displayAlternatives = alternativeTitles.slice(0, 3).join(', ');

  return (
    <Card
      className={cn(
        'transition-all hover:shadow-md cursor-pointer',
        isSelected && 'ring-2 ring-[#F64A05] border-[#F64A05]'
      )}
      onClick={(e) => {
        // Clicking the card opens preview (doesn't auto-apply)
        onPreview();
      }}
    >
      <CardContent className="p-4 space-y-3">
        {/* Match Badge */}
        <div className="flex items-center justify-between">
          <Badge
            className={cn(
              'font-semibold',
              getMatchColor(matchPercentage)
            )}
          >
            {matchPercentage}% Match
          </Badge>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-sm leading-tight line-clamp-2">
          {title}
        </h3>

        {/* Alternative Titles */}
        {displayAlternatives && (
          <p className="text-xs text-muted-foreground line-clamp-1">
            Also: {displayAlternatives}
            {alternativeTitles.length > 3 && '...'}
          </p>
        )}

        {/* Preview/Select Button */}
        {showSelectButton ? (
          <Button
            variant={isApplied ? "default" : "outline"}
            size="sm"
            className={cn(
              "w-full",
              isApplied && "bg-gradient-to-r from-[#F64A05] to-[#FF733C] text-white shadow-sm hover:opacity-90 border-0"
            )}
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
          >
            {isApplied ? (
              <>
                <Eye className="w-3 h-3 mr-1.5" />
                Profile Applied
              </>
            ) : (
              <>
                <Eye className="w-3 h-3 mr-1.5" />
                Select Profile
              </>
            )}
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={(e) => {
              e.stopPropagation();
              onPreview();
            }}
          >
            <Eye className="w-3 h-3 mr-1.5" />
            Preview
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

