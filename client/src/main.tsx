import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

/** START GAME CODE */

const root = createRoot(document.getElementById("app-root")!);
root.render(<App />);
