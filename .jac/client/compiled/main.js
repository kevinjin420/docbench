/* Source: /home/kevinjin/jaseci-docbench/main.jac */
import {__jacJsx, __jacSpawn} from "@jac/runtime";
import { useState, useEffect, useCallback, useRef } from "react";
import { Router, Routes, Route, Link, useNavigate, useLocation } from "@jac/runtime";
import { useSearchParams } from "react-router-dom";
import "./styles.css";
async function apiCall(walkerName, payload, extraHeaders) {
  let merged = Object.assign({"Content-Type": "application/json"}, extraHeaders);
  let token = localStorage.getItem("docbench_token");
  let body = Object.assign({}, payload);
  if (token) {
    merged["Authorization"] = ("Bearer " + token);
    body["auth_token"] = token;
  }
  let resp = await fetch(("/walker/" + walkerName), {"method": "POST", "headers": merged, "body": JSON.stringify(body)});
  let data = await resp.json();
  if ((((data && data["ok"]) && data["data"]) && data["data"]["reports"])) {
    let reports = data["data"]["reports"];
    if ((reports.length > 0)) {
      return reports[0];
    }
  }
  return null;
}
function AppHeader(props) {
  const {user, onLogout} = props;
  const [menuOpen, setMenuOpen] = useState(false);
  let location = useLocation();
  let menuRef = useRef(null);
  useEffect(() => {
    function handleClick(e) {
      if ((menuRef.current && !menuRef.current.contains(e.target))) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
  }, []);
  return __jacJsx("header", {"className": "header"}, [__jacJsx("div", {"className": "header-left"}, [__jacJsx(Link, {"to": "/", "className": "logo"}, ["Jaseci ", __jacJsx("span", {}, ["DocBench"])]), __jacJsx("nav", {"className": "nav-links"}, [__jacJsx(Link, {"to": "/leaderboard", "className": ("nav-link" + ((location.pathname === "/leaderboard") ? " active" : ""))}, ["Leaderboard"]), __jacJsx(Link, {"to": "/submit", "className": ("nav-link" + ((location.pathname === "/submit") ? " active" : ""))}, ["Submit"]), ((user && user["is_admin"]) ? __jacJsx(Link, {"to": "/benchmark", "className": ("nav-link" + ((location.pathname === "/benchmark") ? " active" : ""))}, ["Benchmark"]) : null), ((user && user["is_admin"]) ? __jacJsx(Link, {"to": "/files", "className": ("nav-link" + ((location.pathname === "/files") ? " active" : ""))}, ["Files"]) : null)])]), __jacJsx("div", {"className": "header-right"}, [(user ? __jacJsx("div", {"className": "dropdown", "ref": menuRef}, [__jacJsx("button", {"className": "user-btn", "onClick": e => {
    setMenuOpen(!menuOpen);
  }}, [(user["avatar_url"] ? __jacJsx("img", {"src": user["avatar_url"], "className": "user-avatar", "alt": ""}, []) : null), __jacJsx("span", {}, [(user["name"] || user["email"])])]), (menuOpen ? __jacJsx("div", {"className": "dropdown-menu"}, [__jacJsx("div", {"style": {"padding": "0.5rem 0.75rem", "fontSize": "0.8rem", "color": "var(--text-muted)", "borderBottom": "1px solid var(--border-primary)", "marginBottom": "0.25rem"}}, [user["email"]]), __jacJsx("button", {"className": "dropdown-item", "onClick": e => {
    onLogout();
    setMenuOpen(false);
  }}, ["Sign Out"])]) : null)]) : __jacJsx(LoginBtn, {}, []))])]);
}
function LoginBtn() {
  async function doLogin() {
    localStorage.setItem("docbench_return_url", window.location.pathname);
    let result = await apiCall("GithubLogin");
    if ((result && result["redirect_url"])) {
      window.location.href = result["redirect_url"];
    }
  }
  return __jacJsx("button", {"className": "btn btn-secondary", "onClick": e => {
    doLogin();
  }}, ["Sign in with GitHub"]);
}
function AuthCallbackPage(props) {
  const {onLogin} = props;
  let navigate = useNavigate();
  let searchParams = useSearchParams()[0];
  async function handleCallback() {
    let token = searchParams.get("token");
    if (token) {
      localStorage.setItem("docbench_token", token);
      onLogin();
      let returnUrl = (localStorage.getItem("docbench_return_url") || "/");
      localStorage.removeItem("docbench_return_url");
      navigate(returnUrl);
      return;
    }
    let code = searchParams.get("code");
    let state = searchParams.get("state");
    if (code) {
      let result = await apiCall("GithubCallback", {"code": code, "state": (state || "")});
      if ((result && result["redirect"])) {
        let url = result["redirect"];
        let qmark = url.indexOf("?");
        if ((qmark >= 0)) {
          let params = url.substring(qmark);
          let sp = Reflect.construct(URLSearchParams, [params]);
          let cbToken = sp.get("token");
          if (cbToken) {
            localStorage.setItem("docbench_token", cbToken);
            onLogin();
          }
        }
      }
    }
    let returnUrl = (localStorage.getItem("docbench_return_url") || "/");
    localStorage.removeItem("docbench_return_url");
    navigate(returnUrl);
  }
  useEffect(() => {
    handleCallback();
  }, []);
  return __jacJsx("div", {"className": "loading-container"}, [__jacJsx("div", {"className": "spinner"}, []), __jacJsx("span", {}, ["Authenticating..."])]);
}
function HomePage() {
  return __jacJsx("div", {"style": {"maxWidth": "800px", "margin": "0 auto", "paddingTop": "3rem"}}, [__jacJsx("div", {"style": {"textAlign": "center", "marginBottom": "3rem"}}, [__jacJsx("h1", {"style": {"fontSize": "2.5rem", "fontWeight": "700", "marginBottom": "1rem"}}, ["Jaseci ", __jacJsx("span", {"style": {"color": "var(--accent)"}}, ["DocBench"])]), __jacJsx("p", {"style": {"color": "var(--text-secondary)", "fontSize": "1.1rem", "lineHeight": "1.6", "maxWidth": "600px", "margin": "0 auto"}}, ["A benchmark suite for evaluating LLM performance on Jac language documentation."])]), __jacJsx("div", {"className": "grid-2", "style": {"marginBottom": "2rem"}}, [__jacJsx(Link, {"to": "/leaderboard", "className": "card", "style": {"cursor": "pointer"}}, [__jacJsx("h2", {"style": {"fontSize": "1.25rem", "fontWeight": "600", "marginBottom": "0.5rem", "color": "var(--accent)"}}, ["Leaderboard"]), __jacJsx("p", {"style": {"fontSize": "0.875rem", "color": "var(--text-muted)"}}, ["View ranked documentation submissions and compare performance."])]), __jacJsx(Link, {"to": "/submit", "className": "card", "style": {"cursor": "pointer"}}, [__jacJsx("h2", {"style": {"fontSize": "1.25rem", "fontWeight": "600", "marginBottom": "0.5rem", "color": "var(--accent)"}}, ["Submit"]), __jacJsx("p", {"style": {"fontSize": "0.875rem", "color": "var(--text-muted)"}}, ["Run the benchmark on your documentation and submit results."])])]), __jacJsx("div", {"className": "card"}, [__jacJsx("h3", {"style": {"fontSize": "1.125rem", "fontWeight": "600", "marginBottom": "1rem"}}, ["How It Works"]), __jacJsx("div", {"className": "steps"}, [__jacJsx("div", {"className": "step"}, [__jacJsx("div", {"className": "step-num"}, ["1"]), __jacJsx("span", {}, ["Provide your OpenRouter API key and documentation URL"])]), __jacJsx("div", {"className": "step"}, [__jacJsx("div", {"className": "step-num"}, ["2"]), __jacJsx("span", {}, ["The benchmark runs Jac language tests against an LLM using your docs"])]), __jacJsx("div", {"className": "step"}, [__jacJsx("div", {"className": "step-num"}, ["3"]), __jacJsx("span", {}, ["Results are evaluated and scored based on correctness"])]), __jacJsx("div", {"className": "step"}, [__jacJsx("div", {"className": "step-num"}, ["4"]), __jacJsx("span", {}, ["Submit your score to the public leaderboard"])])])])]);
}
function PodiumCard(props) {
  const {entry, rank, cls} = props;
  let colors = {"gold": "#ffd700", "silver": "#c0c0c0", "bronze": "#cd7f32"};
  let labels = {"gold": "1st", "silver": "2nd", "bronze": "3rd"};
  return __jacJsx("div", {"className": ("podium-entry " + cls)}, [__jacJsx("div", {"className": "podium-rank", "style": {"color": colors[cls]}}, [labels[cls]]), __jacJsx("div", {"className": "podium-name"}, [(entry["documentation_name"] || "Unnamed")]), __jacJsx("div", {"className": "podium-score", "style": {"color": colors[cls]}}, [(String(parseFloat(entry["percentage"]).toFixed(1)) + "%")]), __jacJsx("div", {"style": {"fontSize": "0.75rem", "color": "var(--text-muted)", "marginTop": "0.25rem"}}, [(entry["model_used"] || "")])]);
}
function LeaderboardPage() {
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  let pageSize = 25;
  async function fetchData() {
    setLoading(true);
    let result = await apiCall("GetLeaderboard", {"limit": pageSize, "offset": offset});
    if (result) {
      setEntries((result["entries"] || []));
      setTotal((result["total"] || 0));
    }
    setLoading(false);
  }
  useEffect(() => {
    fetchData();
  }, [offset]);
  function badgeCls(pct) {
    let n = (parseFloat(pct) || 0);
    if ((n >= 80)) {
      return "badge badge-green";
    }
    if ((n >= 60)) {
      return "badge badge-amber";
    }
    return "badge badge-red";
  }
  return __jacJsx("div", {}, [__jacJsx("div", {"className": "section-header"}, [__jacJsx("div", {}, [__jacJsx("h1", {"className": "section-title"}, ["Leaderboard"]), __jacJsx("p", {"className": "section-subtitle"}, [(String(total) + " submissions")])]), __jacJsx("button", {"className": "btn btn-secondary", "onClick": e => {
    fetchData();
  }}, ["Refresh"])]), (loading ? __jacJsx("div", {"className": "loading-container"}, [__jacJsx("div", {"className": "spinner"}, []), __jacJsx("span", {}, ["Loading..."])]) : __jacJsx("div", {}, [((entries.length >= 3) ? __jacJsx("div", {"className": "podium"}, [[1, 0, 2].filter(i => (i < entries.length)).map(i => __jacJsx(PodiumCard, {"key": String(i), "entry": entries[i], "rank": (i + 1), "cls": ["gold", "silver", "bronze"][i]}, []))]) : null), ((entries.length > 0) ? __jacJsx("div", {"className": "card", "style": {"padding": "0"}}, [__jacJsx("div", {"className": "table-container"}, [__jacJsx("table", {}, [__jacJsx("thead", {}, [__jacJsx("tr", {}, [__jacJsx("th", {}, ["Rank"]), __jacJsx("th", {}, ["Documentation"]), __jacJsx("th", {}, ["Score"]), __jacJsx("th", {}, ["Model"]), __jacJsx("th", {}, ["Date"])])]), __jacJsx("tbody", {}, [entries.map((entry, idx) => {
    return __jacJsx("tr", {"key": String(idx)}, [__jacJsx("td", {"style": {"fontWeight": "600"}}, [("#" + String(((offset + idx) + 1)))]), __jacJsx("td", {}, [(entry["documentation_name"] || "Unnamed")]), __jacJsx("td", {}, [__jacJsx("span", {"className": badgeCls(entry["percentage"])}, [(String(parseFloat(entry["percentage"]).toFixed(1)) + "%")])]), __jacJsx("td", {"style": {"color": "var(--text-muted)", "fontSize": "0.8rem"}}, [(entry["model_used"] || "-")]), __jacJsx("td", {"style": {"color": "var(--text-muted)", "fontSize": "0.8rem"}}, [(entry["submitted_at"] ? Reflect.construct(Date, [entry["submitted_at"]]).toLocaleDateString() : "-")])]);
  })])])])]) : __jacJsx("div", {"className": "empty-state"}, [__jacJsx("p", {"className": "empty-state-text"}, ["No entries yet. Be the first to submit!"])])), ((total > pageSize) ? __jacJsx("div", {"className": "pagination"}, [__jacJsx("button", {"className": "btn btn-secondary btn-sm", "disabled": (offset === 0), "onClick": e => {
    setOffset(Math.max(0, (offset - pageSize)));
  }}, ["Previous"]), __jacJsx("span", {"className": "page-info"}, [((((String((offset + 1)) + "-") + String(Math.min((offset + pageSize), total))) + " of ") + String(total))]), __jacJsx("button", {"className": "btn btn-secondary btn-sm", "disabled": ((offset + pageSize) >= total), "onClick": e => {
    setOffset((offset + pageSize));
  }}, ["Next"])]) : null)]))]);
}
function SubmitPage() {
  const [apiKey, setApiKey] = useState("");
  const [docName, setDocName] = useState("");
  const [docUrl, setDocUrl] = useState("");
  const [docContent, setDocContent] = useState("");
  const [sourceType, setSourceType] = useState("url");
  const [urlValid, setUrlValid] = useState(null);
  const [validating, setValidating] = useState(false);
  const [running, setRunning] = useState(false);
  const [runId, setRunId] = useState("");
  const [statusData, setStatusData] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [publicTests, setPublicTests] = useState([]);
  const [testsLoading, setTestsLoading] = useState(true);
  async function fetchTests() {
    let result = await apiCall("GetPublicTests");
    if ((result && result["tests"])) {
      setPublicTests(result["tests"]);
    }
    setTestsLoading(false);
  }
  useEffect(() => {
    fetchTests();
    let savedKey = localStorage.getItem("docbench_api_key");
    if (savedKey) {
      setApiKey(savedKey);
    }
  }, []);
  async function validateUrl() {
    if ((!docUrl || (docUrl.length < 5))) {
      setUrlValid(null);
      return;
    }
    setValidating(true);
    let result = await apiCall("ValidateDocUrl", {"url": docUrl});
    if (result) {
      setUrlValid((result["valid"] || false));
    }
    setValidating(false);
  }
  async function startBenchmark() {
    if (!apiKey) {
      setErrorMsg("API key is required");
      return;
    }
    if (((sourceType === "url") && !docUrl)) {
      setErrorMsg("Documentation URL is required");
      return;
    }
    if (((sourceType === "content") && !docContent)) {
      setErrorMsg("Documentation content is required");
      return;
    }
    setErrorMsg("");
    setRunning(true);
    setStatusData(null);
    setSubmitted(false);
    let payload = {"documentation_name": (docName || "Unnamed Documentation"), "documentation_url": docUrl, "documentation_content": docContent, "max_tokens": 16000};
    payload["api_key"] = apiKey;
    let result = await apiCall("RunPublicBenchmark", payload);
    if ((result && result["run_id"])) {
      setRunId(result["run_id"]);
      pollStatus();
    } else if ((result && result["error"])) {
      setErrorMsg(result["error"]);
      setRunning(false);
    } else {
      setErrorMsg("Failed to start benchmark");
      setRunning(false);
    }
  }
  async function pollStatus() {
    if (!runId) {
      return;
    }
    let result = await apiCall("GetPublicBenchmarkStatus", {"run_id": runId});
    if (result) {
      setStatusData(result);
      if (((result["status"] === "completed") || (result["status"] === "failed"))) {
        setRunning(false);
      } else {
        setTimeout(() => {
          pollStatus();
        }, 3000);
      }
    }
  }
  async function submitToLeaderboard() {
    if ((!statusData || !statusData["result"])) {
      return;
    }
    let result = await apiCall("SubmitToLeaderboard", {"run_id": runId, "documentation_name": (docName || "Unnamed Documentation"), "documentation_url": docUrl});
    if ((result && result["success"])) {
      setSubmitted(true);
    }
  }
  return __jacJsx("div", {}, [__jacJsx("div", {"className": "section-header"}, [__jacJsx("div", {}, [__jacJsx("h1", {"className": "section-title"}, ["Submit Documentation"]), __jacJsx("p", {"className": "section-subtitle"}, ["Run the benchmark and submit results"])])]), (errorMsg ? __jacJsx("div", {"className": "alert alert-error"}, [errorMsg]) : null), __jacJsx("div", {"className": "grid-2"}, [__jacJsx("div", {}, [__jacJsx("div", {"className": "card", "style": {"marginBottom": "1.5rem"}}, [__jacJsx("h3", {"style": {"fontWeight": "600", "marginBottom": "1rem"}}, ["Configuration"]), __jacJsx("div", {"className": "form-group"}, [__jacJsx("label", {"className": "form-label"}, ["OpenRouter API Key"]), __jacJsx("input", {"type": "password", "className": "form-input", "placeholder": "sk-or-...", "value": apiKey, "onChange": e => {
    setApiKey(e.target.value);
    localStorage.setItem("docbench_api_key", e.target.value);
  }}, [])]), __jacJsx("div", {"className": "form-group"}, [__jacJsx("label", {"className": "form-label"}, ["Documentation Name"]), __jacJsx("input", {"className": "form-input", "placeholder": "My Jac Documentation", "value": docName, "onChange": e => {
    setDocName(e.target.value);
  }}, [])]), __jacJsx("div", {"className": "form-group"}, [__jacJsx("div", {"className": "tabs", "style": {"marginBottom": "0.75rem"}}, [__jacJsx("button", {"className": ("tab" + ((sourceType === "url") ? " active" : "")), "onClick": e => {
    setSourceType("url");
  }}, ["URL"]), __jacJsx("button", {"className": ("tab" + ((sourceType === "content") ? " active" : "")), "onClick": e => {
    setSourceType("content");
  }}, ["Paste Content"])]), ((sourceType === "url") ? __jacJsx("div", {}, [__jacJsx("input", {"className": "form-input", "placeholder": "https://example.com/docs.txt", "value": docUrl, "onChange": e => {
    setDocUrl(e.target.value);
  }, "onBlur": e => {
    validateUrl();
  }}, []), (validating ? __jacJsx("div", {"style": {"fontSize": "0.8rem", "color": "var(--text-muted)", "marginTop": "0.375rem"}}, ["Validating..."]) : null), (((urlValid === true) && !validating) ? __jacJsx("div", {"style": {"fontSize": "0.8rem", "color": "var(--success)", "marginTop": "0.375rem"}}, ["URL is valid"]) : null), (((urlValid === false) && !validating) ? __jacJsx("div", {"style": {"fontSize": "0.8rem", "color": "var(--error)", "marginTop": "0.375rem"}}, ["URL is not reachable"]) : null)]) : __jacJsx("textarea", {"className": "form-textarea", "rows": 8, "placeholder": "Paste documentation content...", "value": docContent, "onChange": e => {
    setDocContent(e.target.value);
  }}, []))]), __jacJsx("button", {"className": "btn btn-primary", "disabled": running, "style": {"width": "100%", "justifyContent": "center"}, "onClick": e => {
    startBenchmark();
  }}, [(running ? "Running..." : "Run Benchmark")])])]), __jacJsx("div", {}, [(statusData ? __jacJsx("div", {"className": "card", "style": {"marginBottom": "1.5rem"}}, [__jacJsx("h3", {"style": {"fontWeight": "600", "marginBottom": "1rem"}}, ["Results"]), __jacJsx("div", {"style": {"display": "flex", "alignItems": "center", "gap": "0.5rem", "marginBottom": "0.75rem"}}, [__jacJsx("span", {"className": ("status-dot " + ((statusData["status"] === "completed") ? "status-completed" : ((statusData["status"] === "failed") ? "status-failed" : "status-running")))}, []), __jacJsx("span", {"style": {"fontWeight": "500", "textTransform": "capitalize"}}, [statusData["status"]])]), (statusData["progress"] ? __jacJsx("p", {"style": {"fontSize": "0.8rem", "color": "var(--text-muted)", "marginBottom": "0.75rem"}}, [statusData["progress"]]) : null), (((statusData["status"] === "completed") && statusData["result"]) ? __jacJsx("div", {}, [__jacJsx("div", {"style": {"textAlign": "center", "marginBottom": "1rem"}}, [__jacJsx("div", {"className": ("score-large " + ((parseFloat(statusData["result"]["percentage"]) >= 80) ? "score-green" : ((parseFloat(statusData["result"]["percentage"]) >= 60) ? "score-amber" : "score-red")))}, [(String(parseFloat(statusData["result"]["percentage"]).toFixed(1)) + "%")]), __jacJsx("div", {"style": {"fontSize": "0.8rem", "color": "var(--text-muted)"}}, [(((String(statusData["result"]["total_score"]) + " / ") + String(statusData["result"]["max_score"])) + " points")])]), (!submitted ? __jacJsx("button", {"className": "btn btn-primary", "style": {"width": "100%", "justifyContent": "center"}, "onClick": e => {
    submitToLeaderboard();
  }}, ["Submit to Leaderboard"]) : __jacJsx("div", {"className": "alert alert-success"}, ["Submitted to leaderboard!"]))]) : null), ((statusData["status"] === "failed") ? __jacJsx("div", {"className": "alert alert-error"}, [(statusData["error"] || "Benchmark failed")]) : null)]) : null), __jacJsx("div", {"className": "card"}, [__jacJsx("h3", {"style": {"fontWeight": "600", "marginBottom": "0.75rem"}}, ["Public Test Suite", (!testsLoading ? __jacJsx("span", {"style": {"fontSize": "0.8rem", "fontWeight": "400", "color": "var(--text-muted)", "marginLeft": "0.5rem"}}, [(("(" + String(publicTests.length)) + " tests)")]) : null)]), (testsLoading ? __jacJsx("div", {"className": "loading-container"}, [__jacJsx("div", {"className": "spinner"}, [])]) : __jacJsx("div", {"style": {"maxHeight": "300px", "overflowY": "auto"}}, [publicTests.map(test => {
    return __jacJsx("div", {"key": test["id"], "style": {"display": "flex", "justifyContent": "space-between", "padding": "0.375rem 0", "fontSize": "0.8rem", "borderBottom": "1px solid var(--border-primary)"}}, [__jacJsx("span", {"style": {"color": "var(--text-secondary)"}}, [test["id"]]), __jacJsx("div", {"style": {"display": "flex", "gap": "0.5rem"}}, [__jacJsx("span", {"className": "badge badge-blue"}, [("L" + String(test["level"]))]), __jacJsx("span", {"style": {"color": "var(--text-muted)"}}, [(String(test["points"]) + "pts")])])]);
  })]))])])])]);
}
function BenchmarkPage(props) {
  const {user} = props;
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [variant, setVariant] = useState("");
  const [batchSize, setBatchSize] = useState(45);
  const [models, setModels] = useState([]);
  const [variants, setVariants] = useState([]);
  const [running, setRunning] = useState(false);
  const [runId, setRunId] = useState("");
  const [runStatus, setRunStatus] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  useEffect(() => {
    let savedKey = localStorage.getItem("docbench_api_key");
    if (savedKey) {
      setApiKey(savedKey);
    }
    let savedModel = localStorage.getItem("docbench_model");
    if (savedModel) {
      setModel(savedModel);
    }
    let savedVariant = localStorage.getItem("docbench_variant");
    if (savedVariant) {
      setVariant(savedVariant);
    }
    fetchVariants();
  }, []);
  async function fetchModels() {
    if (!apiKey) {
      return;
    }
    let result = await apiCall("GetModels", {"api_key": apiKey}, {"X-API-Key": apiKey});
    if ((result && result["models"])) {
      setModels(result["models"]);
    }
  }
  async function fetchVariants() {
    let result = await apiCall("GetVariants");
    if ((result && result["variants"])) {
      setVariants(result["variants"]);
    }
  }
  useEffect(() => {
    if (apiKey) {
      fetchModels();
    }
  }, [apiKey]);
  async function startBenchmark() {
    if (((!apiKey || !model) || !variant)) {
      setErrorMsg("API key, model, and variant are required");
      return;
    }
    setErrorMsg("");
    setRunning(true);
    let result = await apiCall("RunBenchmark", {"model": model, "variant": variant, "batch_size": batchSize, "api_key": apiKey});
    if ((result && result["run_id"])) {
      setRunId(result["run_id"]);
      pollRunning();
    } else if ((result && result["error"])) {
      setErrorMsg(result["error"]);
      setRunning(false);
    } else {
      setErrorMsg("Failed to start benchmark");
      setRunning(false);
    }
  }
  async function pollRunning() {
    let result = await apiCall("GetRunning");
    if ((result && result["runs"])) {
      setRunStatus(result);
      let keys = Object.keys(result["runs"]);
      let hasActive = keys.some(k => {
        return (result["runs"][k]["status"] === "running");
      });
      if (hasActive) {
        setTimeout(() => {
          pollRunning();
        }, 3000);
      } else {
        setRunning(false);
      }
    } else {
      setRunning(false);
    }
  }
  if ((!user || !user["is_admin"])) {
    return __jacJsx("div", {"className": "empty-state"}, [__jacJsx("p", {"className": "empty-state-text"}, ["Admin access required"])]);
  }
  return __jacJsx("div", {}, [__jacJsx("div", {"className": "section-header"}, [__jacJsx("div", {}, [__jacJsx("h1", {"className": "section-title"}, ["Benchmark Runner"]), __jacJsx("p", {"className": "section-subtitle"}, ["Run benchmarks against LLM models"])])]), (errorMsg ? __jacJsx("div", {"className": "alert alert-error"}, [errorMsg]) : null), __jacJsx("div", {"className": "card", "style": {"marginBottom": "1.5rem"}}, [__jacJsx("div", {"className": "controls-grid"}, [__jacJsx("div", {"className": "form-group"}, [__jacJsx("label", {"className": "form-label"}, ["API Key"]), __jacJsx("input", {"type": "password", "className": "form-input", "placeholder": "sk-or-...", "value": apiKey, "onChange": e => {
    setApiKey(e.target.value);
    localStorage.setItem("docbench_api_key", e.target.value);
  }}, [])]), __jacJsx("div", {"className": "form-group"}, [__jacJsx("label", {"className": "form-label"}, ["Model"]), __jacJsx("select", {"className": "form-select", "value": model, "onChange": e => {
    setModel(e.target.value);
    localStorage.setItem("docbench_model", e.target.value);
  }}, [__jacJsx("option", {"value": ""}, ["Select model..."]), models.map(m => {
    return __jacJsx("option", {"key": m["id"], "value": m["id"]}, [(m["name"] || m["id"])]);
  })])]), __jacJsx("div", {"className": "form-group"}, [__jacJsx("label", {"className": "form-label"}, ["Variant"]), __jacJsx("select", {"className": "form-select", "value": variant, "onChange": e => {
    setVariant(e.target.value);
    localStorage.setItem("docbench_variant", e.target.value);
  }}, [__jacJsx("option", {"value": ""}, ["Select variant..."]), variants.map(v => {
    return __jacJsx("option", {"key": v["name"], "value": v["name"]}, [(((v["name"] + " (") + String(v["size_kb"])) + " KB)")]);
  })])]), __jacJsx("div", {"className": "form-group"}, [__jacJsx("label", {"className": "form-label"}, ["Batch Size"]), __jacJsx("input", {"type": "number", "className": "form-input", "value": batchSize, "onChange": e => {
    setBatchSize((parseInt(e.target.value) || 45));
  }}, [])])]), __jacJsx("button", {"className": "btn btn-primary", "disabled": (((running || !apiKey) || !model) || !variant), "onClick": e => {
    startBenchmark();
  }}, [(running ? "Running..." : "Run Benchmark")])]), ((runStatus && runStatus["runs"]) ? __jacJsx("div", {"className": "card"}, [__jacJsx("h3", {"style": {"fontWeight": "600", "marginBottom": "1rem"}}, ["Active Runs"]), Object.keys(runStatus["runs"]).map(key => {
    return __jacJsx("div", {"key": key, "style": {"padding": "0.75rem", "borderBottom": "1px solid var(--border-primary)", "display": "flex", "alignItems": "center", "justifyContent": "space-between"}}, [__jacJsx("div", {}, [__jacJsx("span", {"style": {"fontWeight": "500", "fontSize": "0.875rem"}}, [key]), __jacJsx("div", {"style": {"fontSize": "0.8rem", "color": "var(--text-muted)", "marginTop": "0.25rem"}}, [(runStatus["runs"][key]["progress"] || "")])]), __jacJsx("span", {"className": ("status-dot " + ((runStatus["runs"][key]["status"] === "running") ? "status-running" : "status-completed"))}, [])]);
  })]) : null)]);
}
function FilesPage(props) {
  const {user} = props;
  const [files, setFiles] = useState([]);
  const [stashes, setStashes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("files");
  const [selectedStash, setSelectedStash] = useState("");
  const [stashFiles, setStashFiles] = useState([]);
  async function fetchFiles() {
    setLoading(true);
    let result = await apiCall("GetTestFiles", {"limit": 100});
    if ((result && result["files"])) {
      setFiles(result["files"]);
    }
    setLoading(false);
  }
  async function fetchStashes() {
    let result = await apiCall("GetStashes");
    if ((result && result["stashes"])) {
      setStashes(result["stashes"]);
    }
  }
  async function fetchStashFiles(name) {
    setSelectedStash(name);
    let result = await apiCall("GetStashFiles", {"stash_name": name});
    if ((result && result["files"])) {
      setStashFiles(result["files"]);
    }
  }
  async function stashAll() {
    let result = await apiCall("StashAll");
    if ((result && (result["status"] === "success"))) {
      fetchFiles();
      fetchStashes();
    }
  }
  async function deleteFile(fp) {
    let result = await apiCall("DeleteFile", {"file_path": fp});
    if (result) {
      fetchFiles();
    }
  }
  useEffect(() => {
    fetchFiles();
    fetchStashes();
  }, []);
  if ((!user || !user["is_admin"])) {
    return __jacJsx("div", {"className": "empty-state"}, [__jacJsx("p", {"className": "empty-state-text"}, ["Admin access required"])]);
  }
  return __jacJsx("div", {}, [__jacJsx("div", {"className": "section-header"}, [__jacJsx("div", {}, [__jacJsx("h1", {"className": "section-title"}, ["File Manager"]), __jacJsx("p", {"className": "section-subtitle"}, ["Manage benchmark results and collections"])]), __jacJsx("div", {"style": {"display": "flex", "gap": "0.5rem"}}, [__jacJsx("button", {"className": "btn btn-primary", "onClick": e => {
    stashAll();
  }}, ["Stash All"]), __jacJsx("button", {"className": "btn btn-secondary", "onClick": e => {
    fetchFiles();
    fetchStashes();
  }}, ["Refresh"])])]), __jacJsx("div", {"className": "tabs"}, [__jacJsx("button", {"className": ("tab" + ((activeTab === "files") ? " active" : "")), "onClick": e => {
    setActiveTab("files");
  }}, [(("Test Files (" + String(files.length)) + ")")]), __jacJsx("button", {"className": ("tab" + ((activeTab === "stashes") ? " active" : "")), "onClick": e => {
    setActiveTab("stashes");
  }}, [(("Collections (" + String(stashes.length)) + ")")])]), (loading ? __jacJsx("div", {"className": "loading-container"}, [__jacJsx("div", {"className": "spinner"}, []), __jacJsx("span", {}, ["Loading..."])]) : null), (((activeTab === "files") && !loading) ? __jacJsx("div", {"className": "card", "style": {"padding": "0.5rem"}}, [((files.length > 0) ? __jacJsx("div", {"className": "file-list"}, [files.map((f, idx) => {
    return __jacJsx("div", {"key": String(idx), "className": "file-item"}, [__jacJsx("div", {}, [__jacJsx("span", {"style": {"fontWeight": "500"}}, [((f["run_id"] || f["file_path"]) || "unknown")]), __jacJsx("div", {"style": {"fontSize": "0.75rem", "color": "var(--text-muted)"}}, [(((f["model"] || "") + " - ") + (f["variant"] || ""))])]), __jacJsx("div", {"style": {"display": "flex", "alignItems": "center", "gap": "0.5rem"}}, [(f["percentage"] ? __jacJsx("span", {"className": ("badge " + ((parseFloat(f["percentage"]) >= 80) ? "badge-green" : ((parseFloat(f["percentage"]) >= 60) ? "badge-amber" : "badge-red")))}, [(String(parseFloat(f["percentage"]).toFixed(1)) + "%")]) : null), __jacJsx("button", {"className": "btn btn-danger btn-sm", "onClick": e => {
      deleteFile((f["file_path"] || f["run_id"]));
    }}, ["x"])])]);
  })]) : __jacJsx("div", {"className": "empty-state"}, [__jacJsx("p", {"className": "empty-state-text"}, ["No test files"])]))]) : null), (((activeTab === "stashes") && !loading) ? __jacJsx("div", {"className": "grid-2"}, [__jacJsx("div", {"className": "card", "style": {"padding": "0.5rem"}}, [__jacJsx("div", {"className": "file-list"}, [stashes.map(stash => {
    return __jacJsx("div", {"key": stash, "className": ("file-item" + ((selectedStash === stash) ? " active" : "")), "onClick": e => {
      fetchStashFiles(stash);
    }}, [__jacJsx("span", {}, [stash])]);
  })])]), __jacJsx("div", {"className": "card"}, [(selectedStash ? __jacJsx("div", {}, [__jacJsx("h4", {"style": {"fontWeight": "600", "marginBottom": "0.75rem"}}, [selectedStash]), stashFiles.map((sf, idx) => {
    return __jacJsx("div", {"key": String(idx), "style": {"fontSize": "0.8rem", "padding": "0.375rem 0", "borderBottom": "1px solid var(--border-primary)"}}, [((sf["run_id"] || sf["file_path"]) || "file")]);
  })]) : __jacJsx("div", {"className": "empty-state"}, [__jacJsx("p", {"className": "empty-state-text"}, ["Select a collection"])]))])]) : null)]);
}
function app() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  async function fetchUser() {
    let token = localStorage.getItem("docbench_token");
    if (token) {
      let result = await apiCall("GetCurrentUser");
      if ((result && result["user"])) {
        setUser(result["user"]);
      } else {
        localStorage.removeItem("docbench_token");
      }
    }
    setLoading(false);
  }
  function handleLogout() {
    localStorage.removeItem("docbench_token");
    setUser(null);
  }
  useEffect(() => {
    fetchUser();
  }, []);
  return __jacJsx(Router, {}, [__jacJsx("div", {"className": "app-container"}, [__jacJsx(AppHeader, {"user": user, "onLogout": () => {
    handleLogout();
  }}, []), __jacJsx("div", {"className": "main-content"}, [__jacJsx(Routes, {}, [__jacJsx(Route, {"path": "/", "element": __jacJsx(HomePage, {}, [])}, []), __jacJsx(Route, {"path": "/leaderboard", "element": __jacJsx(LeaderboardPage, {}, [])}, []), __jacJsx(Route, {"path": "/submit", "element": __jacJsx(SubmitPage, {}, [])}, []), __jacJsx(Route, {"path": "/benchmark", "element": __jacJsx(BenchmarkPage, {"user": user}, [])}, []), __jacJsx(Route, {"path": "/files", "element": __jacJsx(FilesPage, {"user": user}, [])}, []), __jacJsx(Route, {"path": "/auth/callback", "element": __jacJsx(AuthCallbackPage, {"onLogin": () => {
    fetchUser();
  }}, [])}, [])])])])]);
}
export {app};