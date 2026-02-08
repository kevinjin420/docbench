/* Source: /home/kevinjin/jaseci-docbench/ui/views/leaderboard.cl.jac */
import {__jacJsx, __jacSpawn} from "@jac/runtime";
import { useEffect } from "react";
import { useState } from "@jac/runtime";
function LeaderboardView() {
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [is_loading, setIs_loading] = useState(true);
  const [current_page, setCurrent_page] = useState(0);
  const [page_size, setPage_size] = useState(25);
  useEffect(() => {
    fetch_entries();
  }, []);
  async function fetch_entries() {
    setIs_loading(true);
    let result = await __jacSpawn("GetLeaderboard", "", {"limit": page_size, "offset": (current_page * page_size)});
    if (result.reports) {
      let data = result.reports[0];
      setEntries(data.get("entries", []));
      setTotal(data.get("total", 0));
    }
    setIs_loading(false);
  }
  if (is_loading) {
    return __jacJsx("div", {"className": "text-center py-20"}, [__jacJsx("p", {"className": "text-text-secondary"}, ["Loading leaderboard..."])]);
  }
  return __jacJsx("div", {"className": "max-w-6xl mx-auto"}, [__jacJsx("div", {"className": "flex justify-between items-center mb-8"}, [__jacJsx("h1", {"className": "text-3xl font-bold text-text-primary"}, ["Leaderboard"]), __jacJsx("button", {"onClick": e => {
    fetch_entries();
  }, "className": "btn btn-secondary"}, ["Refresh"])]), ((entries.length >= 3) ? __jacJsx("div", {"className": "grid grid-cols-3 gap-4 mb-8"}, [range(min(3, entries.length)).map(i => __jacJsx(PodiumCard, {"entry": entries[i], "rank": (i + 1), "key": String(i)}, []))]) : __jacJsx("span", {}, [])), __jacJsx("div", {"className": "bg-terminal-surface border border-terminal-border rounded-lg overflow-hidden"}, [__jacJsx("table", {"className": "w-full"}, [__jacJsx("thead", {}, [__jacJsx("tr", {"className": "border-b border-terminal-border"}, [__jacJsx("th", {"className": "px-4 py-3 text-left text-xs text-text-muted uppercase"}, ["Rank"]), __jacJsx("th", {"className": "px-4 py-3 text-left text-xs text-text-muted uppercase"}, ["Documentation"]), __jacJsx("th", {"className": "px-4 py-3 text-left text-xs text-text-muted uppercase"}, ["Model"]), __jacJsx("th", {"className": "px-4 py-3 text-right text-xs text-text-muted uppercase"}, ["Score"]), __jacJsx("th", {"className": "px-4 py-3 text-right text-xs text-text-muted uppercase"}, ["Percentage"])])]), __jacJsx("tbody", {}, [enumerate(entries).map(x => __jacJsx("tr", {"key": String(i), "className": "border-b border-terminal-border hover:bg-terminal-elevated"}, [__jacJsx("td", {"className": "px-4 py-3 text-text-secondary font-mono"}, [String((((current_page * page_size) + i) + 1))]), __jacJsx("td", {"className": "px-4 py-3"}, [__jacJsx("div", {"className": "text-text-primary font-medium"}, [entry.get("documentation_name", "")]), __jacJsx("div", {"className": "text-xs text-text-muted truncate max-w-xs"}, [entry.get("documentation_url", "")])]), __jacJsx("td", {"className": "px-4 py-3 text-text-secondary text-sm"}, [entry.get("model_used", "")]), __jacJsx("td", {"className": "px-4 py-3 text-right font-mono text-text-secondary"}, [((String(entry.get("total_score", 0)) + "/") + String(entry.get("max_score", 0)))]), __jacJsx("td", {"className": "px-4 py-3 text-right"}, [__jacJsx("div", {"className": "flex items-center justify-end gap-2"}, [__jacJsx("div", {"className": "w-24 bg-terminal-bg rounded-full h-2 overflow-hidden"}, [__jacJsx("div", {"className": "h-full bg-terminal-accent rounded-full", "style": (("width: " + String(entry.get("percentage", 0))) + "%")}, [])]), __jacJsx("span", {"className": "font-mono text-terminal-accent font-medium"}, [(String(entry.get("percentage", 0)) + "%")])])])]))])])]), ((total > page_size) ? __jacJsx("div", {"className": "flex justify-center gap-4 mt-6"}, [__jacJsx("button", {"onClick": e => {
    setCurrent_page(max(0, (current_page - 1)));
    fetch_entries();
  }, "disabled": (current_page === 0), "className": "btn btn-secondary btn-sm"}, ["Previous"]), __jacJsx("span", {"className": "text-text-muted text-sm self-center"}, [((("Page " + String((current_page + 1))) + " of ") + String((((total + page_size) - 1) + page_size)))]), __jacJsx("button", {"onClick": e => {
    setCurrent_page((current_page + 1));
    fetch_entries();
  }, "disabled": (((current_page + 1) * page_size) >= total), "className": "btn btn-secondary btn-sm"}, ["Next"])]) : __jacJsx("span", {}, []))]);
}
function PodiumCard(props) {
  let entry = props["entry"];
  let rank = props["rank"];
  let colors = ["text-yellow-400", "text-gray-400", "text-amber-600"];
  let bg_colors = ["border-yellow-600/30", "border-gray-600/30", "border-amber-600/30"];
  return __jacJsx("div", {"className": ("bg-terminal-surface border rounded-lg p-6 text-center " + bg_colors[(rank - 1)])}, [__jacJsx("div", {"className": ("text-4xl font-bold mb-2 " + colors[(rank - 1)])}, [("#" + String(rank))]), __jacJsx("h3", {"className": "text-text-primary font-semibold text-lg mb-1 truncate"}, [entry.get("documentation_name", "")]), __jacJsx("p", {"className": "text-text-muted text-sm mb-3"}, [entry.get("model_used", "")]), __jacJsx("div", {"className": "text-3xl font-bold text-terminal-accent font-mono"}, [(String(entry.get("percentage", 0)) + "%")])]);
}
export {LeaderboardView, PodiumCard};