/* Source: /home/kevinjin/jaseci-docbench/ui/views/benchmark.cl.jac */
import {__jacJsx, __jacSpawn} from "@jac/runtime";
import { useState } from "@jac/runtime";
function BenchmarkView(props) {
  const [selected_model, setSelected_model] = useState("");
  const [selected_variant, setSelected_variant] = useState("");
  const [queue_size, setQueue_size] = useState(1);
  const [batch_size, setBatch_size] = useState(45);
  const [is_running, setIs_running] = useState(false);
  const [run_id, setRun_id] = useState("");
  const [progress, setProgress] = useState("");
  const [completed_runs, setCompleted_runs] = useState([]);
  async function run_benchmark() {
    let api_key = (props["api_key"] || "");
    if (((!api_key || !selected_model) || !selected_variant)) {
      return;
    }
    setIs_running(true);
    setProgress("Starting...");
    for (const i of new range(queue_size)) {
      let result = await __jacSpawn("RunBenchmark", "", {"model": selected_model, "variant": selected_variant, "max_tokens": 16000, "batch_size": batch_size, "api_key": api_key});
      if (result.reports) {
        let data = result.reports[0];
        setRun_id((data["run_id"] || ""));
        completed_runs.append(data);
      }
    }
    setIs_running(false);
    setProgress("All runs completed");
  }
  return __jacJsx("div", {"className": "max-w-6xl mx-auto"}, [__jacJsx("h1", {"className": "text-3xl font-bold text-text-primary mb-6"}, ["Benchmark Runner"]), __jacJsx("div", {"className": "bg-terminal-surface border border-terminal-border rounded-lg p-6 mb-6"}, [__jacJsx("div", {"className": "flex gap-4 items-center flex-wrap"}, [__jacJsx("div", {"className": "flex items-center gap-2"}, [__jacJsx("label", {"className": "text-text-secondary text-sm font-medium uppercase"}, ["Model:"]), __jacJsx("select", {"value": selected_model, "onChange": e => {
    setSelected_model(e.target.value);
  }, "disabled": is_running, "className": "px-3 py-2 bg-terminal-bg border border-terminal-border rounded text-text-primary text-sm min-w-[200px]"}, [__jacJsx("option", {"value": ""}, ["Select model..."]), (props["models"] || []).map(m => __jacJsx("option", {"key": m["id"], "value": m["id"]}, [(m["name"] || m["id"])]))])]), __jacJsx("div", {"className": "flex items-center gap-2"}, [__jacJsx("label", {"className": "text-text-secondary text-sm font-medium uppercase"}, ["Docs:"]), __jacJsx("select", {"value": selected_variant, "onChange": e => {
    setSelected_variant(e.target.value);
  }, "disabled": is_running, "className": "px-3 py-2 bg-terminal-bg border border-terminal-border rounded text-text-primary text-sm min-w-[150px]"}, [__jacJsx("option", {"value": ""}, ["Select variant..."]), (props["variants"] || []).map(v => __jacJsx("option", {"key": v["variant_name"], "value": v["variant_name"]}, [v["variant_name"]]))])]), __jacJsx("div", {"className": "flex items-center gap-2"}, [__jacJsx("label", {"className": "text-text-muted text-sm uppercase"}, ["Runs:"]), __jacJsx("input", {"type": "number", "min": "1", "max": "20", "value": String(queue_size), "onChange": e => {
    setQueue_size((e.target.value ? parseInt(e.target.value) : 1));
  }, "disabled": is_running, "className": "w-16 px-2 py-2 bg-terminal-bg border border-terminal-border rounded text-text-primary text-sm text-center"}, [])]), __jacJsx("div", {"className": "flex items-center gap-2"}, [__jacJsx("label", {"className": "text-text-muted text-sm uppercase"}, ["Batch:"]), __jacJsx("input", {"type": "number", "min": "1", "max": "100", "value": String(batch_size), "onChange": e => {
    setBatch_size((e.target.value ? parseInt(e.target.value) : 45));
  }, "disabled": is_running, "className": "w-16 px-2 py-2 bg-terminal-bg border border-terminal-border rounded text-text-primary text-sm text-center"}, [])]), __jacJsx("div", {"className": "ml-auto"}, [(!is_running ? __jacJsx("button", {"onClick": e => {
    run_benchmark();
  }, "disabled": (!selected_model || !selected_variant), "className": "btn btn-primary"}, ["Run ", ((queue_size > 1) ? (("(" + String(queue_size)) + ")") : "")]) : __jacJsx("div", {"className": "flex items-center gap-2 text-blue-400"}, [__jacJsx("div", {"className": "w-3 h-3 rounded-full bg-blue-500 animate-pulse"}, []), __jacJsx("span", {"className": "text-sm"}, [progress])]))])])]), ((completed_runs.length > 0) ? __jacJsx("div", {"className": "bg-terminal-surface border border-terminal-border rounded-lg overflow-hidden"}, [__jacJsx("div", {"className": "px-4 py-3 border-b border-terminal-border"}, [__jacJsx("h3", {"className": "text-text-primary font-medium"}, ["Completed Runs"])]), completed_runs.map(run => __jacJsx("div", {"key": String(completed_runs.indexOf(run)), "className": "px-4 py-3 border-b border-terminal-border flex items-center justify-between"}, [__jacJsx("div", {}, [__jacJsx("span", {"className": "text-text-primary text-sm font-mono"}, [(run["run_id"] || "")]), __jacJsx("span", {"className": "text-text-muted text-xs ml-3"}, [(run["status"] || "")])])]))]) : __jacJsx("div", {"className": "bg-terminal-surface border border-terminal-border rounded-lg p-12 text-center"}, [__jacJsx("p", {"className": "text-text-muted"}, ["No benchmark runs yet. Configure and click Run to start."])]))]);
}
export {BenchmarkView};