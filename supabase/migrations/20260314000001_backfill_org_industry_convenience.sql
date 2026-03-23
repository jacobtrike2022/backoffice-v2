-- Backfill industry_id for any org still missing it: use cstore or convenience_retail (whichever exists)
-- Consolidate migration may have kept either code depending on usage.
UPDATE organizations
SET industry_id = (
  SELECT id FROM industries
  WHERE LOWER(code) IN ('cstore', 'convenience_retail')
  ORDER BY CASE WHEN LOWER(code) = 'cstore' THEN 0 ELSE 1 END
  LIMIT 1
)
WHERE industry_id IS NULL
  AND EXISTS (SELECT 1 FROM industries WHERE LOWER(code) IN ('cstore', 'convenience_retail'));

-- Ensure default trigger tries both codes so new orgs get an industry
CREATE OR REPLACE FUNCTION set_org_industry_default_cstore()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conv_id uuid;
BEGIN
  IF NEW.industry_id IS NULL THEN
    SELECT id INTO conv_id FROM industries
    WHERE LOWER(code) IN ('cstore', 'convenience_retail')
    ORDER BY CASE WHEN LOWER(code) = 'cstore' THEN 0 ELSE 1 END
    LIMIT 1;
    IF conv_id IS NOT NULL THEN
      NEW.industry_id := conv_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
