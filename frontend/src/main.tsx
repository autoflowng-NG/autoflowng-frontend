import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Force dark class on html element for AUTOFLOWNG dark-only design
document.documentElement.classList.add("dark");

createRoot(document.getElementById("root")!).render(<App />);
