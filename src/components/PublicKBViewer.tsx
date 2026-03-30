/**
 * Public Knowledge Base Viewer - Phase 1 Mobile Optimization
 * Standalone viewer for KB articles accessed via QR codes
 * Completely bypasses authentication and dashboard
 * Mobile-optimized for quick reference material
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { projectId, publicAnonKey, getServerUrl } from '../utils/supabase/info';
import { 
  ChevronDown, 
  ChevronUp, 
  Search, 
  X, 
  Share2, 
  ThumbsUp,
  Moon,
  Sun,
  FileText,
  Table,
  Image as ImageIcon,
  Video as VideoIcon,
  Paperclip,
  Target,
  BookOpen,
  User,
  MessageSquare,
  Send,
  Zap,
  Download
} from 'lucide-react';
import trikeLogoDark from '../assets/trike-logo.png';
import { TTSPlayer } from './content/TTSPlayer';
import BrainChatDrawer from './BrainChat/BrainChatDrawer';
import { PinLoginModal } from './public/PinLoginModal';
import { getPinSession } from '../lib/crud/pinAuth';
import * as crud from '../lib/crud';
import { supabase, getCurrentUserOrgId } from '../lib/supabase';
import { Dialog, DialogContent, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { cn } from './ui/utils';
import { StoryPreview } from './content-authoring/StoryPreview';
import { StoryTranscript } from './content-authoring/StoryTranscript';
import { downloadKbTrackAsPdf } from '../lib/utils/kbPdfExport';
import { toast } from 'sonner';
import { trackDemoActivityEvent } from '../lib/analytics/demoTracking';

function parseStorySlidesFromTranscript(transcript?: string): Array<{
  id: string;
  name: string;
  type: 'image' | 'video';
  url: string;
  order: number;
  duration?: number;
}> {
  if (!transcript) return [];
  try {
    const storyData = typeof transcript === 'string' ? JSON.parse(transcript) : transcript;
    if (!storyData?.slides || !Array.isArray(storyData.slides)) return [];
    return storyData.slides.map((slide: any, index: number) => ({
      id: slide.id || `slide-${index}`,
      name: slide.name || slide.title || `Slide ${index + 1}`,
      type: slide.type === 'video' ? 'video' : 'image',
      url: slide.url || '',
      order: slide.order !== undefined ? slide.order : index,
      duration: slide.duration,
    }));
  } catch {
    return [];
  }
}

interface Fact {
  id: string;
  title: string;
  content: string;
}

interface Tag {
  id: string;
  name: string;
  type: string;
  color: string;
}

interface Attachment {
  id: string;
  filename: string;
  file_url: string;
  file_type: string;
  file_size: number;
  created_at: string;
}

interface RelatedTrack {
  id: string;
  title: string;
  kb_slug: string;
  type: string;
  duration_minutes?: number;
}

interface Track {
  id: string;
  title: string;
  description?: string;
  type: 'article' | 'video' | 'story' | 'checkpoint';
  thumbnail_url?: string;
  content_url?: string;
  article_body?: string;
  content_text?: string;
  content?: string;
  transcript?: string;
  duration_minutes?: number;
  updated_at: string;
  organization_id?: string;
  view_count?: number;
  likes?: number;
  category?: { name?: string };
  created_by?: { name?: string };
}

interface Organization {
  id?: string;
  name: string;
  kb_logo_url?: string;
  kb_logo_dark?: string;
  kb_logo_light?: string;
  logo_dark_url?: string;
  logo_light_url?: string;
  kb_privacy_mode?: 'public' | 'password' | 'employee_login';
  kb_shared_password?: string;
  kb_allow_guest_access?: boolean;
}

export function PublicKBViewer() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [track, setTrack] = useState<Track | null>(null);
  const [org, setOrg] = useState<Organization | null>(null);
  const [facts, setFacts] = useState<Fact[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [related, setRelated] = useState<RelatedTrack[]>([]);
  const [likes, setLikes] = useState<number>(0);
  const [hasLiked, setHasLiked] = useState<boolean>(false);
  
  // PIN login state
  const [showPinModal, setShowPinModal] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState<{ id: string; name: string } | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string>('');
  
  // UI state
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordValue, setPasswordValue] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [expandedFacts, setExpandedFacts] = useState<boolean>(false);
  const [showTranscript, setShowTranscript] = useState<boolean>(false);
  const [transcriptSearch, setTranscriptSearch] = useState<string>('');
  const [descriptionExpanded, setDescriptionExpanded] = useState<boolean>(false);
  
  // Brain Chat state
  const [brainDrawerOpen, setBrainDrawerOpen] = useState(false);
  
  // Dark mode state - auto-detect system preference
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    // Check localStorage first
    const stored = localStorage.getItem('kb_dark_mode');
    if (stored !== null) {
      return stored === 'true';
    }
    // Auto-detect system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Apply dark mode to document
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('kb_dark_mode', darkMode.toString());
  }, [darkMode]);

  // Check for existing PIN session on mount
  useEffect(() => {
    const session = getPinSession();
    if (session) {
      setLoggedInUser({
        id: session.userId,
        name: `${session.firstName} ${session.lastName}`.trim()
      });
      setUserId(session.userId);
    }
  }, []);

  useEffect(() => {
    loadArticle();
  }, []);

  async function loadArticle() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const slug = urlParams.get('slug');

      console.log('Loading article with slug:', slug);

      if (!slug) {
        setError('Invalid article link - no slug found');
        setLoading(false);
        return;
      }

      const url = `${getServerUrl()}/kb/public/${slug}`;
      console.log('Fetching from:', url);

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Response error:', errorText);

        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          errorData = { error: errorText };
        }

        // Handle specific error cases
        if (response.status === 404 || errorData.error === 'not_found') {
          setError('not_found');
        } else if (response.status === 401 && errorData.error === 'login_required') {
          // Employee login required - redirect to login page
          console.log('🔒 Employee login required, redirecting to login');
          window.location.href = `/login?returnUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`;
          return;
        } else if (errorData.error === 'organization_not_found') {
          setError('Knowledge Base not properly configured. Please contact support.');
        } else {
          setError(`Failed to load article: ${errorData.error || response.statusText}`);
        }
        setLoading(false);
        return;
      }

      const data = await response.json();
      console.log('Loaded data:', data);

      if (!data.track) {
        setError('not_found');
        setLoading(false);
        return;
      }

      setTrack(data.track);
      setOrg(data.org);
      setFacts(data.facts || []);
      setTags(data.tags || []);
      setAttachments(data.attachments || []);
      setRelated(data.related || []);

      // Set organizationId for PIN modal
      const orgId = data.track?.organization_id || data.org?.id || '';
      setOrganizationId(orgId);

      // Debug logo fields and guest access setting
      console.log('🖼️ Organization data:', {
        'logo_dark_url': data.org?.logo_dark_url,
        'logo_light_url': data.org?.logo_light_url,
        'kb_logo_dark (deprecated)': data.org?.kb_logo_dark,
        'kb_logo_light (deprecated)': data.org?.kb_logo_light,
        'org name': data.org?.name,
        'organizationId': orgId,
        'kb_allow_guest_access': data.org?.kb_allow_guest_access
      });

      // Auto-expand transcript for videos only (story uses StoryTranscript for video slides)
      if (data.track && data.track.type === 'video' && data.track.transcript) {
        setShowTranscript(true);
      }

      // Check privacy settings
      console.log('🔒🔒🔒 Privacy Mode Check:', {
        'org exists': !!data.org,
        'kb_privacy_mode': data.org?.kb_privacy_mode,
        'has password': !!data.org?.kb_shared_password,
        'password value (first 3 chars)': data.org?.kb_shared_password?.substring(0, 3),
        'will show prompt': data.org?.kb_privacy_mode === 'password'
      });

      if (data.org && data.org.kb_privacy_mode === 'password') {
        console.log('🔒 Setting showPasswordPrompt to TRUE');
        setShowPasswordPrompt(true);
      } else if (data.org && data.org.kb_privacy_mode === 'employee_login') {
        console.log('🔒 Redirecting to employee login');
        window.location.href = `/login?returnUrl=/kb/${slug}`;
        return;
      } else {
        console.log('✅ Public mode - no password required');
        
        // Check for existing PIN session
        const existingSession = getPinSession();
        
        if (existingSession) {
          // Restore logged in user from session
          setLoggedInUser({
            id: existingSession.userId,
            name: `${existingSession.firstName} ${existingSession.lastName}`.trim()
          });
          setUserId(existingSession.userId);
        } else {
          // No PIN session exists - ALWAYS show PIN modal
          // If kb_allow_guest_access is false, PIN is required (no guest option)
          // If kb_allow_guest_access is true, PIN is optional (guest option available)
          
          // If guest access is disabled, clear any anonymous session markers
          if (data.org && data.org.kb_allow_guest_access === false) {
            localStorage.removeItem('kb_anonymous_session');
            console.log('🔒 Guest access disabled - PIN required, clearing anonymous session');
          }
          
          // Always show PIN modal if no password prompt is needed
          if (!showPasswordPrompt) {
            const orgId = data.track?.organization_id || data.org?.id || '';
            console.log('🔒 Showing PIN modal - no PIN session found', {
              'kb_allow_guest_access': data.org?.kb_allow_guest_access,
              'organizationId': orgId,
              'hasOrgId': !!orgId
            });
            
            // Ensure organizationId is set before showing modal
            if (orgId) {
              setOrganizationId(orgId);
              // Small delay to ensure UI is ready
              setTimeout(() => {
                setShowPinModal(true);
              }, 300);
            } else {
              console.warn('⚠️ Cannot show PIN modal - organizationId not available');
            }
          }
        }
      }

      // Get userId from session directly (state might not be updated yet)
      const currentSession = getPinSession();
      const currentUserId = currentSession?.userId || userId || null;
      
      // Track page view (with userId if logged in) - this also records activity event via edge function
      trackPageView(data.track.id, currentUserId);

      const trackingOrgId = data.track?.organization_id || data.org?.id || null;
      const trackingOrgName = data.org?.name || null;
      void trackDemoActivityEvent(
        {
          eventType: 'page_view',
          path: window.location.pathname + window.location.search,
          referrer: document.referrer || undefined,
          metadata: {
            source: 'public_kb',
            trackType: data.track?.type || 'unknown',
          },
        },
        {
          organizationId: trackingOrgId,
          organizationName: trackingOrgName,
        }
      );
      void trackDemoActivityEvent(
        {
          eventType: 'track_open',
          path: '/kb/public',
          trackId: data.track.id,
          trackTitle: data.track.title,
          metadata: {
            source: 'public_kb',
            trackType: data.track?.type || 'unknown',
          },
        },
        {
          organizationId: trackingOrgId,
          organizationName: trackingOrgName,
        }
      );
      
      // Increment view count in tracks table (activity event is handled by trackPageView endpoint)
      try {
        console.log('📊 PublicKBViewer: Incrementing view count for track:', data.track.id);
        await crud.incrementTrackViews(data.track.id); // Don't pass userId - activity event handled by edge function
      } catch (error) {
        // Log error but don't block page load
        console.warn('Failed to increment track view count:', error);
      }
      
      // Load likes count and check if user already liked
      loadLikes(data.track.id);
      
      // Check localStorage for like state (persist across page loads)
      const likedKey = `kb_liked_${data.track.id}`;
      const hasLikedBefore = localStorage.getItem(likedKey) === 'true';
      if (hasLikedBefore) {
        setHasLiked(true);
        console.log('✅ PublicKBViewer: Restored like state from localStorage');
      }

      setLoading(false);
    } catch (err: any) {
      console.error('Error loading article:', err);
      setError(`Failed to load article: ${err.message}`);
      setLoading(false);
    }
  }

  async function trackPageView(trackId: string, userId?: string | null) {
    try {
      // Get userId from session directly (state might not be updated yet)
      const currentSession = getPinSession();
      const currentUserId = currentSession?.userId || userId || null;
      
      console.log('📊 PublicKBViewer: Tracking page view with userId:', currentUserId);
      
      await fetch(
        `${getServerUrl()}/kb/page-view`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            trackId: trackId,
            userId: currentUserId || null,
            referrer: document.referrer.includes('qr') ? 'qr_scan' : 'direct_link',
            userAgent: navigator.userAgent,
          }),
        }
      );
    } catch (err) {
      console.warn('Failed to track page view:', err);
    }
  }

  async function loadLikes(trackId: string) {
    try {
      // Get userId from session to check if user already liked
      const currentSession = getPinSession();
      const currentUserId = currentSession?.userId || userId || null;
      
      // Include userId in query to check if user already liked
      const url = currentUserId 
        ? `${getServerUrl()}/kb/likes/${trackId}?userId=${currentUserId}`
        : `${getServerUrl()}/kb/likes/${trackId}`;
      
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
        },
      });
      const data = await response.json();
      setLikes(data.likes || 0);
      
      // Set hasLiked state if user already liked (from database or localStorage)
      if (data.userLiked === true) {
        setHasLiked(true);
        localStorage.setItem(`kb_liked_${trackId}`, 'true');
        console.log('✅ PublicKBViewer: User already liked this track (from database)');
      } else if (localStorage.getItem(`kb_liked_${trackId}`) === 'true') {
        setHasLiked(true);
        console.log('✅ PublicKBViewer: User already liked this track (from localStorage)');
      }
    } catch (err) {
      console.warn('Failed to load likes:', err);
    }
  }

  async function handleLike() {
    if (!track || hasLiked) return;
    
    // Get userId from session directly (state might not be updated yet)
    const currentSession = getPinSession();
    const currentUserId = currentSession?.userId || userId || null;
    
    try {
      console.log('📊 PublicKBViewer: Liking track with userId:', currentUserId);
      const response = await fetch(
        `${getServerUrl()}/kb/like`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ trackId: track.id, userId: currentUserId || null }),
        }
      );
      const data = await response.json();
      if (data.success) {
        setLikes(data.likes);
        setHasLiked(true);
        localStorage.setItem(`kb_liked_${track.id}`, 'true');
        void trackDemoActivityEvent(
          {
            eventType: 'like',
            path: '/kb/public',
            trackId: track.id,
            trackTitle: track.title,
            metadata: { source: 'public_kb' },
          },
          {
            organizationId: track.organization_id || org?.id || null,
            organizationName: org?.name || null,
          }
        );
      }
    } catch (err) {
      console.error('Failed to like:', err);
    }
  }

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (passwordValue === org?.kb_shared_password) {
      setShowPasswordPrompt(false);
      setPasswordError(null);
    } else {
      setPasswordError(t('knowledgeBase.publicPasswordIncorrect'));
    }
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(window.location.href);
    alert(t('knowledgeBase.publicLinkCopied'));
  }

  function handlePinLoginSuccess(userId: string, userName: string) {
    setLoggedInUser({ id: userId, name: userName });
    setUserId(userId);
    setShowPinModal(false);
    
    // Track page view with userId
    if (track) {
      trackPageView(track.id, userId);
    }
  }

  function handleContinueAsGuest() {
    setShowPinModal(false);
    // Store anonymous session marker
    localStorage.setItem('kb_anonymous_session', 'true');
  }

  // Reset brain state when track changes
  useEffect(() => {
    if (!track) {
      setBrainDrawerOpen(false);
    }
  }, [track?.id]);

  // Simple Markdown to HTML converter for content that isn't already HTML
  function convertMarkdownToHtml(markdown: string): string {
    let html = markdown;

    // Check if content already has HTML tags
    const hasHtmlTags = /<\/?[a-z][\s\S]*>/i.test(markdown);
    if (!hasHtmlTags) {
      // Convert Markdown to HTML only if there are no existing HTML tags

      // Code blocks (```) - with inline styles for word wrapping
      html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre style="white-space: pre-wrap; word-wrap: break-word; word-break: break-word; overflow-wrap: break-word; max-width: 100%; overflow-x: hidden;"><code class="language-$1" style="white-space: pre-wrap; word-wrap: break-word; word-break: break-word;">$2</code></pre>');

      // Inline code (`) - with inline styles for word wrapping
      html = html.replace(/`([^`]+)`/g, '<code style="white-space: pre-wrap; word-wrap: break-word; word-break: break-word;">$1</code>');

      // Headers (# ## ### etc.)
      html = html.replace(/^######\s+(.*)$/gm, '<h6>$1</h6>');
      html = html.replace(/^#####\s+(.*)$/gm, '<h5>$1</h5>');
      html = html.replace(/^####\s+(.*)$/gm, '<h4>$1</h4>');
      html = html.replace(/^###\s+(.*)$/gm, '<h3>$1</h3>');
      html = html.replace(/^##\s+(.*)$/gm, '<h2>$1</h2>');
      html = html.replace(/^#\s+(.*)$/gm, '<h1>$1</h1>');

      // Bold (**text** or __text__)
      html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');

      // Italic (*text* or _text_)
      html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
      html = html.replace(/_([^_]+)_/g, '<em>$1</em>');

      // Blockquotes (> text)
      html = html.replace(/^>\s+(.*)$/gm, '<blockquote>$1</blockquote>');

      // Unordered lists (- item or * item)
      html = html.replace(/^[-*]\s+(.*)$/gm, '<li>$1</li>');
      html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

      // Ordered lists (1. item)
      html = html.replace(/^\d+\.\s+(.*)$/gm, '<li>$1</li>');

      // Links [text](url)
      html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

      // Line breaks (double newline = paragraph)
      html = html.replace(/\n\n+/g, '</p><p>');
      html = html.replace(/\n/g, '<br/>');

      // Wrap in paragraph if not already wrapped
      if (!html.startsWith('<')) {
        html = '<p>' + html + '</p>';
      }
    }

    return html;
  }

  function getTagColor(tag: Tag) {
    const colorMap: Record<string, string> = {
      red: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
      blue: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
      green: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
      yellow: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800',
      purple: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800',
      pink: 'bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-900/30 dark:text-pink-300 dark:border-pink-800',
      indigo: 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800',
      gray: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
    };
    return colorMap[tag.color] || colorMap.gray;
  }

  function formatDuration(minutes?: number) {
    if (!minutes) return '';
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function getFileIcon(fileType: string) {
    if (fileType.includes('pdf')) return <FileText className="w-5 h-5" />;
    if (fileType.includes('word') || fileType.includes('document')) return <FileText className="w-5 h-5" />;
    if (fileType.includes('excel') || fileType.includes('sheet')) return <Table className="w-5 h-5" />;
    if (fileType.includes('image')) return <ImageIcon className="w-5 h-5" />;
    if (fileType.includes('video')) return <VideoIcon className="w-5 h-5" />;
    return <Paperclip className="w-5 h-5" />;
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-950 gap-4">
        <div className="w-12 h-12 border-4 border-gray-200 dark:border-gray-800 border-t-[#FF6B35] rounded-full animate-spin" />
        <p className="text-gray-600 dark:text-gray-400">{t('knowledgeBase.publicLoading')}</p>
      </div>
    );
  }

  // Error state
  if (error) {
    const message =
      error === 'not_found'
        ? t('knowledgeBase.publicNotFound')
        : error;

    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-950 p-4">
        <div className="bg-white dark:bg-gray-900 rounded-xl p-8 shadow-sm text-center max-w-md">
          <svg
            className="w-12 h-12 mx-auto mb-4 text-red-500"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <h2 className="text-xl font-bold mb-4 dark:text-white">{t('knowledgeBase.publicErrorTitle')}</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{message}</p>
          <button
            onClick={() => window.close()}
            className="px-6 py-3 bg-gradient-to-r from-[#FF6B35] to-[#FF8C42] text-white rounded-lg hover:opacity-90 min-h-[44px]"
          >
            {t('knowledgeBase.close')}
          </button>
        </div>
      </div>
    );
  }

  // Password prompt
  if (showPasswordPrompt && track) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-950 p-4">
        <div className="bg-white dark:bg-gray-900 rounded-xl p-8 shadow-sm text-center max-w-md w-full">
          <svg
            className="w-12 h-12 mx-auto mb-4 text-gray-600 dark:text-gray-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <h2 className="text-xl font-bold mb-4 dark:text-white">{t('knowledgeBase.publicPasswordRequired')}</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {t('knowledgeBase.publicPasswordDesc')}
          </p>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={passwordValue}
                onChange={(e) => setPasswordValue(e.target.value)}
                placeholder={t('knowledgeBase.publicPasswordPlaceholder')}
                required
                className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6B35] min-h-[44px]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                {showPassword ? '👁️' : '👁️'}
              </button>
            </div>
            {passwordError && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
                {passwordError}
              </div>
            )}
            <button
              type="submit"
              className="w-full px-6 py-3 bg-gradient-to-r from-[#FF6B35] to-[#FF8C42] text-white rounded-lg hover:opacity-90 min-h-[44px]"
            >
              {t('knowledgeBase.publicPasswordSubmit')}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Article view
  if (!track) return null;

  const visibleFacts = expandedFacts ? facts : facts.slice(0, 5);
  const hasMoreFacts = facts.length > 5;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-200">
      {/* PIN Login Modal */}
      {showPinModal && organizationId && (
        <PinLoginModal
          isOpen={showPinModal}
          onClose={() => setShowPinModal(false)}
          onLoginSuccess={handlePinLoginSuccess}
          onContinueAsGuest={handleContinueAsGuest}
          organizationId={organizationId}
          allowGuestAccess={org?.kb_allow_guest_access ?? true}
        />
      )}

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-[52px]">
            {/* Logo */}
            <div className="flex-shrink-0">
              <img
                src={darkMode 
                  ? (org?.logo_dark_url || trikeLogoDark) 
                  : (org?.logo_light_url || trikeLogoDark)}
                alt={org?.name || 'Trike'}
                className="h-8 object-contain"
                onError={(e) => {
                  console.error('❌ Logo failed to load:', e.currentTarget.src);
                  console.log('🖼️ Logo debug:', {
                    darkMode,
                    'org?.logo_dark_url': org?.logo_dark_url,
                    'org?.logo_light_url': org?.logo_light_url,
                    'org name': org?.name
                  });
                }}
                onLoad={() => {
                  const logoUrl = darkMode 
                    ? (org?.logo_dark_url || trikeLogoDark) 
                    : (org?.logo_light_url || trikeLogoDark);
                  console.log('✅ Logo loaded:', logoUrl === trikeLogoDark ? 'Default Trike logo' : 'Custom org logo');
                }}
              />
            </div>

            {/* User Name (if logged in) and Action Buttons */}
            <div className="flex items-center gap-3">
              {/* Logged in user name */}
              {loggedInUser && (
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-lg">
                  <User className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">
                    {loggedInUser.name}
                  </span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
              {/* Ask Button */}
              {track && (
                <button
                  onClick={() => {
                    void trackDemoActivityEvent(
                      {
                        eventType: 'ask_open',
                        path: '/kb/public',
                        trackId: track.id,
                        trackTitle: track.title,
                        metadata: { source: 'public_kb' },
                      },
                      {
                        organizationId: track.organization_id || org?.id || null,
                        organizationName: org?.name || null,
                      }
                    );
                    setBrainDrawerOpen(true);
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-red-500 text-white hover:opacity-90 transition-opacity min-h-[44px]"
                  title={t('knowledgeBase.publicAskTitle')}
                >
                  <MessageSquare className="w-4 h-4" />
                  <span className="hidden sm:inline text-sm font-medium">{t('knowledgeBase.askButton')}</span>
                </button>
              )}

              {/* Like Button */}
              <button
                onClick={handleLike}
                disabled={hasLiked}
                className={`flex items-center gap-1 px-3 py-2 rounded-lg transition-all min-h-[44px] ${
                  hasLiked
                    ? 'bg-gradient-to-r from-[#FF6B35] to-[#FF8C42] text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                <ThumbsUp className={`w-4 h-4 ${hasLiked ? 'fill-current' : ''}`} />
                {likes > 0 && <span className="text-sm font-medium">{likes}</span>}
              </button>

              {/* Share Button */}
              <button
                onClick={handleCopyLink}
                className="p-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                title={t('knowledgeBase.publicShare')}
              >
                <Share2 className="w-4 h-4" />
              </button>

              {/* PDF download — same export as in-app Knowledge Base */}
              {track && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    void trackDemoActivityEvent(
                      {
                        eventType: 'download_pdf',
                        path: '/kb/public',
                        trackId: track.id,
                        trackTitle: track.title,
                        metadata: { source: 'public_kb' },
                      },
                      {
                        organizationId: track.organization_id || org?.id || null,
                        organizationName: org?.name || null,
                      }
                    );
                    await downloadKbTrackAsPdf(
                      { ...track, likes: likes ?? track.likes ?? 0 },
                      { toast, factsOverride: facts }
                    );
                  }}
                  className="min-h-[44px] px-3 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
                  title={t('knowledgeBase.downloadAsPdf')}
                >
                  <Download className="h-4 w-4" />
                </Button>
              )}

              {/* Dark Mode Toggle */}
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                title={darkMode ? t('knowledgeBase.publicLightMode') : t('knowledgeBase.publicDarkMode')}
              >
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>
      </header>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <article className="bg-white dark:bg-gray-900 rounded-xl shadow-sm overflow-hidden">
          {/* Title & Metadata */}
          <div className="p-6 sm:p-8 border-b border-gray-100 dark:border-gray-800">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-3 leading-tight">
              {track.title}
            </h1>

            {/* Metadata */}
            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4">
              <span className="capitalize font-medium">{track.type || 'Article'}</span>
              <span>•</span>
              <span>{(track as any).view_count || 0} {t('knowledgeBase.views')}</span>
              {track.duration_minutes && (
                <>
                  <span>•</span>
                  <span>{formatDuration(track.duration_minutes)}</span>
                </>
              )}
              <span>•</span>
              <span>
                {t('knowledgeBase.lastUpdated')} {new Date(track.updated_at).toLocaleDateString()}
              </span>
            </div>

            {/* Tags */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {tags.slice(0, 5).map((tag) => (
                  <span
                    key={tag.id}
                    className={`px-3 py-1 rounded-full text-xs font-medium border ${getTagColor(tag)}`}
                  >
                    {tag.name}
                  </span>
                ))}
                {tags.length > 5 && (
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                    +{tags.length - 5} more
                  </span>
                )}
              </div>
            )}

            {/* Description */}
            {track.description && (
              <div className="text-gray-600 dark:text-gray-400 leading-relaxed">
                <p className={`${!descriptionExpanded && track.description.length > 200 ? 'line-clamp-3' : ''}`}>
                  {track.description}
                </p>
                {track.description.length > 200 && (
                  <button
                    onClick={() => setDescriptionExpanded(!descriptionExpanded)}
                    className="text-[#FF6B35] text-sm font-medium mt-2 hover:underline min-h-[44px] flex items-center"
                  >
                    {descriptionExpanded ? t('knowledgeBase.publicShowLess') : t('knowledgeBase.publicReadMore')}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Text-to-Speech Player (article type only) */}
          {track.type === 'article' && (track.article_body || track.transcript) && (
            <div className="px-6 sm:px-8 pt-4">
              <TTSPlayer
                trackId={track.id}
                initialAudioUrl={(track as any).tts_audio_url || undefined}
                initialVoice={(track as any).tts_voice || 'alloy'}
                showVoiceSelector={false}
              />
            </div>
          )}

          {/* Video Player (video type only) */}
          {track.type === 'video' && track.content_url && (
            <div className="bg-black">
              <video
                src={track.content_url}
                controls
                playsInline
                controlsList="nodownload"
                className="w-full aspect-video"
              >
                {t('knowledgeBase.publicVideoNotSupported')}
              </video>
            </div>
          )}

          {/* Story carousel (slides) — same as in-app KB; transcript is JSON slide data, not shown raw */}
          {track.type === 'story' && (() => {
            const slides = parseStorySlidesFromTranscript(track.transcript);
            return slides.length > 0 ? (
              <div className="border-b border-gray-100 dark:border-gray-800">
                <div className="p-6 sm:p-8">
                  <StoryPreview slides={slides} />
                </div>
              </div>
            ) : null;
          })()}

          {/* Article Body (article type only) */}
          {track.type === 'article' && (track.article_body || track.transcript) && (
            <div className="p-6 sm:p-8 border-b border-gray-100 dark:border-gray-800 overflow-hidden">
              <div
                className="article-content prose prose-slate dark:prose-invert max-w-none prose-headings:font-bold prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-h4:text-lg prose-p:text-base prose-p:leading-relaxed prose-ul:list-disc prose-ul:pl-6 prose-ul:my-3 prose-ol:list-decimal prose-ol:pl-6 prose-ol:my-3 prose-li:text-base prose-li:my-0.5 prose-code:bg-gray-100 dark:prose-code:bg-gray-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono prose-pre:bg-gray-100 dark:prose-pre:bg-gray-800 prose-pre:p-4 prose-pre:rounded-lg prose-blockquote:border-l-4 prose-blockquote:border-[#FF6B35] prose-blockquote:pl-4 prose-blockquote:italic prose-strong:font-bold prose-a:text-[#FF6B35] prose-img:rounded-lg [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-3 [&_li]:my-0.5 [&_li>p]:my-0.5"
                style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}
                dangerouslySetInnerHTML={{ __html: convertMarkdownToHtml(track.article_body || track.transcript || '') }}
              />
            </div>
          )}

          {/* Attachments Section */}
          {attachments.length > 0 && (
            <div className="p-6 sm:p-8 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Paperclip className="w-5 h-5 text-[#FF6B35]" />
                {t('knowledgeBase.publicAttachments', { count: attachments.length })}
              </h2>
              <div className="space-y-3">
                {attachments.map((attachment) => (
                  <a
                    key={attachment.id}
                    href={attachment.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors min-h-[68px]"
                  >
                    <div className="text-gray-600 dark:text-gray-400">
                      {getFileIcon(attachment.file_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {attachment.filename}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {formatFileSize(attachment.file_size)} • {t('knowledgeBase.publicAttachmentAdded')} {new Date(attachment.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Video transcript (speech text) — not used for story JSON */}
          {track.type === 'video' && track.transcript && (
            <div className="p-6 sm:p-8 border-b border-gray-100 dark:border-gray-800">
              <button
                onClick={() => setShowTranscript(!showTranscript)}
                className="w-full flex items-center justify-between text-left mb-4 min-h-[44px]"
              >
                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#FF6B35]" />
                  {t('knowledgeBase.publicTranscript')}
                </h2>
                {showTranscript ? (
                  <ChevronUp className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                )}
              </button>

              {showTranscript && (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder={t('knowledgeBase.publicTranscriptSearch')}
                      value={transcriptSearch}
                      onChange={(e) => setTranscriptSearch(e.target.value)}
                      className="w-full pl-10 pr-10 py-3 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6B35] min-h-[44px]"
                    />
                    {transcriptSearch && (
                      <button
                        onClick={() => setTranscriptSearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 min-w-[44px] min-h-[44px] flex items-center justify-center"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 max-h-96 overflow-y-auto text-sm leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {transcriptSearch
                      ? track.transcript
                          .split(new RegExp(`(${transcriptSearch})`, 'gi'))
                          .map((part, i) =>
                            part.toLowerCase() === transcriptSearch.toLowerCase() ? (
                              <mark key={i} className="bg-yellow-200 dark:bg-yellow-800">
                                {part}
                              </mark>
                            ) : (
                              part
                            )
                          )
                      : track.transcript}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Story: video-slide transcripts only; image-only stories render nothing (no raw JSON) */}
          {track.type === 'story' && track.transcript && (
            <StoryTranscript
              storyData={track.transcript}
              trackId={track.id}
              projectId={projectId}
              publicAnonKey={publicAnonKey}
              readOnly
            />
          )}

          {/* Key Facts Section */}
          {facts.length > 0 && (
            <div className="p-6 sm:p-8 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-[#FF6B35]" />
                {t('knowledgeBase.keyFacts')}
              </h2>
              <ol className="space-y-3 list-decimal list-inside">
                {visibleFacts.map((fact) => (
                  <li key={fact.id} className="text-gray-700 dark:text-gray-300 leading-relaxed">
                    <span className="font-semibold">{fact.title}:</span> {fact.content}
                  </li>
                ))}
              </ol>
              {hasMoreFacts && (
                <button
                  onClick={() => setExpandedFacts(!expandedFacts)}
                  className="mt-4 text-[#FF6B35] font-medium flex items-center gap-2 hover:underline min-h-[44px]"
                >
                  {expandedFacts ? (
                    <>
                      <ChevronUp className="w-4 h-4" />
                      {t('knowledgeBase.publicShowLess')}
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4" />
                      {t('knowledgeBase.publicShowAllFacts', { count: facts.length })}
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Related Resources */}
          {related.length > 0 && (
            <div className="p-6 sm:p-8 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-[#FF6B35]" />
                {t('knowledgeBase.publicRelatedResources')}
              </h2>
              <ul className="space-y-3">
                {related.map((item) => (
                  <li key={item.id}>
                    <a
                      href={`?slug=${item.kb_slug}`}
                      className="text-[#FF6B35] hover:underline font-medium flex items-start gap-2 min-h-[44px] py-2"
                    >
                      <span className="mt-1">•</span>
                      <span className="flex-1">
                        {item.title}
                        {item.duration_minutes && (
                          <span className="text-gray-500 dark:text-gray-400 text-sm ml-2">
                            ({formatDuration(item.duration_minutes)})
                          </span>
                        )}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </article>

        {/* Footer */}
        <footer className="mt-8 pb-8 border-t border-gray-200 dark:border-gray-800 pt-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
            <p className="text-gray-400 dark:text-gray-500">© {new Date().getFullYear()} Trike.co</p>
            <p className="text-[#FF6B35] flex items-center gap-2">
              <span className="inline-block w-4 h-4 border border-[#FF6B35] rounded-full flex items-center justify-center text-xs">ⓘ</span>
              {t('knowledgeBase.publicBetaNotice')}
            </p>
          </div>
        </footer>
      </div>

      {/* Brain Chat Modal */}
      <BrainChatDrawer
        isOpen={brainDrawerOpen && !!track}
        onOpenChange={setBrainDrawerOpen}
        track={track}
        isPublicView={true}
        onNavigateToTrack={(id) => {
          // In public view, we might navigate by changing the slug in URL or state
          // For now, if it's the same view, we can just fetch the track if needed
          // but usually public view is track-specific.
          console.log('Navigate to source:', id);
        }}
      />
    </div>
  );
}