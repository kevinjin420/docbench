/* Source: /home/kevinjin/jaseci-docbench/ui/views/auth_callback.cl.jac */
import {__jacJsx, __jacSpawn} from "@jac/runtime";
import { useEffect } from "react";
import { useState } from "@jac/runtime";
function AuthCallbackView() {
  const [status, setStatus] = useState("Processing login...");
  async function handleCallback() {
    let search = (window.location.search || "");
    if (!search) {
      setStatus("No parameters received.");
      return;
    }
    let token = "";
    let code = "";
    let state = "";
    let error_param = "";
    let return_url = "/";
    let raw = search.substring(1);
    let pairs = raw.split("&");
    let i = 0;
    while ((i < pairs.length)) {
      let kv = pairs[i].split("=");
      let key = kv[0];
      let val = decodeURIComponent((kv[1] || ""));
      if ((key === "token")) {
        token = val;
      }
      if ((key === "code")) {
        code = val;
      }
      if ((key === "state")) {
        state = val;
      }
      if ((key === "error")) {
        error_param = val;
      }
      if ((key === "return_url")) {
        return_url = val;
      }
      i += 1;
    }
    if (error_param) {
      setStatus(("Login failed: " + error_param));
      return;
    }
    if (token) {
      localStorage.setItem("jwt_token", token);
      window.location.href = return_url;
      return;
    }
    if (code) {
      setStatus("Exchanging code...");
      try {
        let result = await __jacSpawn("GitHubCallback", "", {"code": code, "state": state});
        if ((result.reports && result.reports[0]["token"])) {
          let jwt = result.reports[0]["token"];
          localStorage.setItem("jwt_token", jwt);
          window.location.href = return_url;
        } else {
          let err_msg = "";
          if (result.reports) {
            err_msg = (result.reports[0]["error"] || "Unknown error");
          } else {
            err_msg = "No response from server";
          }
          setStatus(("Login failed: " + err_msg));
        }
      } catch (e) {
        setStatus(("Login failed: " + String(e)));
      }
      return;
    }
    setStatus("No token or code received. Please try again.");
  }
  useEffect(() => {
    handleCallback();
  }, []);
  return __jacJsx("div", {"className": "flex items-center justify-center min-h-[60vh]"}, [__jacJsx("div", {"className": "bg-terminal-surface border border-terminal-border rounded-lg p-8 text-center max-w-sm"}, [__jacJsx("p", {"className": "text-text-primary"}, [status]), __jacJsx("a", {"href": "/", "className": "text-terminal-accent text-sm mt-4 inline-block hover:underline"}, ["Return Home"])])]);
}
export {AuthCallbackView};