import { projectId, publicAnonKey } from '../../utils/supabase/info';

const API_URL = `https://${projectId}.supabase.co/functions/v1/make-server-2858cc8b`;

export interface Tag {
  id: string;
  name: string;
  color?: string;
  created_at: string;
  updated_at: string;
}

// Get all tags
export async function getTags(): Promise<Tag[]> {
  try {
    const response = await fetch(`${API_URL}/tags`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch tags');
    }

    const data = await response.json();
    return data.tags || [];
  } catch (error: any) {
    console.error('Error fetching tags:', error);
    throw error;
  }
}

// Create a new tag
export async function createTag(name: string, color?: string): Promise<Tag> {
  try {
    const response = await fetch(`${API_URL}/tags`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, color }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create tag');
    }

    const data = await response.json();
    return data.tag;
  } catch (error: any) {
    console.error('Error creating tag:', error);
    throw error;
  }
}

// Update a tag
export async function updateTag(id: string, name: string, color?: string): Promise<Tag> {
  try {
    const response = await fetch(`${API_URL}/tags/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, color }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update tag');
    }

    const data = await response.json();
    return data.tag;
  } catch (error: any) {
    console.error('Error updating tag:', error);
    throw error;
  }
}

// Delete a tag
export async function deleteTag(id: string): Promise<void> {
  try {
    const response = await fetch(`${API_URL}/tags/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to delete tag');
    }
  } catch (error: any) {
    console.error('Error deleting tag:', error);
    throw error;
  }
}
