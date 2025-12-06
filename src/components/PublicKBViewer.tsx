/**
 * Public Knowledge Base Viewer
 * Standalone viewer for KB articles accessed via QR codes
 * Completely bypasses authentication and dashboard
 */

import { useEffect, useState } from 'react';
import { projectId, publicAnonKey } from '../utils/supabase/info';

interface Track {
  id: string;
  title: string;
  description?: string;
  type: 'article' | 'video' | 'story' | 'checkpoint';
  thumbnail_url?: string;
  content_url?: string;
  article_body?: string;
  updated_at: string;
}

interface Organization {
  name: string;
  kb_logo_url?: string;
  kb_privacy_mode?: 'public' | 'password' | 'employee_login';
  kb_shared_password?: string;
}

export function PublicKBViewer() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [track, setTrack] = useState<Track | null>(null);
  const [org, setOrg] = useState<Organization | null>(null);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordValue, setPasswordValue] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    loadArticle();
  }, []);

  async function loadArticle() {
    try {
      // Get slug from URL query parameter
      const urlParams = new URLSearchParams(window.location.search);
      const slug = urlParams.get('slug');

      console.log('Loading article with slug:', slug);

      if (!slug) {
        setError('Invalid article link - no slug found');
        setLoading(false);
        return;
      }

      // Fetch track and organization data from server endpoint
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-2858cc8b/kb/public/${slug}`;
      console.log('Fetching from:', url);

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
        },
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Response error:', errorText);

        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          errorData = { error: errorText };
        }

        if (response.status === 404 || errorData.error === 'not_found') {
          setError('not_found');
        } else {
          setError(`Failed to load article: ${errorData.error || response.statusText}`);
        }
        setLoading(false);
        return;
      }

      const data = await response.json();
      console.log('Loaded track:', data.track);
      console.log('Loaded org:', data.org);

      if (!data.track) {
        setError('not_found');
        setLoading(false);
        return;
      }

      setTrack(data.track);
      setOrg(data.org);

      // Check privacy settings
      if (data.org && data.org.kb_privacy_mode === 'password') {
        setShowPasswordPrompt(true);
      } else if (data.org && data.org.kb_privacy_mode === 'employee_login') {
        window.location.href = `/login?returnUrl=/kb/${slug}`;
        return;
      }

      // Track page view
      trackPageView(data.track.id);

      setLoading(false);
    } catch (err: any) {
      console.error('Error loading article:', err);
      setError(`Failed to load article: ${err.message}`);
      setLoading(false);
    }
  }

  async function trackPageView(trackId: string) {
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
            referrer: document.referrer.includes('qr') ? 'qr_scan' : 'direct_link',
            userAgent: navigator.userAgent,
          }),
        }
      );
    } catch (err) {
      console.warn('Failed to track page view:', err);
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

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 gap-4">
        <div className="w-12 h-12 border-4 border-gray-200 border-t-[#F64A05] rounded-full animate-spin" />
        <p className="text-gray-600">Loading article...</p>
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
      <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
        <div className="bg-white rounded-xl p-8 shadow-sm text-center max-w-md">
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
          <h2 className="mb-4">Reference Not Available</h2>
          <p className="text-gray-600 mb-6">{message}</p>
          <button
            onClick={() => window.close()}
            className="px-6 py-3 bg-[#F64A05] text-white rounded-lg hover:bg-[#d93d04]"
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
      <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
        <div className="bg-white rounded-xl p-8 shadow-sm text-center max-w-md w-full">
          <svg
            className="w-12 h-12 mx-auto mb-4 text-gray-600"
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
          <h2 className="mb-4">Password Required</h2>
          <p className="text-gray-600 mb-6">
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
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F64A05]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? '👁️' : '👁️'}
              </button>
            </div>
            {passwordError && (
              <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
                {passwordError}
              </div>
            )}
            <button
              type="submit"
              className="w-full px-6 py-3 bg-[#F64A05] text-white rounded-lg hover:bg-[#d93d04]"
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Logo Header */}
      {org?.kb_logo_url && (
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
            <img
              src={org.kb_logo_url}
              alt={org.name}
              className="h-10 sm:h-12 object-contain"
            />
          </div>
        </div>
      )}

      {/* Article Content */}
      <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <article className="bg-white rounded-xl shadow-sm overflow-hidden">
          {/* Thumbnail */}
          {track.thumbnail_url && (
            <img
              src={track.thumbnail_url}
              alt={track.title}
              className="w-full aspect-video object-cover bg-gray-100"
            />
          )}

          {/* Content */}
          <div className="p-6 sm:p-8">
            {/* Meta */}
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-6">
              <span className="capitalize">{track.type || 'Article'}</span>
              <span>•</span>
              <span>
                Last updated {new Date(track.updated_at).toLocaleDateString()}
              </span>
            </div>

            {/* Title */}
            <h1 className="mb-4">{track.title}</h1>

            {/* Description */}
            {track.description && (
              <p className="text-gray-600 mb-8 text-lg">{track.description}</p>
            )}

            {/* Video */}
            {track.type === 'video' && track.content_url && (
              <video
                src={track.content_url}
                controls
                playsInline
                className="w-full rounded-lg bg-black mb-8"
              >
                Your browser does not support video playback.
              </video>
            )}

            {/* Article Body */}
            {track.type === 'article' && track.article_body && (
              <div
                className="prose prose-slate max-w-none prose-headings:font-bold prose-p:leading-relaxed prose-a:text-[#F64A05] prose-img:rounded-lg"
                dangerouslySetInnerHTML={{ __html: track.article_body }}
              />
            )}
          </div>
        </article>

        {/* Footer */}
        <div className="text-center py-8 text-sm text-gray-500">
          <p>Powered by Trike</p>
        </div>
      </div>
    </div>
  );
}