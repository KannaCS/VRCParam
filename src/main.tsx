import React from "react";
import ReactDOM from "react-dom/client";
import { useEffect } from "react";
import App from "./App";
import "./globals.css";
import { useAppStore } from "./store";

// Theme provider component
function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { config } = useAppStore();
  
  useEffect(() => {
    // Apply theme based on user preferences
    const root = window.document.documentElement;
    const isDark = config.theme === 'dark' || 
      (config.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [config.theme]);
  
  return <>{children}</>;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
