// =============================================================================
// LEGACY KNOWLEDGE BASE (CATEGORY-BASED) - NOT USED BY CURRENT APP ROUTING
// -----------------------------------------------------------------------------
// This component was an intermediate KB implementation that relies on
// `useKBCategories` and `useKBCategoryTracks` for category/track views.
// It is not imported by `App.tsx` and is kept only as a reference.
//
// Current, production KB implementation:
// - Internal KB UI: `KnowledgeBaseRevamp` (used in `App.tsx`)
// - Public KB UI: `PublicKBViewer` + Supabase edge function `kb.ts`
//
// New development should extend `KnowledgeBaseRevamp` rather than this file.
// =============================================================================

import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Skeleton } from './ui/skeleton';
import { 
  BookOpen,
  Search,
  ChevronRight,
  Clock,
  Eye,
  Briefcase,
  Users,
  Utensils,
  Home,
  Shield,
  RefreshCw,
  User,
  Video,
  FileText,
  BookMarked
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { useKBCategoryTracks, useKBCategories, useCurrentUser } from '../lib/hooks/useSupabase';
import * as crud from '../lib/crud';

interface KnowledgeBaseProps {
  onTrackClick?: (trackId: string) => void;
  onNavigateToAssignment?: () => void;
  onEditTrack?: (track: any) => void;
  currentRole?: string;
}

// Category icon mapping
const CATEGORY_ICONS: Record<string, React.ComponentType<any>> = {
  'operations': Briefcase,
  'hr': Users,
  'food': Utensils,
  'manager': Shield,
  'store': Home,
  'default': BookOpen
};

// Category color mapping
const CATEGORY_COLORS: Record<string, string> = {
  'operations': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  'hr': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  'food': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  'manager': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  'store': 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  'default': 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300'
};

// Track type icons
const TRACK_TYPE_ICONS: Record<string, React.ComponentType<any>> = {
  'article': FileText,
  'video': Video,
  'story': BookMarked
};

export function KnowledgeBaseConverted({ onTrackClick, onNavigateToAssignment, onEditTrack, currentRole }: KnowledgeBaseProps) {
  const { t } = useTranslation();
  const { user, loading: userLoading } = useCurrentUser();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Fetch categories with track counts
  const { categories, loading: categoriesLoading, error: categoriesError, refetch: refetchCategories } = useKBCategories();

  // Fetch tracks for selected category
  const { tracks: categoryTracks, loading: tracksLoading, error: tracksError, refetch: refetchTracks } = useKBCategoryTracks(
    selectedCategory,
    { search: debouncedSearch }
  );

  // Debounce search
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Get all tracks across all categories for "Recently Updated" and "Most Viewed"
  // For now, we'll use the selected category tracks
  const allTracks = useMemo(() => {
    return categoryTracks.map((assignment: any) => assignment.track).filter(Boolean);
  }, [categoryTracks]);

  // Get recently updated tracks (top 4)
  const recentlyUpdated = useMemo(() => {
    return [...allTracks]
      .sort((a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime())
      .slice(0, 4);
  }, [allTracks]);

  // Get most viewed tracks (top 4) - we'll use a placeholder for now
  const mostViewed = useMemo(() => {
    return allTracks.slice(0, 4);
  }, [allTracks]);

  const handleTrackClick = async (trackId: string) => {
    try {
      // Record KB track view
      if (selectedCategory) {
        await crud.recordKBTrackView(trackId, selectedCategory);
      }
      
      // Call parent callback if provided
      if (onTrackClick) {
        onTrackClick(trackId);
      } else {
        toast.success(t('knowledgeBase.openingContent'));
      }

      // Refetch to update view counts
      refetchTracks();
    } catch (error: any) {
      console.error('Error opening track:', error);
      toast.error(t('knowledgeBase.failedOpenContent'));
    }
  };

  const handleCategoryClick = (categoryId: string) => {
    if (selectedCategory === categoryId) {
      setSelectedCategory(null); // Deselect if clicking the same category
    } else {
      setSelectedCategory(categoryId);
      // Scroll to All Content section
      document.getElementById('all-content')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const getCategoryIcon = (categoryName: string) => {
    const name = categoryName?.toLowerCase() || '';
    if (name.includes('operation')) return CATEGORY_ICONS.operations;
    if (name.includes('hr') || name.includes('polic')) return CATEGORY_ICONS.hr;
    if (name.includes('food') || name.includes('safety')) return CATEGORY_ICONS.food;
    if (name.includes('manager')) return CATEGORY_ICONS.manager;
    if (name.includes('store') || name.includes('procedure')) return CATEGORY_ICONS.store;
    return CATEGORY_ICONS.default;
  };

  const getCategoryColor = (categoryName: string) => {
    const name = categoryName?.toLowerCase() || '';
    if (name.includes('operation')) return CATEGORY_COLORS.operations;
    if (name.includes('hr') || name.includes('polic')) return CATEGORY_COLORS.hr;
    if (name.includes('food') || name.includes('safety')) return CATEGORY_COLORS.food;
    if (name.includes('manager')) return CATEGORY_COLORS.manager;
    if (name.includes('store') || name.includes('procedure')) return CATEGORY_COLORS.store;
    return CATEGORY_COLORS.default;
  };

  const getTrackBadge = (displayType?: string, tags?: string[]) => {
    // Check display_type from KB assignment
    if (displayType === 'required') {
      return <Badge variant="destructive" className="text-xs">{t('knowledgeBase.badgeRequired')}</Badge>;
    }
    if (displayType === 'manager-only') {
      return <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-xs">{t('knowledgeBase.badgeManagerOnly')}</Badge>;
    }

    // Fallback to checking tags
    if (!tags || tags.length === 0) return null;

    const tagStrings = tags.map(tag => typeof tag === 'string' ? tag : (tag as any).name || '').filter(Boolean);

    if (tagStrings.some(tag => tag.toLowerCase().includes('required'))) {
      return <Badge variant="destructive" className="text-xs">{t('knowledgeBase.badgeRequired')}</Badge>;
    }
    if (tagStrings.some(tag => tag.toLowerCase().includes('manager'))) {
      return <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-xs">{t('knowledgeBase.badgeManagerOnly')}</Badge>;
    }
    return null;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Loading state
  if (userLoading || categoriesLoading || tracksLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  // Error state
  if (categoriesError || tracksError) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-destructive mb-4">{t('knowledgeBase.failedLoadKB')}</p>
          <Button onClick={() => refetchCategories()} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('knowledgeBase.tryAgain')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white border-none">
        <CardContent className="p-8">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-3xl mb-2">{t('knowledgeBase.title')}</h1>
              <p className="text-white/90 text-lg mb-6 max-w-2xl">
                {t('knowledgeBase.heroSubtitle')}
              </p>
              <div className="flex gap-8 text-sm">
                <div>
                  <div className="text-2xl">{categoryTracks?.length || 0}</div>
                  <div className="text-white/80">{t('knowledgeBase.tracks')}</div>
                </div>
                <div>
                  <div className="text-2xl">{categories?.length || 0}</div>
                  <div className="text-white/80">{t('knowledgeBase.categories')}</div>
                </div>
              </div>
            </div>
            <BookOpen className="h-24 w-24 opacity-20" />
          </div>
        </CardContent>
      </Card>

      {/* Search Bar */}
      <Card>
        <CardContent className="p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder={t('knowledgeBase.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 transform -translate-y-1/2"
                onClick={() => setSearchQuery('')}
              >
                {t('common.clearAll')}
              </Button>
            )}
          </div>
          {debouncedSearch && (
            <p className="text-sm text-muted-foreground mt-2">
              {t('knowledgeBase.searchResultsCount', { count: categoryTracks.length })}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Browse by Category */}
      <div>
        <h2 className="text-xl mb-4">{t('knowledgeBase.browseByCategory')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories && categories.length > 0 ? (
            categories.map((category) => {
              const Icon = getCategoryIcon(category.name);
              const isActive = selectedCategory === category.id;
              
              return (
                <Card 
                  key={category.id}
                  className={`cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] ${
                    isActive ? 'ring-2 ring-orange-500' : ''
                  }`}
                  onClick={() => handleCategoryClick(category.id)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-full ${getCategoryColor(category.name)} flex items-center justify-center flex-shrink-0`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold mb-1">{category.name}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                          {category.description || t('knowledgeBase.noDescription')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t('knowledgeBase.trackCount', { count: category.trackCount || 0 })}
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              {t('knowledgeBase.noCategoriesFound')}
            </div>
          )}
        </div>
      </div>

      {/* Recently Updated / Most Viewed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recently Updated */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              {t('knowledgeBase.recentlyUpdated')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentlyUpdated.length > 0 ? (
              recentlyUpdated.map((track) => (
                <div
                  key={track.id}
                  className="p-3 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                  onClick={() => handleTrackClick(track.id)}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h4 className="font-medium line-clamp-1 flex-1">{track.title}</h4>
                    {getTrackBadge(track.display_type, track.tags || [])}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{formatDate(track.updated_at)}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {track.view_count || 0}
                    </span>
                    {track.created_by && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {typeof track.created_by === 'object' ? track.created_by.name : track.created_by}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                {t('knowledgeBase.noTracksYet')}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Most Viewed */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              {t('knowledgeBase.mostViewed')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {mostViewed.length > 0 ? (
              mostViewed.map((track) => (
                <div
                  key={track.id}
                  className="p-3 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                  onClick={() => handleTrackClick(track.id)}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h4 className="font-medium line-clamp-1 flex-1">{track.title}</h4>
                    {getTrackBadge(track.display_type, track.tags || [])}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{formatDate(track.updated_at)}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {track.view_count || 0}
                    </span>
                    {track.created_by && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {typeof track.created_by === 'object' ? track.created_by.name : track.created_by}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                {t('knowledgeBase.noTracksYet')}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* All Content */}
      <Card id="all-content">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t('knowledgeBase.allContent')}</CardTitle>
            <div className="text-sm text-muted-foreground">
              {t('knowledgeBase.trackCount', { count: categoryTracks.length })}
              {selectedCategory && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedCategory(null)}
                  className="ml-2"
                >
                  {t('knowledgeBase.clearFilter')}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {categoryTracks.length > 0 ? (
              categoryTracks.map((assignment) => {
                const track = assignment.track;
                const Icon = getCategoryIcon(track.category?.name || '');
                const TrackIcon = TRACK_TYPE_ICONS[track.type || 'article'];
                
                return (
                  <div
                    key={track.id}
                    className="p-4 rounded-lg border hover:bg-muted cursor-pointer transition-colors group"
                    onClick={() => handleTrackClick(track.id)}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-lg ${getCategoryColor(track.category?.name || '')} flex items-center justify-center flex-shrink-0`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h3 className="font-semibold group-hover:text-orange-600 transition-colors">
                            {track.title}
                          </h3>
                          {getTrackBadge(track.display_type, track.tags || [])}
                        </div>
                        
                        {track.excerpt && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                            {track.excerpt}
                          </p>
                        )}
                        
                        <div className="flex items-center flex-wrap gap-3 text-xs text-muted-foreground">
                          {track.category?.name && (
                            <Badge variant="outline" className="text-xs">
                              {track.category.name}
                            </Badge>
                          )}
                          {track.tags && track.tags.length > 0 && (
                            track.tags.slice(0, 3).map((tag: any, idx: number) => (
                              <Badge key={idx} className="bg-orange-100 text-orange-700 border-orange-200 text-xs">
                                {typeof tag === 'string' ? tag : tag.name || 'Tag'}
                              </Badge>
                            ))
                          )}
                          <span className="flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            {track.view_count || 0}
                          </span>
                          <span>{formatDate(track.updated_at)}</span>
                          <TrackIcon className="h-4 w-4" />
                        </div>
                      </div>
                      
                      <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 group-hover:text-orange-600 transition-colors" />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12">
                <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="font-medium mb-2">
                  {debouncedSearch ? t('knowledgeBase.noContentMatchesSearch') : t('knowledgeBase.noContentFound')}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {debouncedSearch
                    ? t('knowledgeBase.tryDifferentKeywords')
                    : t('knowledgeBase.createFirstTrack')}
                </p>
                {debouncedSearch && (
                  <Button variant="outline" onClick={() => setSearchQuery('')}>
                    {t('knowledgeBase.clearSearch')}
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}