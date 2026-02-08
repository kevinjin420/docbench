/* Source: /home/kevinjin/jaseci-docbench/ui/views/tests.cl.jac */
import {__jacJsx, __jacSpawn} from "@jac/runtime";
import { useEffect } from "react";
import { useState } from "@jac/runtime";
function TestsView() {
  const [active_tab, setActive_tab] = useState("overview");
  const [stats, setStats] = useState({});
  const [tests, setTests] = useState([]);
  const [total_tests, setTotal_tests] = useState(0);
  const [current_page, setCurrent_page] = useState(0);
  const [page_size, setPage_size] = useState(25);
  const [filter_level, setFilter_level] = useState("");
  const [filter_category, setFilter_category] = useState("");
  const [search_query, setSearch_query] = useState("");
  const [show_deleted, setShow_deleted] = useState(false);
  const [is_loading, setIs_loading] = useState(true);
  const [editing_test, setEditing_test] = useState(null);
  const [public_test_ids, setPublic_test_ids] = useState([]);
  const [benchmark_models, setBenchmark_models] = useState([]);
  const [new_model_id, setNew_model_id] = useState("");
  const [new_model_name, setNew_model_name] = useState("");
  useEffect(() => {
    load_stats();
    load_tests();
    load_public_config();
  }, []);
  async function load_stats() {
    let result = await __jacSpawn("AdminTestStats", "", {});
    if (result.reports) {
      setStats(result.reports[0]);
    }
  }
  async function load_tests() {
    setIs_loading(true);
    let result = await __jacSpawn("AdminGetTests", "", {"limit": page_size, "offset": (current_page * page_size), "level": filter_level, "category": filter_category, "search": search_query, "include_deleted": show_deleted});
    if (result.reports) {
      let data = result.reports[0];
      setTests(data.get("tests", []));
      setTotal_tests(data.get("total", 0));
    }
    setIs_loading(false);
  }
  async function load_public_config() {
    let result = await __jacSpawn("AdminGetPublicTests", "", {});
    if (result.reports) {
      let data = result.reports[0];
      setPublic_test_ids(data.get("test_ids", []));
    }
    let model_result = await __jacSpawn("AdminListModels", "", {});
    if (model_result.reports) {
      setBenchmark_models(model_result.reports[0].get("models", []));
    }
  }
  async function delete_test(test_id) {
    let result = await __jacSpawn("AdminDeleteTest", "", {"test_id": test_id});
    await load_tests();
    await load_stats();
  }
  async function restore_test(test_id) {
    let result = await __jacSpawn("AdminRestoreTest", "", {"test_id": test_id});
    await load_tests();
  }
  async function save_test(test_data) {
    if (test_data.get("id")) {
      let result = await __jacSpawn("AdminUpdateTest", "", {"test_id": test_data["id"], "updates": test_data});
    } else {
      result = await __jacSpawn("AdminCreateTest", "", {"test_data": test_data});
    }
    setEditing_test(null);
    await load_tests();
    await load_stats();
  }
  async function toggle_public_test(test_id) {
    if ((test_id in public_test_ids)) {
      let result = await __jacSpawn("AdminRemovePublicTest", "", {"test_id": test_id});
    } else {
      result = await __jacSpawn("AdminAddPublicTest", "", {"test_id": test_id});
    }
    await load_public_config();
  }
  async function add_model() {
    if (!new_model_id.trim()) {
      return;
    }
    let result = await __jacSpawn("AdminAddModel", "", {"model_id": new_model_id, "display_name": (new_model_name || new_model_id)});
    setNew_model_id("");
    setNew_model_name("");
    await load_public_config();
  }
  async function remove_model(model_id) {
    let result = await __jacSpawn("AdminRemoveModel", "", {"model_id": model_id});
    await load_public_config();
  }
  async function toggle_model(model_id) {
    let result = await __jacSpawn("AdminToggleModel", "", {"model_id": model_id});
    await load_public_config();
  }
  return __jacJsx("div", {"className": "max-w-6xl mx-auto"}, [__jacJsx("h1", {"className": "text-3xl font-bold text-text-primary mb-6"}, ["Test Management"]), __jacJsx("div", {"className": "flex gap-1 mb-6 border-b border-terminal-border"}, [[["overview", "Overview"], ["definitions", "Test Definitions"], ["public", "Public Suite"]].map(x => __jacJsx("button", {"key": tab, "onClick": e => {
    setActive_tab(tab);
  }, "className": ((active_tab === tab) ? "px-4 py-2 text-sm font-medium text-terminal-accent border-b-2 border-terminal-accent" : "px-4 py-2 text-sm font-medium text-text-muted hover:text-text-secondary")}, [label]))]), ((active_tab === "overview") ? __jacJsx(OverviewTab, {"stats": stats}, []) : ((active_tab === "definitions") ? __jacJsx(DefinitionsTab, {"tests": tests, "total": total_tests, "page": current_page, "page_size": page_size, "is_loading": is_loading, "filter_level": filter_level, "filter_category": filter_category, "search_query": search_query, "show_deleted": show_deleted, "editing_test": editing_test, "on_page_change": p => {
    setCurrent_page(p);
    load_tests();
  }, "on_filter_level": v => {
    setFilter_level(v);
    setCurrent_page(0);
    load_tests();
  }, "on_filter_category": v => {
    setFilter_category(v);
    setCurrent_page(0);
    load_tests();
  }, "on_search": v => {
    setSearch_query(v);
    setCurrent_page(0);
    load_tests();
  }, "on_toggle_deleted": e => {
    setShow_deleted(!show_deleted);
    load_tests();
  }, "on_delete": delete_test, "on_restore": restore_test, "on_edit": t => {
    setEditing_test(t);
  }, "on_save": save_test, "on_cancel_edit": e => {
    setEditing_test(null);
  }}, []) : __jacJsx(PublicSuiteTab, {"public_test_ids": public_test_ids, "benchmark_models": benchmark_models, "tests": tests, "on_toggle_test": toggle_public_test, "on_add_model": add_model, "on_remove_model": remove_model, "on_toggle_model": toggle_model, "new_model_id": new_model_id, "new_model_name": new_model_name, "on_model_id_change": v => {
    setNew_model_id(v);
  }, "on_model_name_change": v => {
    setNew_model_name(v);
  }}, [])))]);
}
function OverviewTab(props) {
  setStats(props.get("stats", {}));
  let levels = stats.get("by_level", []);
  let categories = stats.get("by_category", []);
  return __jacJsx("div", {"className": "grid grid-cols-1 md:grid-cols-3 gap-6"}, [__jacJsx("div", {"className": "bg-terminal-surface border border-terminal-border rounded-lg p-6 text-center"}, [__jacJsx("div", {"className": "text-3xl font-bold text-terminal-accent font-mono"}, [String(stats.get("total", 0))]), __jacJsx("div", {"className": "text-text-muted text-sm mt-1"}, ["Total Tests"])]), __jacJsx("div", {"className": "bg-terminal-surface border border-terminal-border rounded-lg p-6 text-center"}, [__jacJsx("div", {"className": "text-3xl font-bold text-text-primary font-mono"}, [String(stats.get("active", 0))]), __jacJsx("div", {"className": "text-text-muted text-sm mt-1"}, ["Active"])]), __jacJsx("div", {"className": "bg-terminal-surface border border-terminal-border rounded-lg p-6 text-center"}, [__jacJsx("div", {"className": "text-3xl font-bold text-red-400 font-mono"}, [String(stats.get("deleted", 0))]), __jacJsx("div", {"className": "text-text-muted text-sm mt-1"}, ["Deleted"])]), __jacJsx("div", {"className": "md:col-span-3 bg-terminal-surface border border-terminal-border rounded-lg p-6"}, [__jacJsx("h3", {"className": "text-text-primary font-medium mb-4"}, ["By Level"]), __jacJsx("div", {"className": "grid grid-cols-5 gap-3"}, [levels.map(l => __jacJsx("div", {"key": l.get("level", ""), "className": "text-center"}, [__jacJsx("div", {"className": "text-lg font-mono text-text-primary"}, [String(l.get("count", 0))]), __jacJsx("div", {"className": "text-xs text-text-muted"}, [l.get("level", "")])]))])]), __jacJsx("div", {"className": "md:col-span-3 bg-terminal-surface border border-terminal-border rounded-lg p-6"}, [__jacJsx("h3", {"className": "text-text-primary font-medium mb-4"}, ["By Category"]), __jacJsx("div", {"className": "grid grid-cols-3 gap-3"}, [categories.map(c => __jacJsx("div", {"key": c.get("category", ""), "className": "flex justify-between items-center py-1 border-b border-terminal-border"}, [__jacJsx("span", {"className": "text-text-secondary text-sm"}, [c.get("category", "")]), __jacJsx("span", {"className": "text-text-primary font-mono text-sm"}, [String(c.get("count", 0))])]))])])]);
}
function DefinitionsTab(props) {
  setTests(props.get("tests", []));
  let total = props.get("total", 0);
  let page = props.get("page", 0);
  setPage_size(props.get("page_size", 25));
  return __jacJsx("div", {}, [__jacJsx("div", {"className": "flex gap-3 items-center mb-4 flex-wrap"}, [__jacJsx("input", {"type": "text", "value": props.get("search_query", ""), "onChange": e => {
    props["on_search"](e.target.value);
  }, "placeholder": "Search tests...", "className": "px-3 py-2 bg-terminal-bg border border-terminal-border rounded text-text-primary text-sm min-w-[200px]"}, []), __jacJsx("select", {"value": props.get("filter_level", ""), "onChange": e => {
    props["on_filter_level"](e.target.value);
  }, "className": "px-3 py-2 bg-terminal-bg border border-terminal-border rounded text-text-primary text-sm"}, [__jacJsx("option", {"value": ""}, ["All Levels"]), ["L1", "L2", "L3", "L4", "L5", "L6", "L7", "L8", "L9", "L10"].map(lv => __jacJsx("option", {"key": lv, "value": lv}, [lv]))]), __jacJsx("select", {"value": props.get("filter_category", ""), "onChange": e => {
    props["on_filter_category"](e.target.value);
  }, "className": "px-3 py-2 bg-terminal-bg border border-terminal-border rounded text-text-primary text-sm"}, [__jacJsx("option", {"value": ""}, ["All Categories"])]), __jacJsx("label", {"className": "flex items-center gap-2 text-text-muted text-sm"}, [__jacJsx("input", {"type": "checkbox", "checked": props.get("show_deleted", false), "onChange": props.get("on_toggle_deleted", e => {})}, []), "Show Deleted"]), __jacJsx("button", {"onClick": e => {
    props["on_edit"]({});
  }, "className": "btn btn-primary btn-sm ml-auto"}, ["New Test"])]), ((props.get("editing_test") === null) ? __jacJsx(TestEditor, {"test": props.get("editing_test", {}), "on_save": props.get("on_save"), "on_cancel": props.get("on_cancel_edit")}, []) : __jacJsx("span", {}, [])), __jacJsx("div", {"className": "bg-terminal-surface border border-terminal-border rounded-lg overflow-hidden"}, [__jacJsx("table", {"className": "w-full"}, [__jacJsx("thead", {}, [__jacJsx("tr", {"className": "border-b border-terminal-border"}, [__jacJsx("th", {"className": "px-3 py-2 text-left text-xs text-text-muted uppercase"}, ["ID"]), __jacJsx("th", {"className": "px-3 py-2 text-left text-xs text-text-muted uppercase"}, ["Task"]), __jacJsx("th", {"className": "px-3 py-2 text-left text-xs text-text-muted uppercase"}, ["Level"]), __jacJsx("th", {"className": "px-3 py-2 text-left text-xs text-text-muted uppercase"}, ["Category"]), __jacJsx("th", {"className": "px-3 py-2 text-right text-xs text-text-muted uppercase"}, ["Points"]), __jacJsx("th", {"className": "px-3 py-2 text-right text-xs text-text-muted uppercase"}, ["Actions"])])]), __jacJsx("tbody", {}, [enumerate(tests).map(x => __jacJsx("tr", {"key": t.get("test_id", String(i)), "className": ("border-b border-terminal-border " + (t.get("deleted", false) ? "opacity-50" : ""))}, [__jacJsx("td", {"className": "px-3 py-2 text-text-secondary text-xs font-mono"}, [t.get("test_id", "")]), __jacJsx("td", {"className": "px-3 py-2 text-text-primary text-sm truncate max-w-xs"}, [t.get("task", "")]), __jacJsx("td", {"className": "px-3 py-2 text-text-secondary text-sm"}, [t.get("level", "")]), __jacJsx("td", {"className": "px-3 py-2 text-text-secondary text-sm"}, [t.get("category", "")]), __jacJsx("td", {"className": "px-3 py-2 text-right text-text-secondary text-sm font-mono"}, [String(t.get("points", 0))]), __jacJsx("td", {"className": "px-3 py-2 text-right"}, [__jacJsx("div", {"className": "flex gap-1 justify-end"}, [__jacJsx("button", {"onClick": e => {
    props["on_edit"](t);
  }, "className": "text-terminal-accent text-xs hover:underline"}, ["Edit"]), (t.get("deleted", false) ? __jacJsx("button", {"onClick": e => {
    props["on_restore"](t.get("test_id", ""));
  }, "className": "text-green-400 text-xs hover:underline"}, ["Restore"]) : __jacJsx("button", {"onClick": e => {
    props["on_delete"](t.get("test_id", ""));
  }, "className": "text-red-400 text-xs hover:underline"}, ["Delete"]))])])]))])])]), ((total > page_size) ? __jacJsx("div", {"className": "flex justify-center gap-4 mt-4"}, [__jacJsx("button", {"onClick": e => {
    props["on_page_change"](max(0, (page - 1)));
  }, "disabled": (page === 0), "className": "btn btn-secondary btn-sm"}, ["Previous"]), __jacJsx("span", {"className": "text-text-muted text-sm self-center"}, ["Page ", String((page + 1)), "of ", String((((total + page_size) - 1) + page_size))]), __jacJsx("button", {"onClick": e => {
    props["on_page_change"]((page + 1));
  }, "disabled": (((page + 1) * page_size) >= total), "className": "btn btn-secondary btn-sm"}, ["Next"])]) : __jacJsx("span", {}, []))]);
}
function TestEditor(props) {
  let test_data = props.get("test", {});
  const [task_val, setTask_val] = useState(test_data.get("task", ""));
  const [level_val, setLevel_val] = useState(test_data.get("level", "L1"));
  const [category_val, setCategory_val] = useState(test_data.get("category", ""));
  const [points_val, setPoints_val] = useState(test_data.get("points", 1));
  const [prompt_val, setPrompt_val] = useState(test_data.get("prompt", ""));
  const [ref_code_val, setRef_code_val] = useState(test_data.get("reference_code", ""));
  return __jacJsx("div", {"className": "bg-terminal-surface border border-terminal-accent/30 rounded-lg p-4 mb-4"}, [__jacJsx("h3", {"className": "text-text-primary font-medium mb-3"}, [(test_data.get("id") ? "Edit Test" : "New Test")]), __jacJsx("div", {"className": "grid grid-cols-2 gap-3"}, [__jacJsx("div", {}, [__jacJsx("label", {"className": "block text-xs text-text-muted mb-1"}, ["Task"]), __jacJsx("input", {"type": "text", "value": task_val, "onChange": e => {
    setTask_val(e.target.value);
  }, "className": "w-full px-2 py-1 bg-terminal-bg border border-terminal-border rounded text-text-primary text-sm"}, [])]), __jacJsx("div", {"className": "flex gap-3"}, [__jacJsx("div", {"className": "flex-1"}, [__jacJsx("label", {"className": "block text-xs text-text-muted mb-1"}, ["Level"]), __jacJsx("select", {"value": level_val, "onChange": e => {
    setLevel_val(e.target.value);
  }, "className": "w-full px-2 py-1 bg-terminal-bg border border-terminal-border rounded text-text-primary text-sm"}, [["L1", "L2", "L3", "L4", "L5", "L6", "L7", "L8", "L9", "L10"].map(lv => __jacJsx("option", {"key": lv, "value": lv}, [lv]))])]), __jacJsx("div", {"className": "flex-1"}, [__jacJsx("label", {"className": "block text-xs text-text-muted mb-1"}, ["Category"]), __jacJsx("input", {"type": "text", "value": category_val, "onChange": e => {
    setCategory_val(e.target.value);
  }, "className": "w-full px-2 py-1 bg-terminal-bg border border-terminal-border rounded text-text-primary text-sm"}, [])]), __jacJsx("div", {"className": "w-20"}, [__jacJsx("label", {"className": "block text-xs text-text-muted mb-1"}, ["Points"]), __jacJsx("input", {"type": "number", "min": "1", "value": String(points_val), "onChange": e => {
    setPoints_val((e.target.value ? new func(e.target.value) : 1));
  }, "className": "w-full px-2 py-1 bg-terminal-bg border border-terminal-border rounded text-text-primary text-sm text-center"}, [])])]), __jacJsx("div", {"className": "col-span-2"}, [__jacJsx("label", {"className": "block text-xs text-text-muted mb-1"}, ["Prompt"]), __jacJsx("textarea", {"value": prompt_val, "onChange": e => {
    setPrompt_val(e.target.value);
  }, "rows": "3", "className": "w-full px-2 py-1 bg-terminal-bg border border-terminal-border rounded text-text-primary text-sm font-mono"}, [])]), __jacJsx("div", {"className": "col-span-2"}, [__jacJsx("label", {"className": "block text-xs text-text-muted mb-1"}, ["Reference Code"]), __jacJsx("textarea", {"value": ref_code_val, "onChange": e => {
    setRef_code_val(e.target.value);
  }, "rows": "4", "className": "w-full px-2 py-1 bg-terminal-bg border border-terminal-border rounded text-text-primary text-sm font-mono"}, [])])]), __jacJsx("div", {"className": "flex gap-2 mt-3 justify-end"}, [__jacJsx("button", {"onClick": props.get("on_cancel"), "className": "btn btn-ghost btn-sm"}, ["Cancel"]), __jacJsx("button", {"onClick": e => {
    props["on_save"]({"id": test_data.get("id", ""), "task": task_val, "level": level_val, "category": category_val, "points": points_val, "prompt": prompt_val, "reference_code": ref_code_val});
  }, "className": "btn btn-primary btn-sm"}, ["Save"])])]);
}
function PublicSuiteTab(props) {
  setPublic_test_ids(props.get("public_test_ids", []));
  setBenchmark_models(props.get("benchmark_models", []));
  return __jacJsx("div", {"className": "grid grid-cols-1 lg:grid-cols-2 gap-6"}, [__jacJsx("div", {}, [__jacJsx("div", {"className": "bg-terminal-surface border border-terminal-border rounded-lg p-4"}, [__jacJsx("h3", {"className": "text-text-primary font-medium mb-3"}, ["Public Test IDs (", String(public_test_ids.length), ")"]), __jacJsx("p", {"className": "text-text-muted text-xs mb-3"}, ["Tests included in the public benchmark suite."]), __jacJsx("div", {"className": "max-h-96 overflow-y-auto space-y-1"}, [public_test_ids.map(tid => __jacJsx("div", {"key": tid, "className": "flex items-center justify-between py-1 px-2 bg-terminal-bg rounded"}, [__jacJsx("span", {"className": "text-text-secondary text-xs font-mono"}, [tid]), __jacJsx("button", {"onClick": e => {
    props["on_toggle_test"](tid);
  }, "className": "text-red-400 text-xs"}, ["Remove"])]))])])]), __jacJsx("div", {}, [__jacJsx("div", {"className": "bg-terminal-surface border border-terminal-border rounded-lg p-4"}, [__jacJsx("h3", {"className": "text-text-primary font-medium mb-3"}, ["Benchmark Models (", String(benchmark_models.length), ")"]), __jacJsx("div", {"className": "flex gap-2 mb-4"}, [__jacJsx("input", {"type": "text", "value": props.get("new_model_id", ""), "onChange": e => {
    props["on_model_id_change"](e.target.value);
  }, "placeholder": "model-id", "className": "flex-1 px-2 py-1 bg-terminal-bg border border-terminal-border rounded text-text-primary text-sm"}, []), __jacJsx("input", {"type": "text", "value": props.get("new_model_name", ""), "onChange": e => {
    props["on_model_name_change"](e.target.value);
  }, "placeholder": "Display Name", "className": "flex-1 px-2 py-1 bg-terminal-bg border border-terminal-border rounded text-text-primary text-sm"}, []), __jacJsx("button", {"onClick": e => {
    props["on_add_model"]();
  }, "className": "btn btn-primary btn-sm"}, ["Add"])]), __jacJsx("div", {"className": "space-y-2"}, [benchmark_models.map(m => __jacJsx("div", {"key": m.get("model_id", ""), "className": "flex items-center justify-between py-2 px-3 bg-terminal-bg rounded"}, [__jacJsx("div", {}, [__jacJsx("div", {"className": "text-text-primary text-sm"}, [m.get("display_name", m.get("model_id", ""))]), __jacJsx("div", {"className": "text-text-muted text-xs font-mono"}, [m.get("model_id", "")])]), __jacJsx("div", {"className": "flex gap-2 items-center"}, [__jacJsx("button", {"onClick": e => {
    props["on_toggle_model"](m.get("model_id", ""));
  }, "className": (m.get("active", true) ? "px-2 py-1 text-xs rounded bg-green-600/20 text-green-400" : "px-2 py-1 text-xs rounded bg-terminal-border text-text-muted")}, [(m.get("active", true) ? "Active" : "Inactive")]), __jacJsx("button", {"onClick": e => {
    props["on_remove_model"](m.get("model_id", ""));
  }, "className": "text-red-400 text-xs"}, ["Remove"])])]))])])])]);
}
export {DefinitionsTab, OverviewTab, PublicSuiteTab, TestEditor, TestsView};