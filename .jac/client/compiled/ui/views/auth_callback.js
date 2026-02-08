/* Source: /home/kevinjin/jaseci-docbench/ui/views/auth_callback.cl.jac */
import {__jacJsx, __jacSpawn} from "@jac/runtime";
import { useEffect } from "react";
import { useState } from "@jac/runtime";
function AuthCallbackView() {
  const [status, setStatus] = useState("Processing login...");
  useEffect(() => {
    let params = URLSearchParams(window.location.search);
    let token = (params.get("token") || "");
    let error = (params.get("error") || "");
    let return_url = (params.get("return_url") || "/");
    if (error) {
      setStatus(("Login failed: " + error));
    } else if (token) {
      localStorage.setItem("auth_token", token);
      window.location.href = return_url;
    } else {
      setStatus("No token received. Please try again.");
    }
  }, []);
  return __jacJsx("div", {"className": "flex items-center justify-center min-h-[60vh]"}, [__jacJsx("div", {"className": "bg-terminal-surface border border-terminal-border rounded-lg p-8 text-center max-w-sm"}, [__jacJsx("p", {"className": "text-text-primary"}, [status]), __jacJsx("a", {"href": "/", "className": "text-terminal-accent text-sm mt-4 inline-block hover:underline"}, ["Return Home"])])]);
}
export {AuthCallbackView};