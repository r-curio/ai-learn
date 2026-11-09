import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter/opsz.css";
import "./globals.css";
import { App } from "./App.tsx";

// The macOS desktop app draws its window controls over the window bar, which leaves room for them.
if (/Mac/.test(navigator.userAgent) && /Electron/.test(navigator.userAgent)) {
	document.documentElement.dataset.macControls = "";
}

createRoot(document.getElementById("root")!).render(<App />);
