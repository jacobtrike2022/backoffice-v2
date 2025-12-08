/**
 * Hash utilities for content change detection
 */

/**
 * Generate SHA-256 hash of text
 */
export async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Strip markdown formatting to get plain text for hashing
 */
export function stripMarkdown(markdown: string): string {
  if (!markdown) return '';
  
  return markdown
    .replace(/#{1,6}\s/g, '') // Headers
    .replace(/\*\*(.+?)\*\*/g, '$1') // Bold
    .replace(/\*(.+?)\*/g, '$1') // Italic
    .replace(/\[(.+?)\]\(.+?\)/g, '$1') // Links
    .replace(/!\[.*?\]\(.+?\)/g, '') // Images
    .replace(/`{1,3}.*?`{1,3}/g, '') // Code
    .replace(/\n{3,}/g, '\n\n') // Multiple newlines
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}
