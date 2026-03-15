// ============================================================================
// COMPANY BRAIN CRUD OPERATIONS - RAG Infrastructure
// ============================================================================

import { supabase, getCurrentUserOrgId, getCurrentUserProfile } from '../supabase';
import { getServerUrl } from '../../utils/supabase/info';
import { supabaseAnonKey } from '../supabase';

// ============================================================================
// TYPES
// ============================================================================

export interface BrainEmbedding {
  id: string;
  organization_id: string;
  content_type: 'track' | 'article' | 'video' | 'transcript';
  content_id: string;
  chunk_index: number;
  chunk_text: string;
  embedding: number[];
  metadata: Record<string, any>;
  created_at: string;
}

export interface BrainConversation {
  id: string;
  organization_id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface BrainMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface CreateConversationInput {
  title?: string;
}

export interface SendMessageInput {
  conversationId: string;
  message: string;
}

export interface IndexContentInput {
  contentType: 'track' | 'article' | 'video' | 'transcript';
  contentId: string;
  text: string;
  metadata?: Record<string, any>;
}

export interface SearchContentInput {
  query: string;
  limit?: number;
  contentType?: 'track' | 'article' | 'video' | 'transcript';
}

export interface BrainStats {
  totalEmbeddings: number;
  totalConversations: number;
  totalMessages: number;
  embeddingsByType: Record<string, number>;
}

// ============================================================================
// CONVERSATIONS
// ============================================================================

/**
 * Create a new conversation
 */
export async function createConversation(input: CreateConversationInput = {}) {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  const { data: { user } } = await supabase.auth.getUser();
  const profile = await getCurrentUserProfile();
  const userId = user?.id ?? (profile as any)?.id;
  if (!userId) throw new Error('User not authenticated');

  const { data: conversation, error } = await supabase
    .from('brain_conversations')
    .insert({
      organization_id: orgId,
      user_id: userId,
      title: input.title || 'New Conversation',
    } as any)
    .select()
    .single();

  if (error) throw error;
  return conversation;
}

/**
 * Get all conversations for the current user
 */
export async function getConversations() {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  const { data: { user } } = await supabase.auth.getUser();
  const profile = await getCurrentUserProfile();
  const userId = user?.id ?? (profile as any)?.id;
  if (!userId) throw new Error('User not authenticated');

  const { data: conversations, error } = await supabase
    .from('brain_conversations')
    .select('*')
    .eq('organization_id', orgId)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return conversations || [];
}

/**
 * Get a single conversation with messages
 */
export async function getConversation(conversationId: string) {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  const { data: { user } } = await supabase.auth.getUser();
  const profile = await getCurrentUserProfile();
  const userId = user?.id ?? (profile as any)?.id;
  if (!userId) throw new Error('User not authenticated');

  // Get conversation
  const { data: conversation, error: convError } = await supabase
    .from('brain_conversations')
    .select('*')
    .eq('id', conversationId)
    .eq('organization_id', orgId)
    .eq('user_id', userId)
    .single();

  if (convError) throw convError;
  if (!conversation) throw new Error('Conversation not found');

  // Get messages
  const { data: messages, error: msgError } = await supabase
    .from('brain_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (msgError) throw msgError;

  return {
    ...(conversation as any),
    messages: messages || [],
  };
}

// ============================================================================
// MESSAGES
// ============================================================================

/**
 * Send a message in a conversation (calls edge function)
 */
export async function sendMessage(input: SendMessageInput) {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  // Support demo mode: use anon key if no session
  const { data: { session } } = await supabase.auth.getSession();
  const authToken = session?.access_token || supabaseAnonKey;

  const serverUrl = getServerUrl();
  const response = await fetch(`${serverUrl}/brain/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      'apikey': supabaseAnonKey,
    },
    body: JSON.stringify({
      conversationId: input.conversationId,
      message: input.message,
      organizationId: orgId,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to send message');
  }

  return await response.json();
}

// ============================================================================
// CONTENT INDEXING
// ============================================================================

/**
 * Index content for RAG (calls edge function)
 */
export async function indexContent(input: IndexContentInput) {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  // Support demo mode: use anon key if no session
  const { data: { session } } = await supabase.auth.getSession();
  const authToken = session?.access_token || supabaseAnonKey;

  const serverUrl = getServerUrl();
  const response = await fetch(`${serverUrl}/brain/embed`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      'apikey': supabaseAnonKey,
    },
    body: JSON.stringify({
      contentType: input.contentType,
      contentId: input.contentId,
      text: input.text,
      metadata: input.metadata || {},
      organizationId: orgId,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to index content');
  }

  return await response.json();
}

/**
 * Remove content from index (calls edge function)
 */
export async function removeFromIndex(contentType: string, contentId: string) {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  // Support demo mode: use anon key if no session
  const { data: { session } } = await supabase.auth.getSession();
  const authToken = session?.access_token || supabaseAnonKey;

  const serverUrl = getServerUrl();
  const response = await fetch(`${serverUrl}/brain/remove`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      'apikey': supabaseAnonKey,
    },
    body: JSON.stringify({
      contentType,
      contentId,
      organizationId: orgId,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to remove content from index');
  }

  return await response.json();
}

// ============================================================================
// SEARCH & STATS
// ============================================================================

/**
 * Search indexed content (calls edge function)
 */
export async function searchContent(input: SearchContentInput) {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  // Support demo mode: use anon key if no session
  const { data: { session } } = await supabase.auth.getSession();
  const authToken = session?.access_token || supabaseAnonKey;

  const serverUrl = getServerUrl();
  const response = await fetch(`${serverUrl}/brain/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      'apikey': supabaseAnonKey,
    },
    body: JSON.stringify({
      query: input.query,
      limit: input.limit || 10,
      contentType: input.contentType,
      organizationId: orgId,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to search content');
  }

  return await response.json();
}

/**
 * Get brain statistics (calls edge function)
 */
export async function getBrainStats(): Promise<BrainStats> {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  // Support demo mode: use anon key if no session
  const { data: { session } } = await supabase.auth.getSession();
  const authToken = session?.access_token || supabaseAnonKey;

  const serverUrl = getServerUrl();
  const response = await fetch(`${serverUrl}/brain/stats?organizationId=${orgId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'apikey': supabaseAnonKey,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get brain stats');
  }

  return await response.json();
}

/**
 * Backfill brain index - index all published tracks that aren't already indexed
 * Calls the edge function endpoint
 */
export async function backfillBrainIndex(organizationId: string): Promise<{
  indexed: number;
  skipped: number;
  errors: string[];
  details: Array<{ trackId: string; title: string; status: 'indexed' | 'skipped' | 'error' }>;
}> {
  // Support demo mode: use anon key if no session
  const { data: { session } } = await supabase.auth.getSession();
  const authToken = session?.access_token || supabaseAnonKey;

  const serverUrl = getServerUrl();
  const response = await fetch(`${serverUrl}/brain/backfill`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      'apikey': supabaseAnonKey,
    },
    body: JSON.stringify({
      organizationId,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to backfill brain index');
  }

  return await response.json();
}

