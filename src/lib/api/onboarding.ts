/**
 * Onboarding API Client
 *
 * Handles all API calls for the self-service onboarding flow.
 * These endpoints don't require authentication.
 */

import { getServerUrl, publicAnonKey } from '../../utils/supabase/info';

const API_BASE = getServerUrl();

interface ApiResponse<T> {
  success: boolean;
  error?: string;
  data?: T;
}

interface StartSessionResponse {
  session_token: string;
  session_id: string;
  current_step: string;
}

interface EnrichedCompanyData {
  website: string;
  company_name: string;
  logo_url?: string;
  brand_colors?: {
    primary?: string;
    secondary?: string;
  };
  industry?: string;
  services?: string[];
  operating_states?: string[];
  description?: string;
  headquarters?: {
    street?: string;
    city?: string;
    state?: string;
  };
  stores?: Array<{
    name?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    phone?: string;
    lat?: number;
    lng?: number;
  }>;
  store_count?: number;
  scraped: boolean;
}

interface ChatResponse {
  message: string;
  action?: 'scrape_website' | 'update_data' | 'create_demo' | null;
  data?: Record<string, any>;
  collected_data?: Record<string, any>;
}

interface Organization {
  id: string;
  name: string;
  subdomain: string;
  demo_expires_at: string;
}

interface CompleteResponse {
  organization: Organization;
  stores_imported: number;
}

interface Industry {
  slug: string;
  name: string;
  description?: string;
  default_services: string[];
  icon?: string;
  sort_order: number;
}

interface ServiceDefinition {
  slug: string;
  name: string;
  description?: string;
  compliance_domains: string[];
  requires_license: boolean;
  icon?: string;
  sort_order: number;
}

interface State {
  code: string;
  name: string;
}

interface OnboardingOptions {
  industries: Industry[];
  services: ServiceDefinition[];
  states: State[];
}

async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'apikey': publicAnonKey,
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP error ${response.status}`,
      };
    }

    return {
      success: true,
      data: data.data || data,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Network error',
    };
  }
}

/**
 * Start a new onboarding session
 */
export async function startOnboardingSession(params?: {
  referrer?: string;
  utm_params?: Record<string, string>;
}): Promise<ApiResponse<StartSessionResponse>> {
  return apiCall<StartSessionResponse>('/onboarding/start', {
    method: 'POST',
    body: JSON.stringify(params || {}),
  });
}

/**
 * Enrich company data from website URL
 */
export async function enrichCompany(
  website: string,
  sessionToken?: string
): Promise<ApiResponse<EnrichedCompanyData>> {
  const result = await apiCall<{ data: EnrichedCompanyData }>('/onboarding/enrich-company', {
    method: 'POST',
    body: JSON.stringify({ website, session_token: sessionToken }),
  });

  if (result.success && result.data) {
    return { success: true, data: (result.data as any).data || result.data };
  }
  return result as ApiResponse<EnrichedCompanyData>;
}

/**
 * Chat with the onboarding agent
 */
export async function chatWithOnboardingAgent(
  sessionToken: string,
  message: string
): Promise<ApiResponse<ChatResponse>> {
  return apiCall<ChatResponse>('/onboarding/chat', {
    method: 'POST',
    body: JSON.stringify({ session_token: sessionToken, message }),
  });
}

/**
 * Update onboarding session data
 */
export async function updateOnboardingSession(
  sessionToken: string,
  data: Record<string, any>,
  currentStep?: string
): Promise<ApiResponse<{ collected_data: Record<string, any> }>> {
  return apiCall('/onboarding/update', {
    method: 'POST',
    body: JSON.stringify({
      session_token: sessionToken,
      data,
      current_step: currentStep,
    }),
  });
}

/**
 * Complete onboarding and create demo organization
 */
export async function completeOnboarding(
  sessionToken: string,
  demoDays: number = 14
): Promise<ApiResponse<CompleteResponse>> {
  return apiCall<CompleteResponse>('/onboarding/complete', {
    method: 'POST',
    body: JSON.stringify({
      session_token: sessionToken,
      demo_days: demoDays,
    }),
  });
}

/**
 * Get industries, services, and states for form dropdowns
 */
export async function getOnboardingOptions(): Promise<ApiResponse<OnboardingOptions>> {
  return apiCall<OnboardingOptions>('/onboarding/options', {
    method: 'GET',
  });
}

// Export types
export type {
  StartSessionResponse,
  EnrichedCompanyData,
  ChatResponse,
  Organization,
  CompleteResponse,
  Industry,
  ServiceDefinition,
  State,
  OnboardingOptions,
};
