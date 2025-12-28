// TypeScript types for job description extraction
export interface ExtractedJobDescription {
  role_name: string;
  department: string | null;
  job_family: string | null;
  is_manager: boolean;
  is_frontline: boolean;
  permission_level: number;
  responsibilities: string[];
  skills: string[];
  knowledge: string[];
  onet_search_keywords: string[];
  job_description: string; // Full extracted text
}

// OpenAI structured output schema
export const JOB_DESCRIPTION_SCHEMA = {
  type: "object" as const,
  properties: {
    role_name: {
      type: "string",
      description: "The job title or role name (e.g. 'Store Manager', 'Kitchen Manager', 'Sales Associate')"
    },
    department: {
      type: "string",
      description: "The department this role belongs to (e.g. 'Operations', 'Food Service', 'Sales'). Return null if not specified.",
      nullable: true
    },
    job_family: {
      type: "string",
      description: "The broader job category (e.g. 'Management', 'Retail', 'Food Service', 'Administrative'). Return null if unclear.",
      nullable: true
    },
    is_manager: {
      type: "boolean",
      description: "Does this role supervise or manage other employees? Look for keywords like 'supervise', 'manage team', 'direct reports', 'leadership'."
    },
    is_frontline: {
      type: "boolean",
      description: "Is this a customer-facing or operational frontline role? (e.g. cashier, food prep, sales associate). Managers are typically NOT frontline."
    },
    permission_level: {
      type: "integer",
      description: "Permission level from 1-5. 1=Frontline employee, 2=Shift lead/senior employee, 3=Store/department manager, 4=District/regional manager, 5=Executive/corporate"
    },
    responsibilities: {
      type: "array",
      description: "Key responsibilities and duties. Extract 5-10 main responsibilities. Keep each concise (1-2 sentences max).",
      items: {
        type: "string"
      }
    },
    skills: {
      type: "array",
      description: "Required skills mentioned in the job description (e.g. 'cash handling', 'food safety', 'customer service', 'inventory management')",
      items: {
        type: "string"
      }
    },
    knowledge: {
      type: "array",
      description: "Required knowledge areas (e.g. 'POS systems', 'health codes', 'safety regulations', 'product knowledge')",
      items: {
        type: "string"
      }
    },
    onet_search_keywords: {
      type: "array",
      description: "3-5 keywords for matching to O*NET occupations. Use standard occupation terms (e.g. 'retail sales', 'food preparation', 'store management', 'cashier')",
      items: {
        type: "string"
      }
    },
    job_description: {
      type: "string",
      description: "The full job description text as a single paragraph. Clean up formatting but preserve all content."
    }
  },
  required: [
    "role_name",
    "is_manager",
    "is_frontline",
    "permission_level",
    "responsibilities",
    "skills",
    "knowledge",
    "onet_search_keywords",
    "job_description"
  ],
  additionalProperties: false
};

