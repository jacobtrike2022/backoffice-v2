-- =====================================================
-- CONSOLIDATE DUPLICATE CONVENIENCE INDUSTRIES
-- =====================================================
-- Removes the duplicate between "Convenience Retail" and "Convenience Stores"
-- Keeps the most-used one, migrates all references, deletes the other.
-- =====================================================

DO $$
DECLARE
  v_conv_retail_id UUID;
  v_conv_stores_id UUID;
  v_conv_retail_count BIGINT := 0;
  v_conv_stores_count BIGINT := 0;
  v_keeper_id UUID;
  v_loser_id UUID;
BEGIN
  -- Find both convenience industry IDs
  SELECT id INTO v_conv_retail_id FROM industries
    WHERE (code = 'convenience_retail' OR slug = 'convenience_retail' OR LOWER(name) = 'convenience retail')
    LIMIT 1;

  SELECT id INTO v_conv_stores_id FROM industries
    WHERE (code = 'cstore' OR LOWER(name) = 'convenience stores')
    LIMIT 1;

  -- If only one or neither exists, nothing to do
  IF v_conv_retail_id IS NULL AND v_conv_stores_id IS NULL THEN
    RETURN;
  END IF;

  IF v_conv_retail_id IS NULL THEN
    -- Only Convenience Stores exists, nothing to consolidate
    RETURN;
  END IF;

  IF v_conv_stores_id IS NULL THEN
    -- Only Convenience Retail exists, nothing to consolidate
    RETURN;
  END IF;

  -- Same row (e.g. both match same record)
  IF v_conv_retail_id = v_conv_stores_id THEN
    RETURN;
  END IF;

  -- Count usage for each (organizations.industry_id + junction tables)
  SELECT (
    (SELECT COUNT(*) FROM organizations WHERE industry_id = v_conv_retail_id) +
    (SELECT COUNT(*) FROM industry_compliance_requirements WHERE industry_id = v_conv_retail_id) +
    (SELECT COUNT(*) FROM industry_compliance_topics WHERE industry_id = v_conv_retail_id) +
    (SELECT COUNT(*) FROM industry_programs WHERE industry_id = v_conv_retail_id)
  ) INTO v_conv_retail_count;

  SELECT (
    (SELECT COUNT(*) FROM organizations WHERE industry_id = v_conv_stores_id) +
    (SELECT COUNT(*) FROM industry_compliance_requirements WHERE industry_id = v_conv_stores_id) +
    (SELECT COUNT(*) FROM industry_compliance_topics WHERE industry_id = v_conv_stores_id) +
    (SELECT COUNT(*) FROM industry_programs WHERE industry_id = v_conv_stores_id)
  ) INTO v_conv_stores_count;

  -- Keep the one with more usage; if tied, keep "Convenience Stores" (cstore) for consistency with AI/UI
  IF v_conv_stores_count >= v_conv_retail_count THEN
    v_keeper_id := v_conv_stores_id;
    v_loser_id := v_conv_retail_id;
  ELSE
    v_keeper_id := v_conv_retail_id;
    v_loser_id := v_conv_stores_id;
  END IF;

  -- 1. Update organizations.industry_id
  UPDATE organizations SET industry_id = v_keeper_id WHERE industry_id = v_loser_id;

  -- 2. Migrate industry_compliance_requirements (merge, avoid duplicates)
  INSERT INTO industry_compliance_requirements (industry_id, requirement_id, is_required, notes)
  SELECT v_keeper_id, icr.requirement_id, icr.is_required, icr.notes
  FROM industry_compliance_requirements icr
  WHERE icr.industry_id = v_loser_id
    AND NOT EXISTS (
      SELECT 1 FROM industry_compliance_requirements ex
      WHERE ex.industry_id = v_keeper_id AND ex.requirement_id = icr.requirement_id
    );
  DELETE FROM industry_compliance_requirements WHERE industry_id = v_loser_id;

  -- 3. Migrate industry_compliance_topics (merge, avoid duplicates)
  INSERT INTO industry_compliance_topics (industry_id, topic_id, priority, is_typical, notes)
  SELECT v_keeper_id, ict.topic_id, ict.priority, ict.is_typical, ict.notes
  FROM industry_compliance_topics ict
  WHERE ict.industry_id = v_loser_id
    AND NOT EXISTS (
      SELECT 1 FROM industry_compliance_topics ex
      WHERE ex.industry_id = v_keeper_id AND ex.topic_id = ict.topic_id
    );
  DELETE FROM industry_compliance_topics WHERE industry_id = v_loser_id;

  -- 4. Migrate industry_programs (merge, avoid duplicates)
  INSERT INTO industry_programs (industry_id, program_id, is_common, market_share_tier)
  SELECT v_keeper_id, ip.program_id, ip.is_common, ip.market_share_tier
  FROM industry_programs ip
  WHERE ip.industry_id = v_loser_id
    AND NOT EXISTS (
      SELECT 1 FROM industry_programs ex
      WHERE ex.industry_id = v_keeper_id AND ex.program_id = ip.program_id
    );
  DELETE FROM industry_programs WHERE industry_id = v_loser_id;

  -- 5. Normalize organizations.industry (TEXT) to the keeper's name for display in org lists
  UPDATE organizations o
  SET industry = (SELECT i.name FROM industries i WHERE i.id = v_keeper_id)
  WHERE o.industry IN ('convenience_retail', 'cstore', 'Convenience Retail', 'Convenience Stores');

  -- 6. Delete the duplicate industry
  DELETE FROM industries WHERE id = v_loser_id;

END $$;
