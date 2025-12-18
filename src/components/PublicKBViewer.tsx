/**
 * Public Knowledge Base Viewer - Phase 1 Mobile Optimization
 * Standalone viewer for KB articles accessed via QR codes
 * Completely bypasses authentication and dashboard
 * Mobile-optimized for quick reference material
 */

import { useEffect, useState } from 'react';
import { projectId, publicAnonKey } from '../utils/supabase/info';
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
  User
} from 'lucide-react';
import trikeLogoDark from 'figma:asset/d284bc7ee411198fb15ff6e1e42fef256815e21f.png';
import { TTSPlayer } from './content/TTSPlayer';
import { PinLoginModal } from './public/PinLoginModal';
import { getPinSession } from '@/lib/crud';

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
  transcript?: string;
  duration_minutes?: number;
  updated_at: string;
  organization_id?: string;
}

interface Organization {
  id?: string;
  name: string;
  kb_logo_url?: string;
  kb_logo_dark?: string;
  kb_logo_light?: string;
  kb_privacy_mode?: 'public' | 'password' | 'employee_login';
  kb_shared_password?: string;
}

export function PublicKBViewer() {
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
  
  // UI state
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordValue, setPasswordValue] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [expandedFacts, setExpandedFacts] = useState<boolean>(false);
  const [showTranscript, setShowTranscript] = useState<boolean>(false);
  const [transcriptSearch, setTranscriptSearch] = useState<string>('');
  const [descriptionExpanded, setDescriptionExpanded] = useState<boolean>(false);
  
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

      const url = `https://${projectId}.supabase.co/functions/v1/make-server-2858cc8b/kb/public/${slug}`;
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

      // Auto-expand transcript for stories and videos
      if (data.track && (data.track.type === 'story' || data.track.type === 'video') && data.track.transcript) {
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
        
        // Show PIN login modal if no session exists (only for public mode)
        // Don't show if password prompt is needed or if already logged in
        const existingSession = getPinSession();
        if (!existingSession && !showPasswordPrompt) {
          // Small delay to ensure UI is ready
          setTimeout(() => {
            setShowPinModal(true);
          }, 300);
        } else if (existingSession) {
          // Restore logged in user from session
          setLoggedInUser({
            id: existingSession.userId,
            name: `${existingSession.firstName} ${existingSession.lastName}`.trim()
          });
          setUserId(existingSession.userId);
        }
      }

      // Track page view (with userId if logged in)
      trackPageView(data.track.id, userId);
      
      // Load likes count
      loadLikes(data.track.id);

      setLoading(false);
    } catch (err: any) {
      console.error('Error loading article:', err);
      setError(`Failed to load article: ${err.message}`);
      setLoading(false);
    }
  }

  async function trackPageView(trackId: string, userId?: string | null) {
    try {
      await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-2858cc8b/kb/page-view`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            trackId: trackId,
            userId: userId || null,
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
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-2858cc8b/kb/likes/${trackId}`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );
      const data = await response.json();
      setLikes(data.likes || 0);
    } catch (err) {
      console.warn('Failed to load likes:', err);
    }
  }

  async function handleLike() {
    if (!track || hasLiked) return;
    
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-2858cc8b/kb/like`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ trackId: track.id }),
        }
      );
      const data = await response.json();
      if (data.success) {
        setLikes(data.likes);
        setHasLiked(true);
        localStorage.setItem(`kb_liked_${track.id}`, 'true');
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
      setPasswordError('Incorrect password');
    }
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(window.location.href);
    alert('Link copied to clipboard!');
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

  // Get organizationId from track or org
  const organizationId = track?.organization_id || org?.id || '';

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
        <p className="text-gray-600 dark:text-gray-400">Loading article...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    const message =
      error === 'not_found'
        ? 'This reference material is no longer available. Please contact your manager for the most up-to-date information.'
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
          <h2 className="text-xl font-bold mb-4 dark:text-white">Reference Not Available</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{message}</p>
          <button
            onClick={() => window.close()}
            className="px-6 py-3 bg-gradient-to-r from-[#FF6B35] to-[#FF8C42] text-white rounded-lg hover:opacity-90 min-h-[44px]"
          >
            Close
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
          <h2 className="text-xl font-bold mb-4 dark:text-white">Password Required</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            This reference material is password protected. Please enter the password to continue.
          </p>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={passwordValue}
                onChange={(e) => setPasswordValue(e.target.value)}
                placeholder="Enter password"
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
              Submit
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
        />
      )}

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-[52px]">
            {/* Logo */}
            <div className="flex-shrink-0">
              <img
                src={darkMode ? (org?.kb_logo_dark || trikeLogoDark) : (org?.kb_logo_light || trikeLogoDark)}
                alt={org?.name || 'Trike'}
                className="h-8 object-contain"
                onError={(e) => {
                  console.error('❌ Logo failed to load:', e.currentTarget.src);
                  console.log('🔍 trikeLogoDark value:', trikeLogoDark);
                  console.log('🔍 org data:', org);
                }}
                onLoad={() => {
                  console.log('✅ Logo loaded successfully');
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
                title="Share"
              >
                <Share2 className="w-4 h-4" />
              </button>

              {/* Dark Mode Toggle */}
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                title={darkMode ? 'Light mode' : 'Dark mode'}
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
              <span>{(track as any).view_count || 0} views</span>
              {track.duration_minutes && (
                <>
                  <span>•</span>
                  <span>{formatDuration(track.duration_minutes)}</span>
                </>
              )}
              <span>•</span>
              <span>
                Updated {new Date(track.updated_at).toLocaleDateString()}
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
                    {descriptionExpanded ? 'Show less' : 'Read more'}
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
                initialAudioUrl={undefined}
                initialVoice={undefined}
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
                Your browser does not support video playback.
              </video>
            </div>
          )}

          {/* Article Body (article type only) */}
          {track.type === 'article' && (track.article_body || track.transcript) && (
            <div className="p-6 sm:p-8 border-b border-gray-100 dark:border-gray-800">
              <div
                className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-bold prose-p:leading-relaxed prose-a:text-[#FF6B35] prose-img:rounded-lg"
                dangerouslySetInnerHTML={{ __html: track.article_body || track.transcript || '' }}
              />
            </div>
          )}

          {/* Attachments Section */}
          {attachments.length > 0 && (
            <div className="p-6 sm:p-8 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Paperclip className="w-5 h-5 text-[#FF6B35]" />
                Attachments ({attachments.length})
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
                        {formatFileSize(attachment.file_size)} • Added {new Date(attachment.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Interactive Transcript (video and story types only, NOT article) */}
          {track.transcript && track.type !== 'article' && (
            <div className="p-6 sm:p-8 border-b border-gray-100 dark:border-gray-800">
              <button
                onClick={() => setShowTranscript(!showTranscript)}
                className="w-full flex items-center justify-between text-left mb-4 min-h-[44px]"
              >
                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#FF6B35]" />
                  Transcript
                </h2>
                {showTranscript ? (
                  <ChevronUp className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                )}
              </button>

              {showTranscript && (
                <div className="space-y-4">
                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search in transcript..."
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

                  {/* Transcript Text */}
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

          {/* Key Facts Section */}
          {facts.length > 0 && (
            <div className="p-6 sm:p-8 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-[#FF6B35]" />
                Key Facts
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
                      Show less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4" />
                      Show all {facts.length} facts
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
                Related Resources
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
            <p className="text-gray-400 dark:text-gray-500">© 2025 Trike.co</p>
            <p className="text-[#FF6B35] flex items-center gap-2">
              <span className="inline-block w-4 h-4 border border-[#FF6B35] rounded-full flex items-center justify-center text-xs">ⓘ</span>
              BETA PREVIEW — Some features may have limited functionality
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}