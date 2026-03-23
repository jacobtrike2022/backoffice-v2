-- =============================================================================
-- Full Compliance Seed Migration
-- Replaces partial seed data with complete Notion database export.
-- Covers: compliance_topics (2 new), compliance_authorities (78 new + 1 update),
--         compliance_requirements (95 records).
-- All inserts use ON CONFLICT (id) DO NOTHING for idempotency.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- SECTION 1: DELETE partial seed data from previous partial migration
-- -----------------------------------------------------------------------------
DELETE FROM compliance_requirements WHERE id::text LIKE 'b0000001%';
DELETE FROM compliance_requirements WHERE requirement_name = 'TABC TX Certification';
DELETE FROM compliance_authorities WHERE id::text LIKE 'a0000001%';

-- -----------------------------------------------------------------------------
-- SECTION 2: INSERT 2 new topics (Allergen and Violence Prevention)
-- -----------------------------------------------------------------------------
INSERT INTO compliance_topics (id, name, sort_order, created_at, updated_at)
VALUES
  ('e0000001-0000-0000-0000-000000000001', 'Allergen', 11, NOW(), NOW()),
  ('e0000001-0000-0000-0000-000000000002', 'Violence Prevention', 12, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- SECTION 3: UPDATE existing TABC TX authority
-- -----------------------------------------------------------------------------
UPDATE compliance_authorities
SET
  name            = 'Texas Alcoholic Beverage Commission',
  abbreviation    = 'TABC',
  state_code      = 'TX',
  authority_type  = 'alcohol_tobacco_commission',
  website_url     = 'https://www.tabc.texas.gov/',
  updated_at      = NOW()
WHERE id = 'd592b232-b9e5-417f-93d5-63b07db53c7f';

-- -----------------------------------------------------------------------------
-- SECTION 4: INSERT 78 new authorities (c-prefix UUIDs)
-- -----------------------------------------------------------------------------
INSERT INTO compliance_authorities (id, state_code, name, abbreviation, authority_type, website_url, created_at, updated_at)
VALUES
  ('c0000001-0000-0000-0000-000000000001', 'IL', 'Illinois Department of Public Health',                                                          NULL,    'dept_of_health',                   'https://dph.illinois.gov/',                                                                                                                   NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000003', 'FL', 'Florida Department of Business and Professional Regulation',                                     NULL,    'business_professional_regulation',  'https://www2.myfloridalicense.com/',                                                                                                          NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000004', 'FL', 'Florida Division of Alcoholic Beverages and Tobacco',                                            NULL,    'alcohol_tobacco_commission',        'https://www2.myfloridalicense.com/alcoholic-beverages-and-tobacco/',                                                                         NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000005', 'IL', 'Illinois Liquor Control Commission (ILCC)',                                                       'ILCC',  'alcohol_tobacco_commission',        'https://ilcc.illinois.gov/',                                                                                                                  NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000006', 'IL', 'Illinois Department of Human Rights',                                                            NULL,    'dept_of_labor',                    'https://dhr.illinois.gov/training/state-of-illinois-sexual-harassment-prevention-training-model.html',                                        NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000007', 'MO', 'Missouri Commission on Human Rights',                                                            NULL,    'dept_of_labor',                    'https://labor.mo.gov/mohumanrights',                                                                                                          NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000008', 'AL', 'Alabama Alcoholic Beverage Control Board',                                                       NULL,    'alcohol_tobacco_commission',        'https://alabcboard.gov/',                                                                                                                     NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000009', 'AR', 'Arkansas Alcoholic Beverage Control Division',                                                   NULL,    'alcohol_tobacco_commission',        'https://www.dfa.arkansas.gov/office/alcohol-beverage-control/abc-rules-regulations/',                                                        NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000010', 'NY', 'The New York State Department of Labor',                                                         NULL,    'dept_of_labor',                    'https://www.ny.gov/',                                                                                                                         NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000011', 'MI', 'Michigan Licensing & Regulatory Affairs',                                                        NULL,    'alcohol_tobacco_commission',        'https://www.michigan.gov/lara/bureau-list/lcc/faq/server-training-requirements',                                                             NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000012', 'LA', 'Louisiana Department of Environmental Quality (LDEQ)',                                           'LDEQ',  'environmental',                    'https://www.deq.louisiana.gov/',                                                                                                              NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000013', 'LA', 'Louisiana Office of Alcohol and Tobacco Control (ATC)',                                          'ATC',   'alcohol_tobacco_commission',        'https://atc.louisiana.gov/',                                                                                                                  NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000014', 'WI', 'Wisconsin Department of Revenue',                                                                NULL,    'alcohol_tobacco_commission',        'https://www.revenue.wi.gov/Pages/FAQS/rbs-courses.aspx',                                                                                     NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000015', 'MO', 'Missouri Division of Alcohol and Tobacco Control (ATC)',                                         'ATC',   'alcohol_tobacco_commission',        'https://atc.dps.mo.gov/regulations/',                                                                                                         NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000016', 'MO', 'Missouri Department of Natural Resources (DNR)',                                                 'DNR',   'environmental',                    'https://dnr.mo.gov/waste-recycling/business-industry/guidance-technical-assistance/underground-storage-tank-requirements',                    NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000017', 'KY', 'Lexington-Fayette Urban County Government (Lexington ABC)',                                      NULL,    'alcohol_tobacco_commission',        'https://www.lexingtonky.gov/government/departments-programs/public-safety/police/bureau-investigation/alcoholic-beverage-control-office',   NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000018', 'GA', 'Georgia Environmental Protection Division',                                                      NULL,    'environmental',                    'https://epd.georgia.gov/about-us/land-protection-branch/land-protection-branch-technical-guidance/underground-storage-3',                    NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000019', 'IL', 'Illinois State Fire Marshal: Division of Petroleum and Chemical Safety',                         NULL,    'environmental',                    'https://sfm.illinois.gov/about/divisions/petroleum-chemical-safety/operator-training.html',                                                  NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000020', 'TX', 'Texas Commission on Environmental Quality',                                                      NULL,    'environmental',                    'https://www.tceq.texas.gov/',                                                                                                                 NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000021', 'FL', 'Florida Department of Environmental Protection',                                                 NULL,    'environmental',                    'https://floridadep.gov/waste/permitting-compliance-assistance/content/underground-storage-tank-operator-training',                           NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000022', 'CA', 'California Department of Alcoholic Beverage Control (ABC)',                                      'ABC',   'alcohol_tobacco_commission',        'https://www.abc.ca.gov/education/rbs/',                                                                                                       NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000023', 'CA', 'California Civil Rights Department (CRD)',                                                       'CRD',   'dept_of_labor',                    'https://calcivilrights.ca.gov/shpt/',                                                                                                         NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000024', 'CA', 'California Division of Occupational Safety and Health (Cal/OSHA)',                               NULL,    'dept_of_health',                   'https://www.dir.ca.gov/dosh/Workplace-Violence.html',                                                                                         NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000025', 'CA', 'California Department of Public Health',                                                         NULL,    'dept_of_health',                   'https://www.cdph.ca.gov/',                                                                                                                    NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000026', 'NY', 'New York State Division of Human Rights (NYSDHR)',                                               'NYSDHR','dept_of_labor',                    'https://dhr.ny.gov/',                                                                                                                         NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000027', 'TX', 'Texas Department of State Health Services (DSHS)',                                               'DSHS',  'dept_of_health',                   'https://www.dshs.texas.gov/licensing-food-handler-training-programs/laws-regulations-food-handlers',                                         NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000028', 'TN', 'Tennessee Alcoholic Beverage Commission (TABC)',                                                 'TABC',  'alcohol_tobacco_commission',        'https://www.tn.gov/abc.html',                                                                                                                 NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000029', 'OH', 'Ohio Department of Health (ODH)',                                                                'ODH',   'dept_of_health',                   'https://odh.ohio.gov/home',                                                                                                                   NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000030', 'OK', 'Oklahoma Alcoholic Beverage Laws Enforcement (ABLE) Commission',                                 'ABLE',  'alcohol_tobacco_commission',        'https://oklahoma.gov/able-commission.html',                                                                                                   NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000031', 'PA', 'Pennsylvania Liquor Control Board (PLCB)',                                                       'PLCB',  'alcohol_tobacco_commission',        'https://www.pa.gov/agencies/lcb.html',                                                                                                        NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000032', 'PA', 'Responsible Alcohol Management Program (RAMP)',                                                  'RAMP',  'alcohol_tobacco_commission',        'https://www.pa.gov/agencies/lcb/alcohol-education-training/ramp.html',                                                                       NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000033', 'SC', 'South Carolina Department of Health and Environmental Control (DHEC)',                           'DHEC',  'dept_of_health',                   'https://des.sc.gov/about-scdes/dhec-restructuring',                                                                                           NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000034', 'UT', 'Utah Division of Substance Abuse and Mental Health (DSAMH)',                                     'DSAMH', 'alcohol_tobacco_commission',        'https://sumh.utah.gov/',                                                                                                                      NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000035', 'UT', 'Utah Department of Health & Human Services',                                                    NULL,    'dept_of_health',                   'https://dhhs.utah.gov/',                                                                                                                      NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000036', 'VA', 'Virginia Alcoholic Beverage Control Authority (Virginia ABC)',                                   NULL,    'alcohol_tobacco_commission',        'https://www.abc.virginia.gov/licenses/training/learning-center-login-instructions',                                                          NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000037', 'MI', 'Michigan Liquor Control Commission (MLCC)',                                                      'MLCC',  'alcohol_tobacco_commission',        'https://www.michigan.gov/lara/bureau-list/lcc',                                                                                               NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000038', 'NY', 'New York State Liquor Authority (NYSLA)',                                                        'NYSLA', 'alcohol_tobacco_commission',        'https://sla.ny.gov/',                                                                                                                         NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000039', 'NY', 'New York State Department of Health (NYSDOH)',                                                   'NYSDOH','dept_of_health',                   'https://www.health.ny.gov/',                                                                                                                  NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000040', 'OR', 'Oregon Health Authority (OHA)',                                                                  'OHA',   'dept_of_health',                   'https://www.oregon.gov/oha/Pages/index.aspx',                                                                                                 NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000041', 'CT', 'Connecticut Commission on Human Rights and Opportunities (CHRO)',                                'CHRO',  'dept_of_labor',                    'https://portal.ct.gov/CHRO',                                                                                                                  NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000042', 'ME', 'Maine Bureau of Alcoholic Beverages and Lottery Operations (BABLO)',                             'BABLO', 'alcohol_tobacco_commission',        'https://www.maine.gov/dafs/bablo/',                                                                                                           NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000043', 'ME', 'Maine Liquor and Lottery Commission',                                                            NULL,    'alcohol_tobacco_commission',        'https://www.maine.gov/dafs/bablo/liquor-licensing',                                                                                           NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000044', 'NM', 'New Mexico Environment Department (NMED)',                                                       'NMED',  'environmental',                    'https://www.env.nm.gov/',                                                                                                                     NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000045', 'SD', 'South Dakota Department of Revenue (SD DOR)',                                                    'SD DOR','business_professional_regulation',  'https://dor.sd.gov/',                                                                                                                         NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000046', 'VT', 'Vermont Department of Liquor and Lottery (DLL)',                                                 'DLL',   'alcohol_tobacco_commission',        'https://liquorandlottery.vermont.gov/',                                                                                                        NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000047', 'AK', 'Alaska Department of Environmental Conservation (ADEC)',                                         'ADEC',  'environmental',                    'https://dec.alaska.gov/eh/fss/',                                                                                                              NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000048', 'DE', 'Delaware Department of Labor (DOL)',                                                             'DOL',   'dept_of_labor',                    'https://labor.delaware.gov/',                                                                                                                 NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000049', 'ME', 'Maine Human Rights Commission (MHRC)',                                                           'MHRC',  'dept_of_labor',                    'https://www.maine.gov/mhrc/',                                                                                                                 NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000050', 'CA', 'California State Water Resources Control Board (SWRCB)',                                         'SWRCB', 'environmental',                    'https://www.waterboards.ca.gov/',                                                                                                             NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000051', 'NY', 'New York State Department of Environmental Conservation (NYSDEC)',                               'NYSDEC','environmental',                    'https://dec.ny.gov/',                                                                                                                         NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000052', 'NC', 'North Carolina Department of Environmental Quality (NCDEQ)',                                     'NCDEQ', 'environmental',                    'https://www.deq.nc.gov/',                                                                                                                     NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000053', 'OH', 'Bureau of Underground Storage Tank Regulations (BUSTR) - Ohio Department of Commerce',           'BUSTR', 'other',                            'https://com.ohio.gov/divisions-and-programs/state-fire-marshal/underground-storage-tanks-bustr',                                            NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000054', 'PA', 'Pennsylvania Department of Environmental Protection (PA DEP)',                                   'PA DEP','environmental',                    'https://www.pa.gov/agencies/dep.html',                                                                                                        NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000055', 'TX', 'Texas Comptroller of Public Accounts',                                                           NULL,    'alcohol_tobacco_commission',        'https://comptroller.texas.gov/programs/support/tobacco/seller.php',                                                                          NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000056', 'TN', 'Tennessee Department of Environment and Conservation (TDEC) - Division of Underground Storage Tanks', 'TDEC', 'environmental',               'https://www.tn.gov/environment/ust.html',                                                                                                     NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000057', 'TN', 'Tennessee Department of Agriculture',                                                            NULL,    'dept_of_agriculture',              'https://www.tn.gov/agriculture/consumers/ag-crime-unit.html',                                                                                NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000058', 'TN', 'Tennessee Department of Health',                                                                 NULL,    'dept_of_health',                   'https://www.tn.gov/health/health-program-areas/office-of-primary-prevention.html',                                                           NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000059', 'OH', 'Ohio Department of Commerce - Division of Liquor Control',                                       NULL,    'alcohol_tobacco_commission',        'https://com.ohio.gov/divisions-and-programs/liquor-control/',                                                                                 NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000060', 'IL', 'Illinois Department of Revenue (IDOR)',                                                          'IDOR',  'business_professional_regulation',  'https://www.illinois.gov/agencies/agency.idor.html',                                                                                          NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000061', 'KY', 'Kentucky Department of Alcoholic Beverage Control (ABC)',                                        'ABC',   'alcohol_tobacco_commission',        'https://abc.ky.gov/',                                                                                                                         NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000062', 'KY', 'Kentucky Department of Environmental Protection (KYDEP) - UST Branch',                          'KYDEP', 'environmental',                    'https://eec.ky.gov/Environmental-Protection/Waste/underground-storage-tank/Pages/default.aspx',                                             NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000063', 'KY', 'Lexington-Fayette County Health Department (LFCHD)',                                             'LFCHD', 'dept_of_health',                   'https://www.lfchd.org/home/',                                                                                                                 NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000064', 'MS', 'The Mississippi State Department of Health (MSDH)',                                              'MSDH',  'dept_of_health',                   'https://www.ms.gov/Agencies/state-department-health',                                                                                         NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000065', 'MS', 'Mississippi Alcoholic Beverage Control (ABC) Division',                                          'ABC',   'alcohol_tobacco_commission',        'https://www.dor.ms.gov/abc',                                                                                                                  NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000066', 'MS', 'Mississippi Department of Environmental Quality (MDEQ)',                                         'MDEQ',  'environmental',                    'https://www.mdeq.ms.gov/',                                                                                                                    NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000067', 'NC', 'North Carolina Department of Health and Human Services (NCDHHS)',                                'NCDHHS','dept_of_health',                   'https://www.ncdhhs.gov/',                                                                                                                     NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000068', 'NC', 'North Carolina Alcoholic Beverage Control Commission (NC ABC)',                                  'NC ABC','alcohol_tobacco_commission',        'https://www.abc.nc.gov/',                                                                                                                     NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000069', 'PA', 'Pennsylvania Department of Agriculture (PDA)',                                                   'PDA',   'dept_of_agriculture',              'https://www.pa.gov/agencies/pda.html',                                                                                                        NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000070', 'PA', 'Pennsylvania Department of Health',                                                              NULL,    'dept_of_health',                   'https://www.pa.gov/agencies/health.html',                                                                                                     NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000071', 'OK', 'Oklahoma Corporation Commission (OCC)',                                                          'OCC',   'dept_of_agriculture',              'https://oklahoma.gov/occ.html',                                                                                                               NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000072', 'WI', 'Wisconsin Department of Agriculture Trade and Consumer Protection (DATCP)',                      'DATCP', 'dept_of_agriculture',              'https://datcp.wi.gov/Pages/Homepage.aspx',                                                                                                    NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000073', 'AL', 'Alabama Department of Environmental Management (ADEM)',                                          'ADEM',  'environmental',                    'https://adem.alabama.gov/',                                                                                                                   NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000074', 'AZ', 'Arizona Department of Environmental Quality (ADEQ)',                                             'ADEQ',  'environmental',                    'https://www.azdeq.gov/',                                                                                                                      NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000075', 'AR', 'Arkansas Department of Energy and Environment - Division of Environmental Quality (ADEQ)',       'ADEQ',  'environmental',                    'https://www.adeq.state.ar.us/',                                                                                                               NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000076', 'WA', 'Washington State Department of Health (DOH)',                                                    'DOH',   'dept_of_health',                   'https://doh.wa.gov/',                                                                                                                         NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000077', 'SC', 'South Carolina Department of Environmental Services',                                            NULL,    'environmental',                    'https://des.sc.gov/programs/bureau-land-waste-management/underground-storage-tanks',                                                         NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000078', 'SC', 'South Carolina Department of Agriculture',                                                       NULL,    'dept_of_agriculture',              'https://agriculture.sc.gov/retail-food-safety',                                                                                               NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000079', 'NY', 'New York State Division of Human Rights (NYSDHR)',                                               'NYSDHR','dept_of_labor',                    'https://dhr.ny.gov/',                                                                                                                         NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- SECTION 5: INSERT all requirements (d-prefix UUIDs, sequential)
-- -----------------------------------------------------------------------------
INSERT INTO compliance_requirements (
  id, requirement_name, state_code, jurisdiction_level,
  topic_id, authority_id,
  ee_training_required, approval_required,
  days_to_complete, recertification_years,
  applies_to_everyone, applies_to_foodservice, applies_to_frontline, applies_to_managers, applies_to_retail,
  law_name, law_code_reference,
  status,
  created_at, updated_at
)
VALUES

-- 1: Illinois Allergen Awareness
(
  'd0000001-0000-0000-0000-000000000001',
  'Illinois Allergen Awareness',
  'IL', 'state',
  'e0000001-0000-0000-0000-000000000001',
  'c0000001-0000-0000-0000-000000000001',
  'required_certified', NULL,
  30, 3,
  false, true, false, true, false,
  'Food Handling Regulation Enforcement Act',
  'IL Food Handling Enforcement Act Section 3.07(c) (410 ILCS 625)',
  'recon_done',
  NOW(), NOW()
),

-- 2: Texas Alcoholic Beverage Commission Certification (TABC)
(
  'd0000001-0000-0000-0000-000000000002',
  'Texas Alcoholic Beverage Commission Certification (TABC)',
  'TX', 'state',
  '249677af-27ef-46fc-94fc-59332eb5fbaa',
  'd592b232-b9e5-417f-93d5-63b07db53c7f',
  'required_certified', NULL,
  NULL, NULL,
  false, false, false, false, true,
  'Texas Alcoholic Beverage Code',
  'TX Administrative Code Title 16 Part 3 Chapter 50',
  'approved',
  NOW(), NOW()
),

-- 3: Georgia Class C UST
(
  'd0000001-0000-0000-0000-000000000003',
  'Georgia Class C UST',
  'GA', 'state',
  '716953b1-4dab-4a1a-add8-38157fb2c545',
  'c0000001-0000-0000-0000-000000000018',
  'required_program', NULL,
  NULL, NULL,
  false, false, false, false, true,
  'Georgia Underground Storage Tank Management Rules',
  'GA Rule 391-3-15-.16',
  'approved',
  NOW(), NOW()
),

-- 4: Florida Class C UST
(
  'd0000001-0000-0000-0000-000000000004',
  'Florida Class C UST',
  'FL', 'state',
  '716953b1-4dab-4a1a-add8-38157fb2c545',
  'c0000001-0000-0000-0000-000000000021',
  'required_program', NULL,
  NULL, NULL,
  false, false, false, false, true,
  'Florida Underground Storage Tank Operator Training Requirements',
  '62-761.350 Florida Administrative Code (F.A.C.)',
  'approved',
  NOW(), NOW()
),

-- 5: Illinois Class C UST
(
  'd0000001-0000-0000-0000-000000000005',
  'Illinois Class C UST',
  'IL', 'state',
  '716953b1-4dab-4a1a-add8-38157fb2c545',
  'c0000001-0000-0000-0000-000000000019',
  'required_program', NULL,
  NULL, 4,
  false, false, false, false, true,
  'Illinois Administrative Requirements for Underground Storage Tanks',
  'TITLE 41: Chapter 1: Section 176.635 a',
  'approved',
  NOW(), NOW()
),

-- 6: Florida Responsible Vendor Act
(
  'd0000001-0000-0000-0000-000000000006',
  'Florida Responsible Vendor Act',
  'FL', 'state',
  '249677af-27ef-46fc-94fc-59332eb5fbaa',
  'c0000001-0000-0000-0000-000000000004',
  'voluntary_with_benefit', NULL,
  30, 0,
  false, false, true, true, false,
  'Florida Responsible Vendor Act',
  'Florida Statutes 561.701-561.706',
  'recon_done',
  NOW(), NOW()
),

-- 7: Illinois BASSET
(
  'd0000001-0000-0000-0000-000000000007',
  'Illinois BASSET',
  'IL', 'state',
  '249677af-27ef-46fc-94fc-59332eb5fbaa',
  'c0000001-0000-0000-0000-000000000005',
  'required_certified', NULL,
  30, 3,
  false, false, false, false, true,
  'Illinois Liquor Control Act',
  '235 ILCS 5/6-27.1',
  'recon_done',
  NOW(), NOW()
),

-- 8: Illinois Sexual Harassment Program
(
  'd0000001-0000-0000-0000-000000000008',
  'Illinois Sexual Harassment Program',
  'IL', 'state',
  '240f27d5-55d6-47f6-b332-ef140115d716',
  'c0000001-0000-0000-0000-000000000006',
  'required_program', NULL,
  183, 1,
  true, false, false, false, false,
  'Illinois Human Rights Act (IHRA)',
  '775 ILCS 5/ Illinois Human Rights Act.',
  'done_no_approval_needed',
  NOW(), NOW()
),

-- 9: Florida Robbery & Safety
(
  'd0000001-0000-0000-0000-000000000009',
  'Florida Robbery & Safety',
  'FL', 'state',
  '1d8e76d9-f2e6-4df1-988f-e4f5c6c4960c',
  'c0000001-0000-0000-0000-000000000003',
  'required_program', NULL,
  NULL, NULL,
  false, false, false, false, true,
  'FL Convenience Store Security Act',
  'FL Section 812.174',
  'approved',
  NOW(), NOW()
),

-- 10: Colorado POWR Act Sexual Harassment
(
  'd0000001-0000-0000-0000-000000000010',
  'Colorado POWR Act Sexual Harassment',
  'CO', 'state',
  '240f27d5-55d6-47f6-b332-ef140115d716',
  NULL,
  'suggested', NULL,
  NULL, NULL,
  true, false, false, false, false,
  'Colorado POWR Act',
  '3 Colo. Code Regs. 708-1:20.6',
  'recon_started',
  NOW(), NOW()
),

-- 11: Missouri Human Rights Act
(
  'd0000001-0000-0000-0000-000000000011',
  'Missouri Human Rights Act',
  'MO', 'state',
  '240f27d5-55d6-47f6-b332-ef140115d716',
  'c0000001-0000-0000-0000-000000000007',
  'suggested', NULL,
  NULL, NULL,
  true, false, false, false, false,
  'Missouri Human Rights Act',
  'Title XII Chapter 213 Human Rights',
  'done_no_approval_needed',
  NOW(), NOW()
),

-- 12: New York Sexual Harassment
(
  'd0000001-0000-0000-0000-000000000012',
  'New York Sexual Harassment',
  'NY', 'state',
  '240f27d5-55d6-47f6-b332-ef140115d716',
  'c0000001-0000-0000-0000-000000000010',
  'required_program', NULL,
  NULL, 1,
  true, false, false, false, false,
  'New York State Sexual Harassment Prevention Training',
  'Labor Law 201-g',
  'recon_done',
  NOW(), NOW()
),

-- 13: Alabama Responsible Vendor
(
  'd0000001-0000-0000-0000-000000000013',
  'Alabama Responsible Vendor',
  'AL', 'state',
  '249677af-27ef-46fc-94fc-59332eb5fbaa',
  'c0000001-0000-0000-0000-000000000008',
  'voluntary_with_benefit', NULL,
  NULL, NULL,
  false, false, false, false, true,
  'Alabama Responsible Vendor Act',
  '2024 Code of Alabama Title 28 Chapter 10',
  'pending_approval',
  NOW(), NOW()
),

-- 14: Arkansas Responsible Permittee Program
(
  'd0000001-0000-0000-0000-000000000014',
  'Arkansas Responsible Permittee Program',
  'AR', 'state',
  '249677af-27ef-46fc-94fc-59332eb5fbaa',
  'c0000001-0000-0000-0000-000000000009',
  'voluntary_with_benefit', NULL,
  30, 1,
  false, false, true, false, true,
  'Arkansas Code Annotated',
  '3-4-801 to 807',
  'recon_done',
  NOW(), NOW()
),

-- 15: Texas Food Handler
(
  'd0000001-0000-0000-0000-000000000015',
  'Texas Food Handler',
  'TX', 'state',
  '5bd2b349-6d47-4cb3-936d-b5ecb1098df4',
  'c0000001-0000-0000-0000-000000000027',
  'required_certified', NULL,
  30, 2,
  false, true, false, false, false,
  'Texas Food Establishment Rules (TFER)',
  'Texas Health and Safety Code 438.046; 25 Texas Administrative Code 229.178',
  'recon_done',
  NOW(), NOW()
),

-- 16: Food Manager
(
  'd0000001-0000-0000-0000-000000000016',
  'Food Manager',
  'TX', 'state',
  'ab49890d-71b9-4ef1-91e1-8759559b2c7a',
  NULL,
  'required_certified', NULL,
  NULL, NULL,
  false, true, false, true, false,
  NULL,
  NULL,
  'recon_started',
  NOW(), NOW()
),

-- 17: Florida Food Handler
(
  'd0000001-0000-0000-0000-000000000017',
  'Florida Food Handler',
  'FL', 'state',
  '5bd2b349-6d47-4cb3-936d-b5ecb1098df4',
  'c0000001-0000-0000-0000-000000000003',
  'not_required', NULL,
  60, 3,
  false, true, false, false, false,
  'Florida Food Handler',
  'FDAS 500 Rule 5K-4.021(1) F.A.C.',
  'recon_done',
  NOW(), NOW()
),

-- 18: South Carolina Food Handler
(
  'd0000001-0000-0000-0000-000000000018',
  'South Carolina Food Handler',
  'SC', 'state',
  '5bd2b349-6d47-4cb3-936d-b5ecb1098df4',
  'c0000001-0000-0000-0000-000000000078',
  'suggested', NULL,
  NULL, 3,
  false, true, false, false, false,
  'Regulation 61-25: Retail Food Establishments',
  'Section 2-102.12 of Regulation 61-25',
  'recon_done',
  NOW(), NOW()
),

-- 19: New Mexico Food Handler
(
  'd0000001-0000-0000-0000-000000000019',
  'New Mexico Food Handler',
  'NM', 'state',
  '5bd2b349-6d47-4cb3-936d-b5ecb1098df4',
  'c0000001-0000-0000-0000-000000000044',
  'required_certified', NULL,
  30, 3,
  false, true, true, false, false,
  'New Mexico Food Service Sanitation Act',
  'NMAC 7.6.2',
  'recon_done',
  NOW(), NOW()
),

-- 20: Utah Food Handler
(
  'd0000001-0000-0000-0000-000000000020',
  'Utah Food Handler',
  'UT', 'state',
  '5bd2b349-6d47-4cb3-936d-b5ecb1098df4',
  'c0000001-0000-0000-0000-000000000035',
  'required_certified', NULL,
  14, 3,
  false, true, false, false, true,
  'Utah Administrative Code R392-103',
  'R392-103',
  'recon_done',
  NOW(), NOW()
),

-- 21: Illinois Food Handler
(
  'd0000001-0000-0000-0000-000000000021',
  'Illinois Food Handler',
  'IL', 'state',
  '5bd2b349-6d47-4cb3-936d-b5ecb1098df4',
  'c0000001-0000-0000-0000-000000000001',
  'required_certified', NULL,
  30, 3,
  false, true, false, false, false,
  'Food Handling Regulation Enforcement Act',
  '410 ILCS 625/3.05',
  'recon_done',
  NOW(), NOW()
),

-- 22: California Food Handler (All other counties)
(
  'd0000001-0000-0000-0000-000000000022',
  'California Food Handler (All other counties)',
  'CA', 'state',
  '5bd2b349-6d47-4cb3-936d-b5ecb1098df4',
  'c0000001-0000-0000-0000-000000000025',
  'required_certified', NULL,
  30, 3,
  false, true, false, false, false,
  'California Food Handler Card Law',
  'California Health and Safety Code 113790 et seq.',
  'recon_done',
  NOW(), NOW()
),

-- 23: Oregon Food Handler
(
  'd0000001-0000-0000-0000-000000000023',
  'Oregon Food Handler',
  'OR', 'state',
  '5bd2b349-6d47-4cb3-936d-b5ecb1098df4',
  'c0000001-0000-0000-0000-000000000040',
  'required_certified', NULL,
  30, 3,
  false, true, false, false, false,
  'Oregon Food Handler Certification',
  'Oregon Administrative Rule (OAR) 333-175',
  'recon_done',
  NOW(), NOW()
),

-- 24: Louisiana UST Class C
(
  'd0000001-0000-0000-0000-000000000024',
  'Louisiana UST Class C',
  'LA', 'state',
  '716953b1-4dab-4a1a-add8-38157fb2c545',
  'c0000001-0000-0000-0000-000000000012',
  'required_program', NULL,
  NULL, NULL,
  false, false, false, false, true,
  'Louisiana UST Operator Training Program',
  'LA Energy Policy Act of 2005',
  'done_no_approval_needed',
  NOW(), NOW()
),

-- 25: Alaska Food Handler
(
  'd0000001-0000-0000-0000-000000000025',
  'Alaska Food Handler',
  'AK', 'state',
  '5bd2b349-6d47-4cb3-936d-b5ecb1098df4',
  'c0000001-0000-0000-0000-000000000047',
  'required_certified', NULL,
  30, 3,
  false, true, true, false, false,
  'Alaska Administrative Code Title 18 Chapter 31',
  '18 AAC 31',
  'recon_done',
  NOW(), NOW()
),

-- 26: Maine Alcohol Sales Off Premise
(
  'd0000001-0000-0000-0000-000000000026',
  'Maine Alcohol Sales Off Premise',
  'ME', 'state',
  '249677af-27ef-46fc-94fc-59332eb5fbaa',
  'c0000001-0000-0000-0000-000000000042',
  'required_program', NULL,
  30, 3,
  false, false, false, true, true,
  'Maine Liquor Liability Act',
  'Title 28-A 2517',
  'recon_done',
  NOW(), NOW()
),

-- 27: Michigan Off Premise Alcohol Sales
(
  'd0000001-0000-0000-0000-000000000027',
  'Michigan Off Premise Alcohol Sales',
  'MI', 'state',
  '249677af-27ef-46fc-94fc-59332eb5fbaa',
  'c0000001-0000-0000-0000-000000000011',
  'sometimes_required', NULL,
  NULL, 3,
  false, false, false, true, true,
  'Michigan Liquor Control Code of 1998',
  'MCL 436.1906 & R 436.1533',
  'recon_done',
  NOW(), NOW()
),

-- 28: New York ATAP Off-Premise Alcohol Sales
(
  'd0000001-0000-0000-0000-000000000028',
  'New York ATAP Off-Premise Alcohol Sales',
  'NY', 'state',
  '249677af-27ef-46fc-94fc-59332eb5fbaa',
  'c0000001-0000-0000-0000-000000000038',
  'voluntary_with_benefit', NULL,
  NULL, 3,
  false, false, true, true, true,
  'Alcoholic Beverage Control Law - ATAP Program',
  'NY ABC 17-b',
  'recon_done',
  NOW(), NOW()
),

-- 29: Oklahoma Responsible Alcohol Sales & Service
(
  'd0000001-0000-0000-0000-000000000029',
  'Oklahoma Responsible Alcohol Sales & Service',
  'OK', 'state',
  '249677af-27ef-46fc-94fc-59332eb5fbaa',
  'c0000001-0000-0000-0000-000000000030',
  'required_certified', NULL,
  0, 2,
  false, false, true, true, false,
  'Oklahoma Alcoholic Beverage Control Act',
  'Title 37A 2-121',
  'recon_done',
  NOW(), NOW()
),

-- 30: Penns. Responsible Alcohol Management Program (RAMP)
(
  'd0000001-0000-0000-0000-000000000030',
  'Penns. Responsible Alcohol Management Program (RAMP)',
  'PA', 'state',
  '249677af-27ef-46fc-94fc-59332eb5fbaa',
  'c0000001-0000-0000-0000-000000000031',
  'required_certified', NULL,
  30, 2,
  false, false, true, true, true,
  'Pennsylvania Liquor Code',
  '47 P.S. 1-101-10-1001',
  'recon_done',
  NOW(), NOW()
),

-- 31: South Dakota Responsible Alcohol Sales
(
  'd0000001-0000-0000-0000-000000000031',
  'South Dakota Responsible Alcohol Sales',
  'SD', 'state',
  '249677af-27ef-46fc-94fc-59332eb5fbaa',
  'c0000001-0000-0000-0000-000000000045',
  'voluntary_with_benefit', NULL,
  30, 3,
  false, false, true, false, true,
  'South Dakota Codified Laws Title 35',
  NULL,
  'recon_done',
  NOW(), NOW()
),

-- 32: Tennessee Responsible Vendor
(
  'd0000001-0000-0000-0000-000000000032',
  'Tennessee Responsible Vendor',
  'TN', 'state',
  '249677af-27ef-46fc-94fc-59332eb5fbaa',
  'c0000001-0000-0000-0000-000000000028',
  'required_certified', NULL,
  61, 1,
  false, true, false, false, true,
  'Tennessee Responsible Vendor Act of 2006',
  'Tennessee Code Annotated 57-5-606',
  'production',
  NOW(), NOW()
),

-- 33: Utah EASY Off-Premise Alcohol Sales
(
  'd0000001-0000-0000-0000-000000000033',
  'Utah EASY Off-Premise Alcohol Sales',
  'UT', 'state',
  '249677af-27ef-46fc-94fc-59332eb5fbaa',
  'c0000001-0000-0000-0000-000000000034',
  'required_certified', NULL,
  0, 3,
  false, false, true, true, true,
  'Eliminate Alcohol Sales to Youth (E.A.S.Y.) Law',
  'Utah Code 32B-7-202',
  'recon_done',
  NOW(), NOW()
),

-- 34: Vermont Alcohol & Tobacco Off-Premise Seller
(
  'd0000001-0000-0000-0000-000000000034',
  'Vermont Alcohol & Tobacco Off-Premise Seller',
  'VT', 'state',
  '249677af-27ef-46fc-94fc-59332eb5fbaa',
  'c0000001-0000-0000-0000-000000000046',
  'required_program', NULL,
  0, 2,
  false, false, false, true, true,
  'Vermont Statutes Annotated (VSA)',
  'Title 7 Alcoholic Beverages & Title 7 Chapter 9 Tobacco Products',
  'recon_done',
  NOW(), NOW()
),

-- 35: Virginia Responsible Alcohol Sales
(
  'd0000001-0000-0000-0000-000000000035',
  'Virginia Responsible Alcohol Sales',
  'VA', 'state',
  '249677af-27ef-46fc-94fc-59332eb5fbaa',
  'c0000001-0000-0000-0000-000000000036',
  'voluntary_with_benefit', NULL,
  NULL, NULL,
  true, false, false, false, false,
  'Virginia Alcoholic Beverage Control Act',
  'Code of Virginia 4.1-227(E)',
  'recon_done',
  NOW(), NOW()
),

-- 36: California Workplace Violence Prevention
(
  'd0000001-0000-0000-0000-000000000036',
  'California Workplace Violence Prevention',
  'CA', 'state',
  'e0000001-0000-0000-0000-000000000002',
  'c0000001-0000-0000-0000-000000000024',
  'required_program', NULL,
  NULL, 1,
  true, false, false, false, false,
  'California Workplace Violence Prevention Law',
  'Labor Code 6401.9',
  'recon_done',
  NOW(), NOW()
),

-- 37: NY Retail Worker Safety Act (RWSA)
(
  'd0000001-0000-0000-0000-000000000037',
  'NY Retail Worker Safety Act (RWSA)',
  'NY', 'state',
  'e0000001-0000-0000-0000-000000000002',
  'c0000001-0000-0000-0000-000000000010',
  'required_program', NULL,
  NULL, 1,
  false, false, false, true, true,
  'The New York Retail Worker Safety Act (RWSA)',
  'N.Y. Labor Law 27-e',
  'recon_done',
  NOW(), NOW()
),

-- 38: California Sexual Harassment Prevention - Non-Manager
(
  'd0000001-0000-0000-0000-000000000038',
  'California Sexual Harassment Prevention - Non-Manager',
  'CA', 'state',
  '240f27d5-55d6-47f6-b332-ef140115d716',
  'c0000001-0000-0000-0000-000000000023',
  'required_no_list', NULL,
  30, 2,
  false, false, true, false, false,
  'California Fair Employment and Housing Act (FEHA)',
  'Government Code 12950.1',
  'recon_done',
  NOW(), NOW()
),

-- 39: California Sexual Harassment Prevention- Manager
(
  'd0000001-0000-0000-0000-000000000039',
  'California Sexual Harassment Prevention- Manager',
  'CA', 'state',
  '240f27d5-55d6-47f6-b332-ef140115d716',
  'c0000001-0000-0000-0000-000000000024',
  'required_no_list', NULL,
  30, 2,
  false, false, false, true, false,
  'California Sexual Harassment Prevention Training',
  'Government Code 12950.1',
  'recon_done',
  NOW(), NOW()
),

-- 40: Connecticut Sexual Harassment Prevention
(
  'd0000001-0000-0000-0000-000000000040',
  'Connecticut Sexual Harassment Prevention',
  'CT', 'state',
  '240f27d5-55d6-47f6-b332-ef140115d716',
  'c0000001-0000-0000-0000-000000000041',
  'required_program', NULL,
  183, 10,
  true, false, false, false, false,
  'Time''s Up Act & Connecticut Fair Employment Practices Act (CFEPA)',
  'Connecticut General Statutes 46a-60',
  'recon_done',
  NOW(), NOW()
),

-- 41: Delaware Sexual Harassment Prevention
(
  'd0000001-0000-0000-0000-000000000041',
  'Delaware Sexual Harassment Prevention',
  'DE', 'state',
  '240f27d5-55d6-47f6-b332-ef140115d716',
  'c0000001-0000-0000-0000-000000000048',
  'required_program', NULL,
  365, 2,
  true, false, false, false, false,
  'Delaware Discrimination in Employment Act (DDEA)',
  'Delaware Code Title 19 Chapter 7 Subchapter II',
  'recon_done',
  NOW(), NOW()
),

-- 42: Delaware Sexual Harassment Prevention- Manager
(
  'd0000001-0000-0000-0000-000000000042',
  'Delaware Sexual Harassment Prevention- Manager',
  'DE', 'state',
  '240f27d5-55d6-47f6-b332-ef140115d716',
  'c0000001-0000-0000-0000-000000000048',
  'required_program', NULL,
  365, 2,
  false, false, false, true, false,
  'Delaware Discrimination in Employment Act (DDEA)',
  '19 Del. C. 711A',
  'recon_done',
  NOW(), NOW()
),

-- 43: Maine Sexual Harassment Prevention- Manager
(
  'd0000001-0000-0000-0000-000000000043',
  'Maine Sexual Harassment Prevention- Manager',
  'ME', 'state',
  '240f27d5-55d6-47f6-b332-ef140115d716',
  'c0000001-0000-0000-0000-000000000049',
  'required_program', NULL,
  365, NULL,
  false, false, false, true, false,
  'Maine Human Rights Act',
  'Title 5 Chapter 337',
  'recon_done',
  NOW(), NOW()
),

-- 44: Maine Sexual Harassment Prevention
(
  'd0000001-0000-0000-0000-000000000044',
  'Maine Sexual Harassment Prevention',
  'ME', 'state',
  '240f27d5-55d6-47f6-b332-ef140115d716',
  'c0000001-0000-0000-0000-000000000049',
  'required_program', NULL,
  365, NULL,
  true, false, false, false, false,
  'Maine Human Rights Act (MHRA)',
  'Title 5 Maine Revised Statutes Chapter 337',
  'recon_done',
  NOW(), NOW()
),

-- 45: New York Sexual Harassment Prevention- Manager
(
  'd0000001-0000-0000-0000-000000000045',
  'New York Sexual Harassment Prevention- Manager',
  'NY', 'state',
  '240f27d5-55d6-47f6-b332-ef140115d716',
  'c0000001-0000-0000-0000-000000000010',
  'required_program', NULL,
  NULL, 1,
  false, false, false, true, false,
  'New York Sexual Harassment Prevention Training',
  'New York Labor Law 201-g',
  'recon_done',
  NOW(), NOW()
),

-- 46: New York Responsible Tobacco Sales
(
  'd0000001-0000-0000-0000-000000000046',
  'New York Responsible Tobacco Sales',
  'NY', 'state',
  'd54a96aa-75b3-4461-a485-f74eb7f6f459',
  'c0000001-0000-0000-0000-000000000039',
  'voluntary_with_benefit', NULL,
  30, 3,
  false, false, false, true, true,
  'New York Public Health Law',
  '1399-ee & 1399-cc',
  'recon_done',
  NOW(), NOW()
),

-- 47: Louisiana Responsible Vendor Permit (Bar Card)
(
  'd0000001-0000-0000-0000-000000000047',
  'Louisiana Responsible Vendor Permit (Bar Card)',
  'LA', 'state',
  '249677af-27ef-46fc-94fc-59332eb5fbaa',
  'c0000001-0000-0000-0000-000000000013',
  'required_certified', NULL,
  45, 4,
  false, false, false, false, true,
  'Responsible Vendor Program',
  'La. Admin. Code tit. 55 VII-511',
  'production',
  NOW(), NOW()
),

-- 48: Wisconsin Responsible Vendor
(
  'd0000001-0000-0000-0000-000000000048',
  'Wisconsin Responsible Vendor',
  'WI', 'state',
  '249677af-27ef-46fc-94fc-59332eb5fbaa',
  'c0000001-0000-0000-0000-000000000014',
  'required_certified', NULL,
  NULL, 2,
  false, false, false, false, true,
  'Before employee is allowed to sell/serve alcohol',
  'Wisconsin Statutes Chapter 125',
  'recon_done',
  NOW(), NOW()
),

-- 49: Missouri (SMART) Alcohol Responsibility Training Program
(
  'd0000001-0000-0000-0000-000000000049',
  'Missouri (SMART) Alcohol Responsibility Training Program',
  'MO', 'state',
  '249677af-27ef-46fc-94fc-59332eb5fbaa',
  'c0000001-0000-0000-0000-000000000015',
  'voluntary_with_benefit', NULL,
  NULL, NULL,
  false, false, false, false, true,
  NULL,
  NULL,
  'recon_done',
  NOW(), NOW()
),

-- 50: Missouri Class C UST
(
  'd0000001-0000-0000-0000-000000000050',
  'Missouri Class C UST',
  'MO', 'state',
  '716953b1-4dab-4a1a-add8-38157fb2c545',
  'c0000001-0000-0000-0000-000000000016',
  'required_program', NULL,
  NULL, NULL,
  false, false, false, false, true,
  NULL,
  NULL,
  'done_no_approval_needed',
  NOW(), NOW()
),

-- 51: Kentucky Responsible Seller Server Training (Lexington-Fayette)
(
  'd0000001-0000-0000-0000-000000000051',
  'Kentucky Responsible Seller Server Training (Lexington-Fayette)',
  'KY', 'state',
  '249677af-27ef-46fc-94fc-59332eb5fbaa',
  'c0000001-0000-0000-0000-000000000017',
  'required_certified', NULL,
  60, 3,
  false, false, false, false, true,
  NULL,
  NULL,
  'recon_done',
  NOW(), NOW()
),

-- 52: Texas Class C UST
(
  'd0000001-0000-0000-0000-000000000052',
  'Texas Class C UST',
  'TX', 'state',
  '716953b1-4dab-4a1a-add8-38157fb2c545',
  'c0000001-0000-0000-0000-000000000020',
  'required_program', NULL,
  NULL, 3,
  false, false, false, false, true,
  'Texas UST Operator Training Rule',
  '30 TAC 334.603',
  'recon_done',
  NOW(), NOW()
),

-- 53: Ohio Food Safety (PIC Level One) Certification
(
  'd0000001-0000-0000-0000-000000000053',
  'Ohio Food Safety (PIC Level One) Certification',
  'OH', 'state',
  'ab49890d-71b9-4ef1-91e1-8759559b2c7a',
  'c0000001-0000-0000-0000-000000000029',
  'required_certified', NULL,
  30, 3,
  false, false, false, true, true,
  'Ohio Uniform Food Safety Code',
  'OAC 3701-21-25',
  'recon_done',
  NOW(), NOW()
),

-- 54: South Carolina Food Manager
(
  'd0000001-0000-0000-0000-000000000054',
  'South Carolina Food Manager',
  'SC', 'state',
  'ab49890d-71b9-4ef1-91e1-8759559b2c7a',
  'c0000001-0000-0000-0000-000000000033',
  'required_certified', NULL,
  30, 5,
  false, false, false, true, false,
  '2017 FDA Food Code',
  'Regulation 61-25 Section 2-102.12',
  'recon_done',
  NOW(), NOW()
),

-- 55: California Class C UST
(
  'd0000001-0000-0000-0000-000000000055',
  'California Class C UST',
  'CA', 'state',
  '716953b1-4dab-4a1a-add8-38157fb2c545',
  'c0000001-0000-0000-0000-000000000050',
  'required_certified', NULL,
  0, NULL,
  false, false, true, false, false,
  'California UST Regulations',
  'Title 23 Chapter 16 Section 2715',
  'recon_done',
  NOW(), NOW()
),

-- 56: New York Class C UST
(
  'd0000001-0000-0000-0000-000000000056',
  'New York Class C UST',
  'NY', 'state',
  '716953b1-4dab-4a1a-add8-38157fb2c545',
  'c0000001-0000-0000-0000-000000000051',
  'required_certified', NULL,
  NULL, 0,
  false, false, false, false, true,
  'Petroleum Bulk Storage (PBS) Regulations',
  '6 NYCRR Part 613-2.5',
  'recon_done',
  NOW(), NOW()
),

-- 57: Ohio Class C UST
(
  'd0000001-0000-0000-0000-000000000057',
  'Ohio Class C UST',
  'OH', 'state',
  '716953b1-4dab-4a1a-add8-38157fb2c545',
  'c0000001-0000-0000-0000-000000000053',
  'required_program', NULL,
  NULL, NULL,
  false, false, false, false, true,
  'Ohio Administrative Code Rule',
  'OAC 1301:7-9-19',
  'recon_done',
  NOW(), NOW()
),

-- 58: California Food Manager
(
  'd0000001-0000-0000-0000-000000000058',
  'California Food Manager',
  'CA', 'state',
  'ab49890d-71b9-4ef1-91e1-8759559b2c7a',
  'c0000001-0000-0000-0000-000000000025',
  'required_certified', NULL,
  NULL, 5,
  false, false, false, true, false,
  'California Retail Food Code',
  'Section 113947-113947.1',
  'recon_done',
  NOW(), NOW()
),

-- 59: New York Food Handler
(
  'd0000001-0000-0000-0000-000000000059',
  'New York Food Handler',
  'NY', 'state',
  '5bd2b349-6d47-4cb3-936d-b5ecb1098df4',
  'c0000001-0000-0000-0000-000000000039',
  'sometimes_required', NULL,
  NULL, NULL,
  false, true, false, false, false,
  NULL,
  NULL,
  'recon_started',
  NOW(), NOW()
),

-- 60: Michigan Class C UST
(
  'd0000001-0000-0000-0000-000000000060',
  'Michigan Class C UST',
  'MI', 'state',
  '716953b1-4dab-4a1a-add8-38157fb2c545',
  'c0000001-0000-0000-0000-000000000011',
  'required_program', NULL,
  NULL, 0,
  false, false, true, false, false,
  NULL,
  'Michigan Administrative Code R. 29.2177',
  'recon_done',
  NOW(), NOW()
),

-- 61: Pennsylvania Class C UST
(
  'd0000001-0000-0000-0000-000000000061',
  'Pennsylvania Class C UST',
  'PA', 'state',
  '716953b1-4dab-4a1a-add8-38157fb2c545',
  'c0000001-0000-0000-0000-000000000054',
  'required_program', NULL,
  NULL, 1,
  false, false, true, false, false,
  'Storage Tank and Spill Prevention Act',
  'Title 25 Pennsylvania Code Chapter 245.436',
  'recon_done',
  NOW(), NOW()
),

-- 62: Texas Tobacco Retailer
(
  'd0000001-0000-0000-0000-000000000062',
  'Texas Tobacco Retailer',
  'TX', 'state',
  'd54a96aa-75b3-4461-a485-f74eb7f6f459',
  'c0000001-0000-0000-0000-000000000055',
  'voluntary_with_benefit', NULL,
  3, NULL,
  false, false, false, false, true,
  'Texas Cigarette E-Cigarette and Tobacco Products Law',
  'Health & Safety Code 161.085',
  'recon_done',
  NOW(), NOW()
),

-- 63: Florida Tobacco Sales
(
  'd0000001-0000-0000-0000-000000000063',
  'Florida Tobacco Sales',
  'FL', 'state',
  'd54a96aa-75b3-4461-a485-f74eb7f6f459',
  'c0000001-0000-0000-0000-000000000004',
  'voluntary_with_benefit', NULL,
  NULL, NULL,
  false, false, false, false, true,
  'Florida Responsible Vendor Act - Tobacco Products',
  'Florida Statutes 569.002-569.0075',
  'recon_done',
  NOW(), NOW()
),

-- 64: Tennessee Class C UST
(
  'd0000001-0000-0000-0000-000000000064',
  'Tennessee Class C UST',
  'TN', 'state',
  '716953b1-4dab-4a1a-add8-38157fb2c545',
  'c0000001-0000-0000-0000-000000000056',
  'required_program', NULL,
  NULL, NULL,
  false, false, false, false, true,
  'Underground Storage Tanks Regulations',
  'Tenn. Comp. R. & Regs. 0400-18-01-.16',
  'recon_done',
  NOW(), NOW()
),

-- 65: Tennessee Tobacco Sales Awareness
(
  'd0000001-0000-0000-0000-000000000065',
  'Tennessee Tobacco Sales Awareness',
  'TN', 'state',
  'd54a96aa-75b3-4461-a485-f74eb7f6f459',
  'c0000001-0000-0000-0000-000000000057',
  'required_program', NULL,
  NULL, NULL,
  false, false, false, false, true,
  'Tennessee Prevention of Youth Access to Tobacco',
  'Tenn. Code Ann. 39-17-1501 et seq.',
  'recon_done',
  NOW(), NOW()
),

-- 66: Ohio Food Safety (Manager Level Two) Certification
(
  'd0000001-0000-0000-0000-000000000066',
  'Ohio Food Safety (Manager Level Two) Certification',
  'OH', 'state',
  'ab49890d-71b9-4ef1-91e1-8759559b2c7a',
  'c0000001-0000-0000-0000-000000000029',
  'required_certified', NULL,
  NULL, 5,
  false, false, false, true, false,
  'Ohio Uniform Food Safety Code',
  'Ohio Administrative Code 3701-21-25',
  'recon_done',
  NOW(), NOW()
),

-- 67: Ohio Off Premise Alcohol
(
  'd0000001-0000-0000-0000-000000000067',
  'Ohio Off Premise Alcohol',
  'OH', 'state',
  '249677af-27ef-46fc-94fc-59332eb5fbaa',
  'c0000001-0000-0000-0000-000000000059',
  'voluntary_with_benefit', NULL,
  NULL, NULL,
  false, false, false, false, true,
  NULL,
  'Ohio Revised Code 4301.253',
  'recon_done',
  NOW(), NOW()
),

-- 68: Ohio Tobacco
(
  'd0000001-0000-0000-0000-000000000068',
  'Ohio Tobacco',
  'OH', 'state',
  'd54a96aa-75b3-4461-a485-f74eb7f6f459',
  'c0000001-0000-0000-0000-000000000029',
  'voluntary_with_benefit', NULL,
  NULL, 3,
  false, false, false, false, true,
  'Ohio Tobacco 21 Law',
  'Ohio Revised Code 2927.02',
  'recon_done',
  NOW(), NOW()
),

-- 69: Illinois Food Protection Manager (CFPM)
(
  'd0000001-0000-0000-0000-000000000069',
  'Illinois Food Protection Manager (CFPM)',
  'IL', 'state',
  'ab49890d-71b9-4ef1-91e1-8759559b2c7a',
  'c0000001-0000-0000-0000-000000000001',
  'required_certified', NULL,
  NULL, 5,
  false, false, false, true, false,
  'Illinois Food Handling Regulation Enforcement Act',
  '77 Ill. Adm. Code 750.500',
  'recon_done',
  NOW(), NOW()
),

-- 70: Illinois Tobacco Sales
(
  'd0000001-0000-0000-0000-000000000070',
  'Illinois Tobacco Sales',
  'IL', 'state',
  'd54a96aa-75b3-4461-a485-f74eb7f6f459',
  'c0000001-0000-0000-0000-000000000060',
  'voluntary_with_benefit', NULL,
  NULL, NULL,
  false, false, false, false, true,
  'Prevention of Tobacco Use by Minors Act',
  '720 ILCS 675',
  'recon_done',
  NOW(), NOW()
),

-- 71: Kentucky Class C UST
(
  'd0000001-0000-0000-0000-000000000071',
  'Kentucky Class C UST',
  'KY', 'state',
  '716953b1-4dab-4a1a-add8-38157fb2c545',
  'c0000001-0000-0000-0000-000000000062',
  'required_certified', NULL,
  NULL, NULL,
  false, false, false, false, true,
  NULL,
  '401 KAR 42:020 Sections 7 & 8',
  'recon_done',
  NOW(), NOW()
),

-- 72: Kentucky Lexington-Fayette County Off-Premise Alcohol
(
  'd0000001-0000-0000-0000-000000000072',
  'Kentucky Lexington-Fayette County Off-Premise Alcohol',
  'KY', 'state',
  '249677af-27ef-46fc-94fc-59332eb5fbaa',
  'c0000001-0000-0000-0000-000000000017',
  'required_program', NULL,
  NULL, 3,
  false, false, false, false, true,
  NULL,
  'Lexington-Fayette Code of Ordinances Chapter 3',
  'recon_done',
  NOW(), NOW()
),

-- 73: Kentucky Lexington-Fayette Food Handler
(
  'd0000001-0000-0000-0000-000000000073',
  'Kentucky Lexington-Fayette Food Handler',
  'KY', 'state',
  '5bd2b349-6d47-4cb3-936d-b5ecb1098df4',
  'c0000001-0000-0000-0000-000000000063',
  'required_certified', NULL,
  NULL, 3,
  false, true, false, false, false,
  NULL,
  'Board of Health Regulation 19',
  'recon_started',
  NOW(), NOW()
),

-- 74: California Off-Premise Alcohol
(
  'd0000001-0000-0000-0000-000000000074',
  'California Off-Premise Alcohol',
  'CA', 'state',
  '249677af-27ef-46fc-94fc-59332eb5fbaa',
  'c0000001-0000-0000-0000-000000000022',
  'voluntary_with_benefit', NULL,
  60, 3,
  false, false, false, false, true,
  'Assembly Bill 1221 (2017)',
  'California Business and Professions Code 25680-25686',
  'recon_done',
  NOW(), NOW()
),

-- 75: Mississippi Tobacco Sales
(
  'd0000001-0000-0000-0000-000000000075',
  'Mississippi Tobacco Sales',
  'MS', 'state',
  'd54a96aa-75b3-4461-a485-f74eb7f6f459',
  'c0000001-0000-0000-0000-000000000064',
  'voluntary_with_benefit', NULL,
  NULL, NULL,
  false, false, false, false, true,
  NULL,
  NULL,
  'recon_done',
  NOW(), NOW()
),

-- 76: Mississippi Off-Premise Alcohol Sales
(
  'd0000001-0000-0000-0000-000000000076',
  'Mississippi Off-Premise Alcohol Sales',
  'MS', 'state',
  '249677af-27ef-46fc-94fc-59332eb5fbaa',
  'c0000001-0000-0000-0000-000000000065',
  'voluntary_with_benefit', NULL,
  NULL, NULL,
  false, false, false, false, true,
  NULL,
  NULL,
  'recon_done',
  NOW(), NOW()
),

-- 77: Mississippi Class C UST
(
  'd0000001-0000-0000-0000-000000000077',
  'Mississippi Class C UST',
  'MS', 'state',
  '716953b1-4dab-4a1a-add8-38157fb2c545',
  'c0000001-0000-0000-0000-000000000066',
  'required_certified', NULL,
  NULL, NULL,
  false, false, false, false, true,
  'Mississippi Underground Storage Tank Regulations',
  '11 Miss. Admin. Code Pt. 5 Ch. 2',
  'approved',
  NOW(), NOW()
),

-- 78: Mississippi Food Handler
(
  'd0000001-0000-0000-0000-000000000078',
  'Mississippi Food Handler',
  'MS', 'state',
  '5bd2b349-6d47-4cb3-936d-b5ecb1098df4',
  'c0000001-0000-0000-0000-000000000064',
  'required_program', NULL,
  NULL, 3,
  false, true, false, false, true,
  'Mississippi Food Code',
  'Rule 2.2.3 Chapter 2 Subpart 2-101.11',
  'recon_done',
  NOW(), NOW()
),

-- 79: North Carolina Tobacco Sales
(
  'd0000001-0000-0000-0000-000000000079',
  'North Carolina Tobacco Sales',
  'NC', 'state',
  'd54a96aa-75b3-4461-a485-f74eb7f6f459',
  'c0000001-0000-0000-0000-000000000067',
  'voluntary_with_benefit', NULL,
  NULL, NULL,
  false, false, false, false, true,
  NULL,
  'North Carolina General Statute 14-313',
  'recon_done',
  NOW(), NOW()
),

-- 80: North Carolina Off-Premise Alcohol Sales
(
  'd0000001-0000-0000-0000-000000000080',
  'North Carolina Off-Premise Alcohol Sales',
  'NC', 'state',
  '249677af-27ef-46fc-94fc-59332eb5fbaa',
  'c0000001-0000-0000-0000-000000000068',
  'voluntary_with_benefit', NULL,
  NULL, 3,
  false, false, false, false, true,
  NULL,
  'North Carolina General Statutes Chapter 18B',
  'recon_done',
  NOW(), NOW()
),

-- 81: North Carolina Class C UST
(
  'd0000001-0000-0000-0000-000000000081',
  'North Carolina Class C UST',
  'NC', 'state',
  '716953b1-4dab-4a1a-add8-38157fb2c545',
  'c0000001-0000-0000-0000-000000000052',
  'required_certified', NULL,
  NULL, NULL,
  false, false, false, false, true,
  NULL,
  'North Carolina General Statutes 143-215.94NN-TT',
  'recon_done',
  NOW(), NOW()
),

-- 82: North Carolina Food Handler
(
  'd0000001-0000-0000-0000-000000000082',
  'North Carolina Food Handler',
  'NC', 'state',
  '5bd2b349-6d47-4cb3-936d-b5ecb1098df4',
  'c0000001-0000-0000-0000-000000000067',
  'voluntary_with_benefit', NULL,
  NULL, 3,
  false, true, false, false, false,
  NULL,
  NULL,
  'recon_done',
  NOW(), NOW()
),

-- 83: Pennsylvania Tobacco Sales
(
  'd0000001-0000-0000-0000-000000000083',
  'Pennsylvania Tobacco Sales',
  'PA', 'state',
  'd54a96aa-75b3-4461-a485-f74eb7f6f459',
  'c0000001-0000-0000-0000-000000000070',
  'voluntary_with_benefit', NULL,
  NULL, NULL,
  false, false, false, false, true,
  'Act 112 of 2002',
  '18 Pa. C.S. 6305',
  'recon_done',
  NOW(), NOW()
),

-- 84: Pennsylvania Food Handler
(
  'd0000001-0000-0000-0000-000000000084',
  'Pennsylvania Food Handler',
  'PA', 'state',
  '5bd2b349-6d47-4cb3-936d-b5ecb1098df4',
  'c0000001-0000-0000-0000-000000000069',
  'not_required', NULL,
  NULL, 3,
  false, true, false, false, false,
  'Food Employee Certification Act',
  '3 Pa. C.S. 6501-6510',
  'recon_done',
  NOW(), NOW()
),

-- 85: Mississippi Food Protection Manager (CFPM)
(
  'd0000001-0000-0000-0000-000000000085',
  'Mississippi Food Protection Manager (CFPM)',
  'MS', 'state',
  'ab49890d-71b9-4ef1-91e1-8759559b2c7a',
  'c0000001-0000-0000-0000-000000000064',
  'required_certified', NULL,
  NULL, 5,
  false, false, false, true, false,
  'Mississippi Food Code',
  'Rule 2.2.3 Chapter 2 Subpart 2-101.11',
  'recon_done',
  NOW(), NOW()
),

-- 86: North Carolina Certified Food Protection Manager (CFPM)
(
  'd0000001-0000-0000-0000-000000000086',
  'North Carolina Certified Food Protection Manager (CFPM)',
  'NC', 'state',
  'ab49890d-71b9-4ef1-91e1-8759559b2c7a',
  'c0000001-0000-0000-0000-000000000067',
  'required_certified', NULL,
  NULL, 5,
  false, false, false, true, false,
  'North Carolina Food Code',
  NULL,
  'recon_done',
  NOW(), NOW()
),

-- 87: Pennsylvania Certified Food Protection Manager (CFPM)
(
  'd0000001-0000-0000-0000-000000000087',
  'Pennsylvania Certified Food Protection Manager (CFPM)',
  'PA', 'state',
  'ab49890d-71b9-4ef1-91e1-8759559b2c7a',
  'c0000001-0000-0000-0000-000000000069',
  'required_certified', NULL,
  NULL, 5,
  false, false, false, true, false,
  'Food Employee Certification Act',
  '3 Pa. C.S. 6501-6510',
  'recon_done',
  NOW(), NOW()
),

-- 88: Oklahoma Class C UST
(
  'd0000001-0000-0000-0000-000000000088',
  'Oklahoma Class C UST',
  'OK', 'state',
  '716953b1-4dab-4a1a-add8-38157fb2c545',
  'c0000001-0000-0000-0000-000000000071',
  'required_program', NULL,
  30, NULL,
  false, false, false, false, true,
  'Oklahoma Corporation Commission Underground Storage Tank Regulations',
  'OAC 165:25-1-130',
  'done_no_approval_needed',
  NOW(), NOW()
),

-- 89: Wisconsin Class C UST
(
  'd0000001-0000-0000-0000-000000000089',
  'Wisconsin Class C UST',
  'WI', 'state',
  '716953b1-4dab-4a1a-add8-38157fb2c545',
  'c0000001-0000-0000-0000-000000000072',
  'required_certified', NULL,
  30, NULL,
  false, false, false, false, true,
  'Wisconsin Administrative Code ATCP 93',
  'Wis. Admin. Code ATCP 93.800-93.880',
  'recon_done',
  NOW(), NOW()
),

-- 90: Alabama Class C UST
(
  'd0000001-0000-0000-0000-000000000090',
  'Alabama Class C UST',
  'AL', 'state',
  '716953b1-4dab-4a1a-add8-38157fb2c545',
  'c0000001-0000-0000-0000-000000000073',
  'required_program', NULL,
  30, NULL,
  false, false, false, false, true,
  'Alabama UST Regulations',
  'ADEM Admin. Code r. 335-6-15-46',
  'approved',
  NOW(), NOW()
),

-- 91: Arizona Class C UST
(
  'd0000001-0000-0000-0000-000000000091',
  'Arizona Class C UST',
  'AZ', 'state',
  '716953b1-4dab-4a1a-add8-38157fb2c545',
  'c0000001-0000-0000-0000-000000000074',
  'required_no_list', NULL,
  NULL, 3,
  false, false, false, false, true,
  NULL,
  'Arizona Administrative Code A.A.C. Title 18 Chapter 12',
  'recon_done',
  NOW(), NOW()
),

-- 92: Arkansas Class C UST
(
  'd0000001-0000-0000-0000-000000000092',
  'Arkansas Class C UST',
  'AR', 'state',
  '716953b1-4dab-4a1a-add8-38157fb2c545',
  'c0000001-0000-0000-0000-000000000075',
  'required_program', NULL,
  NULL, NULL,
  false, false, false, false, true,
  'Arkansas Pollution Control and Ecology Commission Regulation No. 12',
  'APC&EC Regulation 12 Chapter 7',
  'recon_done',
  NOW(), NOW()
),

-- 93: Washington Food Handler
(
  'd0000001-0000-0000-0000-000000000093',
  'Washington Food Handler',
  'WA', 'state',
  '5bd2b349-6d47-4cb3-936d-b5ecb1098df4',
  'c0000001-0000-0000-0000-000000000076',
  'required_certified', NULL,
  14, 2,
  false, true, false, false, false,
  'Washington State Food Worker Card Program',
  'Washington Administrative Code (WAC) 246-217',
  'recon_done',
  NOW(), NOW()
),

-- 94: South Carolina Class C UST
(
  'd0000001-0000-0000-0000-000000000094',
  'South Carolina Class C UST',
  'SC', 'state',
  '716953b1-4dab-4a1a-add8-38157fb2c545',
  'c0000001-0000-0000-0000-000000000077',
  'required_program', NULL,
  0, NULL,
  false, false, false, false, true,
  'South Carolina Underground Storage Tank Control Regulations',
  'S.C. Code Sections 44-2-10 et seq.',
  'done_no_approval_needed',
  NOW(), NOW()
),

-- 95: New Mexico Class C UST
(
  'd0000001-0000-0000-0000-000000000095',
  'New Mexico Class C UST',
  'NM', 'state',
  '716953b1-4dab-4a1a-add8-38157fb2c545',
  'c0000001-0000-0000-0000-000000000044',
  'required_program', NULL,
  NULL, NULL,
  false, false, false, false, true,
  'New Mexico Petroleum Storage Tank Operator Training',
  'New Mexico Administrative Code Title 20 Chapter 5 Part 104',
  'production',
  NOW(), NOW()
)

ON CONFLICT (id) DO NOTHING;
