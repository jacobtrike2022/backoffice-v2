-- Ensure pgvector extension is available and search_path includes it
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
SET search_path TO public, extensions;

-- Update match_brain_embeddings to include system templates in results
-- Previously only returned rows matching the user's org_id.
-- Now also returns is_system_template=true rows so platform-wide
-- knowledge is available in Brain RAG searches.

-- Must DROP first because we're adding is_system_template to RETURNS TABLE
-- (CREATE OR REPLACE does not allow changing return type)
DROP FUNCTION IF EXISTS match_brain_embeddings(vector, float, int, uuid);

CREATE OR REPLACE FUNCTION match_brain_embeddings(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.6,
  match_count int DEFAULT 10,
  org_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  content_id uuid,
  content_type text,
  chunk_text text,
  similarity float,
  metadata jsonb,
  is_system_template boolean
)
LANGUAGE sql STABLE
AS $$
  SELECT
    be.id,
    be.content_id,
    be.content_type,
    be.chunk_text,
    1 - (be.embedding <=> query_embedding) AS similarity,
    be.metadata,
    be.is_system_template
  FROM brain_embeddings be
  WHERE 1 - (be.embedding <=> query_embedding) > match_threshold
    AND (
      be.organization_id = org_id
      OR be.is_system_template = true
    )
  ORDER BY be.embedding <=> query_embedding
  LIMIT match_count;
$$;
