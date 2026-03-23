-- Normalize the single convenience industry to "Convenience Stores" / cstore for consistent UI
UPDATE industries
SET name = 'Convenience Stores',
    code = 'cstore'
WHERE LOWER(code) IN ('cstore', 'convenience_retail')
   OR LOWER(name) IN ('convenience stores', 'convenience retail');
