import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Footer } from './Footer';
import {
  ArrowLeft,
  Edit,
  Save,
  X,
  Plus,
  Trash2,
  GripVertical,
  Music,
  Album as AlbumIcon,
  Clock,
  CheckCircle2,
  MoreVertical,
  Copy,
  Archive,
  Play,
  Video,
  FileText,
  BookOpen,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { toast } from 'sonner';
import * as albumsCrud from '../lib/crud/albums';
import * as crud from '../lib/crud';
import type { Album, AlbumTrack } from '../lib/crud/albums';

interface AlbumDetailViewProps {
  album: Album;
  onBack: () => void;
  onUpdate: () => void;
  onPublish: () => void;
  previousView?: string | null;
}

export function AlbumDetailView({ 
  album, 
  onBack, 
  onUpdate, 
  onPublish,
  previousView 
}: AlbumDetailViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    title: album.title,
    description: album.description || '',
  });
  const [saving, setSaving] = useState(false);
  const [showAddTracksDialog, setShowAddTracksDialog] = useState(false);
  const [availableTracks, setAvailableTracks] = useState<any[]>([]);
  const [trackSearchQuery, setTrackSearchQuery] = useState('');
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<string>>(new Set());
  const [draggedTrackId, setDraggedTrackId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [localTracks, setLocalTracks] = useState<AlbumTrack[]>([]);

  // Sync editForm when album changes
  useEffect(() => {
    setEditForm({
      title: album.title,
      description: album.description || '',
    });
  }, [album]);

  // Sync localTracks when album changes
  useEffect(() => {
    if (album.tracks) {
      const sorted = [...album.tracks].sort((a, b) => a.display_order - b.display_order);
      setLocalTracks(sorted);
    }
  }, [album]);

  const handleSave = async () => {
    if (!editForm.title.trim()) {
      toast.error('Title is required');
      return;
    }
    
    setSaving(true);
    try {
      await albumsCrud.updateAlbum({
        id: album.id,
        title: editForm.title.trim(),
        description: editForm.description.trim() || undefined,
      });
      toast.success('Album updated');
      setIsEditing(false);
      onUpdate();
    } catch (err) {
      console.error('Error saving album:', err);
      toast.error('Failed to save album');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveTrack = async (trackId: string) => {
    try {
      await albumsCrud.removeTrackFromAlbum(album.id, trackId);
      toast.success('Track removed');
      // Update local state optimistically
      setLocalTracks(prev => prev.filter(t => t.track_id !== trackId));
      onUpdate();
    } catch (err) {
      console.error('Error removing track:', err);
      toast.error('Failed to remove track');
    }
  };

  const loadAvailableTracks = async () => {
    try {
      const tracks = await crud.getTracks({ status: 'published' });
      // Filter out tracks already in album
      const albumTrackIds = new Set((album.tracks || []).map(at => at.track_id));
      const available = tracks.filter((t: any) => !albumTrackIds.has(t.id));
      setAvailableTracks(available);
    } catch (err) {
      console.error('Error loading tracks:', err);
    }
  };

  useEffect(() => {
    if (showAddTracksDialog) {
      loadAvailableTracks();
      setSelectedTrackIds(new Set());
      setTrackSearchQuery('');
    }
  }, [showAddTracksDialog]);

  const handleAddSelectedTracks = async () => {
    if (selectedTrackIds.size === 0) return;
    
    try {
      const result = await albumsCrud.addTracksToAlbum(album.id, Array.from(selectedTrackIds));
      toast.success(`Added ${selectedTrackIds.size} track(s)`);
      setShowAddTracksDialog(false);
      // onUpdate will refresh the album and localTracks will sync via useEffect
      onUpdate();
    } catch (err) {
      console.error('Error adding tracks:', err);
      toast.error('Failed to add tracks');
    }
  };

  const toggleTrackSelection = (trackId: string) => {
    setSelectedTrackIds(prev => {
      const next = new Set(prev);
      if (next.has(trackId)) {
        next.delete(trackId);
      } else {
        next.add(trackId);
      }
      return next;
    });
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, trackId: string) => {
    setDraggedTrackId(trackId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', trackId);
  };

  const handleDragOver = (e: React.DragEvent, targetTrackId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    if (!draggedTrackId || draggedTrackId === targetTrackId) return;

    // Track the drop target
    setDropTargetId(targetTrackId);

    const draggedIndex = localTracks.findIndex(t => t.track_id === draggedTrackId);
    const targetIndex = localTracks.findIndex(t => t.track_id === targetTrackId);
    
    if (draggedIndex === -1 || targetIndex === -1) return;

    const newTracks = [...localTracks];
    const [draggedTrack] = newTracks.splice(draggedIndex, 1);
    newTracks.splice(targetIndex, 0, draggedTrack);
    
    setLocalTracks(newTracks);
  };

  const handleDragEnd = async () => {
    if (!draggedTrackId || !dropTargetId || draggedTrackId === dropTargetId) {
      setDraggedTrackId(null);
      setDropTargetId(null);
      return;
    }

    // Get the current order from localTracks (which was updated during dragOver)
    const trackIds = localTracks.map(t => t.track_id);
    
    try {
      await albumsCrud.reorderAlbumTracks(album.id, trackIds);
      toast.success('Track order updated');
      onUpdate(); // Refresh album data
    } catch (err) {
      console.error('Error reordering tracks:', err);
      toast.error('Failed to reorder tracks');
      // Revert to original order
      if (album.tracks) {
        const sorted = [...album.tracks].sort((a, b) => a.display_order - b.display_order);
        setLocalTracks(sorted);
      }
    }
    
    setDraggedTrackId(null);
    setDropTargetId(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    // Prevent default drop behavior - we handle it in handleDragEnd
  };

  const filteredAvailableTracks = availableTracks.filter(t =>
    t.title.toLowerCase().includes(trackSearchQuery.toLowerCase())
  );

  const getTrackIcon = (type: string) => {
    switch (type) {
      case 'video': return <Video className="h-4 w-4" />;
      case 'article': return <FileText className="h-4 w-4" />;
      case 'story': return <BookOpen className="h-4 w-4" />;
      case 'checkpoint': return <CheckCircle2 className="h-4 w-4" />;
      default: return <Play className="h-4 w-4" />;
    }
  };

  const totalDuration = album.total_duration_minutes || 0;
  const trackCount = album.track_count || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={onBack} className="flex items-center">
            <ArrowLeft className="h-4 w-4 mr-1" />
            {previousView ? `Back to ${previousView === 'content' ? 'Content Library' : 'Albums'}` : 'Back to Albums'}
          </Button>
          <div>
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <AlbumIcon className="h-6 w-6 text-primary" />
              </div>
              {isEditing ? (
                <Input
                  value={editForm.title}
                  onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                  className="text-xl font-bold h-auto py-1"
                  placeholder="Album title"
                />
              ) : (
                <h1 className="text-foreground">{album.title}</h1>
              )}
            </div>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground mt-1">
              <Badge variant={album.status === 'published' ? 'default' : album.status === 'draft' ? 'secondary' : 'outline'}>
                {album.status}
              </Badge>
              <span>•</span>
              <span>{trackCount} {trackCount === 1 ? 'track' : 'tracks'}</span>
              <span>•</span>
              <span>{totalDuration} min</span>
              <span>•</span>
              <span>Updated {new Date(album.updated_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={() => {
                setIsEditing(false);
                setEditForm({ title: album.title, description: album.description || '' });
              }}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </>
          ) : (
            <>
              {album.status === 'draft' && (
                <Button onClick={onPublish} className="bg-green-600 hover:bg-green-700">
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Publish
                </Button>
              )}
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Description (editable) */}
      {isEditing && (
        <Card>
          <CardContent className="pt-6">
            <label className="text-sm font-medium mb-2 block">Description</label>
            <Textarea
              value={editForm.description}
              onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Optional album description..."
              rows={3}
            />
          </CardContent>
        </Card>
      )}

      {!isEditing && album.description && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">{album.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Tracks Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <AlbumIcon className="h-5 w-5" />
            Tracks in Album
          </CardTitle>
          <Button onClick={() => setShowAddTracksDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Tracks
          </Button>
        </CardHeader>
        <CardContent>
          {(!localTracks || localTracks.length === 0) ? (
            <div className="text-center py-12">
              <AlbumIcon className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="font-semibold mb-2">No tracks in this album</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Add tracks to build your album
              </p>
              <Button variant="outline" onClick={() => setShowAddTracksDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Tracks
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {localTracks.map((albumTrack, index) => (
                <div
                  key={albumTrack.track_id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, albumTrack.track_id)}
                  onDragOver={(e) => handleDragOver(e, albumTrack.track_id)}
                  onDrop={handleDrop}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-4 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors group ${
                    draggedTrackId === albumTrack.track_id ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <GripVertical className="h-4 w-4 cursor-grab active:cursor-grabbing" />
                    <span className="text-sm w-6 text-center">{index + 1}</span>
                  </div>
                  
                  {albumTrack.track?.thumbnail_url && (
                    <img
                      src={albumTrack.track.thumbnail_url}
                      alt=""
                      className="w-12 h-12 rounded object-cover"
                    />
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{albumTrack.track?.title || 'Untitled'}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Badge variant="outline" className="text-xs capitalize flex items-center gap-1">
                        {getTrackIcon(albumTrack.track?.type || '')}
                        {albumTrack.track?.type}
                      </Badge>
                      {albumTrack.track?.duration_minutes && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {albumTrack.track.duration_minutes} min
                        </span>
                      )}
                      {albumTrack.is_required && (
                        <Badge variant="secondary" className="text-xs">Required</Badge>
                      )}
                    </div>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleRemoveTrack(albumTrack.track_id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Tracks Dialog */}
      <Dialog open={showAddTracksDialog} onOpenChange={setShowAddTracksDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Add Tracks to Album</DialogTitle>
            <DialogDescription>
              Select tracks to add to "{album.title}"
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-2">
            <Input
              placeholder="Search tracks..."
              value={trackSearchQuery}
              onChange={(e) => setTrackSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex-1 overflow-y-auto min-h-[300px] space-y-2">
            {filteredAvailableTracks.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No available tracks to add
              </p>
            ) : (
              filteredAvailableTracks.map((track) => (
                <div
                  key={track.id}
                  onClick={() => toggleTrackSelection(track.id)}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedTrackIds.has(track.id)
                      ? 'border-primary bg-primary/5'
                      : 'hover:bg-accent/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedTrackIds.has(track.id)}
                    onChange={() => toggleTrackSelection(track.id)}
                    className="h-4 w-4"
                  />
                  {track.thumbnail_url && (
                    <img
                      src={track.thumbnail_url}
                      alt=""
                      className="w-10 h-10 rounded object-cover"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{track.title}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-xs capitalize">
                        {track.type}
                      </Badge>
                      {track.duration_minutes != null && track.duration_minutes > 0 && (
                        <span>{track.duration_minutes} min</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddTracksDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddSelectedTracks}
              disabled={selectedTrackIds.size === 0}
            >
              Add {selectedTrackIds.size} Track{selectedTrackIds.size !== 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
}

