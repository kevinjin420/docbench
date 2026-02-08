/* Source: /home/kevinjin/jaseci-docbench/ui/views/users.cl.jac */
import {__jacJsx, __jacSpawn} from "@jac/runtime";
import { useEffect } from "react";
import { useState } from "@jac/runtime";
function UsersView() {
  const [users, setUsers] = useState([]);
  const [admin_emails, setAdmin_emails] = useState([]);
  const [new_email, setNew_email] = useState("");
  const [is_loading, setIs_loading] = useState(true);
  useEffect(() => {
    refresh();
  }, []);
  async function refresh() {
    setIs_loading(true);
    let user_result = await __jacSpawn("AdminListUsers", "", {});
    if (user_result.reports) {
      setUsers((user_result.reports[0]["users"] || []));
    }
    let email_result = await __jacSpawn("AdminListEmails", "", {});
    if (email_result.reports) {
      setAdmin_emails((email_result.reports[0]["emails"] || []));
    }
    setIs_loading(false);
  }
  async function toggle_admin(user_id, make_admin) {
    let result = await __jacSpawn("AdminSetAdmin", "", {"user_id": user_id, "is_admin": make_admin});
    await refresh();
  }
  async function add_email() {
    if (!new_email.trim()) {
      return;
    }
    let result = await __jacSpawn("AdminAddEmail", "", {"email": new_email});
    setNew_email("");
    await refresh();
  }
  async function remove_email(email) {
    let result = await __jacSpawn("AdminRemoveEmail", "", {"email": email});
    await refresh();
  }
  if (is_loading) {
    return __jacJsx("div", {"className": "text-center py-20"}, [__jacJsx("p", {"className": "text-text-secondary"}, ["Loading..."])]);
  }
  return __jacJsx("div", {"className": "max-w-6xl mx-auto"}, [__jacJsx("h1", {"className": "text-3xl font-bold text-text-primary mb-6"}, ["User Management"]), __jacJsx("div", {"className": "grid grid-cols-1 lg:grid-cols-3 gap-6"}, [__jacJsx("div", {"className": "lg:col-span-2"}, [__jacJsx("div", {"className": "bg-terminal-surface border border-terminal-border rounded-lg overflow-hidden"}, [__jacJsx("div", {"className": "px-4 py-3 border-b border-terminal-border"}, [__jacJsx("h3", {"className": "text-text-primary font-medium"}, ["Users (", String(users.length), ")"])]), __jacJsx("table", {"className": "w-full"}, [__jacJsx("thead", {}, [__jacJsx("tr", {"className": "border-b border-terminal-border"}, [__jacJsx("th", {"className": "px-4 py-2 text-left text-xs text-text-muted uppercase"}, ["User"]), __jacJsx("th", {"className": "px-4 py-2 text-left text-xs text-text-muted uppercase"}, ["Email"]), __jacJsx("th", {"className": "px-4 py-2 text-center text-xs text-text-muted uppercase"}, ["Admin"])])]), __jacJsx("tbody", {}, [users.map(u => __jacJsx("tr", {"key": (u["id"] || String(users.indexOf(u))), "className": "border-b border-terminal-border"}, [__jacJsx("td", {"className": "px-4 py-3"}, [__jacJsx("div", {"className": "flex items-center gap-3"}, [((u["avatar_url"] || "") ? __jacJsx("img", {"src": u["avatar_url"], "className": "w-8 h-8 rounded-full"}, []) : __jacJsx("div", {"className": "w-8 h-8 rounded-full bg-terminal-accent-muted"}, [])), __jacJsx("span", {"className": "text-text-primary text-sm"}, [(u["username"] || "")])])]), __jacJsx("td", {"className": "px-4 py-3 text-text-secondary text-sm"}, [(u["email"] || "")]), __jacJsx("td", {"className": "px-4 py-3 text-center"}, [__jacJsx("button", {"onClick": e => {
    toggle_admin((u["id"] || ""), !(u["is_admin"] || false));
  }, "className": ((u["is_admin"] || false) ? "px-2 py-1 text-xs rounded bg-terminal-accent text-white" : "px-2 py-1 text-xs rounded bg-terminal-bg text-text-muted border border-terminal-border")}, [((u["is_admin"] || false) ? "Admin" : "User")])])]))])]), ((users.length === 0) ? __jacJsx("div", {"className": "p-8 text-center"}, [__jacJsx("p", {"className": "text-text-muted text-sm"}, ["No users registered."])]) : __jacJsx("span", {}, []))])]), __jacJsx("div", {}, [__jacJsx("div", {"className": "bg-terminal-surface border border-terminal-border rounded-lg p-4"}, [__jacJsx("h3", {"className": "text-text-primary font-medium mb-4"}, ["Admin Emails"]), __jacJsx("p", {"className": "text-text-muted text-xs mb-3"}, ["Users with these emails get admin access on login."]), __jacJsx("div", {"className": "flex gap-2 mb-4"}, [__jacJsx("input", {"type": "email", "value": new_email, "onChange": e => {
    setNew_email(e.target.value);
  }, "placeholder": "user@example.com", "className": "flex-1 px-2 py-1 bg-terminal-bg border border-terminal-border rounded text-text-primary text-sm"}, []), __jacJsx("button", {"onClick": e => {
    add_email();
  }, "className": "btn btn-primary btn-sm"}, ["Add"])]), __jacJsx("div", {"className": "space-y-2"}, [admin_emails.map(em => __jacJsx("div", {"key": em, "className": "flex items-center justify-between py-1"}, [__jacJsx("span", {"className": "text-text-secondary text-sm truncate"}, [em]), __jacJsx("button", {"onClick": e => {
    remove_email(em);
  }, "className": "text-red-400 text-xs hover:text-red-300"}, ["Remove"])])), ((admin_emails.length === 0) ? __jacJsx("p", {"className": "text-text-muted text-xs text-center py-2"}, ["No admin emails configured."]) : __jacJsx("span", {}, []))])])])])]);
}
export {UsersView};