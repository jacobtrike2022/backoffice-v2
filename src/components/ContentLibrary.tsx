import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Footer } from './Footer';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Skeleton } from './ui/skeleton';
import { 
  Play, 
  Search, 
  Grid3x3, 
  List, 
  Filter,
  Calendar,
  Clock,
  Tag,
  Users,
  Eye,
  TrendingUp,
  FileText,
  Album as AlbumIcon,
  BookOpen,
  Video,
  X,
  ChevronLeft,
  ArrowUpDown,
  CheckCircle2,
  Lock,
  Edit,
  Save,
  Trash2
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Separator } from './ui/separator';
import { Textarea } from './ui/textarea';
import { TrackDetailEdit } from './TrackDetailEdit';
import { ArticleDetailEdit } from './ArticleDetailEdit';
import { CheckpointEditor } from './content-authoring/CheckpointEditor';
import { StoryEditor } from './content-authoring/StoryEditor';
import { useTracks } from '../lib/hooks/useSupabase';
import * as crud from '../lib/crud';
import { toast } from 'sonner@2.0.3';

interface ContentLibraryProps {
  currentRole?: 'admin' | 'district-manager' | 'store-manager' | 'trike-super-admin';
  isSuperAdminAuthenticated?: boolean;
}

// Calculate reading time based on word count (200 words per minute)
const calculateReadingTime = (htmlContent: string): number => {
  if (!htmlContent) return 0;
  
  // Strip HTML tags and get plain text
  const plainText = htmlContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  
  // Count words
  const wordCount = plainText.split(/\s+/).filter(word => word.length > 0).length;
  
  // Calculate reading time (200 words per minute)
  const readingTime = Math.ceil(wordCount / 200);
  
  return readingTime || 1; // Minimum 1 minute
};

export function ContentLibrary({ currentRole = 'admin', isSuperAdminAuthenticated = false }: ContentLibraryProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedTrack, setSelectedTrack] = useState<any | null>(null);
  const [sortBy, setSortBy] = useState<'recent' | 'title' | 'views'>('recent');
  
  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editFormData, setEditFormData] = useState<any>({});

  // Fetch tracks from Supabase
  const { tracks, loading, error, refetch } = useTracks({
    status: 'published',
    type: selectedType !== 'all' ? selectedType as any : undefined,
    search: searchQuery || undefined
  });

  // Debug logging
  console.log('ContentLibrary - tracks:', tracks);
  console.log('ContentLibrary - loading:', loading);
  console.log('ContentLibrary - error:', error);

  const handleViewTrack = async (track: any) => {
    console.log('Viewing track:', track);
    
    // Fetch fresh track data instead of using cached list data
    try {
      const freshTrack = await crud.getTrackById(track.id);
      setSelectedTrack(freshTrack);
      console.log('Loaded fresh track data:', freshTrack);
    } catch (error) {
      console.error('Failed to load track:', error);
      // Fallback to cached data if fetch fails
      setSelectedTrack(track);
    }
    
    // Try to increment view count in the background (non-blocking)
    try {
      await crud.incrementTrackViews(track.id);
    } catch (error) {
      // Silently fail - don't prevent the page from opening
      console.warn('Failed to increment view count:', error);
    }
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

  // Sort tracks
  const sortedTracks = [...(tracks || [])].sort((a, b) => {
    if (sortBy === 'title') return a.title.localeCompare(b.title);
    if (sortBy === 'views') return (b.view_count || 0) - (a.view_count || 0);
    return new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime();
  });

  // Loading state - only show skeleton on initial load, not on refetch
  if (loading && (!tracks || tracks.length === 0)) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-80" />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-8 bg-red-50 border border-red-200 rounded-lg">
        <h2 className="text-xl font-semibold text-red-700 mb-2">Error Loading Content</h2>
        <p className="text-red-600 mb-4">{error.message}</p>
        <Button onClick={() => refetch()}>Retry</Button>
      </div>
    );
  }

  // Detail view for selected track
  if (selectedTrack) {
    const handleUpdate = async () => {
      console.log('ContentLibrary - handleUpdate called, fetching updated track...');
      // Just refetch the selected track data to show updated values
      // Don't call refetch() as it triggers loading state and hides the detail view
      const updatedTrack = await crud.getTrackById(selectedTrack.id);
      setSelectedTrack(updatedTrack);
      console.log('ContentLibrary - updated track:', updatedTrack);
    };

    const handleBack = async () => {
      console.log('ContentLibrary - Back clicked, refetching list...');
      // Wait for refetch to complete before clearing selected track
      await refetch();
      console.log('ContentLibrary - Refetch complete, clearing selected track');
      setSelectedTrack(null);
    };

    return (
      <>
        {selectedTrack.type === 'article' ? (
          <ArticleDetailEdit
            track={selectedTrack}
            onBack={handleBack}
            onUpdate={handleUpdate}
            isSuperAdminAuthenticated={isSuperAdminAuthenticated}
          />
        ) : selectedTrack.type === 'checkpoint' ? (
          <CheckpointEditor
            track={selectedTrack}
            onBack={handleBack}
            onUpdate={handleUpdate}
            isSuperAdminAuthenticated={isSuperAdminAuthenticated}
          />
        ) : selectedTrack.type === 'story' ? (
          <StoryEditor
            track={selectedTrack}
            onBack={handleBack}
            onUpdate={handleUpdate}
            isSuperAdminAuthenticated={isSuperAdminAuthenticated}
          />
        ) : (
          <TrackDetailEdit
            track={selectedTrack}
            onBack={handleBack}
            onUpdate={handleUpdate}
            isSuperAdminAuthenticated={isSuperAdminAuthenticated}
          />
        )}
        <Footer />
      </>
    );
  }

  // Main library view
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground">Content Library</h1>
          <p className="text-muted-foreground mt-1">
            Browse and explore all published training content
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            <Grid3x3 className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filters & Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tracks by title, description, or tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Type Filter */}
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="video">
                  <div className="flex items-center gap-2">
                    <Video className="h-4 w-4" />
                    Videos
                  </div>
                </SelectItem>
                <SelectItem value="article">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Articles
                  </div>
                </SelectItem>
                <SelectItem value="story">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    Stories
                  </div>
                </SelectItem>
                <SelectItem value="checkpoint">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Checkpoints
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Sort */}
            <Select value={sortBy} onValueChange={(val: any) => setSortBy(val)}>
              <SelectTrigger className="w-full sm:w-48">
                <ArrowUpDown className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Most Recent</SelectItem>
                <SelectItem value="title">Title (A-Z)</SelectItem>
                <SelectItem value="views">Most Viewed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results Count */}
      <div className="text-sm text-muted-foreground">
        {sortedTracks.length} {sortedTracks.length === 1 ? 'track' : 'tracks'} found
      </div>

      {/* Track Grid/List */}
      {sortedTracks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="flex flex-col items-center gap-2">
              <FileText className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="font-semibold">No tracks found</h3>
              <p className="text-sm text-muted-foreground">
                Try adjusting your search or filters
              </p>
            </div>
          </CardContent>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedTracks.map((track) => (
            <Card
              key={track.id}
              className="cursor-pointer hover:shadow-lg transition-shadow group"
              onClick={() => handleViewTrack(track)}
            >
              <CardContent className="p-0">
                {/* Thumbnail */}
                <div className="relative aspect-video bg-muted overflow-hidden">
                  {track.thumbnail_url ? (
                    <img
                      src={track.thumbnail_url}
                      alt={track.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-100 to-orange-50">
                      <div className="text-primary opacity-20">
                        {getTypeIcon(track.type)}
                      </div>
                    </div>
                  )}
                  <div className="absolute top-2 right-2">
                    <Badge className={getTypeBadgeColor(track.type)}>
                      {getTypeIcon(track.type)}
                      <span className="ml-1 capitalize">{track.type}</span>
                    </Badge>
                  </div>
                  {/* Duration/Reading Time Badge */}
                  {(track.duration_minutes || (track.type === 'article' && track.transcript)) && (
                    <div className="absolute bottom-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
                      {track.type === 'article' 
                        ? calculateReadingTime(track.transcript || '')
                        : track.duration_minutes
                      } min
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold line-clamp-2 flex-1">{track.title}</h3>
                    {track.is_system_content && (
                      <Badge className="bg-amber-100 text-amber-800 border-amber-200 flex-shrink-0">
                        <Lock className="h-3 w-3" />
                      </Badge>
                    )}
                  </div>
                  {track.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {track.description}
                    </p>
                  )}

                  {/* Stats */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2">
                    <div className="flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {track.view_count || 0}
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(track.updated_at).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Tags */}
                  {track.tags && track.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-2">
                      {track.tags.slice(0, 3).map((tag: string, idx: number) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {track.tags.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{track.tags.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {sortedTracks.map((track) => (
            <Card
              key={track.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => handleViewTrack(track)}
            >
              <CardContent className="p-4">
                <div className="flex gap-4">
                  {/* Thumbnail */}
                  <div className="w-48 h-28 flex-shrink-0 bg-muted rounded overflow-hidden">
                    {track.thumbnail_url ? (
                      <img
                        src={track.thumbnail_url}
                        alt={track.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-100 to-orange-50">
                        {getTypeIcon(track.type)}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-2 flex-1">
                        <h3 className="font-semibold">{track.title}</h3>
                        {track.is_system_content && (
                          <Badge className="bg-amber-100 text-amber-800 border-amber-200 flex-shrink-0">
                            <Lock className="h-3 w-3 mr-1" />
                            Trike Library
                          </Badge>
                        )}
                      </div>
                      <Badge className={getTypeBadgeColor(track.type)}>
                        {getTypeIcon(track.type)}
                        <span className="ml-1 capitalize">{track.type}</span>
                      </Badge>
                    </div>
                    {track.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {track.description}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Eye className="h-4 w-4" />
                        {track.view_count || 0} views
                      </div>
                      {(track.duration_minutes || (track.type === 'article' && track.transcript)) && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {track.type === 'article' 
                            ? calculateReadingTime(track.transcript || '')
                            : track.duration_minutes
                          } min
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {new Date(track.updated_at).toLocaleDateString()}
                      </div>
                    </div>

                    {track.tags && track.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {track.tags.map((tag: string, idx: number) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Footer />
    </div>
  );
}