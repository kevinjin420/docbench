import type { BenchmarkResult, Suite, SuiteMeta } from "./types";

const BASE = "/api";

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `Request failed: ${response.status}`);
  }
  return data as T;
}

export async function listSuites(): Promise<string[]> {
  return request<string[]>("/suites");
}

export async function getSuite(name: string): Promise<Suite> {
  return request<Suite>(`/suites/${encodeURIComponent(name)}`);
}

export async function runBenchmark(params: {
  api_key: string;
  model: string;
  suite?: string;
  doc_url?: string;
  doc_file?: File;
  max_tokens?: number;
}): Promise<BenchmarkResult> {
  if (params.doc_file) {
    const form = new FormData();
    form.append("api_key", params.api_key);
    form.append("model", params.model);
    if (params.suite) form.append("suite", params.suite);
    if (params.doc_url) form.append("doc_url", params.doc_url);
    if (params.max_tokens) form.append("max_tokens", String(params.max_tokens));
    form.append("doc_file", params.doc_file);

    const response = await fetch(`${BASE}/run`, { method: "POST", body: form });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `Request failed: ${response.status}`);
    return data as BenchmarkResult;
  }

  return request<BenchmarkResult>("/run", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

function adminHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

export async function adminListSuites(
  token: string
): Promise<SuiteMeta[]> {
  return request<SuiteMeta[]>("/admin/suites", {
    headers: adminHeaders(token),
  });
}

export async function adminCreateSuite(
  token: string,
  name: string,
  tests: unknown[]
): Promise<{ message: string }> {
  return request("/admin/suites/" + encodeURIComponent(name), {
    method: "POST",
    headers: adminHeaders(token),
    body: JSON.stringify({ tests }),
  });
}

export async function adminDeleteSuite(
  token: string,
  name: string
): Promise<{ message: string }> {
  return request("/admin/suites/" + encodeURIComponent(name), {
    method: "DELETE",
    headers: adminHeaders(token),
  });
}

export async function adminValidateSuite(
  token: string,
  name: string
): Promise<{ valid: boolean; issues: string[]; warnings: string[] }> {
  return request(
    "/admin/suites/" + encodeURIComponent(name) + "/validate",
    {
      method: "POST",
      headers: adminHeaders(token),
    }
  );
}
