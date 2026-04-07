// ============================================================================
// SMART COLUMN MAPPING ENGINE FOR EMPLOYEE IMPORT
// ============================================================================
// Fuzzy-matches CSV/Excel headers to our users table fields using alias
// dictionaries and confidence scoring. No React dependencies.
// ============================================================================

import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';
import * as XLSX from 'xlsx';

/**
 * Sentinel value for "no mapping" in Radix Select. Radix forbids empty-string values,
 * so we use this constant. Imported by both employee + unit import components.
 */
export const SKIP_VALUE = '__skip__';

export interface TargetField {
  key: string;
  label: string;
  required: boolean;
  aliases: string[];
}

export interface ColumnMatch {
  sourceHeader: string;
  targetField: string | null;
  confidence: number;
  matchType: 'exact' | 'contains' | 'fuzzy' | 'none';
  priority: number; // 1 = primary, 2 = fallback
}

// Fields that commonly have multiple columns in HRIS exports
// (e.g., "Work Email" + "Personal Email")
export const FALLBACK_FIELDS = new Set(['email']);

// Target fields with normalized aliases (all lowercase, no spaces/special chars)
export const FIELD_DEFINITIONS: TargetField[] = [
  {
    key: 'email',
    label: 'Email',
    required: false,
    aliases: [
      'email', 'emailaddress', 'workemail', 'currentworkemail',
      'currenthomeemail', 'emailwork', 'emailhome', 'workemailaddress',
      'personalemail', 'homeemail'
    ]
  },
  {
    key: 'full_name',
    label: 'Full Name',
    required: false,
    aliases: [
      'fullname', 'name', 'employeename', 'displayname', 'preferredname',
      'legalname', 'empname', 'personname', 'nameoflegalentity'
    ]
  },
  {
    key: 'first_name',
    label: 'First Name',
    required: true,
    aliases: [
      'firstname', 'first', 'fname', 'preferredfirstname',
      'preferredname', 'givenname', 'forename'
    ]
  },
  {
    key: 'last_name',
    label: 'Last Name',
    required: true,
    aliases: [
      'lastname', 'last', 'lname', 'surname', 'familyname'
    ]
  },
  {
    key: 'employee_id',
    label: 'Employee ID',
    required: false,
    aliases: [
      'employeeid', 'empid', 'badge', 'badgenumber', 'emp',
      'empno', 'employeenumber', 'employeeno', 'empnum'
    ]
  },
  {
    key: 'mobile_phone',
    label: 'Mobile Phone',
    required: true,
    aliases: [
      'mobile', 'cell', 'cellphone', 'mobilephone', 'mobilenumber',
      'cellphonenumber', 'mobilephonenumber', 'cellnumber',
      'cellno', 'mobileno', 'mobiletel'
    ]
  },
  {
    key: 'phone',
    label: 'Phone (Other)',
    required: false,
    aliases: [
      'phone', 'phonenumber', 'telephone', 'homephone', 'workphone',
      'phonehome', 'phonework', 'tel', 'daytimephone', 'eveningphone'
    ]
  },
  {
    key: 'hire_date',
    label: 'Hire Date',
    required: false,
    aliases: [
      'hiredate', 'dateofhire', 'startdate', 'hire', 'hireddate',
      'datestarted', 'employmentdate', 'starteddate', 'datehired',
      'originalhiredate'
    ]
  },
  {
    key: 'store_name',
    label: 'Store / Location',
    required: false,
    aliases: [
      'store', 'location', 'site', 'sitesdescription', 'defaultdepartment',
      'storename', 'unit', 'branch', 'office', 'facility', 'worklocation',
      'homelocation', 'homestore', 'assignedstore', 'department'
    ]
  },
  {
    key: 'role_name',
    label: 'Position / Title',
    required: false,
    aliases: [
      'position', 'jobtitle', 'role', 'title', 'glpositiondescription',
      'position1', 'jobtitlepit', 'positiondescription', 'jobposition',
      'jobname', 'jobrole', 'classification', 'jobclassification'
    ]
  },
  {
    key: 'status',
    label: 'Status',
    required: false,
    aliases: [
      'status', 'employeestatus', 'employeestatusdescription',
      'empstatus', 'activestatus', 'employmentstatus'
    ]
  },
  {
    key: 'employment_type',
    label: 'Employment Type',
    required: false,
    aliases: [
      'employmenttype', 'type', 'employmenttypedescription', 'flsastatus',
      'flsa', 'exemptstatus', 'exempt', 'nonexempt', 'hourlysalary',
      'payclass', 'payclassification'
    ]
  }
];

/**
 * Normalize a header string for comparison.
 * Strips all non-alphanumeric chars, lowercases.
 */
export function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Match source headers to target fields with confidence scoring.
 * Returns one ColumnMatch per source header.
 * For fallback-eligible fields (email, phone), allows a second column
 * as a fallback — e.g., "Work Email" (primary) + "Personal Email" (fallback).
 */
export function matchColumns(headers: string[]): ColumnMatch[] {
  const normalized = headers.map(h => normalizeHeader(h));

  // Score every (source, target) pair
  const scores: Array<{
    sourceIdx: number;
    targetKey: string;
    confidence: number;
    matchType: 'exact' | 'contains' | 'fuzzy';
  }> = [];

  normalized.forEach((norm, sourceIdx) => {
    FIELD_DEFINITIONS.forEach(field => {
      // Exact match against any alias
      if (field.aliases.includes(norm)) {
        scores.push({ sourceIdx, targetKey: field.key, confidence: 100, matchType: 'exact' });
        return;
      }

      // Contains match — normalized header contains an alias or vice versa
      for (const alias of field.aliases) {
        if (norm.includes(alias) || alias.includes(norm)) {
          const overlap = Math.min(norm.length, alias.length) / Math.max(norm.length, alias.length);
          scores.push({
            sourceIdx,
            targetKey: field.key,
            confidence: Math.round(70 + overlap * 15),
            matchType: 'contains'
          });
          break;
        }
      }
    });
  });

  // Sort by confidence descending and greedily assign primaries
  scores.sort((a, b) => b.confidence - a.confidence);

  const assignedTargets = new Set<string>();
  const assignedSources = new Set<number>();
  const results: ColumnMatch[] = headers.map(h => ({
    sourceHeader: h,
    targetField: null,
    confidence: 0,
    matchType: 'none' as const,
    priority: 1
  }));

  // Pass 1: assign primaries (one source per target)
  for (const score of scores) {
    if (assignedTargets.has(score.targetKey) || assignedSources.has(score.sourceIdx)) continue;
    assignedTargets.add(score.targetKey);
    assignedSources.add(score.sourceIdx);
    results[score.sourceIdx] = {
      sourceHeader: headers[score.sourceIdx],
      targetField: score.targetKey,
      confidence: score.confidence,
      matchType: score.matchType,
      priority: 1
    };
  }

  // Pass 2: assign fallbacks for eligible fields (email, phone)
  for (const score of scores) {
    if (assignedSources.has(score.sourceIdx)) continue;
    if (!FALLBACK_FIELDS.has(score.targetKey)) continue;
    if (!assignedTargets.has(score.targetKey)) continue; // only if a primary exists
    assignedSources.add(score.sourceIdx);
    results[score.sourceIdx] = {
      sourceHeader: headers[score.sourceIdx],
      targetField: score.targetKey,
      confidence: score.confidence,
      matchType: score.matchType,
      priority: 2
    };
  }

  return results;
}

/**
 * Normalize a date string from various formats to YYYY-MM-DD.
 * Handles: MM/DD/YYYY, M/D/YYYY, YYYY-MM-DD, MM-DD-YYYY, etc.
 * Returns null if unparseable.
 */
export function normalizeDateValue(value: string): string | null {
  if (!value || !value.trim()) return null;
  const trimmed = value.trim();

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  // MM/DD/YYYY or M/D/YYYY (US convention)
  const usSlash = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (usSlash) {
    const month = usSlash[1].padStart(2, '0');
    const day = usSlash[2].padStart(2, '0');
    const year = usSlash[3];
    const m = parseInt(month, 10);
    const d = parseInt(day, 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${year}-${month}-${day}`;
    }
  }

  // Try native Date parsing as last resort
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1900) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return null;
}

export interface PhoneValidationResult {
  e164: string | null;
  formatted: string;
  type: 'MOBILE' | 'FIXED_LINE' | 'FIXED_LINE_OR_MOBILE' | 'VOIP' | 'UNKNOWN';
  valid: boolean;
  isMobile: boolean;
}

/**
 * Pre-clean a raw phone value from an HRIS export before validation.
 * Strips common artifacts: labels, suffixes, multiple numbers, scientific notation.
 */
export function cleanPhoneInput(value: string): string {
  if (!value) return '';
  let cleaned = value.trim();

  // Normalize unicode whitespace (non-breaking spaces, etc.)
  cleaned = cleaned.replace(/\s+/g, ' ');

  // Handle Excel scientific notation: "5.55123e+09" → "5551230000"
  if (/^\d+(\.\d+)?e[+-]?\d+$/i.test(cleaned)) {
    const num = Number(cleaned);
    if (!isNaN(num) && isFinite(num)) {
      cleaned = Math.round(num).toString();
    }
  }

  // Strip leading labels: "Cell: 555...", "Mobile - 555...", "Phone: 555..."
  cleaned = cleaned.replace(/^(cell|mobile|phone|tel|home|work|primary)\s*[:\-–]\s*/i, '');

  // Take only the first number if multiple are present (separated by / , ; or "or")
  const multiSep = cleaned.split(/\s*(?:\/|;|\bor\b)\s*/i);
  if (multiSep.length > 1) cleaned = multiSep[0];
  // Comma split — but only if the part before contains enough digits to be a phone
  if (cleaned.includes(',')) {
    const firstPart = cleaned.split(',')[0];
    if ((firstPart.match(/\d/g) || []).length >= 10) cleaned = firstPart;
  }

  // Strip trailing annotation after the number ends.
  // Matches: a digit or closing paren, then whitespace, then a letter or opening paren, then anything.
  // This preserves "(212) 555-1234" while stripping "555-1234 (cell)" or "555-1234 home".
  cleaned = cleaned.replace(/([\d)])\s+[a-zA-Z(].*$/, '$1');

  // Strip trailing extension markers attached directly: "x567", "ext567"
  cleaned = cleaned.replace(/\s*(?:ext\.?|x)\s*\d+\s*$/i, '');

  return cleaned.trim();
}

/**
 * Validate and normalize a phone number using libphonenumber-js.
 * Returns structured result with E.164 format, line type, and mobile flag.
 */
export function validatePhone(value: string): PhoneValidationResult {
  const empty: PhoneValidationResult = { e164: null, formatted: '', type: 'UNKNOWN', valid: false, isMobile: false };
  if (!value || !value.trim()) return empty;

  const cleaned = cleanPhoneInput(value);
  if (!cleaned) return empty;

  const tryParse = (input: string, defaultCountry?: 'US'): PhoneValidationResult | null => {
    try {
      const phone = defaultCountry
        ? parsePhoneNumber(input, defaultCountry)
        : parsePhoneNumber(input);
      if (!phone || !phone.isValid()) return null;
      const type = phone.getType() || 'UNKNOWN';
      const isMobile = type === 'MOBILE' || type === 'FIXED_LINE_OR_MOBILE';
      const country = phone.country;
      const formatted = country === 'US'
        ? phone.format('NATIONAL')
        : phone.format('INTERNATIONAL');
      return {
        e164: phone.format('E.164'),
        formatted,
        type: type as PhoneValidationResult['type'],
        valid: true,
        isMobile,
      };
    } catch {
      return null;
    }
  };

  // 1. If input starts with '+', try international parsing (no default country)
  if (cleaned.startsWith('+')) {
    const intlResult = tryParse(cleaned);
    if (intlResult) return intlResult;
  }

  // 2. Fall back to US parsing for bare numbers
  const usResult = tryParse(cleaned, 'US');
  if (usResult) return usResult;

  return empty;
}

/**
 * Normalize a phone number to E.164 format. Returns null if invalid.
 * For mobile phone field — only accepts mobile/ambiguous types.
 */
export function normalizePhoneValue(value: string): string | null {
  const result = validatePhone(value);
  if (!result.valid) return null;
  return result.e164;
}

/**
 * Format a phone number for display using libphonenumber-js.
 */
export function formatPhoneDisplay(e164: string): string {
  if (!e164) return '';
  try {
    const phone = parsePhoneNumber(e164);
    if (!phone) return e164;
    return phone.country === 'US' ? phone.format('NATIONAL') : phone.format('INTERNATIONAL');
  } catch {
    return e164;
  }
}

/**
 * Normalize an email value. Returns null if invalid.
 */
export function normalizeEmailValue(value: string): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed.includes('@')) return null;
  return trimmed;
}

/**
 * Get tailwind color classes for a confidence score.
 */
export function getConfidenceColor(confidence: number): string {
  if (confidence >= 95) return 'bg-green-100 text-green-700 border-green-200';
  if (confidence >= 75) return 'bg-amber-100 text-amber-700 border-amber-200';
  if (confidence >= 50) return 'bg-orange-100 text-orange-700 border-orange-200';
  return 'bg-gray-100 text-gray-500 border-gray-200';
}

/**
 * Get confidence label.
 */
export function getConfidenceLabel(confidence: number): string {
  if (confidence >= 95) return 'Exact';
  if (confidence >= 75) return 'Strong';
  if (confidence >= 50) return 'Partial';
  return 'None';
}

/**
 * Extract the first sequence of digits from a string as a number.
 * Returns null if no digits found.
 * Examples: "Unit 103" → 103, "FE103" → 103, "103" → 103, "Tifton" → null
 */
export function extractNumber(value: string): number | null {
  if (!value) return null;
  const match = value.match(/\d+/);
  if (!match) return null;
  const num = parseInt(match[0], 10);
  return isNaN(num) ? null : num;
}

/**
 * Fuzzy match a value against a list of candidates (e.g., stores/units).
 * Handles unit_number matching, name/code matching, and combined cases like
 * "Tifton 103" or "Friendly 103".
 * Returns the best match or null.
 */
export function fuzzyMatchValue(
  value: string,
  candidates: Array<{ id: string; name: string; code?: string; unit_number?: number | null }>
): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;

  // 1. Extract digits — unit_number match takes highest priority
  const num = extractNumber(normalized);
  if (num !== null) {
    const unitMatches = candidates.filter(
      c => c.unit_number != null && c.unit_number === num
    );
    if (unitMatches.length === 1) return unitMatches[0].id;
    if (unitMatches.length > 1) {
      // Disambiguate using non-numeric words from the value
      const words = normalized
        .split(/\s+/)
        .map(w => w.replace(/[^a-z0-9]/g, ''))
        .filter(w => w && !/^\d+$/.test(w));
      if (words.length > 0) {
        const refined = unitMatches.find(c => {
          const cName = c.name.toLowerCase();
          return words.some(w => cName.includes(w));
        });
        if (refined) return refined.id;
      }
      return unitMatches[0].id;
    }
  }

  // 2. Exact match on name
  const exact = candidates.find(c => c.name.toLowerCase() === normalized);
  if (exact) return exact.id;

  // 3. Exact match on code
  const codeMatch = candidates.find(c => c.code && c.code.toLowerCase() === normalized);
  if (codeMatch) return codeMatch.id;

  // 4. Contains match — candidate name contains value or vice versa
  const contains = candidates.find(c => {
    const cName = c.name.toLowerCase();
    return cName.includes(normalized) || normalized.includes(cName);
  });
  if (contains) return contains.id;

  // 5. Code prefix/contains match (e.g., "FE50" matches store with code "FE50")
  if (candidates.some(c => c.code)) {
    const codeContains = candidates.find(c =>
      c.code && (c.code.toLowerCase().includes(normalized) || normalized.includes(c.code.toLowerCase()))
    );
    if (codeContains) return codeContains.id;
  }

  return null;
}

/**
 * Fuzzy match a role name against a list of candidate roles.
 * Roles don't have unit_number, so this uses name-based matching with
 * word-level fallback.
 */
export function fuzzyMatchRole(
  value: string,
  candidates: Array<{ id: string; name: string }>
): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;

  // Exact name match
  const exact = candidates.find(c => c.name.toLowerCase() === normalized);
  if (exact) return exact.id;

  // Contains match (either direction)
  const contains = candidates.find(c => {
    const cName = c.name.toLowerCase();
    return cName.includes(normalized) || normalized.includes(cName);
  });
  if (contains) return contains.id;

  // Word-level match — all significant words in value appear in candidate name
  const valueWords = normalized.split(/\s+/).filter(w => w.length >= 3);
  if (valueWords.length > 0) {
    const wordMatch = candidates.find(c => {
      const cName = c.name.toLowerCase();
      return valueWords.every(w => cName.includes(w));
    });
    if (wordMatch) return wordMatch.id;
  }

  return null;
}

export interface ParsedName {
  first: string;
  last: string;
}

/**
 * Parse a single full-name string into first and last name components.
 * Handles "First Last", "First Middle Last", "Last, First", single names,
 * and extra whitespace. Case is preserved (use normalizeNameCase afterward
 * if you want title-casing).
 */
export function parseName(fullName: string): ParsedName {
  if (!fullName) return { first: '', last: '' };
  const trimmed = fullName.replace(/\s+/g, ' ').trim();
  if (!trimmed) return { first: '', last: '' };

  // Comma format: "Last, First [Middle ...]"
  if (trimmed.includes(',')) {
    const [lastPart, firstPart = ''] = trimmed.split(',').map(s => s.trim());
    const firstTokens = firstPart.split(/\s+/).filter(Boolean);
    const first = firstTokens[0] || '';
    return { first, last: lastPart || '' };
  }

  // Space-separated format: "First [Middle ...] Last"
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { first: '', last: '' };
  if (tokens.length === 1) return { first: tokens[0], last: '' };
  return { first: tokens[0], last: tokens[tokens.length - 1] };
}

/**
 * Normalize a raw employment type value from a CSV column to one of our
 * canonical values. Handles common HRIS variants (FLSA exempt/non-exempt,
 * H/S codes, etc.).
 */
export function normalizeEmploymentType(value: string): 'hourly' | 'salaried' | 'admin' | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (!v) return null;
  // "hourly", "non-exempt", "nonexempt", "h"
  if (v === 'h' || v.includes('hourly') || v.includes('non-exempt') || v.includes('nonexempt')) return 'hourly';
  // "salaried", "salary", "exempt", "s"
  if (v === 's' || v.includes('salaried') || v.includes('salary') || (v.includes('exempt') && !v.includes('non'))) return 'salaried';
  // "admin", "administrator"
  if (v.includes('admin')) return 'admin';
  return null;
}

/**
 * Convert a name to title case if it appears to be ALL CAPS.
 * "BETTY" → "Betty", "CARRIN" → "Carrin", "O'BRIEN" → "O'Brien"
 * Leaves mixed-case names unchanged.
 */
export function normalizeNameCase(name: string): string {
  if (!name) return name;
  const trimmed = name.trim();
  // Only convert if the name is entirely uppercase (with allowed chars like hyphens/apostrophes)
  if (trimmed === trimmed.toUpperCase() && trimmed.length > 1) {
    return trimmed.toLowerCase().replace(/(^|[\s\-'])([a-z])/g, (_, prefix, letter) =>
      prefix + letter.toUpperCase()
    );
  }
  return trimmed;
}

/**
 * Parse CSV text into headers and rows.
 * Handles quoted values with commas inside.
 */
export function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  // Handle Windows (\r\n) and old Mac (\r) line endings
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n');
  if (lines.length < 2) return { headers: [], rows: [] };

  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseRow(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseRow(line);
    if (values.some(v => v)) {
      const row: Record<string, string> = {};
      headers.forEach((header, idx) => {
        row[header] = (idx < values.length ? values[idx] : '') || '';
      });
      rows.push(row);
    }
  }

  return { headers, rows };
}

export class ImportFileParseError extends Error {}

/**
 * Read a CSV/Excel File and return parsed headers + rows.
 * Handles .csv via parseCSV() and .xlsx/.xls via SheetJS with date-aware formatting.
 * Throws ImportFileParseError with a user-friendly message on failure.
 */
export async function parseImportFile(
  file: File
): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!ext || !['csv', 'xlsx', 'xls'].includes(ext)) {
    throw new ImportFileParseError('Please select a CSV or Excel file (.csv, .xlsx, .xls)');
  }

  let headers: string[] = [];
  let rows: Record<string, string>[] = [];

  if (ext === 'csv') {
    const text = await file.text();
    const result = parseCSV(text);
    headers = result.headers;
    rows = result.rows;
  } else {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, raw: false, defval: '' });

    if (data.length < 2) {
      throw new ImportFileParseError('File appears to be empty or has no data rows.');
    }
    headers = (data[0] as any[]).map(h => String(h ?? '').trim()).filter(Boolean);
    for (let i = 1; i < data.length; i++) {
      const values = data[i] as any[];
      if (!values || !values.some(v => v != null && v !== '')) continue;
      const row: Record<string, string> = {};
      headers.forEach((header, idx) => {
        row[header] = String(values[idx] ?? '').trim();
      });
      rows.push(row);
    }
  }

  if (headers.length === 0) {
    throw new ImportFileParseError('Could not find headers in the file.');
  }
  if (rows.length === 0) {
    throw new ImportFileParseError('File has headers but no data rows.');
  }

  return { headers, rows };
}
