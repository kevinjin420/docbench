/* Source: /home/kevinjin/jaseci-docbench/ui/views/file_manager.cl.jac */
import {__jacJsx, __jacSpawn} from "@jac/runtime";
import { useState } from "@jac/runtime";
function FileManagerView(props) {
  const [files, setFiles] = useState((props["files"] || []));
  const [stashes, setStashes] = useState((props["stashes"] || []));
  const [selected_stash, setSelected_stash] = useState("");
  const [stash_files, setStash_files] = useState([]);
  const [is_loading, setIs_loading] = useState(false);
  async function refresh() {
    setIs_loading(true);
    let file_result = await __jacSpawn("ListTestFiles", "", {});
    if (file_result.reports) {
      setFiles((file_result.reports[0]["files"] || []));
    }
    let stash_result = await __jacSpawn("ListStashes", "", {});
    if (stash_result.reports) {
      setStashes((stash_result.reports[0]["stashes"] || []));
    }
    setIs_loading(false);
  }
  async function stash_all() {
    let result = await __jacSpawn("CreateStash", "", {});
    await refresh();
  }
  async function clean_all() {
    let result = await __jacSpawn("CleanResults", "", {});
    await refresh();
  }
  async function delete_stash(name) {
    let result = await __jacSpawn("DeleteStash", "", {"stash_name": name});
    await refresh();
  }
  async function delete_file(run_id) {
    let result = await __jacSpawn("DeleteFile", "", {"run_id": run_id});
    await refresh();
  }
  async function view_stash(name) {
    setSelected_stash(name);
    let result = await __jacSpawn("GetStashFiles", "", {"stash_name": name});
    if (result.reports) {
      setStash_files((result.reports[0]["files"] || []));
    }
  }
  async function export_csv() {
    let result = await __jacSpawn("ExportCSV", "", {});
    if (result.reports) {
      let csv_data = (result.reports[0]["csv"] || "");
    }
  }
  return __jacJsx("div", {"className": "max-w-6xl mx-auto"}, [__jacJsx("div", {"className": "flex justify-between items-center mb-6"}, [__jacJsx("h1", {"className": "text-3xl font-bold text-text-primary"}, ["File Manager"]), __jacJsx("div", {"className": "flex gap-2"}, [__jacJsx("button", {"onClick": e => {
    stash_all();
  }, "className": "btn btn-primary btn-sm"}, ["Stash All"]), __jacJsx("button", {"onClick": e => {
    clean_all();
  }, "className": "btn btn-danger btn-sm"}, ["Clean"]), __jacJsx("button", {"onClick": e => {
    export_csv();
  }, "className": "btn btn-secondary btn-sm"}, ["Export CSV"]), __jacJsx("button", {"onClick": e => {
    refresh();
  }, "className": "btn btn-ghost btn-sm"}, ["Refresh"])])]), __jacJsx("div", {"className": "grid grid-cols-1 lg:grid-cols-2 gap-6"}, [__jacJsx("div", {}, [__jacJsx("h2", {"className": "text-lg font-semibold text-text-primary mb-4"}, ["Uncollected Results (", String(files.length), ")"]), __jacJsx("div", {"className": "space-y-2"}, [files.map(f => __jacJsx("div", {"key": f["run_id"], "className": "bg-terminal-surface border border-terminal-border rounded p-3 flex justify-between items-center"}, [__jacJsx("div", {}, [__jacJsx("div", {"className": "text-text-primary text-sm font-mono truncate max-w-xs"}, [f["run_id"]]), __jacJsx("div", {"className": "text-text-muted text-xs"}, [f["model"], "/ ", f["variant"]]), (((f["percentage"] || 0) > 0) ? __jacJsx("span", {"className": "text-terminal-accent text-xs font-mono"}, [(String(f["percentage"]) + "%")]) : __jacJsx("span", {"className": "text-text-muted text-xs"}, ["Not evaluated"]))]), __jacJsx("button", {"onClick": e => {
    delete_file(f["run_id"]);
  }, "className": "btn btn-danger btn-sm btn-icon"}, ["X"])])), ((files.length === 0) ? __jacJsx("p", {"className": "text-text-muted text-sm text-center py-4"}, ["No uncollected results"]) : null)])]), __jacJsx("div", {}, [__jacJsx("h2", {"className": "text-lg font-semibold text-text-primary mb-4"}, ["Collections (", String(stashes.length), ")"]), __jacJsx("div", {"className": "space-y-2"}, [stashes.map(s => __jacJsx("div", {"key": s["name"], "className": "bg-terminal-surface border border-terminal-border rounded p-3"}, [__jacJsx("div", {"className": "flex justify-between items-center"}, [__jacJsx("div", {}, [__jacJsx("button", {"onClick": e => {
    view_stash(s["name"]);
  }, "className": "text-text-primary text-sm font-medium hover:text-terminal-accent"}, [s["name"]]), __jacJsx("div", {"className": "text-text-muted text-xs"}, [String((s["result_count"] || 0)), "files"])]), __jacJsx("button", {"onClick": e => {
    delete_stash(s["name"]);
  }, "className": "btn btn-danger btn-sm btn-icon"}, ["X"])]), (((selected_stash === s["name"]) && (stash_files.length > 0)) ? __jacJsx("div", {"className": "mt-3 pt-3 border-t border-terminal-border space-y-1"}, [stash_files.map(sf => __jacJsx("div", {"key": sf["run_id"], "className": "text-xs text-text-secondary font-mono flex justify-between"}, [__jacJsx("span", {"className": "truncate"}, [sf["run_id"]]), (((sf["percentage"] || 0) > 0) ? __jacJsx("span", {"className": "text-terminal-accent"}, [(String(sf["percentage"]) + "%")]) : null)]))]) : null)])), ((stashes.length === 0) ? __jacJsx("p", {"className": "text-text-muted text-sm text-center py-4"}, ["No collections"]) : null)])])])]);
}
export {FileManagerView};