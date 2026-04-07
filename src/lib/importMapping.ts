// ============================================================================
// SMART COLUMN MAPPING ENGINE FOR EMPLOYEE IMPORT
// ============================================================================
// Fuzzy-matches CSV/Excel headers to our users table fields using alias
// dictionaries and confidence scoring. No React dependencies.
// ============================================================================

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
// (e.g., "Work Email" + "Personal Email", "Cell Phone" + "Home Phone")
export const FALLBACK_FIELDS = new Set(['email', 'phone']);

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
    key: 'phone',
    label: 'Phone',
    required: false,
    aliases: [
      'phone', 'phonenumber', 'mobile', 'cell', 'telephone',
      'homephone', 'workphone', 'cellphone', 'mobilephone',
      'phonehome', 'phonework', 'tel'
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
 * Fuzzy match a value against a list of candidates.
 * Returns the best match or null.
 */
export function fuzzyMatchValue(
  value: string,
  candidates: Array<{ id: string; name: string; code?: string }>
): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();

  // Exact match on name
  const exact = candidates.find(c => c.name.toLowerCase() === normalized);
  if (exact) return exact.id;

  // Exact match on code
  const codeMatch = candidates.find(c => c.code && c.code.toLowerCase() === normalized);
  if (codeMatch) return codeMatch.id;

  // Contains match — candidate name contains value or vice versa
  const contains = candidates.find(c => {
    const cName = c.name.toLowerCase();
    return cName.includes(normalized) || normalized.includes(cName);
  });
  if (contains) return contains.id;

  // Code prefix match (e.g., "FE50" matches store with code "FE50")
  if (candidates.some(c => c.code)) {
    const codeContains = candidates.find(c =>
      c.code && (c.code.toLowerCase().includes(normalized) || normalized.includes(c.code.toLowerCase()))
    );
    if (codeContains) return codeContains.id;
  }

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
