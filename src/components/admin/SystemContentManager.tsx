import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  Search,
  Plus,
  FileText,
  Video,
  BookOpen,
  CheckSquare,
  ExternalLink,
  MoreVertical,
  Globe,
  Lock
} from 'lucide-react';
import { getTracks } from '../../lib/crud/tracks';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

export function SystemContentManager() {
  const [tracks, setTracks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeType, setActiveType] = useState<string>('all');

  useEffect(() => {
    fetchSystemTracks();
  }, []);

  async function fetchSystemTracks() {
    try {
      setLoading(true);
      // Fetch tracks marked as is_system_content
      const data = await getTracks({ isSystemContent: true });
      setTracks(data || []);
    } catch (error) {
      console.error('Error fetching system tracks:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredTracks = tracks.filter(track => {
    const matchesSearch = track.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         track.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = activeType === 'all' || track.type === activeType;
    return matchesSearch && matchesType;
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'video': return <Video className="h-4 w-4" />;
      case 'article': return <BookOpen className="h-4 w-4" />;
      case 'story': return <FileText className="h-4 w-4" />;
      case 'checkpoint': return <CheckSquare className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search system library..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchSystemTracks}>
            Refresh
          </Button>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Create System Track
          </Button>
        </div>
      </div>

      <Tabs value={activeType} onValueChange={setActiveType}>
        <TabsList>
          <TabsTrigger value="all">All Content</TabsTrigger>
          <TabsTrigger value="video">Videos</TabsTrigger>
          <TabsTrigger value="article">Articles</TabsTrigger>
          <TabsTrigger value="story">Stories</TabsTrigger>
          <TabsTrigger value="checkpoint">Checkpoints</TabsTrigger>
        </TabsList>

        <TabsContent value={activeType} className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading ? (
              Array(6).fill(0).map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <div className="h-40 bg-muted rounded-t-lg" />
                  <CardContent className="p-4 space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </CardContent>
                </Card>
              ))
            ) : filteredTracks.length > 0 ? (
              filteredTracks.map((track) => (
                <Card key={track.id} className="overflow-hidden group">
                  <div className="aspect-video relative bg-muted">
                    {track.thumbnail_url ? (
                      <img
                        src={track.thumbnail_url}
                        alt={track.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        {getTypeIcon(track.type)}
                      </div>
                    )}
                    <div className="absolute top-2 right-2">
                      <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm">
                        {track.type}
                      </Badge>
                    </div>
                    {track.is_system_content && (
                      <div className="absolute top-2 left-2">
                        <Badge className="bg-blue-600 hover:bg-blue-700 gap-1">
                          <Globe className="h-3 w-3" />
                          System
                        </Badge>
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold line-clamp-1 flex-1">{track.title}</h3>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem className="gap-2">
                            <ExternalLink className="h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2">
                            <Lock className="h-4 w-4" />
                            Edit (Super Admin)
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-4 h-10">
                      {track.description || 'No description provided.'}
                    </p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{track.duration_minutes || 0} mins</span>
                      <span>{new Date(track.created_at).toLocaleDateString()}</span>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="col-span-full py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium">No content found</h3>
                <p className="text-muted-foreground">
                  {searchQuery ? 'No tracks match your search criteria.' : 'No system content has been created yet.'}
                </p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
