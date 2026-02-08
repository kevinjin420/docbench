/* Source: /home/kevinjin/jaseci-docbench/ui/views/public_benchmark.cl.jac */
import {__jacJsx, __jacSpawn} from "@jac/runtime";
import { useEffect } from "react";
import { useState } from "@jac/runtime";
function PublicBenchmarkView(props) {
  const [doc_url, setDoc_url] = useState("");
  const [doc_name, setDoc_name] = useState("");
  const [url_valid, setUrl_valid] = useState(false);
  const [url_error, setUrl_error] = useState("");
  const [is_validating, setIs_validating] = useState(false);
  const [is_running, setIs_running] = useState(false);
  const [run_id, setRun_id] = useState("");
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [public_tests, setPublic_tests] = useState([]);
  const [test_count, setTest_count] = useState(0);
  async function load_public_tests() {
    let test_result = await __jacSpawn("GetPublicTests", "", {});
    if (test_result.reports) {
      let data = test_result.reports[0];
      setPublic_tests((data["tests"] || []));
      setTest_count((data["count"] || 0));
    }
  }
  useEffect(() => {
    load_public_tests();
  }, []);
  async function validate_url() {
    if (!doc_url.trim()) {
      setUrl_valid(false);
      setUrl_error("");
      return;
    }
    setIs_validating(true);
    let vresult = await __jacSpawn("ValidateURL", "", {"url": doc_url});
    if (vresult.reports) {
      let data = vresult.reports[0];
      setUrl_valid((data["valid"] || false));
      setUrl_error((data["error"] || ""));
    }
    setIs_validating(false);
  }
  async function run_benchmark() {
    let api_key = (props["api_key"] || "");
    if (!api_key) {
      setUrl_error("API key required. Configure it in the header.");
      return;
    }
    setIs_running(true);
    setProgress("Starting benchmark...");
    let bm_result = await __jacSpawn("RunPublicBenchmark", "", {"documentation_url": doc_url, "documentation_name": (doc_name || doc_url), "api_key": api_key});
    if (bm_result.reports) {
      let data = bm_result.reports[0];
      if (("error" in data)) {
        setUrl_error(data["error"]);
        setIs_running(false);
        return;
      }
      setRun_id((data["run_id"] || ""));
      await poll_status();
    }
  }
  async function poll_status() {
    while (is_running) {
      let status_result = await __jacSpawn("GetPublicBenchmarkStatus", "", {"run_id": run_id});
      if (status_result.reports) {
        let data = status_result.reports[0];
        let status = (data["status"] || "");
        setProgress((data["progress"] || ""));
        if ((status === "completed")) {
          setResult((data["result"] || {}));
          setIs_running(false);
        } else if ((status === "failed")) {
          setUrl_error((data["error"] || "Benchmark failed"));
          setIs_running(false);
        }
      }
      if (is_running) {
        await asyncio.sleep(2);
      }
    }
  }
  async function submit_to_leaderboard() {
    if ((!result || !run_id)) {
      return;
    }
    let sub_result = await __jacSpawn("SubmitToLeaderboard", "", {"run_id": run_id, "documentation_name": (doc_name || doc_url), "documentation_url": doc_url});
    if (sub_result.reports) {
      let data = sub_result.reports[0];
      if (data["success"]) {
        setSubmitted(true);
      }
    }
  }
  return __jacJsx("div", {"className": "max-w-4xl mx-auto"}, [__jacJsx("h1", {"className": "text-3xl font-bold text-text-primary mb-2"}, ["Submit Documentation"]), __jacJsx("p", {"className": "text-text-secondary mb-8"}, [(("Benchmark your Jac documentation against " + String(test_count)) + " public tests across multiple LLM models.")]), __jacJsx("div", {"className": "bg-terminal-surface border border-terminal-border rounded-lg p-6 mb-6"}, [__jacJsx("div", {"className": "space-y-4"}, [__jacJsx("div", {}, [__jacJsx("label", {"className": "block text-sm text-text-secondary mb-2"}, ["Documentation Name"]), __jacJsx("input", {"type": "text", "value": doc_name, "onChange": e => {
    setDoc_name(e.target.value);
  }, "placeholder": "My Jac Documentation v1", "className": "w-full px-3 py-2 bg-terminal-bg border border-terminal-border rounded text-text-primary text-sm focus:outline-none focus:border-terminal-accent", "disabled": is_running}, [])]), __jacJsx("div", {}, [__jacJsx("label", {"className": "block text-sm text-text-secondary mb-2"}, ["Documentation URL"]), __jacJsx("div", {"className": "flex gap-2"}, [__jacJsx("input", {"type": "url", "value": doc_url, "onChange": e => {
    setDoc_url(e.target.value);
  }, "onBlur": e => {
    validate_url();
  }, "placeholder": "https://example.com/jac-docs.md", "className": "flex-1 px-3 py-2 bg-terminal-bg border border-terminal-border rounded text-text-primary text-sm focus:outline-none focus:border-terminal-accent", "disabled": is_running}, []), __jacJsx("button", {"onClick": e => {
    validate_url();
  }, "disabled": (is_validating || is_running), "className": "btn btn-secondary btn-sm"}, [(is_validating ? "Checking..." : "Validate")])]), (url_error ? __jacJsx("p", {"className": "text-red-400 text-xs mt-1"}, [url_error]) : (url_valid ? __jacJsx("p", {"className": "text-green-400 text-xs mt-1"}, ["URL is reachable"]) : __jacJsx("span", {}, [])))])]), __jacJsx("div", {"className": "mt-6"}, [((!is_running && !result) ? __jacJsx("button", {"onClick": e => {
    run_benchmark();
  }, "disabled": (!url_valid || !doc_url), "className": "btn btn-primary btn-lg btn-block"}, [(("Run Benchmark (" + String(test_count)) + " tests)")]) : __jacJsx("span", {}, []))])]), (is_running ? __jacJsx("div", {"className": "bg-terminal-surface border border-blue-600/30 rounded-lg p-6 mb-6"}, [__jacJsx("div", {"className": "flex items-center gap-3 mb-3"}, [__jacJsx("div", {"className": "w-3 h-3 rounded-full bg-blue-500 animate-pulse"}, []), __jacJsx("span", {"className": "text-blue-400 font-medium"}, ["Benchmark Running"])]), __jacJsx("p", {"className": "text-text-secondary text-sm"}, [progress])]) : __jacJsx("span", {}, [])), (result ? __jacJsx("div", {"className": "bg-terminal-surface border border-green-600/30 rounded-lg p-6 mb-6"}, [__jacJsx("div", {"className": "flex items-center justify-between mb-4"}, [__jacJsx("h3", {"className": "text-xl font-semibold text-text-primary"}, ["Results"]), __jacJsx("span", {"className": "text-3xl font-bold text-terminal-accent font-mono"}, [(String((result["percentage"] || 0)) + "%")])]), __jacJsx("div", {"className": "grid grid-cols-3 gap-4 mb-4"}, [__jacJsx("div", {"className": "text-center"}, [__jacJsx("div", {"className": "text-lg font-mono text-text-primary"}, [String((result["total_score"] || 0))]), __jacJsx("div", {"className": "text-xs text-text-muted"}, ["Total Score"])]), __jacJsx("div", {"className": "text-center"}, [__jacJsx("div", {"className": "text-lg font-mono text-text-primary"}, [String((result["max_score"] || 0))]), __jacJsx("div", {"className": "text-xs text-text-muted"}, ["Max Score"])]), __jacJsx("div", {"className": "text-center"}, [__jacJsx("div", {"className": "text-lg font-mono text-text-primary"}, [((String((result["models_completed"] || 0)) + "/") + String((result["models_total"] || 0)))]), __jacJsx("div", {"className": "text-xs text-text-muted"}, ["Models"])])]), (!submitted ? __jacJsx("button", {"onClick": e => {
    submit_to_leaderboard();
  }, "className": "btn btn-success-solid btn-block"}, ["Submit to Leaderboard"]) : __jacJsx("div", {"className": "text-center py-3 text-green-400 font-medium"}, ["Submitted to leaderboard!"]))]) : __jacJsx("span", {}, []))]);
}
export {PublicBenchmarkView};