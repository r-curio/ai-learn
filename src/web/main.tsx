import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter";
import "./globals.css";
import { App } from "./App.tsx";

createRoot(document.getElementById("root")!).render(<App />);
