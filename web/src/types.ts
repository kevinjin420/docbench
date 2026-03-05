export interface TestResult {
  test_id: string;
  score: number;
  max_score: number;
  jac_valid: boolean;
  required_found: string[];
  required_missing: string[];
  forbidden_found: string[];
  penalties: Record<string, number>;
  generated_code: string;
}

export interface LevelBreakdown {
  score: number;
  max_score: number;
  percentage: number;
  count: number;
}

export interface BenchmarkResult {
  total_score: number;
  max_score: number;
  percentage: number;
  jac_check_pass_rate: number;
  level_breakdown: Record<string, LevelBreakdown>;
  category_breakdown: Record<string, LevelBreakdown>;
  results: TestResult[];
  meta: {
    model: string;
    suite: string;
    doc_url: string | null;
    max_tokens: number;
    batch_size: number;
    temperature: number;
  };
  error?: string;
}

export interface SuiteTest {
  id: string;
  level: number;
  category: string;
  task_description: string;
  test_harness: string;
  required_elements: string[];
  forbidden_elements: string[];
  score: number;
}

export interface Suite {
  name: string;
  tests: SuiteTest[];
}

export interface SuiteMeta {
  name: string;
  total_tests: number;
  total_points: number;
}
