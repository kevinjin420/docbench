/* Source: /home/kevinjin/jaseci-docbench/ui/app.cl.jac */
import {__jacJsx, __jacSpawn} from "@jac/runtime";
import { useEffect } from "react";
import "./styles.css";
import { HomeView } from "./views/home.js";
import { LeaderboardView } from "./views/leaderboard.js";
import { PublicBenchmarkView } from "./views/public_benchmark.js";
import { BenchmarkView } from "./views/benchmark.js";
import { FileManagerView } from "./views/file_manager.js";
import { VariantsView } from "./views/variants.js";
import { TestsView } from "./views/tests.js";
import { UsersView } from "./views/users.js";
import { AuthCallbackView } from "./views/auth_callback.js";
import { useState } from "@jac/runtime";
function App() {
  const [models, setModels] = useState([]);
  const [variants, setVariants] = useState([]);
  const [user, setUser] = useState(null);
  const [api_key, setApi_key] = useState("");
  const [is_loading, setIs_loading] = useState(true);
  const [test_files, setTest_files] = useState([]);
  const [stashes, setStashes] = useState([]);
  async function initApp() {
    try {
      let token = localStorage.getItem("jwt_token");
      if (token) {
        let result = await __jacSpawn("VerifyToken", "", {"token": token});
        if ((result.reports && result.reports[0]["valid"])) {
          let user_result = await __jacSpawn("GetCurrentUser", "", {"token": token});
          if (user_result.reports) {
            setUser(user_result.reports[0]);
          }
        }
      }
    } catch (e) {}
    try {
      let saved_key = (localStorage.getItem("openRouterApiKey") || "");
      if (saved_key) {
        setApi_key(saved_key);
        let model_result = await __jacSpawn("ListModels", "", {"api_key": saved_key});
        if (model_result.reports) {
          setModels(model_result.reports[0]["models"]);
        }
      }
    } catch (e) {}
    try {
      let variant_result = await __jacSpawn("ListVariants", "", {});
      if (variant_result.reports) {
        setVariants(variant_result.reports[0]["variants"]);
      }
    } catch (e) {}
    try {
      if ((user && user["is_admin"])) {
        let files_result = await __jacSpawn("ListTestFiles", "", {});
        if (files_result.reports) {
          setTest_files(files_result.reports[0]["files"]);
        }
        let stash_result = await __jacSpawn("ListStashes", "", {});
        if (stash_result.reports) {
          setStashes(stash_result.reports[0]["stashes"]);
        }
      }
    } catch (e) {}
    setIs_loading(false);
  }
  useEffect(() => {
    initApp();
  }, []);
  function handle_logout() {
    localStorage.removeItem("jwt_token");
    setUser(null);
  }
  function handle_api_key_change(key) {
    setApi_key(key);
    if (key) {
      localStorage.setItem("openRouterApiKey", key);
    } else {
      localStorage.removeItem("openRouterApiKey");
    }
  }
  if (is_loading) {
    return __jacJsx("div", {"className": "min-h-screen flex items-center justify-center bg-terminal-bg"}, [__jacJsx("div", {"className": "text-center"}, [__jacJsx("p", {"className": "text-text-secondary"}, ["Loading DocBench..."])])]);
  }
  return __jacJsx("div", {"className": "min-h-screen flex flex-col bg-terminal-bg text-text-primary"}, [__jacJsx("header", {"className": "bg-terminal-surface border-b border-terminal-border px-8 py-5"}, [__jacJsx("div", {"className": "max-w-screen-2xl mx-auto flex justify-between items-center"}, [__jacJsx("a", {"href": "/", "className": "flex items-center gap-3 hover:opacity-80 transition-opacity"}, [__jacJsx("h1", {"className": "text-text-primary text-xl font-semibold tracking-tight"}, ["Jaseci ", __jacJsx("span", {"className": "text-terminal-accent"}, ["DocBench"])])]), __jacJsx("nav", {"className": "flex gap-2 items-center"}, [__jacJsx("a", {"href": "/leaderboard", "className": "btn btn-secondary"}, ["Leaderboard"]), __jacJsx("a", {"href": "/submit", "className": "btn btn-secondary"}, ["Submit"]), __jacJsx("span", {"className": "border-l border-terminal-border mx-2 h-6"}, []), (user ? __jacJsx(UserMenuComponent, {"user": user, "on_logout": handle_logout}, []) : __jacJsx(LoginButtonComponent, {}, [])), __jacJsx(ApiKeyDropdown, {"api_key": api_key, "on_change": handle_api_key_change, "has_models": (models.length > 0)}, []), ((user && user["is_admin"]) ? __jacJsx(AdminDropdown, {"test_files_count": test_files.length, "variants_count": variants.length}, []) : __jacJsx("span", {}, []))])])]), __jacJsx("main", {"className": "flex-1 p-8"}, [__jacJsx("div", {"className": "max-w-screen-2xl mx-auto"}, [__jacJsx(RouterOutlet, {"models": models, "variants": variants, "user": user, "api_key": api_key, "test_files": test_files, "stashes": stashes}, [])])])]);
}
function LoginButtonComponent() {
  async function handle_login() {
    let result = await __jacSpawn("GitHubLogin", "", {});
    if (result.reports) {
      window.location.href = result.reports[0]["authorization_url"];
    }
  }
  return __jacJsx("button", {"onClick": e => {
    handle_login();
  }, "className": "btn btn-secondary flex items-center gap-2"}, ["Sign in with GitHub"]);
}
function UserMenuComponent(props) {
  const [is_open, setIs_open] = useState(false);
  return __jacJsx("div", {"className": "relative"}, [__jacJsx("button", {"onClick": e => {
    setIs_open(!is_open);
  }, "className": "flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors"}, [(props["user"]["avatar_url"] ? __jacJsx("img", {"src": props["user"]["avatar_url"], "alt": "", "className": "w-8 h-8 rounded-full"}, []) : __jacJsx("div", {"className": "w-8 h-8 rounded-full bg-terminal-accent-muted"}, [])), __jacJsx("span", {"className": "text-sm text-gray-300 max-w-[120px] truncate"}, [((props["user"]["name"] || props["user"]["email"]) || "User")])]), (is_open ? __jacJsx("div", {"className": "absolute right-0 top-full mt-2 w-56 bg-terminal-surface border border-terminal-border rounded-lg shadow-xl z-50 overflow-hidden"}, [__jacJsx("div", {"className": "p-3 border-b border-terminal-border"}, [__jacJsx("p", {"className": "text-sm font-medium text-gray-200"}, [(props["user"]["name"] || "User")]), __jacJsx("p", {"className": "text-xs text-gray-500"}, [(props["user"]["email"] || "")])]), __jacJsx("div", {"className": "py-1"}, [__jacJsx("button", {"onClick": e => {
    setIs_open(false);
    props["on_logout"]();
  }, "className": "flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-400 hover:bg-red-950 transition-colors"}, ["Sign Out"])])]) : __jacJsx("span", {}, []))]);
}
function ApiKeyDropdown(props) {
  const [is_open, setIs_open] = useState(false);
  const [input_val, setInput_val] = useState((props["api_key"] || ""));
  return __jacJsx("div", {"className": "relative"}, [__jacJsx("button", {"onClick": e => {
    setIs_open(!is_open);
  }, "className": (props["has_models"] ? "btn btn-icon btn-success" : "btn btn-icon btn-secondary"), "title": "Configure API Key"}, ["Key"]), (is_open ? __jacJsx("div", {"className": "absolute right-0 top-full mt-2 w-80 bg-terminal-surface border border-terminal-border rounded-lg shadow-xl z-50 overflow-hidden"}, [__jacJsx("div", {"className": "p-3 border-b border-terminal-border"}, [__jacJsx("span", {"className": "text-xs text-text-muted uppercase tracking-wide"}, ["OpenRouter API Key"])]), __jacJsx("div", {"className": "p-4 space-y-3"}, [__jacJsx("input", {"type": "password", "value": input_val, "onChange": e => {
    setInput_val(e.target.value);
    props["on_change"](e.target.value);
  }, "placeholder": "sk-or-...", "className": "w-full px-3 py-2 bg-terminal-elevated border border-terminal-border rounded text-text-primary text-sm focus:outline-none focus:border-terminal-accent"}, []), __jacJsx("div", {"className": "flex items-center gap-2"}, [(props["has_models"] ? __jacJsx("span", {"className": "text-xs text-green-400"}, ["Connected"]) : __jacJsx("span", {"className": "text-xs text-text-muted"}, ["Not configured"]))]), __jacJsx("p", {"className": "text-xs text-text-muted"}, ["Get your API key from openrouter.ai/keys"])])]) : __jacJsx("span", {}, []))]);
}
function AdminDropdown(props) {
  const [is_open, setIs_open] = useState(false);
  return __jacJsx("div", {"className": "relative"}, [__jacJsx("button", {"onClick": e => {
    setIs_open(!is_open);
  }, "className": "btn btn-accent flex items-center gap-2"}, ["Admin"]), (is_open ? __jacJsx("div", {"className": "absolute right-0 top-full mt-2 w-48 bg-terminal-surface border border-terminal-border rounded-lg shadow-xl z-50 overflow-hidden"}, [__jacJsx("div", {"className": "py-1"}, [__jacJsx("a", {"href": "/benchmark", "className": "block px-4 py-2.5 text-sm text-gray-300 hover:bg-zinc-800"}, ["Benchmark"]), __jacJsx("a", {"href": "/files", "className": "block px-4 py-2.5 text-sm text-gray-300 hover:bg-zinc-800"}, [((props["test_files_count"] > 0) ? (("Files (" + String(props["test_files_count"])) + ")") : "Files")]), __jacJsx("a", {"href": "/variants", "className": "block px-4 py-2.5 text-sm text-gray-300 hover:bg-zinc-800"}, [((props["variants_count"] > 0) ? (("Variants (" + String(props["variants_count"])) + ")") : "Variants")]), __jacJsx("a", {"href": "/tests", "className": "block px-4 py-2.5 text-sm text-gray-300 hover:bg-zinc-800"}, ["Tests"]), __jacJsx("a", {"href": "/users", "className": "block px-4 py-2.5 text-sm text-gray-300 hover:bg-zinc-800"}, ["Users"])])]) : __jacJsx("span", {}, []))]);
}
function RouterOutlet(props) {
  const [current_path, setCurrent_path] = useState(window.location.pathname);
  if (((current_path === "/") || (current_path === ""))) {
    return __jacJsx(HomeView, {}, []);
  } else if ((current_path === "/leaderboard")) {
    return __jacJsx(LeaderboardView, {}, []);
  } else if ((current_path === "/submit")) {
    return __jacJsx(PublicBenchmarkView, {"api_key": (props["api_key"] || "")}, []);
  } else if ((current_path === "/auth/callback")) {
    return __jacJsx(AuthCallbackView, {}, []);
  } else if ((current_path === "/benchmark")) {
    return __jacJsx(BenchmarkView, {"models": (props["models"] || []), "variants": (props["variants"] || []), "api_key": (props["api_key"] || "")}, []);
  } else if ((current_path === "/files")) {
    return __jacJsx(FileManagerView, {"files": (props["test_files"] || []), "stashes": (props["stashes"] || [])}, []);
  } else if ((current_path === "/variants")) {
    return __jacJsx(VariantsView, {"variants": (props["variants"] || [])}, []);
  } else if ((current_path === "/tests")) {
    return __jacJsx(TestsView, {}, []);
  } else if ((current_path === "/users")) {
    return __jacJsx(UsersView, {}, []);
  } else {
    return __jacJsx("div", {"className": "text-center py-20"}, [__jacJsx("h2", {"className": "text-2xl text-text-primary"}, ["Page Not Found"])]);
  }
}
export {AdminDropdown, ApiKeyDropdown, App, LoginButtonComponent, RouterOutlet, UserMenuComponent};