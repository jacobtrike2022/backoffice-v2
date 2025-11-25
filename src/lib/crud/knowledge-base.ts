// ============================================================================
// KNOWLEDGE BASE CRUD OPERATIONS
// ============================================================================

import { supabase, getCurrentUserOrgId, getCurrentUserProfile, uploadFile } from '../supabase';

export interface CreateKBArticleInput {
  category_id: string;
  title: string;
  description?: string;
  content: string;
  type: 'required' | 'optional' | 'manager-only';
  reading_time_minutes?: number;
  tags?: string[];
}

/**
 * Create a knowledge base article (defaults to draft, admin/manager only)
 */
export async function createKBArticle(input: CreateKBArticleInput) {
  const orgId = await getCurrentUserOrgId();
  const userProfile = await getCurrentUserProfile();
  
  if (!orgId || !userProfile) throw new Error('User not authenticated');

  // Check if user is admin or manager
  const isAuthorized = await checkKBAuthorization(userProfile.id);
  if (!isAuthorized) {
    throw new Error('Only admins and managers can create KB articles');
  }

  const { data: article, error } = await supabase
    .from('kb_articles')
    .insert({
      organization_id: orgId,
      category_id: input.category_id,
      title: input.title,
      description: input.description,
      content: input.content,
      type: input.type,
      reading_time_minutes: input.reading_time_minutes,
      author_id: userProfile.id,
      status: 'draft',
      view_count: 0
    })
    .select()
    .single();

  if (error) throw error;

  // Add tags if provided
  if (input.tags && input.tags.length > 0) {
    await addKBArticleTags(article.id, input.tags);
  }

  return article;
}

/**
 * Update KB article
 */
export async function updateKBArticle(
  articleId: string,
  updates: Partial<CreateKBArticleInput> & { status?: 'draft' | 'published' | 'archived' }
) {
  const userProfile = await getCurrentUserProfile();
  if (!userProfile) throw new Error('User not authenticated');

  const isAuthorized = await checkKBAuthorization(userProfile.id);
  if (!isAuthorized) {
    throw new Error('Only admins and managers can edit KB articles');
  }

  const { tags, ...articleUpdates } = updates;

  const { data, error } = await supabase
    .from('kb_articles')
    .update({
      ...articleUpdates,
      last_updated_at: new Date().toISOString()
    })
    .eq('id', articleId)
    .select()
    .single();

  if (error) throw error;

  // Update tags if provided
  if (tags !== undefined) {
    await supabase.from('kb_article_tags').delete().eq('kb_article_id', articleId);
    if (tags.length > 0) {
      await addKBArticleTags(articleId, tags);
    }
  }

  return data;
}

/**
 * Publish KB article
 */
export async function publishKBArticle(articleId: string) {
  return updateKBArticle(articleId, { status: 'published' });
}

/**
 * Archive KB article
 */
export async function archiveKBArticle(articleId: string) {
  return updateKBArticle(articleId, { status: 'archived' });
}

/**
 * Get KB article by ID and increment view count
 */
export async function getKBArticleById(articleId: string, incrementView: boolean = true) {
  const { data, error } = await supabase
    .from('kb_articles')
    .select(`
      *,
      category:kb_categories(*),
      author:users!kb_articles_created_by_fkey(name, email),
      publisher:users!kb_articles_published_by_fkey(name, email),
      kb_article_tags(tags(*))
    `)
    .eq('id', articleId)
    .single();

  if (error) throw error;

  // Increment view count
  if (incrementView) {
    await incrementArticleViews(articleId);
  }

  return data;
}

/**
 * Get KB articles with filters
 */
export async function getKBArticles(filters: {
  category_id?: string;
  type?: string;
  status?: string;
  search?: string;
} = {}) {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  let query = supabase
    .from('kb_articles')
    .select(`
      *,
      category:kb_categories(name),
      author:users!kb_articles_created_by_fkey(name),
      kb_article_tags(tags(name))
    `)
    .eq('organization_id', orgId);

  if (filters.category_id) {
    query = query.eq('category_id', filters.category_id);
  }

  if (filters.type) {
    query = query.eq('type', filters.type);
  }

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  if (filters.search) {
    query = query.or(`title.ilike.%${filters.search}%,content.ilike.%${filters.search}%`);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Get KB categories
 */
export async function getKBCategories() {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('kb_categories')
    .select('*')
    .eq('organization_id', orgId)
    .order('display_order', { ascending: true });

  if (error) throw error;
  return data;
}

/**
 * Get KB categories with article counts
 */
export async function getKBCategoriesWithCounts() {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  const { data: categories, error: categoriesError } = await supabase
    .from('kb_categories')
    .select('*')
    .eq('organization_id', orgId)
    .order('display_order', { ascending: true });

  if (categoriesError) throw categoriesError;

  // Get article counts for each category
  const categoriesWithCounts = await Promise.all(
    categories.map(async (category) => {
      const { count } = await supabase
        .from('kb_articles')
        .select('*', { count: 'exact', head: true })
        .eq('category_id', category.id)
        .eq('status', 'published');

      return {
        ...category,
        articleCount: count || 0
      };
    })
  );

  return categoriesWithCounts;
}

/**
 * Create KB category
 */
export async function createKBCategory(input: {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  parent_category_id?: string;
  display_order?: number;
}) {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('kb_categories')
    .insert({
      organization_id: orgId,
      ...input
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Upload attachment for KB article
 */
export async function uploadKBAttachment(
  articleId: string,
  file: File
): Promise<string> {
  const orgId = await getCurrentUserOrgId();
  const bucket = 'kb-attachments';
  const path = `${orgId}/${articleId}/${file.name}`;

  const { url, error } = await uploadFile(bucket, path, file);
  if (error) throw error;
  if (!url) throw new Error('Failed to upload file');

  return url;
}

/**
 * Increment article view count
 */
async function incrementArticleViews(articleId: string) {
  const { data: article } = await supabase
    .from('kb_articles')
    .select('view_count')
    .eq('id', articleId)
    .single();

  if (article) {
    await supabase
      .from('kb_articles')
      .update({ view_count: (article.view_count || 0) + 1 })
      .eq('id', articleId);
  }
}

/**
 * Check if user can edit KB articles (admin or manager)
 */
async function checkKBAuthorization(userId: string): Promise<boolean> {
  const { data: user } = await supabase
    .from('users')
    .select('role:roles(name)')
    .eq('id', userId)
    .single();

  const roleName = (user?.role as any)?.name;
  return roleName === 'Administrator' || roleName === 'District Manager' || roleName === 'Store Manager';
}

/**
 * Add tags to KB article
 */
async function addKBArticleTags(articleId: string, tagNames: string[]) {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) return;

  // Get or create tags
  const tagIds: string[] = [];
  for (const tagName of tagNames) {
    const { data: existingTag } = await supabase
      .from('tags')
      .select('id')
      .eq('organization_id', orgId)
      .eq('name', tagName)
      .single();

    if (existingTag) {
      tagIds.push(existingTag.id);
    } else {
      const { data: newTag } = await supabase
        .from('tags')
        .insert({
          organization_id: orgId,
          name: tagName,
          type: 'kb'
        })
        .select('id')
        .single();

      if (newTag) tagIds.push(newTag.id);
    }
  }

  // Link tags to article
  const articleTagsToInsert = tagIds.map(tagId => ({
    kb_article_id: articleId,
    tag_id: tagId
  }));

  await supabase.from('kb_article_tags').insert(articleTagsToInsert);
}