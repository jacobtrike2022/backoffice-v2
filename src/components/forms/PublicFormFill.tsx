/**
 * Public Form Fill - Standalone no-auth form submission page
 * Accessed via ?form_id={uuid} URL param — no authentication required
 * Mobile-optimized, dark/light theme aware, org-branded
 */

import React, { useEffect, useState } from 'react';
import { publicAnonKey, getServerUrl } from '../../utils/supabase/info';
import { CheckCircle, Moon, Sun, AlertTriangle, ClipboardList, Loader2 } from 'lucide-react';
import trikeLogoDark from '../../assets/trike-logo.png';
import { FormRenderer, FormBlockData } from './shared/FormRenderer';

const EDGE_URL = getServerUrl();

interface FormSection {
  id: string;
  title?: string;
  description?: string;
  order?: number;
}

interface PublicForm {
  id: string;
  title: string;
  description?: string;
  status: string;
  requires_approval?: boolean;
}

interface OrgBranding {
  name: string;
  logo_dark_url?: string;
  logo_light_url?: string;
}

interface FormData {
  form: PublicForm;
  blocks: FormBlockData[];
  sections: FormSection[];
  org: OrgBranding;
}

export function PublicFormFill() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [startTime] = useState<string>(new Date().toISOString());

  // Dark mode — auto-detect system preference, persist to localStorage
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const stored = localStorage.getItem('kb_dark_mode');
    if (stored !== null) return stored === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Apply dark mode class to document root
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('kb_dark_mode', darkMode.toString());
  }, [darkMode]);

  useEffect(() => {
    loadForm();
  }, []);

  async function loadForm() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const formId = urlParams.get('form_id');

      if (!formId) {
        setError('no_form_id');
        setLoading(false);
        return;
      }

      const anonKey = publicAnonKey || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
      const url = `${EDGE_URL}/forms/public/${formId}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${anonKey}`,
          apikey: anonKey,
        },
      });

      if (!response.ok) {
        let errorData: { error?: string } = {};
        try {
          errorData = await response.json();
        } catch {
          errorData = { error: response.statusText };
        }

        if (response.status === 404 || errorData.error === 'not_found') {
          setError('not_found');
        } else if (errorData.error === 'not_published') {
          setError('not_published');
        } else {
          setError(errorData.error || 'Failed to load form');
        }
        setLoading(false);
        return;
      }

      const data = await response.json();

      if (!data.form) {
        setError('not_found');
        setLoading(false);
        return;
      }

      setFormData(data as FormData);
      setLoading(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('Error loading form:', err);
      setError(`Failed to load form: ${message}`);
      setLoading(false);
    }
  }

  async function handleSubmit(answers: Record<string, unknown>) {
    if (!formData) return;

    const urlParams = new URLSearchParams(window.location.search);
    const formId = urlParams.get('form_id');
    if (!formId) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const anonKey = publicAnonKey || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
      const url = `${EDGE_URL}/forms/public/${formId}/submit`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${anonKey}`,
          apikey: anonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          answers,
          start_time: startTime,
          device_type: 'web',
        }),
      });

      if (!response.ok) {
        let errorData: { error?: string } = {};
        try {
          errorData = await response.json();
        } catch {
          errorData = { error: response.statusText };
        }
        throw new Error(errorData.error || 'Submission failed');
      }

      setSubmitted(true);
      // Scroll to top so the success message is immediately visible on long forms
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('Error submitting form:', err);
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  }

  const org = formData?.org;
  const logoSrc = darkMode
    ? (org?.logo_dark_url || trikeLogoDark)
    : (org?.logo_light_url || trikeLogoDark);

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-950 gap-4">
        <div className="w-12 h-12 border-4 border-gray-200 dark:border-gray-800 border-t-primary rounded-full animate-spin" />
        <p className="text-gray-600 dark:text-gray-400 text-sm">Loading form…</p>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (error) {
    const messages: Record<string, string> = {
      not_found: 'This form is no longer available. Please contact your manager.',
      not_published: 'This form is not currently accepting responses.',
      no_form_id: 'No form specified. Please use the link provided to you.',
    };
    const message = messages[error] || error;

    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-950 p-4">
        <div className="bg-white dark:bg-gray-900 rounded-xl p-8 shadow-sm text-center max-w-md w-full">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-red-500" />
          <h2 className="text-xl font-bold mb-3 text-gray-900 dark:text-white">Form Not Available</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{message}</p>
          <button
            onClick={() => window.close()}
            className="px-6 py-3 bg-brand-gradient text-white rounded-lg hover:opacity-90 min-h-[44px] font-medium"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  if (!formData) return null;

  const { form, blocks } = formData;

  // ── Success state ──────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-200">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="max-w-2xl mx-auto px-4 sm:px-6">
            <div className="flex items-center justify-between h-[52px]">
              <div className="flex-shrink-0">
                <img
                  src={logoSrc}
                  alt={org?.name || 'Logo'}
                  className="h-8 object-contain"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = trikeLogoDark;
                  }}
                />
              </div>
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Toggle dark mode"
              >
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </header>

        {/* Success card */}
        <div className="flex items-center justify-center min-h-[calc(100vh-52px)] p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-10 shadow-sm text-center max-w-md w-full">
            <div className="flex items-center justify-center mb-5">
              <div className="h-20 w-20 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center animate-in zoom-in duration-500">
                <CheckCircle className="w-12 h-12 text-green-500" />
              </div>
            </div>
            <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">
              Submission received!
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-4 text-sm">
              Your response has been recorded successfully.
            </p>
            {org?.name && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">{org.name}</p>
            )}
            {form.requires_approval && (
              <div className="mt-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
                This form requires approval. A manager will review your submission.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Form view ──────────────────────────────────────────────────────────────
  const sections = formData.sections || [];
  const hasSections = sections.length > 1;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-200">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-[52px]">
            {/* Org logo */}
            <div className="flex-shrink-0">
              <img
                src={logoSrc}
                alt={org?.name || 'Logo'}
                className="h-8 object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = trikeLogoDark;
                }}
              />
            </div>

            {/* Dark mode toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Toggle dark mode"
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>
        {/* Section progress bar */}
        {hasSections && (
          <div className="h-1 bg-gray-100 dark:bg-gray-800">
            <div
              className="h-full bg-brand-gradient transition-all duration-500"
              style={{ width: `${Math.round((1 / sections.length) * 100)}%` }}
            />
          </div>
        )}
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 pb-16">
        {/* Form title & description */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardList className="w-5 h-5 text-primary flex-shrink-0" />
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white leading-tight">
              {form.title}
            </h1>
          </div>
          {form.description && (
            <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
              {form.description}
            </p>
          )}
          {org?.name && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">{org.name}</p>
          )}
        </div>

        {/* Form renderer */}
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-5 sm:p-6">
          {submitError && (
            <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {submitError}
            </div>
          )}
          {/* FormRenderer renders all field blocks and its own Submit button when onSubmit is provided */}
          {/* We pass readOnly=false always so the Submit button stays visible; submitting state is */}
          {/* handled inside handleSubmit which prevents double-submit via the submitting guard */}
          <FormRenderer
            blocks={blocks}
            onSubmit={handleSubmit}
            readOnly={false}
          />
          {submitting && (
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400 py-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              Submitting your response…
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
