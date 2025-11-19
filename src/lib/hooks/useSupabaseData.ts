// ============================================================================
// EXTENDED SUPABASE HOOKS FOR ALL COMPONENTS
// ============================================================================

import { useState, useEffect } from 'react';
import * as crud from '../crud';

/**
 * Hook to get user progress overview
 */
export function useUserProgress(userId: string | null) {
  const [progress, setProgress] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    async function fetchProgress() {
      try {
        const data = await crud.getUserProgressOverview(userId);
        setProgress(data);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    fetchProgress();
  }, [userId]);

  return { progress, loading, error };
}

/**
 * Hook to get KB articles with filters
 */
export function useKBArticles(filters?: Parameters<typeof crud.getKBArticles>[0]) {
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchArticles = async () => {
    try {
      setLoading(true);
      const data = await crud.getKBArticles(filters);
      setArticles(data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArticles();
  }, [JSON.stringify(filters)]);

  return { articles, loading, error, refetch: fetchArticles };
}

/**
 * Hook to get user certifications
 */
export function useUserCertifications(userId: string | null) {
  const [certifications, setCertifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    async function fetchCertifications() {
      try {
        const data = await crud.getUserCertifications(userId);
        setCertifications(data);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    fetchCertifications();
  }, [userId]);

  return { certifications, loading, error };
}

/**
 * Hook to get expiring certifications (for compliance dashboard)
 */
export function useExpiringCertifications(daysThreshold: number = 30) {
  const [certifications, setCertifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchExpiring() {
      try {
        const data = await crud.getExpiringCertifications(daysThreshold);
        setCertifications(data);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    fetchExpiring();
  }, [daysThreshold]);

  return { certifications, loading, error };
}

/**
 * Hook to get recent activity
 */
export function useRecentActivity(organizationId: string | null, limit: number = 50) {
  const [activity, setActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    async function fetchActivity() {
      try {
        const data = await crud.getRecentActivity(organizationId, limit);
        setActivity(data);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    fetchActivity();
  }, [organizationId, limit]);

  return { activity, loading, error };
}

/**
 * Hook to get KB categories
 */
export function useKBCategories() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const data = await crud.getKBCategories();
      setCategories(data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  return { categories, loading, error, refetch: fetchCategories };
}

/**
 * Hook to get form submissions
 */
export function useFormSubmissions(formId: string | null, filters?: { status?: string }) {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSubmissions = async () => {
    if (!formId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await crud.getFormSubmissions(formId, filters);
      setSubmissions(data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, [formId, JSON.stringify(filters)]);

  return { submissions, loading, error, refetch: fetchSubmissions };
}
