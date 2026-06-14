import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import App from "./App";
import "./index.css";

document.documentElement.classList.add("dark");

window.onerror = function(msg, src, line, col, err) {
  document.body.innerHTML = '<div style="color:red;padding:20px;font-size:16px;background:white">' +
    '<h2>JS Error:</h2><pre>' + msg + '\n\nFile: ' + src + '\nLine: ' + line + '\n\n' + (err?.stack || '') + '</pre></div>';
};

window.onunhandledrejection = function(e) {
  document.body.innerHTML = '<div style="color:red;padding:20px;font-size:16px;background:white">' +
    '<h2>Promise Error:</h2><pre>' + e.reason + '</pre></div>';
};

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
);
// cache bust Sat Jun 13 22:56:51 UTC 2026
