-- Set all organizations to Convenience Stores (cstore)
UPDATE organizations
SET industry_id = (SELECT id FROM industries WHERE LOWER(code) = 'cstore' LIMIT 1)
WHERE EXISTS (SELECT 1 FROM industries WHERE LOWER(code) = 'cstore');

-- Default new organizations to cstore when industry_id is not set
CREATE OR REPLACE FUNCTION set_org_industry_default_cstore()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cstore_id uuid;
BEGIN
  IF NEW.industry_id IS NULL THEN
    SELECT id INTO cstore_id FROM industries WHERE LOWER(code) = 'cstore' LIMIT 1;
    IF cstore_id IS NOT NULL THEN
      NEW.industry_id := cstore_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS org_default_industry_cstore ON organizations;
CREATE TRIGGER org_default_industry_cstore
  BEFORE INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION set_org_industry_default_cstore();
