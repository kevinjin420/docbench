import { useState, useEffect, useCallback } from "react";
import Editor from "@monaco-editor/react";
import {
  adminListSuites,
  adminCreateSuite,
  adminDeleteSuite,
  adminValidateSuite,
  getSuite,
} from "./api";
import type { SuiteMeta, SuiteTest } from "./types";

export function AdminView() {
  const [token, setToken] = useState(
    () => localStorage.getItem("docbench_admin_token") || ""
  );
  const [authenticated, setAuthenticated] = useState(false);
  const [suites, setSuites] = useState<SuiteMeta[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editingSuite, setEditingSuite] = useState<string | null>(null);
  const [editorContent, setEditorContent] = useState("");
  const [validationResult, setValidationResult] = useState<{
    valid: boolean; issues: string[]; warnings: string[];
  } | null>(null);
  const [newSuiteName, setNewSuiteName] = useState("");

  const loadSuites = useCallback(async () => {
    try {
      const data = await adminListSuites(token);
      setSuites(data);
      setAuthenticated(true);
      setError("");
    } catch (err) {
      setError(String(err));
      setAuthenticated(false);
    }
  }, [token]);

  function handleLogin() {
    if (!token.trim()) { setError("token required"); return; }
    localStorage.setItem("docbench_admin_token", token);
    loadSuites();
  }

  useEffect(() => {
    if (token) handleLogin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleEditSuite(name: string) {
    try {
      const suiteData = await getSuite(name);
      setEditingSuite(name);
      setEditorContent(JSON.stringify(suiteData.tests, null, 2));
      setValidationResult(null);
      setMessage("");
    } catch (err) { setError(String(err)); }
  }

  async function handleSaveSuite() {
    if (!editingSuite) return;
    try {
      const tests: SuiteTest[] = JSON.parse(editorContent);
      if (!Array.isArray(tests)) { setError("expected json array"); return; }
      await adminCreateSuite(token, editingSuite, tests);
      setMessage(`saved ${editingSuite}`);
      setError("");
      loadSuites();
    } catch (err) { setError(String(err)); }
  }

  async function handleValidate() {
    if (!editingSuite) return;
    try {
      setValidationResult(await adminValidateSuite(token, editingSuite));
    } catch (err) { setError(String(err)); }
  }

  async function handleDeleteSuite(name: string) {
    if (!confirm(`delete "${name}"?`)) return;
    try {
      await adminDeleteSuite(token, name);
      setMessage(`deleted ${name}`);
      if (editingSuite === name) { setEditingSuite(null); setEditorContent(""); }
      loadSuites();
    } catch (err) { setError(String(err)); }
  }

  async function handleCreateSuite() {
    const name = newSuiteName.trim();
    if (!name) { setError("name required"); return; }
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) { setError("alphanumeric, hyphens, underscores only"); return; }
    try {
      await adminCreateSuite(token, name, []);
      setMessage(`created ${name}`);
      setNewSuiteName("");
      loadSuites();
      handleEditSuite(name);
    } catch (err) { setError(String(err)); }
  }

  if (!authenticated) {
    return (
      <div className="auth-row">
        <span className="dim">token:</span>
        <input
          type="password" value={token}
          onChange={(e) => setToken(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          placeholder="admin bearer token"
        />
        <button onClick={handleLogin}>&gt; auth</button>
        {error && <div className="err">{error}</div>}
      </div>
    );
  }

  return (
    <div className="admin-layout">
      <div className="admin-side">
        <div className="side-head">
          <span className="section-label">suites</span>
          <button className="logout-btn" onClick={() => {
            localStorage.removeItem("docbench_admin_token");
            setToken("");
            setAuthenticated(false);
            setEditingSuite(null);
            setEditorContent("");
          }}>logout</button>
        </div>
        {suites.map((s) => (
          <div
            key={s.name}
            className={`side-item ${editingSuite === s.name ? "active" : ""}`}
            onClick={() => handleEditSuite(s.name)}
          >
            <span className="side-name">{s.name}</span>
            <span className="dim">{s.total_tests} tests</span>
            {s.name !== "standard" && (
              <button className="side-del" onClick={(e) => { e.stopPropagation(); handleDeleteSuite(s.name); }}>x</button>
            )}
          </div>
        ))}
        <div className="side-create">
          <input
            type="text" value={newSuiteName}
            onChange={(e) => setNewSuiteName(e.target.value)}
            placeholder="new suite"
            onKeyDown={(e) => e.key === "Enter" && handleCreateSuite()}
          />
          <button onClick={handleCreateSuite}>+</button>
        </div>
      </div>

      <div className="admin-main">
        {editingSuite ? (
          <>
            <div className="editor-bar">
              <span className="editor-name">{editingSuite}</span>
              <div className="editor-actions">
                <button onClick={handleValidate}>&gt; validate</button>
                <button className="btn-save" onClick={handleSaveSuite}>&gt; save</button>
              </div>
            </div>

            {validationResult && (
              <div className={`vld ${validationResult.valid ? "vld-ok" : "vld-err"}`}>
                {validationResult.valid ? "valid" : "invalid"}
                {validationResult.issues.map((s, i) => <div key={i}>{s}</div>)}
                {validationResult.warnings.map((s, i) => <div key={i} className="c-partial">{s}</div>)}
              </div>
            )}

            <div className="monaco-wrap">
              <Editor
                language="json"
                theme="docbench-dark"
                value={editorContent}
                onChange={(val) => setEditorContent(val ?? "")}
                beforeMount={(monaco) => {
                  monaco.editor.defineTheme("docbench-dark", {
                    base: "vs-dark",
                    inherit: true,
                    rules: [
                      { token: "string.key.json", foreground: "ff6b35" },
                      { token: "string.value.json", foreground: "6fdd8b" },
                      { token: "number", foreground: "79c0ff" },
                      { token: "keyword", foreground: "f7931e" },
                    ],
                    colors: {
                      "editor.background": "#111111",
                      "editor.foreground": "#999999",
                      "editor.lineHighlightBackground": "#161616",
                      "editor.selectionBackground": "#ff6b3525",
                      "editorCursor.foreground": "#ff6b35",
                      "editorLineNumber.foreground": "#333333",
                      "editorLineNumber.activeForeground": "#666666",
                      "editor.inactiveSelectionBackground": "#ff6b3515",
                      "editorIndentGuide.background": "#1a1a1a",
                      "editorIndentGuide.activeBackground": "#282828",
                      "editorBracketMatch.background": "#ff6b3520",
                      "editorBracketMatch.border": "#ff6b3540",
                    },
                  });
                }}
                options={{
                  minimap: { enabled: false },
                  fontSize: 12,
                  fontFamily: "'JetBrains Mono', monospace",
                  lineNumbers: "on",
                  scrollBeyondLastLine: false,
                  wordWrap: "on",
                  tabSize: 2,
                  renderLineHighlight: "line",
                  bracketPairColorization: { enabled: true },
                  padding: { top: 12, bottom: 12 },
                  overviewRulerBorder: false,
                  scrollbar: { verticalScrollbarSize: 4, horizontalScrollbarSize: 4 },
                  lineDecorationsWidth: 0,
                  lineNumbersMinChars: 3,
                }}
              />
            </div>
          </>
        ) : (
          <div className="editor-empty">
            <span className="dim">no suite selected</span>
          </div>
        )}

        {error && <div className="err">{error}</div>}
        {message && <div className="msg">{message}</div>}
      </div>
    </div>
  );
}
