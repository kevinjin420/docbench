/* Source: /home/kevinjin/jaseci-docbench/ui/views/variants.cl.jac */
import {__jacJsx, __jacSpawn} from "@jac/runtime";
import { useEffect } from "react";
import { useState } from "@jac/runtime";
function VariantsView(props) {
  const [variants, setVariants] = useState([]);
  const [new_name, setNew_name] = useState("");
  const [new_url, setNew_url] = useState("");
  const [is_loading, setIs_loading] = useState(true);
  const [error_msg, setError_msg] = useState("");
  useEffect(() => {
    refresh();
  }, []);
  async function refresh() {
    setIs_loading(true);
    let result = await __jacSpawn("ListVariants", "", {});
    if (result.reports) {
      setVariants((result.reports[0]["variants"] || []));
    }
    setIs_loading(false);
  }
  async function add_variant() {
    if ((!new_name.trim() || !new_url.trim())) {
      setError_msg("Name and URL are required.");
      return;
    }
    setError_msg("");
    let result = await __jacSpawn("CreateVariant", "", {"variant_name": new_name, "url": new_url});
    if (result.reports) {
      let data = result.reports[0];
      if (("error" in data)) {
        setError_msg(data["error"]);
        return;
      }
    }
    setNew_name("");
    setNew_url("");
    await refresh();
  }
  async function remove_variant(name) {
    let result = await __jacSpawn("DeleteVariant", "", {"variant_name": name});
    await refresh();
  }
  if (is_loading) {
    return __jacJsx("div", {"className": "text-center py-20"}, [__jacJsx("p", {"className": "text-text-secondary"}, ["Loading variants..."])]);
  }
  return __jacJsx("div", {"className": "max-w-4xl mx-auto"}, [__jacJsx("h1", {"className": "text-3xl font-bold text-text-primary mb-6"}, ["Documentation Variants"]), __jacJsx("div", {"className": "bg-terminal-surface border border-terminal-border rounded-lg p-6 mb-6"}, [__jacJsx("h2", {"className": "text-lg font-semibold text-text-primary mb-4"}, ["Add New Variant"]), __jacJsx("div", {"className": "space-y-3"}, [__jacJsx("div", {}, [__jacJsx("label", {"className": "block text-sm text-text-secondary mb-1"}, ["Name"]), __jacJsx("input", {"type": "text", "value": new_name, "onChange": e => {
    setNew_name(e.target.value);
  }, "placeholder": "e.g. official-v2", "className": "w-full px-3 py-2 bg-terminal-bg border border-terminal-border rounded text-text-primary text-sm"}, [])]), __jacJsx("div", {}, [__jacJsx("label", {"className": "block text-sm text-text-secondary mb-1"}, ["Documentation URL"]), __jacJsx("input", {"type": "url", "value": new_url, "onChange": e => {
    setNew_url(e.target.value);
  }, "placeholder": "https://example.com/jac-docs.md", "className": "w-full px-3 py-2 bg-terminal-bg border border-terminal-border rounded text-text-primary text-sm"}, [])]), (error_msg ? __jacJsx("p", {"className": "text-red-400 text-xs"}, [error_msg]) : __jacJsx("span", {}, [])), __jacJsx("button", {"onClick": e => {
    add_variant();
  }, "className": "btn btn-primary"}, ["Add Variant"])])]), __jacJsx("div", {"className": "bg-terminal-surface border border-terminal-border rounded-lg overflow-hidden"}, [__jacJsx("div", {"className": "px-4 py-3 border-b border-terminal-border"}, [__jacJsx("h3", {"className": "text-text-primary font-medium"}, ["Variants (", String(variants.length), ")"])]), ((variants.length > 0) ? __jacJsx("div", {}, [variants.map(v => __jacJsx("div", {"key": v["variant_name"], "className": "px-4 py-3 border-b border-terminal-border flex items-center justify-between"}, [__jacJsx("div", {}, [__jacJsx("div", {"className": "text-text-primary font-medium"}, [v["variant_name"]]), __jacJsx("div", {"className": "text-text-muted text-xs truncate max-w-md"}, [(v["url"] || "")])]), __jacJsx("button", {"onClick": e => {
    remove_variant(v["variant_name"]);
  }, "className": "btn btn-danger btn-sm"}, ["Delete"])]))]) : __jacJsx("div", {"className": "p-8 text-center"}, [__jacJsx("p", {"className": "text-text-muted"}, ["No documentation variants configured."])]))])]);
}
export {VariantsView};