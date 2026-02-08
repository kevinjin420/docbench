import * as React from "react";
import { useState as reactUseState, useEffect as reactUseEffect } from "react";
import * as ReactDOM from "react-dom/client";
import { BrowserRouter as ReactRouterBrowserRouter, Routes as ReactRouterRoutes, Route as ReactRouterRoute, Link as ReactRouterLink, Navigate as ReactRouterNavigate, useNavigate as reactRouterUseNavigate, useLocation as reactRouterUseLocation, useParams as reactRouterUseParams } from "react-router-dom";
import { ErrorBoundary } from "react-error-boundary";
function __jacJsx(tag, props, children) {
  if ((tag === null)) {
    tag = React.Fragment;
  }
  let childrenArray = [];
  if ((children !== null)) {
    if (Array.isArray(children)) {
      childrenArray = children;
    } else {
      childrenArray = [children];
    }
  }
  let reactChildren = [];
  for (const child of childrenArray) {
    if ((child !== null)) {
      reactChildren.push(child);
    }
  }
  if ((reactChildren.length > 0)) {
    let args = [tag, props];
    for (const child of reactChildren) {
      args.push(child);
    }
    return React.createElement.apply(React, args);
  } else {
    return React.createElement(tag, props);
  }
}
let useState = reactUseState;
let useEffect = reactUseEffect;
let Router = ReactRouterBrowserRouter;
let Routes = ReactRouterRoutes;
let Route = ReactRouterRoute;
let Link = ReactRouterLink;
let Navigate = ReactRouterNavigate;
let useNavigate = reactRouterUseNavigate;
let useLocation = reactRouterUseLocation;
let useParams = reactRouterUseParams;
let JacClientErrorBoundary = ErrorBoundary;
function useRouter() {
  let navigate = reactRouterUseNavigate();
  let location = reactRouterUseLocation();
  let params = reactRouterUseParams();
  return {"navigate": navigate, "location": location, "params": params, "pathname": location.pathname, "search": location.search, "hash": location.hash};
}
function navigate(path) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(Reflect.construct(PopStateEvent, ["popstate"]));
}
async function __jacSpawn(left, right, fields) {
  let token = __getLocalStorage("jac_token");
  let base_url = __getApiBaseUrl();
  let url = `${base_url}/walker/${left}`;
  if ((right !== "")) {
    url = `${base_url}/walker/${left}/${right}`;
  }
  let response = await fetch(url, {"method": "POST", "accept": "application/json", "headers": {"Content-Type": "application/json", "Authorization": (token ? `Bearer ${token}` : "")}, "body": JSON.stringify(fields)});
  if (!response.ok) {
    let error_text = await response.json();
    let walker_name = (right ? `${left}/${right}` : left);
    throw new Error(`Walker ${walker_name} failed: ${error_text}`);
  }
  let payload = await response.json();
  return (payload["data"] ? payload["data"] : {});
}
function jacSpawn(left, right, fields) {
  return __jacSpawn(left, right, fields);
}
async function __jacCallFunction(function_name, args) {
  let token = __getLocalStorage("jac_token");
  let base_url = __getApiBaseUrl();
  let response = await fetch(`${base_url}/function/${function_name}`, {"method": "POST", "headers": {"Content-Type": "application/json", "Authorization": (token ? `Bearer ${token}` : "")}, "body": JSON.stringify(args)});
  let payload = await response.json();
  if (!payload["ok"]) {
    let error_msg = (payload["error"] ? payload["error"] : "Unknown error");
    throw new Error(`Function ${function_name} failed: ${error_msg}`);
  }
  let result = null;
  try {
    if ((payload["data"] && payload["data"]["result"])) {
      result = payload["data"]["result"];
    }
  } catch {}
  return result;
}
async function jacSignup(username, password) {
  let base_url = __getApiBaseUrl();
  let response = await fetch(`${base_url}/user/register`, {"method": "POST", "headers": {"Content-Type": "application/json"}, "body": JSON.stringify({"username": username, "password": password})});
  if (response.ok) {
    let data = JSON.parse(await response.text());
    let token = null;
    if ((data["data"] && data["data"]["token"])) {
      token = data["data"]["token"];
    }
    if (token) {
      __setLocalStorage("jac_token", token);
      return {"success": true, "token": token, "username": username};
    }
    return {"success": false, "error": "No token received"};
  } else {
    let error_text = await response.text();
    try {
      let error_data = JSON.parse(error_text);
      return {"success": false, "error": ((error_data["error"] !== null) ? error_data["error"] : "Signup failed")};
    } catch {
      return {"success": false, "error": error_text};
    }
  }
}
async function jacLogin(username, password) {
  let base_url = __getApiBaseUrl();
  let response = await fetch(`${base_url}/user/login`, {"method": "POST", "headers": {"Content-Type": "application/json"}, "body": JSON.stringify({"username": username, "password": password})});
  if (response.ok) {
    let data = JSON.parse(await response.text());
    console.log("data", data);
    let token = null;
    try {
      if ((data["data"] && data["data"]["token"])) {
        token = data["data"]["token"];
      }
    } catch {}
    console.log("token", token);
    if (token) {
      __setLocalStorage("jac_token", token);
      return true;
    }
  }
  return false;
}
function jacLogout() {
  __removeLocalStorage("jac_token");
}
function jacIsLoggedIn() {
  let token = __getLocalStorage("jac_token");
  return ((token !== null) && (token !== ""));
}
function __getApiBaseUrl() {
  return (globalThis.__JAC_API_BASE_URL__ || "");
}
function __getLocalStorage(key) {
  let storage = globalThis.localStorage;
  return (storage ? storage.getItem(key) : "");
}
function __setLocalStorage(key, value) {
  let storage = globalThis.localStorage;
  if (storage) {
    storage.setItem(key, value);
  }
}
function __removeLocalStorage(key) {
  let storage = globalThis.localStorage;
  if (storage) {
    storage.removeItem(key);
  }
}
function ErrorFallback(error, resetErrorBoundary) {
  return __jacJsx("div", {"role": "alert", "style": {minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center", backgroundColor: "#f9fafb", fontFamily: "system-ui, sans-serif"}}, [__jacJsx("div", {"role": "alert", "style": {minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", backgroundColor: "#f9fafb", fontFamily: "system-ui, sans-serif"}}, [__jacJsx("h2", {"style": {color: "#dc2626", marginBottom: "12px"}}, ["🚨 Something went wrong"]), __jacJsx("p", {"style": {color: "#374151", marginBottom: "16px"}}, ["An unexpected error occurred. Please try again."]), __jacJsx("pre", {"style": {color: "#991b1b", background: "#fee2e2", padding: "12px", borderRadius: "8px", fontSize: "14px", overflowX: "auto", marginBottom: "16px"}}, [error.error.message]), __jacJsx("button", {"onClick": () => {
    error.resetErrorBoundary();
  }, "style": {backgroundColor: "#2563eb", color: "#fff", padding: "10px 16px", borderRadius: "8px", border: "none", cursor: "pointer", fontSize: "14px"}}, ["🔄 Try again"])])]);
}
function errorOverlay(filePath, errors) {
  return __jacJsx("div", {"style": {position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0, 0, 0, 0.85)", color: "#fff", fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace", fontSize: 14, zIndex: 999999, overflow: "auto", padding: 20, boxSizing: "border-box"}}, [__jacJsx("div", {"style": {maxWidth: 1200, margin: "0 auto"}}, [__jacJsx("div", {"style": {background: "#d32f2f", color: "white", padding: "16px 24px", borderRadius: "8px 8px 0 0", fontSize: 18, fontWeight: "bold"}}, ["⚠️ Compilation Error"]), __jacJsx("div", {"style": {background: "#1e1e1e", padding: 24, borderRadius: "0 0 8px 8px"}}, [__jacJsx("div", {"style": {marginBottom: 16}}, [__jacJsx("div", {"style": {color: "#888", marginBottom: 8}}, ["File:"]), __jacJsx("div", {"style": {color: "#64b5f6", fontWeight: "bold"}}, [filePath])]), __jacJsx("div", {}, [__jacJsx("div", {"style": {color: "#888", marginBottom: 8}}, ["Error:"]), __jacJsx("pre", {"style": {background: "#2d2d2d", padding: 16, borderRadius: 4, overflowX: "auto", margin: 0, borderLeft: "4px solid #d32f2f", lineHeight: 1.6, color: "#ff6b6b"}}, [errors])]), __jacJsx("div", {"style": {marginTop: 24, paddingTop: 16, borderTop: "1px solid #444", color: "#888", fontSize: 13}}, ["💡 Fix the error and save the file to continue development."])])])]);
}
export {ErrorFallback, JacClientErrorBoundary, Link, Navigate, Route, Router, Routes, __getApiBaseUrl, __getLocalStorage, __jacCallFunction, __jacJsx, __jacSpawn, __removeLocalStorage, __setLocalStorage, errorOverlay, jacIsLoggedIn, jacLogin, jacLogout, jacSignup, jacSpawn, navigate, useEffect, useLocation, useNavigate, useParams, useRouter, useState};