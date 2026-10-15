export interface FixtureTest {
  id?: string;
  prompt?: string;
  expected?: string;
  [key: string]: unknown;
}

export interface Fixture {
  id: string;
  name: string;
  description: string | null;
  version: number;
  content: {
    metadata: Record<string, unknown>;
    tests?: FixtureTest[];
    [key: string]: unknown;
  };
  schema_version: string;
  created_at: string;
  updated_at: string;
}

export interface FixtureListResponse {
  items: Fixture[];
  total: number;
  page: number;
  page_size: number;
}

export interface FixtureCreate {
  name: string;
  description?: string;
  content: Record<string, unknown>;
  schema_version?: string;
}

export interface FixtureUpdate {
  name?: string;
  description?: string;
  content?: Record<string, unknown>;
  schema_version?: string;
}

export interface ProviderConfig {
  id: string;
  name: string;
  provider_type: 'mock' | 'openai_compatible' | 'anthropic' | 'gemini' | 'ollama';
  model: string;
  base_url: string | null;
  api_key_env: string | null;
  extra_headers: Record<string, string> | null;
  timeout_seconds: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProviderConfigListResponse {
  items: ProviderConfig[];
  total: number;
  page: number;
  page_size: number;
}

export interface ProviderConfigCreate {
  name: string;
  provider_type: 'mock' | 'openai_compatible' | 'anthropic' | 'gemini' | 'ollama';
  model: string;
  base_url?: string;
  api_key_env?: string;
  extra_headers?: Record<string, string>;
  timeout_seconds?: number;
  is_active?: boolean;
}

export interface ProviderConfigUpdate {
  name?: string;
  provider_type?: 'mock' | 'openai_compatible' | 'anthropic' | 'gemini' | 'ollama';
  model?: string;
  base_url?: string;
  api_key_env?: string;
  extra_headers?: Record<string, string>;
  timeout_seconds?: number;
  is_active?: boolean;
}

export type AuditRunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface AuditRun {
  id: string;
  name: string;
  description: string | null;
  fixture_id: string;
  provider_config_id: string;
  suite: 'smoke' | 'strategic' | 'essential' | 'core' | 'extended' | 'all';
  status: AuditRunStatus;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  results: AuditResults | null;
  created_at: string;
  updated_at: string;
}

export interface AuditRunListResponse {
  items: AuditRun[];
  total: number;
  page: number;
  page_size: number;
}

export interface AuditRunCreate {
  name: string;
  description?: string;
  fixture_id: string;
  provider_config_id: string;
  suite?: 'smoke' | 'strategic' | 'essential' | 'core' | 'extended' | 'all';
}

export interface AuditRunUpdate {
  name?: string;
  description?: string;
}

export interface PillarScore {
  name: string;
  score: number;
  weight: number;
  inspections_passed: number;
  inspections_total: number;
}

export interface InspectionResult {
  id: string;
  category: string;
  pillar: string;
  status: 'pass' | 'fail' | 'partial' | 'insufficient_evidence' | 'error';
  score: number;
  details: string | null;
  is_mandatory_minimum: boolean;
}

export interface AuditResults {
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  overall_score: number;
  pillar_scores: PillarScore[];
  inspections: InspectionResult[];
  mandatory_minimums: Record<string, boolean>;
  grade_capped: boolean;
}

export interface HealthResponse {
  status: string;
  version: string;
  environment: string;
}

export interface ErrorResponse {
  detail: string;
  code?: string;
}