import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Footer } from './Footer';
import {
  FileText,
  Video,
  Image as ImageIcon,
  CheckCircle,
  Plus,
  Edit,
  Trash2,
  Search,
  Filter,
  Loader2,
  Send,
  ExternalLink
} from 'lucide-react';
import { ContentCreationWrapper } from './ContentCreationWrapper';
import { TrackDetailEdit } from './TrackDetailEdit';
import { ArticleDetailEdit } from './ArticleDetailEdit';
import { StoryEditor } from './content-authoring/StoryEditor';
import { CheckpointEditor } from './content-authoring/CheckpointEditor';
import { CreateVariantModal } from './content-authoring/CreateVariantModal';
import * as crud from '../lib/crud';
import { toast } from 'sonner@2.0.3';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

type ContentType = 'article' | 'video' | 'story' | 'checkpoint' | null;

const contentTypesMeta = [
  {
    id: 'article',
    icon: FileText,
    color: 'bg-blue-100 dark:bg-blue-900/30',
    iconColor: 'text-blue-600 dark:text-blue-400',
    borderColor: 'border-blue-200 dark:border-blue-800'
  },
  {
    id: 'video',
    icon: Video,
    color: 'bg-purple-100 dark:bg-purple-900/30',
    iconColor: 'text-purple-600 dark:text-purple-400',
    borderColor: 'border-purple-200 dark:border-purple-800'
  },
  {
    id: 'story',
    icon: ImageIcon,
    color: 'bg-pink-100 dark:bg-pink-900/30',
    iconColor: 'text-pink-600 dark:text-pink-400',
    borderColor: 'border-pink-200 dark:border-pink-800'
  },
  {
    id: 'checkpoint',
    icon: CheckCircle,
    color: 'bg-green-100 dark:bg-green-900/30',
    iconColor: 'text-green-600 dark:text-green-400',
    borderColor: 'border-green-200 dark:border-green-800'
  }
];

interface ContentAuthoringProps {
  onNavigateToLibrary?: () => void;
  currentRole?: string;
  initialTrackId?: string; // For URL-based track loading
  initialMode?: 'create-article' | null;
  onNavigateToPlaylist?: (playlistId: string) => void;
  onBackClick?: () => void;
  previousView?: string | null;
  onRegisterUnsavedChangesCheck?: (checkFn: (() => boolean) | null) => void;
  editingArticle?: any;
  onClearEditingArticle?: () => void;
}

export function ContentAuthoring({
  onNavigateToLibrary,
  currentRole,
  initialTrackId,
  initialMode,
  onNavigateToPlaylist,
  onBackClick,
  previousView,
  onRegisterUnsavedChangesCheck,
  editingArticle,
  onClearEditingArticle
}: ContentAuthoringProps) {
  const { t } = useTranslation();
  const [selectedType, setSelectedType] = useState<ContentType>(null);
  const [editingTrack, setEditingTrack] = useState<any>(null);
  const [draftTracks, setDraftTracks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilters, setTypeFilters] = useState<Set<string>>(new Set(['article', 'video', 'story', 'checkpoint']));
  const [hasLoadedInitialTrack, setHasLoadedInitialTrack] = useState(false); // Track if initial load is done

  // Track unsaved changes
  const [hasUnsavedChangesCheckFn, setHasUnsavedChangesCheckFn] = useState<(() => boolean) | null>(null);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingNavAction, setPendingNavAction] = useState<(() => void) | null>(null);

  // Create Variant modal state
  const [createVariantModal, setCreateVariantModal] = useState<{ open: boolean; track: any }>({ open: false, track: null });

  // Build translated content types list inside the component
  const contentTypes = [
    {
      ...contentTypesMeta[0],
      name: t('contentAuthoring.typeArticleName'),
      description: t('contentAuthoring.typeArticleDesc'),
    },
    {
      ...contentTypesMeta[1],
      name: t('contentAuthoring.typeVideoName'),
      description: t('contentAuthoring.typeVideoDesc'),
    },
    {
      ...contentTypesMeta[2],
      name: t('contentAuthoring.typeStoryName'),
      description: t('contentAuthoring.typeStoryDesc'),
    },
    {
      ...contentTypesMeta[3],
      name: t('contentAuthoring.typeCheckpointName'),
      description: t('contentAuthoring.typeCheckpointDesc'),
    },
  ];

  const handleRegisterLocal = useCallback((checkFn: (() => boolean) | null) => {
    setHasUnsavedChangesCheckFn(() => checkFn);
    if (onRegisterUnsavedChangesCheck) {
      onRegisterUnsavedChangesCheck(checkFn);
    }
  }, [onRegisterUnsavedChangesCheck]);

  const isSuperAdmin = currentRole === 'Trike Super Admin';

  // Load initial track from URL if provided - ONLY ONCE
  useEffect(() => {
    // Handle initial creation mode
    if (initialMode === 'create-article' && !selectedType) {
      handleCreateNew('article');
      return;
    }

    if (initialTrackId && !editingTrack && !hasLoadedInitialTrack) {
      setHasLoadedInitialTrack(true);
      import('../lib/crud/tracks')
        .then(({ getTracks }) => getTracks({ ids: [initialTrackId!], includeAllVersions: true }))
        .then((tracks) => {
          if (tracks && tracks.length > 0) {
            const track = tracks[0];
            setEditingTrack(track);
            setSelectedType(track.type);
          }
        })
        .catch((error) => {
          console.error('ContentAuthoring: Failed to load initial track:', error);
        });
    }
  }, [initialTrackId, editingTrack, hasLoadedInitialTrack]);

  useEffect(() => {
    loadDraftTracks();
  }, []);

  const loadDraftTracks = async () => {
    setIsLoading(true);
    try {
      const allTracks = await crud.getTracks();
      // Filter to only show draft tracks
      const drafts = allTracks.filter((track: any) => track.status === 'draft');
      setDraftTracks(drafts);
    } catch (error: any) {
      console.error('Error loading draft tracks:', error);
      toast.error(t('contentAuthoring.failedLoadDrafts'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateNew = (type: ContentType) => {
    if (hasUnsavedChangesCheckFn && hasUnsavedChangesCheckFn()) {
      console.log('⚠️ Unsaved changes detected when creating new content');
      setPendingNavAction(() => () => {
        setSelectedType(type);
        setEditingTrack(null);
        setHasUnsavedChangesCheckFn(null);
      });
      setShowUnsavedDialog(true);
    } else {
      setSelectedType(type);
      setEditingTrack(null);
    }
  };

  const handleCloseWithCheck = () => {
    console.log('🚪 handleCloseWithCheck called, checking for unsaved changes...');

    if (hasUnsavedChangesCheckFn && hasUnsavedChangesCheckFn()) {
      console.log('⚠️ Unsaved changes detected, showing dialog');
      setPendingNavAction(() => () => {
        console.log('✅ User chose to discard changes');
        handleCloseImmediate();
      });
      setShowUnsavedDialog(true);
    } else {
      console.log('✅ No unsaved changes, closing immediately');
      handleCloseImmediate();
    }
  };

  const handleCloseImmediate = () => {
    setSelectedType(null);
    setEditingTrack(null);
    setHasUnsavedChangesCheckFn(null);
    setShowUnsavedDialog(false);
    setPendingNavAction(null);
    loadDraftTracks(); // Reload drafts when closing editor
  };

  const handleClose = handleCloseWithCheck; // Use the check version by default

  const handleEditTrack = (track: any) => {
    if (hasUnsavedChangesCheckFn && hasUnsavedChangesCheckFn()) {
      console.log('⚠️ Unsaved changes detected when switching tracks');
      setPendingNavAction(() => () => {
        setEditingTrack(track);
        setSelectedType(track.type);
        setHasUnsavedChangesCheckFn(null);
      });
      setShowUnsavedDialog(true);
    } else {
      setEditingTrack(track);
      setSelectedType(track.type);
    }
  };

  const handlePublishTrack = async (trackId: string) => {
    try {
      await crud.updateTrack({ id: trackId, status: 'published' });
      toast.success(t('contentAuthoring.trackPublishedSuccess'));
      loadDraftTracks();
    } catch (error: any) {
      console.error('Error publishing track:', error);
      // Show specific error message (includes publish validation messages like "Video transcription must complete")
      toast.error(error.message || t('contentAuthoring.failedPublishTrack'));
    }
  };

  const handleDeleteTrack = async (trackId: string) => {
    if (!confirm(t('contentAuthoring.confirmDeleteDraft'))) {
      return;
    }

    try {
      await crud.deleteTrack(trackId);
      toast.success(t('contentAuthoring.draftDeletedSuccess'));
      loadDraftTracks();
    } catch (error: any) {
      console.error('Error deleting track:', error);
      toast.error(t('contentAuthoring.failedDeleteDraft'));
    }
  };

  const toggleTypeFilter = (type: string) => {
    const newFilters = new Set(typeFilters);
    if (newFilters.has(type)) {
      newFilters.delete(type);
    } else {
      newFilters.add(type);
    }
    setTypeFilters(newFilters);
  };

  const getContentTypeInfo = (type: string) => {
    return contentTypes.find(ct => ct.id === type);
  };

  // Filter drafts based on search and type filters
  const filteredDrafts = draftTracks.filter((track) => {
    const matchesSearch = track.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilters.has(track.type);
    return matchesSearch && matchesType;
  });

  // If editing a specific track
  if (editingTrack) {
    const handleUpdate = async (newTrackId?: string) => {
      // Reload the track data
      try {
        console.log('ContentAuthoring - handleUpdate called, newTrackId:', newTrackId);
        // If a new track ID is provided (e.g., after version creation), use that
        const trackIdToFetch = newTrackId || editingTrack.id;
        console.log('ContentAuthoring - fetching track ID:', trackIdToFetch);
        const updatedTrack = await crud.getTrackById(trackIdToFetch);
        setEditingTrack(updatedTrack);
        loadDraftTracks(); // Also reload the drafts list
      } catch (error) {
        console.error('Error reloading track:', error);
      }
    };

    if (editingTrack.type === 'article') {
      return (
        <>
          <ArticleDetailEdit
            track={editingTrack}
            onBack={handleClose}
            onUpdate={handleUpdate}
            isSuperAdminAuthenticated={isSuperAdmin}
            isNewContent={false}
            onNavigateToPlaylist={onNavigateToPlaylist}
            registerUnsavedChangesCheck={handleRegisterLocal}
            onCreateVariant={(track) => setCreateVariantModal({ open: true, track })}
          />
          {createVariantModal.open && createVariantModal.track && (
            <CreateVariantModal
              key={createVariantModal.track.id}
              isOpen
              onClose={() => setCreateVariantModal({ open: false, track: null })}
              sourceTrack={{
                id: createVariantModal.track.id,
                title: createVariantModal.track.title,
                type: createVariantModal.track.type,
                thumbnail_url: createVariantModal.track.thumbnail_url
              }}
              onVariantCreated={(newTrackId) => {
                setCreateVariantModal({ open: false, track: null });
                crud.getTrackById(newTrackId).then((updatedTrack) => {
                  setEditingTrack(updatedTrack);
                  setSelectedType(updatedTrack.type);
                }).catch((err) => {
                  console.error('Error loading variant track:', err);
                  toast.error(t('contentAuthoring.variantLoadFailed'));
                });
                toast.success(t('contentAuthoring.variantCreated'));
              }}
            />
          )}
        </>
      );
    } else if (editingTrack.type === 'video') {
      return (
        <>
          <TrackDetailEdit
            track={editingTrack}
            onBack={handleClose}
            onUpdate={handleUpdate}
            isSuperAdminAuthenticated={isSuperAdmin}
            isNewContent={false}
            onNavigateToPlaylist={onNavigateToPlaylist}
            registerUnsavedChangesCheck={handleRegisterLocal}
            onCreateVariant={(track) => setCreateVariantModal({ open: true, track })}
          />
          {createVariantModal.open && createVariantModal.track && (
            <CreateVariantModal
              key={createVariantModal.track.id}
              isOpen
              onClose={() => setCreateVariantModal({ open: false, track: null })}
              sourceTrack={{
                id: createVariantModal.track.id,
                title: createVariantModal.track.title,
                type: createVariantModal.track.type,
                thumbnail_url: createVariantModal.track.thumbnail_url
              }}
              onVariantCreated={(newTrackId) => {
                setCreateVariantModal({ open: false, track: null });
                crud.getTrackById(newTrackId).then((updatedTrack) => {
                  setEditingTrack(updatedTrack);
                  setSelectedType(updatedTrack.type);
                }).catch((err) => {
                  console.error('Error loading variant track:', err);
                  toast.error(t('contentAuthoring.variantLoadFailed'));
                });
                toast.success(t('contentAuthoring.variantCreated'));
              }}
            />
          )}
        </>
      );
    } else if (editingTrack.type === 'story') {
      return (
        <>
          <StoryEditor
            track={editingTrack}
            onBack={handleClose}
            onUpdate={handleUpdate}
            currentRole={currentRole}
            isSuperAdminAuthenticated={isSuperAdmin}
            onNavigateToPlaylist={onNavigateToPlaylist}
            registerUnsavedChangesCheck={handleRegisterLocal}
            onCreateVariant={(track) => setCreateVariantModal({ open: true, track })}
          />
          {createVariantModal.open && createVariantModal.track && (
            <CreateVariantModal
              key={createVariantModal.track.id}
              isOpen
              onClose={() => setCreateVariantModal({ open: false, track: null })}
              sourceTrack={{
                id: createVariantModal.track.id,
                title: createVariantModal.track.title,
                type: createVariantModal.track.type,
                thumbnail_url: createVariantModal.track.thumbnail_url
              }}
              onVariantCreated={(newTrackId) => {
                setCreateVariantModal({ open: false, track: null });
                crud.getTrackById(newTrackId).then((updatedTrack) => {
                  setEditingTrack(updatedTrack);
                  setSelectedType(updatedTrack.type);
                }).catch((err) => {
                  console.error('Error loading variant track:', err);
                  toast.error(t('contentAuthoring.variantLoadFailed'));
                });
                toast.success(t('contentAuthoring.variantCreated'));
              }}
            />
          )}
        </>
      );
    } else if (editingTrack.type === 'checkpoint') {
      return (
        <>
          <CheckpointEditor
            onClose={handleClose}
            track={editingTrack}
            trackId={editingTrack.id}
            isNewContent={false}
            currentRole={currentRole}
            onNavigateToPlaylist={onNavigateToPlaylist}
            registerUnsavedChangesCheck={handleRegisterLocal}
            onCreateVariant={(track) => setCreateVariantModal({ open: true, track })}
          />
          {createVariantModal.open && createVariantModal.track && (
            <CreateVariantModal
              key={createVariantModal.track.id}
              isOpen
              onClose={() => setCreateVariantModal({ open: false, track: null })}
              sourceTrack={{
                id: createVariantModal.track.id,
                title: createVariantModal.track.title,
                type: createVariantModal.track.type,
                thumbnail_url: createVariantModal.track.thumbnail_url
              }}
              onVariantCreated={(newTrackId) => {
                setCreateVariantModal({ open: false, track: null });
                crud.getTrackById(newTrackId).then((updatedTrack) => {
                  setEditingTrack(updatedTrack);
                  setSelectedType(updatedTrack.type);
                }).catch((err) => {
                  console.error('Error loading variant track:', err);
                  toast.error(t('contentAuthoring.variantLoadFailed'));
                });
                toast.success(t('contentAuthoring.variantCreated'));
              }}
            />
          )}
        </>
      );
    }
  }

  // If creating new content
  if (selectedType) {
    switch (selectedType) {
      case 'article':
        return (
          <ContentCreationWrapper
            contentType="article"
            onBack={handleClose}
            isSuperAdminAuthenticated={isSuperAdmin}
          />
        );
      case 'video':
        return (
          <ContentCreationWrapper
            contentType="video"
            onBack={handleClose}
            isSuperAdminAuthenticated={isSuperAdmin}
          />
        );
      case 'story':
        return (
          <StoryEditor
            onClose={handleClose}
            isNewContent={true}
            currentRole={currentRole}
            isSuperAdminAuthenticated={isSuperAdmin}
          />
        );
      case 'checkpoint':
        return (
          <CheckpointEditor
            onClose={handleClose}
            isNewContent={true}
            currentRole={currentRole}
            registerUnsavedChangesCheck={handleRegisterLocal}
          />
        );
      default:
        return null;
    }
  }

  // Main content authoring view
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-foreground">{t('contentAuthoring.pageTitle')}</h1>
        <p className="text-muted-foreground mt-1">
          {t('contentAuthoring.pageSubtitle')}
        </p>
      </div>

      {/* Content Type Cards */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">{t('contentAuthoring.createNewContent')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {contentTypes.map((type) => {
            const Icon = type.icon;
            return (
              <Card
                key={type.id}
                className={`cursor-pointer transition-all hover:shadow-lg hover:scale-105 border-2 ${type.borderColor} group`}
                onClick={() => handleCreateNew(type.id as ContentType)}
              >
                <CardContent className="p-6">
                  <div className="flex flex-col items-center text-center space-y-4">
                    <div className={`h-16 w-16 rounded-xl ${type.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                      <Icon className={`h-8 w-8 ${type.iconColor}`} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">{type.name}</h3>
                      <p className="text-xs text-muted-foreground">{type.description}</p>
                    </div>
                    <Button size="sm" className="w-full bg-brand-gradient text-white shadow-brand">
                      <Plus className="h-4 w-4 mr-2" />
                      {type.id === 'checkpoint' ? t('contentAuthoring.createCheckpointBtn') : t('contentAuthoring.createTypeBtn', { name: type.name })}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Track Drafts */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">{t('contentAuthoring.trackDrafts')}</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={onNavigateToLibrary}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            {t('contentAuthoring.viewPublished')}
          </Button>
        </div>

        {/* Search and Filter Bar */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('contentAuthoring.searchDraftsPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                {t('contentAuthoring.filterByType')}
                {typeFilters.size < contentTypes.length && (
                  <Badge variant="secondary" className="ml-2">
                    {typeFilters.size}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {contentTypes.map((type) => (
                <DropdownMenuCheckboxItem
                  key={type.id}
                  checked={typeFilters.has(type.id)}
                  onCheckedChange={() => toggleTypeFilter(type.id)}
                >
                  {type.name}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-12 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                <p className="text-muted-foreground">{t('contentAuthoring.loadingDrafts')}</p>
              </div>
            ) : filteredDrafts.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {searchQuery || typeFilters.size < contentTypes.length
                    ? t('contentAuthoring.noDraftsMatchFilters')
                    : t('contentAuthoring.noDraftsYet')}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('contentAuthoring.getStartedHint')}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredDrafts.map((track) => {
                  const typeInfo = getContentTypeInfo(track.type);
                  if (!typeInfo) return null;

                  const Icon = typeInfo.icon;

                  return (
                    <div
                      key={track.id}
                      className="p-4 hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className={`h-12 w-12 rounded-lg ${typeInfo.color} flex items-center justify-center`}>
                            <Icon className={`h-6 w-6 ${typeInfo.iconColor}`} />
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <h3 className="font-semibold text-foreground">{track.title}</h3>
                              <Badge
                                variant="outline"
                                className="bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400"
                              >
                                {t('contentAuthoring.draftBadge')}
                              </Badge>
                            </div>
                            <div className="flex items-center space-x-3 text-xs text-muted-foreground mt-1">
                              <span className="capitalize">{track.type}</span>
                              {track.created_at && (
                                <>
                                  <span>•</span>
                                  <span>{t('contentAuthoring.createdDate', { date: new Date(track.created_at).toLocaleDateString() })}</span>
                                </>
                              )}
                              {track.updated_at && (
                                <>
                                  <span>•</span>
                                  <span>{t('contentAuthoring.updatedDate', { date: new Date(track.updated_at).toLocaleDateString() })}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditTrack(track)}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            {t('contentAuthoring.editBtn')}
                          </Button>
                          <Button
                            size="sm"
                            className="bg-brand-gradient text-white shadow-brand hover:opacity-90 border-0"
                            onClick={() => handlePublishTrack(track.id)}
                          >
                            <Send className="h-4 w-4 mr-2" />
                            {t('contentAuthoring.publishBtn')}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteTrack(track.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Unsaved Changes Dialog */}
      {showUnsavedDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background border border-border rounded-lg shadow-lg p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-foreground mb-2">{t('contentAuthoring.unsavedChangesTitle')}</h3>
            <p className="text-muted-foreground mb-6">
              {t('contentAuthoring.unsavedChangesMessage')}
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowUnsavedDialog(false);
                  setPendingNavAction(null);
                }}
              >
                {t('contentAuthoring.cancelBtn')}
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (pendingNavAction) {
                    pendingNavAction();
                  }
                  setShowUnsavedDialog(false);
                  setPendingNavAction(null);
                }}
              >
                {t('contentAuthoring.discardChangesBtn')}
              </Button>
            </div>
          </div>
        </div>
      )}
      <Footer />
    </div>
  );
}
