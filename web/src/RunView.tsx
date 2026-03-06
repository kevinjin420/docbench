import { useState, useEffect, useRef } from "react";
import { listSuites } from "./api";
import type { BenchmarkResult } from "./types";

interface ProgressState {
  stage: string;
  batchesDone: number;
  totalBatches: number;
  totalTests: number;
}

export function RunView() {
  const [apiKey, setApiKey] = useState(
    () => localStorage.getItem("docbench_api_key") || ""
  );
  const [model, setModel] = useState(() => localStorage.getItem("docbench_model") || "google/gemini-3-flash-preview");
  const [suite, setSuite] = useState(() => localStorage.getItem("docbench_suite") || "standard");
  const [suites, setSuites] = useState<string[]>([]);
  const [docUrl, setDocUrl] = useState(() => localStorage.getItem("docbench_doc_url") || "");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [maxTokens, setMaxTokens] = useState(() => Number(localStorage.getItem("docbench_max_tokens")) || 16000);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<BenchmarkResult | null>(null);
  const [expandedTests, setExpandedTests] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    listSuites().then(setSuites).catch((err) => setError(String(err)));
  }, []);

  useEffect(() => {
    if (apiKey) localStorage.setItem("docbench_api_key", apiKey);
    localStorage.setItem("docbench_model", model);
    localStorage.setItem("docbench_suite", suite);
    localStorage.setItem("docbench_doc_url", docUrl);
    localStorage.setItem("docbench_max_tokens", String(maxTokens));
  }, [apiKey, model, suite, docUrl, maxTokens]);

  async function handleRun() {
    if (!apiKey.trim()) { setError("api_key required"); return; }
    if (!model.trim()) { setError("model required"); return; }
    setRunning(true);
    setError("");
    setResult(null);
    setProgress({ stage: "connecting", batchesDone: 0, totalBatches: 0, totalTests: 0 });

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      let body: BodyInit;
      const headers: Record<string, string> = {};

      if (docFile) {
        const form = new FormData();
        form.append("api_key", apiKey);
        form.append("model", model);
        form.append("suite", suite);
        if (docUrl) form.append("doc_url", docUrl);
        form.append("max_tokens", String(maxTokens));
        form.append("doc_file", docFile);
        body = form;
      } else {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify({
          api_key: apiKey, model, suite,
          doc_url: docUrl || undefined,
          max_tokens: maxTokens,
        });
      }

      const response = await fetch("/api/run", {
        method: "POST", headers, body,
        signal: abort.signal,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `Request failed: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";
      let batchesDone = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const event = JSON.parse(line.slice(6));

          if (event.type === "status") {
            setProgress((prev) => ({
              stage: event.stage,
              batchesDone: prev?.batchesDone ?? 0,
              totalBatches: event.total_batches ?? prev?.totalBatches ?? 0,
              totalTests: event.total_tests ?? prev?.totalTests ?? 0,
            }));
          } else if (event.type === "batch") {
            batchesDone++;
            setProgress((prev) => ({
              stage: "llm_calling",
              batchesDone,
              totalBatches: event.total_batches,
              totalTests: prev?.totalTests ?? 0,
            }));
          } else if (event.type === "result") {
            setResult(event as BenchmarkResult);
          } else if (event.type === "error") {
            setError(event.error);
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError(String(err));
      }
    } finally {
      setRunning(false);
      setProgress(null);
      abortRef.current = null;
    }
  }

  function toggleTest(id: string) {
    setExpandedTests((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function stageLabel(p: ProgressState): string {
    switch (p.stage) {
      case "connecting": return "connecting...";
      case "validating": return `validating suite (${p.totalTests} tests)`;
      case "fetching_docs": return "fetching documentation...";
      case "llm_calling": return `api: batch ${p.batchesDone}/${p.totalBatches}`;
      case "evaluating": return "evaluating responses...";
      default: return p.stage;
    }
  }

  const pass = result?.results.filter((t) => t.score === t.max_score).length ?? 0;
  const fail = result?.results.filter((t) => t.score === 0).length ?? 0;
  const partial = result ? result.results.length - pass - fail : 0;

  return (
    <div className="run-view">
      <div className="form-row">
        <label>key</label>
        <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-or-..." />
      </div>
      <div className="form-row">
        <label>model</label>
        <input type="text" value={model} onChange={(e) => setModel(e.target.value)} placeholder="google/gemini-3-flash-preview" />
      </div>
      <div className="form-cols">
        <div className="form-row">
          <label>suite</label>
          <select value={suite} onChange={(e) => setSuite(e.target.value)}>
            {suites.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="form-row">
          <label>tokens</label>
          <input type="number" value={maxTokens} onChange={(e) => setMaxTokens(Number(e.target.value))} min={1000} max={128000} />
        </div>
      </div>
      <div className="form-row">
        <label>docs</label>
        <div className="doc-row">
          <input
            type="url" value={docUrl}
            onChange={(e) => setDocUrl(e.target.value)}
            placeholder="url or upload .txt/.md"
            disabled={!!docFile}
          />
          <label className="upload-btn" htmlFor="doc-file">{docFile ? docFile.name : "file"}</label>
          <input id="doc-file" type="file" accept=".txt,.md" onChange={(e) => { setDocFile(e.target.files?.[0] ?? null); if (e.target.files?.[0]) setDocUrl(""); }} hidden />
          {docFile && <button className="clear-btn" onClick={() => setDocFile(null)}>x</button>}
        </div>
      </div>

      <button className="exec-btn" onClick={handleRun} disabled={running}>
        {running ? "> running..." : "> execute"}
      </button>

      {progress && (
        <div className="progress-bar">
          <div className="progress-label">{stageLabel(progress)}</div>
          {progress.totalBatches > 0 && (
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{ width: `${(progress.batchesDone / progress.totalBatches) * 100}%` }}
              />
            </div>
          )}
        </div>
      )}

      {error && <div className="err">{error}</div>}

      {result && (
        <div className="output">
          <div className="output-header">
            <span className="model-name">{result.meta.model}</span>
            <span className="dim">suite={result.meta.suite}</span>
          </div>

          <div className="score-line">
            <span className="score-big">{result.percentage.toFixed(1)}%</span>
            <span className="dim">{result.total_score}/{result.max_score} pts</span>
            <span className="dim">jac_check={result.jac_check_pass_rate.toFixed(1)}%</span>
            <span className="c-pass">{pass}P</span>
            <span className="c-partial">{partial}~</span>
            <span className="c-fail">{fail}F</span>
          </div>

          <div className="breakdown-grid">
            <div className="breakdown-col">
              <div className="section-label">level</div>
              {Object.entries(result.level_breakdown)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([lvl, d]) => (
                  <div key={lvl} className="bar-row">
                    <span className="bar-label">{lvl}</span>
                    <div className="bar"><div className="bar-fill" style={{ width: `${d.percentage}%` }} /></div>
                    <span className="bar-val">{d.percentage.toFixed(0)}%</span>
                  </div>
                ))}
            </div>
            <div className="breakdown-col">
              <div className="section-label">category</div>
              {Object.entries(result.category_breakdown)
                .sort(([, a], [, b]) => b.percentage - a.percentage)
                .map(([cat, d]) => (
                  <div key={cat} className="bar-row">
                    <span className="bar-label">{cat}</span>
                    <div className="bar"><div className="bar-fill" style={{ width: `${d.percentage}%` }} /></div>
                    <span className="bar-val">{d.percentage.toFixed(0)}%</span>
                  </div>
                ))}
            </div>
          </div>

          <div className="section-label">tests ({result.results.length})</div>
          <div className="test-list">
            {result.results.map((t) => (
              <div key={t.test_id} className="test-item">
                <div className="test-head" onClick={() => toggleTest(t.test_id)}>
                  <span className={`status ${t.score === t.max_score ? "s-pass" : t.score === 0 ? "s-fail" : "s-partial"}`}>
                    {t.score === t.max_score ? "ok" : t.score === 0 ? "xx" : "~~"}
                  </span>
                  <span className="test-name">{t.test_id}</span>
                  <span className="dim flex-push">
                    {!t.jac_valid && <span className="c-fail">!jac </span>}
                    {t.score}/{t.max_score}
                  </span>
                </div>
                {expandedTests.has(t.test_id) && (
                  <div className="test-body">
                    <pre>{t.generated_code}</pre>
                    {t.required_missing.length > 0 && (
                      <div className="tag-line">
                        <span className="dim">missing: </span>
                        {t.required_missing.map((m) => <code key={m} className="tag-miss">{m}</code>)}
                      </div>
                    )}
                    {t.forbidden_found.length > 0 && (
                      <div className="tag-line">
                        <span className="dim">forbidden: </span>
                        {t.forbidden_found.map((f) => <code key={f} className="tag-forbid">{f}</code>)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          <details className="raw">
            <summary>raw json</summary>
            <pre>{JSON.stringify(result, null, 2)}</pre>
          </details>
        </div>
      )}
    </div>
  );
}
