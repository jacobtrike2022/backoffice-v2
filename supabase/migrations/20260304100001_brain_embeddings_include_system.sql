-- Update match_brain_embeddings to include system templates in results
-- Previously only returned rows matching the user's org_id.
-- Now also returns is_system_template=true rows so platform-wide
-- knowledge is available in Brain RAG searches.

CREATE OR REPLACE FUNCTION match_brain_embeddings(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.6,
  match_count int DEFAULT 10,
  org_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  track_id uuid,
  content_type text,
  content_chunk text,
  similarity float,
  metadata jsonb,
  is_system_template boolean
)
LANGUAGE sql STABLE
AS $$
  SELECT
    be.id,
    be.track_id,
    be.content_type,
    be.content_chunk,
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
