import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Slide {
  id: string;
  name: string;
  type: 'image' | 'video';
  url: string;
  order: number;
  duration?: number;
}

interface StoryPreviewProps {
  slides: Slide[];
}

export function StoryPreview({ slides }: StoryPreviewProps) {
  const { t } = useTranslation();
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  const nextSlide = () => {
    setCurrentSlideIndex((prev) => (prev + 1) % slides.length);
  };

  const prevSlide = () => {
    setCurrentSlideIndex((prev) => (prev - 1 + slides.length) % slides.length);
  };

  if (slides.length === 0) {
    return (
      <div className="aspect-[9/16] rounded-lg bg-accent/50 flex items-center justify-center border-2 border-dashed border-border">
        <p className="text-sm text-muted-foreground">No slides in this story</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Main Preview Display */}
      <div className="relative aspect-[9/16] rounded-lg overflow-hidden bg-black">
        {slides[currentSlideIndex]?.url && (
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
                  <div className="w-0 h-0 border-l-[6px] border-l-white border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent" />
                </div>
              )
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}
