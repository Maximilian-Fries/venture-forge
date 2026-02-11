import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Register frameworks
import { FrameworkRegistry } from '@/lib/frameworks/registry';
import { thielFramework } from '@/lib/frameworks/thiel';
import { ycFramework } from '@/lib/frameworks/yc';

FrameworkRegistry.register(thielFramework, true);
FrameworkRegistry.register(ycFramework);

createRoot(document.getElementById("root")!).render(<App />);
