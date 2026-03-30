
  import { createRoot } from "react-dom/client";
  import './lib/i18n'; // Initialize i18next before rendering
  import App from "./App";
  import "./index.css";
import { Analytics } from "@vercel/analytics/react";

  // Global error handlers to catch unhandled errors and prevent white screens
  window.addEventListener('error', (event) => {
    console.error('Global error caught:', event.error);
    // You could send to error reporting service here
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    // Prevent default browser error handling
    event.preventDefault();
    // You could send to error reporting service here
  });

createRoot(document.getElementById("root")!).render(
  <>
    <App />
    <Analytics />
  </>
);
  