import React from "react";
import { createRoot } from "react-dom/client";
import { app as App } from "./main.js";
import { JacClientErrorBoundary, ErrorFallback } from "@jac/runtime";

const root = createRoot(document.getElementById("root"));
root.render(
	React.createElement(
		JacClientErrorBoundary,{ FallbackComponent: ErrorFallback },
		React.createElement(App, null)
	)
);
