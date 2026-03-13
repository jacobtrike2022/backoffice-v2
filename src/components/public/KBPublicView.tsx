/**
 * LEGACY PUBLIC KNOWLEDGE BASE VIEWER
 * ---------------------------------------------------------------------------
 * This was the original public KB viewer implementation.
 * It is referenced in older QR/KB docs but is NOT used by `App.tsx` anymore.
 *
 * Current, production public KB flow:
 * - React component: `PublicKBViewer` (`src/components/PublicKBViewer.tsx`)
 * - Backend: `supabase/functions/trike-server/index.ts` (KB endpoints under `/kb/*`)
 *
 * Keep this file only as a historical/reference implementation.
 */

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  AlertCircle, 
  Lock, 
  Eye, 
  EyeOff,
  Video,
  FileText
} from 'lucide-react';
import { getEffectiveThumbnailUrl } from '../../lib/crud/tracks';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import trikeLogoDark from '../../assets/trike-logo.png';

interface Track {
  id: string;
  title: string;
  description: string;
  content_url?: string;
  article_body?: string;
  type: 'video' | 'article' | 'story';
  thumbnail_url?: string;
  status: string;
  show_in_knowledge_base: boolean;
  organization_id: string;
  created_at: string;
  updated_at: string;
}

interface Organization {
  id: string;
  name: string;
  kb_privacy_mode: 'public' | 'password' | 'employee_login';
  kb_shared_password?: string;
  kb_logo_dark?: string;
  kb_logo_light?: string;
}

export function KBPublicView() {
  // Get slug from URL path (e.g., /kb/article-slug-abc123)
  const slug = window.location.pathname.split('/kb/')[1] || '';

  const [track, setTrack] = useState<Track | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Password protection
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    loadArticle();
  }, [slug]);

  async function loadArticle() {
    if (!slug) {
      setError('Invalid article link');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch track by kb_slug
      const { data: trackData, error: trackError } = await supabase
        .from('tracks')
        .select('*')
        .eq('kb_slug', slug)
        .eq('show_in_knowledge_base', true)
        .eq('status', 'published')
        .single();

      if (trackError || !trackData) {
        setError('not_found');
        setLoading(false);
        return;
      }

      setTrack(trackData);

      // Fetch organization settings
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('id, name, kb_privacy_mode, kb_shared_password, kb_logo_dark, kb_logo_light')
        .eq('id', trackData.organization_id)
        .single();

      if (orgError || !orgData) {
        // Default to public if org not found
        setIsAuthenticated(true);
        setLoading(false);
        return;
      }

      setOrganization(orgData);

      // Check privacy settings
      if (orgData.kb_privacy_mode === 'public') {
        setIsAuthenticated(true);
      } else if (orgData.kb_privacy_mode === 'password') {
        setNeedsPassword(true);
        setIsAuthenticated(false);
      } else if (orgData.kb_privacy_mode === 'employee_login') {
        // Redirect to login with return URL
        window.location.href = `/login?returnUrl=/kb/${slug}`;
        return;
      }

      setLoading(false);

      // Optional: Track page view
      trackPageView(trackData.id);

    } catch (err: any) {
      console.error('Error loading KB article:', err);
      setError('Failed to load article');
      setLoading(false);
    }
  }

  async function trackPageView(trackId: string) {
    try {
      await supabase
        .from('kb_page_views')
        .insert({
          track_id: trackId,
          referrer: document.referrer.includes('qr') ? 'qr_scan' : 'direct_link',
          user_agent: navigator.userAgent,
        });
    } catch (err) {
      // Silent fail - analytics shouldn't block the user
      console.warn('Failed to track page view:', err);
    }
  }

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);

    if (!organization?.kb_shared_password) {
      setPasswordError('Password not configured');
      return;
    }

    if (password === organization.kb_shared_password) {
      setIsAuthenticated(true);
      setNeedsPassword(false);
    } else {
      setPasswordError('Incorrect password');
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#F64A05] mx-auto mb-4" />
          <p className="text-muted-foreground">Loading article...</p>
        </div>
      </div>
    );
  }

  // Error: Article not found
  if (error === 'not_found' || !track) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-500">
              <AlertCircle className="h-5 w-5" />
              Reference Not Available
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              This reference material is no longer available. Please contact your manager 
              for the most up-to-date information.
            </p>
            <Button 
              variant="outline" 
              onClick={() => window.close()}
              className="w-full"
            >
              Close
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error: General error
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button 
              variant="outline" 
              onClick={loadArticle}
              className="w-full"
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Password protection overlay
  if (needsPassword && !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-[#F64A05]" />
              Password Required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              This reference material is password protected. Please enter the password to continue.
            </p>

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="pr-10"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {passwordError && (
                <Alert variant="destructive">
                  <AlertDescription>{passwordError}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full">
                Submit
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main content view
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with org branding */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <img 
            src={organization?.kb_logo_light || trikeLogoDark} 
            alt={organization?.name || 'Trike'}
            className="h-12 object-contain"
          />
        </div>
      </div>

      {/* Article content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <article className="bg-white rounded-lg shadow-sm overflow-hidden">
          {/* Thumbnail */}
          <div className="w-full aspect-video bg-gray-100">
            <img 
              src={getEffectiveThumbnailUrl(track.thumbnail_url)} 
              alt={track.title}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Content */}
          <div className="p-6 md:p-8 space-y-6">
            {/* Title */}
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                {track.type === 'video' && <Video className="h-4 w-4" />}
                {track.type === 'article' && <FileText className="h-4 w-4" />}
                <span className="capitalize">{track.type}</span>
              </div>
              <h1 className="text-3xl md:text-4xl">{track.title}</h1>
            </div>

            {/* Description */}
            {track.description && (
              <p className="text-lg text-muted-foreground">
                {track.description}
              </p>
            )}

            {/* Video Player */}
            {track.type === 'video' && track.content_url && (
              <div className="aspect-video bg-black rounded-lg overflow-hidden">
                <video 
                  src={track.content_url} 
                  controls
                  className="w-full h-full"
                  playsInline
                >
                  Your browser does not support video playback.
                </video>
              </div>
            )}

            {/* Article Body */}
            {track.type === 'article' && track.article_body && (
              <div
                className="article-content prose prose-lg prose-slate dark:prose-invert max-w-none prose-headings:font-bold prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-h4:text-lg prose-p:text-base prose-p:leading-relaxed prose-ul:list-disc prose-ol:list-decimal prose-li:text-base prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono prose-code:whitespace-pre-wrap prose-code:break-words prose-pre:bg-muted prose-pre:p-4 prose-pre:rounded-lg prose-pre:whitespace-pre-wrap prose-pre:break-words prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:pl-4 prose-blockquote:italic prose-strong:font-bold prose-a:text-primary prose-img:rounded-lg"
                dangerouslySetInnerHTML={{ __html: track.article_body }}
              />
            )}
          </div>
        </article>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-muted-foreground">
          <p>Powered by Trike</p>
        </div>
      </div>
    </div>
  );
}